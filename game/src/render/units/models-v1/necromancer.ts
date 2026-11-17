// Dark Necromancer: horned hood with glowing eyes, staff with a purple crystal, skulls floating around.
// Tier 1 three skulls; 2 four skulls and longer horns; 3 bone crown and a tattered cloak.
import type * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const robe = lambert(0x221d33);
  const bone = lambert(PAL.bone);
  const wood = lambert(0x2b2030);
  const magic = glow(0xa855f7);
  const eyes = glow(0xd8b4fe);
  const pale = lambert(0xb8b0a0);
  const h = human({ skin: lambert(PAL.shadow), torso: robe, sleeves: robe, hands: pale, legs: robe, boots: robe, head: false, bendR: 0.45, bendL: 0.7 });

  // outer robe is dark; the inner robe (front panel, hem, cuffs) carries the kingdom colour
  skirt(h, robe, 1.4, 0.36, 0.66, 8);
  part(h.hips, cyl(0.6, 0.63, 0.16, 8), tint, 0, 0.16 - 1.4, 0);
  part(h.spine, box(0.34, 1.0, 0.06), tint, 0, 0.6, 0.235);
  part(h.hips, taperBox(0.6, 0.34, 1.34, 0.06), tint, 0, -0.52, 0.5, -0.215, 0, 0);
  part(h.spine, cyl(0.37, 0.39, 0.09, 7), bone, 0, 0.16, 0); // bone belt
  part(h.forearmR, cyl(0.1, 0.18, 0.3, 6), tint, 0, -0.36, 0);
  part(h.forearmL, cyl(0.1, 0.18, 0.3, 6), tint, 0, -0.36, 0);
  part(h.spine, cyl(0.26, 0.62, 0.28, 7), robe, 0, 1.04, 0); // mantle

  // hood with a dark face void, glowing eyes and horns
  part(h.head, ico(0.24, 0), lambert(PAL.shadow), 0, 0.3, 0.03);
  part(h.head, cyl(0.3, 0.35, 0.46, 7), robe, 0, 0.3, -0.08);
  part(h.head, cone(0.31, 0.5, 6), robe, 0, 0.7, -0.17, -0.6, 0, 0);
  part(h.head, box(0.07, 0.05, 0.04), eyes, -0.09, 0.33, 0.25);
  part(h.head, box(0.07, 0.05, 0.04), eyes, 0.09, 0.33, 0.25);
  const hornTop = o.tier >= 2 ? 1.45 : 1.2;
  for (const s of [-1, 1]) {
    seg(h.head, bone, [s * 0.24, 0.5, -0.05], [s * 0.55, 0.82, -0.1], 0.09, 0.07, 5);
    seg(h.head, bone, [s * 0.55, 0.82, -0.1], [s * 0.46, hornTop, 0.08], 0.07, 0, 5);
  }
  if (o.tier >= 3) for (let i = 0; i < 5; i++) part(h.head, cone(0.045, 0.22, 4), bone, Math.sin((i - 2) * 0.55) * 0.3, 0.6, Math.cos((i - 2) * 0.55) * 0.28 - 0.06);

  // staff: twisted dark wood, a skull under the crystal
  h.handR.rotation.x = 0.55;
  seg(h.handR, wood, [0, -1.5, 0], [0.04, 1.0, 0], 0.045, 0.04, 5);
  seg(h.handR, wood, [0.04, 1.0, 0], [-0.03, 2.35, 0], 0.04, 0.05, 5);
  skull(h.handR, bone, eyes, -0.03, 2.5, 0.02, 0.15);
  seg(h.handR, wood, [-0.03, 2.6, 0], [-0.03, 2.85, 0], 0.05, 0.03, 5);
  part(h.handR, ico(0.2, 0), magic, -0.03, 3.02, 0);

  // floating skulls around the shoulders (parented to the spine)
  const n = o.tier >= 2 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n + 0.6;
    skull(h.spine, bone, eyes, Math.cos(a) * 1.0, 0.75 + (i % 2) * 0.3, Math.sin(a) * 1.0, 0.13, Math.PI / 2 - a);
  }

  if (o.tier >= 3) {
    // tattered cloak: jagged hem
    const pts = [[-0.5, 1.05, -0.3], [0.5, 1.05, -0.3], [-0.62, -0.2, -0.5], [-0.3, -0.75, -0.55], [0, -0.3, -0.52], [0.3, -0.85, -0.55], [0.62, -0.25, -0.5]];
    part(h.spine, sheet(pts, [[0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 4, 5], [1, 5, 6]]), robe);
  }

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, hornTop),
    muzzle: socketAt(h.handR, "muzzle", -0.03, 3.02, 0),
    weaponTip: socketAt(h.handR, "weaponTip", -0.03, 3.22, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.5, 0),
  });
}

/** Small skull: cranium, jaw, two glowing eyes. `ry` turns its face. */
function skull(parent: THREE.Object3D, bone: THREE.Material, eyes: THREE.Material, x: number, y: number, z: number, r: number, ry = 0) {
  const g = part(parent, ico(r, 0), bone, x, y, z, 0, ry, 0);
  part(g, box(r * 1.1, r * 0.5, r * 0.9), bone, 0, -r * 0.8, r * 0.25);
  part(g, box(r * 0.4, r * 0.34, r * 0.2), eyes, -r * 0.38, r * 0.05, r * 0.82);
  part(g, box(r * 0.4, r * 0.34, r * 0.2), eyes, r * 0.38, r * 0.05, r * 0.82);
}
