# Shade Web Validation Notes

## Automated checks run

- Build/sync:
  - `npm run build`
  - Result: model assets + TF runtime vendored successfully
- Unit tests:
  - `npm test`
  - Result: 4/4 passing (post-process parity + performance sanity)
- Offline dependency scan:
  - searched for `http://` and `https://` under `chrome-extension/`
  - Result: no external URLs found

## Manual validation checklist

1. Load extension unpacked from `chrome-extension/`.
2. Open a media-heavy page (images/videos).
3. Verify protection auto-enables on page load.
4. Confirm popup toggle can disable and re-enable protection for current tab.
5. Confirm options sliders update behavior:
   - confidence
   - overlay opacity
   - pixelation level
6. Confirm performance mode lowers frame cadence (less frequent updates).
7. Validate overlay repositions correctly after viewport resize.
8. Validate no breakage on:
   - static pages
   - infinite-scroll feed pages
   - full-screen video page

## Findings & Fixes Applied

- **WASM Loading Bug**: The `tfjs-tflite` libraries in the sandbox failed to fetch `tflite_web_api_cc.wasm` because the sandbox pages don't have access to `chrome-extension://` local files unless they are made accessible. FIXED by adding `vendor/tflite-wasm/*` and `models/*` to `web_accessible_resources` in `manifest.json`.
- **Iframe Multi-Render Bug**: `chrome.tabs.captureVisibleTab` takes a screenshot of the *entire* tab viewport. When YOLO returned detection boxes, they were forwarded to all `content_scripts` in the tab. This caused child `iframes` to render the same screen coordinates as the root frame, causing duplicate mismatched blurring. FIXED by ensuring `content-script.js` only runs ML coordinate rendering when `window === window.top`.
- **UI/UX Makeover**: The default options and popup interfaces used a plain and basic style. UPDATED to use a premium, glassmorphic dark mode UI design per the Rich Aesthetics guidelines.

## Current known gaps

- Detailed segmentation (`shade_seg_v1.tflite`) is bundled but not yet the active inference path; active model path uses `shade_small_v2.tflite`.
- Heuristic detector remains as runtime fallback if TFLite initialization fails.
- Per-tab processing currently tracks active tab capture cadence; inactive tabs are auto-protected but not continuously analyzed until active.
