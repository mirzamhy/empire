// Landmarks of the map (sim/maps.ts): static low-poly scenery with a name. They never block
// troops; the map keeps castles and trees off their footprint and levels the ground under them.
//
// Sizes are set against the trees (5 to 7 m) and the ranges (up to 47 m): big enough to read
// from the overview camera, far smaller than a mountain. Models face +Z; +Y is up.
import * as THREE from "three";
import type { LandmarkKind } from "../sim/maps";
import type { WorldMap } from "../sim/map";
import { bakeGroup, instancedMaterial } from "./bake";
import { box, cone, cyl, glow, ico, lambert, part, seg, taperBox } from "./units/models/kit";

const STONE = 0x8c8982;
const STONE_DARK = 0x66635e;
const STONE_PALE = 0xb2aea4;
const MOSS = 0x3f5a2e;
const BONE = 0xd9d1b8;
const BONE_DARK = 0xb3aa90;
const WOOD = 0x4a3220;

/** Skeleton of a huge dragon, half sunk in the ground: skull, arching ribs, a trailing tail. 30 m. */
function dragonBones(): THREE.Group {
  const g = new THREE.Group();
  const bone = lambert(BONE);
  const dark = lambert(BONE_DARK);
  const moss = lambert(MOSS);
  // skull, tilted as if it came to rest on its jaw
  const skull = new THREE.Group();
  skull.position.set(0.6, 1.5, 12.2);
  skull.rotation.set(0.16, 0.22, 0.1);
  g.add(skull);
  part(skull, taperBox(3.4, 2.6, 2.3, 3.6, 2.6), bone, 0, 0.5, -0.6);
  part(skull, taperBox(2.2, 1.0, 1.5, 3.6, 3.0), bone, 0, 0.1, 2.4, 0.12);
  part(skull, taperBox(1.9, 0.8, 0.5, 3.4, 3.0), dark, 0, -0.9, 2.2, -0.2);
  for (const s of [-1, 1]) {
    part(skull, box(0.7, 0.75, 0.9), lambert(0x241f1a), s * 1.15, 0.75, 0.5);
    seg(skull, bone, [s * 1.2, 1.5, -1.4], [s * 2.3, 3.4, -4.6], 0.42, 0.06, 5);
    seg(skull, dark, [s * 1.5, 0.4, -1.6], [s * 2.9, 0.9, -3.6], 0.3, 0.05, 5);
    for (let i = 0; i < 5; i++) part(skull, cone(0.13, 0.55, 4), bone, s * (0.85 - i * 0.12), -0.62, 1.2 + i * 0.55, Math.PI);
  }
  part(skull, ico(0.9), moss, -0.7, 1.75, -0.9).scale.set(1.4, 0.35, 1.2);
  // spine: rises out of the ground behind the skull, then sinks toward the tail
  const spineY = (z: number) => 0.4 + 2.5 * Math.sin(Math.max(0, Math.min(1, (z + 7) / 17)) * Math.PI) ** 0.8;
  for (let i = 0; i < 15; i++) {
    const z = 10 - i * 1.25;
    const r = 0.72 - Math.abs(i - 6) * 0.03;
    part(g, ico(r), i % 2 ? bone : dark, Math.sin(i * 0.5) * 0.3, spineY(z), z).scale.set(1.15, 0.9, 1);
    if (i > 0 && i < 12) part(g, cone(0.2, 1.3 - Math.abs(i - 6) * 0.07, 4), bone, Math.sin(i * 0.5) * 0.3, spineY(z) + 0.95, z, -0.25);
  }
  // ribs: tall in the middle of the chest, a few snapped
  for (let i = 0; i < 8; i++) {
    const z = 8.2 - i * 1.55;
    const k = 0.62 + 0.38 * Math.sin(((i + 0.6) / 8.2) * Math.PI);
    const y0 = spineY(z);
    for (const s of [-1, 1]) {
      const broken = (i === 2 && s === 1) || (i === 6 && s === -1);
      const a = [s * 0.5, y0, z];
      const b = [s * 3.0 * k, y0 + 1.6 * k, z - 0.3];
      const c = [s * 4.3 * k, y0 + 4.6 * k, z - 0.5];
      const d = [s * 3.1 * k, y0 + 7.4 * k, z - 0.4];
      seg(g, bone, a, b, 0.34, 0.3, 5);
      seg(g, bone, b, c, 0.3, 0.22, 5);
      if (!broken) seg(g, dark, c, d, 0.22, 0.05, 5);
      else seg(g, dark, [s * 5.4 * k, 0.25, z + 0.8], [s * 7.6 * k, 0.3, z - 1.6], 0.2, 0.05, 5);
    }
  }
  // tail: vertebrae shrinking as they trail off and sink into the ground
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    part(g, ico(0.55 - t * 0.36), i % 2 ? dark : bone, Math.sin(i * 0.7) * (0.6 + t * 1.6), 0.5 - t * 0.35, -9.4 - i * 0.8);
  }
  // one fore leg lying beside the chest
  seg(g, bone, [-4.2, 0.4, 6.5], [-7.4, 0.5, 8.2], 0.4, 0.3, 5);
  seg(g, dark, [-7.4, 0.5, 8.2], [-8.4, 0.35, 11.2], 0.3, 0.2, 5);
  for (let i = -1; i <= 1; i++) part(g, cone(0.16, 1.2, 4), bone, -8.5 + i * 0.5, 0.3, 12.0, Math.PI / 2 + 0.1);
  return g;
}

/** Stone tower guarding a pass, with a signal fire on top. 13 m. */
function watchtower(): THREE.Group {
  const g = new THREE.Group();
  const stone = lambert(STONE);
  const dark = lambert(STONE_DARK);
  const wood = lambert(WOOD);
  part(g, cyl(2.9, 3.4, 1.2, 8), dark, 0, 0.3, 0);
  part(g, cyl(2.2, 2.7, 9.2, 8), stone, 0, 5.2, 0);
  part(g, cyl(2.9, 2.3, 0.8, 8), dark, 0, 10.0, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(g, box(0.9, 0.9, 0.5), stone, Math.cos(a) * 2.65, 10.85, Math.sin(a) * 2.65, 0, -a + Math.PI / 2);
  }
  // door, arrow slits, a band of darker stone
  part(g, box(1.0, 1.9, 0.3), wood, 0, 1.45, 2.62);
  for (let i = 0; i < 3; i++) part(g, box(0.25, 0.9, 0.2), lambert(0x1f1c19), Math.sin(i * 2.1) * 2.3, 4.2 + i * 2.2, Math.cos(i * 2.1) * 2.3, 0, i * 2.1);
  part(g, cyl(2.42, 2.46, 0.35, 8), dark, 0, 6.6, 0);
  // signal fire: an iron basket of burning wood
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    seg(g, wood, [Math.cos(a) * 0.9, 10.4, Math.sin(a) * 0.9], [Math.cos(a) * 0.55, 11.7, Math.sin(a) * 0.55], 0.09, 0.09, 4);
  }
  part(g, cyl(0.85, 0.6, 0.35, 6), lambert(0x2a2622), 0, 11.75, 0);
  part(g, cone(0.6, 1.5, 5), glow(0xff8a2a), 0, 12.65, 0);
  part(g, cone(0.34, 1.0, 4), glow(0xffd070), 0.1, 12.6, 0.1);
  // rubble at the foot
  part(g, ico(0.9), dark, 2.9, 0.3, 1.6).scale.set(1.2, 0.7, 1);
  part(g, ico(0.6), stone, -2.7, 0.25, -1.9);
  return g;
}

/** Ruin of an old castle: broken curtain walls, a snapped tower and a gate arch. 30 x 24 m. */
function ruins(): THREE.Group {
  const g = new THREE.Group();
  const stone = lambert(STONE);
  const dark = lambert(STONE_DARK);
  const pale = lambert(STONE_PALE);
  const moss = lambert(MOSS);
  /** A stretch of wall from (x0, z0) to (x1, z1) with a ragged top. */
  const wall = (x0: number, z0: number, x1: number, z1: number, heights: number[]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = -Math.atan2(z1 - z0, x1 - x0);
    const n = heights.length;
    heights.forEach((h, i) => {
      if (h <= 0) return;
      const t = (i + 0.5) / n;
      const m = part(g, box(len / n + 0.05, h, 1.5), i % 3 === 1 ? dark : stone, x0 + (x1 - x0) * t, h / 2 - 0.2, z0 + (z1 - z0) * t, 0, ang);
      m.scale.y = 1;
      if (h > 3 && i % 2 === 0) part(g, box(len / n * 0.5, 0.8, 1.5), pale, x0 + (x1 - x0) * t, h + 0.2, z0 + (z1 - z0) * t, 0, ang);
      if (i % 4 === 2) part(g, ico(0.9), moss, x0 + (x1 - x0) * t, h - 0.15, z0 + (z1 - z0) * t).scale.set(1.5, 0.3, 1.1);
    });
  };
  wall(-14, -10, 6, -10, [5.5, 6.2, 4.4, 5.8, 3.0, 1.4, 0, 2.2]);
  wall(-14, -10, -14, 9, [6.0, 4.8, 5.4, 2.6, 0.9, 0, 3.4]);
  wall(-14, 9, -4, 9, [3.6, 5.0, 4.2]);
  wall(4, 9, 13, 9, [4.6, 2.4, 1.1]);
  wall(13, -4, 13, 9, [1.2, 2.8, 4.9, 3.8]);
  // gate: two piers and half an arch
  part(g, box(1.8, 6.4, 1.9), stone, -2.4, 3.0, 9);
  part(g, box(1.8, 5.2, 1.9), dark, 2.4, 2.4, 9);
  part(g, box(2.4, 1.0, 1.9), pale, -1.0, 6.6, 9, 0, 0, -0.25);
  // corner tower, snapped, its top lying beside it
  part(g, cyl(3.0, 3.4, 8.5, 8), stone, 11.5, 4.0, -8.5);
  part(g, cyl(3.2, 3.0, 0.9, 8), dark, 11.5, 8.5, -8.5, 0.1, 0, 0.12);
  part(g, cyl(2.6, 2.9, 3.6, 8), dark, 15.5, 1.2, -4.5, 0, 0, 1.35);
  // keep: a low shell in the middle
  part(g, box(7, 3.2, 1.3), stone, -3, 1.4, -3);
  part(g, box(1.3, 4.4, 6), dark, -6.5, 2.0, 0);
  part(g, box(1.3, 2.0, 5), stone, 0.5, 0.8, -0.3);
  // fallen blocks and moss
  for (const [x, z, s, r] of [[-9, 4, 1.3, 0.4], [3, 3, 1.0, 1.1], [7, -3, 1.6, 0.7], [-1, 12, 1.1, 0.2], [9, 5, 0.9, 1.6], [-11, -4, 1.2, 0.9], [5, -13, 1.4, 0.5]]) {
    part(g, box(1.5 * s, 0.9 * s, 1.1 * s), s > 1.2 ? dark : pale, x, 0.3 * s, z, 0.15, r, 0.1);
  }
  for (const [x, z] of [[-10, -8], [8, 7], [-12, 6], [2, -9]]) part(g, ico(1.6), moss, x, 0.1, z).scale.set(1.6, 0.25, 1.3);
  return g;
}

/** One ancient tree standing far above the canopy, on great roots. 22 m. */
function greatTree(): THREE.Group {
  const g = new THREE.Group();
  const bark = lambert(0x3d2a1c);
  const barkPale = lambert(0x554030);
  const leaves = [0x24542a, 0x2e6430, 0x1e4a26, 0x3a6e30].map(lambert);
  part(g, cyl(1.5, 2.6, 9.5, 7), bark, 0, 4.4, 0);
  part(g, cyl(1.1, 1.5, 4.5, 7), bark, 0.2, 11.2, -0.1, 0.05, 0, 0.04);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const len = 4.6 + (i % 3) * 1.1;
    seg(g, i % 2 ? barkPale : bark, [Math.cos(a) * 1.5, 2.3, Math.sin(a) * 1.5], [Math.cos(a) * len, -0.3, Math.sin(a) * len], 0.85, 0.28, 5);
  }
  const boughs: [number, number, number, number][] = [[0.4, 9.5, 7.5, 5.2], [1.7, 10.5, 8.0, 5.8], [2.9, 9.0, 7.0, 5.0], [4.1, 11.0, 7.8, 5.6], [5.3, 9.8, 6.8, 4.8]];
  boughs.forEach(([a, y, reach, r], i) => {
    const tip = [Math.cos(a) * reach, y + 4.2, Math.sin(a) * reach];
    seg(g, bark, [Math.cos(a) * 0.8, y, Math.sin(a) * 0.8], tip, 0.6, 0.25, 5);
    part(g, ico(r), leaves[i % leaves.length], tip[0], tip[1] + 1.2, tip[2]).scale.set(1.15, 0.72, 1.15);
    part(g, ico(r * 0.6), leaves[(i + 2) % leaves.length], tip[0] * 1.25, tip[1] - 0.4, tip[2] * 1.25).scale.set(1.1, 0.7, 1.1);
  });
  part(g, ico(6.4), leaves[0], 0, 17.6, 0).scale.set(1.2, 0.72, 1.2);
  part(g, ico(4.2), leaves[3], 1.5, 20.6, -1.0).scale.set(1.1, 0.7, 1.1);
  // a hollow at the foot with a faint glow inside
  part(g, box(1.1, 1.7, 0.4), lambert(0x15100c), 0, 1.2, 2.45);
  part(g, ico(0.22), glow(0xbfe86a), 0.1, 1.3, 2.5);
  return g;
}

/** Ring of standing stones on the moor, some fallen, around a slab that glows faintly. 20 m across. */
function stoneCircle(): THREE.Group {
  const g = new THREE.Group();
  const stone = lambert(STONE);
  const dark = lambert(STONE_DARK);
  const moss = lambert(MOSS);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 9;
    const z = Math.sin(a) * 9;
    const h = 3.3 + ((i * 7) % 5) * 0.28;
    if (i === 3 || i === 8) {
      // fallen
      part(g, taperBox(1.5, 1.2, h, 0.95), dark, x * 1.08, 0.4, z * 1.08, Math.PI / 2 - 0.08, -a + 0.5);
      continue;
    }
    part(g, taperBox(1.55, 1.15, h, 0.95, 0.8), i % 2 ? stone : dark, x, h / 2 - 0.25, z, ((i % 3) - 1) * 0.05, -a + Math.PI / 2, ((i % 4) - 1.5) * 0.04);
    if (i % 4 === 1) part(g, ico(0.5), moss, x, h - 0.25, z).scale.set(1.5, 0.35, 1.1);
    // lintels across two pairs of neighbours
    if (i === 0 || i === 5) {
      const a2 = ((i + 1) / n) * Math.PI * 2;
      const mx = ((Math.cos(a) + Math.cos(a2)) / 2) * 9;
      const mz = ((Math.sin(a) + Math.sin(a2)) / 2) * 9;
      part(g, box(5.6, 0.75, 1.1), stone, mx, 3.75, mz, 0, -(a + a2) / 2 + Math.PI / 2);
    }
  }
  // the slab in the middle and its rune light
  part(g, cyl(2.3, 2.6, 0.9, 7), dark, 0, 0.3, 0);
  part(g, cyl(1.5, 1.5, 0.08, 7), glow(0x58d8c8), 0, 0.78, 0);
  part(g, new THREE.OctahedronGeometry(0.55, 0), glow(0x9af0e4), 0, 1.75, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    part(g, taperBox(0.6, 0.4, 1.3, 0.45), stone, Math.cos(a) * 4.4, 0.45, Math.sin(a) * 4.4, 0, -a);
  }
  return g;
}

/** Stone lighthouse on a headland. 14 m. */
function lighthouse(): THREE.Group {
  const g = new THREE.Group();
  const pale = lambert(0xc9c4b6);
  const dark = lambert(STONE_DARK);
  for (const [x, z, s] of [[0, 0, 3.4], [2.6, 1.2, 1.9], [-2.4, -1.4, 2.1], [1.0, -2.6, 1.6]]) part(g, ico(s), dark, x, 0.2, z).scale.set(1.2, 0.45, 1.1);
  part(g, cyl(1.55, 2.3, 9.6, 8), pale, 0, 5.6, 0);
  part(g, cyl(1.9, 2.0, 0.7, 8), lambert(0x6d3a2c), 0, 3.6, 0);
  part(g, cyl(1.72, 1.8, 0.7, 8), lambert(0x6d3a2c), 0, 7.4, 0);
  part(g, cyl(2.1, 1.7, 0.45, 8), dark, 0, 10.6, 0);
  part(g, cyl(1.15, 1.15, 1.5, 8), glow(0xffe08a), 0, 11.55, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    part(g, box(0.16, 1.5, 0.16), dark, Math.cos(a) * 1.2, 11.55, Math.sin(a) * 1.2);
  }
  part(g, cone(1.6, 1.7, 8), lambert(0x5a2f24), 0, 13.15, 0);
  part(g, box(0.9, 1.7, 0.3), lambert(WOOD), 0, 1.7, 2.15);
  return g;
}

const BUILD: Record<LandmarkKind, () => THREE.Group> = { dragonBones, watchtower, ruins, greatTree, stoneCircle, lighthouse };

export class LandmarkRenderer {
  readonly group = new THREE.Group();

  constructor(map: WorldMap) {
    const mat = instancedMaterial();
    const geos = new Map<LandmarkKind, THREE.BufferGeometry>();
    for (const l of map.landmarks) {
      let geo = geos.get(l.kind);
      if (!geo) geos.set(l.kind, (geo = bakeGroup(BUILD[l.kind]())));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `landmark:${l.name}`;
      mesh.position.set(l.x, map.heightAt(l.x, l.z), l.z);
      mesh.rotation.y = l.rot;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }
}
