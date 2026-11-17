// Ancient Red Dragon (docs/fable/dragon.md): bat wings with finger bones, S-shaped neck, horned head
// with a hinged jaw, long spiked tail. Tier 1 plain; 2 back and tail spikes; 3 more horns, wing claws,
// wider glowing chest cracks.
//
// Animation notes: wingR/wingL flap on Z (wings are built flat along X), neck1/neck2 pitch on X,
// jaw opens on X (positive = down), tail segments sway on Y. Fire leaves from socket "mouth".
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, finishModel, glow, ico, lambert, part, pivot, seg, sheet, socketAt, taperBox, tintMat } from "./kit";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const red = lambert(0x9b1f1f);
  const dark = lambert(0x5a1212);
  const ivory = lambert(0xe8dcc0);
  const eye = glow(0xffcc33);
  const ember = glow(0xff7a1a);
  const fire = glow(0xff5a10);

  // body: long barrel, belly scales in the kingdom colour, glowing cracks low on the chest
  const body = pivot(root, "body", 0, 1.5, 0);
  part(body, ico(0.9, 1), red, 0, 0, 0).scale.set(0.95, 0.85, 1.6);
  part(body, ico(0.8, 0), tint, 0, -0.3, 0.05).scale.set(0.88, 0.75, 1.55);
  const cracks = o.tier >= 3 ? 3 : 2;
  for (let i = 0; i < cracks; i++) {
    const x = (i - (cracks - 1) / 2) * 0.24;
    part(body, box(o.tier >= 3 ? 0.1 : 0.07, 0.5, 0.08), ember, x, 0.05, 1.3 - Math.abs(x) * 0.25, 0.75, 0, x * 0.8);
  }
  if (o.tier >= 2) for (let i = 0; i < 5; i++) {
    const z = 0.9 - i * 0.45;
    part(body, cone(0.09, o.tier >= 3 ? 0.42 : 0.3, 4), dark, 0, 0.76 * Math.sqrt(1 - (z / 1.5) ** 2) + 0.1, z, -0.3, 0, 0);
  }

  // neck: two segments rising in an S, then the head levels out again
  const neck1 = pivot(body, "neck1", 0, 0.25, 1.15, -0.95);
  seg(neck1, red, [0, 0, 0], [0, 0, 0.95], 0.42, 0.32, 6);
  seg(neck1, tint, [0, -0.14, 0.05], [0, -0.1, 0.95], 0.34, 0.26, 5);
  const neck2 = pivot(neck1, "neck2", 0, 0, 0.95, 0.25);
  seg(neck2, red, [0, 0, 0], [0, 0, 0.9], 0.32, 0.26, 6);
  seg(neck2, tint, [0, -0.1, 0], [0, -0.08, 0.85], 0.26, 0.2, 5);
  if (o.tier >= 2) {
    part(neck1, cone(0.07, 0.26, 4), dark, 0, 0.42, 0.5);
    part(neck2, cone(0.07, 0.24, 4), dark, 0, 0.36, 0.45);
  }

  // head: cranium, tapered snout, brow ridges, eyes, swept horns
  const head = pivot(neck2, "head", 0, 0, 0.9, 0.7);
  part(head, box(0.56, 0.42, 0.62), red, 0, 0.05, 0.25);
  part(head, taperBox(0.46, 0.3, 0.78, 0.3, 0.2), red, 0, 0.03, 0.9, Math.PI / 2, 0, 0);
  part(head, box(0.1, 0.06, 0.1), dark, -0.09, 0.14, 1.22);
  part(head, box(0.1, 0.06, 0.1), dark, 0.09, 0.14, 1.22);
  for (const s of [-1, 1]) {
    part(head, box(0.05, 0.1, 0.16), eye, s * 0.28, 0.12, 0.42);
    part(head, box(0.12, 0.08, 0.34), dark, s * 0.24, 0.24, 0.4, 0, 0, s * 0.3);
    seg(head, ivory, [s * 0.2, 0.22, 0.0], [s * 0.36, 0.5, -0.55], 0.1, 0.07, 5);
    seg(head, ivory, [s * 0.36, 0.5, -0.55], [s * 0.3, 0.82, -0.98], 0.07, 0, 5);
    if (o.tier >= 3) {
      seg(head, ivory, [s * 0.26, 0.0, 0.05], [s * 0.55, 0.08, -0.5], 0.07, 0, 4);
      seg(head, ivory, [s * 0.1, 0.26, 0.1], [s * 0.14, 0.62, -0.3], 0.06, 0, 4);
    }
    // upper teeth
    part(head, cone(0.035, 0.13, 3), ivory, s * 0.12, -0.16, 1.12, Math.PI, 0, 0);
    part(head, cone(0.035, 0.13, 3), ivory, s * 0.17, -0.17, 0.8, Math.PI, 0, 0);
  }
  // jaw: hinged under the cranium, glowing mouth lining on top of it
  const jaw = pivot(head, "jaw", 0, -0.14, 0.1);
  part(jaw, taperBox(0.42, 0.26, 1.08, 0.12, 0.08), dark, 0, -0.07, 0.6, Math.PI / 2, 0, 0);
  part(jaw, box(0.2, 0.03, 0.75), fire, 0, 0.0, 0.62);
  part(jaw, cone(0.035, 0.12, 3), ivory, -0.1, 0.03, 1.05);
  part(jaw, cone(0.035, 0.12, 3), ivory, 0.1, 0.03, 1.05);

  // wings: shoulder bone (inner membrane) and wrist bone (three fingers and the outer membrane)
  const wing = (s: -1 | 1) => {
    const n = s === -1 ? "R" : "L";
    const w = pivot(body, `wing${n}`, s * 0.45, 0.5, 0.35, 0, 0, s * 0.12);
    const wrist = [s * 1.6, 0.1, 0.15];
    seg(w, dark, [0, 0, 0], wrist, 0.13, 0.08, 5);
    part(w, sheet([[0, 0, 0], wrist, [s * 1.55, 0, -1.5], [0, 0, -1.4], [s * 0.8, 0, -1.12]], [[0, 1, 4], [1, 2, 4], [0, 4, 3]]), tint);
    const w2 = pivot(w, `wing${n}2`, wrist[0], wrist[1], wrist[2]);
    const tips = [[s * 2.2, 0, 0.25], [s * 1.9, 0, -1.0], [s * 0.9, 0, -1.6], [-s * 0.05, -0.1, -1.65]];
    // membrane points: wrist, then tip, scallop, tip, scallop... (a scallop is pulled toward the wrist)
    const pts: number[][] = [[0, 0, 0]];
    const faces: number[][] = [];
    tips.forEach((t, i) => {
      if (i < 3) seg(w2, dark, [0, 0, 0], t, 0.06, 0.015, 4);
      if (i < 3 && o.tier >= 3) seg(w2, ivory, t, [t[0] * 1.07, -0.05, t[2] * 1.07], 0.03, 0, 3);
      pts.push(t);
      const b = tips[i + 1];
      if (b) {
        pts.push([(t[0] + b[0]) * 0.41, (t[1] + b[1]) * 0.41, (t[2] + b[2]) * 0.41]);
        faces.push([0, 1 + 2 * i, 2 + 2 * i], [0, 2 + 2 * i, 3 + 2 * i]);
      }
    });
    part(w2, sheet(pts, faces), tint);
    seg(w2, ivory, [0, 0, 0], [s * 0.12, 0.06, 0.5], 0.06, 0, 4); // wrist claw
    return [w, w2];
  };
  const [wingR, wingR2] = wing(-1);
  const [wingL, wingL2] = wing(1);

  // hind legs: haunch, shin, clawed foot; claws touch y = 0
  const leg = (name: string, x: number) => {
    const g = pivot(body, name, x, -0.35, -0.45);
    part(g, ico(0.36, 0), red, 0, -0.1, 0).scale.set(0.8, 1.1, 1);
    seg(g, red, [0, -0.3, 0.05], [0, -1.0, 0.2], 0.15, 0.09, 5);
    part(g, box(0.26, 0.1, 0.36), dark, 0, -1.1, 0.26);
    for (let i = -1; i <= 1; i++) part(g, cone(0.045, 0.24, 4), ivory, i * 0.09, -1.1, 0.52, Math.PI / 2, 0, 0);
    return g;
  };
  const legR = leg("legR", -0.55);
  const legL = leg("legL", 0.55);

  // tail: three tapering segments and a spade tip
  const tail1 = pivot(body, "tail1", 0, 0, -1.3, -0.12);
  seg(tail1, red, [0, 0, 0], [0, 0, -1.0], 0.42, 0.3, 6);
  const tail2 = pivot(tail1, "tail2", 0, 0, -1.0, -0.1);
  seg(tail2, red, [0, 0, 0], [0, 0, -0.95], 0.3, 0.18, 6);
  const tail3 = pivot(tail2, "tail3", 0, 0, -0.95, 0.2);
  seg(tail3, red, [0, 0, 0], [0, 0, -0.9], 0.18, 0.07, 5);
  part(tail3, sheet([[0, 0, -0.8], [-0.3, 0, -1.1], [0, 0, -1.55], [0.3, 0, -1.1], [0, 0.12, -1.1]], [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [0, 2, 1], [0, 3, 2]]), dark);
  if (o.tier >= 2) {
    part(tail1, cone(0.08, 0.3, 4), dark, 0, 0.42, -0.4);
    part(tail2, cone(0.07, 0.26, 4), dark, 0, 0.3, -0.3);
    part(tail2, cone(0.06, 0.22, 4), dark, 0, 0.24, -0.75);
    part(tail3, cone(0.05, 0.2, 4), dark, 0, 0.16, -0.35);
  }

  // ---- v2 detail layer
  // flank scales: two rows of plates down each side
  for (const s of [-1, 1]) for (let row = 0; row < 2; row++) for (let i = 0; i < 5; i++) {
    const z = 0.9 - i * 0.42;
    const rr = Math.sqrt(1 - (z / 1.44) ** 2);
    const a = 0.75 - row * 0.5;
    part(body, cone(0.1, 0.26, 4), dark, s * 0.855 * rr * Math.cos(a), 0.765 * rr * Math.sin(a), z - 0.08, -0.6, 0, -s * (Math.PI / 2 - a));
  }
  // belly plates
  for (let i = 0; i < 5; i++) {
    const z = 0.9 - i * 0.45;
    const rr = Math.sqrt(1 - ((z - 0.05) / 1.24) ** 2);
    part(body, box(0.8 * rr, 0.08, 0.36), dark, 0, -0.3 - 0.6 * rr - 0.01, z);
  }
  // back spines are small on a young dragon (tier 2 and 3 grow their own)
  if (o.tier < 2) {
    for (let i = 0; i < 5; i++) {
      const z = 0.9 - i * 0.45;
      part(body, cone(0.07, 0.2, 4), dark, 0, 0.76 * Math.sqrt(1 - (z / 1.5) ** 2) + 0.06, z, -0.3, 0, 0);
    }
    part(tail1, cone(0.06, 0.18, 4), dark, 0, 0.4, -0.4);
    part(tail2, cone(0.05, 0.16, 4), dark, 0, 0.29, -0.3);
    part(tail2, cone(0.05, 0.14, 4), dark, 0, 0.23, -0.75);
    part(tail3, cone(0.04, 0.12, 4), dark, 0, 0.15, -0.35);
  }
  part(tail1, cone(0.07, 0.22, 4), dark, 0, 0.36, -0.8);
  for (const s of [-1, 1]) part(tail3, cone(0.05, 0.2, 4), dark, s * 0.1, 0, -0.7, 0, 0, -s * 1.4);
  // wing shoulders, thigh spikes, a rear claw on each foot
  for (const s of [-1, 1]) part(body, ico(0.34, 0), red, s * 0.5, 0.42, 0.45);
  for (const g of [legR, legL]) {
    part(g, cone(0.07, 0.26, 4), dark, 0, -0.05, -0.3, -2.0, 0, 0);
    part(g, cone(0.04, 0.18, 4), ivory, 0, -1.1, 0.08, -Math.PI / 2, 0, 0);
  }
  // neck fins and a throat pouch in the kingdom colour
  for (const z of [0.2, 0.8]) part(neck1, cone(0.06, 0.22, 4), dark, 0, 0.4, z);
  for (const z of [0.15, 0.72]) part(neck2, cone(0.055, 0.2, 4), dark, 0, 0.33, z);
  part(neck2, ico(0.2, 0), tint, 0, -0.2, 0.5);
  // head: cheek spikes, snout ridges, a crest, more teeth, a glowing tongue
  for (const s of [-1, 1]) {
    if (o.tier < 3) seg(head, ivory, [s * 0.28, -0.02, 0.2], [s * 0.5, -0.1, -0.25], 0.05, 0, 4);
    part(head, box(0.14, 0.05, 0.2), dark, s * 0.2, 0.3, 0.72, 0, 0, s * 0.3);
    for (const z of [0.95, 0.62]) part(head, cone(0.03, 0.11, 3), ivory, s * 0.15, -0.16, z, Math.PI, 0, 0);
    part(jaw, cone(0.03, 0.1, 3), ivory, s * 0.13, 0.03, 0.8);
    part(jaw, cone(0.03, 0.1, 3), ivory, s * 0.14, 0.03, 0.55);
  }
  for (const z of [0.05, -0.15]) part(head, cone(0.06, 0.2, 4), dark, 0, 0.3, z, -0.4, 0, 0);
  part(jaw, box(0.1, 0.02, 0.5), glow(0xffa040), 0, 0.02, 0.7);
  // wings: knuckles at the shoulder, wrist and mid-arm, a rib through the inner membrane
  for (const [w, w2, s] of [[wingR, wingR2, -1], [wingL, wingL2, 1]] as const) {
    part(w, ico(0.15, 0), dark, 0, 0, 0);
    part(w, ico(0.1, 0), dark, s * 0.8, 0.05, 0.08);
    part(w2, ico(0.12, 0), dark, 0, 0, 0);
    seg(w, dark, [s * 0.3, 0, -0.1], [s * 1.3, 0, -1.2], 0.04, 0.02, 4);
  }

  return finishModel(
    root,
    "dragon",
    { body, neck1, neck2, head, jaw, wingR, wingR2, wingL, wingL2, legR, legL, tail1, tail2, tail3 },
    {
      mouth: socketAt(head, "mouth", 0, -0.1, 1.25),
      chest: socketAt(body, "chest", 0, -0.1, 1.35),
      headTop: socketAt(head, "headTop", 0, 0.5, 0.1),
    },
  );
}
