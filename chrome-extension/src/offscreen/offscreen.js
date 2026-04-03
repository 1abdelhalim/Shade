import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import * as tflite from "@tensorflow/tfjs-tflite";

import { MESSAGE } from "../shared/constants.js";
import {
  applyNms,
  thresholdByConfidence
} from "../shared/detector-postprocess.js";
import { yoloOutputToCandidates } from "../shared/yolo-decode.js";

/* ── Constants ─────────────────────────────────────────────── */
const MAX_DETECTIONS = 12;

/* ── Canvas for pixel extraction ───────────────────────────── */
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d", { willReadFrequently: true });

/* ── Model state ───────────────────────────────────────────── */
const modelState = {
  initialized: false,
  model: null,
  inputWidth: 640,
  inputHeight: 640,
  error: null
};

/* ── Model initialization ──────────────────────────────────── */
async function ensureModelLoaded() {
  if (modelState.initialized) {
    return modelState;
  }
  modelState.initialized = true;

  try {
    /* Use CPU backend */
    await tf.setBackend("cpu");
    await tf.ready();

    /* Tell the TFLite plugin where to find the WASM files.
       Point to vendor/ where the WASM files live. */
    const wasmBaseUrl = chrome.runtime.getURL("vendor/");
    tflite.setWasmPath(wasmBaseUrl);

    /* Load model – fetch bytes first so we can pass an ArrayBuffer. */
    const modelUrl = chrome.runtime.getURL("models/shade_small_v2.tflite");
    const modelResponse = await fetch(modelUrl);
    if (!modelResponse.ok) {
      throw new Error("Failed to fetch model");
    }
    const modelBytes = await modelResponse.arrayBuffer();

    const model = await tflite.loadTFLiteModel(modelBytes, { numThreads: 1 });

    const inputShape = model.inputs?.[0]?.shape || [1, 640, 640, 3];
    modelState.model = model;
    modelState.inputHeight = Number(inputShape[1]) || 640;
    modelState.inputWidth = Number(inputShape[2]) || 640;

    console.log(
      "Shade: Model loaded ✓",
      "input " + modelState.inputWidth + "x" + modelState.inputHeight
    );
  } catch (err) {
    console.error("Shade: Model load failed:", err);
    modelState.model = null;
    modelState.error = err?.message || String(err);
  }

  return modelState;
}

/* ── Helpers ───────────────────────────────────────────────── */
async function dataUrlToImageBitmap(dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

/* ── Inference ─────────────────────────────────────────────── */
async function runInference(dataUrl, settings) {
  const state = await ensureModelLoaded();

  if (!state.model) {
    return { ok: false, error: "Model not loaded: " + (state.error || "unknown") };
  }

  const bitmap = await dataUrlToImageBitmap(dataUrl);
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();

  const conf = settings?.confidence_percent ?? 70;

  const output = tf.tidy(() => {
    const rgba = tf.tensor(
      frame.data,
      [frame.height, frame.width, 4],
      "float32"
    );
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
    return { ok: false, error: "Unexpected model output shape" };
  }

  const out = await tensor.data();
  tensor.dispose();

  const candidates = yoloOutputToCandidates(out, shape);
  const boxes = applyNms(thresholdByConfidence(candidates, conf)).slice(
    0,
    MAX_DETECTIONS
  );

  return {
    ok: true,
    boxes,
    frameSize: { width: canvas.width, height: canvas.height }
  };
}

/* ── Kick off model load immediately ───────────────────────── */
ensureModelLoaded().catch(() => {});

/* ── Message handler ───────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE.PROCESS_FRAME) {
    return false;
  }

  const run = async () => {
    const result = await runInference(message.dataUrl, message.settings);

    if (result.ok && result.boxes.length > 0) {
      await chrome.runtime.sendMessage({
        type: MESSAGE.APPLY_DETECTIONS,
        tabId: message.tabId,
        boxes: result.boxes,
        frameSize: result.frameSize,
        settings: message.settings
      });
    }

    return { ok: result.ok, count: result.boxes?.length ?? 0, error: result.error };
  };

  run()
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
