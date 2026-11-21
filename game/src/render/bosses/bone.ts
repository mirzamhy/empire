// Naga Tengkorak: a dead dragon raised from the bones on the map. Nothing but bleached bone held
// together by soul fire: a ribcage with a burning green heart inside it, a spine of long hooked
// vertebrae, a horned skull with empty sockets that burn, wing bones trailing torn rags of shadow,
// and a tail that ends in a scythe. Silhouette: the open ribcage and the bare wing fingers.
//
// Same rig as Naga Purba (elder.ts), so the flying animation is shared:
// body > neck1 > neck2 > neck3 > head > jaw; body > wingR > wingR2, wingL > wingL2;
// body > armR, armL, legR, legL; body > tail1 > tail2 > tail3 > tail4.
import * as THREE from "three";
import { box, cone, cyl, glow, ico, lambert, part, pivot, ring, seg, sheet, socketAt, taperBox } from "../units/models/kit";
import type { BossModel } from "./titan";

export function buildBoneDragon(): BossModel {
  const root = new THREE.Group();
  const bone = lambert(0xe3dccb);
  const old = lambert(0xb9ad94);
  const dark = lambert(0x6e6452);
  const socket = lambert(0x0d1110);
  const rag = new THREE.MeshLambertMaterial({ color: 0x223a33, emissive: 0x06140f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, flatShading: true, depthWrite: false });
  const iron = lambert(0x3a3f44);
  const soul = glow(0x45f5a8);
  const soulDeep = glow(0x17905c);
  const hot = glow(0xc8ffe6);
  const eye = glow(0x6dfff0);
  const rune = glow(0x22b878);
  const glows = [soul, hot, eye, rune, soulDeep];
  // what is left of the wing membranes: a faint sheet of soul light between the finger bones
  const ghost = new THREE.MeshBasicMaterial({ color: 0x45f5a8, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
  const rust = lambert(0x6b3f2a);
  const tip = lambert(0x3b352c);

  /** One vertebra: a disc with a hooked spine on top and two side spurs. */
  const vertebra = (parent: THREE.Object3D, z: number, r: number, y = 0, spike = r * 2.2) => {
    part(parent, cyl(r, r * 1.1, r * 0.7, 6), bone, 0, y, z, Math.PI / 2, 0, 0);
    part(parent, cone(r * 0.35, spike, 4), old, 0, y + r + spike * 0.4, z - r * 0.3, -0.5, 0, 0);
    for (const s of [-1, 1]) part(parent, cone(r * 0.22, r * 1.3, 4), old, s * r * 1.1, y, z, 0, 0, -s * 1.3);
  };

  // ---------------------------------------------------------------- body: spine, ribcage, soul heart
  const body = pivot(root, "body", 0, 2.1, 0);
  for (let i = 0; i < 9; i++) vertebra(body, 1.7 - i * 0.42, 0.24 - Math.abs(i - 3) * 0.01, 0.75, 0.55 + (i < 4 ? 0.25 : 0));
  // ribs: arcs from the spine curving down and in, a gap between each so the heart shows through
  for (let i = 0; i < 7; i++) {
    const z = 1.45 - i * 0.42;
    const w = 1.15 - Math.abs(i - 2) * 0.1;
    for (const s of [-1, 1]) {
      const a = [s * 0.2, 0.7, z];
      const b = [s * w, 0.35, z - 0.05];
      const c = [s * w * 0.95, -0.45, z - 0.1];
      const d = [s * 0.25, -0.95, z - 0.12];
      seg(body, bone, a, b, 0.07, 0.065, 5);
      seg(body, bone, b, c, 0.065, 0.06, 5);
      seg(body, old, c, d, 0.06, 0.04, 5);
    }
  }
  part(body, box(0.18, 0.12, 2.4), old, 0, -0.98, 0.5); // sternum
  // the heart: a ball of soul fire with a white core, and wisps rising from it
  part(body, ico(0.2, 2), hot, 0, -0.05, 0.75);
  part(body, ico(0.34, 2), soul, 0, -0.05, 0.75).scale.set(1, 1.25, 0.9);
  // veins of soul fire running from the heart out to the ribs: the fire is what holds the bones
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const to = [Math.cos(a) * 0.95, -0.1 + Math.sin(a) * 0.7, 0.75 + ((i % 3) - 1) * 0.5];
    const mid = [to[0] * 0.5, -0.05 + Math.sin(a) * 0.3 + 0.1, 0.75 + (to[2] - 0.75) * 0.4];
    seg(body, soulDeep, [0, -0.05, 0.75], mid, 0.035, 0.025, 4);
    seg(body, soulDeep, mid, to, 0.025, 0.012, 4);
  }
  // tongues of soul fire licking up from the heart, and embers caught between the ribs
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    part(body, cone(0.09, 0.55, 4), i % 2 ? soul : soulDeep, Math.cos(a) * 0.2, 0.3, 0.75 + Math.sin(a) * 0.15, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  part(body, ico(0.16, 0), soulDeep, 0.35, 0.3, 0.1);
  part(body, ico(0.12, 0), soulDeep, -0.3, 0.2, -0.4);
  // chains of the old binding still wrapped round the ribs, runes glowing on the links
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    part(body, ring(0.1, 0.03, 6), iron, -1.05 + t * 2.1, 0.4 - Math.sin(t * Math.PI) * 0.65, 1.2 - t * 0.6, 0, i % 2 ? Math.PI / 2 : 0, 0.4);
  }
  part(body, box(0.05, 0.3, 0.05), rune, -0.7, -0.1, 1.15, 0, 0, 0.5);
  // little tongues of soul fire flickering between the spines down the back
  for (let i = 0; i < 4; i++) part(body, cone(0.07, 0.4, 4), i % 2 ? soul : soulDeep, 0, 1.1, 1.5 - i * 0.84, -0.3, 0, 0);
  // a broken rib on the left: snapped short, its jagged end hanging free
  seg(body, old, [1.05, -0.2, -0.85], [1.22, -0.55, -0.95], 0.05, 0.02, 4);
  // trophies of its old kills, small skulls on chains swinging under the ribs
  const trophy = (x: number, y: number, z: number, r: number) => {
    part(body, ico(r, 1), bone, x, y, z).scale.set(1, 0.9, 1.1);
    part(body, box(r * 0.8, r * 0.4, r * 0.7), old, x, y - r * 0.7, z + r * 0.15);
    for (const s of [-1, 1]) part(body, ico(r * 0.25, 0), socket, x + s * r * 0.4, y - r * 0.1, z + r * 0.85);
  };
  for (const [x, z, n] of [[-0.45, 0.25, 3], [0.5, -0.6, 2]] as const) {
    for (let i = 0; i < n; i++) part(body, ring(0.06, 0.02, 6), iron, x, -0.95 - i * 0.12, z, 0, i % 2 ? Math.PI / 2 : 0, 0);
    trophy(x, -0.95 - n * 0.12 - 0.12, z, 0.13);
  }
  // pelvis: a sacrum fused to the spine and two flaring hip blades with holes worn through them
  part(body, taperBox(0.5, 0.3, 0.45, 0.9, 0.5), old, 0, 0.45, -1.55);
  for (const s of [-1, 1]) {
    part(body, taperBox(0.75, 0.35, 0.12, 0.65, 0.45), bone, s * 0.48, 0.25, -1.5, 0, 0, s * 0.7);
    part(body, box(0.14, 0.14, 0.14), socket, s * 0.6, 0.15, -1.45);
  }
  for (const s of [-1, 1]) {
    part(body, taperBox(0.55, 0.2, 0.08, 0.8, 0.5), bone, s * 0.65, 0.65, 1.2, 0.2, 0, s * 0.6);
    part(body, ico(0.22, 0), dark, s * 0.75, -0.2, -1.5);
  }

  // ---------------------------------------------------------------- neck
  const neck1 = pivot(body, "neck1", 0, 0.6, 1.9, -0.8);
  const neck2 = pivot(neck1, "neck2", 0, 0, 1.0, 0.25);
  const neck3 = pivot(neck2, "neck3", 0, 0, 0.95, 0.25);
  for (const [n, len, r] of [[neck1, 1.0, 0.22], [neck2, 0.95, 0.2], [neck3, 0.85, 0.18]] as const) {
    seg(n, dark, [0, 0, 0], [0, 0, len], r * 0.45, r * 0.4, 5); // spinal cord
    for (let i = 0; i < 3; i++) vertebra(n, 0.15 + i * (len / 3), r, 0, r * 2.4);
  }
  // wisps of soul fire between the bones
  part(neck2, ico(0.16, 0), soul, 0, -0.05, 0.5);
  // the iron collar of the old binding, still locked round the base of the neck, runes burning in
  // it, and the broken end of its chain hanging down
  part(neck1, ring(0.3, 0.07, 10), iron, 0, 0, 0.35);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(neck1, box(0.08, 0.08, 0.12), i % 2 ? rune : rust, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.35);
  }
  for (let i = 0; i < 4; i++) part(neck1, ring(0.08, 0.022, 6), iron, 0.05, -0.38 - i * 0.13, 0.35 - i * 0.05, 0, i % 2 ? Math.PI / 2 : 0, 0);

  // ---------------------------------------------------------------- skull
  const head = pivot(neck3, "head", 0, 0, 0.85, 0.75);
  part(head, box(0.78, 0.52, 0.75), bone, 0, 0.08, 0.3);
  part(head, taperBox(0.62, 0.34, 1.2, 0.4, 0.24), bone, 0, 0.0, 1.15, Math.PI / 2, 0, 0); // snout
  part(head, taperBox(0.34, 0.2, 1.0, 0.1, 0.06), old, 0, 0.18, 1.1, Math.PI / 2 + 0.08, 0, 0); // ridge
  for (const s of [-1, 1]) {
    // deep empty sockets with a burning point inside, and a flame licking out of them
    part(head, box(0.26, 0.22, 0.3), socket, s * 0.3, 0.17, 0.62);
    part(head, ico(0.08, 0), eye, s * 0.3, 0.17, 0.72);
    part(head, cone(0.07, 0.34, 4), soul, s * 0.33, 0.36, 0.58, -0.4, 0, -s * 0.2);
    part(head, box(0.1, 0.06, 0.12), socket, s * 0.12, 0.08, 1.7); // nasal holes
    // the cheek is broken through: a hole showing the fire
    part(head, box(0.04, 0.16, 0.36), socket, s * 0.4, -0.05, 0.35);
    for (const z of [1.55, 1.3, 1.05, 0.8, 0.6]) part(head, cone(0.045, 0.2, 3), bone, s * 0.2, -0.22, z, Math.PI, 0, 0);
  }
  // the crown: two great horns sweeping back, a ring of broken spikes, a cracked plate
  for (const s of [-1, 1]) {
    const pts = [[s * 0.28, 0.32, 0.15], [s * 0.6, 0.7, -0.45], [s * 0.66, 1.0, -1.05], [s * 0.45, 1.25, -1.6]];
    seg(head, bone, pts[0], pts[1], 0.15, 0.11, 6);
    seg(head, old, pts[1], pts[2], 0.11, 0.06, 6);
    seg(head, dark, pts[2], pts[3], 0.06, 0, 5);
    for (let i = 0; i < 3; i++) seg(head, old, [s * (0.12 + i * 0.12), 0.34, 0.2 - i * 0.16], [s * (0.2 + i * 0.2), 0.7 - i * 0.07, -0.1 - i * 0.2], 0.05, 0, 4);
    seg(head, bone, [s * 0.38, -0.02, 0.25], [s * 0.8, -0.12, -0.3], 0.07, 0, 4); // cheek spike
  }
  part(head, box(0.04, 0.3, 0.04), socket, 0.08, 0.36, 0.3, 0, 0, 0.4); // crack in the skull
  // heavy brows over the sockets, a horn on the snout and a frill of bone blades behind the crown
  for (const s of [-1, 1]) {
    part(head, taperBox(0.3, 0.18, 0.1, 0.32, 0.2), old, s * 0.3, 0.33, 0.66, 0.2, 0, -s * 0.25);
    seg(head, old, [s * 0.15, 0.1, 1.62], [s * 0.2, 0.26, 1.55], 0.05, 0, 4); // nostril spurs
    // ridges round each great horn, like the rings on the horn of a ram
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      part(head, ring(0.14 - t * 0.06, 0.025, 6), old, s * (0.28 + t * 0.35), 0.32 + t * 0.4, 0.15 - t * 0.62, 0.9, 0, s * 0.5);
    }
    // a smaller pair of horns under the great ones, curling forward
    seg(head, bone, [s * 0.36, 0.05, 0.05], [s * 0.62, -0.05, -0.25], 0.08, 0.05, 5);
    seg(head, dark, [s * 0.62, -0.05, -0.25], [s * 0.66, -0.3, -0.05], 0.05, 0, 4);
  }
  seg(head, bone, [0, 0.2, 1.4], [0, 0.48, 1.55], 0.08, 0, 4);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.38;
    seg(head, i % 2 ? old : bone, [Math.sin(a) * 0.25, 0.25, -0.05], [Math.sin(a) * 0.65, 0.35 + Math.cos(a) * 0.25, -0.65], 0.07, 0, 4);
  }
  // two long fangs at the front of the upper jaw
  for (const s of [-1, 1]) seg(head, bone, [s * 0.2, -0.2, 1.62], [s * 0.18, -0.58, 1.58], 0.06, 0, 4);
  // jaw: bare bone, the teeth long and uneven, fire glowing between them
  const jaw = pivot(head, "jaw", 0, -0.2, 0.15);
  part(jaw, taperBox(0.56, 0.32, 1.45, 0.14, 0.08), bone, 0, -0.1, 0.82, Math.PI / 2, 0, 0);
  part(jaw, box(0.3, 0.03, 1.0), soul, 0, 0.0, 0.85);
  for (const s of [-1, 1]) {
    for (const z of [1.45, 1.2, 0.95, 0.7]) part(jaw, cone(0.04, 0.17 + (z > 1.3 ? 0.08 : 0), 3), bone, s * 0.18, 0.04, z);
    seg(jaw, old, [s * 0.18, -0.15, 0.4], [s * 0.38, -0.38, 0.05], 0.05, 0, 4);
    // tusks at the tip of the chin
    seg(jaw, bone, [s * 0.14, 0.0, 1.5], [s * 0.2, 0.36, 1.52], 0.05, 0, 4);
  }
  // soul fire dripping from between the teeth
  for (let i = 0; i < 3; i++) part(jaw, cone(0.05, 0.3, 4), i % 2 ? soulDeep : soul, (i - 1) * 0.12, -0.32, 0.6 + i * 0.3, Math.PI, 0, 0);

  // ---------------------------------------------------------------- wings: bare finger bones and rags
  const wing = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const w = pivot(body, `wing${n}`, s * 0.6, 0.85, 0.7, 0, 0, s * 0.15);
    const wrist = [s * 2.6, 0.2, 0.3];
    seg(w, bone, [0, 0, 0], [s * 1.3, 0.12, 0.15], 0.14, 0.1, 5);
    seg(w, bone, [s * 1.3, 0.12, 0.15], wrist, 0.1, 0.09, 5);
    part(w, ico(0.18, 0), old, s * 1.3, 0.12, 0.15);
    // a rag of shadow hanging from the arm, cut into strips
    for (let i = 0; i < 7; i++) {
      const x0 = s * (0.15 + i * 0.35);
      const len = 1.0 + ((i * 7) % 5) * 0.22;
      part(w, sheet([[x0, 0, 0.05], [x0 + s * 0.32, 0, 0.08], [x0 + s * (0.1 + (i % 3) * 0.06), -0.12, -len]], [[0, 1, 2]]), rag);
    }
    const w2 = pivot(w, `wing${n}2`, wrist[0], wrist[1], wrist[2]);
    part(w2, ico(0.17, 0), old, 0, 0, 0);
    seg(w2, bone, [0, 0, 0], [s * 0.25, 0.1, 0.75], 0.08, 0, 4); // claw
    const tips = [[s * 3.3, 0, 0.5], [s * 3.0, 0, -1.4], [s * 1.8, 0, -2.6], [s * 0.2, -0.1, -2.4]];
    tips.forEach((t, i) => {
      if (i === 3) return;
      const mid = [t[0] * 0.5, 0.05, t[2] * 0.5];
      seg(w2, bone, [0, 0, 0], mid, 0.08, 0.06, 5);
      part(w2, ico(0.09, 0), old, mid[0], mid[1], mid[2]);
      seg(w2, bone, mid, t, 0.06, 0.02, 5);
      // tatters between the fingers: a few strips, never a whole membrane
      const b = tips[i + 1];
      const m2 = [(t[0] + b[0]) * 0.5, -0.05, (t[2] + b[2]) * 0.5];
      part(w2, sheet([[0, 0, 0], [t[0] * 0.8, 0, t[2] * 0.8], [m2[0] * 0.75, -0.05, m2[2] * 0.75]], [[0, 1, 2]]), rag);
      part(w2, sheet([[t[0] * 0.5, 0, t[2] * 0.5], [t[0] * 0.95, 0, t[2] * 0.95], [m2[0] * 1.0, -0.1, m2[2] * 1.0]], [[0, 1, 2]]), rag);
      part(w2, ico(0.06, 0), soul, t[0] * 0.98, 0, t[2] * 0.98); // a flame on each fingertip
      // the faint ghost of the old membrane spanning the gap, and a strip of rag hanging off the bone
      part(w2, sheet([[0, -0.02, 0], [t[0], -0.02, t[2]], [b[0], -0.04, b[2]]], [[0, 1, 2]]), ghost);
      part(w2, sheet([[mid[0], 0, mid[2]], [mid[0] + s * 0.15, 0, mid[2] - 0.05], [mid[0] + s * 0.05, -0.55, mid[2] - 0.25]], [[0, 1, 2]]), rag);
      seg(w2, tip, t, [t[0] * 1.08, -0.08, t[2] * 1.08], 0.025, 0, 4); // a hooked claw at each tip
    });
    // between the arm and the first finger as well
    part(w, sheet([[0, -0.02, 0], [wrist[0], wrist[1] - 0.02, wrist[2]], [s * 0.4, -0.1, -2.2]], [[0, 1, 2]]), ghost);
    part(w2, sheet([[0, -0.02, 0], [tips[2][0], -0.02, tips[2][2]], [tips[3][0] - wrist[0], -0.1, tips[3][2] - wrist[2]]], [[0, 1, 2]]), ghost);
    return [w, w2];
  };
  const [wingR, wingR2] = wing(-1);
  const [wingL, wingL2] = wing(1);

  // ---------------------------------------------------------------- limbs: bone legs with long talons
  const limb = (name: string, x: number, z: number, front: boolean) => {
    const g = pivot(body, name, x, front ? -0.55 : -0.5, z);
    part(g, ico(front ? 0.26 : 0.32, 0), old, 0, -0.05, 0);
    seg(g, bone, [0, -0.1, 0], [0, -0.8, front ? 0.25 : 0.1], 0.1, 0.08, 5);
    part(g, ico(0.12, 0), old, 0, -0.8, front ? 0.25 : 0.1);
    seg(g, bone, [0, -0.8, front ? 0.25 : 0.1], [0, -1.4, front ? 0.42 : 0.25], 0.08, 0.06, 5);
    const fz = front ? 0.42 : 0.25;
    part(g, ico(0.1, 0), old, 0, -1.42, fz);
    // three toes of two bones each, curling down into black hooked talons, and a spur at the heel
    for (let i = -1; i <= 1; i++) {
      const k = [i * 0.14, -1.5, fz + 0.3];
      seg(g, bone, [i * 0.06, -1.42, fz], k, 0.045, 0.035, 4);
      part(g, ico(0.045, 0), old, k[0], k[1], k[2]);
      seg(g, bone, k, [i * 0.2, -1.55, fz + 0.52], 0.035, 0.03, 4);
      seg(g, tip, [i * 0.2, -1.55, fz + 0.52], [i * 0.22, -1.72, fz + 0.62], 0.03, 0, 4);
    }
    seg(g, old, [0, -1.4, fz - 0.05], [0, -1.6, fz - 0.3], 0.04, 0, 4);
    // a spur of bone sticking back from the knee
    seg(g, old, [0, -0.8, (front ? 0.25 : 0.1) - 0.05], [0, -0.65, (front ? 0.25 : 0.1) - 0.4], 0.05, 0, 4);
    return g;
  };
  const armR = limb("armR", -0.62, 1.15, true);
  const armL = limb("armL", 0.62, 1.15, true);
  const legR = limb("legR", -0.75, -1.4, false);
  const legL = limb("legL", 0.75, -1.4, false);

  // ---------------------------------------------------------------- tail ending in a scythe
  const tail1 = pivot(body, "tail1", 0, 0.5, -1.9, -0.1);
  const tail2 = pivot(tail1, "tail2", 0, 0, -1.2, -0.08);
  const tail3 = pivot(tail2, "tail3", 0, 0, -1.15, 0.12);
  const tail4 = pivot(tail3, "tail4", 0, 0, -1.05, 0.12);
  for (const [t, len, r] of [[tail1, 1.2, 0.2], [tail2, 1.15, 0.17], [tail3, 1.05, 0.14], [tail4, 0.95, 0.11]] as const) {
    seg(t, dark, [0, 0, 0], [0, 0, -len], r * 0.45, r * 0.35, 5);
    for (let i = 0; i < 3; i++) vertebra(t, -0.15 - i * (len / 3), r, 0, r * 2.2);
  }
  // the scythe: a thick curved blade of bone with a darker edge and a rune of soul fire down it
  const blade = [[0, 0, -0.7], [0, 0.55, -0.95], [0, 1.05, -1.4], [0, 1.0, -1.95], [0, 0.6, -2.45], [0, 0.45, -1.9], [0, 0.5, -1.45], [0, 0.15, -1.2]];
  const faces = [[0, 1, 7], [1, 6, 7], [1, 2, 6], [2, 5, 6], [2, 3, 5], [3, 4, 5]];
  for (const x of [-0.05, 0.05]) {
    const pts = blade.map(([, y, z]) => [x, y, z]);
    part(tail4, sheet(pts, x < 0 ? faces.map(([a, b, c]) => [a, c, b]) : faces), bone);
  }
  for (let i = 1; i < 4; i++) seg(tail4, dark, [0, blade[i][1], blade[i][2]], [0, blade[i + 1][1], blade[i + 1][2]], 0.06, 0.05, 4); // the edge
  seg(tail4, soul, [0, 0.55, -1.2], [0, 0.85, -1.6], 0.035, 0.03, 4);
  seg(tail4, soul, [0, 0.85, -1.6], [0, 0.65, -2.15], 0.03, 0.015, 4);
  // spikes fanning from both sides of the tail tip
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) seg(tail4, old, [s * 0.1, 0, -0.2 - i * 0.25], [s * (0.45 - i * 0.08), 0.05, -0.35 - i * 0.3], 0.05, 0, 4);

  return {
    root,
    bones: { body, neck1, neck2, neck3, head, jaw, wingR, wingR2, wingL, wingL2, armR, armL, legR, legL, tail1, tail2, tail3, tail4 },
    sockets: {
      mouth: socketAt(head, "mouth", 0, -0.15, 1.75),
      chest: socketAt(body, "chest", 0, -0.05, 0.75),
      headTop: socketAt(head, "headTop", 0, 0.8, 0.2),
    },
    glows,
  };
}
