import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(process.cwd());

await build({
  entryPoints: [path.join(root, "src/content/content-script.js")],
  outfile: path.join(root, "src/content/content-script.bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome116",
  minify: false,
  sourcemap: false
});

console.log("Built content-script.bundle.js (single file, no ES modules in page).");
