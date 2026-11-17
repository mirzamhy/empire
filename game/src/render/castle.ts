// Castle of a kingdom. It grows with the level: a walled keep at level 1, roofed corner towers
// from 2, a second tier on the keep from 3, corbelled turrets from 4, pale stone from 5, gold trim
// from 6, a tall mage tower from 7, a floating crystal from 9 and a crown at 10.
//
// The stone work is baked into one geometry per level and drawn as a single instance, so a castle
// costs one draw call however detailed it is. Roofs and banners carry the kingdom colour.
// Local units: the ward is 4 m across before `castleScale`; the model faces +Z.
import * as THREE from "three";
import { bakeGroup, instancedMaterial } from "./bake";
import { THEME } from "./theme";
import { box, cone, cyl, glow, ico, lambert, part, taperBox, tintMat } from "./units/models/kit";

const MAX_LEVEL = 10;
/** World scale of the castle model at a level. */
export const castleScale = (level: number) => 1.12 + Math.min(level, MAX_LEVEL) * 0.065;

const shaded = (s: number) => {
  const m = tintMat();
  m.userData.shade = s;
  return m;
};
const ROOF = tintMat();
const ROOF_DARK = shaded(0.68);
const ROCK = lambert(THEME.rockDark);
const WOOD = lambert(0x3b2a1e);
const IRON = lambert(0x24262b);
const GOLD = lambert(0xf2c230);
const PLASTER = lambert(0xd6c9a8);
const WINDOW = glow(0xffc766);
const CRYSTAL = glow(0xbff4ff);

/** Pointed roof with a flared eave. `y` is the eave; returns the height of the tip. */
function spire(g: THREE.Group, x: number, y: number, z: number, r: number, h: number, sides: number, ry = 0): number {
  part(g, cyl(r * 0.72, r * 1.18, h * 0.2, sides), ROOF_DARK, x, y + h * 0.1, z, 0, ry);
  part(g, cone(r * 0.8, h * 0.9, sides), ROOF, x, y + h * 0.6, z, 0, ry);
  return y + h * 1.05;
}

function finial(g: THREE.Group, mat: THREE.Material, x: number, tip: number, z: number, s = 1) {
  part(g, ico(0.085 * s), mat, x, tip + 0.02, z);
  part(g, cone(0.035 * s, 0.34 * s, 4), mat, x, tip + 0.22 * s, z);
}

/** A row of n merlons from (x0, z0) to (x1, z1), standing on y. */
function merlons(g: THREE.Group, mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number, n: number, thick: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    part(g, box((len / n) * 0.56, 0.3, thick), mat, x0 + (x1 - x0) * t, y + 0.15, z0 + (z1 - z0) * t, 0, ang);
  }
}

/** The castle at a level, as separate parts (tint parts take the kingdom colour once baked). */
function castleModel(level: number): { group: THREE.Group; tip: number; keepZ: number } {
  const L = Math.min(Math.max(level, 1), MAX_LEVEL);
  const g = new THREE.Group();
  const stone = lambert(L >= 5 ? 0xb7b9bd : 0x8c8f96);
  const dark = lambert(L >= 5 ? 0x7d8088 : 0x62656c);
  const pale = lambert(L >= 5 ? 0xd3d4d6 : 0xa9acb1);
  const trim = L >= 6 ? GOLD : IRON;

  // ---- rock plinth: reaches below the ground so it also sits on a slope
  const y0 = 0.45;
  part(g, taperBox(5.8, 5.25, 1.1, 5.8, 5.25), ROCK, 0, y0 - 0.55, 0);
  for (const [x, z, s] of [[2.9, 1.2, 0.8], [-2.8, -1.6, 0.95], [1.4, -3.0, 0.7], [-1.9, 2.9, 0.75], [3.0, -2.4, 0.6], [-3.1, 1.0, 0.55]]) {
    part(g, ico(s), ROCK, x, 0.05, z, s, s * 2, 0).scale.set(1.25, 0.6, 1);
  }

  // ---- curtain wall with a wall walk and merlons
  const H = 2.0;
  const wallH = 1.25 + L * 0.035;
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = -Math.atan2(z1 - z0, x1 - x0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    part(g, box(len, wallH, 0.4), stone, mx, y0 + wallH / 2, mz, 0, ang);
    part(g, box(len, 0.26, 0.48), dark, mx, y0 + 0.13, mz, 0, ang);
    part(g, box(len, 0.12, 0.54), dark, mx, y0 + wallH - 0.02, mz, 0, ang);
    merlons(g, pale, x0, z0, x1, z1, y0 + wallH + 0.04, Math.max(2, Math.round(len / 0.62)), 0.5);
  };
  wall(-H, -H, H, -H);
  wall(-H, -H, -H, H);
  wall(H, -H, H, H);
  wall(-H, H, -0.7, H);
  wall(0.7, H, H, H);

  // ---- gatehouse: arched door, portcullis, two turrets and the kingdom's banner over the gate
  const gateH = wallH + 0.75;
  part(g, box(1.5, gateH, 0.9), stone, 0, y0 + gateH / 2, H + 0.05);
  part(g, box(1.6, 0.14, 1.0), dark, 0, y0 + gateH - 0.03, H + 0.05);
  merlons(g, pale, -0.75, H + 0.4, 0.75, H + 0.4, y0 + gateH + 0.04, 3, 0.22);
  merlons(g, pale, -0.75, H - 0.3, 0.75, H - 0.3, y0 + gateH + 0.04, 3, 0.22);
  part(g, box(0.86, 0.8, 0.08), pale, 0, y0 + 0.4, H + 0.5);
  part(g, cyl(0.43, 0.43, 0.08, 10), pale, 0, y0 + 0.8, H + 0.5, Math.PI / 2);
  part(g, box(0.64, 0.8, 0.1), WOOD, 0, y0 + 0.4, H + 0.52);
  part(g, cyl(0.32, 0.32, 0.1, 10), WOOD, 0, y0 + 0.8, H + 0.52, Math.PI / 2);
  for (let i = -1; i <= 1; i++) part(g, box(0.035, 1.05, 0.035), IRON, i * 0.18, y0 + 0.52, H + 0.59);
  part(g, box(0.6, 0.035, 0.035), IRON, 0, y0 + 0.55, H + 0.59);
  part(g, box(0.44, 0.6, 0.05), ROOF, 0, y0 + 1.55, H + 0.53);
  part(g, box(0.54, 0.05, 0.07), GOLD, 0, y0 + 1.87, H + 0.54);
  for (const s of [-1, 1]) {
    const h = wallH + 1.3;
    part(g, cyl(0.3, 0.35, h, 8), stone, s * 0.95, y0 + h / 2, H + 0.28);
    part(g, cyl(0.4, 0.3, 0.2, 8), dark, s * 0.95, y0 + h - 0.06, H + 0.28);
    const tip = spire(g, s * 0.95, y0 + h + 0.04, H + 0.28, 0.42, 0.95, 8);
    finial(g, trim, s * 0.95, tip, H + 0.28, 0.7);
    part(g, box(0.1, 0.24, 0.06), WINDOW, s * 0.95, y0 + h * 0.74, H + 0.6);
  }

  // ---- corner towers
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * H;
    const z = sz * H;
    const out = Math.atan2(sx, sz);
    if (L < 2) {
      // a young castle: squat bastions, no roofs yet
      const h = wallH + 0.45;
      part(g, cyl(0.46, 0.54, h, 8), stone, x, y0 + h / 2, z);
      part(g, cyl(0.56, 0.46, 0.16, 8), dark, x, y0 + h - 0.05, z);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        part(g, box(0.24, 0.26, 0.14), pale, x + Math.sin(a) * 0.46, y0 + h + 0.15, z + Math.cos(a) * 0.46, 0, a);
      }
      continue;
    }
    const h = wallH + 1.2 + L * 0.11;
    const top = y0 + h;
    part(g, cyl(0.62, 0.72, 0.34, 8), dark, x, y0 + 0.17, z);
    part(g, cyl(0.5, 0.58, h, 8), stone, x, y0 + h / 2, z);
    part(g, cyl(0.53, 0.54, 0.1, 8), dark, x, y0 + h * 0.5, z);
    part(g, cyl(0.68, 0.5, 0.28, 8), dark, x, top - 0.1, z);
    part(g, cyl(0.68, 0.68, 0.2, 8), pale, x, top + 0.14, z);
    if (L >= 6) part(g, cyl(0.7, 0.7, 0.06, 8), GOLD, x, top + 0.27, z);
    const tip = spire(g, x, top + 0.24, z, 0.64, 1.25 + L * 0.05, 8);
    finial(g, trim, x, tip, z);
    part(g, box(0.13, 0.32, 0.08), WINDOW, x + Math.sin(out) * 0.5, y0 + h * 0.76, z + Math.cos(out) * 0.5, 0, out);
    part(g, box(0.07, 0.34, 0.08), IRON, x + Math.sin(out) * 0.53, y0 + h * 0.36, z + Math.cos(out) * 0.53, 0, out);
    if (L >= 8 && sz > 0) {
      part(g, cyl(0.02, 0.02, 0.5, 4), WOOD, x, tip + 0.5, z);
      part(g, box(0.42, 0.2, 0.03), ROOF, x + 0.22, tip + 0.62, z);
    }
  }

  // ---- buildings in the ward
  if (L >= 3) {
    part(g, box(1.0, 0.7, 0.8), PLASTER, -1.2, y0 + 0.35, 0.95);
    part(g, cone(0.8, 0.55, 4), ROOF_DARK, -1.2, y0 + 0.97, 0.95, 0, Math.PI / 4).scale.set(1, 1, 0.82);
    part(g, box(0.16, 0.2, 0.05), WINDOW, -1.2, y0 + 0.42, 1.36);
  }
  if (L >= 5) {
    part(g, box(0.9, 0.55, 0.7), lambert(0x5b4027), 1.25, y0 + 0.27, 1.0);
    part(g, box(1.05, 0.08, 0.9), lambert(0x8f7a45), 1.25, y0 + 0.62, 1.0, 0.22);
  }

  // ---- keep
  const kz = -0.3;
  const W1 = 1.9;
  const h1 = 2.1 + L * 0.13;
  part(g, taperBox(W1 + 0.18, W1, h1, W1 + 0.18, W1), stone, 0, y0 + h1 / 2, kz);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(g, taperBox(0.34, 0.24, h1, 0.34, 0.24), pale, sx * (W1 / 2 + 0.02), y0 + h1 / 2, kz + sz * (W1 / 2 + 0.02));
  }
  part(g, box(W1 + 0.2, 0.16, W1 + 0.2), dark, 0, y0 + h1, kz);
  part(g, box(W1 + 0.06, 0.1, W1 + 0.06), dark, 0, y0 + h1 * 0.45, kz);
  const terrace = y0 + h1 + 0.08;
  const front = kz + W1 / 2 + 0.05;
  for (const s of [-1, 1]) {
    // lit windows on every face, arrow slits below
    part(g, box(0.28, 0.48, 0.05), WOOD, s * 0.42, y0 + h1 * 0.72, front);
    part(g, box(0.19, 0.38, 0.07), WINDOW, s * 0.42, y0 + h1 * 0.72, front + 0.01);
    part(g, box(0.07, 0.36, 0.06), IRON, s * 0.42, y0 + h1 * 0.25, front + 0.03);
    part(g, box(0.07, 0.38, 0.19), WINDOW, s * (W1 / 2 + 0.06), y0 + h1 * 0.72, kz);
    part(g, box(0.19, 0.38, 0.07), WINDOW, s * 0.42, y0 + h1 * 0.72, kz - W1 / 2 - 0.06);
  }
  let roofTip: number;
  let upperTop = terrace;
  if (L >= 3) {
    const e = W1 / 2 + 0.02;
    merlons(g, pale, -e, kz + e, e, kz + e, terrace, 4, 0.2);
    merlons(g, pale, -e, kz - e, e, kz - e, terrace, 4, 0.2);
    merlons(g, pale, -e, kz - e, -e, kz + e, terrace, 4, 0.2);
    merlons(g, pale, e, kz - e, e, kz + e, terrace, 4, 0.2);
    const W2 = 1.35;
    const h2 = 1.0 + L * 0.1;
    upperTop = terrace + h2;
    part(g, box(W2, h2, W2), stone, 0, terrace + h2 / 2, kz);
    part(g, box(W2 + 0.2, 0.14, W2 + 0.2), dark, 0, upperTop - 0.02, kz);
    if (L >= 6) part(g, box(W2 + 0.24, 0.05, W2 + 0.24), GOLD, 0, upperTop + 0.07, kz);
    for (const s of [-1, 1]) {
      part(g, box(0.2, 0.42, 0.06), WINDOW, 0, terrace + h2 * 0.58, kz + s * (W2 / 2 + 0.02));
      part(g, box(0.06, 0.42, 0.2), WINDOW, s * (W2 / 2 + 0.02), terrace + h2 * 0.58, kz);
    }
    roofTip = spire(g, 0, upperTop + 0.06, kz, (W2 / Math.SQRT2) * 1.12, 1.9 + L * 0.09, 4, Math.PI / 4);
  } else {
    roofTip = spire(g, 0, terrace, kz, (W1 / Math.SQRT2) * 1.06, 1.8, 4, Math.PI / 4);
  }
  finial(g, GOLD, 0, roofTip, kz, 1.2);

  // ---- corbelled turrets on the keep
  const turret = (x: number, z: number, from: number, to: number, r: number, roofH: number) => {
    part(g, cone(r * 1.15, 0.55, 8), dark, x, from - 0.27, z, Math.PI);
    part(g, cyl(r, r, to - from, 8), stone, x, (from + to) / 2, z);
    part(g, cyl(r * 1.22, r, 0.16, 8), dark, x, to - 0.05, z);
    const tip = spire(g, x, to + 0.04, z, r * 1.3, roofH, 8);
    finial(g, trim, x, tip, z, 0.75);
    const a = Math.atan2(x, z - kz);
    part(g, box(0.1, 0.26, 0.06), WINDOW, x + Math.sin(a) * r, to - 0.42, z + Math.cos(a) * r, 0, a);
  };
  if (L >= 4) turret(W1 / 2, kz + W1 / 2, y0 + h1 * 0.58, upperTop + 0.15, 0.3, 1.0 + L * 0.04);
  if (L >= 6) turret(-W1 / 2, kz - W1 / 2, y0 + h1 * 0.7, upperTop + 0.55, 0.28, 1.1 + L * 0.04);

  // ---- mage tower: a slender round tower against the back of the keep, taller than its roof
  if (L >= 7) {
    const x = W1 / 2 + 0.05;
    const z = kz - W1 / 2 - 0.05;
    const top = upperTop + 1.5 + (L - 7) * 0.25;
    part(g, cyl(0.42, 0.5, top - y0, 8), stone, x, (y0 + top) / 2, z);
    part(g, cyl(0.58, 0.42, 0.26, 8), dark, x, top - 0.1, z);
    part(g, cyl(0.58, 0.58, 0.18, 8), pale, x, top + 0.12, z);
    part(g, cyl(0.6, 0.6, 0.06, 8), GOLD, x, top + 0.24, z);
    const tip = spire(g, x, top + 0.22, z, 0.56, 2.0, 8);
    finial(g, GOLD, x, tip, z);
    for (let i = 0; i < 4; i++) {
      const a = -0.6 + i * 1.5;
      part(g, box(0.11, 0.28, 0.07), WINDOW, x + Math.sin(a) * 0.44, y0 + (top - y0) * (0.35 + i * 0.17), z + Math.cos(a) * 0.44, 0, a);
    }
    if (L >= 9) {
      part(g, new THREE.OctahedronGeometry(0.2, 0), CRYSTAL, x, tip + 0.95, z).scale.set(1, 1.5, 1);
      part(g, ico(0.07), CRYSTAL, x + 0.3, tip + 0.75, z + 0.1);
      part(g, ico(0.05), CRYSTAL, x - 0.25, tip + 1.1, z - 0.15);
    }
  }
  if (L >= 10) {
    // the crown of a kingdom at full level, around the keep's spire
    const y = roofTip - 0.95;
    part(g, new THREE.TorusGeometry(0.5, 0.09, 4, 10), GOLD, 0, y, kz, Math.PI / 2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      part(g, cone(0.09, 0.3, 4), GOLD, Math.sin(a) * 0.5, y + 0.2, kz + Math.cos(a) * 0.5);
    }
  }
  // flag pole on the keep
  part(g, cyl(0.03, 0.035, 1.5, 5), WOOD, 0, roofTip + 0.75, kz);
  return { group: g, tip: roofTip, keepZ: kz };
}

interface Baked {
  geo: THREE.BufferGeometry;
  tip: number;
  keepZ: number;
}
const baked = new Map<number, Baked>();
let material: THREE.MeshLambertMaterial | null = null;
let pennant: THREE.BufferGeometry | null = null;
const IDENTITY = new THREE.Matrix4();

/** Swallow-tailed banner; x = 0 is the pole, so it turns about it. */
function pennantGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const p = [0, 0.3, 0, 0, -0.3, 0, 1.0, -0.26, 0, 1.0, 0.26, 0, 0.72, 0, 0];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 4, 1, 2, 4, 0, 4, 3]);
  g.computeVertexNormals();
  return g;
}

/**
 * Castle for a kingdom: the claim ring, the baked stone work tinted in the kingdom colour and a
 * banner (userData.banner, waved by the renderer). `userData.top` is the height of the flag.
 */
export function buildCastle(level: number, color: string): THREE.Group {
  const L = Math.min(Math.max(level, 1), MAX_LEVEL);
  let b = baked.get(L);
  if (!b) {
    const m = castleModel(L);
    b = { geo: bakeGroup(m.group), tip: m.tip, keepZ: m.keepZ };
    baked.set(L, b);
  }
  material ??= instancedMaterial();
  pennant ??= pennantGeometry();

  const g = new THREE.Group();
  g.scale.setScalar(castleScale(L));

  const claim = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.75, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  claim.rotation.x = -Math.PI / 2;
  claim.position.y = 0.08;
  g.add(claim);

  const body = new THREE.InstancedMesh(b.geo, material, 1);
  body.setMatrixAt(0, IDENTITY);
  body.setColorAt(0, new THREE.Color(color));
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const banner = new THREE.Mesh(pennant, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  banner.position.set(0, b.tip + 1.15, b.keepZ);
  banner.userData.banner = true;
  g.add(banner);
  g.userData.top = b.tip + 1.5;
  return g;
}

/** Transparent dome shown while a new kingdom is protected. */
export function buildShield(color: string) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.scale.y = 1.35;
  return m;
}
