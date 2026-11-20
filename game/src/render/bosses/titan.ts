// Titan Neraka: the boss of the like milestones. A hunched giant of black basalt held together by
// magma, as tall as a castle tower. Silhouette: a small horned skull sunk between huge shoulders,
// a fan of burning rock spires on the back, one stone fist and a monolith club on broken chains.
//
// Rig (own, not a unit rig): hips > spine > head > jaw; spine > armR > armR2 (club), armL > armL2
// (fist); hips > legR > legR2, legL > legL2. Faces +Z, feet at y = 0, about 4.4 units tall.
// Animation lives in bosses.ts: legs swing on X, arms raise on X (negative = up and forward).
import * as THREE from "three";
import { box, cone, cyl, glow, ico, lambert, part, pivot, ring, seg, socketAt, taperBox } from "../units/models/kit";

export interface BossModel {
  root: THREE.Group;
  bones: Record<string, THREE.Object3D>;
  sockets: Record<string, THREE.Object3D>;
  /** self-lit materials whose brightness the animator pulses */
  glows: THREE.MeshBasicMaterial[];
}

export function buildTitan(): BossModel {
  const root = new THREE.Group();
  const basalt = lambert(0x2d2a2f);
  const dark = lambert(0x18161a);
  const rock = lambert(0x48413f);
  const ash = lambert(0x6b625b);
  const bone = lambert(0xd8ccb2);
  const boneDark = lambert(0x8a7d68);
  const iron = lambert(0x3a3d44);
  const rust = lambert(0x6a3a22);
  const magma = glow(0xff5a14);
  const core = glow(0xffb040);
  const eye = glow(0xffe08a);
  const ember = glow(0xff2a10);
  const glows = [magma, core, eye, ember];

  /** A glowing seam: a thin bright bar laid on a surface. */
  const seam = (parent: THREE.Object3D, x: number, y: number, z: number, len: number, rz = 0, rx = 0, w = 0.05) =>
    part(parent, box(w, len, w * 0.8), magma, x, y, z, rx, 0, rz);

  // ---------------------------------------------------------------- hips and legs
  const hips = pivot(root, "hips", 0, 1.62, 0);
  part(hips, taperBox(1.15, 1.35, 0.5, 0.75, 0.85), basalt, 0, 0.05, 0);
  // a belt of iron with a skull buckle, a skirt of hanging stone slabs
  part(hips, cyl(0.72, 0.7, 0.16, 8), iron, 0, 0.22, 0).scale.set(1, 1, 0.68);
  part(hips, ico(0.16, 0), bone, 0, 0.22, 0.52).scale.set(1, 1.1, 0.8);
  for (const s of [-1, 1]) part(hips, box(0.05, 0.05, 0.05), ember, s * 0.06, 0.25, 0.64);
  for (let i = 0; i < 7; i++) {
    const a = -1.3 + i * 0.43;
    const slab = part(hips, taperBox(0.26, 0.3, 0.55, 0.08), i % 2 ? rock : basalt, Math.sin(a) * 0.68, -0.2, Math.cos(a) * 0.5, 0.15, a, 0);
    slab.rotation.order = "YXZ";
  }
  seam(hips, 0, 0.0, 0.5, 0.36, 0, 0.1);

  const leg = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const l = pivot(hips, `leg${n}`, s * 0.5, -0.05, 0);
    part(l, ico(0.42, 1), basalt, 0, -0.1, 0).scale.set(1, 1.15, 1);
    seg(l, basalt, [0, -0.1, 0], [0, -0.82, 0.06], 0.36, 0.28, 7);
    part(l, ico(0.26, 0), rock, s * 0.18, -0.4, 0.2);
    seam(l, s * 0.2, -0.5, 0.18, 0.4, s * 0.2);
    const k = pivot(l, `leg${n}2`, 0, -0.86, 0.06);
    part(k, ico(0.3, 0), rock, 0, 0, 0.12); // knee boulder
    part(k, cone(0.09, 0.32, 4), bone, 0, 0.05, 0.36, Math.PI / 2, 0, 0); // knee spike
    seg(k, basalt, [0, 0, 0], [0, -0.6, -0.02], 0.27, 0.33, 7);
    seam(k, -s * 0.15, -0.3, 0.2, 0.35, -s * 0.15);
    // a heavy foot of stacked slabs with three bone claws
    part(k, taperBox(0.62, 0.5, 0.24, 0.85, 0.6), dark, 0, -0.66, 0.14);
    for (let i = -1; i <= 1; i++) part(k, cone(0.07, 0.3, 4), bone, i * 0.18, -0.72, 0.6, Math.PI / 2, 0, 0);
    // a broken shackle on the ankle
    part(k, ring(0.32, 0.05, 8), iron, 0, -0.48, 0, Math.PI / 2, 0, 0);
    seg(k, iron, [s * 0.3, -0.5, 0], [s * 0.42, -0.62, -0.15], 0.04, 0.04, 4);
    return [l, k];
  };
  const [legR, legR2] = leg(-1);
  const [legL, legL2] = leg(1);

  // ---------------------------------------------------------------- torso
  // hunched forward: the spine leans, the head hangs low between the shoulders
  const spine = pivot(hips, "spine", 0, 0.28, 0, 0.32);
  part(spine, taperBox(1.3, 2.2, 1.35, 0.9, 1.15), basalt, 0, 0.72, 0);
  // the chest is a cage of rock ribs around a molten core
  part(spine, ico(0.42, 1), core, 0, 0.78, 0.4);
  part(spine, ico(0.58, 1), magma, 0, 0.78, 0.28).scale.set(1, 1, 0.6);
  for (let i = 0; i < 4; i++) {
    const y = 0.42 + i * 0.24;
    const w = 0.55 + i * 0.12;
    for (const s of [-1, 1]) seg(spine, i % 2 ? rock : basalt, [s * 0.08, y, 0.7], [s * w, y + 0.06, 0.45], 0.09, 0.07, 5);
  }
  part(spine, box(0.16, 1.0, 0.16), rock, 0, 0.78, 0.68); // sternum
  // plates of armour-like rock on the belly and the flanks, seams glowing between them
  for (const s of [-1, 1]) {
    part(spine, taperBox(0.55, 0.7, 0.9, 0.45), rock, s * 0.82, 0.62, 0.1, 0, 0, s * 0.12);
    seam(spine, s * 0.55, 0.62, 0.52, 0.8, s * 0.1);
    seam(spine, s * 1.05, 0.9, 0.2, 0.6, s * 0.5);
  }
  part(spine, taperBox(0.95, 1.1, 0.35, 0.55), rock, 0, 0.12, 0.25);
  // the back: a hump of slabs and a fan of burning spires
  part(spine, ico(0.75, 1), basalt, 0, 1.15, -0.45).scale.set(1.5, 0.9, 0.9);
  const spires = [
    [0, 1.6, -0.55, 1.5, 0.3, 0],
    [-0.55, 1.5, -0.5, 1.15, 0.25, 0.35],
    [0.55, 1.5, -0.5, 1.15, 0.25, -0.35],
    [-1.0, 1.25, -0.4, 0.85, 0.2, 0.75],
    [1.0, 1.25, -0.4, 0.85, 0.2, -0.75],
    [-0.3, 1.05, -0.85, 0.7, 0.18, 0.2],
    [0.3, 1.05, -0.85, 0.7, 0.18, -0.2],
  ];
  for (const [x, y, z, h, r, tilt] of spires) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.set(-0.45, 0, tilt);
    spine.add(g);
    part(g, cone(r, h, 5), basalt, 0, h / 2, 0);
    part(g, cone(r * 0.55, h * 0.35, 5), magma, 0, h * 0.86, 0);
    part(g, cone(r * 1.15, 0.2, 5), rock, 0, 0.1, 0);
  }
  // shoulders: boulders crowned with bone spikes
  for (const s of [-1, 1]) {
    part(spine, ico(0.6, 1), rock, s * 1.12, 1.25, 0).scale.set(1.1, 0.85, 1);
    for (let i = 0; i < 3; i++) part(spine, cone(0.1, 0.5 - i * 0.08, 4), bone, s * (1.0 + i * 0.22), 1.68 - i * 0.07, 0.05 - i * 0.12, -0.3, 0, -s * (0.35 + i * 0.25));
    seam(spine, s * 1.12, 1.25, 0.58, 0.45, s * 0.6);
  }
  // chains wrapped across the chest from an old binding
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    part(spine, ring(0.09, 0.025, 6), iron, -0.95 + t * 1.9, 1.15 - t * 0.75 + Math.sin(t * Math.PI) * 0.1, 0.72 - Math.sin(t * Math.PI) * 0.05, 0, i % 2 ? Math.PI / 2 : 0, 0.5);
  }

  // ---------------------------------------------------------------- head
  const head = pivot(spine, "head", 0, 1.38, 0.55, -0.25);
  part(head, taperBox(0.62, 0.52, 0.5, 0.6, 0.5), dark, 0, 0.08, 0.05);
  part(head, box(0.74, 0.14, 0.26), basalt, 0, 0.26, 0.26, -0.25, 0, 0); // heavy brow
  // three eyes in a row, the middle one higher, glowing under the brow
  for (const [x, y] of [[-0.19, 0.11], [0.19, 0.11], [0, 0.21]]) {
    part(head, box(0.15, 0.09, 0.05), eye, x, y, 0.33);
    part(head, box(0.26, 0.15, 0.02), ember, x, y, 0.31);
  }
  // a burning glare that shows from far away
  part(head, box(0.62, 0.05, 0.02), ember, 0, 0.17, 0.315);
  part(head, taperBox(0.36, 0.3, 0.2, 0.16), basalt, 0, -0.05, 0.36); // snout
  for (const s of [-1, 1]) part(head, box(0.05, 0.08, 0.04), dark, s * 0.07, -0.05, 0.45);
  // great horns sweeping forward like a bull's, then up; a crown of small horns behind them
  for (const s of [-1, 1]) {
    const a = [s * 0.3, 0.2, 0];
    const b = [s * 0.75, 0.32, 0.05];
    const c = [s * 1.0, 0.62, 0.35];
    const d = [s * 0.95, 0.98, 0.62];
    seg(head, bone, a, b, 0.15, 0.12, 6);
    seg(head, bone, b, c, 0.12, 0.08, 6);
    seg(head, boneDark, c, d, 0.08, 0, 5);
    for (const t of [0.3, 0.6]) part(head, ring(0.13 - t * 0.06, 0.02, 6), iron, a[0] + (b[0] - a[0]) * t * 2, 0.24 + t * 0.1, 0.02, 0, Math.PI / 2, s * 0.3);
    for (let i = 0; i < 3; i++) seg(head, boneDark, [s * (0.08 + i * 0.1), 0.3, -0.12], [s * (0.12 + i * 0.16), 0.62 - i * 0.07, -0.32], 0.05, 0, 4);
  }
  // jaw: hinged under the skull, tusks up, a furnace for a throat
  const jaw = pivot(head, "jaw", 0, -0.14, 0.05);
  part(jaw, taperBox(0.5, 0.4, 0.16, 0.42, 0.36), basalt, 0, -0.08, 0.18);
  part(jaw, box(0.3, 0.03, 0.3), core, 0, 0.0, 0.2);
  for (const s of [-1, 1]) {
    seg(jaw, bone, [s * 0.18, -0.02, 0.32], [s * 0.26, 0.24, 0.44], 0.05, 0, 4);
    for (const z of [0.15, 0.27]) part(jaw, cone(0.025, 0.08, 3), bone, s * 0.1, 0.03, z);
  }
  for (const x of [-0.12, 0, 0.12]) part(head, cone(0.025, 0.09, 3), bone, x, -0.15, 0.36, Math.PI, 0, 0);

  // ---------------------------------------------------------------- arms
  const arm = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const a = pivot(spine, `arm${n}`, s * 1.18, 1.1, 0.05, 0.25, 0, s * 0.18);
    seg(a, basalt, [0, 0, 0], [0, -1.0, 0.05], 0.34, 0.28, 7);
    part(a, ico(0.28, 0), rock, s * 0.15, -0.45, 0.12);
    seam(a, s * 0.22, -0.55, -0.1, 0.5, 0.1 * s);
    const e = pivot(a, `arm${n}2`, 0, -1.02, 0.05, -0.5);
    part(e, ico(0.28, 0), rock, 0, 0, -0.05); // elbow
    part(e, cone(0.08, 0.38, 4), bone, 0, 0.05, -0.3, -Math.PI / 2 - 0.3, 0, 0); // elbow spike
    seg(e, basalt, [0, 0, 0], [0, -0.95, 0.1], 0.3, 0.36, 7);
    seam(e, -s * 0.2, -0.5, 0.2, 0.45, -s * 0.2);
    // broken shackle on the wrist, a short length of chain still hanging from it
    part(e, ring(0.38, 0.06, 8), iron, 0, -0.75, 0.08, Math.PI / 2, 0, 0);
    for (let i = 0; i < 4; i++) part(e, ring(0.07, 0.022, 6), iron, s * 0.36, -0.82 - i * 0.12, 0.08, 0, i % 2 ? Math.PI / 2 : 0, 0);
    return [a, e];
  };
  const [armR, armR2] = arm(-1);
  const [armL, armL2] = arm(1);

  // left hand: a fist of boulders with knuckle spikes
  part(armL2, ico(0.5, 1), rock, 0, -1.15, 0.12).scale.set(1, 0.9, 1.05);
  for (let i = -1; i <= 1; i++) {
    part(armL2, ico(0.16, 0), basalt, i * 0.2, -1.12, 0.55);
    part(armL2, cone(0.06, 0.26, 4), bone, i * 0.2, -1.12, 0.72, Math.PI / 2, 0, 0);
  }
  seam(armL2, 0.0, -1.2, 0.58, 0.3, Math.PI / 2);

  // right hand: grips a monolith torn from an old temple, runes still burning on it
  part(armR2, ico(0.4, 0), rock, 0, -1.1, 0.1);
  const club = new THREE.Group();
  club.position.set(0, -1.1, 0.15);
  // held low and forward, its head dragging near the ground; raised, it swings back over the shoulder
  club.rotation.set(2.45, 0, 0);
  armR2.add(club);
  part(club, cyl(0.12, 0.14, 0.9, 6), dark, 0, -0.05, 0); // haft
  part(club, taperBox(0.55, 0.75, 2.2, 0.5, 0.65), ash, 0, 1.4, 0); // the stone
  part(club, taperBox(0.62, 0.62, 0.18, 0.58), rock, 0, 0.32, 0);
  part(club, taperBox(0.8, 0.8, 0.22, 0.72), rock, 0, 2.55, 0);
  for (let i = 0; i < 4; i++) {
    part(club, box(0.18, 0.06, 0.02), magma, 0, 0.75 + i * 0.42, 0.34);
    part(club, box(0.06, 0.18, 0.02), magma, i % 2 ? 0.08 : -0.08, 0.86 + i * 0.42, 0.34);
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(club, cone(0.07, 0.3, 4), bone, s * 0.38, 1.3 + i * 0.5, 0, 0, 0, -s * Math.PI / 2);
  part(club, ring(0.42, 0.05, 8), rust, 0, 1.0, 0, Math.PI / 2, 0, 0);
  part(club, ring(0.46, 0.05, 8), rust, 0, 2.0, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 5; i++) part(club, ring(0.08, 0.025, 6), iron, 0.45, 2.0 - i * 0.14, 0.05, 0, i % 2 ? Math.PI / 2 : 0, 0);

  return {
    root,
    bones: { hips, spine, head, jaw, armR, armR2, armL, armL2, legR, legR2, legL, legL2 },
    sockets: {
      mouth: socketAt(jaw, "mouth", 0, 0.05, 0.4),
      club: socketAt(club, "weaponTip", 0, 2.6, 0),
      fist: socketAt(armL2, "muzzle", 0, -1.2, 0.3),
      core: socketAt(spine, "chest", 0, 0.78, 0.55),
    },
    glows,
  };
}
