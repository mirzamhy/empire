// Procedural continent for EMPIRE (replaces the map traced from the reference image).
// Run: node tools/gen-map.mjs [--preview]     -> writes game/src/sim/mapdata.ts
//
// A dark, wooded continent 1.5x wider than the first map: 384 x 288 cells (864 x 648 m at 2.25 m).
//   - coastline: a warped ellipse broken up by noise, with carved bays and a few inland lakes
//   - mountains: five named ranges drawn as spines with a varying width (so each has passes and
//     tapering ends) plus a few lone massifs. map.ts turns the depth inside a range into height,
//     so wide parts become high peaks and narrow parts stay hills.
//   - forest covers most of the lowlands; meadows ("s") are clearings, moor ("d") lies in the
//     rain shadow east of the central range.
// Everything is deterministic: same script, same map.
import { writeFileSync } from "node:fs";

const W = 384;
const H = 288;
const SEED = 20261116;

// ---------------------------------------------------------------- noise
function hash2(x, y) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Fractal noise in 0..1 (4 octaves). */
function fbm(x, y) {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let o = 0; o < 4; o++) {
    s += vnoise(x, y) * a;
    n += a;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.7;
    a *= 0.5;
  }
  return s / n;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- land
// normalised coordinates: -1..1 on both axes (x east, y south)
const NX = (x) => ((x + 0.5) / W) * 2 - 1;
const NY = (y) => ((y + 0.5) / H) * 2 - 1;

/** Bays and sounds cut into the coast: [x, y, radius, depth]. */
const BAYS = [
  [0.5, 0.78, 0.26, 0.6], // the great southern bay
  [-0.96, -0.02, 0.2, 0.5], // western sound
  [0.34, -0.98, 0.16, 0.4], // northern inlet
  [1.0, 0.16, 0.14, 0.35], // eastern bight
  [-0.35, 0.98, 0.18, 0.4],
];
/** Inland lakes: [x, y, radius]. */
const LAKES = [
  [-0.36, 0.14, 0.075],
  [0.3, -0.1, 0.06],
  [0.02, 0.36, 0.05],
  [-0.12, -0.3, 0.04],
];

const land = new Uint8Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const nx = NX(x);
    const ny = NY(y);
    const wx = nx + (fbm(nx * 1.5 + 5, ny * 1.5) - 0.5) * 0.42;
    const wy = ny + (fbm(nx * 1.5 + 31, ny * 1.5 + 12) - 0.5) * 0.42;
    let v = 1 - Math.hypot(wx / 0.97, wy / 0.95);
    v += (fbm(nx * 2.3 + 11, ny * 2.3 + 3) - 0.5) * 0.7;
    v += (fbm(nx * 7 + 2, ny * 7 + 40) - 0.5) * 0.2;
    for (const [bx, by, r, depth] of BAYS) {
      const d = Math.hypot(nx - bx, (ny - by) * (H / W));
      v -= depth * Math.exp(-(d * d) / (r * r));
    }
    let isLand = v > 0.1;
    for (const [lx, ly, r] of LAKES) {
      const d = Math.hypot(nx - lx, (ny - ly) * (H / W));
      if (d < r * (0.7 + 0.6 * fbm(nx * 9 + 3, ny * 9 + 8))) isLand = false;
    }
    // keep open sea around the edge of the grid
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < 14) isLand = false;
    land[y * W + x] = isLand ? 1 : 0;
  }

/** Connected components of cells where pred is true (4-neighbour). Returns sizes and a label map. */
function components(pred) {
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== -1 || !pred(i)) continue;
    const id = sizes.length;
    const stack = [i];
    label[i] = id;
    let size = 0;
    while (stack.length) {
      const c = stack.pop();
      size++;
      const x = c % W;
      for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (n >= 0 && n < W * H && label[n] === -1 && pred(n)) {
          label[n] = id;
          stack.push(n);
        }
    }
    sizes.push(size);
  }
  return { label, sizes };
}
// drop specks of land, keep a few real islands; fill puddles
{
  const { label, sizes } = components((i) => land[i] === 1);
  for (let i = 0; i < W * H; i++) if (land[i] && sizes[label[i]] < 60) land[i] = 0;
  const w = components((i) => land[i] === 0);
  for (let i = 0; i < W * H; i++) if (!land[i] && w.sizes[w.label[i]] < 40) land[i] = 1;
}

/** Distance in cells to the nearest cell where source is true (4-neighbour BFS). */
function distance(source) {
  const d = new Float32Array(W * H).fill(1e9);
  const q = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < W * H; i++)
    if (source(i)) {
      d[i] = 0;
      q[tail++] = i;
    }
  while (head < tail) {
    const c = q[head++];
    const x = c % W;
    for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
      if (n >= 0 && n < W * H && d[n] > d[c] + 1) {
        d[n] = d[c] + 1;
        q[tail++] = n;
      }
  }
  return d;
}
const distSea = distance((i) => land[i] === 0);

// ---------------------------------------------------------------- mountains
/**
 * Ranges as spines in normalised coordinates. `hw` is the half-width in cells at the widest
 * point; `passes` are positions along the spine (0..1) where the range narrows to a saddle.
 */
const RANGES = [
  { name: "Tembok Utara", hw: 20, pts: [[-0.66, -0.36], [-0.4, -0.5], [-0.08, -0.5], [0.2, -0.42], [0.46, -0.3]], passes: [0.38, 0.74] },
  { name: "Punggung Naga", hw: 16, pts: [[-0.02, -0.14], [0.14, 0.02], [0.3, 0.14], [0.42, 0.3]], passes: [0.55] },
  { name: "Pegunungan Barat", hw: 15, pts: [[-0.66, 0.02], [-0.58, 0.24], [-0.44, 0.4], [-0.26, 0.5]], passes: [0.5] },
  { name: "Bukit Selatan", hw: 10, pts: [[-0.04, 0.56], [0.14, 0.6], [0.3, 0.52]], passes: [] },
  { name: "Tanduk Timur", hw: 12, pts: [[0.6, -0.12], [0.68, 0.06], [0.66, 0.24]], passes: [0.6] },
];

const toCell = ([nx, ny]) => [((nx + 1) / 2) * W, ((ny + 1) / 2) * H];
const mountain = new Uint8Array(W * H);
for (const r of RANGES) {
  const pts = r.pts.map(toCell);
  const segLen = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = segLen.reduce((a, b) => a + b, 0);
  const seedOff = r.name.length * 13.7;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!land[y * W + x]) continue;
      // closest point on the spine and how far along it lies (0..1)
      let best = 1e9;
      let along = 0;
      let run = 0;
      for (let s = 0; s < segLen.length; s++) {
        const [ax, ay] = pts[s];
        const [bx, by] = pts[s + 1];
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (segLen[s] * segLen[s])));
        const d = Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t));
        if (d < best) {
          best = d;
          along = (run + segLen[s] * t) / total;
        }
        run += segLen[s];
      }
      // width: tapers at both ends, pinches at the passes, wobbles with noise
      let w = r.hw * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, Math.max(0, along))) ** 0.6);
      for (const p of r.passes) w *= 1 - 0.72 * Math.exp(-(((along - p) / 0.055) ** 2));
      w *= 0.54 + 0.68 * fbm(x / 26 + seedOff, y / 26 + seedOff * 0.3);
      if (best < w) mountain[y * W + x] = 1;
    }
}
// lone massifs and hill clusters away from the ranges
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || distSea[i] < 5) continue;
    if (fbm(x / 34 + 80, y / 34 + 21) > 0.755) mountain[i] = 1;
  }
// no slivers of rock on the beach, and no isolated single cells
for (let i = 0; i < W * H; i++) if (mountain[i] && distSea[i] < 2) mountain[i] = 0;
{
  const { label, sizes } = components((i) => mountain[i] === 1);
  for (let i = 0; i < W * H; i++) if (mountain[i] && sizes[label[i]] < 25) mountain[i] = 0;
}
const distMtn = distance((i) => mountain[i] === 1);

// ---------------------------------------------------------------- biomes
// centre of the land mass: the dragon altar needs open ground there
let sx = 0;
let sy = 0;
let cnt = 0;
for (let i = 0; i < W * H; i++)
  if (land[i]) {
    sx += i % W;
    sy += (i / W) | 0;
    cnt++;
  }
const cx = sx / cnt;
const cy = sy / cnt;

const g = [];
for (let y = 0; y < H; y++) {
  const row = [];
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i]) {
      row.push("~");
      continue;
    }
    if (mountain[i]) {
      row.push("m");
      continue;
    }
    const nx = NX(x);
    const ny = NY(y);
    const wet = fbm(nx * 3.2 + 7, ny * 3.2 + 1);
    const glade = fbm(x / 13 + 50, y / 13 + 4); // small clearings inside the forest
    // rain shadow: dry moor east of the central range and along the south-east coast
    const dry = fbm(nx * 2.4 + 60, ny * 2.4 + 33) + smooth(0.05, 0.6, nx) * 0.34 - smooth(4, 22, distMtn[i]) * 0.05;
    let b = "f";
    if (dry > 0.82) b = "d";
    else if (wet < 0.37 || glade > 0.7) b = "s";
    // wooded foothills hug every range
    if (b !== "d" && distMtn[i] < 9 && glade < 0.76) b = "f";
    if (Math.hypot(x - cx, y - cy) < 13) b = "s";
    row.push(b);
  }
  g.push(row);
}
// land touching the sea becomes beach
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "~" : g[y][x]);
const out = g.map((r) => r.slice());
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (g[y][x] === "~" || g[y][x] === "m") continue;
    let coast = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy) === "~") coast = true;
    if (coast) out[y][x] = "b";
  }

const rows = out.map((r) => r.join(""));
const counts = {};
for (const r of rows) for (const c of r) counts[c] = (counts[c] ?? 0) + 1;
const landCells = W * H - counts["~"];
console.log(`grid ${W}x${H}, land ${((100 * landCells) / (W * H)).toFixed(1)}%`);
for (const [k, v] of Object.entries(counts)) if (k !== "~") console.log(`  ${k} ${((100 * v) / landCells).toFixed(1)}% of land`);

if (process.argv.includes("--preview")) {
  // coarse ASCII preview: one character per 4 x 4 cells
  for (let y = 0; y < H; y += 5) {
    let line = "";
    for (let x = 0; x < W; x += 3) line += rows[y][x] === "~" ? " " : rows[y][x] === "f" ? ":" : rows[y][x] === "s" ? "." : rows[y][x] === "b" ? "," : rows[y][x] === "d" ? "=" : "#";
    console.log(line);
  }
}

writeFileSync(
  "game/src/sim/mapdata.ts",
  `// Generated by tools/gen-map.mjs (procedural continent, seed ${SEED}). Do not edit by hand.\n` +
    `// ~ water, b beach, s meadow, d moor, f forest, m mountain\n` +
    `export const MAP_W = ${W};\nexport const MAP_H = ${H};\nexport const MAP_ROWS: readonly string[] = [\n${rows.map((r) => `  "${r}",`).join("\n")}\n];\n`,
);
