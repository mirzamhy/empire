// Ballista (rig "siege"): a giant crossbow on a wheeled cart with two crew. Long range, deadly to flyers.
// Tier 1 wood; 2 iron plates; 3 a dragon head on the prow.
// Bones: base (cart), wheels, turret (the bow assembly, recoils when it fires). Socket muzzle = bolt tip.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, glow, lambert, part, pivot, ring, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { crew, PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const wood = lambert(PAL.wood);
  const dark = lambert(PAL.woodDark);
  const iron = lambert(PAL.iron);
  const rope = lambert(PAL.cream);

  // cart: axle height 0.6, wheels touch y = 0
  const base = pivot(root, "base", 0, 0.6, 0);
  part(base, box(1.5, 0.22, 3.0), wood, 0, 0.1, 0);
  part(base, box(1.7, 0.14, 0.2), dark, 0, 0, 1.0);
  part(base, box(1.7, 0.14, 0.2), dark, 0, 0, -1.0);
  if (o.tier >= 2) part(base, box(1.54, 0.26, 0.5), iron, 0, 0.1, 1.3);
  const wheel = (name: string, x: number, z: number) => {
    const w = pivot(base, name, x, 0, z);
    part(w, cyl(0.6, 0.6, 0.14, 9), dark, 0, 0, 0, 0, 0, Math.PI / 2);
    part(w, cyl(0.16, 0.16, 0.2, 6), iron, 0, 0, 0, 0, 0, Math.PI / 2);
    part(w, box(0.08, 1.1, 0.1), wood, x > 0 ? 0.06 : -0.06, 0, 0);
    part(w, box(0.08, 0.1, 1.1), wood, x > 0 ? 0.06 : -0.06, 0, 0);
    return w;
  };
  const wheelFR = wheel("wheelFR", -0.92, 1.0);
  const wheelFL = wheel("wheelFL", 0.92, 1.0);
  const wheelBR = wheel("wheelBR", -0.92, -1.0);
  const wheelBL = wheel("wheelBL", 0.92, -1.0);
  // wheel covers and a banner at the back in the kingdom colour
  part(base, box(0.1, 0.5, 2.6), tint, -0.82, 0.3, 0);
  part(base, box(0.1, 0.5, 2.6), tint, 0.82, 0.3, 0);
  seg(base, dark, [0, 0.2, -1.4], [0, 3.4, -1.4], 0.05, 0.04, 4);
  part(base, sheet([[0, 3.35, -1.4], [0, 2.3, -1.4], [0, 2.5, -2.3], [0, 3.2, -2.1]], [[0, 1, 2], [0, 2, 3]]), tint);

  // support post and the bow assembly
  part(base, taperBox(0.7, 0.4, 0.9, 0.7, 0.4), wood, 0, 0.65, 0.2);
  const turret = pivot(base, "turret", 0, 1.15, 0.2, -0.12);
  part(turret, box(0.36, 0.2, 3.4), wood, 0, 0, 0.3); // stock
  part(turret, box(0.14, 0.06, 3.2), dark, 0, 0.13, 0.3); // groove
  for (const s of [-1, 1]) {
    // bow arms sweep back from the prow, string to the latch
    seg(turret, wood, [0, 0.05, 1.75], [s * 1.0, 0.05, 1.55], 0.1, 0.08, 5);
    seg(turret, wood, [s * 1.0, 0.05, 1.55], [s * 1.75, 0.05, 1.05], 0.08, 0.05, 5);
    seg(turret, rope, [s * 1.75, 0.05, 1.05], [0, 0.16, -0.7], 0.015, 0.015, 3);
    if (o.tier >= 2) part(turret, box(0.3, 0.22, 0.16), iron, s * 0.5, 0.05, 1.68, 0, -s * 0.2, 0);
  }
  // the bolt
  seg(turret, dark, [0, 0.2, -0.7], [0, 0.2, 2.2], 0.045, 0.045, 5);
  part(turret, cone(0.1, 0.4, 4), iron, 0, 0.2, 2.4, Math.PI / 2, 0, 0);
  part(turret, sheet([[0, 0.2, -0.7], [0.14, 0.2, -0.9], [0, 0.2, -0.4], [-0.14, 0.2, -0.9], [0, 0.34, -0.9]], [[0, 1, 2], [0, 2, 3], [0, 4, 2]]), rope);
  // winch
  part(turret, cyl(0.12, 0.12, 0.6, 6), iron, 0, 0.1, -1.2, 0, 0, Math.PI / 2);
  if (o.tier >= 3) {
    // dragon-head prow with glowing eyes
    part(turret, taperBox(0.4, 0.22, 0.6, 0.3, 0.18), iron, 0, 0.05, 2.0, Math.PI / 2, 0, 0);
    part(turret, cone(0.06, 0.3, 4), iron, -0.14, 0.26, 1.85, -0.6, 0, 0);
    part(turret, cone(0.06, 0.3, 4), iron, 0.14, 0.26, 1.85, -0.6, 0, 0);
    part(turret, box(0.06, 0.06, 0.08), glow(0xff7a1a), -0.17, 0.12, 2.05);
    part(turret, box(0.06, 0.06, 0.08), glow(0xff7a1a), 0.17, 0.12, 2.05);
  }

  // two crew behind the engine
  crew(base, tint, -0.75, -0.6, -2.0, 0.2, 0.8);
  crew(base, tint, 0.8, -0.6, -1.7, -0.3, 0.8);

  // ---- v2 detail layer
  const crestMat = lambert(o.crest);
  // wheels: iron tyres and hub caps
  for (const w of [wheelFR, wheelFL, wheelBR, wheelBL]) {
    const out = w.position.x > 0 ? 1 : -1;
    part(w, ring(0.6, 0.045, 8), iron, 0, 0, 0, 0, Math.PI / 2, 0);
    part(w, cone(0.1, 0.16, 6), iron, out * 0.16, 0, 0, 0, 0, -out * Math.PI / 2);
  }
  // frame: side rails and iron corner brackets
  for (const s of [-1, 1]) {
    part(base, box(0.12, 0.16, 3.1), dark, s * 0.7, 0.26, 0);
    for (const z of [-1.45, 1.45]) part(base, box(0.2, 0.3, 0.14), iron, s * 0.7, 0.14, z);
  }
  // torsion springs: rope bundles in iron caps either side of the stock
  for (const s of [-1, 1]) {
    part(turret, cyl(0.13, 0.13, 0.56, 6), rope, s * 0.42, 0.05, 1.62);
    part(turret, cyl(0.16, 0.16, 0.06, 6), iron, s * 0.42, 0.36, 1.62);
    part(turret, cyl(0.16, 0.16, 0.06, 6), iron, s * 0.42, -0.26, 1.62);
  }
  // winch: ratchet wheel, crank handles, trigger latch
  part(turret, cyl(0.2, 0.2, 0.06, 8), iron, 0.34, 0.1, -1.2, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    seg(turret, dark, [s * 0.3, 0.1, -1.2], [s * 0.5, 0.1, -1.2], 0.03, 0.03, 4);
    seg(turret, dark, [s * 0.5, 0.1, -1.2], [s * 0.5, 0.36, -1.32], 0.03, 0.03, 4);
  }
  part(turret, box(0.12, 0.14, 0.2), iron, 0, 0.2, -0.72);
  // ammunition: a rack of spare bolts and a bucket on the cart
  part(base, box(0.5, 0.4, 0.9), dark, -0.42, 0.42, -0.95);
  for (let i = 0; i < 4; i++) {
    const x = -0.58 + i * 0.11;
    seg(base, wood, [x, 0.5, -1.3], [x, 1.25, -0.75], 0.03, 0.03, 4);
    part(base, cone(0.05, 0.16, 4), iron, x, 1.31, -0.71, 0.63, 0, 0);
  }
  part(base, cyl(0.2, 0.16, 0.3, 7), wood, 0.45, 0.37, -1.05);
  // pavise: a shield board at the prow to cover the crew, painted in the kingdom colour
  part(base, taperBox(1.5, 1.3, 0.9, 0.08), wood, 0, 0.6, 1.56, 0.12, 0, 0);
  part(base, taperBox(1.3, 1.1, 0.7, 0.09), tint, 0, 0.6, 1.58, 0.12, 0, 0);
  part(base, box(0.3, 0.3, 0.1), crestMat, 0, 0.6, 1.6, 0.12, 0, Math.PI / 4);

  return finishModel(root, "siege", { base, turret, wheelFR, wheelFL, wheelBR, wheelBL }, {
    muzzle: socketAt(turret, "muzzle", 0, 0.2, 2.6),
    load: socketAt(turret, "load", 0, 0.2, -0.7),
    headTop: socketAt(base, "headTop", 0, 3.0, -1.4),
    chest: socketAt(base, "chest", 0, 0.8, 0.5),
  });
}
