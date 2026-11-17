// Royal Paladin: winged helm, glowing halo, two-handed war hammer, tabard and cape.
// Tier 1 small helm wings; 2 brighter, wider halo and gold pauldron studs; 3 gold wings and a long cape.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, ring, seg, socketAt, taperBox, tintMat } from "./kit";
import { cape, human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const steel = lambert(PAL.steel);
  const iron = lambert(PAL.iron);
  const gold = lambert(PAL.gold);
  const wood = lambert(PAL.wood);
  const holy = glow(o.tier >= 2 ? 0xfff3c4 : 0xfde68a);
  const h = human({ bulk: 1.1, skin: lambert(PAL.skin), torso: steel, sleeves: steel, hands: iron, legs: iron, boots: lambert(PAL.ironDark), bendR: 0.5, bendL: 0.6 });

  // tabard: a long panel front and back over the breastplate, gold belt
  part(h.spine, box(0.46, 1.0, 0.6), tint, 0, 0.62, 0);
  skirt(h, tint, 0.95, 0.34, 0.5, 6);
  part(h.spine, box(0.78, 0.1, 0.5), gold, 0, 0.14, 0);
  part(h.spine, cyl(0.2, 0.34, 0.16, 7), steel, 0, 1.12, 0);
  part(h.spine, box(0.08, 0.36, 0.04), gold, 0, 0.72, 0.31); // cross on the tabard
  part(h.spine, box(0.26, 0.08, 0.04), gold, 0, 0.78, 0.31);
  cape(h, tint, o.tier >= 3 ? 2.0 : 1.45);
  for (const arm of [h.armR, h.armL]) {
    const p = part(arm, ico(0.27, 0), steel, 0, 0.06, 0);
    p.scale.set(1, 0.75, 1.05);
    if (o.tier >= 2) part(arm, ico(0.08, 0), gold, 0, 0.25, 0);
  }

  // helm: rounded dome, face guard, swept wings
  part(h.head, cyl(0.2, 0.31, 0.36, 8), steel, 0, 0.46, 0);
  part(h.head, box(0.07, 0.3, 0.05), steel, 0, 0.3, 0.27);
  part(h.head, cyl(0.31, 0.32, 0.07, 8), gold, 0, 0.3, 0);
  const wing = lambert(o.tier >= 3 ? PAL.gold : PAL.cream);
  for (const s of [-1, 1]) {
    for (let i = 0; i < (o.tier >= 3 ? 3 : 2); i++) {
      part(h.head, taperBox(0.05, 0.16, 0.5 - i * 0.1, 0.03), wing, s * (0.3 + i * 0.02), 0.62 - i * 0.12, -0.06 - i * 0.1, -0.5 - i * 0.25, 0, -s * 0.45);
    }
  }
  // halo floating above the head
  part(h.head, ring(o.tier >= 2 ? 0.38 : 0.3, 0.035, 10), holy, 0, 1.08, 0, Math.PI / 2, 0, 0);

  // war hammer: long shaft, heavy head with gold bands and a spike
  h.handR.rotation.x = 0.8;
  seg(h.handR, wood, [0, -0.9, 0], [0, 2.2, 0], 0.045, 0.045, 5);
  part(h.handR, box(0.44, 0.44, 0.95), iron, 0, 2.3, 0);
  part(h.handR, box(0.48, 0.48, 0.12), gold, 0, 2.3, 0.3);
  part(h.handR, box(0.48, 0.48, 0.12), gold, 0, 2.3, -0.3);
  part(h.handR, cone(0.1, 0.3, 4), iron, 0, 2.67, 0);
  part(h.handR, ico(0.07, 0), gold, 0, -0.95, 0);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 1.15),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 2.3, 0.5),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.3, 0),
  });
}
