// Shared humanoid body for unit models. Builds the skeleton (hips, spine, head, two-part arms,
// legs) with a neutral body; each unit file dresses it with its own helmet, armour and gear.
// Body height is about 3.5 before headgear, matching the prototype (head joint at y = 2.92).
import * as THREE from "three";
import type { BoneName, SocketName } from "../contract";
import { box, cyl, ico, part, pivot, socketAt, taperBox } from "./kit";

/** Shared neutral palette (docs/rencana-visual.md 2.1). */
export const PAL = {
  iron: 0x8b95a5,
  ironDark: 0x5b6472,
  steel: 0xc9d1dc,
  gold: 0xfacc15,
  goldDark: 0xd4a017,
  leather: 0x7a5232,
  leatherDark: 0x5a3d22,
  wood: 0x6b4a2a,
  woodDark: 0x4a3220,
  skin: 0xe0b48a,
  bone: 0xe8e2d0,
  cream: 0xf1e9d2,
  shadow: 0x15121c,
};

export interface HumanSpec {
  /** torso and limb thickness, 1 = soldier, 1.15 = knight, 0.7 = skeleton */
  bulk?: number;
  skin: THREE.Material;
  /** torso; pass null to leave the torso empty (skeleton builds a ribcage instead) */
  torso: THREE.Material | null;
  sleeves: THREE.Material;
  hands: THREE.Material;
  legs: THREE.Material;
  boots: THREE.Material;
  /** bare head; false when the unit builds its own skull or helmet-only head */
  head?: boolean;
  /** elbow bend at rest for right and left arm (radians, positive = forward) */
  bendR?: number;
  bendL?: number;
}

export interface Human {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  armR: THREE.Group;
  forearmR: THREE.Group;
  /** right hand pivot, registered as the "weapon" bone */
  handR: THREE.Group;
  armL: THREE.Group;
  forearmL: THREE.Group;
  /** left hand pivot, registered as the "offhand" bone */
  handL: THREE.Group;
  legR: THREE.Group;
  legL: THREE.Group;
  bulk: number;
  bones: Partial<Record<BoneName, THREE.Object3D>>;
}

/** Y of the hip joint above the ground and of the head joint above the spine pivot. */
export const HIP_Y = 1.6;
export const NECK_Y = 1.2;
export const SHOULDER_Y = 1.0;

export function human(spec: HumanSpec): Human {
  const k = spec.bulk ?? 1;
  const root = new THREE.Group();

  const hips = pivot(root, "hips", 0, HIP_Y, 0);
  part(hips, taperBox(0.6 * k, 0.66 * k, 0.34, 0.4 * k), spec.legs, 0, 0.02, 0);

  // legs: thigh, knee, shin and foot on one bone; sole ends at y = 0
  const leg = (name: string, x: number) => {
    const g = pivot(hips, name, x, -0.05, 0);
    part(g, cyl(0.17 * k, 0.135 * k, 0.76, 6), spec.legs, 0, -0.4, 0);
    part(g, cyl(0.13 * k, 0.1 * k, 0.6, 6), spec.boots, 0, -1.06, 0);
    part(g, taperBox(0.24 * k, 0.2 * k, 0.19, 0.52, 0.36), spec.boots, 0, -1.455, 0.08);
    return g;
  };
  const legR = leg("legR", -0.2 * k);
  const legL = leg("legL", 0.2 * k);

  // spine: waist to shoulders
  const spine = pivot(hips, "spine", 0, 0.12, 0);
  if (spec.torso) {
    part(spine, taperBox(0.62 * k, 0.92 * k, 1.0, 0.4 * k, 0.5 * k), spec.torso, 0, 0.6, 0);
    part(spine, cyl(0.11, 0.13, 0.16, 6), spec.skin, 0, 1.16, 0); // neck
  }

  const head = pivot(spine, "head", 0, NECK_Y, 0);
  if (spec.head !== false) part(head, ico(0.27, 1), spec.skin, 0, 0.3, 0.01);

  // arms: shoulder -> elbow -> hand. Right side is -X.
  const arm = (side: -1 | 1, bend: number) => {
    const s = side === -1 ? "R" : "L";
    const upper = pivot(spine, `arm${s}`, side * 0.56 * k, SHOULDER_Y, 0, 0, 0, side * 0.1);
    part(upper, ico(0.15 * k, 0), spec.sleeves, 0, 0, 0);
    part(upper, cyl(0.115 * k, 0.095 * k, 0.6, 6), spec.sleeves, 0, -0.3, 0);
    const fore = pivot(upper, `forearm${s}`, 0, -0.6, 0, -bend);
    part(fore, cyl(0.095 * k, 0.075 * k, 0.52, 6), spec.sleeves, 0, -0.26, 0);
    part(fore, box(0.14 * k, 0.17, 0.16 * k), spec.hands, 0, -0.58, 0);
    const hand = pivot(fore, side === -1 ? "weapon" : "offhand", 0, -0.58, 0);
    return { upper, fore, hand };
  };
  const R = arm(-1, spec.bendR ?? 0.25);
  const L = arm(1, spec.bendL ?? 0.35);

  const bones: Human["bones"] = {
    hips, spine, head,
    armR: R.upper, forearmR: R.fore, weapon: R.hand,
    armL: L.upper, forearmL: L.fore, offhand: L.hand,
    legR, legL,
  };
  return { root, hips, spine, head, armR: R.upper, forearmR: R.fore, handR: R.hand, armL: L.upper, forearmL: L.fore, handL: L.hand, legR, legL, bulk: k, bones };
}

/** The sockets every humanoid has. `top` is the height of the headgear above the neck joint. */
export function humanSockets(h: Human, top: number): Partial<Record<SocketName, THREE.Object3D>> {
  return {
    headTop: socketAt(h.head, "headTop", 0, top, 0),
    chest: socketAt(h.spine, "chest", 0, 0.65, 0.3 * h.bulk),
    back: socketAt(h.spine, "back", 0, 0.7, -0.32 * h.bulk),
    offhand: socketAt(h.handL, "offhand"),
  };
}

/** Skirt of a robe or surcoat hanging from the hips (does not follow the legs). */
export function skirt(h: Human, mat: THREE.Material, length: number, rTop = 0.36, rBottom = 0.62, sides = 8) {
  return part(h.hips, cyl(rTop * h.bulk, rBottom * h.bulk, length, sides), mat, 0, 0.16 - length / 2, 0);
}

/** Cloak down the back, attached to the spine. */
export function cape(h: Human, mat: THREE.Material, length: number, width = 0.86) {
  return part(h.spine, taperBox(width * 1.25 * h.bulk, width * h.bulk, length, 0.06), mat, 0, 1.08 - length / 2, -0.3 * h.bulk, 0.1, 0, 0);
}

/**
 * Shield on the left hand, angled so its face shows from the front.
 * heater = flat top and pointed bottom, kite = long, round = disc.
 */
export function shield(h: Human, kind: "heater" | "kite" | "round", face: THREE.Material, rim: THREE.Material, size = 1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0.16, 0.16, 0.12);
  g.rotation.set(0.25, 0.75, 0);
  h.handL.add(g);
  if (kind === "round") {
    part(g, cyl(0.5 * size, 0.5 * size, 0.07, 9), rim, 0, 0, 0, Math.PI / 2, 0, 0);
    part(g, cyl(0.4 * size, 0.4 * size, 0.09, 9), face, 0, 0, 0.02, Math.PI / 2, 0, 0);
    part(g, ico(0.1 * size, 0), rim, 0, 0, 0.07);
  } else {
    const hgt = (kind === "kite" ? 1.35 : 1.0) * size;
    const w = (kind === "kite" ? 0.62 : 0.74) * size;
    part(g, taperBox(w, w, hgt * 0.5, 0.07), rim, 0, hgt * 0.25, 0);
    part(g, taperBox(0.12, w, hgt * 0.5, 0.07), rim, 0, -hgt * 0.25, 0);
    part(g, taperBox(w * 0.8, w * 0.8, hgt * 0.42, 0.07), face, 0, hgt * 0.25, 0.025);
    part(g, taperBox(0.04, w * 0.8, hgt * 0.42, 0.07), face, 0, -hgt * 0.2, 0.025);
  }
  return g;
}
