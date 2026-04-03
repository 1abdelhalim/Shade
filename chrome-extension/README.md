# Shade Web (Chrome Extension)

Shade Web ports the core Shade behavior to Chrome MV3: detect potentially sensitive content and blur/pixelate regions directly in-browser while staying offline.

## What is included

- MV3 extension shell with:
  - service worker (`src/background/service-worker.js`)
  - offscreen processor (`src/offscreen/offscreen.html`, `src/offscreen/offscreen.js`)
  - content overlay (`src/content/content-script.js`, `src/content/shade-content.css`)
  - popup + options UI (`src/popup/*`, `src/options/*`)
- Android-aligned settings keys/defaults in `chrome.storage.local`.
- Detector post-processing parity helpers:
  - confidence thresholding
  - IoU NMS (`0.45`)
  - segmentation logit threshold (`0.33` -> logit transform)
- Local model runtime:
  - `models/shade_small_v2.tflite` (active)
  - `models/shade_seg_v1.tflite` (bundled for next-stage detailed mode)
  - local TensorFlow.js + TFLite WASM runtime in `vendor/`

## Build and sync

```bash
cd chrome-extension
npm install
npm run build
```

`npm run build` does:
- copy Android `.tflite` models from `../app/src/main/assets` into `chrome-extension/models/`
- copy local TFJS runtime + TFLite WASM files into `chrome-extension/vendor/`
- bundle `src/content/content-script.js` → `src/content/content-script.bundle.js` (avoids ES-module import failures in nested iframes, e.g. Google image search)

## Model conversion (optional)

The extension runs `.tflite` directly (no conversion required).  
If you also want TFJS graph artifacts, use:

```bash
cd chrome-extension
./scripts/convert-models-to-tfjs.sh
```

This requires `tensorflowjs_converter` to be installed in your Python environment.

## Notes about model parity

- Primary detection now runs through `shade_small_v2.tflite` in `src/offscreen/offscreen.js`.
- If model runtime fails in an environment, the code falls back to the offline heuristic detector to keep protection active.
- Android-equivalent post-processing remains in `src/shared/detector-postprocess.js`.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the `chrome-extension` directory.

## Privacy / offline behavior

- No remote scripts or CDNs are used.
- All logic/assets are local to the extension package.
- Processing is local in the browser (service worker + offscreen + content script).
