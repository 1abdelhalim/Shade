import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeYoloPrediction,
  interpretYoloOutputShape,
  yoloOutputToCandidates
} from "../src/shared/yolo-decode.js";

test("interpretYoloOutputShape detects channels-first YOLO layout", () => {
  const d = interpretYoloOutputShape([1, 5, 8400]);
  assert.equal(d.layout, "channelsFirst");
  assert.equal(d.numChannel, 5);
  assert.equal(d.numPredictions, 8400);
});

test("interpretYoloOutputShape detects channels-last layout", () => {
  const d = interpretYoloOutputShape([1, 8400, 5]);
  assert.equal(d.layout, "channelsLast");
  assert.equal(d.numChannel, 5);
  assert.equal(d.numPredictions, 8400);
});

test("single-class channels-first uses only class row", () => {
  const numP = 3;
  const numC = 5;
  const out = new Float32Array(numC * numP);
  out[0] = 0.5;
  out[numP] = 0.5;
  out[2 * numP] = 0.2;
  out[3 * numP] = 0.4;
  out[4 * numP] = 0.88;
  const dims = { layout: "channelsFirst", numChannel: numC, numPredictions: numP };
  const row = decodeYoloPrediction(out, dims, 0);
  assert.ok(Math.abs(row.score - 0.88) < 1e-5);
});

test("COCO-sized head skips person (class 0) for score", () => {
  const numP = 2;
  const numC = 84;
  const out = new Float32Array(numC * numP);
  let idx = 0;
  for (let c = 0; c < numC; c += 1) {
    for (let i = 0; i < numP; i += 1) {
      out[idx] = 0;
      idx += 1;
    }
  }
  out[4 * numP + 0] = 0.99;
  out[(4 + 1) * numP + 0] = 0.1;
  out[(4 + 2) * numP + 0] = 0.2;
  const dims = { layout: "channelsFirst", numChannel: numC, numPredictions: numP };
  const row = decodeYoloPrediction(out, dims, 0);
  assert.ok(row.score <= 0.2 + 0.0001);
  assert.ok(row.score >= 0.2);
});

test("yoloOutputToCandidates maps channels-last row correctly", () => {
  const numP = 120;
  const numC = 5;
  const out = new Float32Array(numP * numC);
  out[0 * numC + 0] = 0.5;
  out[0 * numC + 1] = 0.5;
  out[0 * numC + 2] = 0.4;
  out[0 * numC + 3] = 0.4;
  out[0 * numC + 4] = 0.95;
  const boxes = yoloOutputToCandidates(out, [1, numP, numC]);
  const top = boxes.filter((b) => b.score >= 0.9);
  assert.equal(top.length, 1);
  assert.ok(Math.abs(top[0].score - 0.95) < 1e-5);
});
