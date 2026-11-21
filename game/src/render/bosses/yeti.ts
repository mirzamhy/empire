// Raksasa Es: the regional boss of the snow (Mahkota Es). A hunched ape of the glacier, all shaggy
// white fur with blue shadows, a dark blue face with glowing ice eyes, ram horns rimed with frost,
// long fangs, a ridge of ice crystals breaking out of its back and shoulders, and fists so big they
// rest on the ground, armoured with ice. Silhouette: the crystal ridge and the long arms.
//
// Same rig as the Titan (titan.ts), so the walk, the blows and the roar are shared:
// hips > spine > head > jaw; spine > armR > armR2, armL > armL2; hips > legR > legR2, legL > legL2.
import * as THREE from "three";
import { box, cone, glow, ico, lambert, part, pivot, ring, seg, socketAt, taperBox } from "../units/models/kit";
import type { BossModel } from "./titan";

export function buildYeti(): BossModel {
  const root = new THREE.Group();
  // fur is lit a little from inside so it stays snow-white on the shaded side, not stone grey
  const furMat = (hex: number, lift: number) => new THREE.MeshLambertMaterial({ color: hex, emissive: lift, flatShading: true });
  const fur = furMat(0xe8f3ff, 0x5a6c84);
  const shade = furMat(0xc6dcf2, 0x3c5068);
  const deep = furMat(0x9cb8d6, 0x24364c);
  const skin = lambert(0x3c64a0);
  const skinDark = lambert(0x1c2e4e);
  const horn = lambert(0x8592a3);
  const hornTip = lambert(0xeef5fb);
  const ice = new THREE.MeshLambertMaterial({ color: 0x9fe4ff, emissive: 0x1d6f9a, emissiveIntensity: 0.5, flatShading: true, transparent: true, opacity: 0.92 });
  const iceCore = glow(0x6fdcff);
  const eye = glow(0xbff6ff);
  const breath = glow(0x5ac8ff);
  const fang = lambert(0xf4f1e6);
  const glows = [iceCore, eye, breath];

  /** A shaggy clump of fur: a small core with long strands hanging down and out of it. */
  const tuft = (p: THREE.Object3D, x: number, y: number, z: number, r: number, mat = fur) => {
    part(p, ico(r * 0.62, 0), mat, x, y, z);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + x * 3 + z;
      const out = 0.35 + (i % 2) * 0.25;
      part(p, cone(r * 0.34, r * (1.3 + (i % 3) * 0.25), 4), i % 3 === 2 ? shade : mat, x + Math.cos(a) * r * 0.35, y - r * 0.45, z + Math.sin(a) * r * 0.35, Math.PI + Math.sin(a) * out, 0, Math.cos(a) * out);
    }
  };
  /** An ice crystal: a long six-sided point with a bright core. */
  const crystal = (p: THREE.Object3D, x: number, y: number, z: number, h: number, r: number, rx: number, rz: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(rx, 0, rz);
    p.add(g);
    part(g, cone(r, h, 6), ice, 0, h / 2, 0);
    part(g, cone(r * 0.4, h * 0.6, 6), iceCore, 0, h * 0.35, 0);
  };

  // ---------------------------------------------------------------- hips and short, heavy legs
  const hips = pivot(root, "hips", 0, 1.35, 0);
  part(hips, ico(0.85, 1), fur, 0, 0, 0).scale.set(1.25, 0.8, 0.95);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    tuft(hips, Math.sin(a) * 0.85, -0.4, Math.cos(a) * 0.65, 0.28, i % 2 ? fur : shade);
  }
  const leg = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const l = pivot(hips, `leg${n}`, s * 0.55, -0.15, 0);
    part(l, ico(0.48, 1), fur, 0, -0.25, 0).scale.set(1, 1.2, 1);
    tuft(l, s * 0.3, -0.5, 0.05, 0.25, shade);
    const k = pivot(l, `leg${n}2`, 0, -0.62, 0.05);
    part(k, ico(0.36, 1), fur, 0, -0.18, 0).scale.set(1, 1.3, 1);
    tuft(k, 0, -0.42, 0.15, 0.24, shade);
    // a wide flat foot of dark skin with four claws
    part(k, taperBox(0.6, 0.5, 0.2, 0.85, 0.6), skinDark, 0, -0.62, 0.15);
    for (let i = -1.5; i <= 1.5; i++) part(k, cone(0.06, 0.24, 4), fang, i * 0.14, -0.66, 0.58, Math.PI / 2, 0, 0);
    return [l, k];
  };
  const [legR, legR2] = leg(-1);
  const [legL, legL2] = leg(1);

  // ---------------------------------------------------------------- torso: a mound of fur and a belly of skin
  const spine = pivot(hips, "spine", 0, 0.3, 0, 0.45);
  part(spine, ico(1.25, 1), fur, 0, 0.85, -0.25).scale.set(1.2, 1.05, 0.85);
  part(spine, ico(0.85, 1), skin, 0, 0.62, 0.75).scale.set(1, 1.05, 0.62); // the bare chest
  part(spine, box(0.08, 0.7, 0.05), skinDark, 0, 0.62, 1.28); // a line down the chest
  for (const s of [-1, 1]) part(spine, ico(0.42, 0), skin, s * 0.38, 0.98, 1.08).scale.set(1, 0.7, 0.5); // pectorals
  // shaggy fur hanging over the shoulders and the flanks
  for (let i = 0; i < 12; i++) {
    const a = -1.6 + (i / 11) * 3.2;
    tuft(spine, Math.sin(a) * 1.35, 0.35 + Math.cos(a * 0.8) * 0.4, Math.cos(a) * 0.55 - 0.1, 0.34, i % 3 ? fur : shade);
  }
  for (let i = 0; i < 6; i++) tuft(spine, (i - 2.5) * 0.4, 1.75, -0.35, 0.32, i % 2 ? fur : shade);
  // the crystal ridge: shards bursting out along the back and over the shoulders
  const shards: [number, number, number, number, number, number, number][] = [
    [0, 1.95, -0.6, 1.5, 0.22, -0.5, 0],
    [-0.45, 1.85, -0.55, 1.15, 0.18, -0.4, 0.35],
    [0.45, 1.85, -0.55, 1.2, 0.18, -0.4, -0.35],
    [-0.15, 1.5, -0.95, 0.9, 0.15, -0.9, 0.1],
    [0.2, 1.45, -1.0, 0.8, 0.14, -0.9, -0.15],
    [-1.25, 1.6, -0.1, 0.9, 0.16, -0.2, 0.8],
    [1.25, 1.6, -0.1, 0.95, 0.16, -0.2, -0.8],
    [-1.05, 1.75, 0.15, 0.6, 0.12, 0.1, 0.5],
    [1.05, 1.75, 0.15, 0.6, 0.12, 0.1, -0.5],
  ];
  for (const [x, y, z, h, r, rx, rz] of shards) crystal(spine, x, y, z, h, r, rx, rz);
  for (let i = 0; i < 5; i++) part(spine, ico(0.1, 0), ice, (i - 2) * 0.35, 1.95, -0.7);

  // ---------------------------------------------------------------- head: low between the shoulders
  const head = pivot(spine, "head", 0, 1.62, 0.95, -0.3);
  head.scale.setScalar(1.3);
  part(head, ico(0.55, 1), fur, 0, 0.14, -0.1).scale.set(1.1, 1, 1.05);
  // an ape's face of blue skin: a heavy brow, deep-set slanted eyes, a broad flat nose, a wide muzzle
  part(head, taperBox(0.66, 0.6, 0.6, 0.36, 0.26), skin, 0, 0.02, 0.3);
  part(head, taperBox(0.82, 0.76, 0.16, 0.36, 0.3), skinDark, 0, 0.27, 0.36, -0.15, 0, 0); // brow
  for (const s of [-1, 1]) {
    part(head, box(0.2, 0.12, 0.08), skinDark, s * 0.17, 0.14, 0.45, 0, 0, s * 0.25); // socket
    part(head, box(0.15, 0.05, 0.04), eye, s * 0.17, 0.14, 0.5, 0, 0, s * 0.3); // a slanted slit of ice light
    part(head, box(0.3, 0.12, 0.02), iceCore, s * 0.18, 0.15, 0.47, 0, 0, s * 0.3);
    // fur framing the face like a lion's mane, and frosted cheek tufts
    tuft(head, s * 0.48, 0.05, 0.15, 0.22);
    tuft(head, s * 0.42, 0.42, 0.0, 0.2);
    tuft(head, s * 0.36, -0.22, 0.28, 0.17, shade);
    // ram horns: back, down, round and forward; frost on the curl, ice at the tip
    const pts = [[s * 0.3, 0.36, 0.02], [s * 0.72, 0.62, -0.22], [s * 0.98, 0.3, -0.48], [s * 0.95, -0.12, -0.25], [s * 0.82, -0.12, 0.2]];
    for (let i = 0; i < pts.length - 1; i++) seg(head, i < 2 ? horn : hornTip, pts[i], pts[i + 1], 0.16 - i * 0.03, 0.13 - i * 0.03, 6);
    for (let i = 0; i < 3; i++) part(head, ring(0.15 - i * 0.025, 0.025, 6), hornTip, pts[i][0] * 0.98, pts[i][1] + 0.02, pts[i][2], 0.6, 0, s * 0.6);
    crystal(head, s * 0.82, -0.12, 0.2, 0.32, 0.05, 1.3, 0);
  }
  tuft(head, 0, 0.55, -0.12, 0.26);
  tuft(head, 0, 0.45, 0.12, 0.2);
  part(head, taperBox(0.44, 0.3, 0.26, 0.3, 0.2), skinDark, 0, -0.08, 0.5); // muzzle
  part(head, box(0.2, 0.08, 0.1), skin, 0, 0.02, 0.62); // flat nose
  for (const s of [-1, 1]) part(head, box(0.06, 0.04, 0.03), skinDark, s * 0.05, -0.01, 0.68);
  // upper fangs hanging over the lip
  for (const x of [-0.14, 0.14]) part(head, cone(0.04, 0.2, 4), fang, x, -0.22, 0.56, Math.PI, 0, 0);
  for (const x of [-0.06, 0.06]) part(head, cone(0.025, 0.08, 3), fang, x, -0.2, 0.6, Math.PI, 0, 0);
  const jaw = pivot(head, "jaw", 0, -0.2, 0.22);
  part(jaw, taperBox(0.56, 0.46, 0.18, 0.44, 0.38), skinDark, 0, -0.07, 0.18);
  part(jaw, box(0.36, 0.04, 0.28), breath, 0, 0.02, 0.2);
  for (const s of [-1, 1]) {
    seg(jaw, fang, [s * 0.19, 0.0, 0.34], [s * 0.21, 0.32, 0.4], 0.055, 0, 4); // the long lower fangs
    part(jaw, cone(0.025, 0.08, 3), fang, s * 0.08, 0.04, 0.34);
  }
  tuft(jaw, 0, -0.2, 0.22, 0.18, shade); // a frosted beard

  // ---------------------------------------------------------------- arms: long, thick, fists armoured in ice
  const arm = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const a = pivot(spine, `arm${n}`, s * 1.3, 1.25, 0.1, 0.25, 0, s * 0.15);
    part(a, ico(0.55, 1), fur, 0, -0.1, 0);
    part(a, ico(0.45, 1), fur, 0, -0.65, 0.02).scale.set(1, 1.5, 1);
    tuft(a, s * 0.3, -0.75, 0.05, 0.3, shade);
    tuft(a, -s * 0.2, -0.95, -0.15, 0.26, deep);
    const e = pivot(a, `arm${n}2`, 0, -1.15, 0.05, -0.5);
    part(e, ico(0.42, 1), fur, 0, -0.45, 0.05).scale.set(1, 1.5, 1);
    tuft(e, s * 0.25, -0.5, 0.2, 0.26, shade);
    tuft(e, 0, -0.25, -0.25, 0.24);
    // the fist: dark knuckles under a gauntlet of ice shards
    part(e, ico(0.48, 1), skinDark, 0, -1.15, 0.12).scale.set(1.1, 0.95, 1.1);
    for (let i = -1; i <= 1; i++) part(e, ico(0.15, 0), skin, i * 0.22, -1.1, 0.55);
    for (let i = 0; i < 5; i++) {
      const a2 = -1.2 + i * 0.6;
      crystal(e, Math.sin(a2) * 0.42, -0.95, Math.cos(a2) * 0.3, 0.45 + (i % 2) * 0.2, 0.09, -0.4 + Math.cos(a2) * 0.6, -Math.sin(a2) * 0.9);
    }
    return [a, e];
  };
  const [armR, armR2] = arm(-1);
  const [armL, armL2] = arm(1);

  return {
    root,
    bones: { hips, spine, head, jaw, armR, armR2, armL, armL2, legR, legR2, legL, legL2 },
    sockets: {
      mouth: socketAt(jaw, "mouth", 0, 0.05, 0.4),
      fistR: socketAt(armR2, "fistR", 0, -1.2, 0.3),
      fistL: socketAt(armL2, "fistL", 0, -1.2, 0.3),
      core: socketAt(spine, "back", 0, 1.9, -0.6),
    },
    glows,
  };
}
