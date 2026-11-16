// Assassin: slim figure, hood and mask, two daggers, short cloak, scarf in the kingdom colour.
// Hunts ranged and support units. Tier 1 iron daggers; 2 poisoned blades (green glow); 3 shadow cloak with a purple edge.
import type * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, lambert, part, sheet, socketAt, taperBox, tintMat } from "./kit";
import { human, humanSockets, PAL, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const cloth = lambert(0x24222b);
  const dark = lambert(PAL.shadow);
  const leather = lambert(0x3a2f2a);
  const blade = o.tier >= 2 ? glow(0x7dff6a) : lambert(PAL.steel);
  const h = human({ bulk: 0.86, skin: lambert(PAL.skin), torso: cloth, sleeves: cloth, hands: leather, legs: cloth, boots: leather, bendR: 0.7, bendL: 0.7 });

  skirt(h, cloth, 0.4, 0.33, 0.4, 6);
  part(h.spine, box(0.56, 0.08, 0.38), leather, 0, 0.14, 0);
  part(h.spine, box(0.08, 0.9, 0.42), leather, -0.1, 0.62, 0, 0, 0, -0.5); // bandolier
  // scarf: collar and a tail blowing behind
  part(h.spine, cyl(0.2, 0.3, 0.2, 7), tint, 0, 1.12, 0);
  part(h.spine, sheet([[0.1, 1.15, -0.2], [0.3, 1.1, -0.2], [0.55, 0.5, -0.75], [0.3, 0.62, -0.6]], [[0, 1, 2], [0, 2, 3]]), tint);
  // short cloak
  part(h.spine, taperBox(0.9, 0.74, 0.95, 0.05), cloth, 0, 0.6, -0.26, 0.12, 0, 0);
  if (o.tier >= 3) part(h.spine, box(0.92, 0.07, 0.06), glow(0xa855f7), 0, 0.13, -0.32, 0.12, 0, 0);

  // hood with a mask: only the eyes show
  part(h.head, cyl(0.28, 0.32, 0.42, 7), cloth, 0, 0.3, -0.06);
  part(h.head, cone(0.28, 0.4, 6), cloth, 0, 0.66, -0.14, -0.55, 0, 0);
  part(h.head, box(0.4, 0.2, 0.08), dark, 0, 0.2, 0.24);

  dagger(h.handR, blade, leather);
  dagger(h.handL, blade, leather);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.9),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 0.95, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 0.5, 0),
  });
}

function dagger(hand: THREE.Group, blade: THREE.Material, grip: THREE.Material) {
  hand.rotation.x = 2.0;
  part(hand, cyl(0.03, 0.03, 0.26, 5), grip, 0, 0, 0);
  part(hand, box(0.22, 0.05, 0.07), grip, 0, 0.15, 0);
  part(hand, taperBox(0.1, 0.07, 0.55, 0.035), blade, 0, 0.45, 0);
  part(hand, taperBox(0.07, 0.01, 0.2, 0.035, 0.01), blade, 0, 0.82, 0);
}
