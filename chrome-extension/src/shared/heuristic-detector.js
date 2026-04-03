import { toNormalizedBox } from "./detector-postprocess.js";

export function detectHeuristicSensitiveRegions(imageData, width, height) {
  const boxes = [];
  const visited = new Uint8Array(width * height);
  const pixels = imageData;
  const step = 4;

  const isSensitive = (idx) => {
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const warm = r > 95 && g > 40 && b > 20 && r > b && Math.abs(r - g) > 15;
    const nearSkin = warm && luma > 55 && luma < 235;
    const highContrast = Math.max(r, g, b) - Math.min(r, g, b) > 110 && luma > 80;
    return nearSkin || highContrast;
  };

  const minRegionArea = Math.floor((width * height) * 0.0022);
  const downsample = Math.max(3, Math.floor(Math.min(width, height) / 220));

  for (let y = 0; y < height; y += downsample) {
    for (let x = 0; x < width; x += downsample) {
      const cell = y * width + x;
      if (visited[cell]) {
        continue;
      }
      const idx = cell * step;
      if (!isSensitive(idx)) {
        continue;
      }

      const queue = [[x, y]];
      visited[cell] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let count = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        count += 1;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          [cx - downsample, cy],
          [cx + downsample, cy],
          [cx, cy - downsample],
          [cx, cy + downsample]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            continue;
          }
          const nCell = ny * width + nx;
          if (visited[nCell]) {
            continue;
          }
          visited[nCell] = 1;
          const nIdx = nCell * step;
          if (isSensitive(nIdx)) {
            queue.push([nx, ny]);
          }
        }
      }

      const regionArea = (maxX - minX + 1) * (maxY - minY + 1);
      if (count > 8 && regionArea >= minRegionArea) {
        const score = Math.min(0.99, 0.35 + count / 250);
        boxes.push(
          toNormalizedBox(
            {
              x: minX,
              y: minY,
              width: Math.max(1, maxX - minX),
              height: Math.max(1, maxY - minY)
            },
            width,
            height,
            score
          )
        );
      }
    }
  }

  return boxes;
}
