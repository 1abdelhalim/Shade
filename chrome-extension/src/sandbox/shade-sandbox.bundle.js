(() => {
  // src/shared/constants.js
  var SANDBOX = {
    READY: "shade/sandbox-ready",
    INIT: "shade/sandbox-init",
    INITED: "shade/sandbox-inited",
    PROCESS: "shade/sandbox-process",
    RESULT: "shade/sandbox-result"
  };

  // src/shared/detector-postprocess.js
  var NMS_IOU_THRESHOLD = 0.45;
  var SEGMENTATION_THRESHOLD = 0.33;
  var SEG_LOGIT_THRESHOLD = Math.log(
    SEGMENTATION_THRESHOLD / (1 - SEGMENTATION_THRESHOLD)
  );
  function iou(a, b) {
    const x1 = Math.max(a.x1, b.x1);
    const y1 = Math.max(a.y1, b.y1);
    const x2 = Math.min(a.x2, b.x2);
    const y2 = Math.min(a.y2, b.y2);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const intersection = w * h;
    if (intersection <= 0) {
      return 0;
    }
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
    return intersection / (areaA + areaB - intersection);
  }
  function applyNms(boxes) {
    const sorted = [...boxes].sort((a, b) => b.score - a.score);
    const selected = [];
    for (const box of sorted) {
      let keep = true;
      for (const chosen of selected) {
        if (iou(box, chosen) > NMS_IOU_THRESHOLD) {
          keep = false;
          break;
        }
      }
      if (keep) {
        selected.push(box);
      }
    }
    return selected;
  }
  function thresholdByConfidence(candidates, confidencePercent) {
    const confidenceThreshold = Math.min(1, Math.max(0, confidencePercent / 100));
    return candidates.filter((candidate) => candidate.score >= confidenceThreshold);
  }

  // src/shared/yolo-decode.js
  var COCO_MIN_CLASS_COUNT = 80;
  function interpretYoloOutputShape(shape) {
    if (!shape || shape.length < 3) {
      return { layout: "channelsFirst", numChannel: 5, numPredictions: 0 };
    }
    const a = Number(shape[1]) || 0;
    const b = Number(shape[2]) || 0;
    if (a >= 4 && a < 256 && b >= a * 4) {
      return { layout: "channelsFirst", numChannel: a, numPredictions: b };
    }
    if (b >= 4 && b < 256 && a >= b * 4) {
      return { layout: "channelsLast", numChannel: b, numPredictions: a };
    }
    if (a >= 4 && a <= b) {
      return { layout: "channelsFirst", numChannel: a, numPredictions: b };
    }
    if (b >= 4 && a > b) {
      return { layout: "channelsLast", numChannel: b, numPredictions: a };
    }
    return { layout: "channelsFirst", numChannel: a, numPredictions: b };
  }
  function aggregateClassScoreSlice(out, start, numClasses) {
    if (numClasses <= 0) {
      return Number.NaN;
    }
    const classStartOffset = numClasses >= COCO_MIN_CLASS_COUNT ? 1 : 0;
    if (classStartOffset >= numClasses) {
      return Number.NaN;
    }
    let maxScore = out[start + classStartOffset];
    for (let k = classStartOffset + 1; k < numClasses; k += 1) {
      const v = out[start + k];
      if (v > maxScore) {
        maxScore = v;
      }
    }
    return maxScore;
  }
  function aggregateClassScoreChannelsFirst(out, numPredictions, numChannel, i) {
    const numClasses = numChannel - 4;
    if (numClasses <= 0) {
      return Number.NaN;
    }
    const classStartOffset = numClasses >= COCO_MIN_CLASS_COUNT ? 1 : 0;
    if (classStartOffset >= numClasses) {
      return Number.NaN;
    }
    let maxScore = out[(4 + classStartOffset) * numPredictions + i];
    for (let k = classStartOffset + 1; k < numClasses; k += 1) {
      const v = out[(4 + k) * numPredictions + i];
      if (v > maxScore) {
        maxScore = v;
      }
    }
    return maxScore;
  }
  function decodeYoloPrediction(out, dims, predictionIndex) {
    const { layout, numChannel, numPredictions } = dims;
    if (predictionIndex < 0 || predictionIndex >= numPredictions || numChannel < 5) {
      return null;
    }
    if (layout === "channelsLast") {
      const base = predictionIndex * numChannel;
      return {
        cx: out[base],
        cy: out[base + 1],
        w: out[base + 2],
        h: out[base + 3],
        score: aggregateClassScoreSlice(out, base + 4, numChannel - 4)
      };
    }
    const i = predictionIndex;
    return {
      cx: out[i],
      cy: out[numPredictions + i],
      w: out[2 * numPredictions + i],
      h: out[3 * numPredictions + i],
      score: aggregateClassScoreChannelsFirst(
        out,
        numPredictions,
        numChannel,
        i
      )
    };
  }
  function yoloOutputToCandidates(out, shape) {
    const dims = interpretYoloOutputShape(shape);
    const { numPredictions, numChannel } = dims;
    if (numPredictions <= 0 || numChannel < 5) {
      return [];
    }
    const candidates = [];
    for (let i = 0; i < numPredictions; i += 1) {
      const row = decodeYoloPrediction(out, dims, i);
      if (!row || !Number.isFinite(row.score)) {
        continue;
      }
      const { cx, cy, w, h, score } = row;
      const x1 = Math.max(0, Math.min(1, cx - w * 0.5));
      const y1 = Math.max(0, Math.min(1, cy - h * 0.5));
      const x2 = Math.max(0, Math.min(1, cx + w * 0.5));
      const y2 = Math.max(0, Math.min(1, cy + h * 0.5));
      if (x2 <= x1 || y2 <= y1) {
        continue;
      }
      candidates.push({ x1, y1, x2, y2, score });
    }
    return candidates;
  }

  // src/sandbox/shade-sandbox-entry.js
  var MAX_DETECTIONS = 12;
  var canvas = new OffscreenCanvas(1, 1);
  var ctx = canvas.getContext("2d", { willReadFrequently: true });
  var tf = globalThis.tf;
  var tflite = globalThis.tflite;
  var modelState = {
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
    } catch (err) {
      console.error("Shade Sandbox: TFLite Initialization Failed:", err);
      modelState.model = null;
      modelState.error = err?.message || String(err);
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
  var initStarted = false;
  async function handleInit(event) {
    if (initStarted) {
      return;
    }
    initStarted = true;
    const { wasmBaseUrl, modelUrl, modelBytes } = event.data;
    const modelSource = modelBytes instanceof ArrayBuffer ? modelBytes : modelUrl;
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
        throw new Error("ML Model Failed to Load: " + (modelState.error || "Unknown"));
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
})();
