// Castle meshes per kingdom: rebuilt on level up, shield dome while protected, sink on fall.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { Sim } from "../sim/world";
import { buildCastle, buildShield } from "./castle";

interface CastleView {
  group: THREE.Group;
  level: number;
  shield: THREE.Mesh;
  crown: boolean;
  fallingSince: number;
  lastHp: number;
  hitAt: number;
}

export class CastleRenderer {
  readonly group = new THREE.Group();
  private views = new Map<number, CastleView>();

  constructor(
    private map: WorldMap,
    private onPlaced: (x: number, z: number) => void,
  ) {}

  update(sim: Sim, time: number) {
    const seen = new Set<number>();
    for (const k of sim.kingdoms) {
      let v = this.views.get(k.id);
      if (!k.alive && !v) continue;
      seen.add(k.id);
      if (!v) {
        v = this.make(k.level, k.color, k.crown);
        v.group.position.set(k.x, this.map.heightAt(k.x, k.z), k.z);
        this.views.set(k.id, v);
        this.group.add(v.group);
        this.onPlaced(k.x, k.z);
      }
      if (k.alive && v.level !== k.level) {
        this.group.remove(v.group);
        const nv = this.make(k.level, k.color, k.crown);
        nv.group.position.copy(v.group.position);
        this.views.set(k.id, nv);
        this.group.add(nv.group);
        v = nv;
      }
      v.shield.visible = k.alive && sim.shielded(k);
      if (v.shield.visible) (v.shield.material as THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(time * 3) * 0.05;
      if (!k.alive) {
        if (v.fallingSince < 0) v.fallingSince = time;
        const p = (time - v.fallingSince) / 2.5;
        v.group.position.y = this.map.heightAt(k.x, k.z) - p * 4;
        v.group.rotation.z = Math.sin(time * 30) * 0.03 * (1 - p);
        if (p >= 1) {
          this.group.remove(v.group);
          this.views.delete(k.id);
        }
      } else {
        // squash when hit, then the banner wave
        if (k.hp < v.lastHp - 0.5) v.hitAt = time;
        v.lastHp = k.hp;
        const h = time - v.hitAt;
        const squash = h >= 0 && h < 0.18 ? Math.sin((h / 0.18) * Math.PI) * 0.035 : 0;
        const base = 1 + Math.min(v.level, 10) * 0.07; // same as buildCastle
        v.group.scale.set(base * (1 + squash), base * (1 - squash), base * (1 + squash));
        v.group.rotation.z = squash * Math.sin(time * 60) * 0.6;
        v.group.children.forEach((c) => {
          if (c.userData.banner) c.rotation.y = Math.sin(time * 2 + k.id) * 0.4;
        });
      }
    }
    for (const [id, v] of this.views) if (!seen.has(id)) {
      this.group.remove(v.group);
      this.views.delete(id);
    }
  }

  private make(level: number, color: string, crown: boolean): CastleView {
    const group = buildCastle(level, color);
    const shield = buildShield(color);
    group.add(shield);
    if (crown) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      c.position.y = 6.2;
      group.add(c);
    }
    return { group, level, shield, crown, fallingSince: -1, lastHp: Infinity, hitAt: -9 };
  }
}
