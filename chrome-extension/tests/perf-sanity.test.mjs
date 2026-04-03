import test from "node:test";
import assert from "node:assert/strict";

import { detectHeuristicSensitiveRegions } from "../src/shared/heuristic-detector.js";
import { applyNms, thresholdByConfidence } from "../src/shared/detector-postprocess.js";

function syntheticFrame(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const inHotBox = x > width * 0.3 && x < width * 0.68 && y > height * 0.2 && y < height * 0.86;
      data[i] = inHotBox ? 228 : 30;
      data[i + 1] = inHotBox ? 136 : 35;
      data[i + 2] = inHotBox ? 110 : 38;
      data[i + 3] = 255;
    }
  }
  return data;
}

test("heuristic detector performance sanity at 720p", () => {
  const width = 1280;
  const height = 720;
  const frame = syntheticFrame(width, height);

  const start = performance.now();
  const candidates = detectHeuristicSensitiveRegions(frame, width, height);
  const thresholded = thresholdByConfidence(candidates, 70);
  const boxes = applyNms(thresholded);
  const elapsedMs = performance.now() - start;

  assert.ok(boxes.length > 0);
  assert.ok(elapsedMs < 250, `Expected <250ms, got ${elapsedMs.toFixed(2)}ms`);
});
