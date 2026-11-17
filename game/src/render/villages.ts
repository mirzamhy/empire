// Villages: half-timbered houses around a small square, one building that gives the village its
// character (windmill, chapel, tavern or smithy) and the clutter of village life (well, stall,
// hay, carts, fences, lanterns). Everything static is baked into one mesh per village.
// The flag takes the owner's colour, a second flag climbs the pole in the attacker's colour
// while the village is being taken, and the capture zone shows as a ring on the ground.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { Sim, Village } from "../sim/world";
import { bakeGroup, instancedMaterial } from "./bake";
import { THEME } from "./theme";
import { box, cone, cyl, glow, ico, lambert, part, seg, sheet, taperBox } from "./units/models/kit";

const PLASTER = [0xe4d6b6, 0xd3c29c, 0xece3cf, 0xc6b48e].map(lambert);
const TIMBER = lambert(0x47301f);
const WOOD = lambert(0x6b4a2a);
const PLANK = lambert(0x7a5632);
const STONE = lambert(0x8d8a83);
const STONE_DARK = lambert(0x66635e);
const STONE_PALE = lambert(0xb5afa2);
const WHITEWASH = lambert(0xd9d2c0);
const THATCH = [0xb0924e, 0x9a7e42, 0xbfa35c].map(lambert);
const THATCH_DARK = lambert(0x7d6634);
const TILE = [0x9c4a2f, 0x86402b, 0xab5a36].map(lambert);
const TILE_DARK = lambert(0x6a3122);
const SLATE = [0x4d5868, 0x5b6474].map(lambert);
const SLATE_DARK = lambert(0x394150);
const IRON = lambert(0x26272b);
const GOLD = lambert(0xf2c230);
const CLOTH = [0xe6dcc2, 0xb5533a, 0xd0a648].map(lambert);
const HAY = lambert(0xc9ab55);
const GREEN = lambert(0x5d8a3a);
const WATER = lambert(0x1e4254);
const WINDOW = glow(0xffc766);
const FIRE = glow(0xff7a2a);
const PLAZA = lambert(THEME.id === "dark" ? 0x6f6248 : 0x9a8762);
const PLAZA_PALE = lambert(THEME.id === "dark" ? 0x82745a : 0xae9b74);
const NEUTRAL = new THREE.Color(0xf4f1ea);

type Rnd = () => number;

/** Triangular prism: the wall under a gabled roof. Ridge along X, base on y = 0. */
function gable(len: number, span: number, h: number): THREE.BufferGeometry {
  const a = len / 2;
  const b = span / 2;
  return sheet(
    [[-a, 0, b], [a, 0, b], [a, 0, -b], [-a, 0, -b], [-a, h, 0], [a, h, 0]],
    [[0, 1, 5], [0, 5, 4], [2, 3, 4], [2, 4, 5], [3, 0, 4], [1, 2, 5]],
  );
}

/**
 * Gabled roof over a w x d box whose top is at y: two slabs, a ridge cap and the wall gables.
 * The ridge runs along X, or along Z (gable to the front) when `turned`.
 */
function gableRoof(
  g: THREE.Object3D, mat: THREE.Material, ridge: THREE.Material, wall: THREE.Material | null,
  w: number, d: number, y: number, h: number, over: number, turned = false,
): THREE.Group {
  const r = new THREE.Group();
  r.position.y = y;
  if (turned) r.rotation.y = Math.PI / 2;
  g.add(r);
  const len = turned ? d : w;
  const span = turned ? w : d;
  const b = span / 2 + over;
  const pitch = Math.atan2(h, b);
  const slope = Math.hypot(b, h) + 0.06;
  for (const s of [-1, 1]) part(r, box(len + over * 2, 0.09, slope), mat, 0, h / 2 - 0.06, (s * b) / 2, s * pitch);
  part(r, box(len + over * 2 + 0.06, 0.1, 0.2), ridge, 0, h - 0.03, 0);
  if (wall) part(r, gable(len, span, (h / b) * (span / 2)), wall, 0, -0.01, 0);
  return r;
}

/** Timber frame around a w x d storey between y0 and y1: posts, plates, studs and corner braces. */
function timbers(g: THREE.Object3D, w: number, d: number, y0: number, y1: number, studs: number, braces: boolean) {
  const h = y1 - y0;
  const ym = (y0 + y1) / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) part(g, box(0.1, h, 0.1), TIMBER, (sx * w) / 2, ym, (sz * d) / 2);
    for (const y of [y0 + 0.04, y1 - 0.04]) part(g, box(0.08, 0.08, d + 0.1), TIMBER, (sx * w) / 2, y, 0);
  }
  const bay = w / (studs + 1);
  for (const sz of [-1, 1]) {
    const z = sz * (d / 2 + 0.005);
    for (const y of [y0 + 0.04, y1 - 0.04]) part(g, box(w + 0.1, 0.08, 0.08), TIMBER, 0, y, (sz * d) / 2);
    for (let j = 1; j <= studs; j++) part(g, box(0.06, h, 0.05), TIMBER, -w / 2 + bay * j, ym, z);
    if (braces) {
      const len = Math.hypot(bay, h) - 0.08;
      const a = Math.atan2(h, bay);
      part(g, box(len, 0.06, 0.05), TIMBER, -w / 2 + bay / 2, ym, z, 0, 0, a);
      part(g, box(len, 0.06, 0.05), TIMBER, w / 2 - bay / 2, ym, z, 0, 0, -a);
    }
  }
}

/** Lit window with a dark frame on the face z (front, sz = 1, or back) or on a side face. */
function windowAt(g: THREE.Object3D, x: number, y: number, z: number, side = false, w = 0.24, h = 0.26) {
  if (side) {
    part(g, box(0.05, h + 0.1, w + 0.1), TIMBER, x, y, z);
    part(g, box(0.07, h, w), WINDOW, x, y, z);
  } else {
    part(g, box(w + 0.1, h + 0.1, 0.05), TIMBER, x, y, z);
    part(g, box(w, h, 0.07), WINDOW, x, y, z);
  }
}

function chimney(g: THREE.Object3D, x: number, z: number, y0: number, y1: number, s = 0.28) {
  part(g, box(s, y1 - y0, s), STONE, x, (y0 + y1) / 2, z);
  part(g, box(s + 0.08, 0.08, s + 0.08), STONE_DARK, x, y1, z);
  part(g, box(s - 0.1, 0.1, s - 0.1), IRON, x, y1 + 0.06, z);
}

/** Stone footing that reaches below the ground, so a house also sits on a slope. */
function footing(g: THREE.Object3D, w: number, d: number, mat = STONE) {
  part(g, box(w + 0.14, 0.95, d + 0.14), mat, 0, -0.3, 0);
}

function door(g: THREE.Object3D, x: number, z: number, w = 0.34, h = 0.62) {
  part(g, box(w + 0.12, h + 0.06, 0.06), TIMBER, x, 0.17 + h / 2, z);
  part(g, box(w, h, 0.09), WOOD, x, 0.17 + h / 2, z);
  part(g, box(0.04, 0.04, 0.12), IRON, x + w * 0.3, 0.17 + h * 0.5, z);
}

/** Thatched cottage: one storey, timber frame, a chimney at the gable end. */
function cottage(rnd: Rnd, i: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.9 + rnd() * 0.5;
  const d = 1.45 + rnd() * 0.3;
  const top = 1.1 + rnd() * 0.15;
  const wall = PLASTER[i % PLASTER.length];
  footing(g, w, d);
  part(g, box(w, top - 0.1, d), wall, 0, 0.1 + (top - 0.1) / 2, 0);
  timbers(g, w, d, 0.17, top, 2, true);
  const side = rnd() < 0.5 ? -1 : 1;
  door(g, side * w * 0.17, d / 2 + 0.02);
  windowAt(g, -side * w * 0.28, top - 0.42, d / 2 + 0.02);
  windowAt(g, 0, top - 0.42, -d / 2 - 0.02);
  const h = 0.95 + rnd() * 0.2;
  gableRoof(g, THATCH[i % THATCH.length], THATCH_DARK, wall, w, d, top, h, 0.22);
  for (const s of [-1, 1]) part(g, box(0.05, h * 0.62, 0.07), TIMBER, s * (w / 2 + 0.005), top + h * 0.3, 0);
  chimney(g, -side * (w / 2 - 0.22), -0.12, 0.2, top + h + 0.3);
  return g;
}

/** Two-storey town house: stone ground floor, jettied timber upper floor, steep gable to the street. */
function townHouse(rnd: Rnd, i: number): THREE.Group {
  const g = new THREE.Group();
  const w = 1.55 + rnd() * 0.3;
  const d = 1.7 + rnd() * 0.3;
  const wall = PLASTER[(i + 2) % PLASTER.length];
  const slate = rnd() < 0.4;
  footing(g, w, d);
  part(g, box(w, 1.0, d), STONE_PALE, 0, 0.6, 0);
  door(g, -w * 0.2, d / 2 + 0.02);
  windowAt(g, w * 0.22, 0.72, d / 2 + 0.02, false, 0.22, 0.22);
  // the upper floor juts out over the street on a row of beam ends
  const uw = w + 0.26;
  const ud = d + 0.26;
  part(g, box(uw + 0.04, 0.1, ud + 0.04), TIMBER, 0, 1.13, 0);
  for (let j = 0; j < 4; j++) part(g, box(0.07, 0.09, 0.14), TIMBER, -uw / 2 + 0.12 + (j * (uw - 0.24)) / 3, 1.05, ud / 2 - 0.02);
  const top = 2.05 + rnd() * 0.12;
  part(g, box(uw, top - 1.18, ud), wall, 0, (top + 1.18) / 2, 0);
  timbers(g, uw, ud, 1.18, top, 2, true);
  windowAt(g, 0, (top + 1.18) / 2 + 0.02, ud / 2 + 0.02, false, 0.2, 0.3);
  windowAt(g, uw / 2 + 0.02, (top + 1.18) / 2, 0, true);
  windowAt(g, -uw / 2 - 0.02, (top + 1.18) / 2, 0.2, true);
  const h = 1.15 + rnd() * 0.2;
  const r = gableRoof(g, slate ? SLATE[i % 2] : TILE[i % TILE.length], slate ? SLATE_DARK : TILE_DARK, wall, uw, ud, top, h, 0.2, true);
  // timber and a little attic light in the street gable (the roof group is turned: its X is the house's Z)
  for (const s of [-1, 1]) {
    part(r, box(0.05, h * 0.6, 0.06), TIMBER, s * (ud / 2 + 0.005), h * 0.3, 0);
    part(r, box(0.05, 0.06, uw * 0.5), TIMBER, s * (ud / 2 + 0.005), h * 0.36, 0);
  }
  part(r, box(0.07, 0.16, 0.16), WINDOW, -(ud / 2 + 0.01), h * 0.2, 0);
  chimney(g, uw / 2 - 0.3, -ud / 2 + 0.35, 1.2, top + h + 0.15, 0.26);
  return g;
}

/** Plank barn with a big thatched roof and a double door. */
function barn(rnd: Rnd, i: number): THREE.Group {
  const g = new THREE.Group();
  const w = 2.4 + rnd() * 0.4;
  const d = 1.6 + rnd() * 0.2;
  const top = 1.05;
  footing(g, w, d, STONE_DARK);
  part(g, box(w, top - 0.1, d), PLANK, 0, 0.1 + (top - 0.1) / 2, 0);
  timbers(g, w, d, 0.17, top, 4, false);
  part(g, box(0.86, 0.78, 0.07), TIMBER, 0, 0.56, d / 2 + 0.02);
  for (const s of [-1, 1]) {
    part(g, box(0.38, 0.7, 0.09), WOOD, s * 0.2, 0.55, d / 2 + 0.02);
    part(g, box(0.5, 0.05, 0.11), PLASTER[1], s * 0.2, 0.55, d / 2 + 0.02, 0, 0, s * 1.05);
  }
  const h = 1.15;
  gableRoof(g, THATCH[(i + 1) % THATCH.length], THATCH_DARK, PLANK, w, d, top, h, 0.26);
  part(g, box(0.07, 0.3, 0.3), IRON, w / 2 + 0.01, top + 0.38, 0);
  // hay spilling out by the door
  part(g, ico(0.34), HAY, 0.85, 0.15, d / 2 + 0.4).scale.set(1.2, 0.7, 1);
  part(g, box(0.5, 0.32, 0.34), HAY, -0.9, 0.2, d / 2 + 0.32, 0, 0.3);
  return g;
}

/** Windmill: whitewashed stone tower with a timber cap. The sails are a separate, turning mesh. */
function windmill(): { group: THREE.Group; hub: THREE.Vector3 } {
  const g = new THREE.Group();
  part(g, cyl(1.02, 1.1, 0.95, 8), STONE, 0, -0.3, 0);
  part(g, cyl(0.62, 0.98, 3.0, 8), WHITEWASH, 0, 1.65, 0);
  part(g, cyl(0.81, 0.83, 0.1, 8), STONE_DARK, 0, 1.5, 0);
  part(g, cyl(0.72, 0.62, 0.16, 8), TIMBER, 0, 3.2, 0);
  part(g, cone(0.8, 0.85, 8), TILE[0], 0, 3.7, 0);
  part(g, cyl(0.86, 0.72, 0.14, 8), TILE_DARK, 0, 3.3, 0);
  door(g, 0, 0.99, 0.36, 0.66);
  windowAt(g, 0, 1.95, 0.8, false, 0.18, 0.26);
  windowAt(g, 0.72, 2.4, 0, true, 0.18, 0.24);
  // gallery on brackets, half way up
  part(g, cyl(1.15, 1.15, 0.07, 8), WOOD, 0, 1.3, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(g, box(0.05, 0.34, 0.05), TIMBER, Math.sin(a) * 1.1, 1.5, Math.cos(a) * 1.1);
  }
  part(g, cyl(1.12, 1.12, 0.05, 8), TIMBER, 0, 1.68, 0);
  // axle of the sails
  part(g, cyl(0.07, 0.07, 0.6, 6), TIMBER, 0, 3.15, 0.75, Math.PI / 2);
  for (const [x, z] of [[1.5, 0.6], [1.75, 0.2], [1.55, -0.1]]) part(g, taperBox(0.34, 0.26, 0.42, 0.26, 0.2), CLOTH[0], x, 0.2, z, 0, x);
  return { group: g, hub: new THREE.Vector3(0, 3.15, 1.06) };
}

/** The four sails of the windmill, centred on the hub, turning about Z. */
function sailsGeometry(): THREE.BufferGeometry {
  const g = new THREE.Group();
  part(g, cyl(0.12, 0.12, 0.14, 6), IRON, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2 + 0.3;
    g.add(arm);
    part(arm, box(0.07, 2.0, 0.05), TIMBER, 0, 1.0, 0);
    part(arm, box(0.44, 1.4, 0.025), CLOTH[0], 0.24, 1.25, 0.01);
    for (let j = 0; j < 4; j++) part(arm, box(0.46, 0.035, 0.04), TIMBER, 0.24, 0.6 + j * 0.44, 0);
    part(arm, box(0.035, 1.4, 0.04), TIMBER, 0.46, 1.25, 0);
  }
  return bakeGroup(g);
}

/** Stone chapel: a nave under slate, a bell tower with a spire at the door. */
function chapel(): THREE.Group {
  const g = new THREE.Group();
  part(g, box(1.7, 0.95, 2.6), STONE_DARK, 0, -0.3, -0.3);
  part(g, box(1.55, 1.25, 2.4), STONE_PALE, 0, 0.75, -0.3);
  for (const s of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      windowAt(g, s * 0.79, 0.85, -1.1 + j * 0.7, true, 0.16, 0.5);
      part(g, taperBox(0.22, 0.14, 1.1, 0.22, 0.14), STONE, s * 0.84, 0.6, -0.75 + j * 0.7);
    }
  }
  const r = gableRoof(g, SLATE[0], SLATE_DARK, STONE_PALE, 1.55, 2.4, 1.37, 1.0, 0.16, true);
  r.position.z = -0.3;
  // bell tower
  part(g, box(1.05, 0.95, 1.05), STONE_DARK, 0, -0.3, 1.1);
  part(g, box(0.95, 3.0, 0.95), STONE_PALE, 0, 1.65, 1.1);
  part(g, box(1.03, 0.1, 1.03), STONE_DARK, 0, 2.2, 1.1);
  part(g, box(1.07, 0.12, 1.07), STONE_DARK, 0, 3.12, 1.1);
  for (const [x, z, side] of [[0, 1.59, 0], [0.49, 1.1, 1], [-0.49, 1.1, 1]] as [number, number, number][]) {
    part(g, side ? box(0.05, 0.42, 0.3) : box(0.3, 0.42, 0.05), IRON, x, 2.7, z);
  }
  part(g, cyl(0.2, 0.2, 0.06, 8), WINDOW, 0, 1.75, 1.59, Math.PI / 2);
  part(g, box(0.5, 0.78, 0.07), TIMBER, 0, 0.56, 1.59);
  part(g, cyl(0.25, 0.25, 0.07, 8), TIMBER, 0, 0.95, 1.59, Math.PI / 2);
  part(g, box(0.38, 0.72, 0.09), WOOD, 0, 0.53, 1.6);
  part(g, cyl(0.66, 0.84, 0.28, 4), SLATE_DARK, 0, 3.3, 1.1, 0, Math.PI / 4);
  part(g, cone(0.68, 1.75, 4), SLATE[1], 0, 4.3, 1.1, 0, Math.PI / 4);
  part(g, box(0.05, 0.42, 0.05), GOLD, 0, 5.35, 1.1);
  part(g, box(0.24, 0.05, 0.05), GOLD, 0, 5.42, 1.1);
  // a few graves beside the nave
  for (const [x, z] of [[1.4, -0.9], [1.75, -0.3], [1.45, 0.25]]) part(g, taperBox(0.2, 0.18, 0.34, 0.07), STONE, x, 0.15, z, 0, 0.2);
  return g;
}

/** Tavern: the biggest house, with a hanging sign, barrels and a lantern by the door. */
function tavern(rnd: Rnd): THREE.Group {
  const g = new THREE.Group();
  const w = 2.7;
  const d = 1.9;
  footing(g, w, d);
  part(g, box(w, 1.05, d), STONE_PALE, 0, 0.62, 0);
  door(g, -0.5, d / 2 + 0.02, 0.42, 0.7);
  windowAt(g, 0.35, 0.75, d / 2 + 0.02, false, 0.3, 0.26);
  windowAt(g, 0.95, 0.75, d / 2 + 0.02, false, 0.3, 0.26);
  const uw = w + 0.28;
  const ud = d + 0.28;
  part(g, box(uw + 0.04, 0.1, ud + 0.04), TIMBER, 0, 1.2, 0);
  const top = 2.2;
  part(g, box(uw, top - 1.25, ud), PLASTER[0], 0, (top + 1.25) / 2, 0);
  timbers(g, uw, ud, 1.25, top, 4, true);
  for (const x of [-0.6, 0.6]) windowAt(g, x, 1.76, ud / 2 + 0.02, false, 0.24, 0.3);
  windowAt(g, uw / 2 + 0.02, 1.76, 0, true);
  const h = 1.3;
  gableRoof(g, TILE[2], TILE_DARK, PLASTER[0], uw, ud, top, h, 0.24);
  for (const s of [-1, 1]) {
    part(g, box(0.05, h * 0.6, 0.07), TIMBER, s * (uw / 2 + 0.005), top + h * 0.3, 0);
    part(g, box(0.07, 0.16, 0.16), WINDOW, s * (uw / 2 + 0.01), top + h * 0.22, 0);
  }
  // dormer on the street side
  part(g, box(0.5, 0.42, 0.5), PLASTER[0], -0.2, top + 0.42, ud / 2 - 0.25);
  part(g, box(0.22, 0.2, 0.06), WINDOW, -0.2, top + 0.42, ud / 2 + 0.01);
  part(g, box(0.66, 0.07, 0.62), TILE_DARK, -0.2, top + 0.66, ud / 2 - 0.22);
  chimney(g, uw / 2 - 0.35, -0.3, 1.2, top + h + 0.4, 0.34);
  chimney(g, -uw / 2 + 0.4, -0.5, 1.2, top + h + 0.1, 0.26);
  // sign on an iron bracket, lantern, barrels and a bench
  part(g, box(0.05, 0.05, 0.62), IRON, -1.15, 1.72, ud / 2 + 0.3);
  part(g, box(0.05, 0.36, 0.44), WOOD, -1.15, 1.48, ud / 2 + 0.36);
  part(g, cyl(0.1, 0.1, 0.07, 8), GOLD, -1.15, 1.48, ud / 2 + 0.36, 0, 0, Math.PI / 2);
  part(g, box(0.12, 0.16, 0.12), WINDOW, -0.14, 1.0, d / 2 + 0.12);
  part(g, box(0.16, 0.04, 0.16), IRON, -0.14, 1.1, d / 2 + 0.12);
  for (const [x, z] of [[1.55, 0.9], [1.9, 0.65], [1.6, 0.5]]) barrel(g, x, 0.02, z);
  barrel(g, 1.7, 0.42, 0.72).rotation.set(0, rnd() * 3, Math.PI / 2);
  part(g, box(0.9, 0.06, 0.24), WOOD, 0.65, 0.3, d / 2 + 0.36);
  for (const s of [-1, 1]) part(g, box(0.06, 0.28, 0.2), TIMBER, 0.65 + s * 0.36, 0.15, d / 2 + 0.36);
  return g;
}

/** Smithy: stone forge open to the street, a lean-to roof and a tall chimney with a glowing fire. */
function smithy(): THREE.Group {
  const g = new THREE.Group();
  const w = 2.1;
  const d = 1.6;
  footing(g, w, d, STONE_DARK);
  part(g, box(w, 1.1, d), STONE, 0, 0.65, 0);
  part(g, box(1.25, 0.82, 0.08), IRON, -0.2, 0.58, d / 2 + 0.01);
  part(g, box(0.42, 0.3, 0.1), FIRE, -0.45, 0.42, d / 2 + 0.03);
  part(g, box(0.56, 0.16, 0.12), STONE_DARK, -0.45, 0.22, d / 2 + 0.05);
  part(g, cone(0.12, 0.3, 4), glow(0xffd070), -0.45, 0.62, d / 2 + 0.06);
  // lean-to roof over the work yard, on two posts
  part(g, box(w + 0.3, 0.09, d + 1.3), SLATE[1], 0, 1.34, 0.42, 0.2);
  part(g, box(w + 0.34, 0.1, 0.16), SLATE_DARK, 0, 1.6, -0.86);
  for (const s of [-1, 1]) part(g, box(0.1, 1.2, 0.1), TIMBER, s * (w / 2 + 0.02), 0.56, d / 2 + 0.72);
  chimney(g, 0.6, -0.35, 1.0, 3.1, 0.46);
  part(g, box(0.2, 0.08, 0.2), FIRE, 0.6, 3.2, -0.35);
  // anvil on a block, a water trough, tools and ingots
  part(g, cyl(0.16, 0.19, 0.3, 6), WOOD, 0.55, 0.15, d / 2 + 0.55);
  part(g, taperBox(0.16, 0.34, 0.14, 0.1, 0.14), IRON, 0.55, 0.37, d / 2 + 0.55);
  part(g, box(0.6, 0.22, 0.26), WOOD, -1.0, 0.13, d / 2 + 0.6);
  part(g, box(0.5, 0.03, 0.18), WATER, -1.0, 0.24, d / 2 + 0.6);
  for (let i = 0; i < 3; i++) part(g, box(0.05, 0.75, 0.05), IRON, 0.9 + i * 0.09, 0.42, d / 2 + 0.06, 0.12);
  part(g, box(0.3, 0.1, 0.16), lambert(0x9a8f86), 0.1, 0.07, d / 2 + 0.75, 0, 0.5);
  return g;
}

function barrel(g: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const b = new THREE.Group();
  b.position.set(x, y + 0.22, z);
  g.add(b);
  part(b, cyl(0.17, 0.17, 0.44, 8), WOOD, 0, 0, 0);
  part(b, cyl(0.2, 0.2, 0.2, 8), PLANK, 0, 0, 0);
  for (const s of [-1, 1]) part(b, cyl(0.185, 0.185, 0.04, 8), IRON, 0, s * 0.14, 0);
  return b;
}

/** Roofed draw well. */
function well(): THREE.Group {
  const g = new THREE.Group();
  part(g, cyl(0.52, 0.58, 1.0, 8), STONE, 0, 0.0, 0);
  part(g, cyl(0.58, 0.58, 0.08, 8), STONE_DARK, 0, 0.5, 0);
  part(g, cyl(0.38, 0.38, 0.03, 8), WATER, 0, 0.55, 0);
  for (const s of [-1, 1]) part(g, box(0.08, 1.15, 0.08), TIMBER, s * 0.5, 1.0, 0);
  part(g, cyl(0.045, 0.045, 1.0, 5), WOOD, 0, 1.25, 0, 0, 0, Math.PI / 2);
  gableRoof(g, THATCH[0], THATCH_DARK, null, 1.05, 0.7, 1.52, 0.4, 0.1);
  part(g, box(0.02, 0.45, 0.02), IRON, 0.1, 1.02, 0);
  part(g, cyl(0.09, 0.07, 0.14, 6), WOOD, 0.1, 0.78, 0);
  return g;
}

/** Market stall under a striped awning. */
function stall(i: number): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box(0.06, sz > 0 ? 1.05 : 1.3, 0.06), TIMBER, sx * 0.62, (sz > 0 ? 1.05 : 1.3) / 2, sz * 0.34);
  part(g, box(1.3, 0.07, 0.6), WOOD, 0, 0.5, 0.05);
  part(g, box(1.3, 0.42, 0.05), PLANK, 0, 0.27, 0.34);
  for (let j = 0; j < 5; j++) part(g, box(0.29, 0.04, 0.9), CLOTH[(j + i) % 2 === 0 ? 0 : 1 + (i % 2)], -0.58 + j * 0.29, 1.2, 0.02, 0.33);
  const goods = [lambert(0xc8642c), GREEN, lambert(0xb7352c), HAY];
  for (let j = 0; j < 6; j++) part(g, ico(0.085), goods[(j + i) % goods.length], -0.48 + j * 0.19, 0.6, 0.08 + (j % 2) * 0.14);
  part(g, box(0.34, 0.26, 0.3), PLANK, 0.95, 0.13, 0.3, 0, 0.3);
  return g;
}

function haystack(): THREE.Group {
  const g = new THREE.Group();
  part(g, cyl(0.52, 0.6, 0.5, 7), HAY, 0, 0.2, 0);
  part(g, cone(0.56, 0.75, 7), THATCH[2], 0, 0.82, 0);
  part(g, cyl(0.03, 0.03, 0.5, 4), TIMBER, 0, 1.3, 0);
  return g;
}

function cart(): THREE.Group {
  const g = new THREE.Group();
  part(g, box(1.0, 0.07, 0.56), PLANK, 0, 0.42, 0);
  for (const s of [-1, 1]) {
    part(g, box(1.0, 0.2, 0.05), WOOD, 0, 0.55, s * 0.28);
    part(g, cyl(0.28, 0.28, 0.06, 8), TIMBER, -0.1, 0.28, s * 0.35, Math.PI / 2);
    part(g, cyl(0.07, 0.07, 0.09, 6), IRON, -0.1, 0.28, s * 0.36, Math.PI / 2);
    seg(g, WOOD, [0.5, 0.42, s * 0.2], [1.25, 0.12, s * 0.2], 0.03, 0.03, 4);
  }
  part(g, box(0.05, 0.2, 0.56), WOOD, -0.5, 0.55, 0);
  part(g, ico(0.3), HAY, -0.05, 0.62, 0).scale.set(1.4, 0.7, 0.85);
  return g;
}

/** A run of wattle fence, `len` metres along X. */
function fence(len: number): THREE.Group {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 0.6));
  for (let i = 0; i <= n; i++) part(g, box(0.07, 0.6 + (i % 2) * 0.06, 0.07), TIMBER, -len / 2 + (len * i) / n, 0.22, 0, 0, 0, ((i % 3) - 1) * 0.05);
  for (const y of [0.22, 0.4]) part(g, box(len, 0.045, 0.035), WOOD, 0, y, 0);
  return g;
}

function lantern(): THREE.Group {
  const g = new THREE.Group();
  part(g, box(0.07, 1.6, 0.07), TIMBER, 0, 0.7, 0);
  part(g, box(0.3, 0.05, 0.05), TIMBER, 0.13, 1.42, 0);
  part(g, box(0.13, 0.17, 0.13), WINDOW, 0.26, 1.27, 0);
  part(g, cone(0.12, 0.1, 4), IRON, 0.26, 1.4, 0, 0, Math.PI / 4);
  return g;
}

function woodpile(): THREE.Group {
  const g = new THREE.Group();
  for (const [y, z, n] of [[0.1, -0.2, 3], [0.27, -0.1, 2], [0.44, 0, 1]] as [number, number, number][]) {
    for (let i = 0; i < n; i++) part(g, cyl(0.09, 0.09, 0.8, 6), i % 2 ? WOOD : PLANK, 0, y, z + i * 0.2, 0, 0, Math.PI / 2);
  }
  part(g, cyl(0.2, 0.22, 0.3, 7), TIMBER, 0.75, 0.15, 0.1);
  part(g, box(0.04, 0.4, 0.04), WOOD, 0.75, 0.48, 0.1, 0.5);
  return g;
}

/** Watchtower built by engineers: stone foot, timber fighting deck, tiled roof, a brazier. */
function watchtowerGeometry(): THREE.BufferGeometry {
  const g = new THREE.Group();
  part(g, taperBox(1.9, 1.5, 3.2, 1.9, 1.5), STONE, 0, 1.3, 0);
  part(g, box(1.6, 0.14, 1.6), STONE_DARK, 0, 1.5, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, taperBox(0.3, 0.2, 3.2, 0.3, 0.2), STONE_PALE, sx * 0.85, 1.3, sz * 0.85);
    seg(g, TIMBER, [sx * 0.72, 2.3, sz * 0.72], [sx * 1.15, 3.0, sz * 1.15], 0.05, 0.05, 4);
    part(g, box(0.1, 1.0, 0.1), TIMBER, sx * 1.1, 3.6, sz * 1.1);
  }
  part(g, box(2.4, 0.16, 2.4), WOOD, 0, 3.02, 0);
  for (const s of [-1, 1]) {
    part(g, box(2.4, 0.34, 0.07), PLANK, 0, 3.3, s * 1.17);
    part(g, box(0.07, 0.34, 2.4), PLANK, s * 1.17, 3.3, 0);
  }
  part(g, box(0.5, 0.9, 0.08), WOOD, 0, 0.5, 0.94);
  part(g, box(0.09, 0.4, 0.06), IRON, 0, 2.2, 0.8);
  part(g, cyl(1.15, 1.75, 0.3, 4), TILE_DARK, 0, 4.2, 0, 0, Math.PI / 4);
  part(g, cone(1.2, 1.35, 4), TILE[0], 0, 4.95, 0, 0, Math.PI / 4);
  part(g, cone(0.05, 0.4, 4), IRON, 0, 5.8, 0);
  part(g, cyl(0.2, 0.14, 0.14, 6), IRON, 0.75, 3.55, 0.75);
  part(g, cone(0.15, 0.36, 5), FIRE, 0.75, 3.8, 0.75);
  return bakeGroup(g);
}

interface VillageView {
  group: THREE.Group;
  flag: THREE.Mesh;
  claim: THREE.Mesh;
  ring: THREE.Mesh;
  /** watchtower built by engineers; scaled up while under construction */
  tower: THREE.Mesh;
  /** sails of the windmill, when the village has one */
  sails: THREE.Mesh | null;
  owner: number;
}

export class VillageRenderer {
  readonly group = new THREE.Group();
  private views = new Map<number, VillageView>();
  private c = new THREE.Color();
  private mat = instancedMaterial();
  private towerGeo: THREE.BufferGeometry | null = null;
  private sailsGeo: THREE.BufferGeometry | null = null;

  constructor(
    private map: WorldMap,
    private onPlaced: (x: number, z: number) => void,
  ) {}

  private build(v: Village, radius: number): VillageView {
    const g = new THREE.Group();
    const ground = this.map.heightAt(v.x, v.z);
    g.position.set(v.x, ground, v.z);
    // deterministic layout from the village id
    let seed = v.id * 9301 + 49297;
    const rnd: Rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const root = new THREE.Group();
    const yAt = (x: number, z: number) => this.map.heightAt(v.x + x, v.z + z);
    /** Put an object on the ground at (x, z), turned by ry. Skipped where the spot is under water. */
    const place = (o: THREE.Object3D, x: number, z: number, ry: number) => {
      const y = yAt(x, z);
      if (y < 0.25) return false;
      o.position.set(x, y - ground, z);
      o.rotation.y = ry;
      root.add(o);
      return true;
    };
    /** Rotation that turns a model's front (+Z) from (x, z) toward the square. */
    const facing = (x: number, z: number) => Math.atan2(-x, -z);

    // ---- the square: packed earth following the ground, with a ragged edge
    const SEG = 20;
    const rings = [0, 2.3, 4.3, 0];
    const pts: number[][] = [[0, 0.1, 0]];
    for (let r = 1; r <= 3; r++) {
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const rad = r < 3 ? rings[r] : 5.5 + rnd() * 1.1;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        pts.push([x, Math.max(0.02, yAt(x, z)) - ground + 0.1, z]);
      }
    }
    const at = (r: number, i: number) => 1 + (r - 1) * SEG + (i % SEG);
    const inner: number[][] = [];
    const outer: number[][] = [];
    for (let i = 0; i < SEG; i++) {
      inner.push([0, at(1, i + 1), at(1, i)]);
      for (const r of [1, 2]) {
        (r === 1 ? inner : outer).push([at(r, i), at(r + 1, i + 1), at(r + 1, i)], [at(r, i), at(r, i + 1), at(r + 1, i + 1)]);
      }
    }
    part(root, sheet(pts, inner), PLAZA_PALE);
    part(root, sheet(pts, outer), PLAZA);

    // ---- houses in a ring, doors to the square; the first plot takes the village's landmark
    const houses = 5 + (v.id % 3);
    const kinds = ["special", "cottage", "town", "cottage", "barn", "town", "cottage"];
    const turn = rnd() * Math.PI * 2;
    let sailsAt: { pos: THREE.Vector3; ry: number } | null = null;
    const gaps: number[] = [];
    for (let i = 0; i < houses; i++) {
      const a = turn + (i / houses) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      gaps.push(turn + ((i + 0.5) / houses) * Math.PI * 2);
      const kind = kinds[i];
      const r = kind === "special" ? 5.7 : 4.9 + rnd() * 1.1;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ry = facing(x, z) + (kind === "special" ? 0 : (rnd() - 0.5) * 0.4);
      let house: THREE.Group;
      let hub: THREE.Vector3 | null = null;
      if (kind === "special") {
        const which = v.id % 4;
        if (which === 0) ({ group: house, hub } = windmill());
        else house = which === 1 ? chapel() : which === 2 ? tavern(rnd) : smithy();
      } else house = kind === "town" ? townHouse(rnd, i + v.id) : kind === "barn" ? barn(rnd, i + v.id) : cottage(rnd, i + v.id);
      if (place(house, x, z, ry) && hub) sailsAt = { pos: hub.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(house.position), ry };
    }

    // ---- village life: well and stall on the square, clutter between and behind the houses
    place(well(), 1.9, -1.3, rnd() * 3);
    const sa = turn + 2.4;
    place(stall(v.id), Math.cos(sa) * 3.1, Math.sin(sa) * 3.1, facing(Math.cos(sa), Math.sin(sa)));
    for (const off of [1.1, 4.0]) {
      const a = turn + off;
      place(lantern(), Math.cos(a) * 3.5, Math.sin(a) * 3.5, a);
    }
    gaps.forEach((a, i) => {
      const r = 6.2 + rnd() * 0.8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const tangent = -a + Math.PI / 2;
      const pick = (i + v.id) % 5;
      if (pick === 0) place(haystack(), x, z, 0);
      else if (pick === 1) place(fence(2.6 + rnd()), x, z, tangent);
      else if (pick === 2) place(cart(), x, z, tangent + rnd());
      else if (pick === 3) place(woodpile(), x, z, tangent);
      else {
        place(fence(2.2), x, z, tangent);
        place(haystack(), Math.cos(a) * (r - 1.1), Math.sin(a) * (r - 1.1), 0);
      }
    });

    // ---- flag pole on a stone foot
    part(root, cyl(0.3, 0.4, 0.5, 6), STONE, 0, 0.15, 0);
    part(root, cyl(0.06, 0.08, 4.2, 6), WOOD, 0, 2.1, 0);
    part(root, ico(0.1), GOLD, 0, 4.26, 0);

    const town = new THREE.Mesh(bakeGroup(root), this.mat);
    town.castShadow = true;
    town.receiveShadow = true;
    g.add(town);

    let sails: THREE.Mesh | null = null;
    if (sailsAt) {
      const s = sailsAt as { pos: THREE.Vector3; ry: number };
      sails = new THREE.Mesh((this.sailsGeo ??= sailsGeometry()), this.mat);
      sails.position.copy(s.pos);
      sails.rotation.set(0, s.ry, 0);
      sails.castShadow = true;
      g.add(sails);
    }

    const flagGeo = new THREE.BoxGeometry(1.3, 0.8, 0.05);
    flagGeo.translate(0.68, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: NEUTRAL, flatShading: true }));
    flag.position.y = 3.75;
    const claim = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    claim.visible = false;
    g.add(flag, claim);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.35, radius, 40),
      new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.22;
    g.add(ring);

    const tower = new THREE.Mesh((this.towerGeo ??= watchtowerGeometry()), this.mat);
    tower.castShadow = true;
    tower.position.set(-1.6, 0, 1.4);
    tower.visible = false;
    g.add(tower);
    this.onPlaced(v.x, v.z);
    return { group: g, flag, claim, ring, tower, sails, owner: -1 };
  }

  update(sim: Sim, time: number) {
    const radius = sim.cfg.villages.radius;
    const cap = sim.cfg.villages.captureSeconds;
    for (const v of sim.villages) {
      let view = this.views.get(v.id);
      if (!view) {
        view = this.build(v, radius);
        this.views.set(v.id, view);
        this.group.add(view.group);
      }
      if (view.owner !== v.owner) {
        view.owner = v.owner;
        const k = v.owner ? sim.kingdomById(v.owner) : null;
        this.c.set(k ? k.color : NEUTRAL);
        (view.flag.material as THREE.MeshLambertMaterial).color.copy(this.c);
        (view.ring.material as THREE.MeshBasicMaterial).color.copy(this.c);
        (view.ring.material as THREE.MeshBasicMaterial).opacity = k ? 0.8 : 0.5;
      }
      const built = v.tower ? 1 : Math.min(1, v.build / sim.cfg.villages.towerBuildSeconds);
      view.tower.visible = built > 0.02;
      view.tower.scale.set(1, Math.max(0.05, built), 1);
      if (view.sails) view.sails.rotation.z = time * 0.55 + v.id;
      const wave = Math.sin(time * 3 + v.id) * 0.25;
      view.flag.rotation.y = wave;
      // attacker's flag climbs the pole as the capture progresses
      const taking = v.claimKid && v.progress > 0 ? sim.kingdomById(v.claimKid) : null;
      view.claim.visible = !!taking;
      if (taking) {
        (view.claim.material as THREE.MeshLambertMaterial).color.set(taking.color);
        view.claim.position.y = 0.6 + Math.min(1, v.progress / cap) * 2.6;
        view.claim.rotation.y = -wave;
        view.ring.scale.setScalar(1 + Math.sin(time * 10) * 0.03);
      } else view.ring.scale.setScalar(1);
    }
  }
}
