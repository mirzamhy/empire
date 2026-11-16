// Animation clips as data (docs/rencana-visual.md 4.3). A key is [time, x, y, z]: Euler XYZ
// radians for rotation tracks, model units for position tracks. Values between keys use
// Catmull-Rom, so a handful of keys gives smooth curves; looping clips repeat their first key
// at t = length.
//
// V0 clips reproduce the prototype's motion (sine walk, single arm swing) so nothing changes on
// screen. V2 replaces them with per-unit clips (stab, slash, shoot, cast...).
import type { BoneName, RigKind } from "./contract";

export type Key = [number, number, number, number];

export interface Track {
  rot?: Key[];
  pos?: Key[];
}

export interface Clip {
  length: number;
  loop: boolean;
  tracks: Partial<Record<BoneName, Track>>;
}

export type ClipName = "idle" | "walk" | "attack" | "fly";

/** Keys for a + amp * sin(2π t / period) on one axis, nine per cycle (close to a true sine). */
function sine(period: number, axis: 0 | 1 | 2, amp: number, base: [number, number, number] = [0, 0, 0]): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i <= 8; i++) {
    const v = [...base] as [number, number, number];
    v[axis] += amp * Math.sin((Math.PI * i) / 4);
    keys.push([(period * i) / 8, v[0], v[1], v[2]]);
  }
  return keys;
}

const HUMAN_WALK = (2 * Math.PI) / 5.5;
const HORSE_GALLOP = (2 * Math.PI) / 7;
const WING_FLAP = (2 * Math.PI) / 6.5;
const ATTACK = 0.35;

const humanoid: Partial<Record<ClipName, Clip>> = {
  idle: {
    length: 1,
    loop: true,
    tracks: {
      armR: { rot: [[0, -0.32, 0, -0.22], [1, -0.32, 0, -0.22]] },
      armL: { rot: [[0, -0.35, 0.25, 0.18], [1, -0.35, 0.25, 0.18]] },
      legR: { rot: [[0, 0, 0, -0.04], [1, 0, 0, -0.04]] },
      legL: { rot: [[0, 0, 0, 0.04], [1, 0, 0, 0.04]] },
    },
  },
  walk: {
    length: HUMAN_WALK,
    loop: true,
    tracks: {
      legR: { rot: sine(HUMAN_WALK, 0, 0.48) },
      legL: { rot: sine(HUMAN_WALK, 0, -0.48) },
      armL: { rot: sine(HUMAN_WALK, 0, 0.48 * 0.28, [-0.32, 0, 0]) },
      armR: { rot: sine(HUMAN_WALK, 0, 0.42, [-0.52, 0, 0]) },
    },
  },
  attack: {
    length: ATTACK,
    loop: false,
    tracks: { armR: { rot: [[0, -1.7, 0, -0.22], [ATTACK, 0.2, 0, -0.22]] } },
  },
};

const rider: Partial<Record<ClipName, Clip>> = {
  idle: {
    length: 1,
    loop: true,
    tracks: {
      armR: { rot: [[0, -0.35, 0, 0], [1, -0.35, 0, 0]] },
      legFR: { rot: [[0, 0, 0, 0], [1, 0, 0, 0]] },
      legFL: { rot: [[0, 0, 0, 0], [1, 0, 0, 0]] },
      legBR: { rot: [[0, 0, 0, 0], [1, 0, 0, 0]] },
      legBL: { rot: [[0, 0, 0, 0], [1, 0, 0, 0]] },
    },
  },
  walk: {
    length: HORSE_GALLOP,
    loop: true,
    tracks: {
      armR: { rot: [[0, -0.35, 0, 0], [HORSE_GALLOP, -0.35, 0, 0]] },
      legFR: { rot: sine(HORSE_GALLOP, 0, 0.45) },
      legFL: { rot: sine(HORSE_GALLOP, 0, -0.45 * 0.7) },
      legBR: { rot: sine(HORSE_GALLOP, 0, -0.45) },
      legBL: { rot: sine(HORSE_GALLOP, 0, 0.45 * 0.7) },
    },
  },
  attack: {
    length: ATTACK,
    loop: false,
    tracks: { armR: { rot: [[0, -1.4, 0, 0], [ATTACK, 0.2, 0, 0]] } },
  },
};

const dragon: Partial<Record<ClipName, Clip>> = {
  fly: {
    length: WING_FLAP,
    loop: true,
    tracks: {
      wingR: { rot: sine(WING_FLAP, 2, -0.48) },
      wingL: { rot: sine(WING_FLAP, 2, 0.48) },
    },
  },
};

export const CLIPS: Record<RigKind, Partial<Record<ClipName, Clip>>> = {
  humanoid,
  golem: humanoid,
  rider,
  quadruped: rider,
  dragon,
  siege: {},
};

/** Sample one track at time t into out[o..o+2]. Returns false when the track has no keys. */
export function sampleKeys(keys: Key[] | undefined, t: number, loop: boolean, length: number, out: Float32Array, o: number): boolean {
  if (!keys || keys.length === 0) return false;
  const n = keys.length;
  if (n === 1) {
    out[o] = keys[0][1];
    out[o + 1] = keys[0][2];
    out[o + 2] = keys[0][3];
    return true;
  }
  let tt = loop ? ((t % length) + length) % length : Math.min(Math.max(t, keys[0][0]), keys[n - 1][0]);
  if (tt >= keys[n - 1][0]) tt = keys[n - 1][0] - 1e-6;
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] <= tt) i++;
  const k1 = keys[i];
  const k2 = keys[i + 1];
  // neighbours for the curve; looping clips skip the duplicated end key when wrapping
  const k0 = i > 0 ? keys[i - 1] : loop ? keys[n - 2] : k1;
  const k3 = i + 2 < n ? keys[i + 2] : loop ? keys[1] : k2;
  const span = k2[0] - k1[0] || 1;
  const u = (tt - k1[0]) / span;
  const u2 = u * u;
  const u3 = u2 * u;
  for (let a = 1; a <= 3; a++) {
    const p0 = k0[a];
    const p1 = k1[a];
    const p2 = k2[a];
    const p3 = k3[a];
    out[o + a - 1] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }
  return true;
}
