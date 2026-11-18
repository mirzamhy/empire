// World map: biome grid of the active map (sim/maps.ts), elevation, walkability, spawn sampling
// and BFS distance fields used for unit navigation. Pure TS, no rendering.
import { ACTIVE, type LandmarkKind } from "./maps";
import { ridge, smoothstep, vnoise } from "./noise";
import { BED_FLOOR, carveRivers, type River } from "./rivers";
import type { Rng } from "./rng";

const MAP_W = ACTIVE.w;
const MAP_H = ACTIVE.h;
const MAP_ROWS = ACTIVE.rows;

export type Biome = "water" | "beach" | "plains" | "desert" | "forest" | "mountain" | "snow" | "mesa";
const CODE: Record<string, Biome> = { "~": "water", b: "beach", s: "plains", d: "desert", f: "forest", m: "mountain", n: "snow", r: "mesa" };

/** narrow, sharp ranges rise faster than the broad ones of the forest maps */
const ALPINE = ACTIVE.terrain === "alpine";
/** foothill ramp around a range: width in cells and the height it reaches at the rock line */
const FOOTHILL_CELLS = ALPINE ? 18 : 26;
const FOOTHILL_HEIGHT = ALPINE ? 7 : 8.5;
/** depth inside a range (cells) at which it reaches full height, and that height above the foothills */
const PEAK_CELLS = ALPINE ? 16 : 20;
const PEAK_HEIGHT = ALPINE ? 29 : 27;
/** crest lines and spurs are stronger on alpine ranges */
const CREST = ALPINE ? 1.4 : 1;
/** height of one rock step on a mesa */
const MESA_STEP = 2.6;

/** metres per grid cell */
export const CELL = 2.25;
export const GRID_W = MAP_W;
export const GRID_H = MAP_H;
export const WORLD_W = GRID_W * CELL;
export const WORLD_H = GRID_H * CELL;
/** size of this world relative to the first EMPIRE map (576 m wide); cameras and fog scale with it */
export const WORLD_SCALE = WORLD_W / 576;

/** A landmark standing on the map: decoration with a name, never an obstacle. */
export interface Landmark {
  kind: LandmarkKind;
  name: string;
  x: number;
  z: number;
  /** footprint radius, metres */
  r: number;
  /** facing, radians */
  rot: number;
}

export class WorldMap {
  /** the map this world was built from (sim/maps.ts) */
  readonly def = ACTIVE;
  readonly biome: Biome[] = [];
  /** height in metres per cell centre */
  readonly height: Float32Array;
  /** connected land component id per cell (-1 water) */
  readonly component: Int32Array;
  readonly mainComponent: number;
  /** cells where a castle may stand (main continent, flat, not forest edge rules) */
  readonly buildable: Uint8Array;
  readonly altar: { x: number; z: number };
  /** rivers from source to mouth; they are shallow and never block movement */
  readonly rivers: River[];
  /** metres from each cell to the nearest river bank (<= 0 inside the channel, huge without rivers) */
  readonly riverBank: Float32Array;
  readonly landmarks: Landmark[] = [];

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
    const distMesa = this.bfs((i) => this.biome[i] !== "mesa", () => true); // depth inside red rock
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
      if (ACTIVE.terrain === "classic") {
        // the first map: dunes, a short swell at the foot of a range, then a tall jagged core
        if (b === "desert") hgt += ridge(x / 9 + y / 30, y / 14) * 1.1 * inland;
        if (b === "forest") hgt += 0.15;
        if (b !== "mountain") hgt += (1 - smoothstep(0, 7, distMtn[i])) ** 2 * 3.2;
        else {
          const core = smoothstep(0, 13, distRock[i]);
          hgt += 3.2 + 24 * core ** 1.1;
          hgt += ridge(x / 13, y / 13) * 9 * (0.25 + core) + ridge(x / 5 + 17, y / 5) * 2.2 * (0.3 + core);
          hgt += vnoise(x / 2.5, y / 2.5) * 1.2;
        }
        this.height[i] = hgt;
        continue;
      }
      if (b === "desert") hgt += ridge(x / 9 + y / 30, y / 14) * (ALPINE ? 1.5 : 0.7) * inland; // moor hummocks, or dunes
      if (b === "forest") hgt += 0.15;
      if (b === "snow") hgt += (0.8 + vnoise(x / 11 + 5, y / 11) * 1.8) * inland; // drifts
      // foothills: a long ramp of rolling hills leads up to every range (about 60 m wide, 9 m high)
      // so a mountain never rises straight out of flat ground
      const foot = b === "mountain" ? 1 : (1 - smoothstep(0, FOOTHILL_CELLS, distMtn[i])) ** 1.5;
      // (flattened toward lakes and the coast so the shore is a bank, not a pit wall)
      hgt += foot * (FOOTHILL_HEIGHT + (vnoise(x / 6 + 9, y / 6 + 3) - 0.5) * 3.2) * (0.2 + 0.8 * inland);
      if (b === "mountain") {
        // the range itself: height follows the depth inside it, easing in from the foothills and
        // levelling off at the crest, so wide parts become peaks and narrow parts stay hills.
        // Peak height is about half the half-width of the range: slopes average 30 to 35 degrees.
        const core = smoothstep(0, PEAK_CELLS, distRock[i]);
        hgt += PEAK_HEIGHT * core ** 1.2;
        // crest lines and spurs only where the range is already high
        hgt += (ridge(x / 15, y / 15) * 7 + ridge(x / 6 + 17, y / 6) * 2.4) * core * CREST;
        hgt += vnoise(x / 2.5, y / 2.5) * 0.9 * smoothstep(0, 5, distRock[i]);
      }
      if (b === "mesa") {
        // red rock: rises quickly from the sand and breaks into flat steps
        const raw = hgt + (9 + vnoise(x / 14 + 3, y / 14) * 8) * smoothstep(0, 5, distMesa[i]);
        hgt = raw * 0.35 + Math.floor(raw / MESA_STEP) * MESA_STEP * 0.65;
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

    // Rivers: valleys carved into the height field only. Biomes are untouched, so every river
    // cell stays walkable and the navigation fields are the same with or without rivers.
    const riv = carveRivers(`map${ACTIVE.id}`, ACTIVE.rivers, { w: GRID_W, h: GRID_H, cell: CELL, isWater: (i) => this.biome[i] === "water" }, this.height);
    this.rivers = riv.rivers;
    this.riverBank = riv.bank;

    // Landmarks: each is moved to the nearest spot that suits it, then its ground is levelled.
    for (const d of ACTIVE.landmarks) {
      const cx = Math.floor(((d.at[0] + 1) / 2) * GRID_W);
      const cy = Math.floor(((d.at[1] + 1) / 2) * GRID_H);
      const rc = d.r / CELL;
      let spot = -1;
      let spotScore = Infinity;
      for (let y = Math.max(0, cy - 30); y <= Math.min(GRID_H - 1, cy + 30); y++)
        for (let x = Math.max(0, cx - 30); x <= Math.min(GRID_W - 1, cx + 30); x++) {
          const i = y * GRID_W + x;
          if (this.component[i] !== best || this.riverBank[i] < d.r + 5) continue;
          const b = this.biome[i];
          if (b === "water" || b === "mountain" || b === "mesa") continue;
          if (d.on === "low" && (b === "beach" || distMtn[i] < rc + 6 || distWater[i] < rc + 2)) continue;
          if (d.on === "foot" && (distMtn[i] < rc * 0.5 + 1 || distMtn[i] > rc + 8 || distWater[i] < rc + 2)) continue;
          if (d.on === "shore" && (distWater[i] < 2 || distWater[i] > 5)) continue;
          // close to the wanted point, and on ground that is not too uneven
          let rough = 0;
          for (const nb of this.neighbours4(i)) rough += Math.abs(this.height[nb] - this.height[i]);
          const score = Math.hypot(x - cx, y - cy) + rough * 2;
          if (score < spotScore) {
            spotScore = score;
            spot = i;
          }
        }
      if (spot < 0) continue;
      const c = this.cellCenter(spot);
      // face the continent's middle, so the front is what the overview camera sees
      this.landmarks.push({ kind: d.kind, name: d.name, x: c.x, z: c.z, r: d.r, rot: Math.atan2(-c.x, -c.z) });
      const level = this.height[spot];
      const reach = Math.ceil(rc * 1.6);
      const sx = spot % GRID_W;
      const sy = (spot / GRID_W) | 0;
      for (let y = Math.max(0, sy - reach); y <= Math.min(GRID_H - 1, sy + reach); y++)
        for (let x = Math.max(0, sx - reach); x <= Math.min(GRID_W - 1, sx + reach); x++) {
          const i = y * GRID_W + x;
          if (this.biome[i] === "water") continue;
          const t = smoothstep(rc * 0.8, rc * 1.6, Math.hypot(x - sx, y - sy));
          this.height[i] = level + (this.height[i] - level) * t;
        }
    }

    // castles stand on the lowlands, not on the foothill slopes (the first map had no foothills)
    const mtnClear = ACTIVE.terrain === "classic" ? 2 : 8;
    for (let i = 0; i < n; i++) {
      const b = this.biome[i];
      if (this.component[i] !== best) continue;
      if (b === "water" || b === "mountain" || b === "beach" || b === "mesa") continue;
      if (distMtn[i] < mtnClear || distWater[i] < 3) continue;
      // nor in a river or on a landmark
      if (this.riverBank[i] < 2 * CELL) continue;
      const p = this.cellCenter(i);
      if (this.landmarks.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < l.r + 4)) continue;
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
    for (let i = 0; i < n; i++) if (this.buildable[i] && distMtn[i] >= 6 && distWater[i] >= 7 && this.riverBank[i] > 16) {
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
    // the shore never dips under the sea, but a river bed near its mouth lies below lake level
    // (the floor eases from 0 to the bed depth across the bank, so the ground has no step in it)
    let floor = 0;
    if (this.rivers.length) {
      const r = this.riverBank;
      const near = (i: number) => Math.min(r[i], 8);
      const ra = near(z0 * GRID_W + x0) * (1 - tx) + near(z0 * GRID_W + x1) * tx;
      const rb = near(z1 * GRID_W + x0) * (1 - tx) + near(z1 * GRID_W + x1) * tx;
      floor = BED_FLOOR * (1 - smoothstep(0.5, 5, ra * (1 - tz) + rb * tz));
    }
    return Math.max(floor, a * (1 - tz) + b * tz);
  }

  /** Nearest landmark within `within` metres of a point, for naming where something happens. */
  landmarkNear(x: number, z: number, within = 45): Landmark | null {
    let best: Landmark | null = null;
    let bestD = within;
    for (const l of this.landmarks) {
      const d = Math.hypot(l.x - x, l.z - z) - l.r;
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    return best;
  }

  /** Movement speed factor for a biome. */
  speedFactor(x: number, z: number) {
    const b = this.biomeAt(x, z);
    return b === "mountain" || b === "mesa" ? 0.6 : b === "forest" || b === "snow" ? 0.9 : 1;
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
