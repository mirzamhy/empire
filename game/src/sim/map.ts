// World map: biome grid from the reference image, elevation, walkability, spawn sampling
// and BFS distance fields used for unit navigation. Pure TS, no rendering.
import { MAP_H, MAP_ROWS, MAP_W } from "./mapdata";
import { ridge, smoothstep, vnoise } from "./noise";
import type { Rng } from "./rng";

export type Biome = "water" | "beach" | "plains" | "desert" | "forest" | "mountain";
const CODE: Record<string, Biome> = { "~": "water", b: "beach", s: "plains", d: "desert", f: "forest", m: "mountain" };

/** metres per grid cell */
export const CELL = 2.25;
export const GRID_W = MAP_W;
export const GRID_H = MAP_H;
export const WORLD_W = GRID_W * CELL;
export const WORLD_H = GRID_H * CELL;

export class WorldMap {
  readonly biome: Biome[] = [];
  /** height in metres per cell centre */
  readonly height: Float32Array;
  /** connected land component id per cell (-1 water) */
  readonly component: Int32Array;
  readonly mainComponent: number;
  /** cells where a castle may stand (main continent, flat, not forest edge rules) */
  readonly buildable: Uint8Array;
  readonly altar: { x: number; z: number };

  constructor() {
    const n = GRID_W * GRID_H;
    for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) this.biome.push(CODE[MAP_ROWS[y][x]] ?? "water");
    this.height = new Float32Array(n);
    this.component = new Int32Array(n).fill(-1);
    this.buildable = new Uint8Array(n);

    // Distance from water (in cells) drives a gentle rise inland; mountains add ridges.
    const distWater = this.bfs((i) => this.biome[i] === "water", () => true);
    const distRock = this.bfs((i) => this.biome[i] !== "mountain", () => true); // depth inside mountains
    const distMtn = this.bfs((i) => this.biome[i] === "mountain", () => true); // distance to nearest mountain
    const distLand = this.bfs((i) => this.biome[i] !== "water", () => true); // depth of the sea floor
    for (let i = 0; i < n; i++) {
      const b = this.biome[i];
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      const ripple = Math.sin(x * 0.37 + y * 0.11) * 0.18 + Math.cos(y * 0.41 - x * 0.07) * 0.15;
      if (b === "water") {
        // the sea floor drops away from the shore
        this.height[i] = -1.2 - Math.min(distLand[i], 9) * 0.55;
        continue;
      }
      if (b === "beach") {
        this.height[i] = 0.15 + ripple * 0.3;
        continue;
      }
      // lowlands: a gentle rise inland plus rolling hills that flatten toward the coast
      const inland = smoothstep(2, 10, distWater[i]);
      let hgt = Math.min(distWater[i], 8) * 0.14 + ripple;
      hgt += (vnoise(x / 22, y / 22) * 2.6 + vnoise(x / 8 + 40, y / 8) * 0.8) * inland;
      if (b === "desert") hgt += ridge(x / 9 + y / 30, y / 14) * 1.1 * inland; // dunes
      if (b === "forest") hgt += 0.15;
      // foothills: the land swells as it nears a mountain
      if (b !== "mountain") hgt += (1 - smoothstep(0, 7, distMtn[i])) ** 2 * 3.2;
      if (b === "mountain") {
        // mountains: a tall core that grows with the depth inside the range, cut by sharp ridges
        const core = smoothstep(0, 13, distRock[i]);
        hgt += 3.2 + 24 * core ** 1.1;
        hgt += ridge(x / 13, y / 13) * 9 * (0.25 + core) + ridge(x / 5 + 17, y / 5) * 2.2 * (0.3 + core);
        hgt += vnoise(x / 2.5, y / 2.5) * 1.2;
      }
      this.height[i] = hgt;
    }

    // Land components (4-neighbour). The biggest one is the continent; islands are not spawnable.
    let comp = 0;
    let best = -1;
    let bestSize = 0;
    for (let i = 0; i < n; i++) {
      if (this.component[i] !== -1 || this.biome[i] === "water") continue;
      const stack = [i];
      this.component[i] = comp;
      let size = 0;
      while (stack.length) {
        const c = stack.pop()!;
        size++;
        for (const nb of this.neighbours4(c)) if (this.component[nb] === -1 && this.biome[nb] !== "water") {
          this.component[nb] = comp;
          stack.push(nb);
        }
      }
      if (size > bestSize) {
        bestSize = size;
        best = comp;
      }
      comp++;
    }
    this.mainComponent = best;

    for (let i = 0; i < n; i++) {
      const b = this.biome[i];
      if (this.component[i] !== best) continue;
      if (b === "water" || b === "mountain" || b === "beach") continue;
      if (distMtn[i] < 2 || distWater[i] < 3) continue;
      this.buildable[i] = 1;
    }

    // Dragon altar: buildable cell closest to the continent's centre of mass.
    let sx = 0;
    let sz = 0;
    let cnt = 0;
    for (let i = 0; i < n; i++) if (this.component[i] === best) {
      sx += i % GRID_W;
      sz += (i / GRID_W) | 0;
      cnt++;
    }
    const cx = sx / cnt;
    const cz = sz / cnt;
    let altarCell = 0;
    let altarD = Infinity;
    for (let i = 0; i < n; i++) if (this.buildable[i] && distMtn[i] >= 6 && distWater[i] >= 7) {
      const d = (i % GRID_W - cx) ** 2 + (((i / GRID_W) | 0) - cz) ** 2;
      if (d < altarD) {
        altarD = d;
        altarCell = i;
      }
    }
    this.altar = this.cellCenter(altarCell);
  }

  neighbours4(i: number): number[] {
    const x = i % GRID_W;
    const out: number[] = [];
    if (x > 0) out.push(i - 1);
    if (x < GRID_W - 1) out.push(i + 1);
    if (i >= GRID_W) out.push(i - GRID_W);
    if (i < GRID_W * (GRID_H - 1)) out.push(i + GRID_W);
    return out;
  }

  /** Multi-source BFS distance (cells) from cells where isSource, travelling through cells where canPass. */
  bfs(isSource: (i: number) => boolean, canPass: (i: number) => boolean): Uint16Array {
    const n = GRID_W * GRID_H;
    const d = new Uint16Array(n).fill(65535);
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;
    for (let i = 0; i < n; i++) if (isSource(i)) {
      d[i] = 0;
      q[tail++] = i;
    }
    while (head < tail) {
      const c = q[head++];
      const x = c % GRID_W;
      const nd = d[c] + 1;
      const nb = [x > 0 ? c - 1 : -1, x < GRID_W - 1 ? c + 1 : -1, c - GRID_W, c + GRID_W];
      for (const k of nb) if (k >= 0 && k < n && d[k] === 65535 && canPass(k)) {
        d[k] = nd;
        q[tail++] = k;
      }
    }
    return d;
  }

  /** Navigation field towards a world point: walking distance (cells) for every land cell. */
  fieldTo(x: number, z: number): Uint16Array {
    const target = this.cellAt(x, z);
    return this.bfs((i) => i === target, (i) => this.walkable(i));
  }

  walkable(i: number) {
    return this.biome[i] !== "water";
  }

  cellAt(x: number, z: number) {
    const cx = Math.max(0, Math.min(GRID_W - 1, Math.floor(x / CELL + GRID_W / 2)));
    const cz = Math.max(0, Math.min(GRID_H - 1, Math.floor(z / CELL + GRID_H / 2)));
    return cz * GRID_W + cx;
  }

  cellCenter(i: number) {
    return { x: ((i % GRID_W) - GRID_W / 2 + 0.5) * CELL, z: (((i / GRID_W) | 0) - GRID_H / 2 + 0.5) * CELL };
  }

  biomeAt(x: number, z: number): Biome {
    return this.biome[this.cellAt(x, z)];
  }

  /** Bilinear height at a world point. */
  heightAt(x: number, z: number) {
    const fx = x / CELL + GRID_W / 2 - 0.5;
    const fz = z / CELL + GRID_H / 2 - 0.5;
    const x0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(fx)));
    const z0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(fz)));
    const x1 = Math.min(GRID_W - 1, x0 + 1);
    const z1 = Math.min(GRID_H - 1, z0 + 1);
    const tx = Math.max(0, Math.min(1, fx - x0));
    const tz = Math.max(0, Math.min(1, fz - z0));
    const h = this.height;
    const a = h[z0 * GRID_W + x0] * (1 - tx) + h[z0 * GRID_W + x1] * tx;
    const b = h[z1 * GRID_W + x0] * (1 - tx) + h[z1 * GRID_W + x1] * tx;
    return Math.max(0, a * (1 - tz) + b * tz);
  }

  /** Movement speed factor for a biome. */
  speedFactor(x: number, z: number) {
    const b = this.biomeAt(x, z);
    return b === "mountain" ? 0.6 : b === "forest" ? 0.9 : 1;
  }

  /**
   * Random castle spot: buildable, at least minDist metres from others and the altar.
   * Relaxes the distance by 2 m after each 40 failed tries, down to minDistFloor.
   */
  sampleSpawn(rng: Rng, taken: { x: number; z: number }[], minDist = 10, minDistFloor = 7, altarClear = 16): { x: number; z: number } | null {
    const cells: number[] = [];
    for (let i = 0; i < this.buildable.length; i++) if (this.buildable[i]) cells.push(i);
    for (let dist = minDist; dist >= minDistFloor; dist -= 1.5) {
      for (let t = 0; t < 40; t++) {
        const c = this.cellCenter(cells[Math.floor(rng.next() * cells.length)]);
        c.x += (rng.next() - 0.5) * CELL * 0.8;
        c.z += (rng.next() - 0.5) * CELL * 0.8;
        if (Math.hypot(c.x - this.altar.x, c.z - this.altar.z) < altarClear) continue;
        if (taken.every((p) => Math.hypot(p.x - c.x, p.z - c.z) >= dist)) return c;
      }
    }
    return null;
  }
}
