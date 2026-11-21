// Treant Purba: the regional boss of the forest maps (Pohon Purba). An ancient tree that stood up:
// a trunk of grooved dark bark split open by glowing sap, a hollow face with burning green-gold
// eyes and a gaping knot of a mouth, a crown of mossy branches and leaf clusters, mushrooms on the
// shoulders, vines hanging from the arms, branch fingers, and legs that end in sprawling roots.
// Silhouette: the wide leafy crown and the long branch arms.
//
// Same rig as the Titan (titan.ts): hips > spine > head > jaw; spine > armR > armR2, armL > armL2;
// hips > legR > legR2, legL > legL2.
import * as THREE from "three";
import { box, cone, cyl, glow, ico, lambert, part, pivot, seg, socketAt, taperBox } from "../units/models/kit";
import type { BossModel } from "./titan";

export function buildTreant(): BossModel {
  const root = new THREE.Group();
  const bark = lambert(0x4a3524);
  const barkDark = lambert(0x2c1f15);
  const barkLight = lambert(0x6b5038);
  const moss = lambert(0x4e7a2a);
  const mossDark = lambert(0x35571d);
  const leaf = lambert(0x3f8a2e);
  const leafLight = lambert(0x6fb53a);
  const leafAutumn = lambert(0xb7a13a);
  const capRed = lambert(0xb8452e);
  const capDot = lambert(0xf2e6c8);
  const sap = glow(0xc6ff5a);
  const eye = glow(0xf6ff9a);
  const core = glow(0x8cff3a);
  const glows = [sap, eye, core];

  /** A crack in the bark with sap glowing inside. */
  const crack = (p: THREE.Object3D, x: number, y: number, z: number, len: number, rz = 0, rx = 0) => part(p, box(0.06, len, 0.05), sap, x, y, z, rx, 0, rz);
  /** Grooves of bark: thin raised ridges running down a part. */
  const ridges = (p: THREE.Object3D, y: number, h: number, r: number, n: number, z0 = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      part(p, box(0.08, h, 0.1), i % 2 ? barkDark : barkLight, Math.sin(a) * r, y, z0 + Math.cos(a) * r, 0, a, 0);
    }
  };
  /** A cluster of leaves: three lumpy balls in two greens. */
  const foliage = (p: THREE.Object3D, x: number, y: number, z: number, r: number, k = 0) => {
    part(p, ico(r, 1), k % 3 === 2 ? leafAutumn : leaf, x, y, z).scale.set(1.2, 0.85, 1.1);
    part(p, ico(r * 0.7, 0), leafLight, x + r * 0.5, y + r * 0.35, z + r * 0.2);
    part(p, ico(r * 0.65, 0), mossDark, x - r * 0.55, y + r * 0.1, z - r * 0.3);
  };
  const mushroom = (p: THREE.Object3D, x: number, y: number, z: number, s: number, rz = 0) => {
    part(p, cyl(0.05 * s, 0.07 * s, 0.22 * s, 5), capDot, x, y, z, 0, 0, rz);
    part(p, cone(0.2 * s, 0.14 * s, 7), capRed, x - Math.sin(rz) * 0.12 * s, y + 0.14 * s, z, 0, 0, rz);
    part(p, box(0.04 * s, 0.02 * s, 0.04 * s), capDot, x - Math.sin(rz) * 0.12 * s + 0.06 * s, y + 0.18 * s, z + 0.05 * s, 0, 0, rz);
  };

  // ---------------------------------------------------------------- hips and root legs
  const hips = pivot(root, "hips", 0, 1.55, 0);
  part(hips, taperBox(1.25, 1.35, 0.7, 0.95, 1.0), bark, 0, 0, 0);
  ridges(hips, 0, 0.7, 0.62, 8);
  part(hips, ico(0.35, 0), moss, 0.4, -0.2, 0.45).scale.set(1.2, 0.5, 0.6);
  const leg = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const l = pivot(hips, `leg${n}`, s * 0.48, -0.25, 0);
    seg(l, bark, [0, 0, 0], [s * 0.08, -0.75, 0.05], 0.42, 0.34, 7);
    part(l, ico(0.22, 0), barkLight, s * 0.25, -0.35, 0.25); // a knot
    crack(l, -s * 0.2, -0.4, 0.28, 0.35, s * 0.2);
    const k = pivot(l, `leg${n}2`, s * 0.08, -0.8, 0.05);
    seg(k, bark, [0, 0, 0], [0, -0.55, 0], 0.34, 0.42, 7);
    part(k, ico(0.28, 0), moss, 0, -0.1, 0.25).scale.set(1, 0.6, 0.6);
    // roots spreading over the ground in place of a foot
    for (let i = 0; i < 6; i++) {
      const a = -1.6 + (i / 5) * 3.2;
      const len = i === 2 || i === 3 ? 1.0 : 0.75;
      seg(k, i % 2 ? barkDark : bark, [0, -0.5, 0], [Math.sin(a) * len, -0.78, Math.cos(a) * len * 0.9 + 0.15], 0.14, 0.03, 5);
    }
    return [l, k];
  };
  const [legR, legR2] = leg(-1);
  const [legL, legL2] = leg(1);

  // ---------------------------------------------------------------- trunk
  const spine = pivot(hips, "spine", 0, 0.3, 0, 0.18);
  part(spine, taperBox(1.3, 1.6, 2.3, 1.0, 1.15), bark, 0, 0.95, 0);
  ridges(spine, 0.95, 2.2, 0.7, 10);
  // the trunk splits open over the chest: the heart of the tree glowing inside
  part(spine, taperBox(0.4, 0.55, 1.0, 0.1), barkDark, 0, 0.9, 0.56);
  part(spine, ico(0.26, 1), core, 0, 0.92, 0.55).scale.set(0.9, 1.5, 0.5);
  crack(spine, 0.2, 0.55, 0.58, 0.6, 0.3);
  crack(spine, -0.25, 1.35, 0.6, 0.5, -0.4);
  crack(spine, 0.55, 1.1, 0.5, 0.4, 0.8);
  crack(spine, -0.6, 0.5, 0.48, 0.45, -0.6);
  // moss on the shoulders and the back, mushrooms growing out of it
  for (const s of [-1, 1]) {
    part(spine, ico(0.5, 1), moss, s * 0.78, 1.95, 0).scale.set(1.2, 0.55, 1.1);
    mushroom(spine, s * 0.95, 2.1, 0.25, 1.4, -s * 0.4);
    mushroom(spine, s * 0.7, 2.05, -0.3, 1.0, -s * 0.2);
  }
  part(spine, ico(0.45, 1), mossDark, 0, 1.2, -0.62).scale.set(1.4, 1.5, 0.4);
  mushroom(spine, -0.3, 0.7, -0.6, 1.1, 0.3);
  // the crown: big branches out of the shoulders and the back, each carrying leaf clusters
  const branches: [number[], number[], number, number][] = [
    [[0, 2.0, -0.2], [0, 3.2, -0.5], 0.22, 0.85],
    [[-0.5, 1.95, -0.1], [-1.4, 3.0, -0.4], 0.18, 0.75],
    [[0.5, 1.95, -0.1], [1.45, 2.95, -0.3], 0.18, 0.75],
    [[-0.3, 1.9, -0.4], [-0.6, 2.7, -1.3], 0.14, 0.6],
    [[0.35, 1.9, -0.4], [0.8, 2.6, -1.25], 0.14, 0.6],
    [[-0.8, 1.8, 0.1], [-1.9, 2.25, 0.3], 0.13, 0.55],
    [[0.8, 1.8, 0.1], [1.95, 2.2, 0.35], 0.13, 0.55],
  ];
  branches.forEach(([a, b, r, f], i) => {
    seg(spine, i % 2 ? bark : barkDark, a, b, r, r * 0.45, 6);
    foliage(spine, b[0], b[1] + f * 0.3, b[2], f, i);
    // a twig with a small cluster halfway along
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    seg(spine, bark, m, [m[0] * 1.6 + 0.2, m[1] + 0.4, m[2] - 0.3], r * 0.4, 0.02, 4);
    foliage(spine, m[0] * 1.6 + 0.2, m[1] + 0.5, m[2] - 0.3, f * 0.45, i + 1);
  });

  // ---------------------------------------------------------------- head: a hollow knot in the trunk
  const head = pivot(spine, "head", 0, 1.9, 0.45, -0.1);
  part(head, taperBox(0.8, 0.7, 0.75, 0.62, 0.55), bark, 0, 0.1, 0.05);
  ridges(head, 0.1, 0.7, 0.36, 6, 0.05);
  part(head, box(0.86, 0.16, 0.3), barkDark, 0, 0.32, 0.3, -0.35, 0, 0); // the heavy brow
  for (const s of [-1, 1]) {
    // deep hollows for eyes, a burning point in each, sap running from them like tears
    part(head, box(0.22, 0.16, 0.1), barkDark, s * 0.18, 0.18, 0.37);
    part(head, box(0.12, 0.08, 0.05), eye, s * 0.18, 0.18, 0.42);
    crack(head, s * 0.2, 0.0, 0.4, 0.22, s * 0.1);
    seg(head, bark, [s * 0.3, 0.35, 0.1], [s * 0.65, 0.85, -0.05], 0.08, 0.02, 5); // antler branches
    seg(head, bark, [s * 0.5, 0.65, 0.0], [s * 0.85, 0.7, 0.2], 0.04, 0.01, 4);
    foliage(head, s * 0.62, 0.92, -0.05, 0.18, s > 0 ? 1 : 2);
  }
  part(head, ico(0.07, 0), barkLight, 0, 0.12, 0.42); // a knot for a nose
  // a beard of moss and hanging roots
  for (let i = 0; i < 5; i++) seg(head, i % 2 ? mossDark : moss, [(i - 2) * 0.12, -0.25, 0.32], [(i - 2) * 0.16, -0.65 - (i % 2) * 0.15, 0.36], 0.05, 0.01, 4);
  const jaw = pivot(head, "jaw", 0, -0.12, 0.2);
  part(jaw, taperBox(0.6, 0.55, 0.22, 0.4, 0.38), bark, 0, -0.08, 0.05);
  part(jaw, box(0.36, 0.06, 0.06), sap, 0, 0.02, 0.23); // the glowing maw
  for (const x of [-0.14, 0, 0.14]) part(jaw, cone(0.04, 0.12, 3), barkLight, x, 0.06, 0.2);

  // ---------------------------------------------------------------- arms: branches with twig fingers
  const arm = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const a = pivot(spine, `arm${n}`, s * 0.95, 1.65, 0.05, 0.25, 0, s * 0.25);
    part(a, ico(0.38, 1), barkDark, 0, 0, 0);
    seg(a, bark, [0, 0, 0], [0, -1.1, 0.05], 0.3, 0.24, 6);
    part(a, ico(0.18, 0), barkLight, s * 0.2, -0.5, 0.15);
    crack(a, -s * 0.15, -0.55, 0.2, 0.4, 0.1);
    // vines hanging from the upper arm, leaves on them
    for (let i = 0; i < 3; i++) {
      const y = -0.2 - i * 0.3;
      seg(a, moss, [s * 0.25, y, -0.1], [s * 0.3, y - 0.7, -0.15], 0.03, 0.02, 4);
      part(a, ico(0.07, 0), leafLight, s * 0.3, y - 0.7, -0.15);
    }
    const e = pivot(a, `arm${n}2`, 0, -1.12, 0.05, -0.5);
    seg(e, bark, [0, 0, 0], [0, -0.95, 0.1], 0.24, 0.2, 6);
    part(e, ico(0.22, 0), moss, s * 0.1, -0.3, 0.15).scale.set(1, 0.6, 0.6);
    // the hand: a burl with five long twig fingers, the claws of the tree
    part(e, ico(0.32, 0), barkDark, 0, -1.05, 0.1);
    for (let i = 0; i < 5; i++) {
      const fa = -0.9 + i * 0.45;
      const tip = [Math.sin(fa) * 0.45, -1.75 + Math.abs(fa) * 0.2, 0.25 + Math.cos(fa) * 0.3];
      seg(e, bark, [Math.sin(fa) * 0.15, -1.15, 0.15], tip, 0.07, 0.015, 4);
    }
    foliage(e, s * 0.25, -0.5, -0.15, 0.2, 2);
    return [a, e];
  };
  const [armR, armR2] = arm(-1);
  const [armL, armL2] = arm(1);

  return {
    root,
    bones: { hips, spine, head, jaw, armR, armR2, armL, armL2, legR, legR2, legL, legL2 },
    sockets: {
      mouth: socketAt(jaw, "mouth", 0, 0.05, 0.3),
      core: socketAt(spine, "chest", 0, 0.92, 0.6),
      fistR: socketAt(armR2, "fistR", 0, -1.4, 0.3),
      fistL: socketAt(armL2, "fistL", 0, -1.4, 0.3),
    },
    glows,
  };
}
