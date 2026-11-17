// Heavy Knight: great helm with a tall plume, big pauldrons, broad sword, kite shield.
// Tier 1 open helm; 2 great helm with a gold cross; 3 bright plate, gold trim and a cape.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cyl, finishModel, ico, lambert, part, seg, socketAt, taperBox, tintMat } from "./kit";
import { beltKit, cape, greaves, hem, human, humanSockets, PAL, scabbard, shield, skirt, vambraces } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const plate = lambert(o.tier >= 3 ? PAL.steel : PAL.iron);
  const dark = lambert(PAL.ironDark);
  const gold = lambert(PAL.gold);
  const leather = lambert(PAL.leatherDark);
  const h = human({ bulk: 1.15, skin: lambert(PAL.skin), torso: tint, sleeves: plate, hands: dark, legs: plate, boots: dark, face: o.tier === 1 ? "eyes" : "none" });

  // surcoat over armour, belt, gorget
  skirt(h, tint, 0.8, 0.36, 0.56);
  part(h.spine, box(0.82, 0.11, 0.52), leather, 0, 0.14, 0);
  part(h.spine, box(0.14, 0.14, 0.05), gold, 0, 0.14, 0.27);
  part(h.spine, cyl(0.2, 0.34, 0.16, 7), plate, 0, 1.12, 0);
  // pauldrons ride on the upper arms
  for (const arm of [h.armR, h.armL]) {
    const p = part(arm, ico(0.3, 0), plate, 0, 0.06, 0);
    p.scale.set(1, 0.72, 1.1);
    if (o.tier >= 3) part(arm, ico(0.09, 0), gold, 0, 0.27, 0);
  }
  // knee plates
  part(h.legR, ico(0.15, 0), plate, 0, -0.78, 0.1);
  part(h.legL, ico(0.15, 0), plate, 0, -0.78, 0.1);

  if (o.tier === 1) {
    // open helm with a nasal bar
    part(h.head, cyl(0.24, 0.31, 0.34, 8), plate, 0, 0.47, 0);
    part(h.head, box(0.06, 0.26, 0.05), plate, 0, 0.32, 0.27);
  } else {
    // great helm: closed barrel, eye slit, gold cross
    part(h.head, cyl(0.3, 0.32, 0.6, 8), plate, 0, 0.3, 0);
    part(h.head, cyl(0.2, 0.3, 0.08, 8), plate, 0, 0.64, 0);
    part(h.head, box(0.4, 0.05, 0.05), lambert(PAL.shadow), 0, 0.38, 0.29);
    part(h.head, box(0.05, 0.4, 0.04), gold, 0, 0.3, 0.3);
    part(h.head, box(0.26, 0.05, 0.04), gold, 0, 0.44, 0.3);
  }
  // tall plume in the kingdom colour, sweeping back
  seg(h.head, tint, [0, 0.64, 0], [0, 1.1, -0.12], 0.1, 0.13, 5);
  seg(h.head, tint, [0, 1.1, -0.12], [0, 1.2, -0.5], 0.13, 0.03, 5);

  // broad sword: grip at the hand, blade pointing forward-up
  h.handR.rotation.x = 1.15;
  part(h.handR, cyl(0.035, 0.035, 0.34, 5), leather, 0, 0, 0);
  part(h.handR, ico(0.07, 0), gold, 0, -0.2, 0);
  part(h.handR, box(0.5, 0.07, 0.1), o.tier >= 3 ? gold : dark, 0, 0.19, 0);
  part(h.handR, taperBox(0.19, 0.14, 1.7, 0.05), plate, 0, 1.07, 0);
  part(h.handR, taperBox(0.14, 0.01, 0.3, 0.05, 0.01), plate, 0, 2.07, 0);
  part(h.handR, box(0.04, 1.5, 0.06), dark, 0, 1.0, 0); // fuller

  shield(h, "kite", tint, plate, 1.05);
  if (o.tier >= 3) cape(h, tint, 1.7);

  // ---- v2 gear layer
  beltKit(h, leather, gold, false);
  scabbard(h, leather, gold, 1.35);
  greaves(h, plate);
  vambraces(h, dark, o.tier >= 3 ? gold : plate);
  hem(h, lambert(o.crest), 0.8, 0.56);
  // breastplate ridge and fauld lames over the surcoat
  part(h.spine, taperBox(0.1, 0.16, 0.7, 0.06), plate, 0, 0.7, 0.27 * h.bulk);
  for (const s of [-1, 1]) part(h.hips, taperBox(0.3, 0.26, 0.3, 0.06), plate, s * 0.27 * h.bulk, -0.1, 0.2 * h.bulk, -0.15, 0, 0);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 1.2),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 2.2, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.2, 0),
  });
}
