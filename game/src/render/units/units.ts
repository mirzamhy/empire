// Draws every sim unit with one InstancedMesh per (unit type, bone). Each frame the animator
// poses every unit and bone matrices are chained parent -> child on the CPU (plan 4.2, stage A).
import * as THREE from "three";
import { UNIT_TYPES, type UnitType } from "../../sim/config";
import type { Sim, SimEvent, Unit } from "../../sim/world";
import type { WorldMap } from "../../sim/map";
import { instancedMaterial } from "../bake";
import type { SocketName } from "./contract";
import { Animator, POSE_STRIDE } from "./animator";
import { CORPSE_MAX, SINK_DEPTH, SINK_SECONDS, chunkMotion, deathSpec, dissolveScale, fallProgress, fallSide, sinkProgress, type ChunkMotion, type DeathSpec } from "./death";
import { bakeUnit, type BakedRig } from "./rig";

const CAPACITY = 420;
const MAX_BONES = 48;
const BLOB_CAPACITY = 1600;
/** Units are drawn larger than their sim footprint so armies read on a phone screen. */
export const VISUAL_SCALE = 1.7;

interface TypeMeshes {
  baked: BakedRig;
  /** one mesh per bone index; null for bones without geometry */
  meshes: (THREE.InstancedMesh | null)[];
}

/** Armour tier of a kingdom level: 1 = level 1-4, 2 = 5-7, 3 = 8 and up. */
export const tierOfLevel = (level: number): 1 | 2 | 3 => (level >= 8 ? 3 : level >= 5 ? 2 : 1);
type Tier = 1 | 2 | 3;
const TIERS: Tier[] = [1, 2, 3];
const FLASH = new THREE.Color(0xffffff);
/** corpses fade towards this as they lie on the field */
const DEAD = new THREE.Color(0x4a4640);
const EMBER = new THREE.Color(0xff6a2a);
/** height flying units hover at (also where their corpse starts falling from) */
const FLY_HEIGHT = 4.5;
/** flying melee units come down to this height while they fight, so claws reach the ground troops */
const DIVE_HEIGHT = 1.3;
/** seconds after its last blow before a diver climbs again (longer than the attack cooldown) */
const DIVE_HOLD = 1.3;

/** A dead unit the sim has already dropped; drawn for a few seconds with the death motion. */
interface Corpse {
  id: number;
  type: UnitType;
  tier: Tier;
  color: string;
  x: number;
  z: number;
  ground: number;
  heading: number;
  scale: number;
  /** height above the ground at the moment of death (flying units) */
  height: number;
  diedAt: number;
  spec: DeathSpec;
}

export class UnitRenderer {
  readonly group = new THREE.Group();
  readonly animator = new Animator();
  /** meshes per "type:tier" */
  private types = new Map<string, TypeMeshes>();
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
  private counts = new Map<string, number>();
  private corpses: Corpse[] = [];
  /** dive blend per flying melee unit: v = 0 cruising, 1 down among the ground troops */
  private dives = new Map<number, { v: number; last: number }>();
  private q2 = new THREE.Quaternion();
  private axis = new THREE.Vector3();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private zAxis = new THREE.Vector3(0, 0, 1);
  private chunk: ChunkMotion = { dx: 0, dy: 0, dz: 0, ax: 0, ay: 1, az: 0, angle: 0 };
  private colors = new Map<number, string>();
  private tiers = new Map<number, Tier>();

  /** Soft dark discs under every unit: they anchor units to the ground when the shadow map is too coarse. */
  private blobs: THREE.InstancedMesh;

  constructor(private map: WorldMap) {
    this.material.side = THREE.DoubleSide;
    const disc = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
    // alpha fades from the centre to the rim through vertex colours (RGBA)
    const n = disc.getAttribute("position").count;
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) rgba[i * 4 + 3] = i === 0 ? 0.42 : 0;
    disc.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
    this.blobs = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), BLOB_CAPACITY);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.group.add(this.blobs);
  }

  /** Bake every type up front so the first gift does not stall a frame. */
  warmup() {
    for (const t of UNIT_TYPES) for (const tier of TIERS) this.ensure(t, tier);
  }

  triangles(type: UnitType) {
    return this.ensure(type).baked.tris;
  }

  rigOf(type: UnitType): BakedRig {
    return this.ensure(type).baked;
  }

  private ensure(type: UnitType, tier: Tier = 1): TypeMeshes {
    const key = type + ":" + tier;
    let tm = this.types.get(key);
    if (tm) return tm;
    const baked = bakeUnit(type, tier);
    tm = { baked, meshes: [] };
    for (const bone of baked.bones) {
      if (!bone.geometry) {
        tm.meshes.push(null);
        continue;
      }
      const mesh = new THREE.InstancedMesh(bone.geometry, this.material, CAPACITY);
      mesh.name = `${key}:${bone.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1));
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      tm.meshes.push(mesh);
    }
    this.types.set(key, tm);
    return tm;
  }

  /** Root transform of a unit: ground position, flying bob, heading, scale (with spawn grow). */
  private rootMatrix(sim: Sim, u: Unit, time: number, out: THREE.Matrix4) {
    const st = sim.cfg.unitTypes[u.type];
    const t = time + u.id * 0.37;
    const ground = this.map.heightAt(u.x, u.z);
    const bob = st.flying ? this.flyHeight(sim, u, time) + Math.sin(t * 6.5) * 0.25 : u.moving ? Math.abs(Math.sin(t * 5.5)) * 0.05 : 0;
    const grow = Math.min(1, (sim.t - u.bornAt) / 0.35);
    this.pos.set(u.x, ground + bob, u.z);
    this.q.setFromAxisAngle(this.up, u.heading);
    const s = VISUAL_SCALE * st.scale * (1 + (sim.kingdomById(u.kid)?.level ?? 1) * 0.02) * (0.4 + 0.6 * grow);
    this.scl.set(s, s, s);
    return out.compose(this.pos, this.q, this.scl);
  }

  /**
   * Height a flying unit is drawn at. Ranged flyers (dragons) stay up; melee flyers (griffins) ease
   * down while they are striking and climb back once they stop. Safe to call more than once a frame.
   */
  private flyHeight(sim: Sim, u: Unit, time: number) {
    if (sim.cfg.unitTypes[u.type].ranged) return FLY_HEIGHT;
    let d = this.dives.get(u.id);
    if (!d) this.dives.set(u.id, (d = { v: 0, last: time }));
    const dt = Math.min(Math.max(time - d.last, 0), 0.1);
    d.last = time;
    const since = sim.t - u.attackAt;
    const want = since >= 0 && since < DIVE_HOLD ? 1 : 0;
    // drop fast, climb slowly
    d.v += (want - d.v) * Math.min(1, dt * (want ? 9 : 2.5));
    const e = d.v * d.v * (3 - 2 * d.v);
    return FLY_HEIGHT + (DIVE_HEIGHT - FLY_HEIGHT) * e;
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
    this.tiers.clear();
    for (const k of sim.kingdoms) {
      this.colors.set(k.id, k.color);
      this.tiers.set(k.id, tierOfLevel(k.level));
    }
    let blobs = 0;
    for (const u of sim.units) {
      if (!u.alive) continue;
      if (blobs < BLOB_CAPACITY) {
        // flying units cast a smaller, fainter-looking blob on the ground below them
        const st = sim.cfg.unitTypes[u.type];
        const r = VISUAL_SCALE * st.scale * (u.type === "cavalry" || u.type === "dragon" ? 1.5 : u.type === "golem" || u.type === "demon" ? 1.3 : 0.85) * (st.flying ? 0.8 : 1);
        this.local.makeScale(r, 1, r).setPosition(u.x, this.map.heightAt(u.x, u.z) + 0.07, u.z);
        this.blobs.setMatrixAt(blobs++, this.local);
      }
      const tier = this.tiers.get(u.kid) ?? 1;
      const key = u.type + ":" + tier;
      const tm = this.types.get(key) ?? this.ensure(u.type, tier);
      const i = counts.get(key) ?? 0;
      if (i >= CAPACITY) continue;
      counts.set(key, i + 1);
      this.rootMatrix(sim, u, time, this.root);
      this.animator.pose(tm.baked, u, time, sim.t, this.pose);
      this.chain(tm.baked, this.root);
      this.col.set(this.colors.get(u.kid) ?? "#ffffff");
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
    this.drawCorpses(time);
    if (this.dives.size > 64) for (const [id, d] of this.dives) if (time - d.last > 2) this.dives.delete(id);
    this.animator.endFrame();
    this.blobs.count = blobs;
    this.blobs.instanceMatrix.needsUpdate = true;
    for (const [key, tm] of this.types) {
      const n = counts.get(key) ?? 0;
      for (const mesh of tm.meshes) {
        if (!mesh) continue;
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** Number of corpses currently on the field (debugging and tests). */
  get corpseCount() {
    return this.corpses.length;
  }

  clearCorpses() {
    this.corpses.length = 0;
  }

  /** Leave a corpse where a unit just died. `time` is the render clock used by update(). */
  addCorpse(sim: Sim, e: Extract<SimEvent, { k: "death" }>, time: number) {
    const st = sim.cfg.unitTypes[e.type];
    if (!st) return;
    const k = sim.kingdomById(e.kid);
    const tier = tierOfLevel(k?.level ?? 1);
    const spec = deathSpec(e.type, this.ensure(e.type, tier).baked.rig);
    if (this.corpses.length >= CORPSE_MAX) {
      // full: the oldest corpse that is still lying there starts sinking now
      const lying = this.corpses.find((c) => time - c.diedAt < c.spec.life - SINK_SECONDS);
      if (lying) lying.diedAt = time - (lying.spec.life - SINK_SECONDS);
      if (this.corpses.length >= CORPSE_MAX * 2) this.corpses.shift();
    }
    this.corpses.push({
      id: e.id,
      type: e.type,
      tier,
      color: k?.color ?? "#ffffff",
      x: e.x,
      z: e.z,
      ground: this.map.heightAt(e.x, e.z),
      heading: e.heading,
      scale: VISUAL_SCALE * st.scale * (1 + (k?.level ?? 1) * 0.02),
      height: st.flying ? FLY_HEIGHT + (DIVE_HEIGHT - FLY_HEIGHT) * (this.dives.get(e.id)?.v ?? 0) : 0,
      diedAt: time,
      spec,
    });
  }

  /** Append the corpses to the instance buffers (called from update, after the living). */
  private drawCorpses(time: number) {
    if (!this.corpses.length) return;
    const counts = this.counts;
    let kept = 0;
    for (const c of this.corpses) {
      const age = time - c.diedAt;
      if (age >= c.spec.life) continue;
      this.corpses[kept++] = c;
      if (age < 0) continue;
      const key = c.type + ":" + c.tier;
      const tm = this.types.get(key) ?? this.ensure(c.type, c.tier);
      const i = counts.get(key) ?? 0;
      if (i >= CAPACITY) continue;
      counts.set(key, i + 1);

      const spec = c.spec;
      const sink = sinkProgress(spec, age) * SINK_DEPTH;
      const s = c.scale * dissolveScale(spec, age);
      this.q.setFromAxisAngle(this.up, c.heading);
      let y = c.ground - sink;
      if (spec.style === "fall") {
        const p = fallProgress(spec, age);
        const side = fallSide(spec, c.id);
        const angle = p * spec.maxAngle;
        // backwards = rotate about the unit's own x axis, sideways = about its z (forward) axis
        this.q2.setFromAxisAngle(side === 0 ? this.xAxis : this.zAxis, side === 0 ? -angle : side * angle);
        this.q.multiply(this.q2);
        y += c.height * (1 - Math.min(1, p)) + spec.lift * s * Math.sin(angle);
      }
      this.pos.set(c.x, y, c.z);
      this.scl.set(s, s, s);
      this.root.compose(this.pos, this.q, this.scl);
      this.animator.poseDeath(tm.baked, age, this.pose);
      this.chain(tm.baked, this.root);

      this.col.set(c.color);
      if (spec.style === "dissolve") this.col.lerp(EMBER, 1 - dissolveScale(spec, age));
      else this.col.lerp(DEAD, 0.35 * Math.min(1, age / 1.2));
      for (let b = 0; b < tm.meshes.length; b++) {
        const mesh = tm.meshes[b];
        if (!mesh) continue;
        const m = this.world[b];
        if (spec.style === "shatter") {
          // each bone is a chunk: it flies off from its pivot, tumbles, and stops where it lands
          const e = m.elements;
          const px = e[12];
          const py = e[13];
          const pz = e[14];
          const rest = c.ground + 0.12 * s;
          const ch = chunkMotion(spec, c.id, b, age, py + sink - rest, this.chunk);
          m.premultiply(this.local.makeTranslation(-px, -py, -pz));
          m.premultiply(this.local.makeRotationAxis(this.axis.set(ch.ax, ch.ay, ch.az), ch.angle));
          m.premultiply(this.local.makeTranslation(px + ch.dx, Math.max(py + ch.dy, rest - sink), pz + ch.dz));
        }
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, this.col);
      }
    }
    this.corpses.length = kept;
  }

  /**
   * World position of a unit's socket (weapon tip, mouth, head top...) at render time `time`.
   * Returns false when the unit's model has no such socket.
   */
  socketWorld(sim: Sim, u: Unit, name: SocketName, time: number, out: THREE.Vector3): boolean {
    const tm = this.ensure(u.type, this.tiers.get(u.kid) ?? tierOfLevel(sim.kingdomById(u.kid)?.level ?? 1));
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
