// Draws every sim unit with one InstancedMesh per (unit type, bone). Each frame the animator
// poses every unit and bone matrices are chained parent -> child on the CPU (plan 4.2, stage A).
import * as THREE from "three";
import { UNIT_TYPES, type UnitType } from "../../sim/config";
import type { Sim, Unit } from "../../sim/world";
import type { WorldMap } from "../../sim/map";
import { instancedMaterial } from "../bake";
import type { SocketName } from "./contract";
import { Animator, POSE_STRIDE } from "./animator";
import { bakeUnit, type BakedRig } from "./rig";

const CAPACITY = 420;
const MAX_BONES = 48;
/** Units are drawn larger than their sim footprint so armies read on a phone screen. */
export const VISUAL_SCALE = 1.7;

interface TypeMeshes {
  baked: BakedRig;
  /** one mesh per bone index; null for bones without geometry */
  meshes: (THREE.InstancedMesh | null)[];
}

const SKELETON = new THREE.Color(0xd8d2c0);
const FLASH = new THREE.Color(0xffffff);

export class UnitRenderer {
  readonly group = new THREE.Group();
  readonly animator = new Animator();
  private types = new Map<UnitType, TypeMeshes>();
  private material = instancedMaterial();
  private root = new THREE.Matrix4();
  private local = new THREE.Matrix4();
  private rot = new THREE.Matrix4();
  private world: THREE.Matrix4[] = Array.from({ length: MAX_BONES }, () => new THREE.Matrix4());
  private pose = new Float32Array(MAX_BONES * POSE_STRIDE);
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();
  private col = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  private counts = new Map<UnitType, number>();
  private colors = new Map<number, string>();

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

  rigOf(type: UnitType): BakedRig {
    return this.ensure(type).baked;
  }

  private ensure(type: UnitType): TypeMeshes {
    let tm = this.types.get(type);
    if (tm) return tm;
    const baked = bakeUnit(type);
    tm = { baked, meshes: [] };
    for (const bone of baked.bones) {
      if (!bone.geometry) {
        tm.meshes.push(null);
        continue;
      }
      const mesh = new THREE.InstancedMesh(bone.geometry, this.material, CAPACITY);
      mesh.name = `${type}:${bone.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      tm.meshes.push(mesh);
    }
    this.types.set(type, tm);
    return tm;
  }

  /** Root transform of a unit: ground position, flying bob, heading, scale (with spawn grow). */
  private rootMatrix(sim: Sim, u: Unit, time: number, out: THREE.Matrix4) {
    const st = sim.cfg.unitTypes[u.type];
    const t = time + u.id * 0.37;
    const ground = this.map.heightAt(u.x, u.z);
    const bob = st.flying ? 4.5 + Math.sin(t * 6.5) * 0.25 : u.moving ? Math.abs(Math.sin(t * 5.5)) * 0.05 : 0;
    const grow = Math.min(1, (sim.t - u.bornAt) / 0.35);
    this.pos.set(u.x, ground + bob, u.z);
    this.q.setFromAxisAngle(this.up, u.heading);
    const s = VISUAL_SCALE * st.scale * (1 + (sim.kingdomById(u.kid)?.level ?? 1) * 0.02) * (0.4 + 0.6 * grow);
    this.scl.set(s, s, s);
    return out.compose(this.pos, this.q, this.scl);
  }

  /** Chain bone matrices for the pose in this.pose: world[i] = world[parent] * rest * T(pos) * R(rot). */
  private chain(baked: BakedRig, root: THREE.Matrix4) {
    const bones = baked.bones;
    this.world[0].copy(root);
    for (let i = 1; i < bones.length; i++) {
      const b = bones[i];
      const o = i * POSE_STRIDE;
      const p = this.pose;
      this.local.copy(b.rest);
      if (p[o + 3] || p[o + 4] || p[o + 5]) this.local.multiply(this.rot.makeTranslation(p[o + 3], p[o + 4], p[o + 5]));
      if (p[o] || p[o + 1] || p[o + 2]) this.local.multiply(this.rot.makeRotationFromEuler(this.e.set(p[o], p[o + 1], p[o + 2])));
      this.world[i].multiplyMatrices(this.world[b.parent], this.local);
    }
  }

  update(sim: Sim, time: number) {
    const counts = this.counts;
    counts.clear();
    this.colors.clear();
    for (const k of sim.kingdoms) this.colors.set(k.id, k.color);
    for (const u of sim.units) {
      if (!u.alive) continue;
      const tm = this.ensure(u.type);
      const i = counts.get(u.type) ?? 0;
      if (i >= CAPACITY) continue;
      counts.set(u.type, i + 1);
      this.rootMatrix(sim, u, time, this.root);
      this.animator.pose(tm.baked, u, time, sim.t, this.pose);
      this.chain(tm.baked, this.root);
      this.col.set(this.colors.get(u.kid) ?? "#ffffff");
      if (u.type === "skeleton") this.col.lerp(SKELETON, 0.55);
      // white flash for a moment after taking damage
      const hurt = sim.t - u.hitAt;
      if (hurt >= 0 && hurt < 0.14) this.col.lerp(FLASH, 0.75 * (1 - hurt / 0.14));
      for (let b = 0; b < tm.meshes.length; b++) {
        const mesh = tm.meshes[b];
        if (!mesh) continue;
        mesh.setMatrixAt(i, this.world[b]);
        mesh.setColorAt(i, this.col);
      }
    }
    this.animator.endFrame();
    for (const [type, tm] of this.types) {
      const n = counts.get(type) ?? 0;
      for (const mesh of tm.meshes) {
        if (!mesh) continue;
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * World position of a unit's socket (weapon tip, mouth, head top...) at render time `time`.
   * Returns false when the unit's model has no such socket.
   */
  socketWorld(sim: Sim, u: Unit, name: SocketName, time: number, out: THREE.Vector3): boolean {
    const tm = this.ensure(u.type);
    const s = tm.baked.sockets[name];
    if (!s) return false;
    this.rootMatrix(sim, u, time, this.root);
    // pose without touching the animator's per-unit blend state
    this.pose.fill(0);
    this.animator.peek(tm.baked, u, time, sim.t, this.pose);
    this.chain(tm.baked, this.root);
    out.copy(s.pos).applyMatrix4(this.world[s.bone]);
    return true;
  }
}
