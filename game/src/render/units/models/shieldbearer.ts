// Shieldbearer: tower shield as tall as the body, closed helm, short sword. Draws enemy attacks and
// covers allies from arrows. Tier 1 wooden shield; 2 iron rim; 3 gold emblem on the shield.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cyl, finishModel, ico, lambert, part, socketAt, taperBox, tintMat } from "./kit";
import { beltKit, greaves, hem, human, humanSockets, PAL, scabbard, skirt, vambraces } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const iron = lambert(PAL.iron);
  const dark = lambert(PAL.ironDark);
  const leather = lambert(PAL.leatherDark);
  const gold = lambert(PAL.gold);
  const h = human({ bulk: 1.12, skin: lambert(PAL.skin), torso: iron, sleeves: dark, hands: dark, legs: dark, boots: leather, bendL: 1.0, face: "none" });

  skirt(h, tint, 0.6, 0.36, 0.54);
  part(h.spine, box(0.8, 0.1, 0.5), leather, 0, 0.14, 0);
  part(h.spine, cyl(0.2, 0.34, 0.16, 7), iron, 0, 1.12, 0);
  for (const arm of [h.armR, h.armL]) part(arm, ico(0.25, 0), iron, 0, 0.06, 0).scale.set(1, 0.7, 1.05);

  // closed barbute helm with a T-shaped opening
  part(h.head, cyl(0.26, 0.31, 0.56, 8), iron, 0, 0.32, 0);
  part(h.head, cyl(0.14, 0.26, 0.12, 8), iron, 0, 0.66, 0);
  part(h.head, box(0.3, 0.05, 0.05), lambert(PAL.shadow), 0, 0.4, 0.28);
  part(h.head, box(0.06, 0.3, 0.05), lambert(PAL.shadow), 0, 0.24, 0.285);
  part(h.head, box(0.05, 0.16, 0.3), tint, 0, 0.78, 0); // short crest

  // tower shield held in front of the body
  const sh = new THREE.Group();
  sh.position.set(-0.2, 0.25, 0.25);
  sh.rotation.set(1.0, 0.25, 0);
  h.handL.add(sh);
  const rim = o.tier >= 2 ? iron : lambert(PAL.wood);
  part(sh, taperBox(1.0, 1.1, 2.3, 0.09), rim, 0, 0, 0);
  part(sh, taperBox(0.84, 0.94, 2.1, 0.09), tint, 0, 0, 0.03);
  part(sh, ico(0.14, 0), rim, 0, 0.1, 0.1);
  if (o.tier >= 3) {
    part(sh, box(0.1, 1.2, 0.04), gold, 0, 0.1, 0.085);
    part(sh, box(0.6, 0.1, 0.04), gold, 0, 0.45, 0.085);
  }

  // short sword
  h.handR.rotation.x = 1.2;
  part(h.handR, cyl(0.03, 0.03, 0.3, 5), leather, 0, 0, 0);
  part(h.handR, box(0.36, 0.06, 0.09), dark, 0, 0.17, 0);
  part(h.handR, taperBox(0.15, 0.11, 1.0, 0.045), iron, 0, 0.7, 0);
  part(h.handR, taperBox(0.11, 0.01, 0.22, 0.045, 0.01), iron, 0, 1.31, 0);

  // ---- v2 gear layer
  beltKit(h, leather, iron, false);
  scabbard(h, leather, iron, 0.9);
  greaves(h, iron);
  vambraces(h, iron, dark);
  hem(h, lambert(o.crest), 0.6, 0.54);
  // shield furniture: two bands, corner rivets, a grip bar behind
  for (const y of [-0.75, 0.8]) part(sh, box(1.0, 0.08, 0.05), rim, 0, y, 0.07);
  for (const x of [-0.4, 0.4]) for (const y of [-0.98, 1.0]) part(sh, box(0.07, 0.07, 0.05), rim, x, y, 0.08);
  part(sh, box(0.5, 0.06, 0.06), leather, 0, 0, -0.07);
  // breastplate ridge
  part(h.spine, taperBox(0.1, 0.16, 0.7, 0.06), dark, 0, 0.7, 0.27 * h.bulk);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.95),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 1.42, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 0.8, 0),
  });
}
