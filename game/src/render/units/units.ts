// Draws every sim unit with one InstancedMesh per (unit type, body part).
import * as THREE from "three";
import { UNIT_TYPES, type UnitType } from "../../sim/config";
import type { Sim } from "../../sim/world";
import type { WorldMap } from "../../sim/map";
import { instancedMaterial } from "../bake";
import { bakeUnit, limbRotation, type BakedUnit, type LimbName } from "./rig";

const CAPACITY = 420;
/** Units are drawn larger than their sim footprint so armies read on a phone screen. */
export const VISUAL_SCALE = 1.7;

interface TypeMeshes {
  baked: BakedUnit;
  meshes: { name: string; pivot: THREE.Matrix4; mesh: THREE.InstancedMesh }[];
}

const SKELETON = new THREE.Color(0xd8d2c0);
const FLASH = new THREE.Color(0xffffff);

export class UnitRenderer {
  readonly group = new THREE.Group();
  private types = new Map<UnitType, TypeMeshes>();
  private material = instancedMaterial();
  private m = new THREE.Matrix4();
  private limbM = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();
  private col = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private map: WorldMap) {
    this.material.side = THREE.DoubleSide;
  }

  /** Bake every type up front so the first gift does not stall a frame. */
  warmup() {
    for (const t of UNIT_TYPES) this.ensure(t);
  }

  triangles(type: UnitType) {
    return this.ensure(type).baked.tris;
  }

  private ensure(type: UnitType): TypeMeshes {
    let tm = this.types.get(type);
    if (tm) return tm;
    const baked = bakeUnit(type);
    tm = { baked, meshes: [] };
    for (const part of baked.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, this.material, CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      tm.meshes.push({ name: part.name, pivot: part.pivot, mesh });
    }
    this.types.set(type, tm);
    return tm;
  }

  update(sim: Sim, time: number) {
    const counts = new Map<UnitType, number>();
    const colors = new Map<number, string>();
    for (const k of sim.kingdoms) colors.set(k.id, k.color);
    for (const u of sim.units) {
      if (!u.alive) continue;
      const tm = this.ensure(u.type);
      const i = counts.get(u.type) ?? 0;
      if (i >= CAPACITY) continue;
      counts.set(u.type, i + 1);
      const st = sim.cfg.unitTypes[u.type];
      const flying = !!st.flying;
      const t = time + u.id * 0.37;
      const ground = this.map.heightAt(u.x, u.z);
      const bob = flying ? 4.5 + Math.sin(t * 6.5) * 0.25 : u.moving ? Math.abs(Math.sin(t * 5.5)) * 0.05 : 0;
      const grow = Math.min(1, (sim.t - u.bornAt) / 0.35);
      this.pos.set(u.x, ground + bob, u.z);
      this.q.setFromAxisAngle(this.up, u.heading);
      const s = VISUAL_SCALE * st.scale * (1 + (sim.kingdomById(u.kid)?.level ?? 1) * 0.02) * (0.4 + 0.6 * grow);
      this.scl.set(s, s, s);
      this.m.compose(this.pos, this.q, this.scl);
      const since = sim.t - u.attackAt;
      const attack = since >= 0 && since < 0.35 ? since / 0.35 : -1;
      this.col.set(colors.get(u.kid) ?? "#ffffff");
      if (u.type === "skeleton") this.col.lerp(SKELETON, 0.55);
      // white flash for a moment after taking damage
      const hurt = sim.t - u.hitAt;
      if (hurt >= 0 && hurt < 0.14) this.col.lerp(FLASH, 0.75 * (1 - hurt / 0.14));
      for (const part of tm.meshes) {
        if (part.name === "body") part.mesh.setMatrixAt(i, this.m);
        else {
          const rot = limbRotation(tm.baked.rig, part.name as LimbName, { t, moving: u.moving, attack }, this.e);
          this.limbM.multiplyMatrices(this.m, part.pivot);
          if (rot) this.limbM.multiply(new THREE.Matrix4().makeRotationFromEuler(rot));
          part.mesh.setMatrixAt(i, this.limbM);
        }
        part.mesh.setColorAt(i, this.col);
      }
    }
    for (const [type, tm] of this.types) {
      const n = counts.get(type) ?? 0;
      for (const part of tm.meshes) {
        part.mesh.count = n;
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
