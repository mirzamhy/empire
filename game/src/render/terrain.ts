// Terrain, sea, vegetation and the dragon altar built from the WorldMap (docs/rencana-visual.md 8).
//
// Terrain colours are computed once per triangle on the CPU (biome with ragged borders, grass
// patches, rock on slopes, snow on peaks, wet sand, valley shading), so the look stays flat and
// low-poly and costs nothing per frame. The shader only adds territory colours and cloud shadows.
import * as THREE from "three";
import { CELL, GRID_H, GRID_W, WORLD_H, WORLD_W, type Biome, type WorldMap } from "../sim/map";
import { vnoise } from "../sim/noise";
import { Rng } from "../sim/rng";
import { bakeGroup, instancedMaterial } from "./bake";
import { THEME } from "./theme";

export interface TerrainHandles {
  group: THREE.Group;
  water: THREE.Mesh;
  altarCrystal: THREE.Mesh;
  /** 1 texel per territory tile; set colours to paint kingdom land */
  territoryTex: THREE.DataTexture;
  territoryW: number;
  territoryH: number;
  /** hide trees within r metres of a point (castle footprint) */
  clearTrees(x: number, z: number, r: number): void;
  /** advance waves, wind and cloud shadows */
  update(time: number): void;
  /** 0..1 strength of the drifting cloud shadows (set by the atmosphere) */
  cloudShadow: { value: number };
  /** number of vegetation instances, for the perf overlay */
  plants: number;
}

export const TERRITORY_TILE = 4; // metres

// ---------------------------------------------------------------- noise


const GLSL_NOISE = `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distance in cells from every cell to the nearest cell matching `source` (4-neighbour BFS). */
function distanceField(source: (i: number) => boolean): Float32Array {
  const n = GRID_W * GRID_H;
  const d = new Float32Array(n).fill(1e9);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++)
    if (source(i)) {
      d[i] = 0;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++];
    const x = i % GRID_W;
    const y = (i / GRID_W) | 0;
    const nd = d[i] + 1;
    if (x > 0 && d[i - 1] > nd) (d[i - 1] = nd), (queue[tail++] = i - 1);
    if (x < GRID_W - 1 && d[i + 1] > nd) (d[i + 1] = nd), (queue[tail++] = i + 1);
    if (y > 0 && d[i - GRID_W] > nd) (d[i - GRID_W] = nd), (queue[tail++] = i - GRID_W);
    if (y < GRID_H - 1 && d[i + GRID_W] > nd) (d[i + GRID_W] = nd), (queue[tail++] = i + GRID_W);
  }
  return d;
}

// ---------------------------------------------------------------- ground colours

/** Two tones per biome; a 40 m noise picks between them (young and old grass, pale and deep sand). */
const GROUND: Record<Biome, [number, number]> = THEME.ground;
const ROCK = new THREE.Color(THEME.rock);
const ROCK_DARK = new THREE.Color(THEME.rockDark);
const SNOW = new THREE.Color(0xeef2f5);
const WET_SAND = new THREE.Color(THEME.wetSand);
const SNOW_LINE = THEME.snowLine;
/** trees thin out above this height and stop a little below the snow */
const TREE_LINE = THEME.treeLine;
/** damp earth along a river */
const RIVER_MUD = new THREE.Color(0x3a3a2a);

/**
 * `plantDensity` thins or thickens all vegetation (1 = designed density). The forest is most of
 * the scene's triangles, so a weak streaming PC can run with `?veg=0.6`.
 */
export function buildTerrain(map: WorldMap, plantDensity = 1, simpleTrees = false): TerrainHandles {
  const group = new THREE.Group();
  const rng = new Rng(42);
  const time = { value: 0 };
  const cloudShadow = { value: 0.25 };

  // Height per grid corner = average of neighbouring cell centres.
  const cw = GRID_W + 1;
  const ch = GRID_H + 1;
  const hc = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      let s = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const cx = x + dx;
        const cy = y + dy;
        s += cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H ? -6.15 : map.height[cy * GRID_W + cx];
      }
      hc[y * cw + x] = s / 4;
    }

  const distWater = distanceField((i) => map.biome[i] === "water");
  const distLand = distanceField((i) => map.biome[i] !== "water");

  // valley shading: how far a cell sits below the average of its 5x5 neighbourhood
  const valley = new Float32Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) continue;
          s += map.height[cy * GRID_W + cx];
          n++;
        }
      valley[y * GRID_W + x] = Math.max(0, s / n - map.height[y * GRID_W + x]);
    }

  // Non-indexed triangles so every face is flat (low-poly look).
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const c = new THREE.Color();
  const c2 = new THREE.Color();
  const c3 = new THREE.Color();
  const ox = -WORLD_W / 2;
  const oz = -WORLD_H / 2;
  const corner = (x: number, y: number) => [ox + x * CELL, hc[y * cw + x], oz + y * CELL];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  /** Colour of one triangle from its centre, height, steepness and the cell it belongs to. */
  const triColor = (wx: number, wz: number, h: number, ny: number, cellX: number, cellY: number) => {
    const own = map.biome[cellY * GRID_W + cellX];
    // ragged biome borders: look up the biome a noisy step away
    let b = own;
    if (own !== "water") {
      const jx = Math.round(cellX + (vnoise(wx * 0.31, wz * 0.31) - 0.5) * 2.4);
      const jy = Math.round(cellY + (vnoise(wx * 0.31 + 91, wz * 0.31 + 17) - 0.5) * 2.4);
      if (jx >= 0 && jy >= 0 && jx < GRID_W && jy < GRID_H) {
        const other = map.biome[jy * GRID_W + jx];
        if (other !== "water") b = other;
      }
    }
    const i = cellY * GRID_W + cellX;
    const macro = vnoise(wx / 40, wz / 40) * 0.65 + vnoise(wx / 9 + 40, wz / 9) * 0.35;
    const [ta, tb] = GROUND[b];
    c.setHex(ta).lerp(c2.setHex(tb), smooth(0.3, 0.7, macro));
    if (b === "mountain" && THEME.woodedSlopes) {
      // lower slopes keep the forest floor; bare rock colours start near the tree line
      const [fa, fb] = GROUND.forest;
      c3.setHex(fa).lerp(c2.setHex(fb), smooth(0.3, 0.7, macro));
      c.lerp(c3, 1 - smooth(TREE_LINE - 10, TREE_LINE + 3, h + (vnoise(wx * 0.15, wz * 0.15) - 0.5) * 6));
    }
    if (own === "water") {
      // sea floor: lighter in the shallows
      c.setHex(ta).lerp(c2.setHex(tb), smooth(0, 5, distLand[i]));
    } else {
      // wet sand along the shore
      if (distWater[i] <= 1.5 && h < 0.6) c.lerp(WET_SAND, 0.6 * (1 - smooth(0.2, 0.6, h)));
      // cliffs: steep faces turn to rock
      if (b !== "beach") {
        c.lerp(ROCK, smooth(0.86, 0.68, ny) * 0.9);
        c.lerp(ROCK_DARK, smooth(0.66, 0.45, ny) * 0.8);
      }
      // snow on the peaks, with a ragged line
      const snow = smooth(SNOW_LINE, SNOW_LINE + 4, h + (vnoise(wx * 0.22, wz * 0.22) - 0.5) * 6);
      if (snow > 0) c.lerp(SNOW, snow * smooth(0.35, 0.6, ny));
      // valleys are darker (a river valley is cut on purpose, so it is spared most of this)
      const bank = map.riverBank[i];
      c.multiplyScalar(1 - Math.min(0.22, valley[i] * 0.05) * (bank < 20 ? 0.3 : 1));
      // damp, dark earth in the river bed and along its banks
      if (bank < 3.5) c.lerp(RIVER_MUD, 0.75 * (1 - smooth(-0.5, 3.5, bank)));
    }
    // brightness drift and a little per-face variation keep the facets readable
    c.multiplyScalar((0.94 + macro * 0.12) * (0.97 + rng.next() * 0.06));
  };

  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      const a = corner(x, y);
      const bb = corner(x + 1, y);
      const cc = corner(x + 1, y + 1);
      const d = corner(x, y + 1);
      const flip = (x + y) % 2 === 0;
      const tris = flip ? [a, d, bb, bb, d, cc] : [a, d, cc, a, cc, bb];
      for (let t = 0; t < 2; t++) {
        const p0 = tris[t * 3];
        const p1 = tris[t * 3 + 1];
        const p2 = tris[t * 3 + 2];
        e1.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        e2.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
        nrm.crossVectors(e1, e2).normalize();
        triColor((p0[0] + p1[0] + p2[0]) / 3, (p0[2] + p1[2] + p2[2]) / 3, (p0[1] + p1[1] + p2[1]) / 3, Math.abs(nrm.y), x, y);
        for (const p of [p0, p1, p2]) {
          pos.push(p[0], p[1], p[2]);
          col.push(c.r, c.g, c.b);
          uv.push((p[0] - ox) / WORLD_W, (p[2] - oz) / WORLD_H);
        }
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  // Territory overlay: a small RGBA texture sampled with the terrain UV, alpha = ownership strength.
  const territoryW = Math.ceil(WORLD_W / TERRITORY_TILE);
  const territoryH = Math.ceil(WORLD_H / TERRITORY_TILE);
  const territoryTex = new THREE.DataTexture(new Uint8Array(territoryW * territoryH * 4), territoryW, territoryH);
  // linear filtering turns the 4 m tiles into soft blobs with a glowing rim at the border
  territoryTex.magFilter = THREE.LinearFilter;
  territoryTex.flipY = false;
  territoryTex.needsUpdate = true;

  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.territory = { value: territoryTex };
    shader.uniforms.uTime = time;
    shader.uniforms.uCloud = cloudShadow;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTerrUv;\nvarying vec2 vWorldXZ;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTerrUv = uv;\nvWorldXZ = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform sampler2D territory;\nuniform float uTime;\nuniform float uCloud;\nvarying vec2 vTerrUv;\nvarying vec2 vWorldXZ;${GLSL_NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec4 terr = texture2D(territory, vTerrUv);
diffuseColor.rgb = mix(diffuseColor.rgb, terr.rgb, terr.a * 0.7);
// soft cloud shadows drifting with the wind
vec2 cp = vWorldXZ / 70.0 + vec2(uTime * 0.012, uTime * 0.007);
float cloud = smoothstep(0.5, 0.78, vnoise(cp) * 0.7 + vnoise(cp * 2.3 + 7.0) * 0.3);
diffuseColor.rgb *= 1.0 - cloud * uCloud;`,
      );
  };
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Where a river runs at lake level its channel fills with the lake's own water; treat the
  // channel and the mouth as open water there, so no foam line or pale shallows cut across it.
  const distShore = distLand.slice();
  for (let i = 0; i < distShore.length; i++) if (map.riverBank[i] < 5) distShore[i] = Math.max(distShore[i], 3 * (1 - smooth(1, 5, map.riverBank[i])));
  const water = buildWater(distShore, time);
  group.add(water);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 6, WORLD_H * 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: THEME.deepSea }));
  deep.position.y = -7;
  group.add(deep);

  const veg = buildVegetation(map, time, plantDensity, distWater, map.def.detailedTrees && !simpleTrees);
  group.add(...veg.meshes);
  if (map.rivers.length) group.add(buildRivers(map, time));

  const { altar, crystal } = buildAltar();
  altar.position.set(map.altar.x, map.heightAt(map.altar.x, map.altar.z), map.altar.z);
  group.add(altar);

  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Vector3();
  const clearTrees = (x: number, z: number, r: number) => {
    for (const im of veg.meshes) {
      const list = im.userData.trees as THREE.Matrix4[];
      let changed = false;
      list.forEach((m, i) => {
        tmp.setFromMatrixPosition(m);
        if (Math.hypot(tmp.x - x, tmp.z - z) < r) {
          im.setMatrixAt(i, hidden);
          changed = true;
        }
      });
      if (changed) im.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    group, water, altarCrystal: crystal, territoryTex, territoryW, territoryH, clearTrees, cloudShadow, plants: veg.count,
    update: (t) => (time.value = t),
  };
}

// ---------------------------------------------------------------- water

/**
 * Sea with depth colours from the distance to land, a foam line breathing along the shore and
 * low faceted waves. One mesh, one draw call.
 */
function buildWater(distLand: Float32Array, time: { value: number }) {
  // distance to land, 0..1 over ten cells, sampled with world coordinates
  const data = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, distLand[i] / 10) * 255);
  const distTex = new THREE.DataTexture(data, GRID_W, GRID_H, THREE.RedFormat);
  distTex.magFilter = THREE.LinearFilter;
  distTex.minFilter = THREE.LinearFilter;
  distTex.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(WORLD_W * 2.2, WORLD_H * 2.6, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uDist = { value: distTex };
    shader.uniforms.uSize = { value: new THREE.Vector2(WORLD_W, WORLD_H) };
    shader.uniforms.uShallow = { value: new THREE.Color(THEME.water.shallow) };
    shader.uniforms.uMid = { value: new THREE.Color(THEME.water.mid) };
    shader.uniforms.uDeep = { value: new THREE.Color(THEME.water.deep) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec2 vWorldXZ;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
transformed.y += sin(position.x * 0.11 + uTime * 1.1) * 0.09 + sin(position.z * 0.16 - uTime * 1.5 + position.x * 0.05) * 0.07;
vWorldXZ = position.xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nuniform sampler2D uDist;\nuniform vec2 uSize;\nuniform vec3 uShallow;\nuniform vec3 uMid;\nuniform vec3 uDeep;\nvarying vec2 vWorldXZ;${GLSL_NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
vec2 muv = vWorldXZ / uSize + 0.5;
float inside = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
float d = mix(1.0, texture2D(uDist, clamp(muv, 0.0, 1.0)).r, inside);
vec3 sea = mix(uShallow, uMid, smoothstep(0.03, 0.3, d));
sea = mix(sea, uDeep, smoothstep(0.3, 1.0, d));
// foam: a band that moves in and out along the shore, broken up by noise
float n = vnoise(vWorldXZ * 0.45 + uTime * 0.15);
float edge = 0.07 + 0.025 * sin(uTime * 1.3 + n * 6.2831);
float foam = (1.0 - smoothstep(edge - 0.03, edge, d)) * step(0.35, n + 0.25 * sin(uTime * 0.9));
diffuseColor.rgb = mix(sea, vec3(0.96, 0.98, 1.0), foam * 0.65);
diffuseColor.a = mix(mix(0.6, 0.93, smoothstep(0.0, 0.45, d)), 0.85, foam);`,
      );
  };
  const water = new THREE.Mesh(geo, mat);
  water.position.y = -0.25;
  return water;
}

// ---------------------------------------------------------------- vegetation

const lam = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
/**
 * Foliage is baked white and flagged as tint, so each instance can have its own leaf colour.
 * `shade` darkens or lightens one part against the rest (lower boughs dark, crown light).
 */
const leaf = (shade = 1) => {
  const m = lam(0xffffff);
  m.userData.tint = true;
  m.userData.shade = shade;
  return m;
};
/** A mesh with a turn about Y as well, for tiers and boughs that should not line up. */
const turned = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry: number, tilt = 0, s: [number, number, number] = [1, 1, 1]) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(tilt, ry, tilt * 0.6);
  m.scale.set(s[0], s[1], s[2]);
  g.add(m);
};
const mesh = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  m.scale.set(s[0], s[1], s[2]);
  g.add(m);
};

type PlantKind =
  | "oakRound" | "oakTall" | "oakWide" | "pine" | "pineTall" | "pineSnow" | "birch" | "bush"
  | "dead" | "cactus" | "palm" | "rock" | "boulder" | "grass" | "flower" | "reed" | "fern" | "stump" | "log";

/** Leaf colours per kind (the instance colour varies around one of these). */
const LEAF: Partial<Record<PlantKind, number[]>> = THEME.leaf;

/**
 * Detailed trees (maps that ask for them): more tiers and boughs, each turned and tilted a little
 * so no two faces line up, lower foliage darker than the crown, trunks that flare at the root.
 * Returns null for kinds that have no detailed version.
 */
function detailedPlant(kind: PlantKind): THREE.BufferGeometry | null {
  const g = new THREE.Group();
  const bark = lam(0x4a3220);
  const barkDark = lam(0x35241a);
  switch (kind) {
    case "pine": {
      // spruce: a broad skirt of four drooping tiers, each smaller, lighter and turned
      mesh(g, new THREE.CylinderGeometry(0.1, 0.3, 1.7, 5, 1, true), barkDark, 0, 0.85, 0);
      const tiers: [number, number, number, number][] = [[1.3, 1.45, 1.35, 0.74], [1.05, 1.35, 2.15, 0.86], [0.78, 1.25, 2.95, 0.98], [0.5, 1.25, 3.75, 1.12]];
      tiers.forEach(([r, h, y, shade], i) => turned(g, new THREE.ConeGeometry(r, h, 6, 1, true), leaf(shade), (i % 2 ? 0.06 : -0.05) * (4 - i), y, i % 2 ? -0.04 : 0.05, i * 0.55, (i % 2 ? 1 : -1) * 0.05));
      break;
    }
    case "pineTall": {
      // fir: tall and narrow, bare trunk below, five tight tiers and a leader on top
      mesh(g, new THREE.CylinderGeometry(0.1, 0.32, 2.6, 5, 1, true), barkDark, 0, 1.3, 0);
      const tiers: [number, number, number, number][] = [[1.08, 1.3, 2.3, 0.72], [0.95, 1.25, 3.05, 0.82], [0.78, 1.2, 3.8, 0.92], [0.6, 1.15, 4.5, 1.02], [0.4, 1.3, 5.25, 1.14]];
      tiers.forEach(([r, h, y, shade], i) => turned(g, new THREE.ConeGeometry(r, h, 6, 1, true), leaf(shade), (i % 2 ? 0.05 : -0.04) * (5 - i) * 0.6, y, 0, i * 0.7, (i % 2 ? 1 : -1) * 0.04));
      break;
    }
    case "oakRound": {
      // a forked trunk under a crown of three clumps: dark underneath, light on top
      mesh(g, new THREE.CylinderGeometry(0.2, 0.42, 1.5, 5, 1, true), bark, 0, 0.75, 0);
      mesh(g, new THREE.CylinderGeometry(0.1, 0.17, 1.1, 3, 1, true), bark, 0.42, 1.75, 0.1, 0, -0.62);
      turned(g, new THREE.IcosahedronGeometry(1.15, 0), leaf(0.8), -0.15, 2.05, 0, 0.4, 0, [1.15, 0.85, 1.1]);
      turned(g, new THREE.IcosahedronGeometry(0.85, 0), leaf(0.96), 0.85, 2.45, 0.3, 1.3, 0.2);
      turned(g, new THREE.IcosahedronGeometry(0.8, 0), leaf(1.12), -0.2, 3.0, -0.25, 2.2, 0.1, [1.1, 0.8, 1.05]);
      break;
    }
    case "oakTall": {
      mesh(g, new THREE.CylinderGeometry(0.18, 0.4, 2.4, 5, 1, true), bark, 0, 1.2, 0);
      mesh(g, new THREE.CylinderGeometry(0.08, 0.14, 1.0, 3, 1, true), bark, -0.38, 2.3, 0, 0, 0.7);
      turned(g, new THREE.IcosahedronGeometry(1.05, 0), leaf(0.78), 0.1, 2.75, 0, 0.9, 0, [1.1, 1.0, 1.05]);
      turned(g, new THREE.IcosahedronGeometry(0.9, 0), leaf(0.95), -0.25, 3.6, 0.15, 2.0, 0.15);
      turned(g, new THREE.IcosahedronGeometry(0.62, 0), leaf(1.12), 0.2, 4.4, -0.1, 0.3, 0.1);
      break;
    }
    case "oakWide": {
      // an old spreading tree: thick short trunk, two heavy limbs, a low wide crown
      mesh(g, new THREE.CylinderGeometry(0.26, 0.5, 1.3, 5, 1, true), bark, 0, 0.65, 0);
      mesh(g, new THREE.CylinderGeometry(0.11, 0.2, 1.3, 3, 1, true), bark, 0.6, 1.55, 0, 0, -0.85);
      mesh(g, new THREE.CylinderGeometry(0.1, 0.18, 1.1, 3, 1, true), bark, -0.5, 1.55, 0.2, 0, 0.8);
      turned(g, new THREE.IcosahedronGeometry(1.3, 0), leaf(0.8), 0, 2.0, 0, 0.5, 0, [1.3, 0.62, 1.2]);
      turned(g, new THREE.IcosahedronGeometry(0.9, 0), leaf(0.97), 1.15, 2.05, 0.35, 1.7, 0.15, [1.2, 0.7, 1.1]);
      turned(g, new THREE.IcosahedronGeometry(0.85, 0), leaf(1.1), -0.95, 2.3, -0.4, 2.6, 0.1, [1.15, 0.7, 1.1]);
      break;
    }
    case "birch": {
      // slender white stem with dark bands and a light, airy crown
      mesh(g, new THREE.CylinderGeometry(0.08, 0.17, 3.0, 4, 1, true), lam(0xd9d5c9), 0, 1.5, 0);
      mesh(g, new THREE.CylinderGeometry(0.135, 0.145, 0.1, 4, 1, true), lam(0x33302c), 0, 0.9, 0);
      mesh(g, new THREE.CylinderGeometry(0.115, 0.125, 0.09, 4, 1, true), lam(0x33302c), 0, 1.7, 0);
      turned(g, new THREE.IcosahedronGeometry(0.75, 0), leaf(0.84), 0, 2.9, 0, 0.3, 0, [1, 1.2, 1]);
      turned(g, new THREE.IcosahedronGeometry(0.55, 0), leaf(1.0), 0.42, 3.45, 0.15, 1.4, 0.2);
      turned(g, new THREE.IcosahedronGeometry(0.45, 0), leaf(1.14), -0.2, 3.95, -0.1, 2.4, 0.1);
      break;
    }
    case "bush":
      turned(g, new THREE.IcosahedronGeometry(0.55, 0), leaf(0.82), 0, 0.38, 0, 0.4, 0, [1.25, 0.8, 1.05]);
      turned(g, new THREE.IcosahedronGeometry(0.4, 0), leaf(1.0), 0.5, 0.36, 0.2, 1.5, 0.2);
      turned(g, new THREE.IcosahedronGeometry(0.3, 0), leaf(1.14), -0.1, 0.72, -0.15, 2.3, 0.1);
      break;
    default:
      return null;
  }
  return bakeGroup(g);
}

function plantGeometry(kind: PlantKind, detailed = false): THREE.BufferGeometry {
  if (detailed) {
    const rich = detailedPlant(kind);
    if (rich) return rich;
  }
  const g = new THREE.Group();
  const bark = lam(0x6b4423);
  const L = leaf();
  switch (kind) {
    case "oakRound":
      mesh(g, new THREE.CylinderGeometry(0.2, 0.34, 1.5, 4, 1, true), bark, 0, 0.75, 0);
      mesh(g, new THREE.IcosahedronGeometry(1.2, 0), L, 0, 2.1, 0);
      mesh(g, new THREE.IcosahedronGeometry(0.75, 0), L, 0.7, 2.6, 0.3);
      break;
    case "oakTall":
      mesh(g, new THREE.CylinderGeometry(0.2, 0.36, 2.2, 4, 1, true), bark, 0, 1.1, 0);
      mesh(g, new THREE.IcosahedronGeometry(1.1, 0), L, 0, 2.6, 0, 0, 0, [1, 1.15, 1]);
      mesh(g, new THREE.IcosahedronGeometry(0.8, 0), L, 0.1, 3.7, -0.1);
      break;
    case "oakWide":
      mesh(g, new THREE.CylinderGeometry(0.24, 0.4, 1.3, 4, 1, true), bark, 0, 0.65, 0);
      mesh(g, new THREE.CylinderGeometry(0.1, 0.16, 0.9, 3, 1, true), bark, 0.45, 1.5, 0, 0, -0.7);
      mesh(g, new THREE.IcosahedronGeometry(1.3, 0), L, 0, 2.0, 0, 0, 0, [1.35, 0.7, 1.25]);
      mesh(g, new THREE.IcosahedronGeometry(0.8, 0), L, -0.9, 1.75, 0.5, 0, 0, [1.2, 0.7, 1.1]);
      break;
    case "pine":
      // open cones and trunk: nobody sees a pine from below, and forests are made of thousands
      mesh(g, new THREE.CylinderGeometry(0.18, 0.28, 1.3, 4, 1, true), lam(0x4a2f1c), 0, 0.65, 0);
      for (let i = 0; i < 3; i++) mesh(g, new THREE.ConeGeometry(1.15 - i * 0.25, 1.5 - i * 0.2, 6, 1, true), L, 0, 1.5 + i * 0.85, 0);
      break;
    case "pineTall":
      mesh(g, new THREE.CylinderGeometry(0.16, 0.3, 2.0, 4, 1, true), lam(0x4a2f1c), 0, 1.0, 0);
      for (let i = 0; i < 4; i++) mesh(g, new THREE.ConeGeometry(1.0 - i * 0.2, 1.5 - i * 0.15, 6, 1, true), L, 0, 2.0 + i * 0.9, 0);
      break;
    case "pineSnow":
      mesh(g, new THREE.CylinderGeometry(0.18, 0.28, 1.3, 5), lam(0x5c3a21), 0, 0.65, 0);
      for (let i = 0; i < 3; i++) {
        mesh(g, new THREE.ConeGeometry(1.1 - i * 0.25, 1.4 - i * 0.2, 6), L, 0, 1.5 + i * 0.85, 0);
        mesh(g, new THREE.ConeGeometry(0.75 - i * 0.18, 0.75 - i * 0.1, 6), lam(0xf2f5f7), 0, 1.92 + i * 0.85, 0);
      }
      break;
    case "birch":
      mesh(g, new THREE.CylinderGeometry(0.11, 0.17, 2.6, 4, 1, true), lam(0xd6d2c6), 0, 1.3, 0);
      mesh(g, new THREE.BoxGeometry(0.21, 0.08, 0.21), lam(0x3a3632), 0, 1.2, 0);
      mesh(g, new THREE.IcosahedronGeometry(0.8, 0), L, 0, 3.0, 0, 0, 0, [1, 1.25, 1]);
      mesh(g, new THREE.IcosahedronGeometry(0.55, 0), L, 0.4, 2.4, 0.2);
      break;
    case "bush":
      mesh(g, new THREE.IcosahedronGeometry(0.55, 0), L, 0, 0.4, 0, 0, 0, [1.2, 0.8, 1]);
      mesh(g, new THREE.IcosahedronGeometry(0.4, 0), L, 0.5, 0.32, 0.2);
      break;
    case "dead":
      mesh(g, new THREE.CylinderGeometry(0.1, 0.24, 2.2, 5), lam(0x6a5a4a), 0, 1.1, 0);
      mesh(g, new THREE.CylinderGeometry(0.04, 0.09, 1.1, 4), lam(0x6a5a4a), 0.35, 1.9, 0, 0, -0.8);
      mesh(g, new THREE.CylinderGeometry(0.03, 0.08, 0.9, 4), lam(0x6a5a4a), -0.3, 1.6, 0.1, 0, 0.9);
      break;
    case "cactus":
      mesh(g, new THREE.CylinderGeometry(0.24, 0.28, 2.0, 6), lam(0x4f8a3a), 0, 1.0, 0);
      mesh(g, new THREE.CylinderGeometry(0.13, 0.13, 0.6, 5), lam(0x4f8a3a), 0.42, 1.1, 0, 0, Math.PI / 2);
      mesh(g, new THREE.CylinderGeometry(0.13, 0.15, 0.8, 5), lam(0x4f8a3a), 0.66, 1.5, 0);
      mesh(g, new THREE.CylinderGeometry(0.12, 0.12, 0.5, 5), lam(0x478036), -0.38, 0.8, 0, 0, Math.PI / 2);
      mesh(g, new THREE.CylinderGeometry(0.12, 0.14, 0.6, 5), lam(0x478036), -0.58, 1.1, 0);
      break;
    case "palm":
      mesh(g, new THREE.CylinderGeometry(0.16, 0.26, 2.2, 5), lam(0x854d0e), 0, 1.1, 0, 0, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 4), L);
        frond.position.set(Math.cos(a) * 0.6 - 0.13, 2.15, Math.sin(a) * 0.6);
        frond.rotation.z = -Math.cos(a) * 1.15;
        frond.rotation.x = Math.sin(a) * 1.15;
        g.add(frond);
      }
      break;
    case "rock":
      mesh(g, new THREE.IcosahedronGeometry(0.8, 0), lam(0x6a645e), 0, 0.3, 0, 0, 0, [1.2, 0.7, 1]);
      break;
    case "boulder":
      mesh(g, new THREE.IcosahedronGeometry(1.3, 0), lam(0x5f5953), 0, 0.6, 0, 0.3, 0.2, [1.1, 0.9, 1]);
      mesh(g, new THREE.IcosahedronGeometry(0.7, 0), lam(0x746d66), 1.1, 0.25, 0.4, 0, 0, [1, 0.7, 1.1]);
      break;
    case "grass":
      for (let i = 0; i < 4; i++) mesh(g, new THREE.ConeGeometry(0.07, 0.55 - (i % 2) * 0.15, 3), L, Math.cos(i * 1.7) * 0.14, 0.25, Math.sin(i * 1.7) * 0.14, Math.sin(i * 1.7) * 0.25, -Math.cos(i * 1.7) * 0.25);
      break;
    case "reed":
      // a clump of tall blades with a few brown heads, for river banks
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        const r = 0.12 + (i % 3) * 0.1;
        const hgt = 1.0 + (i % 4) * 0.22;
        mesh(g, new THREE.ConeGeometry(0.05, hgt, 3), L, Math.cos(a) * r, hgt / 2, Math.sin(a) * r, Math.sin(a) * 0.12, -Math.cos(a) * 0.12);
        if (i % 2 === 0) mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.22, 4), lam(0x4a3220), Math.cos(a) * r * 1.15, hgt * 0.92, Math.sin(a) * r * 1.15);
      }
      break;
    case "fern":
      // five fronds arching out from the middle
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const tip = [Math.cos(a) * 0.8, 0.22, Math.sin(a) * 0.8];
        const side = [-Math.sin(a) * 0.17, 0, Math.cos(a) * 0.17];
        const mid = [Math.cos(a) * 0.4, 0.48, Math.sin(a) * 0.4];
        const frond = new THREE.BufferGeometry();
        frond.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.05, 0, mid[0] + side[0], mid[1], mid[2] + side[2], mid[0] - side[0], mid[1], mid[2] - side[2], mid[0] + side[0], mid[1], mid[2] + side[2], tip[0], tip[1], tip[2], mid[0] - side[0], mid[1], mid[2] - side[2]], 3));
        g.add(new THREE.Mesh(frond, leaf(i % 2 ? 1.08 : 0.88)));
      }
      break;
    case "stump":
      mesh(g, new THREE.CylinderGeometry(0.3, 0.42, 0.55, 6), lam(0x4a3220), 0, 0.27, 0);
      mesh(g, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 6), lam(0x9a8460), 0, 0.56, 0);
      break;
    case "log":
      // a fallen trunk with moss on its upper side
      mesh(g, new THREE.CylinderGeometry(0.24, 0.3, 3.2, 5, 1, true), lam(0x45301f), 0, 0.26, 0, Math.PI / 2);
      mesh(g, new THREE.BoxGeometry(0.34, 0.1, 1.6), L, 0, 0.5, 0.3);
      mesh(g, new THREE.CylinderGeometry(0.06, 0.1, 0.8, 3, 1, true), lam(0x45301f), 0.3, 0.5, -0.8, 0, -0.9);
      break;
    case "flower":
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3, 1, true), lam(0x4a7632), 0, 0.2, 0);
      mesh(g, new THREE.OctahedronGeometry(0.13, 0), L, 0, 0.45, 0);
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 3, 1, true), lam(0x4a7632), 0.22, 0.15, 0.1);
      mesh(g, new THREE.OctahedronGeometry(0.1, 0), L, 0.22, 0.35, 0.1);
      break;
  }
  return bakeGroup(g);
}

/** Instanced material whose upper vertices sway in the wind (trunks and rocks stay still). */
function windMaterial(time: { value: number }, grounded = false) {
  const mat = instancedMaterial();
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base.call(mat, shader, renderer);
    shader.uniforms.uTime = time;
    // detailed trees: darker toward the ground, as if the canopy shaded its own lower boughs
    if (grounded) shader.vertexShader = shader.vertexShader.replace("vTint = tint;", "vTint = tint;\nvColor.rgb *= mix(0.72, 1.05, smoothstep(0.1, 3.4, position.y));");
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
#ifdef USE_INSTANCING
  float swayH = smoothstep(0.3, 3.0, position.y);
  float swayP = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
  transformed.x += sin(uTime * 1.6 + swayP) * 0.1 * swayH;
  transformed.z += cos(uTime * 1.25 + swayP * 1.3) * 0.08 * swayH;
#endif`,
    );
  };
  return mat;
}

/**
 * Place plants by biome with a density noise, so forests have thick groves and small clearings
 * and the plains stay open enough to read the armies.
 */
function buildVegetation(map: WorldMap, time: { value: number }, plantDensity: number, distWater: Float32Array, detailed: boolean) {
  const rng = new Rng(4242);
  const bright = THEME.id === "bright";
  const kinds: PlantKind[] = ["oakRound", "oakTall", "oakWide", "pine", "pineTall", "pineSnow", "birch", "bush", "dead", "cactus", "palm", "rock", "boulder", "grass", "flower", "reed", "fern", "stump", "log"];
  const spots = new Map<PlantKind, { m: THREE.Matrix4; c: THREE.Color }[]>(kinds.map((k) => [k, []]));
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dens = (CELL / 1.5) ** 2 * plantDensity; // plants per square metre stay constant when the cell size changes
  const pick = <T,>(list: T[]) => list[Math.floor(rng.next() * list.length) % list.length];

  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const b = map.biome[i];
    if (b === "water") continue;
    const p = map.cellCenter(i);
    const x = p.x + (rng.next() - 0.5) * CELL * 0.8;
    const z = p.z + (rng.next() - 0.5) * CELL * 0.8;
    const r = rng.next() / dens;
    const grove = smooth(0.32, 0.68, vnoise(p.x / 26, p.z / 26)); // 0 = clearing, 1 = thick
    const mix = vnoise(p.x / 55 + 30, p.z / 55 + 9); // which species dominates here
    const h = map.height[i];
    let kind: PlantKind | null = null;
    const bank = map.riverBank[i];
    if (bank < 4) {
      // nothing grows in the channel; reeds, stones and a few bushes line the banks
      if (bank < 0.8) continue;
      if (b === "mountain" || b === "beach") kind = r < 0.1 ? "rock" : null;
      else kind = r < 0.3 ? "reed" : r < 0.36 ? "rock" : r < 0.42 ? "bush" : null;
    } else if (b === "forest") {
      if (r < 0.06 + 0.38 * grove) {
        const t = rng.next();
        // the first map is a mixed wood; on the dark maps conifers dominate, with broadleaf pockets
        if (mix < (bright ? 0.38 : 0.56)) kind = bright ? (t < 0.55 ? "pine" : t < 0.85 ? "pineTall" : "bush") : t < 0.5 ? "pine" : t < 0.92 ? "pineTall" : "bush";
        else if (mix < (bright ? 0.7 : 0.78)) kind = t < 0.4 ? "oakRound" : t < 0.65 ? "oakTall" : t < 0.8 ? "birch" : t < 0.92 ? "bush" : "pine";
        else kind = t < 0.35 ? "oakWide" : t < 0.6 ? "oakRound" : t < 0.85 ? "birch" : "bush";
      } else if (r < 0.1 + 0.4 * grove) kind = rng.next() < 0.6 ? "grass" : "flower";
      // forest floor: ferns under the trees, here and there a stump or a fallen trunk
      else if (detailed && r < 0.17 + 0.5 * grove) kind = "fern";
      else if (detailed && r < 0.18 + 0.5 * grove) kind = rng.next() < 0.5 ? "stump" : "log";
    } else if (b === "plains") {
      const meadow = smooth(0.5, 0.75, vnoise(p.x / 18 + 70, p.z / 18));
      if (r < 0.015) kind = rng.next() < 0.6 ? "oakWide" : "oakRound";
      else if (r < 0.04) kind = rng.next() < 0.7 ? "bush" : "rock";
      else if (r < 0.04 + 0.16 * meadow) kind = rng.next() < 0.65 ? "grass" : "flower";
    } else if (b === "desert" && bright) {
      // desert: palms by the water, cactus, dead wood and boulders
      if (distWater[i] < 4 && r < 0.07) kind = "palm";
      else if (r < 0.03) kind = "cactus";
      else if (r < 0.045) kind = rng.next() < 0.5 ? "dead" : "rock";
      else if (r < 0.055) kind = "boulder";
    } else if (b === "desert") {
      // moor: heather-like bushes, dead trees and stones, with tufts of dry grass
      if (r < 0.035) kind = "bush";
      else if (r < 0.055) kind = rng.next() < 0.55 ? "dead" : "rock";
      else if (r < 0.065) kind = "boulder";
      else if (r < 0.2) kind = "grass";
    } else if (b === "mountain" && bright) {
      if (h > SNOW_LINE + 4) kind = r < 0.05 ? "boulder" : null; // bare peaks
      else if (h > SNOW_LINE - 6) kind = r < 0.06 ? "pineSnow" : r < 0.11 ? "boulder" : null;
      else if (r < 0.07) kind = rng.next() < 0.6 ? "pine" : "pineTall";
      else if (r < 0.13) kind = rng.next() < 0.6 ? "rock" : "boulder";
      else if (r < 0.14) kind = "dead";
    } else if (b === "mountain") {
      if (h > SNOW_LINE) kind = r < 0.012 ? "rock" : null; // bare peaks
      else if (h > TREE_LINE + 6) kind = r < 0.04 ? "pineSnow" : r < 0.07 ? "boulder" : null;
      else if (h > TREE_LINE) kind = r < 0.1 ? (rng.next() < 0.5 ? "pine" : "pineSnow") : r < 0.14 ? "rock" : null;
      // below the tree line the slopes are wooded like the foothills
      else if (r < 0.1 + 0.32 * grove) kind = rng.next() < 0.5 ? "pine" : "pineTall";
      else if (r < 0.13 + 0.32 * grove) kind = rng.next() < 0.6 ? "rock" : "boulder";
    } else if (b === "beach") {
      if (r < 0.03) kind = bright ? "palm" : "rock";
      else if (r < (bright ? 0.05 : 0.04)) kind = bright ? "rock" : "dead"; // driftwood
    }
    if (!kind) continue;
    if (Math.hypot(x - map.altar.x, z - map.altar.z) < 12) continue;
    if (map.landmarks.some((l) => Math.hypot(x - l.x, z - l.z) < l.r + 1)) continue;
    const small = kind === "grass" || kind === "flower" || kind === "reed" || kind === "fern";
    const tree = kind === "pine" || kind === "pineTall" || kind === "oakRound" || kind === "oakTall" || kind === "oakWide";
    // forest trees are tall enough to close the canopy; castles (about 10 m) still stand above them
    const s = small ? 0.8 + rng.next() * 0.7 : tree && !bright ? 0.85 + rng.next() * 0.6 : 0.65 + rng.next() * 0.45;
    q.setFromAxisAngle(up, rng.next() * Math.PI * 2);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, map.heightAt(x, z) - 0.05, z), q, new THREE.Vector3(s, s * (0.9 + rng.next() * 0.25), s));
    const tones = LEAF[kind];
    const c = new THREE.Color(tones ? pick(tones) : 0xffffff);
    if (tones) c.multiplyScalar(0.9 + rng.next() * 0.2);
    spots.get(kind)!.push({ m, c });
  }

  const mat = windMaterial(time, detailed);
  const meshes: THREE.InstancedMesh[] = [];
  let count = 0;
  for (const kind of kinds) {
    const list = spots.get(kind)!;
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(plantGeometry(kind, detailed), mat, list.length);
    list.forEach((s, i) => {
      im.setMatrixAt(i, s.m);
      im.setColorAt(i, s.c);
    });
    im.name = `plant:${kind}`;
    im.castShadow = kind !== "grass" && kind !== "flower" && kind !== "reed" && kind !== "fern";
    im.userData.trees = list.map((s) => s.m);
    meshes.push(im);
    count += list.length;
  }
  return { meshes, count };
}

// ---------------------------------------------------------------- rivers

/**
 * One ribbon of water per river, lying on the surface height the map computed. The ribbon is
 * wider than the channel and the banks cut it off, so the shoreline follows the ground. Troops
 * are drawn standing on the bed, about knee-deep.
 */
function buildRivers(map: WorldMap, time: { value: number }) {
  const pos: number[] = [];
  const uv: number[] = [];
  const rapid: number[] = [];
  for (const river of map.rivers) {
    const p = river.points;
    if (p.length < 2) continue;
    let run = 0;
    const row: { l: number[]; r: number[]; v: number; q: number }[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)];
      const b = p[Math.min(p.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      if (i > 0) run += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
      const half = Math.max(1.9, p[i].width * 0.85);
      const nx = (-dz / len) * half;
      const nz = (dx / len) * half;
      // points in the lake or the sea dip under its surface
      const y = p[i].surface;
      // white water where the bed drops fast
      const fall = Math.min(1, Math.max(0, (a.bed - b.bed) / len) * 5);
      row.push({ l: [p[i].x + nx, y, p[i].z + nz], r: [p[i].x - nx, y, p[i].z - nz], v: run, q: fall });
    }
    for (let i = 0; i + 1 < row.length; i++) {
      const a = row[i];
      const b = row[i + 1];
      for (const [pt, u, v, q] of [[a.l, 0, a.v, a.q], [a.r, 1, a.v, a.q], [b.l, 0, b.v, b.q], [a.r, 1, a.v, a.q], [b.r, 1, b.v, b.q], [b.l, 0, b.v, b.q]] as [number[], number, number, number][]) {
        pos.push(pt[0], pt[1], pt[2]);
        uv.push(u, v);
        rapid.push(q);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("rapid", new THREE.Float32BufferAttribute(rapid, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uShallow = { value: new THREE.Color(THEME.water.shallow) };
    shader.uniforms.uMid = { value: new THREE.Color(THEME.water.mid) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float rapid;\nvarying vec2 vRiverUv;\nvarying float vRapid;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRiverUv = uv;\nvRapid = rapid;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uTime;\nuniform vec3 uShallow;\nuniform vec3 uMid;\nvarying vec2 vRiverUv;\nvarying float vRapid;${GLSL_NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
// streaks of lighter water sliding downstream, faster and whiter in the rapids
float speed = 1.6 + vRapid * 5.0;
vec2 fp = vec2(vRiverUv.x * 5.0, vRiverUv.y * 0.22 - uTime * speed * 0.22);
float streak = vnoise(fp) * 0.6 + vnoise(fp * vec2(2.0, 3.1) + 4.0) * 0.4;
float mid = 1.0 - abs(vRiverUv.x - 0.5) * 2.0;
vec3 river = mix(uShallow, uMid, smoothstep(0.1, 0.8, mid));
river = mix(river, vec3(0.86, 0.93, 0.95), smoothstep(0.62, 0.8, streak) * (0.22 + vRapid * 0.7));
diffuseColor.rgb = river;
diffuseColor.a = 0.82;`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "rivers";
  mesh.renderOrder = 1;
  return mesh;
}

// ---------------------------------------------------------------- altar

/** Volcanic dragon altar from the prototype, scaled to the new map. */
function buildAltar() {
  const g = new THREE.Group();
  const obsidian = lam(0x1d1b20);
  const magma = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.8, 0.8, 12), obsidian);
  base.position.y = 0.3;
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.6, 16), magma);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.72;
  g.add(base, ring);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 3.4, 6), obsidian);
    pillar.position.set(Math.cos(a) * 6.2, 2, Math.sin(a) * 6.2);
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), magma);
    flame.position.set(Math.cos(a) * 6.2, 4.1, Math.sin(a) * 6.2);
    g.add(pillar, flame);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), magma);
  crystal.position.y = 3.2;
  g.add(crystal);
  return { altar: g, crystal };
}
