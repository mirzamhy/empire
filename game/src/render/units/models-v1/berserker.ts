// Berserker: bare chest, an axe in each hand, wild hair, war paint in the kingdom colour.
// Hits harder the more hurt it is. Tier 1 plain axes; 2 bear pelt on the shoulder; 3 glowing runes on the axes.
import type * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, sheet, socketAt, tintMat } from "./kit";
import { human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const skin = lambert(0xcf9a6e);
  const iron = lambert(PAL.iron);
  const leather = lambert(PAL.leatherDark);
  const wood = lambert(PAL.wood);
  const hair = lambert(0xb5451f);
  const h = human({ bulk: 1.12, skin, torso: skin, sleeves: skin, hands: skin, legs: tint, boots: leather, bendR: 0.6, bendL: 0.6 });

  // trousers in the kingdom colour, fur belt, war paint on chest and arms
  skirt(h, tint, 0.45, 0.36, 0.44, 7);
  part(h.spine, cyl(0.38, 0.4, 0.16, 7), leather, 0, 0.16, 0);
  part(h.spine, box(0.1, 0.7, 0.04), tint, -0.18, 0.7, 0.27, 0, 0, 0.35);
  part(h.spine, box(0.1, 0.7, 0.04), tint, 0.18, 0.7, 0.27, 0, 0, -0.35);
  for (const arm of [h.armR, h.armL]) part(arm, cyl(0.135, 0.13, 0.12, 6), tint, 0, -0.28, 0);
  part(h.forearmR, cyl(0.11, 0.1, 0.22, 6), leather, 0, -0.36, 0);
  part(h.forearmL, cyl(0.11, 0.1, 0.22, 6), leather, 0, -0.36, 0);
  if (o.tier >= 2) {
    part(h.spine, ico(0.4, 0), lambert(0x4a3220), -0.5, 1.12, -0.05).scale.set(1.1, 0.6, 1.1);
    part(h.spine, sheet([[-0.8, 1.1, -0.2], [-0.2, 1.15, -0.3], [-0.55, 0.3, -0.32], [-0.2, 0.5, -0.3]], [[0, 1, 2], [1, 3, 2]]), lambert(0x4a3220));
  }

  // wild hair, beard, war paint across the eyes
  for (let i = 0; i < 6; i++) part(h.head, cone(0.11, 0.42, 4), hair, Math.sin(i * 1.05) * 0.16, 0.6, Math.cos(i * 1.05) * 0.14 - 0.06, -0.5 + Math.cos(i * 1.05) * 0.5, 0, -Math.sin(i * 1.05) * 0.6);
  part(h.head, cone(0.16, 0.4, 5), hair, 0, 0.02, 0.2, Math.PI, 0, 0);
  part(h.head, box(0.5, 0.08, 0.05), tint, 0, 0.36, 0.25);

  axe(h.handR, o, wood, iron);
  axe(h.handL, o, wood, iron);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.85),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 1.35, 0.3),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 0.8, 0),
  });
}

/** Bearded axe held in a fist: handle up, blade forward. */
function axe(hand: THREE.Group, o: ModelOpts, wood: THREE.Material, iron: THREE.Material) {
  hand.rotation.x = 1.75;
  part(hand, cyl(0.04, 0.045, 1.5, 5), wood, 0, 0.55, 0);
  part(hand, sheet([[0, 0.95, 0.03], [0, 1.3, 0.03], [0, 1.45, 0.48], [0, 1.05, 0.56], [0, 0.72, 0.42]], [[0, 1, 2], [0, 2, 3], [0, 3, 4]]), iron);
  part(hand, box(0.09, 0.3, 0.12), iron, 0, 1.13, 0);
  if (o.tier >= 3) part(hand, ico(0.07, 0), glow(0xff5a1f), 0.01, 1.12, 0.26);
}
