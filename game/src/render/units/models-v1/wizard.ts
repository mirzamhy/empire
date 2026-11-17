// Fire Wizard: wide bent hat, long beard, robe, staff with a glowing fire crystal.
// Tier 1 wooden staff; 2 bigger crystal with orbiting embers; 3 gold-trimmed robe and high collar.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, seg, socketAt, tintMat } from "./kit";
import { human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const hat = lambert(0x2f2a55);
  const wood = lambert(PAL.woodDark);
  const cream = lambert(PAL.cream);
  const gold = lambert(PAL.gold);
  const fire = glow(0xff7a1a);
  const skin = lambert(PAL.skin);
  const h = human({ skin, torso: tint, sleeves: tint, hands: skin, legs: lambert(PAL.leatherDark), boots: lambert(PAL.leather), bendR: 0.45 });

  // robe to the shins, rope belt, wide cuffs
  skirt(h, tint, 1.3, 0.36, 0.68, 8);
  part(h.spine, cyl(0.36, 0.38, 0.09, 7), lambert(PAL.leather), 0, 0.16, 0);
  part(h.forearmR, cyl(0.1, 0.17, 0.3, 6), tint, 0, -0.36, 0);
  part(h.forearmL, cyl(0.1, 0.17, 0.3, 6), tint, 0, -0.36, 0);
  if (o.tier >= 3) {
    part(h.hips, cyl(0.675, 0.69, 0.08, 8), gold, 0, 0.16 - 1.3 + 0.05, 0);
    part(h.spine, cyl(0.36, 0.26, 0.3, 7), gold, 0, 1.22, -0.03);
    part(h.spine, box(0.08, 0.95, 0.04), gold, 0, 0.62, 0.25);
  }

  // hat: wide brim, cone, bent tip, band in the kingdom colour
  part(h.head, cyl(0.62, 0.66, 0.05, 9), hat, 0, 0.5, 0, 0.08, 0, 0);
  part(h.head, cyl(0.15, 0.3, 0.5, 7), hat, 0, 0.77, 0);
  part(h.head, cyl(0.305, 0.315, 0.1, 7), tint, 0, 0.58, 0);
  seg(h.head, hat, [0, 1.0, 0], [0, 1.4, -0.2], 0.15, 0.08, 6);
  seg(h.head, hat, [0, 1.4, -0.2], [0, 1.5, -0.55], 0.08, 0, 6);
  // beard and moustache
  part(h.head, cone(0.2, 0.8, 5), cream, 0, -0.14, 0.2, Math.PI, 0, 0);
  part(h.head, box(0.3, 0.07, 0.08), cream, 0, 0.2, 0.27);

  // staff: gnarled shaft, three prongs holding the crystal
  h.handR.rotation.x = 0.55;
  seg(h.handR, wood, [0, -1.5, 0], [0, 1.2, 0], 0.045, 0.04, 5);
  seg(h.handR, wood, [0, 1.2, 0], [0.05, 2.5, 0], 0.04, 0.05, 5);
  const r = o.tier >= 2 ? 0.26 : 0.2;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const mid = [0.05 + Math.cos(a) * (r + 0.05), 2.85, Math.sin(a) * (r + 0.05)];
    seg(h.handR, wood, [0.05, 2.5, 0], mid, 0.035, 0.025, 4);
    seg(h.handR, wood, mid, [0.05 + Math.cos(a) * r * 0.6, 3.2, Math.sin(a) * r * 0.6], 0.025, 0, 4);
  }
  part(h.handR, ico(r, 0), fire, 0.05, 2.95, 0);
  if (o.tier >= 2) {
    const ember = glow(0xffd25a);
    for (let i = 0; i < 3; i++) part(h.handR, ico(0.06, 0), ember, 0.05 + Math.cos(i * 2.1 + 0.4) * 0.48, 2.85 + i * 0.12, Math.sin(i * 2.1 + 0.4) * 0.48);
  }

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 1.5),
    muzzle: socketAt(h.handR, "muzzle", 0.05, 2.95, 0),
    weaponTip: socketAt(h.handR, "weaponTip", 0.05, 3.2, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.5, 0),
  });
}
