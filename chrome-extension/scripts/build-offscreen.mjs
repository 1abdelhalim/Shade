import { mkdir, cp } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const wasmSourceDir = path.join(root, "node_modules", "@tensorflow", "tfjs-tflite", "wasm");
const wasmTargetDir = path.join(root, "vendor", "tflite-wasm");
const tfJsSource = path.join(root, "node_modules", "@tensorflow", "tfjs", "dist", "tf.min.js");
const tfLiteSource = path.join(root, "node_modules", "@tensorflow", "tfjs-tflite", "dist", "tf-tflite.min.js");
const vendorDir = path.join(root, "vendor");

await mkdir(vendorDir, { recursive: true });
await mkdir(wasmTargetDir, { recursive: true });
await cp(wasmSourceDir, wasmTargetDir, { recursive: true });
await cp(tfJsSource, path.join(vendorDir, "tf.min.js"));
await cp(tfLiteSource, path.join(vendorDir, "tf-tflite.min.js"));

await cp(wasmSourceDir, vendorDir, {
  recursive: true,
  filter: (src) => {
    const base = path.basename(src);
    return base === "wasm" || base.startsWith("tflite_web_api_") || base.endsWith(".wasm");
  }
});
console.log("Copied TFJS runtime and TFLite WASM assets.");
