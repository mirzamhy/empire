// Royal Spearman: long spear (1.5x body height), wide-brimmed kettle helm, heater shield.
// Tier 1 plain helm and wooden shield rim; 2 cheek guards, bigger spear head, iron rim; 3 small crown and pennant.
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, lambert, part, sheet, socketAt, tintMat } from "./kit";
import { human, humanSockets, PAL, shield, skirt } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const tint = tintMat(o.tint);
  const iron = lambert(PAL.iron);
  const mail = lambert(PAL.ironDark);
  const leather = lambert(PAL.leather);
  const wood = lambert(PAL.wood);
  const gold = lambert(PAL.gold);
  const crest = lambert(o.crest);
  const h = human({ skin: lambert(PAL.skin), torso: tint, sleeves: mail, hands: leather, legs: lambert(PAL.leatherDark), boots: leather });

  // tunic: kingdom colour, belt, geometric crest on the chest
  skirt(h, tint, 0.6, 0.35, 0.52);
  part(h.spine, box(0.7, 0.1, 0.46), leather, 0, 0.14, 0);
  part(h.spine, box(0.24, 0.24, 0.04), crest, 0, 0.72, 0.245, 0, 0, Math.PI / 4);
  part(h.spine, cyl(0.2, 0.3, 0.14, 7), mail, 0, 1.12, 0); // mail collar

  // kettle helm: wide brim and low dome
  part(h.head, cyl(0.44, 0.47, 0.06, 9), iron, 0, 0.44, 0);
  part(h.head, cyl(0.19, 0.3, 0.24, 8), iron, 0, 0.58, 0);
  if (o.tier >= 2) {
    part(h.head, box(0.06, 0.26, 0.22), iron, -0.27, 0.27, 0.02);
    part(h.head, box(0.06, 0.26, 0.22), iron, 0.27, 0.27, 0.02);
  }
  if (o.tier >= 3) for (let i = 0; i < 4; i++) part(h.head, cone(0.045, 0.16, 4), gold, Math.cos(i * 1.57 + 0.78) * 0.17, 0.76, Math.sin(i * 1.57 + 0.78) * 0.17);

  // spear in the right hand: shaft from -1.6 to 3.4 along the grip
  h.handR.rotation.x = 0.72;
  part(h.handR, cyl(0.035, 0.035, 5.0, 5), wood, 0, 0.9, 0);
  part(h.handR, cyl(0.06, 0.06, 0.12, 5), iron, 0, 3.36, 0);
  const big = o.tier >= 2 ? 1.3 : 1;
  part(h.handR, cone(0.11 * big, 0.55 * big, 4), iron, 0, 3.42 + 0.275 * big, 0);
  if (o.tier >= 3) part(h.handR, sheet([[0, 3.3, 0], [0, 2.85, 0], [0, 3.0, -0.7], [0, 3.2, -0.45]], [[0, 1, 2], [0, 2, 3]]), tint);

  shield(h, "heater", tint, o.tier >= 2 ? iron : wood, 1.05);

  return finishModel(h.root, "humanoid", h.bones, {
    ...humanSockets(h, 0.75),
    weaponTip: socketAt(h.handR, "weaponTip", 0, 3.42 + 0.55 * big, 0),
    weaponMid: socketAt(h.handR, "weaponMid", 0, 2.2, 0),
  });
}
