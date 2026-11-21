// Kraken: the regional boss of Teluk Naga. A sea monster rising from the bay by the leading
// kingdom: a tall, ridged mantle of deep violet with teal spots that glow, two great golden eyes
// with slit pupils, barnacles and coral on its crown, and tentacles all around (two long striking
// arms in front) with pale suckers along their inner side. Only the top of it shows above the water.
//
// Own rig: body (the mantle, at the waterline) > eyeR, eyeL; body > t0..t7 (tentacle roots, around
// the body, each turned to face outward) > t{i}_0 .. t{i}_5 (segments). Segments run along +Y and
// curl on X: positive bends the tentacle toward its sucker side (+Z of the segment).
// t0 and t1 are the striking arms (front right, front left).
import * as THREE from "three";
import { box, cone, cyl, glow, ico, lambert, part, pivot, seg, socketAt, taperBox } from "../units/models/kit";
import type { BossModel } from "./titan";

/** Tentacles: angle around the body (0 = front), length of a segment, base radius. */
export const KRAKEN_ARMS: { a: number; len: number; r: number }[] = [
  { a: -0.45, len: 0.78, r: 0.34 },
  { a: 0.45, len: 0.78, r: 0.34 },
  { a: -1.25, len: 0.6, r: 0.27 },
  { a: 1.25, len: 0.6, r: 0.27 },
  { a: -2.0, len: 0.55, r: 0.25 },
  { a: 2.0, len: 0.55, r: 0.25 },
  { a: -2.7, len: 0.5, r: 0.23 },
  { a: 2.7, len: 0.5, r: 0.23 },
];
export const KRAKEN_SEGS = 6;

export function buildKraken(): BossModel {
  const root = new THREE.Group();
  const skin = lambert(0x3c2256);
  const skinDark = lambert(0x24133a);
  const skinLight = lambert(0x5d3a7c);
  const belly = lambert(0xc98aa6);
  const sucker = lambert(0xf0c4d2);
  const barnacle = lambert(0x9c958a);
  const coral = lambert(0xe0603e);
  const spot = glow(0x38f2d6);
  const eye = glow(0xffd23a);
  const glows = [spot, eye];
  const pupil = lambert(0x120a08);
  const bones: Record<string, THREE.Object3D> = {};

  // ---------------------------------------------------------------- mantle
  const body = pivot(root, "body", 0, 0, 0);
  bones.body = body;
  // the dome leans back, its ridged top rising high over the eyes
  const mantle = pivot(body, "mantle", 0, 0.6, -0.35, -0.35);
  bones.mantle = mantle;
  part(mantle, ico(1.25, 1), skin, 0, 1.25, 0).scale.set(1, 1.55, 1.05);
  part(mantle, ico(0.95, 1), skinLight, 0, 2.6, -0.1).scale.set(0.85, 1.1, 0.9);
  // ridges down the back of the mantle
  for (let i = 0; i < 5; i++) part(mantle, taperBox(0.12, 0.04, 2.2 - i * 0.15, 0.3, 0.12), skinDark, (i - 2) * 0.35, 1.7, -1.0 + Math.abs(i - 2) * 0.12, -0.35, 0, (i - 2) * 0.15);
  // glowing spots in rows over the dome
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const y = 0.9 + (i % 4) * 0.55;
    const rr = 1.15 - (i % 4) * 0.12;
    if (Math.cos(a) > 0.6 && y < 1.6) continue; // not over the eyes
    part(mantle, ico(0.07 + (i % 3) * 0.02, 0), spot, Math.sin(a) * rr, y, Math.cos(a) * rr * 1.02);
  }
  // barnacles and a clump of coral on the crown
  for (let i = 0; i < 7; i++) {
    const a = i * 1.7;
    part(mantle, cyl(0.06, 0.1, 0.1, 5), barnacle, Math.sin(a) * 0.6, 2.9 + (i % 2) * 0.3, Math.cos(a) * 0.5 - 0.2, Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
  }
  for (let i = 0; i < 4; i++) seg(mantle, coral, [0.35, 3.3, -0.3], [0.35 + Math.sin(i * 1.6) * 0.35, 3.75 + i * 0.05, -0.3 + Math.cos(i * 1.6) * 0.3], 0.05, 0.02, 4);

  // ---------------------------------------------------------------- face: eyes and the hood over them
  part(body, ico(1.05, 1), skin, 0, 0.75, 0.25).scale.set(1.15, 0.75, 1);
  for (const s of [-1, 1]) {
    const e = pivot(body, s < 0 ? "eyeR" : "eyeL", s * 0.62, 1.05, 0.82);
    bones[s < 0 ? "eyeR" : "eyeL"] = e;
    part(e, ico(0.3, 1), eye, 0, 0, 0);
    part(e, box(0.07, 0.42, 0.06), pupil, 0, 0, 0.27);
    // a heavy fold of skin above each eye
    part(body, taperBox(0.6, 0.4, 0.2, 0.35, 0.2), skinDark, s * 0.6, 1.36, 0.82, -0.45, 0, s * 0.25);
  }
  // a fringe of short feelers round the mouth below the eyes
  for (let i = 0; i < 6; i++) seg(body, belly, [(i - 2.5) * 0.22, 0.4, 1.05], [(i - 2.5) * 0.3, 0.05, 1.35], 0.06, 0.02, 4);

  // ---------------------------------------------------------------- tentacles
  KRAKEN_ARMS.forEach((t, i) => {
    const base = pivot(body, `t${i}`, Math.sin(t.a) * 1.05, 0.25, Math.cos(t.a) * 1.05, 0, t.a, 0);
    bones[`t${i}`] = base;
    let parent: THREE.Object3D = base;
    for (let j = 0; j < KRAKEN_SEGS; j++) {
      const k = 1 - j / KRAKEN_SEGS;
      const r0 = t.r * (0.35 + 0.65 * k);
      const r1 = t.r * (0.35 + 0.65 * (k - 1 / KRAKEN_SEGS));
      const s = pivot(parent, `t${i}_${j}`, 0, j === 0 ? 0 : t.len, 0);
      bones[`t${i}_${j}`] = s;
      if (j < KRAKEN_SEGS - 1) {
        part(s, cyl(Math.max(r1, 0.03), r0, t.len, 7), j % 2 ? skin : skinLight, 0, t.len / 2, 0);
        // the pale underside and a pair of suckers on it
        part(s, box(r0 * 1.1, t.len * 0.92, r0 * 0.4), belly, 0, t.len / 2, r0 * 0.68);
        for (const y of [0.3, 0.72]) part(s, cyl(r0 * 0.32, r0 * 0.36, 0.06, 6), sucker, 0, t.len * y, r0 * 0.9, Math.PI / 2, 0, 0);
        if (j % 2 === 0) part(s, ico(0.05, 0), spot, r0 * 0.75, t.len * 0.5, -r0 * 0.5);
      } else {
        part(s, cone(r0, t.len * 1.4, 6), skin, 0, t.len * 0.7, 0);
      }
      parent = s;
    }
  });

  return {
    root,
    bones,
    sockets: {
      mouth: socketAt(body, "mouth", 0, 0.3, 1.3),
      headTop: socketAt(mantle, "headTop", 0, 3.6, 0),
      tusk: socketAt(bones[`t0_${KRAKEN_SEGS - 1}`], "tusk", 0, 0.5, 0),
      offhand: socketAt(bones[`t1_${KRAKEN_SEGS - 1}`], "offhand", 0, 0.5, 0),
    },
    glows,
  };
}
