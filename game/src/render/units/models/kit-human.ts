// Shared humanoid body for unit models. Builds the skeleton (hips, spine, head, two-part arms,
// legs) with a neutral body; each unit file dresses it with its own helmet, armour and gear.
// Body height is about 3.5 before headgear, matching the prototype (head joint at y = 2.92).
//
// v2 (see notes/cara-merancang-model.md): the body itself carries the "anatomy layer" every
// humanoid shares (knees, boot cuffs, elbows, wrist cuffs, thumbs, a face), and the helpers at the
// bottom (beltKit, vambraces, greaves, scabbard, hem, bedroll, legWraps) are the common "gear
// layer", so every unit is detailed with the same vocabulary and to the same depth.
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
  /**
   * face on the bare head: "full" = eyes, brow, nose, ears; "eyes" = eyes and brow only (masks,
   * nasal bars); "none" = closed helms and custom heads. Default "full" when there is a head.
   */
  face?: "full" | "eyes" | "none";
  /** brow and (unit-made) hair colour; default dark brown */
  hair?: THREE.Material;
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
    // anatomy layer: knee, boot cuff, ankle strap
    part(g, ico(0.15 * k, 0), spec.legs, 0, -0.78, 0.035);
    part(g, cyl(0.16 * k, 0.145 * k, 0.1, 6), spec.boots, 0, -0.84, 0);
    part(g, box(0.27 * k, 0.06, 0.3), spec.boots, 0, -1.33, 0.02);
    return g;
  };
  const legR = leg("legR", -0.2 * k);
  const legL = leg("legL", 0.2 * k);

  // spine: waist to shoulders
  const spine = pivot(hips, "spine", 0, 0.12, 0);
  if (spec.torso) {
    part(spine, taperBox(0.62 * k, 0.92 * k, 1.0, 0.4 * k, 0.5 * k), spec.torso, 0, 0.6, 0);
    part(spine, cyl(0.11, 0.13, 0.16, 6), spec.skin, 0, 1.16, 0); // neck
    part(spine, taperBox(0.78 * k, 0.3 * k, 0.12, 0.42 * k, 0.26 * k), spec.torso, 0, 1.14, -0.01); // shoulders rising to the neck
  }

  const head = pivot(spine, "head", 0, NECK_Y, 0);
  if (spec.head !== false) part(head, ico(0.27, 1), spec.skin, 0, 0.3, 0.01);
  const face = spec.face ?? (spec.head !== false ? "full" : "none");
  if (face !== "none") {
    const dark = new THREE.MeshLambertMaterial({ color: PAL.shadow, flatShading: true });
    const hair = spec.hair ?? new THREE.MeshLambertMaterial({ color: 0x3b2a1c, flatShading: true });
    for (const s of [-1, 1]) part(head, box(0.065, 0.05, 0.04), dark, s * 0.1, 0.315, 0.252);
    part(head, box(0.27, 0.035, 0.05), hair, 0, 0.37, 0.24);
    if (face === "full") {
      part(head, taperBox(0.075, 0.04, 0.12, 0.08, 0.03), spec.skin, 0, 0.255, 0.285);
      for (const s of [-1, 1]) part(head, box(0.045, 0.1, 0.07), spec.skin, s * 0.268, 0.29, 0);
    }
  }

  // arms: shoulder -> elbow -> hand. Right side is -X.
  const arm = (side: -1 | 1, bend: number) => {
    const s = side === -1 ? "R" : "L";
    const upper = pivot(spine, `arm${s}`, side * 0.56 * k, SHOULDER_Y, 0, 0, 0, side * 0.1);
    part(upper, ico(0.15 * k, 0), spec.sleeves, 0, 0, 0);
    part(upper, cyl(0.115 * k, 0.095 * k, 0.6, 6), spec.sleeves, 0, -0.3, 0);
    const fore = pivot(upper, `forearm${s}`, 0, -0.6, 0, -bend);
    part(fore, cyl(0.095 * k, 0.075 * k, 0.52, 6), spec.sleeves, 0, -0.26, 0);
    part(fore, box(0.14 * k, 0.17, 0.16 * k), spec.hands, 0, -0.58, 0);
    // anatomy layer: elbow, wrist cuff, thumb
    part(fore, ico(0.108 * k, 0), spec.sleeves, 0, 0, -0.01);
    part(fore, cyl(0.092 * k, 0.086 * k, 0.09, 6), spec.hands, 0, -0.46, 0);
    part(fore, box(0.05, 0.09, 0.06), spec.hands, -side * 0.04 * k, -0.57, 0.1 * k);
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
    // v2: boss, a band across the top and rivets at the corners
    part(g, ico(0.09 * size, 0), rim, 0, hgt * 0.14, 0.07);
    part(g, box(w * 0.82, 0.05, 0.03), rim, 0, hgt * 0.38, 0.06);
    for (const s of [-1, 1]) part(g, box(0.05, 0.05, 0.04), rim, s * w * 0.32, hgt * 0.26, 0.06);
  }
  return g;
}

/** A simple standing crew member (no bones) for siege engines and howdahs. Feet at y = 0 of `parent`. */
export function crew(parent: THREE.Object3D, tunic: THREE.Material, x: number, y: number, z: number, ry = 0, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.scale.setScalar(scale);
  parent.add(g);
  const dark = new THREE.MeshLambertMaterial({ color: PAL.leatherDark, flatShading: true });
  const skin = new THREE.MeshLambertMaterial({ color: PAL.skin, flatShading: true });
  const iron = new THREE.MeshLambertMaterial({ color: PAL.iron, flatShading: true });
  // v2: two legs with boots, a belt, hands, a brimmed helm and eyes (same vocabulary as the soldiers, far fewer parts)
  const shadow = new THREE.MeshLambertMaterial({ color: PAL.shadow, flatShading: true });
  for (const s of [-1, 1]) {
    part(g, box(0.22, 1.1, 0.3), dark, s * 0.14, 0.95, 0);
    part(g, box(0.26, 0.4, 0.44), iron, s * 0.14, 0.2, 0.05);
    part(g, box(0.2, 0.9, 0.22), dark, s * 0.55, 2.2, 0.08, -0.5, 0, 0);
    part(g, box(0.16, 0.18, 0.18), skin, s * 0.55, 1.78, 0.32);
  }
  part(g, taperBox(0.6, 0.86, 1.2, 0.4, 0.48), tunic, 0, 2.1, 0);
  part(g, box(0.66, 0.12, 0.46), dark, 0, 1.6, 0);
  part(g, ico(0.27, 0), skin, 0, 3.02, 0);
  part(g, box(0.3, 0.05, 0.05), shadow, 0, 3.05, 0.24);
  part(g, cyl(0.2, 0.3, 0.22, 7), iron, 0, 3.22, 0);
  part(g, cyl(0.4, 0.42, 0.05, 7), iron, 0, 3.12, 0);
  return g;
}

// ---------------------------------------------------------------- gear layer (v2)
// Small pieces every foot soldier can wear. A unit picks the ones that fit its role, so detail
// is spread the same way on all of them: something at the waist, something on the forearms or
// shins, a finished hem, a finished weapon.

/** Buckle, a belt pouch on the unit's left hip and a small knife on the right. The unit draws the belt itself. */
export function beltKit(h: Human, leather: THREE.Material, metal: THREE.Material, knife = true) {
  const k = h.bulk;
  part(h.spine, box(0.13, 0.13, 0.05), metal, 0, 0.14, 0.215 * k + 0.02);
  part(h.hips, box(0.2, 0.22, 0.12), leather, 0.3 * k, 0.02, 0.17 * k);
  part(h.hips, box(0.22, 0.07, 0.14), leather, 0.3 * k, 0.12, 0.17 * k);
  part(h.hips, box(0.04, 0.04, 0.03), metal, 0.3 * k, 0.07, 0.17 * k + 0.07);
  if (knife) {
    part(h.hips, taperBox(0.05, 0.08, 0.34, 0.04), leather, -0.34 * k, -0.08, 0.1 * k, 0.25, 0, 0.1);
    part(h.hips, box(0.05, 0.12, 0.05), metal, -0.33 * k, 0.14, 0.13 * k, 0.25, 0, 0.1);
  }
}

/** Forearm guards: a slightly wider sleeve over each forearm with a raised band at the elbow end. */
export function vambraces(h: Human, mat: THREE.Material, trim: THREE.Material = mat) {
  const k = h.bulk;
  for (const fore of [h.forearmR, h.forearmL]) {
    part(fore, cyl(0.115 * k, 0.095 * k, 0.34, 6), mat, 0, -0.26, 0);
    part(fore, cyl(0.125 * k, 0.125 * k, 0.05, 6), trim, 0, -0.1, 0);
  }
}

/** Shin plates on the front of both boots, with a knee cop. */
export function greaves(h: Human, mat: THREE.Material) {
  const k = h.bulk;
  for (const leg of [h.legR, h.legL]) {
    part(leg, taperBox(0.16 * k, 0.22 * k, 0.5, 0.08), mat, 0, -1.08, 0.115 * k);
    part(leg, taperBox(0.2 * k, 0.12 * k, 0.16, 0.1, 0.06), mat, 0, -0.76, 0.15 * k);
  }
}

/** Cloth or leather bands wound round the shins. */
export function legWraps(h: Human, mat: THREE.Material) {
  const k = h.bulk;
  for (const leg of [h.legR, h.legL]) {
    part(leg, cyl(0.135 * k, 0.125 * k, 0.07, 6), mat, 0, -0.98, 0);
    part(leg, cyl(0.125 * k, 0.115 * k, 0.07, 6), mat, 0, -1.16, 0);
  }
}

/** Sword scabbard hanging from the unit's left hip, pointing back and down. */
export function scabbard(h: Human, mat: THREE.Material, metal: THREE.Material, length = 1.0) {
  const k = h.bulk;
  const g = new THREE.Group();
  g.position.set(0.36 * k, 0.05, -0.02);
  g.rotation.set(-0.5, 0, 0.12);
  h.hips.add(g);
  part(g, taperBox(0.06, 0.1, length, 0.05), mat, 0, -length / 2, 0);
  part(g, box(0.12, 0.07, 0.07), metal, 0, -0.02, 0);
  part(g, taperBox(0.02, 0.07, 0.1, 0.05), metal, 0, -length - 0.04, 0);
  return g;
}

/** A band of trim round the bottom of a skirt() of the same length and bottom radius. */
export function hem(h: Human, mat: THREE.Material, length: number, rBottom = 0.62, sides = 8) {
  return part(h.hips, cyl(rBottom * h.bulk * 0.985, rBottom * h.bulk * 1.02, 0.07, sides), mat, 0, 0.16 - length + 0.035, 0);
}

/** Rolled blanket across the back with two straps. */
export function bedroll(h: Human, cloth: THREE.Material, strap: THREE.Material, y = 0.42) {
  const k = h.bulk;
  part(h.spine, cyl(0.13, 0.13, 0.74 * k, 6), cloth, 0, y, -0.34 * k, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) part(h.spine, box(0.06, 0.3, 0.3), strap, s * 0.2 * k, y, -0.33 * k);
}

/** Layered shoulder guards on both upper arms: a cap, a lame below it and a rim. */
export function pauldrons(h: Human, mat: THREE.Material, trim: THREE.Material = mat, size = 1) {
  const k = h.bulk * size;
  for (const arm of [h.armR, h.armL]) {
    part(arm, ico(0.25 * k, 0), mat, 0, 0.06, 0).scale.set(1, 0.7, 1.08);
    part(arm, cyl(0.2 * k, 0.215 * k, 0.1, 6), mat, 0, -0.1, 0);
    part(arm, cyl(0.225 * k, 0.225 * k, 0.035, 6), trim, 0, -0.165, 0);
  }
}
