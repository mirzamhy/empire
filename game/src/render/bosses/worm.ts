// Cacing Pasir: the regional boss of the desert maps (Gerbang Batu Merah). A great worm of ringed
// armour the colour of the dunes: each ring flares toward the tail and overlaps the one below like
// shingles, raw red flesh showing in the folds between them, a heavy shield over the back with a row
// of hooked spines (bone-white at the tips), pale belly scutes, and sand and stones still caked on
// the lower rings. The head is a collar of hooked spikes round a mouth that opens in four armoured
// petals lined with teeth, rings of fangs going down into a throat that glows like a furnace, and
// two hooked tongues reaching out of it. It arches out of the sand; most of it stays under the
// ground.
//
// Own rig: s0 (at the ground) > s1 > ... > s9 > head > p0..p3 (the petals). Segments run along +Y and
// bend on X (the animator curls them into an arch); the back is -Z, the belly +Z. The mouth faces
// along the head's +Y; the petals open by turning outward on their own X.
import * as THREE from "three";
import { cone, cyl, glow, ico, lambert, part, pivot, ring, seg, sheet, socketAt } from "../units/models/kit";
import type { BossModel } from "./titan";

export const WORM_SEGS = 10;
export const WORM_SEG_LEN = 0.72;

/** A curved band of a ring (an arc of a tube), centred on angle `at` (0 = +Z, PI = -Z). */
const arc = (rTop: number, rBottom: number, h: number, at: number, width: number, sides = 8) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, sides, 1, false, at - width / 2, width);

/** A two-sided plate from rows of [halfWidth, y, z] down its middle to a point at the tip. */
function plate(rows: number[][], tip: number[]): THREE.BufferGeometry {
  const pts: number[][] = [];
  for (const [w, y, z] of rows) pts.push([-w, y, z], [w, y, z]);
  pts.push(tip);
  const f: number[][] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = i * 2;
    f.push([a, a + 1, a + 3], [a, a + 3, a + 2]);
  }
  const last = (rows.length - 1) * 2;
  f.push([last, last + 1, last + 2]);
  // both windings, so it reads from inside the mouth and from outside
  return sheet(pts, [...f, ...f.map(([a, b, c]) => [a, c, b])]);
}

export function buildWorm(): BossModel {
  const root = new THREE.Group();
  const armour = lambert(0xc49a5e);
  const armourDark = lambert(0x8d6636);
  const rim = lambert(0xe6cd98);
  const belly = lambert(0xdcc196);
  const fold = lambert(0x6e2e22);
  const spine = lambert(0x3e2c1c);
  const spineTip = lambert(0xece0c4);
  const sand = lambert(0xd9bf86);
  const stone = lambert(0x8f7350);
  const tooth = lambert(0xf3ead2);
  const gum = lambert(0x8a2c26);
  const gumDeep = lambert(0x4a1414);
  const tongue = lambert(0xa8443a);
  const throat = glow(0xff8a2a);
  const deep = glow(0xffd36a);
  const eye = glow(0xffb02a);
  const glows = [throat, deep, eye];
  const bones: Record<string, THREE.Object3D> = {};
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const L = WORM_SEG_LEN;

  // ---------------------------------------------------------------- body rings
  let parent: THREE.Object3D = root;
  for (let i = 0; i < WORM_SEGS; i++) {
    const s = pivot(parent, `s${i}`, 0, i === 0 ? 0 : L, 0);
    bones[`s${i}`] = s;
    const k = i / (WORM_SEGS - 1);
    // thickest at the ground, a little slimmer up the neck
    const r = 0.96 - k * 0.16 + Math.sin(k * Math.PI) * 0.05;
    // the soft flesh: a ball at the joint (so the arch never opens a gap) and the tube between
    part(s, ico(r * 0.93, 1), fold, 0, 0, 0).scale.set(1, 0.55, 1);
    part(s, cyl(r * 0.9, r * 0.9, L, 12), fold, 0, L * 0.5, 0);
    // the armoured ring, flaring toward the tail so it overlaps the ring below, and its worn rim
    part(s, cyl(r * 0.97, r * 1.1, L * 0.74, 14), i % 2 ? armour : armourDark, 0, L * 0.5, 0);
    part(s, cyl(r * 1.12, r * 1.12, 0.07, 14), rim, 0, L * 0.14, 0);
    // a heavier shield over the back with a ridge down its middle
    part(s, arc(r * 1.15, r * 1.25, L * 0.66, Math.PI, Math.PI * 0.8, 9), armourDark, 0, L * 0.52, 0);
    part(s, arc(r * 1.27, r * 1.3, 0.06, Math.PI, Math.PI * 0.8, 9), rim, 0, L * 0.2, 0);
    // pale belly scutes in two rows
    part(s, arc(r * 1.12, r * 1.14, L * 0.3, 0, Math.PI * 0.55, 7), belly, 0, L * 0.34, 0);
    part(s, arc(r * 1.1, r * 1.12, L * 0.28, 0, Math.PI * 0.5, 7), belly, 0, L * 0.68, 0);
    // a hooked spine on the back, curling down toward the tail like a grapple, its tip bleached
    const zb = -r * 1.24;
    const big = 1 + (i > 2 && i < 8 ? 0.25 : 0);
    seg(s, spine, [0, L * 0.4, zb], [0, L * 0.62, zb - 0.42 * big], 0.12, 0.065, 5);
    seg(s, spineTip, [0, L * 0.62, zb - 0.42 * big], [0, L * 0.32, zb - 0.7 * big], 0.065, 0, 5);
    // smaller hooks down both flanks of the back on every other ring
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const a = Math.PI + side * 0.75;
        const bx = Math.sin(a) * r * 1.2;
        const bz = Math.cos(a) * r * 1.2;
        const tx = Math.sin(a) * (r * 1.2 + 0.32);
        const tz = Math.cos(a) * (r * 1.2 + 0.32);
        seg(s, spine, [bx, L * 0.45, bz], [tx, L * 0.55, tz], 0.07, 0.035, 4);
        seg(s, spineTip, [tx, L * 0.55, tz], [tx * 1.05, L * 0.3, tz * 1.05], 0.035, 0, 4);
      }
    }
    // breathing pores along the sides, dark holes between the shield and the belly
    for (const side of [-1, 1]) part(s, ico(0.07, 0), gumDeep, side * r * 1.08, L * 0.5, 0.1);
    // sand and stones caked on the lower rings, thinning out higher up
    const crust = i < 3 ? 6 : i < 6 ? 3 : 1;
    for (let c = 0; c < crust; c++) {
      const a = rnd() * Math.PI * 2;
      const rr = r * 1.1;
      const size = 0.09 + rnd() * 0.12;
      const clump = part(s, ico(size, 0), rnd() < 0.65 ? sand : stone, Math.sin(a) * rr, L * (0.15 + rnd() * 0.7), Math.cos(a) * rr);
      clump.scale.set(1.3, 0.7, 1.1);
      clump.rotation.set(rnd() * 3, rnd() * 3, 0);
    }
    parent = s;
  }

  // ---------------------------------------------------------------- head
  const head = pivot(parent, "head", 0, L, 0);
  bones.head = head;
  // the collar: a flared ring of plates, a worn rim, and a crown of hooked spikes round it
  part(head, ico(0.8, 1), fold, 0, 0, 0).scale.set(1, 0.5, 1);
  part(head, cyl(1.12, 0.86, 0.52, 16), armourDark, 0, 0.22, 0);
  part(head, ring(1.1, 0.08, 16), rim, 0, 0.48, 0, Math.PI / 2, 0, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const base = [Math.sin(a) * 1.0, 0.18, Math.cos(a) * 1.0];
    const mid = [Math.sin(a) * 1.38, 0.28, Math.cos(a) * 1.38];
    const tip = [Math.sin(a) * 1.55, 0.62, Math.cos(a) * 1.55];
    seg(head, spine, base, mid, 0.09, 0.05, 4);
    seg(head, spineTip, mid, tip, 0.05, 0, 4);
  }
  // small glowing eyes in clusters on the brow and the sides, the only sign it sees
  for (let i = 0; i < 4; i++) part(head, ico(0.065, 0), eye, (i - 1.5) * 0.22, 0.3, -1.0);
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) part(head, ico(0.05, 0), eye, side * 1.0, 0.25 + i * 0.12, -0.25 - i * 0.12);
  // the mouth: gums, three rings of teeth going down, and the burning throat at the bottom
  part(head, cyl(0.9, 0.62, 0.08, 16), gum, 0, 0.5, 0);
  part(head, cyl(0.6, 0.45, 0.3, 12), gumDeep, 0, 0.32, 0);
  part(head, cyl(0.44, 0.44, 0.04, 12), throat, 0, 0.3, 0);
  part(head, cyl(0.22, 0.22, 0.04, 8), deep, 0, 0.2, 0);
  for (const [n, r, y, len] of [[18, 0.76, 0.5, 0.4], [14, 0.58, 0.4, 0.32], [10, 0.38, 0.3, 0.24]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + y;
      // each tooth leans in toward the throat
      const t = part(head, cone(0.055, len, 4), tooth, Math.sin(a) * r, y, Math.cos(a) * r);
      t.rotation.set(Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0);
    }
  }
  // two hooked tongues reaching up out of the throat, a beak of fangs at each tip
  for (const side of [-1, 1]) {
    const pts: number[][] = [];
    for (let t = 0; t <= 4; t++) pts.push([side * (0.12 + t * 0.07), 0.3 + t * 0.2 - t * t * 0.012, side * 0.05 - t * t * 0.02]);
    for (let t = 0; t < 4; t++) seg(head, tongue, pts[t], pts[t + 1], 0.1 - t * 0.016, 0.084 - t * 0.016, 6);
    const end = pts[4];
    for (let f = 0; f < 3; f++) {
      const a = (f / 3) * Math.PI * 2;
      seg(head, tooth, end, [end[0] + Math.sin(a) * 0.1, end[1] + 0.16, end[2] + Math.cos(a) * 0.1], 0.03, 0, 4);
    }
  }

  // four petals round the mouth; each is an armoured, banded plate lined with teeth on the inside
  const rows = [[0.64, 0, 0], [0.6, 0.45, -0.08], [0.48, 0.9, -0.26], [0.3, 1.25, -0.46]];
  const tipPt = [0, 1.55, -0.66];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const hinge = pivot(head, `p${i}`, Math.sin(a) * 0.92, 0.46, Math.cos(a) * 0.92, 0, a, 0);
    bones[`p${i}`] = hinge;
    // the outer armour and, just inside it, the gum it is lined with
    part(hinge, plate(rows, tipPt), armour);
    part(hinge, plate(rows.map(([w, y, z]) => [w * 0.9, y + 0.04, z - 0.07]), [0, 1.42, -0.7]), gum);
    // bands across the outside and a raised keel down the middle with small hooks on it
    for (let b = 1; b < rows.length; b++) {
      const [w, y, z] = rows[b];
      seg(hinge, armourDark, [-w * 0.95, y, z + 0.04], [w * 0.95, y, z + 0.04], 0.045, 0.045, 4);
    }
    seg(hinge, spine, [0, 0.1, 0.06], [0, 1.0, -0.2], 0.08, 0.05, 4);
    seg(hinge, spine, [0, 1.0, -0.2], [0, 1.5, -0.6], 0.05, 0.02, 4);
    for (const y of [0.35, 0.75]) seg(hinge, spineTip, [0, y, 0.0 - y * 0.25], [0, y + 0.06, 0.22 - y * 0.25], 0.04, 0, 4);
    // teeth down both edges and a pair of long fangs near the tip, all pointing into the mouth
    for (let e = 0; e < 5; e++) {
      const t = 0.1 + e * 0.2;
      const row = Math.min(rows.length - 2, Math.floor(t * (rows.length - 1)));
      const f = t * (rows.length - 1) - row;
      const [w0, y0, z0] = rows[row];
      const [w1, y1, z1] = rows[row + 1];
      const w = w0 + (w1 - w0) * f;
      const y = y0 + (y1 - y0) * f;
      const z = z0 + (z1 - z0) * f - 0.08;
      for (const side of [-1, 1]) seg(hinge, tooth, [side * w * 0.85, y, z], [side * w * 0.55, y + 0.05, z - 0.3], 0.05, 0, 4);
    }
    for (const side of [-1, 1]) seg(hinge, tooth, [side * 0.12, 1.2, -0.55], [side * 0.08, 1.15, -0.98], 0.06, 0, 4);
  }

  return {
    root,
    bones,
    sockets: {
      mouth: socketAt(head, "mouth", 0, 0.8, 0),
      core: socketAt(head, "core", 0, 0.2, 0),
    },
    glows,
  };
}
