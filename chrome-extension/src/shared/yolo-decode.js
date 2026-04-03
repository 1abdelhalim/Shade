/**
 * Decode raw YOLO-style TFLite output [1, A, B] into normalized box candidates.
 * Matches com.moh.sh.app.shade.detection.Detector layout rules, with fixes for:
 * - Web runtimes that return [1, numPredictions, numChannel] instead of [1, numChannel, numPredictions]
 * - Multi-class heads: Android uses only channel index 4 (first class). For COCO that is "person",
 *   which blurs every portrait. We exclude class 0 when there are ≥80 classes (COCO-sized).
 */

/** COCO has 80 classes; class 0 is "person". */
const COCO_MIN_CLASS_COUNT = 80;

/**
 * @param {number[]} shape Tensor shape (length 3): [batch, dim1, dim2]
 * @returns {{ layout: "channelsFirst" | "channelsLast"; numChannel: number; numPredictions: number }}
 */
export function interpretYoloOutputShape(shape) {
  if (!shape || shape.length < 3) {
    return { layout: "channelsFirst", numChannel: 5, numPredictions: 0 };
  }
  const a = Number(shape[1]) || 0;
  const b = Number(shape[2]) || 0;

  /** Channels are usually the smaller YOLO dimension (≈5–90); anchors are thousands. */
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

/**
 * @param {Float32Array|number[]} out
 * @param {{ layout: string; numChannel: number; numPredictions: number }} dims
 * @param {number} predictionIndex
 * @returns {{ cx: number; cy: number; w: number; h: number; score: number } | null}
 */
export function decodeYoloPrediction(out, dims, predictionIndex) {
  const { layout, numChannel, numPredictions } = dims;
  if (
    predictionIndex < 0 ||
    predictionIndex >= numPredictions ||
    numChannel < 5
  ) {
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

/**
 * @param {Float32Array|number[]} out Raw model output
 * @param {number[]} shape Tensor shape [batch, dim1, dim2]
 * @returns {Array<{ x1: number; y1: number; x2: number; y2: number; score: number }>}
 */
export function yoloOutputToCandidates(out, shape) {
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
