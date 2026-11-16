// Heavy Cavalry (rig "rider"): war horse in a caparison, armoured rider with a long lance.
// Tier 1 cloth barding; 2 iron head plate (chanfron) for the horse; 3 gold hem, horse plume and lance pennant.
// The horse body is the root bone; the rider's spine, head and arms hang from it.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, ico, lambert, part, pivot, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const coat = lambert(0x5b3a22);
  const maneMat = lambert(0x2a1c12);
  const iron = lambert(PAL.iron);
  const dark = lambert(PAL.ironDark);
  const gold = lambert(PAL.gold);
  const leather = lambert(PAL.leatherDark);
  const wood = lambert(PAL.wood);

  // horse barrel, chest and rump
  const body = pivot(root, "body", 0, 1.5, 0);
  part(body, cyl(0.44, 0.47, 1.7, 7), coat, 0, 0, 0, Math.PI / 2, 0, 0);
  part(body, ico(0.5, 0), coat, 0, 0.02, 0.85);
  part(body, ico(0.53, 0), coat, 0, 0.03, -0.85);
  // caparison in the kingdom colour, saddle
  part(body, taperBox(1.06, 0.98, 0.72, 2.25, 2.1), tint, 0, -0.12, 0);
  part(body, box(1.0, 0.1, 1.5), tint, 0, 0.44, -0.1);
  if (o.tier >= 3) part(body, box(1.09, 0.08, 2.28), gold, 0, -0.46, 0);
  part(body, box(0.62, 0.14, 0.74), leather, 0, 0.52, -0.05);
  part(body, box(0.5, 0.24, 0.1), leather, 0, 0.62, -0.42);

  // four legs: pivot at the shoulder or hip, hoof sole at y = 0
  const leg = (name: string, x: number, z: number) => {
    const g = pivot(body, name, x, -0.2, z);
    part(g, cyl(0.16, 0.1, 0.72, 6), coat, 0, -0.36, 0);
    part(g, cyl(0.09, 0.075, 0.46, 5), coat, 0, -0.94, 0);
    part(g, cyl(0.1, 0.13, 0.14, 6), maneMat, 0, -1.23, 0.01);
    return g;
  };
  const legFR = leg("legFR", -0.28, 0.8);
  const legFL = leg("legFL", 0.28, 0.8);
  const legBR = leg("legBR", -0.28, -0.85);
  const legBL = leg("legBL", 0.28, -0.85);

  // neck and horse head on one bone, tilted forward
  const neck = pivot(body, "neck", 0, 0.2, 0.95, 0.6);
  part(neck, cyl(0.2, 0.33, 1.05, 6), coat, 0, 0.45, 0);
  part(neck, box(0.09, 0.95, 0.16), maneMat, 0, 0.52, -0.26);
  seg(neck, coat, [0, 0.95, 0.02], [0, 0.6, 0.66], 0.22, 0.13, 6);
  part(neck, cone(0.06, 0.18, 4), coat, -0.11, 1.16, -0.04);
  part(neck, cone(0.06, 0.18, 4), coat, 0.11, 1.16, -0.04);
  if (o.tier >= 2) seg(neck, iron, [0, 1.06, 0.1], [0, 0.72, 0.68], 0.2, 0.12, 4); // chanfron
  if (o.tier >= 3) seg(neck, tint, [0, 1.12, 0.02], [0, 1.55, -0.2], 0.09, 0, 5); // plume
  part(neck, box(0.3, 0.05, 0.05), leather, 0, 0.74, 0.5, 0.5, 0, 0); // bridle

  const tail = pivot(body, "tail", 0, 0.25, -1.3);
  seg(tail, maneMat, [0, 0, 0], [0, -0.35, -0.3], 0.1, 0.11, 5);
  seg(tail, maneMat, [0, -0.35, -0.3], [0, -1.05, -0.4], 0.11, 0.02, 5);

  // rider: legs stay on the horse, torso and above are bones
  for (const s of [-1, 1]) {
    seg(body, iron, [s * 0.3, 0.55, 0], [s * 0.55, -0.1, 0.18], 0.14, 0.1, 6);
    seg(body, dark, [s * 0.55, -0.1, 0.18], [s * 0.56, -0.62, 0.1], 0.1, 0.08, 5);
    part(body, box(0.16, 0.12, 0.36), dark, s * 0.56, -0.68, 0.2);
  }
  const spine = pivot(body, "spine", 0, 0.56, -0.05);
  part(spine, taperBox(0.56, 0.84, 0.92, 0.38, 0.46), tint, 0, 0.5, 0);
  part(spine, box(0.64, 0.09, 0.42), leather, 0, 0.1, 0);
  part(spine, box(0.2, 0.2, 0.04), lambert(o.crest), 0, 0.6, 0.225, 0, 0, Math.PI / 4);
  part(spine, cyl(0.18, 0.3, 0.14, 7), iron, 0, 1.0, 0);

  const head = pivot(spine, "head", 0, 1.04, 0);
  part(head, ico(0.24, 1), lambert(PAL.skin), 0, 0.26, 0.01);
  part(head, cyl(0.2, 0.28, 0.32, 8), iron, 0, 0.4, 0);
  part(head, box(0.36, 0.14, 0.05), iron, 0, 0.26, 0.24); // visor
  part(head, box(0.3, 0.035, 0.06), lambert(PAL.shadow), 0, 0.28, 0.25);
  seg(head, tint, [0, 0.55, 0], [0, 0.9, -0.3], 0.09, 0.02, 5);

  const arm = (side: -1 | 1, bend: number) => {
    const s = side === -1 ? "R" : "L";
    const upper = pivot(spine, `arm${s}`, side * 0.52, 0.86, 0, 0, 0, side * 0.1);
    const p = part(upper, ico(0.2, 0), iron, 0, 0.03, 0);
    p.scale.set(1, 0.8, 1);
    part(upper, cyl(0.1, 0.085, 0.5, 6), dark, 0, -0.25, 0);
    const fore = pivot(upper, `forearm${s}`, 0, -0.5, 0, -bend);
    part(fore, cyl(0.085, 0.07, 0.46, 6), iron, 0, -0.23, 0);
    part(fore, box(0.13, 0.15, 0.15), dark, 0, -0.5, 0);
    const hand = pivot(fore, side === -1 ? "weapon" : "offhand", 0, -0.5, 0);
    return { upper, fore, hand };
  };
  const R = arm(-1, 0.5);
  const L = arm(1, 0.9);

  // lance: long shaft, hand guard, iron tip
  R.hand.rotation.x = 1.05;
  seg(R.hand, wood, [0, -1.3, 0], [0, 3.5, 0], 0.055, 0.035, 5);
  part(R.hand, cone(0.2, 0.36, 6), iron, 0, 0.3, 0, Math.PI, 0, 0);
  part(R.hand, cone(0.07, 0.4, 4), iron, 0, 3.7, 0);
  if (o.tier >= 3) part(R.hand, sheet([[0, 3.4, 0], [0, 2.95, 0], [0, 3.05, -0.75], [0, 3.3, -0.5]], [[0, 1, 2], [0, 2, 3]]), tint);

  // small heater shield on the left arm
  const sh = new THREE.Group();
  sh.position.set(0.14, 0.2, 0.05);
  sh.rotation.set(0, 1.0, 0);
  L.hand.add(sh);
  part(sh, taperBox(0.6, 0.6, 0.4, 0.06), iron, 0, 0.2, 0);
  part(sh, taperBox(0.1, 0.6, 0.45, 0.06), iron, 0, -0.22, 0);
  part(sh, taperBox(0.46, 0.46, 0.32, 0.06), tint, 0, 0.2, 0.02);
  part(sh, taperBox(0.04, 0.46, 0.36, 0.06), tint, 0, -0.18, 0.02);

  return finishModel(
    root,
    "rider",
    { body, neck, tail, legFR, legFL, legBR, legBL, spine, head, armR: R.upper, forearmR: R.fore, weapon: R.hand, armL: L.upper, forearmL: L.fore, offhand: L.hand },
    {
      headTop: socketAt(head, "headTop", 0, 0.95, 0),
      chest: socketAt(spine, "chest", 0, 0.5, 0.26),
      saddle: socketAt(body, "saddle", 0, 0.6, -0.05),
      weaponTip: socketAt(R.hand, "weaponTip", 0, 3.9, 0),
      weaponMid: socketAt(R.hand, "weaponMid", 0, 2.0, 0),
    },
  );
}
