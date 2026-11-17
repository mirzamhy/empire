// Trebuchet (rig "siege"): tall A-frame, long throwing arm with a counterweight and sling, three crew.
// Devastating against castles, weak against units, cannot hit targets that are close.
// Tier 1 wood; 2 iron bands; 3 gold banner finial and a bigger counterweight.
// Bones: base, wheels, arm (pivot at the axle; +X rotation swings the long end up and over).
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cyl, finishModel, ico, lambert, part, pivot, ring, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { crew, PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const wood = lambert(PAL.wood);
  const dark = lambert(PAL.woodDark);
  const iron = lambert(PAL.iron);
  const rope = lambert(PAL.cream);

  // frame on four wheels
  const base = pivot(root, "base", 0, 0.5, 0);
  part(base, box(0.24, 0.24, 4.4), wood, -1.0, 0.1, 0);
  part(base, box(0.24, 0.24, 4.4), wood, 1.0, 0.1, 0);
  part(base, box(2.3, 0.2, 0.24), dark, 0, 0.1, 1.9);
  part(base, box(2.3, 0.2, 0.24), dark, 0, 0.1, -1.9);
  part(base, box(2.3, 0.2, 0.24), dark, 0, 0.1, 0);
  const wheel = (name: string, x: number, z: number) => {
    const w = pivot(base, name, x, 0, z);
    part(w, cyl(0.5, 0.5, 0.14, 8), dark, 0, 0, 0, 0, 0, Math.PI / 2);
    part(w, cyl(0.14, 0.14, 0.2, 6), iron, 0, 0, 0, 0, 0, Math.PI / 2);
    return w;
  };
  const wheelFR = wheel("wheelFR", -1.22, 1.6);
  const wheelFL = wheel("wheelFL", 1.22, 1.6);
  const wheelBR = wheel("wheelBR", -1.22, -1.6);
  const wheelBL = wheel("wheelBL", 1.22, -1.6);

  // A-frames on both sides meeting at the axle, 4.2 above the frame
  const AX = 4.2;
  for (const s of [-1, 1]) {
    seg(base, wood, [s * 1.0, 0.2, 1.5], [s * 0.55, AX, 0], 0.13, 0.1, 5);
    seg(base, wood, [s * 1.0, 0.2, -1.5], [s * 0.55, AX, 0], 0.13, 0.1, 5);
    seg(base, dark, [s * 0.85, 1.6, 0.95], [s * 0.85, 1.6, -0.95], 0.07, 0.07, 4);
    if (o.tier >= 2) part(base, box(0.3, 0.3, 0.3), iron, s * 0.55, AX, 0);
  }
  part(base, cyl(0.1, 0.1, 1.5, 6), iron, 0, AX, 0, 0, 0, Math.PI / 2);
  // banner on top
  seg(base, dark, [0.55, AX, 0], [0.55, AX + 1.6, 0], 0.045, 0.035, 4);
  part(base, sheet([[0.55, AX + 1.55, 0], [0.55, AX + 0.75, 0], [0.55, AX + 0.95, -0.95], [0.55, AX + 1.45, -0.75]], [[0, 1, 2], [0, 2, 3]]), tint);
  if (o.tier >= 3) part(base, ico(0.1, 0), lambert(PAL.gold), 0.55, AX + 1.68, 0);
  // winch at the back
  part(base, cyl(0.16, 0.16, 1.7, 6), dark, 0, 0.5, -1.7, 0, 0, Math.PI / 2);

  // throwing arm: long end back and down at rest, counterweight in front
  const arm = pivot(base, "arm", 0, AX, 0, -0.62);
  seg(arm, wood, [0, 0, 1.25], [0, 0, -4.3], 0.16, 0.08, 5);
  if (o.tier >= 2) for (const z of [0.6, -1.2, -3.0]) part(arm, box(0.3, 0.3, 0.12), iron, 0, 0, z);
  const cw = o.tier >= 3 ? 1.2 : 1;
  part(arm, box(0.9 * cw, 0.9 * cw, 0.9 * cw), dark, 0, -0.6 * cw, 1.25);
  part(arm, box(0.96 * cw, 0.34, 0.96 * cw), tint, 0, -0.6 * cw, 1.25); // cloth band on the weight
  // sling with the stone
  const sling = pivot(arm, "sling", 0, 0, -4.3);
  seg(sling, rope, [0, 0, 0], [0, -1.1, 0.5], 0.02, 0.02, 3);
  part(sling, taperBox(0.5, 0.6, 0.12, 0.5, 0.6), dark, 0, -1.2, 0.5);
  part(sling, ico(0.3, 0), lambert(0x8d8a83), 0, -1.0, 0.5);

  // three crew around the engine
  crew(base, tint, -1.8, -0.5, -1.4, 0.6, 0.85);
  crew(base, tint, 1.8, -0.5, -1.0, -0.6, 0.85);
  crew(base, tint, 0, -0.5, -2.9, 0, 0.85);

  // ---- v2 detail layer
  const stoneMat = lambert(0x8d8a83);
  // wheels: iron tyres and spokes
  for (const w of [wheelFR, wheelFL, wheelBR, wheelBL]) {
    const sx = w.position.x > 0 ? 0.08 : -0.08;
    part(w, ring(0.5, 0.04, 8), iron, 0, 0, 0, 0, Math.PI / 2, 0);
    part(w, box(0.06, 0.92, 0.09), wood, sx, 0, 0);
    part(w, box(0.06, 0.09, 0.92), wood, sx, 0, 0);
  }
  // A-frames: cross braces, iron shoes at the feet, rungs up both sides
  for (const s of [-1, 1]) {
    seg(base, dark, [s * 0.93, 0.9, 1.25], [s * 0.72, 2.8, -0.5], 0.05, 0.05, 4);
    seg(base, dark, [s * 0.93, 0.9, -1.25], [s * 0.72, 2.8, 0.5], 0.05, 0.05, 4);
    for (const z of [-1.5, 1.5]) part(base, box(0.34, 0.2, 0.34), iron, s * 1.0, 0.26, z);
    for (const y of [2.3, 2.9, 3.4]) {
      const t = (y - 0.2) / (AX - 0.2);
      part(base, box(0.06, 0.06, 3.0 * (1 - t)), wood, s * (1.0 - 0.45 * t), y, 0);
    }
  }
  // deck planks between the rails
  for (const z of [-1.0, -0.5, 0.6, 1.2]) part(base, box(1.8, 0.08, 0.36), wood, 0, 0.24, z);
  // counterweight: iron straps and hangers
  part(arm, box(0.98 * cw, 0.94 * cw, 0.12), iron, 0, -0.6 * cw, 1.25);
  part(arm, box(0.12, 0.94 * cw, 0.98 * cw), iron, 0, -0.6 * cw, 1.25);
  for (const s of [-1, 1]) part(arm, box(0.08, 0.4, 0.14), iron, s * 0.3, -0.1, 1.25);
  // winch: crank handles and wound rope; a pile of stones and a basket on the deck
  for (const s of [-1, 1]) {
    seg(base, wood, [s * 0.85, 0.5, -1.7], [s * 1.15, 0.5, -1.7], 0.04, 0.04, 4);
    seg(base, wood, [s * 1.15, 0.2, -1.7], [s * 1.15, 0.8, -1.7], 0.035, 0.035, 4);
  }
  part(base, cyl(0.19, 0.19, 0.5, 6), rope, 0, 0.5, -1.7, 0, 0, Math.PI / 2);
  for (const [x, y, z, r] of [[-0.5, 0.42, -0.9, 0.26], [-0.1, 0.42, -0.8, 0.24], [-0.3, 0.44, -0.5, 0.25], [-0.3, 0.8, -0.75, 0.22]]) part(base, ico(r, 0), stoneMat, x, y, z);
  part(base, cyl(0.34, 0.26, 0.3, 7), wood, 0.5, 0.43, -0.7);
  // sling: the second and third cords
  seg(sling, rope, [0, 0, 0], [0.22, -1.15, 0.5], 0.02, 0.02, 3);
  seg(sling, rope, [0, 0, 0], [-0.22, -1.15, 0.5], 0.02, 0.02, 3);

  return finishModel(root, "siege", { base, arm, sling, wheelFR, wheelFL, wheelBR, wheelBL }, {
    muzzle: socketAt(sling, "muzzle", 0, -1.0, 0.5),
    load: socketAt(sling, "load", 0, -1.0, 0.5),
    headTop: socketAt(base, "headTop", 0, AX + 1.7, 0),
    chest: socketAt(base, "chest", 0, 1.5, 0),
  });
}
