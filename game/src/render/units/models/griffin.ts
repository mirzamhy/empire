// Griffin Rider: eagle head, wings and fore talons on a lion's body, with a lancer in the saddle.
// Tier 1 bare griffin and a rider in a cloth tunic; 2 iron chanfron, chest plate and a helm plume;
// 3 gold crest, gilded beak and talons, and a pennant on the lance.
//
// Uses the "dragon" rig so it shares the wing beat: wingR/wingL flap on Z (wings are built flat
// along X), wing*2 are the primaries, neck1 pitches on X, legR/legL are the lion hind legs (tucked
// by the fly clip), legFR/legFL the eagle fore legs (they strike in the attack clip), tail1/tail2
// sway. The rider is spine + armR + weapon. The kingdom colour is on the wing coverts so a griffin
// reads from the overview camera, plus the saddle cloth and the rider's tunic.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, ico, lambert, part, pivot, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const tan = lambert(0xc08a4a); // lion hide
  const brown = lambert(0x7a5230); // dark feathers
  const white = lambert(0xf2ede0); // head and neck feathers
  const cream = lambert(0xe4d6b4); // primaries
  const beak = lambert(o.tier >= 3 ? PAL.gold : 0xe0a030);
  const claw = lambert(o.tier >= 3 ? PAL.goldDark : 0x3a3028);
  const iron = lambert(PAL.iron);
  const dark = lambert(PAL.leatherDark);
  const leather = lambert(PAL.leather);
  const eye = glow(0xffb020);

  // body: feathered chest in front, lion barrel and haunch behind
  const body = pivot(root, "body", 0, 1.35, 0);
  part(body, ico(0.6, 1), tan, 0, 0, -0.05).scale.set(0.88, 0.82, 1.45);
  part(body, ico(0.58, 1), brown, 0, 0.06, 0.52).scale.set(0.95, 0.98, 1.0);
  part(body, ico(0.5, 0), tan, 0, 0, -0.62).scale.set(0.95, 0.9, 1.0);
  // saddle cloth (kingdom colour) with side flaps, saddle on top
  part(body, box(0.98, 0.07, 0.78), tint, 0, 0.5, -0.08);
  for (const s of [-1, 1]) part(body, box(0.06, 0.46, 0.66), tint, s * 0.5, 0.26, -0.08, 0, 0, s * 0.12);
  part(body, box(0.46, 0.13, 0.52), leather, 0, 0.58, -0.08);
  if (o.tier >= 2) {
    // peytral: iron plate across the chest with a strap
    part(body, taperBox(0.78, 0.9, 0.5, 0.1), iron, 0, -0.02, 1.02, -0.2, 0, 0);
    part(body, box(1.08, 0.08, 0.1), dark, 0, 0.2, 0.62);
  }

  // neck and head: white ruff, hooked beak, ear tufts
  const neck1 = pivot(body, "neck1", 0, 0.32, 0.9, -0.75);
  seg(neck1, white, [0, 0, 0], [0, 0, 0.72], 0.38, 0.27, 6);
  part(neck1, cone(0.46, 0.42, 7), white, 0, 0, 0.12, -Math.PI / 2, 0, 0);
  const head = pivot(neck1, "head", 0, 0, 0.72, 0.62);
  part(head, ico(0.3, 1), white, 0, 0.03, 0.14).scale.set(0.9, 0.9, 1.12);
  part(head, cone(0.17, 0.5, 4), beak, 0, -0.03, 0.62, Math.PI / 2, Math.PI / 4, 0);
  part(head, cone(0.07, 0.22, 4), beak, 0, -0.15, 0.83, Math.PI * 0.82, 0, 0);
  part(head, box(0.16, 0.06, 0.3), claw, 0, -0.16, 0.5);
  for (const s of [-1, 1]) {
    part(head, box(0.05, 0.08, 0.11), eye, s * 0.25, 0.08, 0.3);
    part(head, box(0.1, 0.06, 0.24), brown, s * 0.22, 0.17, 0.3, 0, 0, s * 0.35);
    seg(head, o.tier >= 3 ? beak : cream, [s * 0.16, 0.22, 0.0], [s * 0.25, 0.56, -0.3], 0.07, 0, 4);
  }
  if (o.tier >= 2) part(head, taperBox(0.3, 0.38, 0.42, 0.05), iron, 0, 0.3, 0.22, Math.PI / 2 - 0.15, 0, 0); // chanfron
  if (o.tier >= 3) for (let i = 0; i < 3; i++) part(head, cone(0.05, 0.24 - i * 0.04, 4), beak, 0, 0.4 - i * 0.03, 0.2 - i * 0.2, -0.4, 0, 0);

  // wings: inner bone carries the secondaries and the coverts, outer bone the primaries
  const wing = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const w = pivot(body, `wing${n}`, s * 0.48, 0.42, 0.28, 0, 0, s * 0.12);
    const wrist = [s * 1.3, 0.08, 0.12];
    seg(w, brown, [0, 0, 0], wrist, 0.13, 0.08, 5);
    part(w, sheet([[0, 0, 0], wrist, [s * 1.32, 0, -1.2], [s * 0.65, 0, -1.02], [0, 0, -1.0]], [[0, 1, 3], [1, 2, 3], [0, 3, 4]]), brown);
    part(w, sheet([[0, 0.03, 0.02], [wrist[0], 0.11, 0.12], [s * 1.3, 0.04, -0.52], [0, 0.04, -0.46]], [[0, 1, 2], [0, 2, 3]]), tint);
    const w2 = pivot(w, `wing${n}2`, wrist[0], wrist[1], wrist[2]);
    const tips = [[s * 1.55, 0, 0.22], [s * 1.5, 0, -0.5], [s * 1.1, 0, -1.05], [s * 0.45, 0, -1.3], [0, -0.06, -1.3]];
    const pts: number[][] = [[0, 0, 0]];
    const faces: number[][] = [];
    tips.forEach((t, i) => {
      if (i < 4) seg(w2, brown, [0, 0, 0], t, 0.05, 0.012, 4);
      pts.push(t);
      const b = tips[i + 1];
      if (b) {
        // feather tips with a notch between them
        pts.push([(t[0] + b[0]) * 0.44, (t[1] + b[1]) * 0.44, (t[2] + b[2]) * 0.44]);
        faces.push([0, 1 + 2 * i, 2 + 2 * i], [0, 2 + 2 * i, 3 + 2 * i]);
      }
    });
    part(w2, sheet(pts, faces), cream);
    part(w2, sheet([[0, 0.03, 0.02], [s * 1.0, 0.03, 0.14], [s * 0.95, 0.03, -0.36], [0, 0.03, -0.42]], [[0, 1, 2], [0, 2, 3]]), tint);
    return [w, w2];
  };
  const [wingR, wingR2] = wing(-1);
  const [wingL, wingL2] = wing(1);

  // fore legs: feathered thigh, scaly shin, three talons forward and one back
  const fore = (name: string, x: number) => {
    const g = pivot(body, name, x, -0.3, 0.62);
    part(g, ico(0.26, 0), brown, 0, -0.1, 0).scale.set(0.8, 1.25, 0.9);
    seg(g, beak, [0, -0.3, 0.04], [0, -0.92, 0.12], 0.09, 0.06, 5);
    part(g, box(0.18, 0.07, 0.2), beak, 0, -0.98, 0.16);
    for (let i = -1; i <= 1; i++) part(g, cone(0.04, 0.22, 4), claw, i * 0.08, -1.0, 0.36, Math.PI / 2 + 0.25, 0, 0);
    part(g, cone(0.04, 0.16, 4), claw, 0, -1.0, 0.02, -Math.PI / 2 - 0.25, 0, 0);
    return g;
  };
  const legFR = fore("legFR", -0.36);
  const legFL = fore("legFL", 0.36);
  // hind legs: lion haunch, shin and paw
  const hind = (name: string, x: number) => {
    const g = pivot(body, name, x, -0.3, -0.72);
    part(g, ico(0.34, 0), tan, 0, -0.08, 0).scale.set(0.8, 1.15, 1.0);
    seg(g, tan, [0, -0.3, -0.02], [0, -0.92, 0.1], 0.13, 0.09, 5);
    part(g, box(0.24, 0.12, 0.34), tan, 0, -0.99, 0.18);
    return g;
  };
  const legR = hind("legR", -0.4);
  const legL = hind("legL", 0.4);

  // lion tail with a dark tuft
  const tail1 = pivot(body, "tail1", 0, 0.1, -1.05, -0.3);
  seg(tail1, tan, [0, 0, 0], [0, 0, -0.7], 0.1, 0.07, 5);
  const tail2 = pivot(tail1, "tail2", 0, 0, -0.7, 0.45);
  seg(tail2, tan, [0, 0, 0], [0, 0, -0.6], 0.07, 0.05, 5);
  part(tail2, ico(0.14, 0), brown, 0, 0, -0.72).scale.set(0.8, 0.8, 1.5);

  // rider: legs stay on the griffin; torso, lance arm and lance are bones
  for (const s of [-1, 1]) {
    seg(body, dark, [s * 0.22, 0.62, -0.05], [s * 0.5, 0.12, 0.14], 0.11, 0.08, 5);
    part(body, box(0.13, 0.1, 0.28), dark, s * 0.5, 0.06, 0.2);
  }
  const spine = pivot(body, "spine", 0, 0.64, -0.08);
  part(spine, taperBox(0.44, 0.64, 0.7, 0.3, 0.36), tint, 0, 0.38, 0);
  part(spine, box(0.5, 0.07, 0.34), leather, 0, 0.1, 0);
  part(spine, box(0.15, 0.15, 0.04), lambert(o.crest), 0, 0.46, 0.18, 0, 0, Math.PI / 4);
  part(spine, ico(0.19, 1), lambert(PAL.skin), 0, 0.92, 0.01);
  part(spine, cyl(0.15, 0.22, 0.26, 7), o.tier >= 2 ? iron : leather, 0, 1.03, 0);
  if (o.tier >= 2) seg(spine, tint, [0, 1.14, 0], [0, 1.42, -0.26], 0.07, 0.015, 5);
  // left arm holds the reins (not a bone)
  seg(spine, dark, [0.36, 0.66, 0], [0.26, 0.3, 0.3], 0.08, 0.07, 5);
  seg(spine, leather, [0.26, 0.3, 0.3], [0.0, 0.02, 0.9], 0.015, 0.015, 3);
  const armR = pivot(spine, "armR", -0.38, 0.66, 0, 0, 0, -0.1);
  part(armR, ico(0.13, 0), o.tier >= 2 ? iron : dark, 0, 0.02, 0);
  part(armR, cyl(0.08, 0.07, 0.42, 6), dark, 0, -0.21, 0);
  const weapon = pivot(armR, "weapon", 0, -0.42, 0, 1.25);
  seg(weapon, lambert(PAL.wood), [0, -0.8, 0], [0, 2.2, 0], 0.045, 0.03, 5);
  part(weapon, cone(0.07, 0.34, 4), iron, 0, 2.36, 0);
  if (o.tier >= 3) part(weapon, sheet([[0, 2.15, 0], [0, 1.8, 0], [0, 1.88, -0.6], [0, 2.08, -0.4]], [[0, 1, 2], [0, 2, 3]]), tint);

  return finishModel(
    root,
    "dragon",
    { body, neck1, head, wingR, wingR2, wingL, wingL2, legFR, legFL, legR, legL, tail1, tail2, spine, armR, weapon },
    {
      mouth: socketAt(head, "mouth", 0, -0.06, 0.86),
      chest: socketAt(body, "chest", 0, 0, 1.08),
      headTop: socketAt(spine, "headTop", 0, 1.25, 0),
      saddle: socketAt(body, "saddle", 0, 0.62, -0.08),
      weaponTip: socketAt(weapon, "weaponTip", 0, 2.5, 0),
      weaponMid: socketAt(weapon, "weaponMid", 0, 1.3, 0),
    },
  );
}
