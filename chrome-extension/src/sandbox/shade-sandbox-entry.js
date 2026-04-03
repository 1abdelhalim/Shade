/**
 * Runs inside manifest sandbox page so @tensorflow/tfjs-tflite may use eval().
 * Parent offscreen document proxies frames via postMessage (no chrome.* here).
 */
import { SANDBOX } from "../shared/constants.js";
import {
  applyNms,
  thresholdByConfidence
} from "../shared/detector-postprocess.js";
import { detectHeuristicSensitiveRegions } from "../shared/heuristic-detector.js";
import { yoloOutputToCandidates } from "../shared/yolo-decode.js";

const MAX_DETECTIONS = 12;
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const tf = globalThis.tf;
const tflite = globalThis.tflite;

const modelState = {
  initialized: false,
  model: null,
  inputWidth: 640,
  inputHeight: 640
};

async function dataUrlToImageBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

async function ensureModelLoaded(wasmBaseUrl, modelSource) {
  if (modelState.initialized) {
    return modelState;
  }
  modelState.initialized = true;

  try {
    if (!tf || !tflite) {
      modelState.model = null;
      return modelState;
    }

    await tf.setBackend("cpu");
    await tf.ready();
    tflite.setWasmPath(wasmBaseUrl);

    const model = await tflite.loadTFLiteModel(modelSource, { numThreads: 1 });
    const inputShape = model.inputs?.[0]?.shape || [1, 640, 640, 3];
    modelState.model = model;
    modelState.inputHeight = Number(inputShape[1]) || 640;
    modelState.inputWidth = Number(inputShape[2]) || 640;
  } catch (_err) {
    modelState.model = null;
  }

  return modelState;
}

async function runModelInference(frame, confidencePercent) {
  const state = modelState;
  if (!state.model) {
    return null;
  }

  const output = tf.tidy(() => {
    const rgba = tf.tensor(frame.data, [frame.height, frame.width, 4], "float32");
    const rgb = rgba.slice([0, 0, 0], [frame.height, frame.width, 3]);
    const resized = tf.image.resizeBilinear(rgb, [
      state.inputHeight,
      state.inputWidth
    ]);
    const input = resized.div(255).expandDims(0);
    return state.model.predict(input);
  });

  const tensor = Array.isArray(output) ? output[0] : output;
  const shape = tensor?.shape || [];
  if (shape.length < 3) {
    tensor?.dispose?.();
    return null;
  }
  const out = await tensor.data();
  tensor.dispose();

  const candidates = yoloOutputToCandidates(out, shape);

  return applyNms(thresholdByConfidence(candidates, confidencePercent)).slice(
    0,
    MAX_DETECTIONS
  );
}

let initStarted = false;

async function handleInit(event) {
  if (initStarted) {
    return;
  }
  initStarted = true;
  const { wasmBaseUrl, modelUrl, modelBytes } = event.data;
  const modelSource =
    modelBytes instanceof ArrayBuffer ? modelBytes : modelUrl;
  await ensureModelLoaded(wasmBaseUrl, modelSource);
  event.source.postMessage(
    {
      type: SANDBOX.INITED,
      hasModel: Boolean(modelState.model)
    },
    "*"
  );
}

async function handleProcess(event) {
  const { id, dataUrl, settings } = event.data;
  const conf = settings?.confidence_percent ?? 70;

  try {
    const bitmap = await dataUrlToImageBitmap(dataUrl);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    bitmap.close();

    let boxes = await runModelInference(frame, conf);
    if (!boxes) {
      const candidates = detectHeuristicSensitiveRegions(
        frame.data,
        canvas.width,
        canvas.height
      );
      const thresholded = thresholdByConfidence(candidates, conf);
      boxes = applyNms(thresholded).slice(0, MAX_DETECTIONS);
    }

    event.source.postMessage(
      {
        type: SANDBOX.RESULT,
        id,
        ok: true,
        boxes,
        frameSize: { width: canvas.width, height: canvas.height }
      },
      "*"
    );
  } catch (err) {
    event.source.postMessage(
      {
        type: SANDBOX.RESULT,
        id,
        ok: false,
        error: err?.message || String(err)
      },
      "*"
    );
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) {
    return;
  }
  const t = event.data?.type;
  if (t === SANDBOX.INIT) {
    handleInit(event).catch(() => {
      event.source.postMessage(
        { type: SANDBOX.INITED, hasModel: false },
        "*"
      );
    });
    return;
  }
  if (t === SANDBOX.PROCESS) {
    handleProcess(event);
  }
});

window.parent.postMessage({ type: SANDBOX.READY }, "*");
