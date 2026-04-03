import { mkdir, cp, access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const sourceRoot = path.join(root, "..", "app", "src", "main", "assets");
const targetRoot = path.join(root, "models");
const required = ["shade_small_v2.tflite", "shade_seg_v1.tflite"];

await mkdir(targetRoot, { recursive: true });

for (const file of required) {
  const source = path.join(sourceRoot, file);
  const target = path.join(targetRoot, file);
  await access(source);
  await cp(source, target);
  console.log(`Synced ${file}`);
}
