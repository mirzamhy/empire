// Naga Purba: the ancient dragon of the 100k like milestone. Older and far larger than the World
// Dragon: obsidian scales split by veins of magma, a crown of horns and a frill of bone, four eyes,
// a broken iron collar from the age it was chained, torn wings whose veins glow, and a tail that
// ends in a bone blade. Silhouette: the crown and the ragged wings.
//
// Rig: body > neck1 > neck2 > neck3 > head > jaw; body > wingR > wingR2, wingL > wingL2;
// body > armR, armL (front claws), legR, legL; body > tail1 > tail2 > tail3 > tail4.
// Wings are built flat along X and flap on Z; neck and tail sway like the World Dragon's.
import * as THREE from "three";
import { box, cone, glow, ico, lambert, part, pivot, ring, seg, sheet, socketAt, taperBox } from "../units/models/kit";
import type { BossModel } from "./titan";

export function buildElder(): BossModel {
  const root = new THREE.Group();
  const obsidian = lambert(0x1d181b);
  const scale = lambert(0x2f262a);
  const belly = lambert(0x4d3a33);
  const membrane = lambert(0x2c1012);
  membrane.side = THREE.DoubleSide;
  const bone = lambert(0xd6c8aa);
  const boneDark = lambert(0x7b6b55);
  const iron = lambert(0x3b3e45);
  const magma = glow(0xff4a12);
  const hot = glow(0xffb347);
  const eye = glow(0xff3020);
  const pupil = glow(0xfff2c0);
  const glows = [magma, hot, eye, pupil];

  const vein = (parent: THREE.Object3D, a: number[], b: number[], r = 0.03) => seg(parent, magma, a, b, r, r * 0.6, 4);

  // ---------------------------------------------------------------- body
  const body = pivot(root, "body", 0, 2.1, 0);
  part(body, ico(1.25, 1), obsidian, 0, 0, 0).scale.set(0.95, 0.8, 1.7);
  part(body, ico(1.1, 1), belly, 0, -0.38, 0.1).scale.set(0.85, 0.66, 1.6);
  // belly plates with magma between them
  for (let i = 0; i < 7; i++) {
    const z = 1.45 - i * 0.48;
    const rr = Math.sqrt(Math.max(0.05, 1 - (z / 2.05) ** 2));
    part(body, box(1.3 * rr, 0.1, 0.38), scale, 0, -0.98 * rr - 0.02, z);
    part(body, box(1.1 * rr, 0.04, 0.06), magma, 0, -0.97 * rr - 0.05, z - 0.24);
  }
  // flank scales: three rows of overlapping plates
  for (const s of [-1, 1]) for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
    const z = 1.4 - i * 0.46;
    const rr = Math.sqrt(Math.max(0.05, 1 - (z / 2.1) ** 2));
    const a = 0.95 - row * 0.45;
    part(body, cone(0.15, 0.36, 4), row === 1 ? scale : obsidian, s * 1.18 * rr * Math.cos(a), 1.0 * rr * Math.sin(a), z - 0.1, -0.6, 0, -s * (Math.PI / 2 - a));
  }
  // chest: cracks of fire where the scales have split
  for (const [x, y, len, rz] of [[-0.3, 0.1, 0.8, 0.4], [0.25, -0.05, 0.7, -0.5], [0, -0.3, 0.6, 0.1], [0.45, 0.3, 0.5, 0.9]]) {
    part(body, box(0.08, len, 0.08), magma, x, y, 1.95 - Math.abs(x) * 0.3, 0.7, 0, rz);
  }
  part(body, ico(0.3, 0), hot, 0, -0.05, 1.82).scale.set(1, 1.3, 0.4);
  // back: a ridge of crystal spines that glow at the tip, bigger at the shoulders
  for (let i = 0; i < 8; i++) {
    const z = 1.5 - i * 0.48;
    const h = 0.75 - Math.abs(i - 2) * 0.07;
    const y = 0.98 * Math.sqrt(Math.max(0.05, 1 - (z / 2.1) ** 2));
    part(body, cone(0.16, h, 4), obsidian, 0, y + h / 2 - 0.05, z, -0.35, 0, 0);
    part(body, cone(0.07, h * 0.35, 4), magma, 0, y + h - 0.1, z - h * 0.12, -0.35, 0, 0);
    for (const s of [-1, 1]) part(body, cone(0.08, h * 0.45, 4), scale, s * 0.3, y + h * 0.15, z - 0.1, -0.45, 0, -s * 0.45);
  }
  // veins of fire running down the flanks
  for (const s of [-1, 1]) {
    vein(body, [s * 0.9, 0.5, 1.2], [s * 1.1, 0.0, 0.3], 0.04);
    vein(body, [s * 1.1, 0.0, 0.3], [s * 0.95, -0.35, -0.8], 0.035);
    vein(body, [s * 0.95, -0.35, -0.8], [s * 0.6, -0.2, -1.8], 0.03);
  }

  // ---------------------------------------------------------------- neck
  const neck1 = pivot(body, "neck1", 0, 0.45, 1.8, -0.8);
  seg(neck1, obsidian, [0, 0, 0], [0, 0, 1.0], 0.62, 0.5, 7);
  seg(neck1, belly, [0, -0.22, 0.05], [0, -0.18, 1.0], 0.48, 0.4, 6);
  // the broken collar: a thick iron ring with links still hanging from it
  part(neck1, ring(0.66, 0.1, 10), iron, 0, 0, 0.45);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) part(neck1, ring(0.1, 0.03, 6), iron, s * 0.7, -0.18 - i * 0.16, 0.45, 0, i % 2 ? Math.PI / 2 : 0, 0);
  part(neck1, box(0.18, 0.18, 0.1), iron, 0, -0.65, 0.45);
  const neck2 = pivot(neck1, "neck2", 0, 0, 1.0, 0.25);
  seg(neck2, obsidian, [0, 0, 0], [0, 0, 0.95], 0.5, 0.42, 7);
  seg(neck2, belly, [0, -0.18, 0], [0, -0.15, 0.92], 0.4, 0.33, 6);
  const neck3 = pivot(neck2, "neck3", 0, 0, 0.95, 0.25);
  seg(neck3, obsidian, [0, 0, 0], [0, 0, 0.85], 0.42, 0.36, 7);
  seg(neck3, belly, [0, -0.15, 0], [0, -0.12, 0.82], 0.33, 0.27, 6);
  for (const [n, z, h] of [[neck1, 0.25, 0.42], [neck1, 0.75, 0.4], [neck2, 0.3, 0.36], [neck2, 0.75, 0.32], [neck3, 0.3, 0.3], [neck3, 0.7, 0.26]] as const) {
    part(n, cone(0.1, h, 4), obsidian, 0, h / 2 + 0.38 - z * 0.08, z, -0.4, 0, 0);
    part(n, cone(0.04, h * 0.3, 4), magma, 0, h + 0.3 - z * 0.08, z - 0.05, -0.4, 0, 0);
  }
  vein(neck2, [0.3, 0.1, 0.1], [0.25, -0.1, 0.85]);
  vein(neck2, [-0.3, 0.1, 0.1], [-0.25, -0.1, 0.85]);

  // ---------------------------------------------------------------- head
  const head = pivot(neck3, "head", 0, 0, 0.85, 0.75);
  part(head, box(0.82, 0.58, 0.82), obsidian, 0, 0.06, 0.3);
  part(head, taperBox(0.7, 0.42, 1.15, 0.44, 0.28), obsidian, 0, 0.0, 1.15, Math.PI / 2, 0, 0); // long snout
  part(head, taperBox(0.5, 0.3, 0.9, 0.12, 0.08), scale, 0, 0.2, 1.1, Math.PI / 2 + 0.08, 0, 0); // snout ridge
  for (const s of [-1, 1]) {
    // nostrils smoking, two pairs of eyes under a heavy brow
    part(head, box(0.12, 0.07, 0.12), magma, s * 0.13, 0.12, 1.66);
    for (const [y, z, sz] of [[0.18, 0.62, 1], [0.04, 0.5, 0.75]]) {
      part(head, box(0.07 * sz, 0.12 * sz, 0.22 * sz), eye, s * 0.4, y, z);
      part(head, box(0.075 * sz, 0.04 * sz, 0.08 * sz), pupil, s * 0.405, y, z + 0.02);
    }
    part(head, box(0.2, 0.12, 0.5), scale, s * 0.34, 0.34, 0.6, 0, 0, s * 0.35);
    // cheek blades and teeth
    seg(head, bone, [s * 0.4, -0.05, 0.25], [s * 0.82, -0.18, -0.35], 0.09, 0, 4);
    for (const z of [1.55, 1.3, 1.05, 0.8]) part(head, cone(0.045, 0.18, 3), bone, s * 0.22, -0.22, z, Math.PI, 0, 0);
  }
  // the crown: two great horns sweeping back, two curling down, and a ring of smaller ones
  for (const s of [-1, 1]) {
    const pts = [[s * 0.3, 0.32, 0.1], [s * 0.6, 0.72, -0.5], [s * 0.72, 1.15, -1.15], [s * 0.55, 1.55, -1.8]];
    seg(head, bone, pts[0], pts[1], 0.17, 0.13, 6);
    seg(head, bone, pts[1], pts[2], 0.13, 0.08, 6);
    seg(head, boneDark, pts[2], pts[3], 0.08, 0, 5);
    part(head, ring(0.15, 0.03, 6), magma, pts[1][0], pts[1][1], pts[1][2], 0.9, 0, 0);
    const low = [[s * 0.4, 0.05, 0.05], [s * 0.9, -0.05, -0.45], [s * 1.0, -0.45, -0.75]];
    seg(head, bone, low[0], low[1], 0.11, 0.07, 5);
    seg(head, boneDark, low[1], low[2], 0.07, 0, 5);
    for (let i = 0; i < 3; i++) seg(head, boneDark, [s * (0.1 + i * 0.12), 0.34, 0.25 - i * 0.18], [s * (0.15 + i * 0.2), 0.78 - i * 0.08, -0.15 - i * 0.2], 0.06, 0, 4);
  }
  // a frill of bone spikes webbed with membrane behind the skull
  const frill: number[][] = [[0, 0.2, -0.15]];
  const frillFaces: number[][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = -1.2 + i * 0.4;
    const tip = [Math.sin(a) * 1.0, 0.25 + Math.cos(a) * 0.7, -0.55];
    seg(head, boneDark, [Math.sin(a) * 0.25, 0.25, -0.15], tip, 0.05, 0, 4);
    frill.push(tip);
    if (i > 0) frillFaces.push([0, i, i + 1]);
  }
  part(head, sheet(frill, frillFaces), membrane);
  // jaw: hinged, lined with fire, a row of long teeth
  const jaw = pivot(head, "jaw", 0, -0.2, 0.15);
  part(jaw, taperBox(0.62, 0.36, 1.45, 0.16, 0.1), obsidian, 0, -0.1, 0.82, Math.PI / 2, 0, 0);
  part(jaw, box(0.34, 0.04, 1.05), magma, 0, 0.0, 0.85);
  part(jaw, box(0.16, 0.03, 0.7), hot, 0, 0.02, 0.9);
  for (const s of [-1, 1]) {
    for (const z of [1.45, 1.2, 0.95, 0.7]) part(jaw, cone(0.04, 0.16, 3), bone, s * 0.19, 0.04, z);
    seg(jaw, bone, [s * 0.18, -0.15, 0.4], [s * 0.42, -0.4, 0.05], 0.06, 0, 4); // chin spikes
  }

  // ---------------------------------------------------------------- wings
  const wing = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const w = pivot(body, `wing${n}`, s * 0.7, 0.75, 0.6, 0, 0, s * 0.15);
    const wrist = [s * 2.6, 0.2, 0.3];
    seg(w, obsidian, [0, 0, 0], wrist, 0.22, 0.13, 6);
    part(w, ico(0.26, 0), scale, 0, 0, 0);
    part(w, ico(0.18, 0), scale, s * 1.3, 0.1, 0.15);
    for (let i = 0; i < 3; i++) part(w, cone(0.06, 0.3, 4), bone, s * (0.6 + i * 0.7), 0.25, 0.25, 0, 0, -s * 0.2);
    // inner membrane, torn: a notch cut out of the trailing edge
    part(w, sheet([[0, 0, 0], wrist, [s * 2.5, 0, -2.2], [s * 1.6, 0, -1.4], [s * 1.2, 0, -2.0], [0, 0, -2.0]], [[0, 1, 3], [1, 2, 3], [0, 3, 4], [0, 4, 5]]), membrane);
    vein(w, [s * 0.3, 0.02, -0.1], [s * 1.2, 0.02, -1.9]);
    vein(w, [s * 1.4, 0.02, 0.05], [s * 2.4, 0.02, -2.0]);
    const w2 = pivot(w, `wing${n}2`, wrist[0], wrist[1], wrist[2]);
    part(w2, ico(0.2, 0), scale, 0, 0, 0);
    seg(w2, bone, [0, 0, 0], [s * 0.25, 0.1, 0.75], 0.09, 0, 4); // wrist claw
    // four finger bones; the membrane between them has rips and a ragged edge
    const tips = [[s * 3.4, 0, 0.5], [s * 3.1, 0, -1.4], [s * 1.8, 0, -2.6], [s * 0.1, -0.1, -2.4]];
    const pts: number[][] = [[0, 0, 0]];
    const faces: number[][] = [];
    tips.forEach((t, i) => {
      if (i < 3) {
        seg(w2, obsidian, [0, 0, 0], t, 0.1, 0.03, 5);
        seg(w2, bone, t, [t[0] * 1.08, -0.05, t[2] * 1.08 + 0.05], 0.05, 0, 3);
        vein(w2, [t[0] * 0.15, 0.03, t[2] * 0.15], [t[0] * 0.85, 0.03, t[2] * 0.85], 0.025);
      }
      pts.push(t);
      const b = tips[i + 1];
      if (b) {
        // the scallop between two fingers, pulled in deep, with a second jag for a torn look
        pts.push([(t[0] + b[0]) * 0.36, 0, (t[2] + b[2]) * 0.36]);
        pts.push([(t[0] * 0.7 + b[0] * 0.3) * 0.62, 0, (t[2] * 0.7 + b[2] * 0.3) * 0.62]);
        const ti = 1 + 3 * i;
        faces.push([0, ti, ti + 2], [0, ti + 2, ti + 1], [0, ti + 1, ti + 3]);
      }
    });
    // a rip: skip one triangle in the outer membrane
    faces.splice(4, 1);
    part(w2, sheet(pts, faces), membrane);
    return [w, w2];
  };
  const [wingR, wingR2] = wing(-1);
  const [wingL, wingL2] = wing(1);

  // ---------------------------------------------------------------- limbs
  const limb = (name: string, x: number, z: number, front: boolean) => {
    const g = pivot(body, name, x, front ? -0.55 : -0.5, z);
    part(g, ico(front ? 0.4 : 0.5, 0), obsidian, 0, -0.1, 0).scale.set(0.8, 1.1, 1);
    seg(g, obsidian, [0, -0.3, 0.05], [0, -1.35, front ? 0.35 : 0.15], front ? 0.2 : 0.26, 0.14, 6);
    part(g, box(front ? 0.32 : 0.4, 0.14, 0.5), scale, 0, -1.48, front ? 0.45 : 0.3);
    for (let i = -1; i <= 1; i++) part(g, cone(0.06, 0.34, 4), bone, i * 0.12, -1.5, front ? 0.8 : 0.66, Math.PI / 2 + 0.3, 0, 0);
    part(g, cone(0.1, 0.36, 4), obsidian, 0, -0.1, -0.36, -2.0, 0, 0); // spur
    vein(g, [x > 0 ? 0.18 : -0.18, -0.4, 0.1], [x > 0 ? 0.12 : -0.12, -1.2, 0.25], 0.025);
    return g;
  };
  const armR = limb("armR", -0.62, 1.15, true);
  const armL = limb("armL", 0.62, 1.15, true);
  const legR = limb("legR", -0.75, -0.75, false);
  const legL = limb("legL", 0.75, -0.75, false);

  // ---------------------------------------------------------------- tail
  const tail1 = pivot(body, "tail1", 0, 0.05, -1.95, -0.1);
  seg(tail1, obsidian, [0, 0, 0], [0, 0, -1.2], 0.58, 0.44, 7);
  const tail2 = pivot(tail1, "tail2", 0, 0, -1.2, -0.08);
  seg(tail2, obsidian, [0, 0, 0], [0, 0, -1.15], 0.44, 0.3, 7);
  const tail3 = pivot(tail2, "tail3", 0, 0, -1.15, 0.12);
  seg(tail3, obsidian, [0, 0, 0], [0, 0, -1.05], 0.3, 0.18, 6);
  const tail4 = pivot(tail3, "tail4", 0, 0, -1.05, 0.12);
  seg(tail4, obsidian, [0, 0, 0], [0, 0, -0.95], 0.18, 0.08, 6);
  // the blade: a flat shard of bone, edged in fire
  part(tail4, sheet([[0, 0, -0.75], [-0.5, 0, -1.2], [0, 0, -2.1], [0.5, 0, -1.2], [0, 0.18, -1.2]], [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [0, 2, 1], [0, 3, 2]]), bone);
  vein(tail4, [0, 0.05, -0.85], [0, 0.05, -1.95], 0.03);
  for (const [t, n, base] of [[tail1, 3, 0.5], [tail2, 3, 0.38], [tail3, 2, 0.27], [tail4, 2, 0.18]] as const) {
    for (let i = 0; i < n; i++) {
      const z = -0.25 - i * (1.0 / n);
      part(t, cone(base * 0.28, base * 0.9, 4), obsidian, 0, base + 0.1, z, -0.4, 0, 0);
      part(t, cone(base * 0.12, base * 0.3, 4), magma, 0, base * 1.4, z - 0.08, -0.4, 0, 0);
      for (const s of [-1, 1]) part(t, cone(base * 0.18, base * 0.6, 4), scale, s * base * 0.9, 0, z, 0, 0, -s * 1.3);
    }
  }

  return {
    root,
    bones: { body, neck1, neck2, neck3, head, jaw, wingR, wingR2, wingL, wingL2, armR, armL, legR, legL, tail1, tail2, tail3, tail4 },
    sockets: {
      mouth: socketAt(head, "mouth", 0, -0.15, 1.75),
      chest: socketAt(body, "chest", 0, -0.05, 1.95),
      headTop: socketAt(head, "headTop", 0, 0.8, 0.2),
    },
    glows,
  };
}
