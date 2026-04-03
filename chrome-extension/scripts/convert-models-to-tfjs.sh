#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/../app/src/main/assets"
OUT_DIR="$ROOT_DIR/models-tfjs"

if ! command -v tensorflowjs_converter >/dev/null 2>&1; then
  echo "tensorflowjs_converter is not installed."
  echo "Install with: python3 -m pip install tensorflowjs"
  exit 1
fi

mkdir -p "$OUT_DIR/shade_small_v2" "$OUT_DIR/shade_seg_v1"

tensorflowjs_converter \
  --input_format=tflite \
  --output_format=tfjs_graph_model \
  "$SRC_DIR/shade_small_v2.tflite" \
  "$OUT_DIR/shade_small_v2"

tensorflowjs_converter \
  --input_format=tflite \
  --output_format=tfjs_graph_model \
  "$SRC_DIR/shade_seg_v1.tflite" \
  "$OUT_DIR/shade_seg_v1"

echo "Converted models to TFJS graph format in $OUT_DIR"
