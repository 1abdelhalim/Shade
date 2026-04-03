import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(process.cwd());

await build({
  entryPoints: [path.join(root, "src/sandbox/shade-sandbox-entry.js")],
  outfile: path.join(root, "src/sandbox/shade-sandbox.bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome116",
  minify: false,
  sourcemap: false
});

console.log("Built shade-sandbox.bundle.js (sandboxed inference).");
