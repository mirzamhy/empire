// Engineer: leather cap with goggles, big hammer, wooden backpack with tools, apron in the kingdom colour.
// Builds watchtowers in friendly villages. Tier 1 plain; 2 brass fittings; 3 gold hammer head.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cyl, finishModel, glow, lambert, part, seg, socketAt, taperBox, tintMat } from "./kit";
import { beltKit, human, humanSockets, legWraps, PAL, skirt, vambraces } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const leather = lambert(PAL.leather);
  const dark = lambert(PAL.leatherDark);
  const wood = lambert(PAL.wood);
  const iron = lambert(PAL.iron);
  const brass = lambert(o.tier >= 2 ? PAL.goldDark : PAL.ironDark);
  const h = human({ skin: lambert(PAL.skin), torso: lambert(0xd8cdb4), sleeves: lambert(0xd8cdb4), hands: dark, legs: dark, boots: leather, bendR: 0.5 });

  // apron from chest to knees, tool belt
  part(h.spine, taperBox(0.56, 0.5, 0.85, 0.05), tint, 0, 0.55, 0.25);
  part(h.hips, taperBox(0.66, 0.56, 0.95, 0.05), tint, 0, -0.3, 0.3, -0.12, 0, 0);
  skirt(h, dark, 0.35, 0.34, 0.42, 6);
  part(h.spine, box(0.74, 0.11, 0.5), leather, 0, 0.14, 0);
  part(h.spine, box(0.14, 0.2, 0.1), brass, 0.25, 0.08, 0.26);
  part(h.spine, box(0.1, 0.24, 0.08), iron, -0.25, 0.04, 0.26);

  // backpack: wooden frame with a saw and rolled plans
  part(h.spine, box(0.66, 0.8, 0.34), wood, 0, 0.62, -0.42);
  part(h.spine, box(0.7, 0.08, 0.38), brass, 0, 0.9, -0.42);
  part(h.spine, cyl(0.09, 0.09, 0.8, 6), lambert(PAL.cream), 0, 1.08, -0.42, 0, 0, Math.PI / 2);
  seg(h.spine, iron, [0.36, 0.3, -0.42], [0.36, 1.3, -0.5], 0.03, 0.03, 4);
  part(h.spine, box(0.04, 0.3, 0.22), iron, 0.36, 1.35, -0.52);

  // leather cap, goggles pushed up on the forehead
  part(h.head, cyl(0.24, 0.3, 0.22, 7), leather, 0, 0.5, -0.01);
  part(h.head, box(0.36, 0.05, 0.2), leather, 0, 0.42, 0.2);
  part(h.head, cyl(0.08, 0.08, 0.06, 6), brass, -0.11, 0.47, 0.27, Math.PI / 2, 0, 0);
  part(h.head, cyl(0.08, 0.08, 0.06, 6), brass, 0.11, 0.47, 0.27, Math.PI / 2, 0, 0);
  part(h.head, cyl(0.05, 0.05, 0.07, 6), glow(0x9fe8ff), -0.11, 0.47, 0.28, Math.PI / 2, 0, 0);
  part(h.head, cyl(0.05, 0.05, 0.07, 6), glow(0x9fe8ff), 0.11, 0.47, 0.28, Math.PI / 2, 0, 0);
  part(h.head, box(0.28, 0.1, 0.1), dark, 0, 0.16, 0.24); // moustache

  // sledgehammer
  h.handR.rotation.x = 0.85;
  seg(h.handR, wood, [0, -0.5, 0], [0, 1.7, 0], 0.045, 0.045, 5);
  part(h.handR, box(0.36, 0.36, 0.8), o.tier >= 3 ? lambert(PAL.gold) : iron, 0, 1.75, 0);
  part(h.handR, box(0.4, 0.4, 0.1), brass, 0, 1.75, 0.25);
  part(h.handR, box(0.4, 0.4, 0.1), brass, 0, 1.75, -0.25);

  // ---- v2 gear layer
  beltKit(h, leather, brass);
  vambraces(h, leather, brass);
  legWraps(h, leather);
  // pack frame on the back: box, bedroll, two plan tubes
  part(h.spine, box(0.52, 0.56, 0.24), leather, 0, 0.56, -0.36);
  part(h.spine, box(0.56, 0.06, 0.26), dark, 0, 0.72, -0.36);
  part(h.spine, cyl(0.11, 0.11, 0.66, 6), lambert(PAL.cream), 0, 0.94, -0.36, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) part(h.spine, cyl(0.045, 0.045, 0.7, 5), wood, s * 0.3, 0.6, -0.4, 0, 0, s * 0.12);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.7),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 1.75, 0.42),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.0, 0),
  });
}
