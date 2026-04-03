const NMS_IOU_THRESHOLD = 0.45;
const SEGMENTATION_THRESHOLD = 0.33;
const SEG_LOGIT_THRESHOLD = Math.log(
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

export function applyNms(boxes) {
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

export function thresholdByConfidence(candidates, confidencePercent) {
  const confidenceThreshold = Math.min(1, Math.max(0, confidencePercent / 100));
  return candidates.filter((candidate) => candidate.score >= confidenceThreshold);
}

export function applySegmentationLogitThreshold(logits, width, height) {
  const expectedSize = width * height;
  const output = new Array(expectedSize);
  for (let i = 0; i < expectedSize; i += 1) {
    output[i] = Number(logits[i] || 0) > SEG_LOGIT_THRESHOLD;
  }
  return output;
}

export function toNormalizedBox(pixelBox, frameWidth, frameHeight, score) {
  return {
    x1: Math.max(0, Math.min(1, pixelBox.x / frameWidth)),
    y1: Math.max(0, Math.min(1, pixelBox.y / frameHeight)),
    x2: Math.max(0, Math.min(1, (pixelBox.x + pixelBox.width) / frameWidth)),
    y2: Math.max(0, Math.min(1, (pixelBox.y + pixelBox.height) / frameHeight)),
    score
  };
}

export function segmentationThresholdForTesting() {
  return SEG_LOGIT_THRESHOLD;
}
