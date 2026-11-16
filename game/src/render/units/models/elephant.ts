// War Elephant (rig "quadruped"): huge body, long tusks, a howdah with two spearmen on its back.
// Tramples small units. Tier 1 cloth; 2 iron head plate; 3 gold-capped tusks and a banner on the howdah.
// Bones: body (root), head, trunk1, trunk2, four legs, tail.
import * as THREE from "three";
import type { ModelOpts, UnitModel } from "../contract";
import { box, cone, cyl, finishModel, ico, lambert, part, pivot, seg, sheet, socketAt, taperBox, tintMat } from "./kit";
import { crew, PAL } from "./kit-human";

export function build(o: ModelOpts): UnitModel {
  const root = new THREE.Group();
  const tint = tintMat(o.tint);
  const hide = lambert(0x8a8580);
  const hideDark = lambert(0x6f6a66);
  const ivory = lambert(0xefe6cf);
  const wood = lambert(PAL.wood);
  const iron = lambert(PAL.iron);
  const gold = lambert(PAL.gold);

  // body: big barrel 2.6 above the ground
  const body = pivot(root, "body", 0, 2.6, 0);
  part(body, ico(1.3, 1), hide, 0, 0, 0).scale.set(1.0, 0.95, 1.55);
  // blanket in the kingdom colour with a trim
  part(body, taperBox(2.5, 2.1, 1.3, 2.6, 2.3), tint, 0, 0.45, -0.1);
  part(body, box(2.56, 0.12, 2.66), lambert(o.crest), 0, -0.2, -0.1);

  // legs: thick columns, soles at y = 0
  const leg = (name: string, x: number, z: number) => {
    const g = pivot(body, name, x, -0.5, z);
    part(g, cyl(0.42, 0.36, 1.3, 7), hide, 0, -0.65, 0);
    part(g, cyl(0.36, 0.4, 0.8, 7), hideDark, 0, -1.7, 0);
    for (let i = -1; i <= 1; i++) part(g, box(0.14, 0.14, 0.1), ivory, i * 0.18, -2.02, 0.38);
    return g;
  };
  const legFR = leg("legFR", -0.72, 1.15);
  const legFL = leg("legFL", 0.72, 1.15);
  const legBR = leg("legBR", -0.72, -1.2);
  const legBL = leg("legBL", 0.72, -1.2);

  // head: dome, big ears, tusks; the trunk hangs from two bones
  const head = pivot(body, "head", 0, 0.35, 1.85);
  part(head, ico(0.85, 1), hide, 0, 0, 0.35).scale.set(0.95, 1.05, 0.95);
  for (const s of [-1, 1]) {
    part(head, sheet([[s * 0.5, 0.6, 0.2], [s * 1.75, 0.75, -0.1], [s * 1.85, -0.3, -0.2], [s * 1.2, -0.95, -0.1], [s * 0.55, -0.35, 0.15]], [[0, 1, 2], [0, 2, 3], [0, 3, 4]]), hideDark);
    seg(head, ivory, [s * 0.42, -0.5, 0.85], [s * 0.62, -1.15, 1.75], 0.13, 0.09, 5);
    seg(head, ivory, [s * 0.62, -1.15, 1.75], [s * 0.55, -0.85, 2.45], 0.09, 0, 5);
    if (o.tier >= 3) part(head, cyl(0.1, 0.11, 0.2, 5), gold, s * 0.6, -1.08, 1.65, 0.95, 0, 0);
    part(head, box(0.08, 0.1, 0.06), lambert(PAL.shadow), s * 0.52, 0.15, 0.98);
  }
  if (o.tier >= 2) {
    part(head, taperBox(0.9, 0.6, 1.0, 0.1), iron, 0, 0.25, 1.14, -0.2, 0, 0);
    part(head, cone(0.1, 0.4, 4), iron, 0, 0.55, 1.22, 1.2, 0, 0);
  }
  const trunk1 = pivot(head, "trunk1", 0, -0.35, 1.05, 0.2);
  seg(trunk1, hide, [0, 0, 0], [0, -1.1, 0.25], 0.3, 0.2, 6);
  const trunk2 = pivot(trunk1, "trunk2", 0, -1.1, 0.25, -0.3);
  seg(trunk2, hide, [0, 0, 0], [0, -1.0, 0.1], 0.2, 0.11, 6);
  seg(trunk2, hideDark, [0, -1.0, 0.1], [0, -1.15, 0.4], 0.11, 0.08, 5);

  const tail = pivot(body, "tail", 0, 0.4, -1.95);
  seg(tail, hideDark, [0, 0, 0], [0, -1.2, -0.25], 0.08, 0.04, 4);
  part(tail, ico(0.1, 0), lambert(PAL.shadow), 0, -1.25, -0.27);

  // howdah: a small wooden tower with a cloth roof and two spearmen
  const H = 1.15;
  part(body, box(1.7, 0.16, 2.0), wood, 0, H, -0.1);
  for (const [x, z] of [[-0.8, 0.85], [0.8, 0.85], [-0.8, -1.05], [0.8, -1.05]]) seg(body, wood, [x, H, z], [x, H + 1.5, z], 0.07, 0.07, 4);
  part(body, box(1.74, 0.6, 0.08), tint, 0, H + 0.38, 0.88);
  part(body, box(1.74, 0.6, 0.08), tint, 0, H + 0.38, -1.08);
  part(body, box(0.08, 0.6, 2.0), tint, -0.84, H + 0.38, -0.1);
  part(body, box(0.08, 0.6, 2.0), tint, 0.84, H + 0.38, -0.1);
  part(body, taperBox(2.0, 0.3, 0.7, 2.3, 0.4), tint, 0, H + 1.85, -0.1);
  crew(body, tint, -0.35, H + 0.08, 0.35, 0.1, 0.42);
  crew(body, tint, 0.35, H + 0.08, -0.5, -0.2, 0.42);
  seg(body, wood, [-0.6, H + 0.4, 0.5], [-0.75, H + 2.6, 1.1], 0.03, 0.03, 4);
  part(body, cone(0.07, 0.3, 4), iron, -0.77, H + 2.75, 1.14, 0.25, 0, 0.07);
  if (o.tier >= 3) {
    seg(body, wood, [0.8, H + 1.5, -1.05], [0.8, H + 3.2, -1.05], 0.04, 0.03, 4);
    part(body, sheet([[0.8, H + 3.15, -1.05], [0.8, H + 2.4, -1.05], [0.8, H + 2.6, -1.95], [0.8, H + 3.05, -1.75]], [[0, 1, 2], [0, 2, 3]]), tint);
  }

  return finishModel(root, "quadruped", { body, head, trunk1, trunk2, legFR, legFL, legBR, legBL, tail }, {
    headTop: socketAt(body, "headTop", 0, H + 2.3, -0.1),
    chest: socketAt(body, "chest", 0, 0, 1.6),
    saddle: socketAt(body, "saddle", 0, H + 0.1, -0.1),
    tusk: socketAt(head, "tusk", 0, -0.85, 2.45),
  });
}
