// Projectiles, death puffs and the world dragon. Pooled InstancedMeshes, no per-frame allocation.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { Sim, SimEvent } from "../sim/world";
import { buildReferenceSoldier } from "./units/proto.js";

interface Bolt {
  fx: number;
  fz: number;
  tx: number;
  tz: number;
  t0: number;
  dur: number;
  arc: number;
  color: THREE.Color;
  size: number;
}

interface Puff {
  x: number;
  y: number;
  z: number;
  t0: number;
  color: THREE.Color;
}

const SHOT_COLOR: Record<string, number> = {
  archer: 0x8b5a2b,
  wizard: 0xff6a1a,
  necromancer: 0xa855f7,
  dragon: 0xff4500,
  tower: 0xd9d4c7,
};

export class Fx {
  readonly group = new THREE.Group();
  private bolts: Bolt[] = [];
  private puffs: Puff[] = [];
  private boltMesh: THREE.InstancedMesh;
  private puffMesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private dragon: THREE.Group;
  private dragonLimbs: { rightArm?: THREE.Object3D; leftArm?: THREE.Object3D };

  constructor(private map: WorldMap) {
    this.boltMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial(), 400);
    this.boltMesh.count = 0;
    this.boltMesh.frustumCulled = false;
    this.puffMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
      300,
    );
    this.puffMesh.count = 0;
    this.puffMesh.frustumCulled = false;
    this.group.add(this.boltMesh, this.puffMesh);
    this.dragon = buildReferenceSoldier("dragon", "#b91c1c", "#facc15");
    this.dragonLimbs = (this.dragon.userData as { limbs: { rightArm?: THREE.Object3D; leftArm?: THREE.Object3D } }).limbs;
    this.dragon.scale.setScalar(2.6);
    this.dragon.visible = false;
    this.group.add(this.dragon);
  }

  onEvent(e: SimEvent, now: number) {
    if (e.k === "shot") {
      if (this.bolts.length >= 400) this.bolts.shift();
      const d = Math.hypot(e.x - e.fromX, e.z - e.fromZ);
      const big = e.type === "dragon";
      this.bolts.push({
        fx: e.fromX,
        fz: e.fromZ,
        tx: e.x,
        tz: e.z,
        t0: now,
        dur: Math.max(0.15, d / (big ? 22 : 30)),
        arc: e.type === "archer" || e.type === "tower" ? 0.25 * d : 0.05 * d,
        color: new THREE.Color(SHOT_COLOR[e.type] ?? 0xffffff),
        size: big ? 3 : e.type === "wizard" ? 1.4 : 1,
      });
    } else if (e.k === "death") {
      if (this.puffs.length >= 300) this.puffs.shift();
      this.puffs.push({ x: e.x, y: this.map.heightAt(e.x, e.z) + 0.6, z: e.z, t0: now, color: new THREE.Color(0xe8e2d6) });
    } else if (e.k === "fall") {
      // dust ring at the castle
    }
  }

  update(sim: Sim, now: number) {
    let n = 0;
    this.bolts = this.bolts.filter((b) => now - b.t0 < b.dur);
    for (const b of this.bolts) {
      const t = (now - b.t0) / b.dur;
      const x = b.fx + (b.tx - b.fx) * t;
      const z = b.fz + (b.tz - b.fz) * t;
      const y = this.map.heightAt(x, z) + 1.4 + Math.sin(t * Math.PI) * b.arc + (b.size > 2 ? 6 * (1 - t) : 0);
      this.p.set(x, y, z);
      this.s.setScalar(b.size);
      this.m.compose(this.p, this.q, this.s);
      this.boltMesh.setMatrixAt(n, this.m);
      this.boltMesh.setColorAt(n, b.color);
      n++;
    }
    this.boltMesh.count = n;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    if (this.boltMesh.instanceColor) this.boltMesh.instanceColor.needsUpdate = true;

    let m = 0;
    this.puffs = this.puffs.filter((p) => now - p.t0 < 0.7);
    for (const p of this.puffs) {
      const t = (now - p.t0) / 0.7;
      this.p.set(p.x, p.y + t * 0.8, p.z);
      this.s.setScalar(0.4 + t * 1.6);
      this.m.compose(this.p, this.q, this.s);
      this.puffMesh.setMatrixAt(m, this.m);
      this.puffMesh.setColorAt(m, p.color);
      m++;
    }
    this.puffMesh.count = m;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;

    const d = sim.dragon;
    this.dragon.visible = !!d;
    if (d) {
      const flap = Math.sin(now * 4) * 0.5;
      if (this.dragonLimbs.rightArm) this.dragonLimbs.rightArm.rotation.z = -flap;
      if (this.dragonLimbs.leftArm) this.dragonLimbs.leftArm.rotation.z = flap;
      this.dragon.position.set(d.x, this.map.heightAt(d.x, d.z) + 4 + Math.sin(now * 4) * 0.4, d.z);
      this.dragon.rotation.y = now * 0.5;
      const hit = sim.t - d.attackAt;
      this.dragon.scale.setScalar(2.6 + (hit >= 0 && hit < 0.3 ? 0.15 : 0));
    }
  }
}
