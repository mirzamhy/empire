// Skeleton: open ribcage, skull with dark sockets, rusty sword, torn cloth in the kingdom colour.
// Tier 1 bare bones; 2 rusty helm cap; 3 broken shield and a shoulder plate.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cyl, finishModel, ico, lambert, part, ring, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { human, humanSockets, PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const bone = lambert(PAL.bone);
  const dim = lambert(0xbdb39c);
  const dark = lambert(PAL.shadow);
  const rust = lambert(0x8a5a3c);
  const h = human({ bulk: 0.62, skin: bone, torso: null, sleeves: bone, hands: dim, legs: bone, boots: dim, head: false, bendL: 0.5 });

  // spine column, three ribs, collar bones
  seg(h.spine, dim, [0, -0.05, -0.04], [0, 1.22, -0.02], 0.06, 0.05, 5);
  for (let i = 0; i < 3; i++) {
    const r = part(h.spine, ring(0.27 - i * 0.02, 0.035, 8), bone, 0, 0.92 - i * 0.2, 0.02, Math.PI / 2, 0, 0);
    r.scale.set(1, 0.72, 1);
  }
  part(h.spine, box(0.74, 0.07, 0.09), bone, 0, 1.02, 0);
  part(h.spine, box(0.09, 0.5, 0.06), bone, 0, 0.75, 0.2); // sternum

  // skull: cranium, jaw, eye sockets, nose
  part(h.head, ico(0.26, 1), bone, 0, 0.34, 0);
  part(h.head, box(0.27, 0.11, 0.24), dim, 0, 0.08, 0.06);
  part(h.head, box(0.1, 0.1, 0.06), dark, -0.1, 0.34, 0.225);
  part(h.head, box(0.1, 0.1, 0.06), dark, 0.1, 0.34, 0.225);
  part(h.head, box(0.05, 0.07, 0.05), dark, 0, 0.23, 0.245);
  if (o.tier >= 2) part(h.head, cyl(0.2, 0.29, 0.2, 7), rust, 0, 0.52, 0);

  // torn cloth: scarf and ragged loincloth in the kingdom colour
  part(h.spine, cyl(0.15, 0.22, 0.14, 6), tint, 0, 1.13, 0);
  part(h.spine, taperBox(0.05, 0.16, 0.5, 0.04), tint, 0.14, 0.85, 0.16, 0, 0, -0.2);
  part(h.hips, cyl(0.25, 0.27, 0.12, 7), tint, 0, 0.1, 0);
  part(h.hips, sheet([[-0.24, 0.1, 0.2], [0.24, 0.1, 0.2], [-0.2, -0.5, 0.24], [-0.04, -0.75, 0.24], [0.1, -0.45, 0.24], [0.22, -0.65, 0.24]], [[0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 4, 5]]), tint);
  part(h.hips, sheet([[-0.24, 0.1, -0.2], [0.24, 0.1, -0.2], [-0.18, -0.6, -0.24], [0.02, -0.4, -0.24], [0.2, -0.7, -0.24]], [[0, 2, 3], [0, 3, 1], [1, 3, 4]]), tint);

  // rusty notched sword
  h.handR.rotation.x = 1.1;
  part(h.handR, cyl(0.03, 0.03, 0.3, 5), dark, 0, 0, 0);
  part(h.handR, box(0.36, 0.06, 0.08), rust, 0, 0.17, 0);
  part(h.handR, taperBox(0.13, 0.1, 1.0, 0.04), rust, 0, 0.7, 0);
  part(h.handR, taperBox(0.1, 0.06, 0.45, 0.04), rust, 0.03, 1.42, 0, 0, 0, -0.08);
  part(h.handR, taperBox(0.06, 0.01, 0.2, 0.04, 0.01), rust, 0.05, 1.74, 0, 0, 0, -0.08);

  if (o.tier >= 3) {
    // broken round shield (a wedge is missing) and a shoulder plate
    const s = part(h.handL, cyl(0.42, 0.42, 0.06, 7), lambert(PAL.woodDark), 0.14, 0.12, 0.1, Math.PI / 2 + 0.25, 0, 0.75);
    part(s, ico(0.1, 0), rust, 0, 0.05, 0);
    const p = part(h.armR, ico(0.2, 0), rust, 0, 0.06, 0);
    p.scale.set(1, 0.7, 1);
  }

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.7),
    weaponTip: socketAt(h.handR, "weaponTip", 0.05, 1.84, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.0, 0),
  });
}
