// Runic Iron Golem: very wide chest, small sunken head, arms down to the knees, magma core.
// Tier 1 rough stone; 2 iron shoulder plates; 3 glowing runes and a stone crown.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, finishModel, glow, ico, lambert, part, pivot, ring, socketAt, taperBox, tintMat } from "./kit";
import { PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const stone = lambert(0x78716c);
  const dark = lambert(0x57534e);
  const iron = lambert(PAL.ironDark);
  const magma = glow(0xff5500);
  const hot = glow(0xffd25a);

  // hips and short thick legs; soles end at y = 0
  const hips = pivot(root, "hips", 0, 1.15, 0);
  part(hips, taperBox(0.9, 1.15, 0.42, 0.7, 0.8), dark, 0, 0.02, 0);
  part(hips, taperBox(0.5, 0.72, 0.6, 0.06), tint, 0, -0.2, 0.42, -0.12, 0, 0); // loin plate
  const leg = (name: string, x: number) => {
    const g = pivot(hips, name, x, -0.05, 0);
    part(g, taperBox(0.42, 0.52, 0.6, 0.5, 0.56), stone, 0, -0.3, 0);
    part(g, taperBox(0.64, 0.44, 0.5, 0.78, 0.52), dark, 0, -0.85, 0.04);
    return g;
  };
  const legR = leg("legR", -0.42);
  const legL = leg("legL", 0.42);

  // chest: a wedge twice as wide at the shoulders as at the waist
  const spine = pivot(hips, "spine", 0, 0.2, 0);
  part(spine, taperBox(1.2, 2.1, 1.35, 0.8, 1.05), stone, 0, 0.72, 0);
  part(spine, taperBox(1.6, 1.1, 0.3, 0.9, 0.6), dark, 0, 1.52, -0.05); // hump behind the head
  // magma core in a stone ring
  part(spine, ico(0.27, 0), magma, 0, 0.78, 0.44);
  part(spine, ico(0.14, 0), hot, 0, 0.78, 0.6);
  part(spine, ring(0.33, 0.08, 6), dark, 0, 0.78, 0.5);
  // runes: chevrons in the kingdom colour on the chest
  for (const s of [-1, 1]) {
    part(spine, box(0.55, 0.09, 0.05), tint, s * 0.55, 1.12, 0.52, 0, 0, s * 0.45);
    part(spine, box(0.4, 0.09, 0.05), tint, s * 0.5, 0.42, 0.44, 0.1, 0, -s * 0.45);
    if (o.tier >= 3) part(spine, box(0.3, 0.06, 0.06), hot, s * 0.62, 0.92, 0.5, 0, 0, s * 0.45);
  }

  // head: small block sunk between the shoulders, one glowing eye slit
  const head = pivot(spine, "head", 0, 1.4, 0.12);
  part(head, taperBox(0.52, 0.42, 0.46, 0.5, 0.44), dark, 0, 0.2, 0);
  part(head, box(0.32, 0.07, 0.04), hot, 0, 0.24, 0.25);
  if (o.tier >= 3) for (let i = -1; i <= 1; i++) part(head, cone(0.08, 0.3 - Math.abs(i) * 0.08, 4), stone, i * 0.16, 0.56 - Math.abs(i) * 0.04, 0);

  // arms: boulder shoulder, upper arm, big forearm, fist at knee height
  const arm = (side: -1 | 1) => {
    const s = side === -1 ? "R" : "L";
    const upper = pivot(spine, `arm${s}`, side * 1.15, 1.15, 0, 0, 0, side * 0.08);
    part(upper, ico(0.5, 0), stone, 0, 0.05, 0);
    part(upper, taperBox(0.4, 0.5, 0.8, 0.42, 0.5), dark, 0, -0.42, 0);
    part(upper, box(0.5, 0.12, 0.52), tint, 0, -0.5, 0); // rune band
    if (o.tier >= 2) {
      const p = part(upper, ico(0.56, 0), iron, side * 0.04, 0.16, 0);
      p.scale.set(1, 0.6, 1.05);
    }
    const fore = pivot(upper, `forearm${s}`, 0, -0.85, 0, -0.15);
    part(fore, taperBox(0.64, 0.42, 0.85, 0.62, 0.45), stone, 0, -0.42, 0);
    part(fore, box(0.68, 0.5, 0.68), dark, 0, -1.05, 0);
    const fist = socketAt(fore, side === -1 ? "fistR" : "fistL", 0, -1.3, 0);
    return { upper, fore, fist };
  };
  const R = arm(-1);
  const L = arm(1);

  return finishModel(
    root,
    "golem",
    { hips, spine, head, armR: R.upper, forearmR: R.fore, armL: L.upper, forearmL: L.fore, legR, legL },
    {
      headTop: socketAt(head, "headTop", 0, 0.6, 0),
      chest: socketAt(spine, "chest", 0, 0.78, 0.6),
      core: socketAt(spine, "core", 0, 0.78, 0.5),
      fistR: R.fist,
      fistL: L.fist,
    },
  );
}
