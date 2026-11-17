// Rivers for maps that define them (sim/maps.ts). A river is only a shape in the ground and a
// ribbon of water for the renderer: its cells keep their biome, so they stay walkable and troops
// wade straight through. Nothing here changes navigation.
//
// Each stretch is routed over the height field (cheapest path that avoids climbing and prefers
// low ground, so it follows valleys and passes), then its bed is forced to fall all the way to
// the mouth and a smooth valley is carved around it.
import type { RiverDef } from "./maps";
import { smoothstep, vnoise } from "./noise";

export interface RiverPoint {
  x: number;
  z: number;
  /** height of the river bed and of the water surface, metres */
  bed: number;
  surface: number;
  /** channel width, metres */
  width: number;
  /** this point lies in the lake or the sea the river joins (the ribbon dips under its surface here) */
  wet: boolean;
}

export interface River {
  name: string;
  /** from source to mouth */
  points: RiverPoint[];
}

export interface RiverField {
  rivers: River[];
  /** distance in metres from each cell centre to the nearest river centre line, minus half the width (<= 0 in the channel) */
  bank: Float32Array;
}

/** how far below the banks the bed lies, and how deep the water stands in it */
const BED_DEPTH = 0.9;
const WATER_DEPTH = 0.38;
/**
 * Lowest a bed may go. Lakes and the sea stand at -0.25 m, so a bed at this depth lets their water
 * run into the channel: a river joins a lake with no bar of dry ground between them.
 */
export const BED_FLOOR = -0.45;
/** cells of open water kept at each end of a stretch, so the ribbon reaches into the lake */
const LEAD = 4;

interface Grid {
  w: number;
  h: number;
  cell: number;
  isWater(i: number): boolean;
}

/** Cheapest 8-neighbour path between two cells. Returns cell indices from start to goal. */
function route(g: Grid, height: Float32Array, start: number, goal: number): number[] {
  const n = g.w * g.h;
  const cost = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  // binary heap of cell indices keyed by cost
  const heap: number[] = [];
  const push = (i: number) => {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (cost[heap[p]] <= cost[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && cost[heap[l]] < cost[heap[m]]) m = l;
        if (r < heap.length && cost[heap[r]] < cost[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  cost[start] = 0;
  push(start);
  const done = new Uint8Array(n);
  while (heap.length) {
    const c = pop();
    if (done[c]) continue;
    done[c] = 1;
    if (c === goal) break;
    const cx = c % g.w;
    const cy = (c / g.w) | 0;
    const hc = Math.max(0, height[c]);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
        const j = y * g.w + x;
        if (done[j]) continue;
        const len = dx && dy ? 1.4142 : 1;
        let step: number;
        if (g.isWater(j)) step = len * 0.3; // crossing a lake or reaching out to sea is cheap
        else {
          const hj = Math.max(0, height[j]);
          // climbing is expensive, high ground is disliked, and a noise makes the course wander
          step = len * (1 + 7 * Math.max(0, hj - hc) + 0.09 * hj) * (0.5 + 1.0 * vnoise(x / 10 + 13, y / 10 + 5));
        }
        const nc = cost[c] + step;
        if (nc < cost[j]) {
          cost[j] = nc;
          prev[j] = c;
          push(j);
        }
      }
  }
  const path: number[] = [];
  for (let c = goal; c !== -1; c = prev[c]) path.push(c);
  path.reverse();
  return path[0] === start ? path : [];
}

/** Nearest cell to (cx, cy) matching `ok`, searched in growing rings. */
function nearest(g: Grid, cx: number, cy: number, ok: (i: number) => boolean): number {
  let best = -1;
  let bestD = Infinity;
  const R = 40;
  for (let y = Math.max(0, cy - R); y <= Math.min(g.h - 1, cy + R); y++)
    for (let x = Math.max(0, cx - R); x <= Math.min(g.w - 1, cx + R); x++) {
      const i = y * g.w + x;
      if (!ok(i)) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  return best;
}

const routeCache = new Map<string, number[][]>();

/**
 * Route every river of a map and carve the valleys into `height` (in place).
 * `key` identifies the map, so the routes are computed once per process.
 */
export function carveRivers(key: string, defs: RiverDef[], g: Grid, height: Float32Array): RiverField {
  const n = g.w * g.h;
  const bank = new Float32Array(n).fill(1e9);
  const rivers: River[] = [];
  if (!defs.length) return { rivers, bank };
  const toCell = (p: readonly [number, number]): [number, number] => [
    Math.max(0, Math.min(g.w - 1, Math.floor(((p[0] + 1) / 2) * g.w))),
    Math.max(0, Math.min(g.h - 1, Math.floor(((p[1] + 1) / 2) * g.h))),
  ];
  const world = (fx: number, fy: number) => ({ x: (fx - g.w / 2 + 0.5) * g.cell, z: (fy - g.h / 2 + 0.5) * g.cell });

  let routes = routeCache.get(key);
  if (!routes) {
    routes = defs.map((d) => {
      const [sx, sy] = toCell([d.from[0], d.from[1]]);
      const start = nearest(g, sx, sy, (i) => g.isWater(i) === (d.from[2] === "w"));
      const [tx, ty] = toCell(d.to);
      const goal = nearest(g, tx, ty, (i) => g.isWater(i));
      const stops = [start, ...(d.via ?? []).map((v) => nearest(g, ...toCell(v), (i) => !g.isWater(i))), goal];
      const cells: number[] = [];
      for (let s = 0; s + 1 < stops.length; s++) {
        const leg = route(g, height, stops[s], stops[s + 1]);
        cells.push(...(s ? leg.slice(1) : leg));
      }
      return cells;
    });
    routeCache.set(key, routes);
  }

  // per cell: the nearest river point seen so far
  const nearBed = new Float32Array(n);
  const nearHalf = new Float32Array(n);
  const nearD = new Float32Array(n).fill(1e9);

  defs.forEach((def, di) => {
    const cells = routes![di];
    // land runs of the route (a route may cross a lake on its way), each with a few cells of the
    // water it comes from and flows into
    const runs: number[][] = [];
    for (let i = 0; i < cells.length; ) {
      if (g.isWater(cells[i])) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < cells.length && !g.isWater(cells[j + 1])) j++;
      runs.push(cells.slice(Math.max(0, i - LEAD), Math.min(cells.length, j + 1 + LEAD)));
      i = j + 1;
    }
    const total = runs.reduce((a, r) => a + r.length, 0);
    let seen = 0;
    for (const r of runs) {
      if (r.length < 6 + 2 * LEAD) {
        seen += r.length;
        continue;
      }
      // centre line: cell centres, smoothed twice so the staircase of the grid becomes curves
      let line = r.map((c) => ({ x: c % g.w, y: (c / g.w) | 0 }));
      for (let pass = 0; pass < 6; pass++)
        line = line.map((p, i) => {
          if (i === 0 || i === line.length - 1) return p;
          const a = line[i - 1];
          const b = line[i + 1];
          return { x: (a.x + 2 * p.x + b.x) / 4, y: (a.y + 2 * p.y + b.y) / 4 };
        });
      const wet = r.map((c) => g.isWater(c));
      const ground = line.map((p) => Math.max(0, height[Math.min(g.h - 1, Math.round(p.y)) * g.w + Math.min(g.w - 1, Math.round(p.x))]));
      // the bed never rises on its way down. A stretch that leaves a lake starts at lake level and
      // so stays there; every stretch ends at the level of the water it joins.
      const beds: number[] = [];
      let bed = Infinity;
      for (let i = 0; i < line.length; i++) {
        bed = Math.max(BED_FLOOR, Math.min(bed, wet[i] ? BED_FLOOR : ground[i] - BED_DEPTH));
        beds.push(bed);
      }
      // ease down to the mouth over the last 30 m instead of dropping off a ledge at the shore
      for (let i = line.length - 2; i >= Math.max(0, line.length - LEAD - 14); i--) beds[i] = Math.min(beds[i], beds[i + 1] + 0.3);
      const points: RiverPoint[] = line.map((p, i) => {
        const t = total > 1 ? (seen + i) / (total - 1) : 0;
        const width = def.width[0] + (def.width[1] - def.width[0]) * t;
        const w = world(p.x, p.y);
        // the surface stays just above the lakes, so their water never shows through the ribbon
        const surface = wet[i] ? -0.6 : Math.max(0, beds[i] + Math.max(0.08, Math.min(WATER_DEPTH, ground[i] - beds[i] - 0.2)));
        return { x: w.x, z: w.z, bed: beds[i], surface, width, wet: wet[i] };
      });
      seen += r.length;
      rivers.push({ name: def.name, points });

      // stamp: remember the nearest river point for every cell around the line
      const reach = Math.ceil(34 / g.cell);
      line.forEach((p, i) => {
        const pt = points[i];
        const x0 = Math.max(0, Math.floor(p.x - reach));
        const x1 = Math.min(g.w - 1, Math.ceil(p.x + reach));
        const y0 = Math.max(0, Math.floor(p.y - reach));
        const y1 = Math.min(g.h - 1, Math.ceil(p.y + reach));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - p.x, y - p.y) * g.cell;
            const j = y * g.w + x;
            if (d < nearD[j]) {
              nearD[j] = d;
              nearBed[j] = pt.bed;
              nearHalf[j] = pt.width / 2;
            }
          }
      });
    }
  });

  // carve: a flat channel, then banks that ease back up to the old ground. The deeper the cut,
  // the wider the valley, so a river through hills gets a valley and not a trench.
  for (let i = 0; i < n; i++) {
    if (nearD[i] > 1e8) continue;
    bank[i] = nearD[i] - nearHalf[i];
    if (g.isWater(i)) continue;
    const h = height[i];
    const bed = nearBed[i];
    if (h <= bed) continue;
    const valley = nearHalf[i] + 6 + 2.4 * Math.min(10, h - bed);
    const t = smoothstep(nearHalf[i] * 0.75, valley, nearD[i]);
    height[i] = bed + (h - bed) * t;
  }
  return { rivers, bank };
}
