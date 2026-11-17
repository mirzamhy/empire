// REFERENCE MODEL: a small humanoid that passes the contract. Copy its structure when writing a
// real unit; it is not used in game. See docs/fable/README.md.
//
// Conventions shown here:
//   - hips is the root bone and the parent of spine and both legs (bob and lean happen on hips)
//   - bones sit at joints: shoulder, elbow, hip, neck. Parts hang below or beyond them
//   - right side of the unit is -X, so armR/legR are built at negative x
//   - A-pose: arms rotated ~15 degrees away from the body (rest rotation on the arm bone)
//   - feet touch y = 0, height about 3.8, weapon in the right hand pointing forward-down
//   - kingdom colour = tintMat(); self-lit = glow(); everything else = lambert()
//   - tiers add detail only; the skeleton and the silhouette stay the same
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, pivot, socketAt, tintMat } from "./kit";

export function build(opts: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const steel = lambert(0x9aa3ad);
  const dark = lambert(0x3a3f47);
  const skin = lambert(0xd9a77a);
  const wood = lambert(0x6b4a2b);
  const trim = lambert(opts.crest);
  const tint = tintMat(opts.tint);
  const rune = glow(0xffd36a);

  // hips: root of the skeleton, centred 1.75 above the ground
  const hips = pivot(root, "hips", 0, 1.75, 0);
  part(hips, box(0.8, 0.3, 0.5), dark, 0, 0, 0); // pelvis

  // legs: pivot at the hip joint, parts hang down. Boot sole ends exactly at y = -1.75
  const legs = {
    legR: pivot(hips, "legR", -0.26, -0.05, 0),
    legL: pivot(hips, "legL", 0.26, -0.05, 0),
  };
  for (const leg of Object.values(legs)) {
    part(leg, cyl(0.2, 0.15, 1.5, 6), steel, 0, -0.8, 0);
    part(leg, box(0.36, 0.2, 0.6), dark, 0, -1.6, 0.1); // boot
  }

  // spine: torso and everything above the waist
  const spine = pivot(hips, "spine", 0, 0.15, 0);
  part(spine, box(0.95, 1.25, 0.55), steel, 0, 0.6, 0); // chest plate
  part(spine, box(0.5, 1.05, 0.6), tint, 0, 0.55, 0); // tabard in the kingdom colour
  part(spine, box(0.9, 0.12, 0.6), trim, 0, 0.02, 0); // belt trim
  if (opts.tier >= 2) {
    // pauldrons
    part(spine, ico(0.34, 0), steel, -0.62, 1.2, 0);
    part(spine, ico(0.34, 0), steel, 0.62, 1.2, 0);
  }

  // head: pivot at the neck
  const head = pivot(spine, "head", 0, 1.3, 0);
  part(head, ico(0.3, 0), skin, 0, 0.3, 0.02);
  part(head, cyl(0.31, 0.33, 0.28, 7), steel, 0, 0.42, 0); // helmet
  part(head, cone(0.12, opts.tier >= 3 ? 0.55 : 0.3, 5), trim, 0, 0.72, -0.05); // plume
  part(head, box(0.34, 0.06, 0.04), dark, 0, 0.32, 0.31); // visor slit

  // right arm (-X): shoulder pivot -> elbow pivot -> hand pivot ("weapon")
  const armR = pivot(spine, "armR", -0.62, 1.1, 0, 0, 0, -0.26);
  part(armR, cyl(0.12, 0.1, 0.65, 6), steel, 0, -0.33, 0);
  const forearmR = pivot(armR, "forearmR", 0, -0.65, 0, -0.25);
  part(forearmR, cyl(0.1, 0.08, 0.6, 6), dark, 0, -0.3, 0);
  // weapon: the pivot is the grip. The shaft is built along +Y, then the pivot is tilted to point forward-down
  const weapon = pivot(forearmR, "weapon", 0, -0.62, 0, 1.75);
  part(weapon, cyl(0.04, 0.04, 3.2, 5), wood, 0, 0.6, 0); // shaft from -1.0 to 2.2
  part(weapon, cone(0.12, 0.5, 4), steel, 0, 2.45, 0); // spear head
  part(weapon, ico(0.07, 0), rune, 0, 2.15, 0); // glowing rune

  // left arm (+X) carries the shield through the "offhand" bone
  const armL = pivot(spine, "armL", 0.62, 1.1, 0, 0, 0, 0.26);
  part(armL, cyl(0.12, 0.1, 0.65, 6), steel, 0, -0.33, 0);
  const forearmL = pivot(armL, "forearmL", 0, -0.65, 0, -0.5);
  part(forearmL, cyl(0.1, 0.08, 0.6, 6), dark, 0, -0.3, 0);
  const offhand = pivot(forearmL, "offhand", 0.12, -0.3, 0.2);
  part(offhand, cyl(0.5, 0.5, 0.08, 8), steel, 0, 0, 0, Math.PI / 2, 0, 0); // shield disc facing +Z
  part(offhand, cyl(0.34, 0.34, 0.1, 8), tint, 0, 0, 0.03, Math.PI / 2, 0, 0); // heraldic face

  const sockets = {
    headTop: socketAt(head, "headTop", 0, 0.85, 0),
    chest: socketAt(spine, "chest", 0, 0.65, 0.32),
    back: socketAt(spine, "back", 0, 0.7, -0.35),
    weaponTip: socketAt(weapon, "weaponTip", 0, 2.7, 0),
    weaponMid: socketAt(weapon, "weaponMid", 0, 1.1, 0),
    offhand: socketAt(offhand, "offhand"),
  };

  return finishModel(
    root,
    "humanoid",
    { hips, spine, head, armR, forearmR, weapon, armL, forearmL, offhand, legR: legs.legR, legL: legs.legL },
    sockets,
  );
}
