// Animation clips as data (docs/rencana-visual.md 4.3). A key is [time, x, y, z]: Euler XYZ
// radians for rotation tracks, model units for position tracks. Values between keys use
// Catmull-Rom, so a handful of keys gives smooth curves; looping clips repeat their first key
// at t = length.
//
// V0 clips reproduce the prototype's motion (sine walk, single arm swing) so nothing changes on
// screen. V2 replaces them with per-unit clips (stab, slash, shoot, cast...).
import type { UnitType } from "../../sim/config";
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

/** ambient = a loop that always plays on top (demon wings); fly replaces idle and walk. */
export type ClipName = "idle" | "walk" | "attack" | "fly" | "ambient";

/** Keys for a + amp * sin(2π t / period) on one axis, nine per cycle (close to a true sine). */
function sine(period: number, axis: 0 | 1 | 2, amp: number, base: [number, number, number] = [0, 0, 0], phase = 0): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i <= 8; i++) {
    const v = [...base] as [number, number, number];
    v[axis] += amp * Math.sin((Math.PI * i) / 4 - phase);
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

// Dragon: full wing beat with the outer wing lagging behind, tail swaying, neck bobbing.
// attack (breath): neck reaches forward and down, jaw opens for the flame, then it settles.
const dragon: Partial<Record<ClipName, Clip>> = {
  fly: {
    length: WING_FLAP,
    loop: true,
    tracks: {
      wingR: { rot: sine(WING_FLAP, 2, -0.55) },
      wingL: { rot: sine(WING_FLAP, 2, 0.55) },
      wingR2: { rot: sine(WING_FLAP, 2, -0.4, [0, 0, 0], 0.9) },
      wingL2: { rot: sine(WING_FLAP, 2, 0.4, [0, 0, 0], 0.9) },
      tail1: { rot: sine(WING_FLAP, 1, 0.12) },
      tail2: { rot: sine(WING_FLAP, 1, 0.16, [0, 0, 0], 0.8) },
      tail3: { rot: sine(WING_FLAP, 1, 0.2, [0, 0, 0], 1.6) },
      neck1: { rot: sine(WING_FLAP, 0, 0.05, [0, 0, 0], 0.5) },
      legR: { rot: [[0, 0.5, 0, 0], [WING_FLAP, 0.5, 0, 0]] },
      legL: { rot: [[0, 0.5, 0, 0], [WING_FLAP, 0.5, 0, 0]] },
    },
  },
  attack: {
    length: 1.0,
    loop: false,
    tracks: {
      neck1: { rot: [[0, 0.25, 0, 0], [0.1, 0.55, 0, 0], [0.4, 0.55, 0.12, 0], [0.7, 0.55, -0.12, 0], [1.0, 0, 0, 0]] },
      neck2: { rot: [[0, 0.1, 0, 0], [0.1, 0.25, 0, 0], [0.7, 0.25, 0, 0], [1.0, 0, 0, 0]] },
      head: { rot: [[0, 0.1, 0, 0], [0.1, 0.3, 0, 0], [0.7, 0.3, 0, 0], [1.0, 0, 0, 0]] },
      jaw: { rot: [[0, 0.3, 0, 0], [0.08, 0.65, 0, 0], [0.7, 0.6, 0, 0], [0.85, 0, 0, 0], [1.0, 0, 0, 0]] },
    },
  },
};

// ---------------------------------------------------------------- per-unit clips
// The sim deals damage the moment an attack starts, so every attack clip begins at its windup
// extreme and reaches contact within about 0.1 s; the rest is follow-through back to idle.
const IDLE_R: [number, number, number] = [-0.32, 0, -0.22];
const IDLE_L: [number, number, number] = [-0.35, 0.25, 0.18];
const k = (t: number, v: [number, number, number]): Key => [t, v[0], v[1], v[2]];

const stab: Clip = {
  length: 0.5,
  loop: false,
  tracks: {
    armR: { rot: [[0, -0.9, 0, -0.15], [0.08, -1.25, 0, -0.1], [0.25, -1.1, 0, -0.12], k(0.5, IDLE_R)] },
    forearmR: { rot: [[0, 0.1, 0, 0], [0.08, 0.25, 0, 0], [0.5, 0, 0, 0]] },
    weapon: { rot: [[0, 1.6, 0, 0], [0.08, 2.1, 0, 0], [0.25, 1.9, 0, 0], [0.5, 0, 0, 0]] },
    spine: { rot: [[0, 0.1, -0.1, 0], [0.08, 0.3, -0.3, 0], [0.3, 0.2, -0.2, 0], [0.5, 0, 0, 0]] },
  },
};
const slash: Clip = {
  length: 0.5,
  loop: false,
  tracks: {
    armR: { rot: [[0, -2.2, 0, -0.5], [0.1, -0.9, 0, 0.5], [0.25, -0.3, 0, 0.6], k(0.5, IDLE_R)] },
    weapon: { rot: [[0, 0.3, 0, 0], [0.1, 0.9, 0, 0], [0.25, 1.0, 0, 0], [0.5, 0, 0, 0]] },
    spine: { rot: [[0, -0.1, -0.4, 0], [0.1, 0.2, 0.35, 0], [0.3, 0.15, 0.3, 0], [0.5, 0, 0, 0]] },
  },
};
const shoot: Clip = {
  length: 0.6,
  loop: false,
  tracks: {
    armL: { rot: [[0, -1.4, 0, 0.1], [0.35, -1.4, 0, 0.1], k(0.6, IDLE_L)] },
    forearmL: { rot: [[0, 0.15, 0, 0], [0.35, 0.15, 0, 0], [0.6, 0, 0, 0]] },
    offhand: { rot: [[0, 0.85, 0, 0], [0.35, 0.85, 0, 0], [0.6, 0, 0, 0]] },
    armR: { rot: [[0, -1.3, 0, 0.3], [0.08, -1.1, 0, -0.3], [0.35, -1.0, 0, -0.3], k(0.6, IDLE_R)] },
    forearmR: { rot: [[0, -1.2, 0, 0], [0.1, -1.6, 0, 0], [0.35, -1.4, 0, 0], [0.6, 0, 0, 0]] },
    spine: { rot: [[0, 0, -0.4, 0], [0.35, 0, -0.4, 0], [0.6, 0, 0, 0]] },
  },
};
const cast: Clip = {
  length: 0.6,
  loop: false,
  tracks: {
    armR: { rot: [[0, -1.9, 0, -0.2], [0.12, -1.3, 0, 0], [0.35, -1.2, 0, 0], k(0.6, IDLE_R)] },
    weapon: { rot: [[0, -0.3, 0, 0], [0.12, 0.7, 0, 0], [0.35, 0.6, 0, 0], [0.6, 0, 0, 0]] },
    armL: { rot: [[0, -1.0, 0, 0.5], [0.15, -1.5, 0, 0.3], [0.35, -1.3, 0, 0.3], k(0.6, IDLE_L)] },
    spine: { rot: [[0, -0.15, 0, 0], [0.12, 0.2, 0, 0], [0.35, 0.15, 0, 0], [0.6, 0, 0, 0]] },
  },
};
const slam: Clip = {
  length: 0.6,
  loop: false,
  tracks: {
    armR: { rot: [[0, -2.6, 0, 0], [0.1, -0.7, 0, 0.15], [0.3, -0.5, 0, 0.1], k(0.6, IDLE_R)] },
    armL: { rot: [[0, -2.4, 0, 0], [0.1, -0.8, 0, -0.3], [0.3, -0.6, 0, -0.2], k(0.6, IDLE_L)] },
    weapon: { rot: [[0, 0.2, 0, 0], [0.1, 1.0, 0, 0], [0.3, 1.0, 0, 0], [0.6, 0, 0, 0]] },
    spine: { rot: [[0, -0.25, 0, 0], [0.1, 0.5, 0, 0], [0.3, 0.4, 0, 0], [0.6, 0, 0, 0]] },
    hips: { pos: [[0, 0, 0.05, 0], [0.1, 0, -0.14, 0], [0.3, 0, -0.1, 0], [0.6, 0, 0, 0]] },
  },
};
const punch: Clip = {
  length: 0.55,
  loop: false,
  tracks: {
    armR: { rot: [[0, -0.6, 0, 0], [0.09, -1.5, 0, 0.15], [0.3, -1.0, 0, 0.1], k(0.55, IDLE_R)] },
    forearmR: { rot: [[0, -0.9, 0, 0], [0.09, 0.15, 0, 0], [0.55, 0, 0, 0]] },
    armL: { rot: [[0, -0.5, 0, 0], [0.09, 0.2, 0, 0], k(0.55, IDLE_L)] },
    spine: { rot: [[0, 0, -0.5, 0], [0.09, 0.15, 0.45, 0], [0.3, 0.1, 0.3, 0], [0.55, 0, 0, 0]] },
  },
};
const cleave: Clip = {
  length: 0.7,
  loop: false,
  tracks: {
    spine: { rot: [[0, 0, -0.9, 0], [0.15, 0.1, 0.9, 0], [0.4, 0.05, 0.6, 0], [0.7, 0, 0, 0]] },
    armR: { rot: [[0, -1.4, 0, -0.9], [0.15, -1.2, 0, 0.7], [0.4, -0.8, 0, 0.6], k(0.7, IDLE_R)] },
    weapon: { rot: [[0, 0.6, 0, 0], [0.15, 0.6, 0, 0], [0.7, 0, 0, 0]] },
  },
};
const charge: Clip = {
  length: 0.5,
  loop: false,
  tracks: {
    armR: { rot: [[0, -1.0, 0, 0], [0.1, -1.3, 0, 0], [0.3, -1.1, 0, 0], [0.5, -0.35, 0, 0]] },
    weapon: { rot: [[0, 1.0, 0, 0], [0.1, 1.3, 0, 0], [0.3, 1.2, 0, 0], [0.5, 0, 0, 0]] },
    spine: { rot: [[0, 0.1, 0, 0], [0.1, 0.3, 0, 0], [0.5, 0, 0, 0]] },
    neck: { rot: [[0, 0, 0, 0], [0.1, -0.2, 0, 0], [0.5, 0, 0, 0]] },
  },
};
// Halberd chop: both hands bring the blade down from overhead.
const chop: Clip = {
  length: 0.6,
  loop: false,
  tracks: {
    armR: { rot: [[0, -2.4, 0, 0.1], [0.1, -0.8, 0, 0.2], [0.3, -0.6, 0, 0.15], k(0.6, IDLE_R)] },
    armL: { rot: [[0, -2.1, 0, -0.5], [0.1, -0.9, 0, -0.5], [0.3, -0.7, 0, -0.4], k(0.6, IDLE_L)] },
    weapon: { rot: [[0, 0.1, 0, 0], [0.1, 1.0, 0, 0], [0.3, 1.0, 0, 0], [0.6, 0, 0, 0]] },
    spine: { rot: [[0, -0.2, 0, 0], [0.1, 0.45, 0, 0], [0.3, 0.35, 0, 0], [0.6, 0, 0, 0]] },
  },
};
// Shield bash: the shield arm punches forward, the body follows.
const bash: Clip = {
  length: 0.5,
  loop: false,
  tracks: {
    armL: { rot: [[0, -0.3, 0, 0.1], [0.09, -1.1, 0, -0.1], [0.25, -0.9, 0, 0], k(0.5, IDLE_L)] },
    spine: { rot: [[0, -0.1, 0.25, 0], [0.09, 0.3, -0.3, 0], [0.25, 0.2, -0.2, 0], [0.5, 0, 0, 0]] },
    armR: { rot: [[0, -0.6, 0, -0.3], [0.2, -1.2, 0, 0], [0.35, -0.6, 0, -0.1], k(0.5, IDLE_R)] },
    hips: { pos: [[0, 0, 0, 0], [0.09, 0, -0.08, 0.15], [0.5, 0, 0, 0]] },
  },
};
// Berserker frenzy: both axes fall one after the other.
const frenzy: Clip = {
  length: 0.55,
  loop: false,
  tracks: {
    armR: { rot: [[0, -2.3, 0, -0.3], [0.09, -0.6, 0, 0.3], [0.3, -0.5, 0, 0.1], k(0.55, IDLE_R)] },
    armL: { rot: [[0, -0.6, 0, 0.2], [0.14, -2.3, 0, 0.3], [0.26, -0.6, 0, -0.3], [0.4, -0.5, 0, 0], k(0.55, IDLE_L)] },
    spine: { rot: [[0, -0.15, -0.35, 0], [0.09, 0.3, 0.3, 0], [0.26, 0.3, -0.3, 0], [0.55, 0, 0, 0]] },
  },
};
// Assassin backstab: lunge and drive both daggers forward.
const backstab: Clip = {
  length: 0.45,
  loop: false,
  tracks: {
    armR: { rot: [[0, -0.6, 0, -0.5], [0.07, -1.5, 0, 0.3], [0.2, -1.3, 0, 0.2], k(0.45, IDLE_R)] },
    armL: { rot: [[0, -0.6, 0, 0.5], [0.07, -1.5, 0, -0.3], [0.2, -1.3, 0, -0.2], k(0.45, IDLE_L)] },
    spine: { rot: [[0, 0.2, 0, 0], [0.07, 0.55, 0, 0], [0.2, 0.4, 0, 0], [0.45, 0, 0, 0]] },
    hips: { pos: [[0, 0, 0.25, 0], [0.07, 0, -0.1, 0.3], [0.45, 0, 0, 0]] },
  },
};
// Engineer hammering (also plays while building).
const hammer: Clip = {
  length: 0.5,
  loop: false,
  tracks: {
    armR: { rot: [[0, -2.2, 0, 0], [0.1, -0.6, 0, 0.1], [0.25, -0.5, 0, 0.1], k(0.5, IDLE_R)] },
    weapon: { rot: [[0, 0, 0, 0], [0.1, 0.9, 0, 0], [0.25, 0.9, 0, 0], [0.5, 0, 0, 0]] },
    spine: { rot: [[0, -0.15, 0, 0], [0.1, 0.4, 0, 0], [0.25, 0.3, 0, 0], [0.5, 0, 0, 0]] },
  },
};
// Elephant gore: the head rears up, then swings down and forward with the tusks.
const gore: Clip = {
  length: 0.8,
  loop: false,
  tracks: {
    head: { rot: [[0, -0.45, 0, 0], [0.12, 0.35, 0.2, 0], [0.4, 0.2, -0.15, 0], [0.8, 0, 0, 0]] },
    trunk1: { rot: [[0, -1.0, 0, 0], [0.12, 0.3, 0, 0], [0.4, 0.1, 0, 0], [0.8, 0, 0, 0]] },
    trunk2: { rot: [[0, -1.2, 0, 0], [0.15, 0.4, 0, 0], [0.8, 0, 0, 0]] },
    legFR: { rot: [[0, -0.5, 0, 0], [0.12, 0.1, 0, 0], [0.8, 0, 0, 0]] },
    legFL: { rot: [[0, -0.35, 0, 0], [0.14, 0.1, 0, 0], [0.8, 0, 0, 0]] },
  },
};
const TRUNK_SWAY = 3.2;
const elephantIdle: Clip = {
  length: TRUNK_SWAY,
  loop: true,
  tracks: {
    trunk1: { rot: sine(TRUNK_SWAY, 2, 0.12) },
    trunk2: { rot: sine(TRUNK_SWAY, 2, 0.2, [0, 0, 0], 0.8) },
    tail: { rot: sine(TRUNK_SWAY / 2, 2, 0.25) },
  },
};
const ELEPHANT_STEP = (2 * Math.PI) / 3.4;
const elephantWalk: Clip = {
  length: ELEPHANT_STEP,
  loop: true,
  tracks: {
    legFR: { rot: sine(ELEPHANT_STEP, 0, 0.32) },
    legFL: { rot: sine(ELEPHANT_STEP, 0, -0.32) },
    legBR: { rot: sine(ELEPHANT_STEP, 0, -0.3) },
    legBL: { rot: sine(ELEPHANT_STEP, 0, 0.3) },
    body: { pos: sine(ELEPHANT_STEP / 2, 1, 0.06) },
    head: { rot: sine(ELEPHANT_STEP, 0, 0.05) },
  },
};
// Siege engines: wheels roll while moving; the ballista kicks back, the trebuchet arm swings over.
const WHEEL_TURN = 1.6;
const roll: Key[] = [[0, 0, 0, 0], [WHEEL_TURN / 4, Math.PI / 2, 0, 0], [WHEEL_TURN / 2, Math.PI, 0, 0], [(WHEEL_TURN * 3) / 4, Math.PI * 1.5, 0, 0], [WHEEL_TURN, Math.PI * 2, 0, 0]];
const siegeMove: Clip = {
  length: WHEEL_TURN,
  loop: true,
  tracks: { wheelFR: { rot: roll }, wheelFL: { rot: roll }, wheelBR: { rot: roll }, wheelBL: { rot: roll } },
};
const ballistaFire: Clip = {
  length: 0.7,
  loop: false,
  tracks: {
    turret: { pos: [[0, 0, 0, 0], [0.05, 0, 0.04, -0.3], [0.3, 0, 0, -0.1], [0.7, 0, 0, 0]], rot: [[0, 0, 0, 0], [0.05, -0.12, 0, 0], [0.3, -0.03, 0, 0], [0.7, 0, 0, 0]] },
    base: { pos: [[0, 0, 0, 0], [0.06, 0, 0, -0.12], [0.4, 0, 0, 0], [0.7, 0, 0, 0]] },
  },
};
const trebuchetLaunch: Clip = {
  length: 1.4,
  loop: false,
  tracks: {
    arm: { rot: [[0, 0.5, 0, 0], [0.14, 2.3, 0, 0], [0.4, 2.55, 0, 0], [0.7, 2.3, 0, 0], [1.4, 0, 0, 0]] },
    sling: { rot: [[0, 0.6, 0, 0], [0.14, 1.6, 0, 0], [0.5, 0.4, 0, 0], [1.4, 0, 0, 0]] },
    base: { pos: [[0, 0, 0, 0], [0.16, 0, 0.05, 0.1], [0.5, 0, 0, 0], [1.4, 0, 0, 0]] },
  },
};

const WING_IDLE = 2.6;
const demonWings: Clip = {
  length: WING_IDLE,
  loop: true,
  tracks: { wingR: { rot: sine(WING_IDLE, 1, -0.12) }, wingL: { rot: sine(WING_IDLE, 1, 0.12) } },
};

const TYPE_CLIPS: Partial<Record<UnitType, Partial<Record<ClipName, Clip>>>> = {
  spearman: { attack: stab },
  skeleton: { attack: stab },
  swordsman: { attack: slash },
  archer: { attack: shoot },
  wizard: { attack: cast },
  necromancer: { attack: cast },
  paladin: { attack: slam },
  golem: { attack: punch },
  demon: { attack: cleave, ambient: demonWings },
  cavalry: { attack: charge },
  halberdier: { attack: chop },
  shieldbearer: { attack: bash },
  berserker: { attack: frenzy },
  assassin: { attack: backstab },
  engineer: { attack: hammer },
  elephant: { attack: gore, walk: elephantWalk, ambient: elephantIdle },
  ballista: { attack: ballistaFire, walk: siegeMove },
  trebuchet: { attack: trebuchetLaunch, walk: siegeMove },
};

/** The clip a unit type plays: its own when it has one, else the default of its rig. */
export function clipFor(type: UnitType, rig: RigKind, name: ClipName): Clip | undefined {
  return TYPE_CLIPS[type]?.[name] ?? CLIPS[rig][name];
}

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
