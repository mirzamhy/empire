// How a dead unit leaves the field (docs/rencana-visual.md 4.6). The sim drops a unit the moment
// it dies; the renderer keeps a short-lived corpse and moves it with the numbers in this file.
// Limb motion is the `death` clip in anims.ts; everything here is root-level or per-chunk motion.
//
//   fall      humanoids, horses, elephants, dragons: topple over, lie still, sink into the ground
//   shatter   golems, skeletons, siege engines: every bone flies off as its own chunk
//   dissolve  demons: kneel (clip), then shrink away while fx.ts throws embers
import type { UnitType } from "../../sim/config";
import type { RigKind } from "./contract";

export type DeathStyle = "fall" | "shatter" | "dissolve";

export interface DeathSpec {
  style: DeathStyle;
  /** seconds from death until the corpse is removed */
  life: number;
  /** fall: seconds until the body is flat on the ground */
  fallSeconds: number;
  /** fall: final lean in radians (π/2 = flat on its back or side) */
  maxAngle: number;
  /** fall: true when the body only ever falls sideways (four-legged and winged units) */
  sideOnly: boolean;
  /** fall: how far the lying body is raised so it rests on the ground, in model units */
  lift: number;
  /** shatter: horizontal chunk speed range, world units per second */
  speed: [number, number];
  /** shatter: upward chunk speed range */
  up: [number, number];
}

/** Most corpses on screen at once; when full the oldest starts sinking straight away. */
export const CORPSE_MAX = 120;
export const SINK_SECONDS = 1;
export const SINK_DEPTH = 0.4;
export const CHUNK_GRAVITY = 14;
/** dissolve: the body starts shrinking after the kneel clip */
export const DISSOLVE_AT = 0.8;

const FALL: DeathSpec = { style: "fall", life: 4, fallSeconds: 0.6, maxAngle: Math.PI / 2, sideOnly: false, lift: 0.26, speed: [0, 0], up: [0, 0] };

const BY_RIG: Record<RigKind, DeathSpec> = {
  humanoid: FALL,
  rider: { ...FALL, sideOnly: true, lift: 0.42, fallSeconds: 0.7 },
  quadruped: { ...FALL, sideOnly: true, lift: 0.95, fallSeconds: 1.0 },
  // lands on its belly, rolled a little to one side
  dragon: { ...FALL, sideOnly: true, maxAngle: 0.45, lift: 0.5, fallSeconds: 0.7 },
  golem: { ...FALL, style: "shatter", speed: [1.2, 3.0], up: [2.0, 4.5] },
  siege: { ...FALL, style: "shatter", speed: [0.4, 1.4], up: [0.8, 2.2] },
};

const BY_TYPE: Partial<Record<UnitType, DeathSpec>> = {
  // bones drop where they stand
  skeleton: { ...FALL, style: "shatter", speed: [0.3, 1.1], up: [0.4, 1.6] },
  demon: { ...FALL, style: "dissolve", life: 1.7 },
};

export function deathSpec(type: UnitType, rig: RigKind): DeathSpec {
  return BY_TYPE[type] ?? BY_RIG[rig];
}

/** Stable pseudo-random number in [0, 1) from an integer. */
export function hash01(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Which way unit `id` falls: 0 = backwards, 1 = onto its left side, -1 = onto its right side. */
export function fallSide(spec: DeathSpec, id: number): -1 | 0 | 1 {
  if (spec.sideOnly) return id % 2 === 0 ? 1 : -1;
  const v = id % 3;
  return v === 0 ? 0 : v === 1 ? 1 : -1;
}

/** 0 → 1 over the fall: accelerates like a falling body, with a small bounce on landing. */
export function fallProgress(spec: DeathSpec, age: number) {
  const t = age / spec.fallSeconds;
  if (t <= 0) return 0;
  if (t < 1) return t * t;
  const after = age - spec.fallSeconds;
  return 1 - 0.07 * Math.exp(-after * 9) * Math.abs(Math.sin(after * 15));
}

/** 0 while the corpse lies there, rising to 1 over the last SINK_SECONDS of its life. */
export function sinkProgress(spec: DeathSpec, age: number) {
  if (spec.style === "dissolve") return 0;
  return Math.min(1, Math.max(0, (age - (spec.life - SINK_SECONDS)) / SINK_SECONDS));
}

/** dissolve: scale factor of the body, 1 until the kneel ends and 0 at the end of its life. */
export function dissolveScale(spec: DeathSpec, age: number) {
  if (spec.style !== "dissolve") return 1;
  const t = Math.min(1, Math.max(0, (age - DISSOLVE_AT) / (spec.life - DISSOLVE_AT)));
  return 1 - t * t * (3 - 2 * t);
}

export interface ChunkMotion {
  dx: number;
  dy: number;
  dz: number;
  /** tumble axis (unit length) and angle */
  ax: number;
  ay: number;
  az: number;
  angle: number;
}

/**
 * shatter: where chunk `bone` of corpse `id` is at `age`. `height` is how far the chunk's pivot
 * starts above its resting height; it flies on a ballistic arc and stops when it lands.
 */
export function chunkMotion(spec: DeathSpec, id: number, bone: number, age: number, height: number, out: ChunkMotion): ChunkMotion {
  const seed = id * 31 + bone * 17;
  const dir = hash01(seed) * Math.PI * 2;
  const sp = spec.speed[0] + (spec.speed[1] - spec.speed[0]) * hash01(seed + 1);
  const vy = spec.up[0] + (spec.up[1] - spec.up[0]) * hash01(seed + 2);
  const land = (vy + Math.sqrt(vy * vy + 2 * CHUNK_GRAVITY * Math.max(0, height))) / CHUNK_GRAVITY;
  const t = Math.min(Math.max(age, 0), land);
  out.dx = Math.cos(dir) * sp * t;
  out.dz = Math.sin(dir) * sp * t;
  out.dy = vy * t - 0.5 * CHUNK_GRAVITY * t * t;
  const a = hash01(seed + 3) * Math.PI * 2;
  const tilt = hash01(seed + 4) * 0.6;
  out.ax = Math.cos(a) * Math.cos(tilt);
  out.ay = Math.sin(tilt);
  out.az = Math.sin(a) * Math.cos(tilt);
  out.angle = (3 + hash01(seed + 5) * 4) * t;
  return out;
}
