// Longbow Ranger: pointed hood, cloak, quiver on the back, bow as tall as the body in the left hand.
// Tier 1 cloth hood; 2 fur-trimmed cloak; 3 carved bow with gold tips.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, ico, lambert, part, seg, socketAt, tintMat } from "./kit";
import { cape, human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const leather = lambert(PAL.leather);
  const dark = lambert(PAL.leatherDark);
  const wood = lambert(PAL.woodDark);
  const cream = lambert(PAL.cream);
  const gold = lambert(PAL.gold);
  const h = human({ skin: lambert(PAL.skin), torso: leather, sleeves: lambert(0x4f5d3a), hands: dark, legs: dark, boots: leather, bendL: 0.15 });

  skirt(h, tint, 0.55, 0.35, 0.5);
  part(h.spine, box(0.7, 0.09, 0.46), dark, 0, 0.14, 0);
  part(h.spine, box(0.1, 1.05, 0.5), dark, 0.12, 0.62, 0, 0, 0, 0.55); // quiver strap across the chest

  // hood and mantle in the kingdom colour; the face shows at the front
  part(h.head, cyl(0.29, 0.33, 0.44, 7), tint, 0, 0.3, -0.07);
  part(h.head, cone(0.3, 0.62, 6), tint, 0, 0.72, -0.2, -0.75, 0, 0);
  part(h.spine, cyl(0.28, 0.64, 0.3, 7), tint, 0, 1.03, 0);
  cape(h, tint, 1.55, 0.8);
  if (o.tier >= 2) part(h.spine, cyl(0.64, 0.67, 0.1, 7), cream, 0, 0.88, 0); // fur trim

  // quiver with arrows on the back
  seg(h.spine, leather, [0.2, 0.25, -0.36], [-0.22, 1.2, -0.38], 0.1, 0.11, 6);
  for (let i = 0; i < 3; i++) {
    const x = -0.27 + i * 0.05;
    seg(h.spine, wood, [x, 1.2, -0.38], [x - 0.08, 1.42, -0.38], 0.015, 0.015, 3);
    part(h.spine, box(0.07, 0.12, 0.02), cream, x - 0.09, 1.45, -0.38, 0, 0, 0.35);
  }

  // longbow in the left hand: belly forward, tips swept back, string behind
  h.handL.rotation.x = 0.55;
  const z = (y: number) => 0.22 - 0.42 * (y / 1.65) ** 2;
  const ys = [-1.65, -1.2, -0.6, 0, 0.6, 1.2, 1.65];
  for (let i = 0; i < 6; i++) {
    const thick = 0.05 - Math.abs(i - 2.5) * 0.008;
    seg(h.handL, wood, [0, ys[i], z(ys[i])], [0, ys[i + 1], z(ys[i + 1])], thick, thick, 5);
  }
  part(h.handL, cyl(0.055, 0.055, 0.3, 5), leather, 0, 0, 0.22);
  seg(h.handL, cream, [0, -1.65, z(1.65)], [0, 1.65, z(1.65)], 0.01, 0.01, 3);
  if (o.tier >= 3) {
    part(h.handL, ico(0.07, 0), gold, 0, 1.68, z(1.65));
    part(h.handL, ico(0.07, 0), gold, 0, -1.68, z(1.65));
    part(h.handL, cyl(0.062, 0.062, 0.06, 5), gold, 0, 0.2, 0.22);
    part(h.handL, cyl(0.062, 0.062, 0.06, 5), gold, 0, -0.2, 0.22);
  }
  // an arrow ready in the right hand
  h.handR.rotation.x = 1.3;
  seg(h.handR, wood, [0, -0.3, 0], [0, 1.0, 0], 0.016, 0.016, 3);
  part(h.handR, cone(0.045, 0.14, 4), lambert(PAL.iron), 0, 1.07, 0);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 1.0),
    muzzle: socketAt(h.handL, "muzzle", 0, 0, 0.3),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 1.14, 0),
  });
}
