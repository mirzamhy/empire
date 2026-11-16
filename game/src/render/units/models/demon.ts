// Demon Lord Titan: four curved horns, demon wings, magma greatsword, glowing cracks in the armour.
// Tier 1 wings folded; 2 wings half open; 3 wings spread and a crown of fire.
// Extra bones wingR / wingL (on the spine) let the wings beat slowly.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, pivot, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const hide = lambert(0x8b1a1a);
  const hideDark = lambert(0x5a1010);
  const armour = lambert(0x2a2226);
  const horn = lambert(0x1c1719);
  const bone = lambert(PAL.bone);
  const magma = glow(0xff5500);
  const hot = glow(0xffd25a);
  const h = human({ bulk: 1.42, skin: hide, torso: armour, sleeves: hide, hands: armour, legs: armour, boots: horn, bendR: 0.35, bendL: 0.4 });

  // armour with glowing cracks, spiked pauldrons, belt and long loincloth in the kingdom colour
  part(h.spine, box(0.06, 0.5, 0.04), magma, -0.14, 0.72, 0.345, 0, 0, 0.5);
  part(h.spine, box(0.06, 0.42, 0.04), magma, 0.1, 0.62, 0.34, 0, 0, -0.35);
  part(h.spine, box(0.05, 0.3, 0.04), magma, 0.26, 0.86, 0.345, 0, 0, 0.9);
  part(h.spine, box(1.0, 0.14, 0.62), tint, 0, 0.14, 0);
  part(h.spine, ico(0.1, 0), hot, 0, 0.14, 0.33);
  part(h.hips, taperBox(0.56, 0.4, 1.25, 0.06), tint, 0, -0.5, 0.32, -0.1, 0, 0);
  part(h.hips, taperBox(0.7, 0.5, 1.4, 0.06), tint, 0, -0.56, -0.32, 0.1, 0, 0);
  skirt(h, armour, 0.42, 0.37, 0.46, 7);
  for (const [arm, s] of [[h.armR, -1], [h.armL, 1]] as const) {
    const p = part(arm, ico(0.36, 0), armour, 0, 0.08, 0);
    p.scale.set(1, 0.75, 1.1);
    seg(arm, bone, [s * 0.1, 0.25, 0], [s * 0.42, 0.62, 0], 0.09, 0, 5);
    part(arm, cyl(0.15, 0.13, 0.16, 6), armour, 0, -0.5, 0); // arm band
  }
  part(h.legR, ico(0.2, 0), armour, 0, -0.78, 0.12);
  part(h.legL, ico(0.2, 0), armour, 0, -0.78, 0.12);

  // head: heavy jaw, glowing eyes, two big swept horns and two short forward horns
  part(h.head, box(0.36, 0.16, 0.3), hideDark, 0, 0.1, 0.1);
  part(h.head, box(0.09, 0.05, 0.04), hot, -0.11, 0.36, 0.255);
  part(h.head, box(0.09, 0.05, 0.04), hot, 0.11, 0.36, 0.255);
  part(h.head, box(0.4, 0.07, 0.1), hideDark, 0, 0.44, 0.22); // brow
  for (const s of [-1, 1]) {
    seg(h.head, horn, [s * 0.2, 0.46, -0.02], [s * 0.62, 0.66, -0.12], 0.12, 0.1, 5);
    seg(h.head, horn, [s * 0.62, 0.66, -0.12], [s * 0.78, 1.05, 0.0], 0.1, 0.06, 5);
    seg(h.head, horn, [s * 0.78, 1.05, 0.0], [s * 0.62, 1.4, 0.2], 0.06, 0, 5);
    seg(h.head, horn, [s * 0.14, 0.52, 0.16], [s * 0.2, 0.74, 0.42], 0.06, 0, 4);
  }
  if (o.tier >= 3) for (let i = 0; i < 5; i++) part(h.head, cone(0.07, 0.34 + (i % 2) * 0.16, 4), i % 2 ? hot : magma, Math.sin(i * 1.257) * 0.19, 0.74 + (i % 2) * 0.08, Math.cos(i * 1.257) * 0.19 - 0.02);

  // wings on the back: folded at tier 1, opening with rank
  const open = o.tier === 1 ? 1.15 : o.tier === 2 ? 0.55 : 0.2;
  const wings = [-1, 1].map((s) => {
    const w = pivot(h.spine, s === -1 ? "wingR" : "wingL", s * 0.3, 0.95, -0.3, 0, s * open, 0);
    const wrist = [s * 1.25, 0.75, 0];
    const tips = [[s * 2.15, 0.55, 0], [s * 1.75, -0.7, 0], [s * 0.75, -1.05, 0]];
    seg(w, hideDark, [0, 0, 0], wrist, 0.09, 0.06, 5);
    for (const t of tips) seg(w, hideDark, wrist, t, 0.05, 0.015, 4);
    seg(w, bone, wrist, [s * 1.3, 1.05, 0], 0.05, 0, 4); // wrist claw
    part(w, sheet([[0, 0, 0], wrist, ...tips, [0, -0.6, 0]], [[1, 2, 3], [1, 3, 4], [0, 1, 4], [0, 4, 5]]), hide);
    return w;
  });

  // magma greatsword
  h.handR.rotation.x = 1.0;
  part(h.handR, cyl(0.045, 0.045, 0.5, 5), horn, 0, 0, 0);
  seg(h.handR, horn, [-0.42, 0.42, 0], [0.42, 0.42, 0], 0.07, 0.07, 4);
  part(h.handR, cone(0.07, 0.22, 4), horn, -0.44, 0.52, 0);
  part(h.handR, cone(0.07, 0.22, 4), horn, 0.44, 0.52, 0);
  part(h.handR, taperBox(0.36, 0.26, 2.3, 0.07), armour, 0, 1.6, 0);
  part(h.handR, taperBox(0.26, 0.01, 0.5, 0.07, 0.02), armour, 0, 3.0, 0);
  part(h.handR, taperBox(0.14, 0.09, 2.5, 0.1), magma, 0, 1.75, 0);
  part(h.handR, ico(0.09, 0), hot, 0, -0.3, 0);

  return finishModel(h.root, "humanoid", { ...h.bones, wingR: wings[0], wingL: wings[1] }, {
    ...humanSockets(h, 1.45),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 3.25, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 1.8, 0),
  });
}
