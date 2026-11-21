// Cacing Pasir: the regional boss of the desert maps (Gerbang Batu Merah). A great worm of ringed,
// armoured segments the colour of the dunes, a row of hooked spines down its back, and a round
// mouth that opens in four petals lined with teeth, rings of fangs going down into a throat that
// glows like a furnace. It arches out of the sand; most of it stays under the ground.
//
// Own rig: s0 (at the ground) > s1 > ... > s9 > head > p0..p3 (the petals). Segments run along +Y
// and bend on X (the animator curls them into an arch); the back is -Z, the belly +Z. The mouth
// faces along the head's +Y; the petals open by turning outward on their own X.
import * as THREE from "three";
import { cone, cyl, glow, ico, lambert, part, pivot, ring, seg, sheet, socketAt } from "../units/models/kit";
import type { BossModel } from "./titan";

export const WORM_SEGS = 10;
export const WORM_SEG_LEN = 0.72;

export function buildWorm(): BossModel {
  const root = new THREE.Group();
  const plate = lambert(0xc49a5e);
  const plateDark = lambert(0x8d6636);
  const flesh = lambert(0xd9b98a);
  const fold = lambert(0x6b4a28);
  const spine = lambert(0x3e2c1c);
  const tooth = lambert(0xf3ead2);
  const gum = lambert(0x7a2a24);
  const throat = glow(0xff8a2a);
  const deep = glow(0xffd36a);
  const eye = glow(0xffb02a);
  const glows = [throat, deep, eye];
  const bones: Record<string, THREE.Object3D> = {};

  let parent: THREE.Object3D = root;
  for (let i = 0; i < WORM_SEGS; i++) {
    const s = pivot(parent, `s${i}`, 0, i === 0 ? 0 : WORM_SEG_LEN, 0);
    bones[`s${i}`] = s;
    const r = 0.78 + Math.sin((i / WORM_SEGS) * Math.PI) * 0.12;
    // an armoured ring, a softer fold between the rings, and a lighter belly plate
    part(s, cyl(r, r * 1.04, WORM_SEG_LEN * 0.82, 10), i % 2 ? plate : plateDark, 0, WORM_SEG_LEN * 0.45, 0);
    part(s, cyl(r * 0.9, r * 0.9, WORM_SEG_LEN, 10), fold, 0, WORM_SEG_LEN * 0.5, 0);
    part(s, ring(r * 1.02, 0.05, 12), plateDark, 0, WORM_SEG_LEN * 0.84, 0, Math.PI / 2, 0, 0);
    part(s, cyl(r * 0.75, r * 0.78, WORM_SEG_LEN * 0.7, 6), flesh, 0, WORM_SEG_LEN * 0.45, r * 0.32).scale.set(0.8, 1, 0.75);
    // hooked spines down the back, three on the bigger rings
    part(s, cone(0.1, 0.55, 4), spine, 0, WORM_SEG_LEN * 0.5, -r - 0.18, -1.9, 0, 0);
    if (i % 2 === 0) for (const k of [-1, 1]) part(s, cone(0.07, 0.36, 4), spine, k * r * 0.7, WORM_SEG_LEN * 0.5, -r * 0.72 - 0.1, -1.9, 0, k * 0.7);
    parent = s;
  }

  // ---------------------------------------------------------------- head and mouth
  const head = pivot(parent, "head", 0, WORM_SEG_LEN, 0);
  bones.head = head;
  part(head, cyl(1.0, 0.85, 0.5, 12), plateDark, 0, 0.2, 0);
  part(head, ring(0.98, 0.09, 14), plate, 0, 0.45, 0, Math.PI / 2, 0, 0);
  // small glowing eyes in a row on the brow ridge, the only sign it sees
  for (let i = 0; i < 4; i++) part(head, ico(0.06, 0), eye, (i - 1.5) * 0.22, 0.3, -0.92);
  // the mouth: gums, then three rings of teeth going down into the burning throat
  part(head, cyl(0.82, 0.6, 0.06, 14), gum, 0, 0.48, 0);
  part(head, cyl(0.42, 0.42, 0.04, 10), throat, 0, 0.32, 0);
  part(head, cyl(0.22, 0.22, 0.04, 8), deep, 0, 0.2, 0);
  for (const [n, r, y, len] of [[14, 0.72, 0.48, 0.38], [11, 0.55, 0.38, 0.3], [8, 0.36, 0.28, 0.22]] as const) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      // each tooth leans in toward the throat
      const t = part(head, cone(0.05, len, 4), tooth, Math.sin(a) * r, y, Math.cos(a) * r);
      t.rotation.set(Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0);
    }
  }
  // four petals around the mouth; each is a curved plate lined with teeth on the inside
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const hinge = pivot(head, `p${i}`, Math.sin(a) * 0.9, 0.45, Math.cos(a) * 0.9, 0, a, 0);
    bones[`p${i}`] = hinge;
    // the plate rises from the hinge, curving back over the mouth
    part(hinge, sheet([[-0.55, 0, 0], [0.55, 0, 0], [0.35, 1.1, -0.35], [0, 1.45, -0.55], [-0.35, 1.1, -0.35]], [[0, 1, 2], [0, 2, 4], [4, 2, 3], [0, 2, 1], [0, 4, 2], [4, 3, 2]]), plate);
    part(hinge, sheet([[-0.48, 0.05, -0.04], [0.48, 0.05, -0.04], [0.3, 1.0, -0.4], [0, 1.3, -0.58], [-0.3, 1.0, -0.4]], [[0, 2, 1], [0, 4, 2], [4, 3, 2]]), gum);
    for (let k = 0; k < 4; k++) {
      const y = 0.25 + k * 0.28;
      const x = (k % 2 ? 0.18 : -0.18) * (1 - k * 0.15);
      seg(hinge, tooth, [x, y, -0.08 - k * 0.1], [x * 0.8, y + 0.05, -0.45 - k * 0.1], 0.05, 0, 4);
    }
    seg(hinge, spine, [0, 0.2, 0.05], [0, 1.4, -0.4], 0.06, 0.02, 4); // the rib of the petal
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
