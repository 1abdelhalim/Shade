import test from "node:test";
import assert from "node:assert/strict";

import {
  applyNms,
  applySegmentationLogitThreshold,
  segmentationThresholdForTesting,
  thresholdByConfidence
} from "../src/shared/detector-postprocess.js";

test("thresholdByConfidence keeps candidates above confidence cutoff", () => {
  const candidates = [
    { score: 0.2 },
    { score: 0.7 },
    { score: 0.9 }
  ];
  const kept = thresholdByConfidence(candidates, 70);
  assert.equal(kept.length, 2);
  assert.deepEqual(
    kept.map((item) => item.score),
    [0.7, 0.9]
  );
});

test("applyNms drops highly overlapping lower-score boxes", () => {
  const selected = applyNms([
    { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4, score: 0.9 },
    { x1: 0.12, y1: 0.12, x2: 0.42, y2: 0.42, score: 0.8 },
    { x1: 0.6, y1: 0.6, x2: 0.8, y2: 0.8, score: 0.85 }
  ]);

  assert.equal(selected.length, 2);
  assert.equal(selected[0].score, 0.9);
  assert.equal(selected[1].score, 0.85);
});

test("segmentation threshold uses Android-equivalent logit cutoff", () => {
  const threshold = segmentationThresholdForTesting();
  const logits = [threshold - 0.0001, threshold + 0.0001, -10, 10];
  const mask = applySegmentationLogitThreshold(logits, 2, 2);
  assert.deepEqual(mask, [false, true, false, true]);
});
