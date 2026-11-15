// Classify map-rgb.json into biome chars. Prints ASCII preview.
import { readFileSync } from "node:fs";
const { w, h, rgb } = JSON.parse(readFileSync("tools/map-rgb.json", "utf8"));
export function classify(r, g, b) {
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  if (b > r + 2) return "~"; // water: blue/teal
  if (g > r + 10 && g > b + 5) return "f"; // forest green
  if (r > g + 15 && r > b + 50 && l > 85) return "d"; // desert orange
  if (l < 82) return "m"; // dark rock = mountain
  return "s"; // pale sand / plains
}
const rows = [];
for (let y = 0; y < h; y++) {
  let row = "";
  for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; row += classify(rgb[i], rgb[i + 1], rgb[i + 2]); }
  rows.push(row);
}
if (process.argv[2] === "--print") console.log(rows.join("\n"));
export { rows, w, h };
