// Terrain, sea, trees and the dragon altar built from the WorldMap.
import * as THREE from "three";
import { CELL, GRID_H, GRID_W, WORLD_H, WORLD_W, type Biome, type WorldMap } from "../sim/map";
import { Rng } from "../sim/rng";
import { bakeGroup, instancedMaterial } from "./bake";

const BIOME_COLOR: Record<Biome, [number, number]> = {
  water: [0x2a5d6e, 0x2a5d6e],
  beach: [0xd9c79a, 0xcbb784],
  plains: [0xb9b07a, 0xa7a06a],
  desert: [0xd59a4a, 0xc4863a],
  forest: [0x5f8a3e, 0x4f7a34],
  mountain: [0x8a7a68, 0x6e6152],
};

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
}

export const TERRITORY_TILE = 4; // metres

export function buildTerrain(map: WorldMap): TerrainHandles {
  const group = new THREE.Group();
  const rng = new Rng(42);

  // Height per grid corner = average of neighbouring cell centres.
  const cw = GRID_W + 1;
  const ch = GRID_H + 1;
  const hc = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      let s = 0;
      let n = 0;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) {
          s += -1.2;
          n++;
          continue;
        }
        s += map.height[cy * GRID_W + cx];
        n++;
      }
      hc[y * cw + x] = s / n;
    }

  // Non-indexed triangles so every face is flat (low-poly look).
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const c = new THREE.Color();
  const ox = -WORLD_W / 2;
  const oz = -WORLD_H / 2;
  const corner = (x: number, y: number) => [ox + x * CELL, hc[y * cw + x], oz + y * CELL];
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      const b = map.biome[y * GRID_W + x];
      const [ca, cb] = BIOME_COLOR[b];
      const a = corner(x, y);
      const bb = corner(x + 1, y);
      const cc = corner(x + 1, y + 1);
      const d = corner(x, y + 1);
      const flip = (x + y) % 2 === 0;
      const tris = flip ? [a, d, bb, bb, d, cc] : [a, d, cc, a, cc, bb];
      for (let t = 0; t < 2; t++) {
        c.setHex(rng.next() < 0.5 ? ca : cb);
        const shade = 0.94 + rng.next() * 0.1;
        for (let k = 0; k < 3; k++) {
          const p = tris[t * 3 + k];
          pos.push(p[0], p[1], p[2]);
          col.push(c.r * shade, c.g * shade, c.b * shade);
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
  territoryTex.magFilter = THREE.NearestFilter;
  territoryTex.flipY = false;
  territoryTex.needsUpdate = true;

  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.territory = { value: territoryTex };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTerrUv;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTerrUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D territory;\nvarying vec2 vTerrUv;")
      .replace("#include <color_fragment>", "#include <color_fragment>\nvec4 terr = texture2D(territory, vTerrUv);\ndiffuseColor.rgb = mix(diffuseColor.rgb, terr.rgb, terr.a * 0.45);");
  };
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Sea: big faceted plane with a darker deep colour.
  const waterGeo = new THREE.PlaneGeometry(WORLD_W * 2.2, WORLD_H * 2.6, 40, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const wp = waterGeo.getAttribute("position");
  for (let i = 0; i < wp.count; i++) wp.setY(i, (rng.next() - 0.5) * 0.12);
  waterGeo.computeVertexNormals();
  const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({ color: 0x2f7f93, transparent: true, opacity: 0.86, flatShading: true }));
  water.position.y = -0.25;
  group.add(water);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 6, WORLD_H * 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x163d4d }));
  deep.position.y = -1.4;
  group.add(deep);

  // Trees: one InstancedMesh per kind, placed by biome.
  const kinds = { pine: treePine(), oak: treeOak(), palm: treePalm(), rock: rock() };
  const spots: Record<keyof typeof kinds, THREE.Matrix4[]> = { pine: [], oak: [], palm: [], rock: [] };
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const dens = (CELL / 1.5) ** 2; // keep trees per square metre constant when the cell size changes
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const b = map.biome[i];
    const p = map.cellCenter(i);
    const r = rng.next();
    let kind: keyof typeof kinds | null = null;
    if (b === "forest" && r < 0.3 * dens) kind = rng.next() < 0.6 ? "oak" : "pine";
    else if (b === "plains" && r < 0.04 * dens) kind = "oak";
    else if (b === "desert" && r < 0.05 * dens) kind = "palm";
    else if (b === "mountain" && r < 0.12 * dens) kind = rng.next() < 0.5 ? "pine" : "rock";
    else if (b === "beach" && r < 0.02 * dens) kind = "rock";
    if (!kind) continue;
    const x = p.x + (rng.next() - 0.5) * CELL * 0.8;
    const z = p.z + (rng.next() - 0.5) * CELL * 0.8;
    if (Math.hypot(x - map.altar.x, z - map.altar.z) < 12) continue;
    const s = 0.65 + rng.next() * 0.35;
    q.setFromAxisAngle(up, rng.next() * Math.PI * 2);
    mtx.compose(new THREE.Vector3(x, map.heightAt(x, z) - 0.05, z), q, new THREE.Vector3(s, s, s));
    spots[kind].push(mtx.clone());
  }
  const treeMeshes: THREE.InstancedMesh[] = [];
  const treeMat = instancedMaterial();
  for (const k of Object.keys(kinds) as (keyof typeof kinds)[]) {
    if (!spots[k].length) continue;
    const im = new THREE.InstancedMesh(kinds[k], treeMat, spots[k].length);
    spots[k].forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.userData.trees = spots[k];
    treeMeshes.push(im);
    group.add(im);
  }

  const { altar, crystal } = buildAltar();
  altar.position.set(map.altar.x, map.heightAt(map.altar.x, map.altar.z), map.altar.z);
  group.add(altar);

  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Vector3();
  const clearTrees = (x: number, z: number, r: number) => {
    for (const im of treeMeshes) {
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

  return { group, water, altarCrystal: crystal, territoryTex, territoryW, territoryH, clearTrees };
}

const lam = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function treePine() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.3, 5), lam(0x5c3a21));
  trunk.position.y = 0.65;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15 - i * 0.25, 1.5 - i * 0.2, 6), lam(0x1f6b3a));
    cone.position.y = 1.5 + i * 0.85;
    g.add(cone);
  }
  return bakeGroup(g);
}

function treeOak() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.5, 5), lam(0x6b4423));
  trunk.position.y = 0.75;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), lam(0x3f8a2a));
  crown.position.y = 2.1;
  g.add(trunk, crown);
  return bakeGroup(g);
}

function treePalm() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 5), lam(0x854d0e));
  trunk.position.y = 1.1;
  trunk.rotation.z = 0.12;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), lam(0x4d7c0f));
    frond.position.set(Math.cos(a) * 0.55, 2.15, Math.sin(a) * 0.55);
    frond.rotation.z = -Math.cos(a) * 1.1;
    frond.rotation.x = Math.sin(a) * 1.1;
    g.add(frond);
  }
  return bakeGroup(g);
}

function rock() {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), lam(0x77706a));
  r.scale.set(1.2, 0.7, 1);
  r.position.y = 0.3;
  g.add(r);
  return bakeGroup(g);
}

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
