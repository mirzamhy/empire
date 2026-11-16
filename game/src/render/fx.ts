// Combat effects: projectiles, hit sparks, explosions, damage numbers, castle damage and collapse,
// gift pillars, level-up rings and the world dragon. Everything is pooled InstancedMeshes.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { HitTarget, Sim, SimEvent } from "../sim/world";
import type { UnitType } from "../sim/config";
import { buildReferenceSoldier } from "./units/proto.js";

type ShotType = UnitType | "tower" | "dragon";

// ---------------------------------------------------------------- particles

/** How a particle fades: additive ones fade to black (invisible), solid ones shrink away. */
type Fade = "color" | "shrink";

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  t0: number; life: number;
  size: number; grow: number;
  gravity: number; drag: number;
  r: number; g: number; b: number;
  spin: number;
  bounce: boolean;
}

class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private list: Particle[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    private cap: number,
    private fade: Fade,
    private map: WorldMap,
  ) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
  }

  add(p: Particle) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push(p);
  }

  clear() {
    this.list.length = 0;
  }

  update(now: number, dt: number) {
    let n = 0;
    const keep: Particle[] = [];
    for (const p of this.list) {
      const age = now - p.t0;
      if (age >= p.life) continue;
      keep.push(p);
      if (age < 0) continue; // delayed start (dragon breath stream)
      const t = age / p.life;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vz *= dr;
      p.vy = p.vy * dr - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.bounce) {
        const g = this.map.heightAt(p.x, p.z) + p.size * 0.4;
        if (p.y < g) {
          p.y = g;
          p.vy = Math.abs(p.vy) * 0.3;
          p.vx *= 0.5;
          p.vz *= 0.5;
        }
      }
      let size = p.size * (1 + p.grow * t);
      if (this.fade === "shrink") size *= t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      this.p.set(p.x, p.y, p.z);
      this.e.set(age * p.spin, age * p.spin * 0.7, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.max(size, 0.001));
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      const k = this.fade === "color" ? (1 - t) * (1 - t) : 1;
      this.c.setRGB(p.r * k, p.g * k, p.b * k);
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.list = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- flat decals and rings

interface Flat {
  x: number; y: number; z: number;
  t0: number; life: number;
  r0: number; r1: number;
  color: THREE.Color;
  /** rings fade by color (additive), scorch marks shrink at the end */
  fade: Fade;
}

class FlatPool {
  readonly mesh: THREE.InstancedMesh;
  private list: Flat[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, private cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
  }

  add(f: Flat) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push(f);
  }

  clear() {
    this.list.length = 0;
  }

  update(now: number) {
    let n = 0;
    this.list = this.list.filter((f) => now - f.t0 < f.life);
    for (const f of this.list) {
      const t = (now - f.t0) / f.life;
      if (t < 0) continue;
      const ease = 1 - (1 - t) * (1 - t);
      let r = f.r0 + (f.r1 - f.r0) * (f.fade === "color" ? ease : Math.min(1, t * 8));
      if (f.fade === "shrink" && t > 0.75) r *= 1 - (t - 0.75) / 0.25;
      this.p.set(f.x, f.y, f.z);
      this.s.set(Math.max(r, 0.001), Math.max(r, 0.001), 1);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      const k = f.fade === "color" ? 1 - t : 1;
      this.c.copy(f.color).multiplyScalar(k);
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- damage numbers

const DIGIT_W = 0.62;

/** Billboarded digits from a canvas atlas, one instance per digit, drawn in one call. */
class DamageNumbers {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private pos: THREE.InstancedBufferAttribute;
  private digit: THREE.InstancedBufferAttribute;
  private col: THREE.InstancedBufferAttribute;
  private par: THREE.InstancedBufferAttribute;
  private list: { x: number; y: number; z: number; t0: number; text: string; size: number; color: THREE.Color; drift: number }[] = [];

  constructor(private cap: number) {
    const cw = 64;
    const ch = 96;
    const canvas = document.createElement("canvas");
    canvas.width = cw * 10;
    canvas.height = ch;
    const g = canvas.getContext("2d")!;
    g.font = "900 84px Arial Black, Impact, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    for (let i = 0; i < 10; i++) {
      g.lineWidth = 14;
      g.strokeStyle = "#000";
      g.strokeText(String(i), cw * i + cw / 2, ch / 2 + 4);
      g.fillStyle = "#fff";
      g.fillText(String(i), cw * i + cw / 2, ch / 2 + 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute("position", base.getAttribute("position"));
    this.geo.setAttribute("uv", base.getAttribute("uv"));
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.digit = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.par = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    for (const a of [this.pos, this.digit, this.col, this.par]) a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("iPos", this.pos);
    this.geo.setAttribute("iDigit", this.digit);
    this.geo.setAttribute("iCol", this.col);
    this.geo.setAttribute("iPar", this.par);
    this.geo.instanceCount = 0;

    const mat = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: tex } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        attribute vec3 iPos;
        attribute float iDigit;
        attribute vec3 iCol;
        attribute vec3 iPar; // size, alpha, x offset in digits
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += vec2((position.x + iPar.z) * ${DIGIT_W.toFixed(2)}, position.y) * iPar.x;
          gl_Position = projectionMatrix * mv;
          vUv = vec2((uv.x + iDigit) / 10.0, uv.y);
          vCol = iCol;
          vA = iPar.y;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D atlas;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vA;
        void main() {
          vec4 t = texture2D(atlas, vUv);
          if (t.a < 0.05) discard;
          gl_FragColor = vec4(t.rgb * vCol, t.a * vA);
        }`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  add(x: number, y: number, z: number, value: number, now: number, size: number, color: THREE.Color) {
    const text = String(Math.max(1, Math.round(value)));
    if (this.list.length >= 120) this.list.shift();
    this.list.push({ x: x + (Math.random() - 0.5) * 0.8, y, z: z + (Math.random() - 0.5) * 0.8, t0: now, text, size, color, drift: (Math.random() - 0.5) * 0.8 });
  }

  clear() {
    this.list.length = 0;
  }

  update(now: number) {
    const life = 1.1;
    this.list = this.list.filter((d) => now - d.t0 < life);
    let n = 0;
    for (const d of this.list) {
      const t = (now - d.t0) / life;
      if (t < 0) continue;
      // pop in, rise, fade
      const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.7 : t < 0.25 ? 1.3 - ((t - 0.12) / 0.13) * 0.3 : 1;
      const alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      const y = d.y + t * 2.2;
      const len = d.text.length;
      for (let i = 0; i < len && n < this.cap; i++) {
        this.pos.setXYZ(n, d.x + d.drift * t, y, d.z);
        this.digit.setX(n, d.text.charCodeAt(i) - 48);
        this.col.setXYZ(n, d.color.r, d.color.g, d.color.b);
        this.par.setXYZ(n, d.size * pop, alpha, i - (len - 1) / 2);
        n++;
      }
    }
    this.geo.instanceCount = n;
    for (const a of [this.pos, this.digit, this.col, this.par]) a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- projectiles

interface Bolt {
  type: ShotType;
  fx: number; fz: number; fy: number;
  tx: number; tz: number; ty: number;
  t0: number; dur: number; arc: number;
  dmg: number; on: HitTarget;
  /** what was aimed at (castle centre for castle shots) */
  cx: number; cz: number;
}

const SHOT_COLOR: Record<string, number> = {
  archer: 0x8b5a2b,
  wizard: 0xff7a1a,
  necromancer: 0xb26bff,
  dragon: 0xff5a1a,
  tower: 0xd9d4c7,
};

const HEAVY: Partial<Record<ShotType, number>> = { golem: 1.3, demon: 1.6, cavalry: 0.8, paladin: 0.6, dragon: 1.4 };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Fx {
  readonly group = new THREE.Group();
  /** called for big impacts near the action: (strength 0..1, x, z) */
  onShake: (power: number, x: number, z: number) => void = () => {};

  private bolts: Bolt[] = [];
  private arrowMesh: THREE.InstancedMesh;
  private orbMesh: THREE.InstancedMesh;
  private stoneMesh: THREE.InstancedMesh;
  private stuck: { x: number; y: number; z: number; yaw: number; pitch: number; t0: number }[] = [];
  private stuckMesh: THREE.InstancedMesh;

  private sparks: ParticlePool;
  private glow: ParticlePool;
  private dust: ParticlePool;
  private debris: ParticlePool;
  private rings: FlatPool;
  private scorch: FlatPool;
  private numbers = new DamageNumbers(480);

  private pillars: { x: number; y: number; z: number; t0: number; color: THREE.Color; height: number; width: number }[] = [];
  private pillarMesh: THREE.InstancedMesh;
  private rubble: { x: number; y: number; z: number; s: number; ry: number; color: THREE.Color }[] = [];
  private rubbleMesh: THREE.InstancedMesh;
  private rubbleDirty = false;

  private castleChipAt = new Map<number, number>();
  private castleDmg = new Map<number, { x: number; z: number; dmg: number; at: number }>();
  private smokeAt = new Map<number, number>();
  private lastNow = 0;
  private kingdomColor = (_kid: number) => "#ffffff";

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();
  private dragon: THREE.Group;
  private dragonLimbs: { rightArm?: THREE.Object3D; leftArm?: THREE.Object3D };

  constructor(private map: WorldMap) {
    const additive = () => new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });

    // projectiles
    const arrowGeo = new THREE.BoxGeometry(0.06, 0.06, 1.1);
    this.arrowMesh = this.instanced(arrowGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a2a }), 300);
    this.orbMesh = this.instanced(new THREE.IcosahedronGeometry(0.32, 1), additive(), 200);
    this.stoneMesh = this.instanced(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial({ color: 0xbdb6a6, flatShading: true }), 120);
    this.stuckMesh = this.instanced(arrowGeo, new THREE.MeshLambertMaterial({ color: 0x5a3d22 }), 220);

    // particles
    this.sparks = new ParticlePool(new THREE.OctahedronGeometry(0.14, 0), additive(), 900, "color", map);
    this.glow = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive(), 900, "color", map);
    this.dust = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, flatShading: true }),
      600,
      "shrink",
      map,
    );
    this.debris = new ParticlePool(new THREE.BoxGeometry(0.22, 0.16, 0.2), new THREE.MeshLambertMaterial({ flatShading: true }), 500, "shrink", map);
    this.rings = new FlatPool(new THREE.RingGeometry(0.82, 1, 40), Object.assign(additive(), { side: THREE.DoubleSide }), 120);
    this.scorch = new FlatPool(
      new THREE.CircleGeometry(1, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      90,
    );

    // gift light pillars and castle rubble
    const pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    pillarGeo.translate(0, 0.5, 0);
    this.pillarMesh = this.instanced(pillarGeo, Object.assign(additive(), { side: THREE.DoubleSide }), 24);
    this.rubbleMesh = this.instanced(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ flatShading: true }), 1200);
    this.rubbleMesh.castShadow = true;
    this.rubbleMesh.receiveShadow = true;

    this.group.add(
      this.arrowMesh, this.orbMesh, this.stoneMesh, this.stuckMesh,
      this.sparks.mesh, this.glow.mesh, this.dust.mesh, this.debris.mesh,
      this.rings.mesh, this.scorch.mesh, this.pillarMesh, this.rubbleMesh, this.numbers.mesh,
    );

    this.dragon = buildReferenceSoldier("dragon", "#b91c1c", "#facc15");
    this.dragonLimbs = (this.dragon.userData as { limbs: { rightArm?: THREE.Object3D; leftArm?: THREE.Object3D } }).limbs;
    this.dragon.scale.setScalar(2.6);
    this.dragon.visible = false;
    this.group.add(this.dragon);
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.setColorAt(0, new THREE.Color());
    return mesh;
  }

  // ---------------------------------------------------------------- events

  onEvent(e: SimEvent, now: number, sim?: Sim) {
    if (sim) this.kingdomColor = (kid) => sim.kingdomById(kid)?.color ?? "#ffffff";
    const h = (x: number, z: number) => this.map.heightAt(x, z);
    switch (e.k) {
      case "shot": {
        if (this.bolts.length >= 500) this.bolts.shift();
        const d = Math.hypot(e.x - e.fromX, e.z - e.fromZ);
        const dragon = e.type === "dragon";
        const lob = e.type === "archer" || e.type === "tower";
        const speed = dragon ? 26 : lob ? 28 : e.type === "wizard" ? 20 : 24;
        const fy = h(e.fromX, e.fromZ) + (dragon ? 7 : e.type === "tower" ? 4.5 : 1.3);
        // castle shots land on the wall facing the shooter, not inside the keep
        const back = e.on === "castle" ? Math.min(2.2, d) / (d || 1) : 0;
        const tx = e.x + (e.fromX - e.x) * back;
        const tz = e.z + (e.fromZ - e.z) * back;
        const ty = h(tx, tz) + (e.on === "castle" ? 2 : e.on === "dragon" ? 4 : 0.8);
        this.bolts.push({
          type: e.type, fx: e.fromX, fz: e.fromZ, fy, tx, tz, ty,
          cx: e.x, cz: e.z,
          t0: now, dur: Math.max(0.15, d / speed), arc: lob ? 0.22 * d : 0.04 * d, dmg: e.dmg, on: e.on,
        });
        if (dragon) this.dragonBreath(e.fromX, fy, e.fromZ, e.x, ty, e.z, now);
        else if (e.type === "wizard") this.burst(this.glow, e.fromX, h(e.fromX, e.fromZ) + 1.5, e.fromZ, now, 4, 0xff9a3a, 1.5, 0.25, 0.3);
        break;
      }
      case "hit":
        this.meleeHit(e.fromX, e.fromZ, e.x, e.z, e.type, e.dmg, e.on, now);
        break;
      case "death":
        this.death(e.x, e.z, e.kid, e.type, now);
        break;
      case "fall":
        if (sim) {
          const k = sim.kingdomById(e.kid);
          if (k) this.collapse(k.x, k.z, k.level, k.color, now);
        }
        break;
      case "troops":
        if (sim) {
          const k = sim.kingdomById(e.kid);
          if (k) {
            const power = Object.entries(e.units).reduce((a, [t, n]) => a + (sim.cfg.unitTypes[t as UnitType]?.hp ?? 0) * (n ?? 0), 0);
            this.giftArrival(k.x, k.z, power, e.reason === "like", now);
          }
        }
        break;
      case "level":
        if (sim) {
          const k = sim.kingdomById(e.kid);
          if (k) this.levelUp(k.x, k.z, now);
        }
        break;
      case "village":
        if (sim) {
          const v = sim.village(e.id);
          const k = sim.kingdomById(e.kid);
          if (v && k) this.villageTaken(v.x, v.z, k.color, e.prev !== 0, sim.cfg.villages.claimRadius, now);
        }
        break;
      case "dragon":
        if (e.state === "dead" && sim?.dragon) this.explosion(sim.dragon.x, h(sim.dragon.x, sim.dragon.z) + 4, sim.dragon.z, now, 2.2, 0xff5a1a);
        break;
      case "phase":
        if (e.phase === "LOBBY") this.reset();
        break;
    }
  }

  private reset() {
    this.bolts.length = 0;
    this.stuck.length = 0;
    this.pillars.length = 0;
    this.rubble.length = 0;
    this.rubbleDirty = true;
    for (const p of [this.sparks, this.glow, this.dust, this.debris]) p.clear();
    this.rings.clear();
    this.scorch.clear();
    this.numbers.clear();
    this.castleDmg.clear();
  }

  // ---------------------------------------------------------------- effect builders

  /** Radial burst of particles. */
  private burst(pool: ParticlePool, x: number, y: number, z: number, now: number, n: number, color: number, speed: number, size: number, life: number, up = 0.6, gravity = 0) {
    this.c.set(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * rand(0.4, 1);
      pool.add({
        x, y, z,
        vx: Math.cos(a) * sp, vy: sp * rand(0.1, 1) * up + (up > 0 ? speed * 0.3 : 0), vz: Math.sin(a) * sp,
        t0: now, life: life * rand(0.7, 1.2), size: size * rand(0.7, 1.3), grow: pool === this.dust ? 1.4 : pool === this.glow ? 0.6 : 0,
        gravity, drag: pool === this.dust ? 2.5 : 1.2,
        r: this.c.r * rand(0.85, 1.1), g: this.c.g * rand(0.85, 1.1), b: this.c.b * rand(0.85, 1.1),
        spin: rand(-6, 6), bounce: pool === this.debris,
      });
    }
  }

  private ring(x: number, z: number, now: number, r1: number, color: number, life = 0.45, y?: number) {
    this.rings.add({ x, y: (y ?? this.map.heightAt(x, z)) + 0.2, z, t0: now, life, r0: 0.2, r1, color: new THREE.Color(color), fade: "color" });
  }

  private scorchMark(x: number, z: number, now: number, r: number, color = 0x1c1410) {
    this.scorch.add({ x, y: this.map.heightAt(x, z) + 0.12, z, t0: now, life: 9, r0: r * 0.3, r1: r, color: new THREE.Color(color), fade: "shrink" });
  }

  private number(x: number, z: number, dmg: number, on: HitTarget, now: number, heightOffset = 1.8) {
    if (on === "castle") {
      // castles take many small blows: show one summed number per castle every 0.6 s
      const key = Math.round(x * 10) * 100000 + Math.round(z * 10);
      const acc = this.castleDmg.get(key) ?? { x, z, dmg: 0, at: now };
      acc.dmg += dmg;
      this.castleDmg.set(key, acc);
      return;
    }
    if (dmg < 24) return;
    const big = dmg >= 60;
    this.c.set(big ? 0xff9b3d : 0xfff1c2);
    this.numbers.add(x, this.map.heightAt(x, z) + heightOffset, z, dmg, now, big ? 1.25 : 0.85, this.c.clone());
  }

  private meleeHit(fx: number, fz: number, tx: number, tz: number, type: UnitType, dmg: number, on: HitTarget, now: number) {
    // blows land between attacker and target; on castles, on the wall facing the attacker
    const d = Math.hypot(fx - tx, fz - tz) || 1;
    const back = on === "castle" ? Math.min(2.3, d) : on === "dragon" ? Math.min(2.5, d) : d * 0.45;
    const x = tx + ((fx - tx) / d) * back;
    const z = tz + ((fz - tz) / d) * back;
    const y = this.map.heightAt(x, z) + (on === "castle" ? 1.4 : on === "dragon" ? 3.5 : 0.9);
    const heavy = HEAVY[type] ?? 0;
    this.burst(this.sparks, x, y, z, now, 6 + Math.round(heavy * 6), 0xfff0b0, 4 + heavy * 3, 1, 0.32, 0.8, 9);
    // short bright flash where the blow lands
    this.glow.add({
      x, y, z, vx: 0, vy: 0, vz: 0, t0: now, life: 0.14, size: 0.55 + heavy * 0.4, grow: 0.8, gravity: 0, drag: 0,
      r: 1, g: 0.92, b: 0.7, spin: 0, bounce: false,
    });
    if (heavy >= 0.8) {
      this.ring(x, z, now, 2 + heavy * 1.6, type === "demon" ? 0xff3b2f : 0xffe0a0, 0.4);
      this.burst(this.dust, x, this.map.heightAt(x, z) + 0.3, z, now, 4, 0xcfc4ad, 2.5, 0.4, 0.7, 0.2);
      if (heavy >= 1.3) this.onShake(0.18 * heavy, x, z);
    }
    if (on === "castle") this.castleChip(tx, tz, now, x, z);
    this.number(on === "castle" ? tx : x, on === "castle" ? tz : z, dmg, on, now);
  }

  /** Stone chips off a castle wall. (cx, cz) is the castle, (x, z) where the blow landed. */
  private castleChip(cx: number, cz: number, now: number, x = cx, z = cz) {
    const key = Math.round(cx * 10) * 100000 + Math.round(cz * 10);
    if (now - (this.castleChipAt.get(key) ?? -9) < 0.22) return;
    this.castleChipAt.set(key, now);
    const y = this.map.heightAt(x, z) + rand(1, 2.6);
    this.burst(this.debris, x, y, z, now, 3, 0x8d8a83, 3.5, 0.9, 1.1, 0.9, 16);
    this.burst(this.dust, x, y, z, now, 2, 0xb8b0a0, 1.5, 0.5, 0.8, 0.3);
  }

  private impact(b: Bolt, now: number) {
    const { tx: x, tz: z, ty: y } = b;
    switch (b.type) {
      case "archer":
      case "tower":
        this.burst(this.sparks, x, y, z, now, 3, 0xffe9b0, 2.5, 0.8, 0.2, 0.6, 8);
        if (b.type === "archer" && this.stuck.length < 220 && b.on !== "dragon") {
          const yaw = Math.atan2(b.tx - b.fx, b.tz - b.fz);
          this.stuck.push({ x: x + rand(-0.4, 0.4), y: this.map.heightAt(x, z) + 0.25, z: z + rand(-0.4, 0.4), yaw, pitch: rand(0.5, 0.9), t0: now });
        }
        if (b.type === "tower") this.burst(this.dust, x, this.map.heightAt(x, z) + 0.3, z, now, 2, 0xc8bfae, 1.5, 0.35, 0.5, 0.2);
        break;
      case "wizard":
        this.explosion(x, y, z, now, 0.8, 0xff7a1a);
        this.scorchMark(x, z, now, 1.3);
        break;
      case "necromancer":
        this.burst(this.glow, x, y, z, now, 10, 0xa855f7, 3, 0.45, 0.6, 0.8, -1.5);
        this.burst(this.dust, x, this.map.heightAt(x, z) + 0.3, z, now, 3, 0x5b3b7a, 1.2, 0.5, 0.9, 0.4);
        this.ring(x, z, now, 2.2, 0x8b45e0, 0.5);
        break;
      case "dragon":
        this.explosion(x, y, z, now, 1.5, 0xff5a1a);
        this.scorchMark(x, z, now, 2.6);
        this.onShake(0.35, x, z);
        break;
      default:
        this.burst(this.sparks, x, y, z, now, 4, 0xffffff, 2.5, 1, 0.25, 0.6, 6);
    }
    if (b.on === "castle") this.castleChip(b.cx, b.cz, now, x, z);
    this.number(b.on === "castle" ? b.cx : x, b.on === "castle" ? b.cz : z, b.dmg, b.on, now, b.on === "dragon" ? 6 : 1.8);
  }

  private explosion(x: number, y: number, z: number, now: number, scale: number, color: number) {
    this.burst(this.glow, x, y, z, now, Math.round(10 * scale), color, 4 * scale, 0.55 * scale, 0.5, 0.8, -2);
    this.burst(this.glow, x, y, z, now, Math.round(4 * scale), 0xffe27a, 2 * scale, 0.8 * scale, 0.25, 0.4);
    this.burst(this.sparks, x, y, z, now, Math.round(8 * scale), 0xffc060, 7 * scale, 1.3, 0.5, 1, 12);
    this.burst(this.dust, x, y, z, now, Math.round(4 * scale), 0x4a3f38, 1.8 * scale, 0.6 * scale, 1.4, 0.7, -0.8);
    this.ring(x, z, now, 3 * scale, color, 0.4);
  }

  private dragonBreath(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, now: number) {
    const dx = tx - fx;
    const dy = ty - fy;
    const dz = tz - fz;
    for (let i = 0; i < 26; i++) {
      const t = Math.random();
      this.c.set(Math.random() < 0.3 ? 0xffd25a : 0xff5a1a);
      this.glow.add({
        x: fx + dx * t * 0.15, y: fy + dy * t * 0.15, z: fz + dz * t * 0.15,
        vx: dx * rand(1.1, 1.6) + rand(-1.5, 1.5), vy: dy * rand(1.1, 1.6) + rand(-1, 1), vz: dz * rand(1.1, 1.6) + rand(-1.5, 1.5),
        t0: now + t * 0.15, life: rand(0.45, 0.7), size: rand(0.5, 0.9), grow: 1.4, gravity: -1, drag: 2,
        r: this.c.r, g: this.c.g, b: this.c.b, spin: rand(-4, 4), bounce: false,
      });
    }
  }

  private death(x: number, z: number, kid: number, type: UnitType, now: number) {
    const y = this.map.heightAt(x, z) + 0.6;
    const heavy = HEAVY[type] ?? 0;
    const big = type === "golem" || type === "demon" || type === "dragon";
    this.burst(this.dust, x, y, z, now, big ? 8 : 3, 0xe8e2d6, big ? 3 : 1.6, big ? 0.9 : 0.5, 0.8, 0.5, -0.4);
    this.c.set(this.kingdomColor(kid));
    this.burst(this.debris, x, y + 0.3, z, now, big ? 10 : 4, this.c.getHex(), big ? 5 : 3.2, big ? 1.4 : 0.8, 1.2, 1, 14);
    if (type === "skeleton") this.burst(this.debris, x, y + 0.2, z, now, 4, 0xe6dfcc, 3, 0.9, 1, 1, 14);
    if (big) {
      this.ring(x, z, now, 4 + heavy * 2, 0xffd9a0, 0.55);
      this.onShake(0.3, x, z);
    }
  }

  private collapse(x: number, z: number, level: number, color: string, now: number) {
    const ground = this.map.heightAt(x, z);
    const size = 1 + level * 0.07;
    // flash, shockwave, dust cloud, flying stones and a rubble pile that stays for the round
    this.burst(this.glow, x, ground + 2.5, z, now, 18, 0xffb347, 6, 1.2, 0.6, 0.8, -1);
    this.ring(x, z, now, 14 * size, 0xffd08a, 0.8);
    this.ring(x, z, now, 8 * size, 0xffffff, 0.5);
    this.burst(this.dust, x, ground + 1.5, z, now, 26, 0x9d9486, 6 * size, 1.4 * size, 2.4, 0.6, -0.3);
    this.burst(this.debris, x, ground + 3, z, now, 40, 0x8d8a83, 9, 1.8, 2.2, 1.3, 18);
    this.c.set(color);
    this.burst(this.debris, x, ground + 4, z, now, 14, this.c.getHex(), 7, 1.6, 2.2, 1.4, 18);
    this.burst(this.sparks, x, ground + 2, z, now, 30, 0xffc060, 10, 1.6, 0.9, 1.2, 10);
    this.scorchMark(x, z, now, 3.6 * size, 0x2a231d);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 3.2 * size;
      const rx = x + Math.cos(a) * r;
      const rz = z + Math.sin(a) * r;
      const stone = Math.random() < 0.8;
      this.rubble.push({
        x: rx, y: this.map.heightAt(rx, rz) + 0.1, z: rz, s: rand(0.4, 1.1) * size * (1 - r / (4 * size)) + 0.2, ry: Math.random() * 6,
        color: new THREE.Color(stone ? 0x7b8494 : color).multiplyScalar(rand(0.65, 1)),
      });
    }
    if (this.rubble.length > 1200) this.rubble.splice(0, this.rubble.length - 1200);
    this.rubbleDirty = true;
    this.onShake(1, x, z);
  }

  private giftArrival(x: number, z: number, power: number, like: boolean, now: number) {
    const ground = this.map.heightAt(x, z);
    if (like) {
      this.burst(this.sparks, x, ground + 1, z, now, 6, 0xff6b9a, 2, 1.2, 0.8, 1.2, -1);
      return;
    }
    const tier = power >= 1000 ? 3 : power >= 450 ? 2 : power >= 150 ? 1 : 0;
    const color = [0x9fd8ff, 0x46e0c8, 0xc77dff, 0xffd34d][tier];
    this.pillars.push({ x, y: ground, z, t0: now, color: new THREE.Color(color), height: 18 + tier * 14, width: 1.6 + tier * 0.6 });
    if (this.pillars.length > 24) this.pillars.shift();
    this.ring(x, z, now, 6 + tier * 3, color, 0.7);
    this.burst(this.sparks, x, ground + 0.5, z, now, 18 + tier * 14, color, 3 + tier, 1.6, 1.4, 3, -2.5);
    this.burst(this.glow, x, ground + 1, z, now, 6 + tier * 4, color, 2, 0.6, 0.9, 1.5, -2);
    if (tier >= 2) this.onShake(0.2 * tier, x, z);
  }

  private villageTaken(x: number, z: number, color: string, stolen: boolean, radius: number, now: number) {
    const ground = this.map.heightAt(x, z);
    const c = new THREE.Color(color).getHex();
    this.ring(x, z, now, radius, c, 0.9);
    this.ring(x, z, now, 4, 0xffffff, 0.45);
    this.burst(this.sparks, x, ground + 3.8, z, now, stolen ? 30 : 18, c, 3, 1.4, 1.2, 1.5, 4);
    this.burst(this.glow, x, ground + 3.8, z, now, 6, c, 1.5, 0.5, 0.7, 1, -1);
  }

  private levelUp(x: number, z: number, now: number) {
    const ground = this.map.heightAt(x, z);
    this.ring(x, z, now, 7, 0xffd34d, 0.8);
    this.ring(x, z, now, 4, 0xffffff, 0.5);
    this.burst(this.sparks, x, ground + 1, z, now, 30, 0xffd34d, 3, 1.5, 1.5, 3, -2);
  }

  // ---------------------------------------------------------------- per frame

  update(sim: Sim, now: number) {
    const dt = Math.min(Math.max(now - this.lastNow, 0), 0.1);
    this.lastNow = now;
    this.kingdomColor = (kid) => sim.kingdomById(kid)?.color ?? "#ffffff";

    this.updateBolts(now);
    this.updateStuck(now);
    this.castleState(sim, now);
    this.flushCastleNumbers(now);
    this.updatePillars(now);
    if (this.rubbleDirty) this.updateRubble();

    for (const p of [this.sparks, this.glow, this.dust, this.debris]) p.update(now, dt);
    this.rings.update(now);
    this.scorch.update(now);
    this.numbers.update(now);

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
      if (Math.random() < dt * 6) this.burst(this.glow, d.x, this.dragon.position.y + 1.5, d.z, now, 1, 0xff5a1a, 0.6, 0.4, 0.6, 1, -1.5);
    }
  }

  private updateBolts(now: number) {
    let na = 0;
    let no = 0;
    let ns = 0;
    const keep: Bolt[] = [];
    for (const b of this.bolts) {
      const t = (now - b.t0) / b.dur;
      if (t >= 1) {
        this.impact(b, now);
        continue;
      }
      keep.push(b);
      if (t < 0) continue;
      const x = b.fx + (b.tx - b.fx) * t;
      const z = b.fz + (b.tz - b.fz) * t;
      const y = b.fy + (b.ty - b.fy) * t + Math.sin(t * Math.PI) * b.arc;
      this.p.set(x, y, z);
      if (b.type === "archer") {
        // point along the flight path, including the arc's slope
        const len = Math.hypot(b.tx - b.fx, b.tz - b.fz);
        const vy = (b.ty - b.fy) + Math.cos(t * Math.PI) * Math.PI * b.arc;
        this.e.set(-Math.atan2(vy, len), Math.atan2(b.tx - b.fx, b.tz - b.fz), 0, "YXZ");
        this.q.setFromEuler(this.e);
        this.s.setScalar(1);
        this.m.compose(this.p, this.q, this.s);
        if (na < 300) this.arrowMesh.setMatrixAt(na++, this.m);
      } else if (b.type === "tower") {
        this.q.identity();
        this.s.setScalar(1.2);
        this.m.compose(this.p, this.q, this.s);
        if (ns < 120) this.stoneMesh.setMatrixAt(ns++, this.m);
      } else {
        const size = b.type === "dragon" ? 2.4 : b.type === "wizard" ? 1.3 : b.type === "necromancer" ? 1.1 : 0.8;
        this.q.identity();
        this.s.setScalar(size * (0.9 + Math.sin(now * 40 + b.t0) * 0.1));
        this.m.compose(this.p, this.q, this.s);
        this.c.set(SHOT_COLOR[b.type] ?? 0xffffff);
        if (no < 200) {
          this.orbMesh.setMatrixAt(no, this.m);
          this.orbMesh.setColorAt(no, this.c);
          no++;
        }
        // glowing trail behind magic shots
        if (Math.random() < 0.7) {
          this.glow.add({
            x, y, z, vx: rand(-0.3, 0.3), vy: rand(0, 0.6), vz: rand(-0.3, 0.3), t0: now, life: 0.3, size: size * 0.45, grow: -0.6,
            gravity: 0, drag: 1, r: this.c.r, g: this.c.g, b: this.c.b, spin: 3, bounce: false,
          });
        }
      }
    }
    this.bolts = keep;
    this.arrowMesh.count = na;
    this.orbMesh.count = no;
    this.stoneMesh.count = ns;
    for (const mesh of [this.arrowMesh, this.orbMesh, this.stoneMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateStuck(now: number) {
    this.stuck = this.stuck.filter((a) => now - a.t0 < 3);
    let n = 0;
    for (const a of this.stuck) {
      const t = (now - a.t0) / 3;
      if (t < 0) continue;
      this.p.set(a.x, a.y - (t > 0.7 ? (t - 0.7) * 1.5 : 0), a.z);
      this.e.set(a.pitch, a.yaw, 0, "YXZ");
      this.q.setFromEuler(this.e);
      this.s.set(1, 1, 0.6);
      this.m.compose(this.p, this.q, this.s);
      this.stuckMesh.setMatrixAt(n++, this.m);
    }
    this.stuckMesh.count = n;
    this.stuckMesh.instanceMatrix.needsUpdate = true;
  }

  /** Damaged castles smoke below 50% hp and burn below 25%. */
  private castleState(sim: Sim, now: number) {
    for (const k of sim.kingdoms) {
      if (!k.alive) continue;
      const ratio = k.hp / k.maxHp;
      if (ratio >= 0.5) continue;
      const every = ratio < 0.25 ? 0.12 : 0.3;
      if (now - (this.smokeAt.get(k.id) ?? -9) < every) continue;
      this.smokeAt.set(k.id, now);
      const ground = this.map.heightAt(k.x, k.z);
      const top = ground + 3 + k.level * 0.3;
      const ox = rand(-1.2, 1.2);
      const oz = rand(-1.2, 1.2);
      this.dust.add({
        x: k.x + ox, y: top, z: k.z + oz, vx: 0.4, vy: rand(1.5, 2.5), vz: 0.15, t0: now, life: rand(2, 3), size: rand(0.5, 0.8), grow: 2.5,
        gravity: 0, drag: 0.3, r: 0.25, g: 0.23, b: 0.22, spin: 1, bounce: false,
      });
      if (ratio < 0.25) {
        this.c.set(Math.random() < 0.4 ? 0xffd25a : 0xff5a1a);
        this.glow.add({
          x: k.x + ox, y: top - 1, z: k.z + oz, vx: rand(-0.3, 0.3), vy: rand(1.5, 3), vz: rand(-0.3, 0.3), t0: now, life: rand(0.4, 0.7), size: rand(0.4, 0.7),
          grow: -0.5, gravity: -1, drag: 1, r: this.c.r, g: this.c.g, b: this.c.b, spin: 4, bounce: false,
        });
      }
    }
  }

  private flushCastleNumbers(now: number) {
    for (const [key, acc] of this.castleDmg) {
      if (now - acc.at < 0.6) continue;
      this.castleDmg.delete(key);
      if (acc.dmg < 1) continue;
      this.c.set(0xff6b5b);
      this.numbers.add(acc.x, this.map.heightAt(acc.x, acc.z) + 5, acc.z, acc.dmg, now, 1.4, this.c.clone());
    }
  }

  private updatePillars(now: number) {
    const life = 1.8;
    this.pillars = this.pillars.filter((p) => now - p.t0 < life);
    let n = 0;
    for (const p of this.pillars) {
      const t = (now - p.t0) / life;
      if (t < 0) continue;
      const rise = Math.min(1, t * 6);
      const thin = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
      this.p.set(p.x, p.y, p.z);
      this.q.identity();
      this.s.set(p.width * (0.3 + 0.7 * thin), p.height * rise, p.width * (0.3 + 0.7 * thin));
      this.m.compose(this.p, this.q, this.s);
      this.pillarMesh.setMatrixAt(n, this.m);
      this.c.copy(p.color).multiplyScalar(0.8 * thin);
      this.pillarMesh.setColorAt(n, this.c);
      n++;
    }
    this.pillarMesh.count = n;
    this.pillarMesh.instanceMatrix.needsUpdate = true;
    if (this.pillarMesh.instanceColor) this.pillarMesh.instanceColor.needsUpdate = true;
  }

  private updateRubble() {
    this.rubbleDirty = false;
    let n = 0;
    for (const r of this.rubble) {
      this.p.set(r.x, r.y, r.z);
      this.e.set(r.ry * 0.7, r.ry, r.ry * 0.3);
      this.q.setFromEuler(this.e);
      this.s.set(r.s, r.s * 0.7, r.s);
      this.m.compose(this.p, this.q, this.s);
      this.rubbleMesh.setMatrixAt(n, this.m);
      this.rubbleMesh.setColorAt(n, r.color);
      n++;
    }
    this.rubbleMesh.count = n;
    this.rubbleMesh.instanceMatrix.needsUpdate = true;
    if (this.rubbleMesh.instanceColor) this.rubbleMesh.instanceColor.needsUpdate = true;
  }
}
