// Halberdier: long poleaxe with a hook, sallet helm, mail, tabard with a diagonal stripe.
// Strong against big units. Tier 1 no shoulder armour; 2 pauldrons; 3 engraved halberd with a small flag.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, ico, lambert, part, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { bedroll, beltKit, greaves, hem, human, humanSockets, PAL, skirt, vambraces } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const iron = lambert(PAL.iron);
  const mail = lambert(PAL.ironDark);
  const leather = lambert(PAL.leather);
  const wood = lambert(PAL.woodDark);
  const gold = lambert(PAL.gold);
  const h = human({ skin: lambert(PAL.skin), torso: tint, sleeves: mail, hands: leather, legs: mail, boots: leather, bendR: 0.4, bendL: 0.7 });

  // tabard with a diagonal stripe in the crest colour
  skirt(h, tint, 0.7, 0.35, 0.52);
  part(h.spine, box(0.12, 1.3, 0.04), lambert(o.crest), 0, 0.6, 0.245, 0, 0, 0.6);
  part(h.spine, box(0.7, 0.1, 0.46), leather, 0, 0.14, 0);
  part(h.spine, cyl(0.2, 0.32, 0.16, 7), mail, 0, 1.12, 0);
  if (o.tier >= 2) for (const arm of [h.armR, h.armL]) part(arm, ico(0.24, 0), iron, 0, 0.06, 0).scale.set(1, 0.7, 1.05);

  // sallet: rounded skull, swept tail at the back, eye slit
  part(h.head, cyl(0.2, 0.32, 0.3, 8), iron, 0, 0.47, 0);
  part(h.head, taperBox(0.5, 0.3, 0.14, 0.4, 0.2), iron, 0, 0.3, -0.25, -0.5, 0, 0);
  part(h.head, box(0.44, 0.12, 0.06), iron, 0, 0.36, 0.28);
  part(h.head, box(0.34, 0.035, 0.07), lambert(PAL.shadow), 0, 0.37, 0.285);

  // halberd: shaft, axe blade forward, hook behind, spike on top
  h.handR.rotation.x = 0.7;
  part(h.handR, cyl(0.04, 0.04, 4.6, 5), wood, 0, 0.9, 0);
  const metal = o.tier >= 3 ? lambert(PAL.steel) : iron;
  part(h.handR, sheet([[0, 2.7, 0.04], [0, 3.35, 0.04], [0, 3.5, 0.7], [0, 3.0, 0.82], [0, 2.55, 0.6]], [[0, 1, 2], [0, 2, 3], [0, 3, 4]]), metal);
  seg(h.handR, metal, [0, 3.1, -0.04], [0, 3.0, -0.5], 0.06, 0.03, 4);
  seg(h.handR, metal, [0, 3.0, -0.5], [0, 2.75, -0.42], 0.03, 0, 4);
  part(h.handR, cone(0.07, 0.7, 4), metal, 0, 3.55, 0);
  part(h.handR, cyl(0.065, 0.065, 0.5, 5), metal, 0, 3.0, 0);
  if (o.tier >= 3) {
    part(h.handR, cyl(0.07, 0.07, 0.08, 5), gold, 0, 2.7, 0);
    part(h.handR, sheet([[0, 2.6, -0.03], [0, 2.2, -0.03], [0, 2.4, -0.6]], [[0, 1, 2]]), tint);
  }

  // ---- v2 gear layer
  beltKit(h, leather, iron);
  greaves(h, iron);
  vambraces(h, iron, mail);
  hem(h, lambert(o.crest), 0.7, 0.52);
  bedroll(h, lambert(PAL.cream), leather);
  // halberd furniture: langets, grip binding, butt cap
  part(h.handR, cyl(0.052, 0.052, 0.6, 5), metal, 0, 2.4, 0);
  part(h.handR, cyl(0.05, 0.05, 0.36, 5), leather, 0, 0, 0);
  part(h.handR, cyl(0.055, 0.046, 0.2, 5), metal, 0, -1.3, 0); // butt ferrule
  part(h.head, cyl(0.325, 0.325, 0.03, 8), mail, 0, 0.33, 0); // helm rim

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.75),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 3.9, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 3.0, 0.4),
  });
}
