// Spell effects. Each spell has its own look, built from the same parts:
//   - a turning magic circle on the ground (one shader, colour and star shape per spell)
//   - meteor: falling burning rocks with a trail, a fireball, molten stones, ground that keeps burning
//   - lightning: a jagged bolt from the sky that re-forms a few times, arcs jumping between troops
//   - frost: ice crystals bursting out of the ground in a wave, snow, low mist, frozen ground
//   - poison: a slow green swirl of cloud with bubbles rising through it
//   - heal: a column of light on the castle, motes drifting down, a spiral around every healed unit
//   - rage: a red eruption at the castle and embers rising from the troops while it lasts
// Troops also show what they suffer from: flames, green bubbles, frost, sparks while stunned.
import * as THREE from "three";
import type { SpellId } from "../sim/config";
import type { WorldMap } from "../sim/map";
import type { Sim, SimEvent, Unit } from "../sim/world";
import { ParticlePool, type Fx } from "./fx";

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[(Math.random() * list.length) | 0];
/** How many to emit this frame for a rate per second. */
const count = (perFrame: number) => Math.floor(perFrame) + (Math.random() < perFrame % 1 ? 1 : 0);

const FLAME = [0xffe08a, 0xff9a2a, 0xff7a1a, 0xff5a1a, 0xd9361a];
const ICE = [0xbfeaff, 0x9fd8f5, 0xe6f8ff, 0x8fcdf0];
const TOXIC = [0x6fbf3a, 0x8fd04a, 0x4e9a2e, 0x9bd95a];
const HOLY = [0xfff2b0, 0xffe27a, 0xffffff, 0xb8ffb0];
const FURY = [0xff3020, 0xff5a2a, 0xff7a30, 0xd91a1a];
const SPARK = [0xffffff, 0xcfe6ff, 0x9fd0ff];

const FALL = 0.85; // seconds a meteor is visible before it lands
const FLY_HEIGHT = 3.5;

interface Opt {
  grow?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  bounce?: boolean;
  delay?: number;
  dim?: number;
}

interface Sigil {
  x: number; y: number; z: number;
  r: number; t0: number; life: number;
  color: THREE.Color; sides: number; spin: number;
}

interface Meteor {
  x: number; y: number; z: number;
  r: number; hit: number; landed: boolean;
}

interface Seg {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  w: number;
}

interface Bolt {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  sky: boolean;
  t0: number; life: number;
  jagAt: number;
  width: number;
  segs: Seg[];
}

interface Shard {
  x: number; y: number; z: number;
  h: number; r: number; yaw: number; tilt: number;
  t0: number; until: number;
  color: THREE.Color;
  popped: boolean;
}

interface Area {
  spell: SpellId;
  x: number; y: number; z: number;
  r: number; t0: number; until: number;
}

export class SpellFx {
  readonly group = new THREE.Group();
  /** bright spells light up the screen: (strength 0..1, colour, x, z) */
  onFlash: (power: number, color: number, x: number, z: number) => void = () => {};

  private fire: ParticlePool;
  private spark: ParticlePool;
  private mist: ParticlePool;

  private sigils: Sigil[] = [];
  private sigilGeo: THREE.InstancedBufferGeometry;
  private sigilPos: THREE.InstancedBufferAttribute;
  private sigilPar: THREE.InstancedBufferAttribute;
  private sigilCol: THREE.InstancedBufferAttribute;

  private meteors: Meteor[] = [];
  private meteorMesh: THREE.InstancedMesh;
  private bolts: Bolt[] = [];
  private boltMesh: THREE.InstancedMesh;
  private shards: Shard[] = [];
  private shardMesh: THREE.InstancedMesh;
  /** frost and poison areas, the burning ground left by meteors, heal and rage at a castle */
  private areas: Area[] = [];
  /** units wrapped in a healing spiral */
  private healed: { id: number; t0: number; until: number }[] = [];

  private now = 0;
  private c = new THREE.Color();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();
  private static Z = new THREE.Vector3(0, 0, 1);

  constructor(
    private fx: Fx,
    private map: WorldMap,
  ) {
    const additive = () => new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.fire = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive(), 2000, "color", map);
    this.spark = new ParticlePool(new THREE.OctahedronGeometry(0.14, 0), additive(), 1600, "color", map);
    this.mist = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, flatShading: true }),
      900,
      "shrink",
      map,
    );

    // ---- magic circles: one quad per circle, the pattern is drawn in the shader
    const SIGILS = 48;
    const quad = new THREE.PlaneGeometry(2, 2);
    this.sigilGeo = new THREE.InstancedBufferGeometry();
    this.sigilGeo.index = quad.index;
    this.sigilGeo.setAttribute("position", quad.getAttribute("position"));
    this.sigilPos = new THREE.InstancedBufferAttribute(new Float32Array(SIGILS * 3), 3);
    this.sigilPar = new THREE.InstancedBufferAttribute(new Float32Array(SIGILS * 4), 4);
    this.sigilCol = new THREE.InstancedBufferAttribute(new Float32Array(SIGILS * 3), 3);
    for (const a of [this.sigilPos, this.sigilPar, this.sigilCol]) a.setUsage(THREE.DynamicDrawUsage);
    this.sigilGeo.setAttribute("iPos", this.sigilPos);
    this.sigilGeo.setAttribute("iPar", this.sigilPar);
    this.sigilGeo.setAttribute("iCol", this.sigilCol);
    this.sigilGeo.instanceCount = 0;
    const sigilMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        attribute vec3 iPos;
        attribute vec4 iPar; // radius, brightness, rotation, sides of the star
        attribute vec3 iCol;
        varying vec2 vP;
        varying vec4 vPar;
        varying vec3 vCol;
        void main() {
          vP = position.xy;
          vPar = iPar;
          vCol = iCol;
          vec3 p = iPos + vec3(position.x, 0.0, position.y) * iPar.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        varying vec4 vPar;
        varying vec3 vCol;
        const float TAU = 6.2831853;
        float band(float v, float c, float w) { return smoothstep(w, 0.0, abs(v - c)); }
        void main() {
          float r = length(vP);
          if (r > 1.0) discard;
          float a = atan(vP.y, vP.x);
          float rot = vPar.z;
          float seg = TAU / vPar.w;
          // three rings
          float g = band(r, 0.965, 0.03) + band(r, 0.80, 0.018) + band(r, 0.42, 0.014);
          // rune marks between the two outer rings
          float u = (a + rot) * 14.0 / TAU;
          float rune = step(0.42, fract(u)) * step(0.25, fract(u * 3.0 + 0.3)) * step(0.835, r) * step(r, 0.93);
          g += rune * 0.85;
          // star: two polygons, turning against the runes
          for (int i = 0; i < 2; i++) {
            float pa = mod(a - rot * 1.4 + float(i) * seg * 0.5, seg) - seg * 0.5;
            g += band(r * cos(pa), 0.79 * cos(seg * 0.5), 0.016) * step(r, 0.8);
          }
          // spokes inside the inner ring
          float sa = mod(a + rot * 0.6, seg) - seg * 0.5;
          g += band(sa * r, 0.0, 0.014) * step(r, 0.42);
          // faint glow over the whole disc, stronger at the rim
          g += 0.06 + 0.1 * r * r;
          gl_FragColor = vec4(vCol * g * vPar.y, 1.0);
        }`,
    });
    const sigilMesh = new THREE.Mesh(this.sigilGeo, sigilMat);
    sigilMesh.frustumCulled = false;
    sigilMesh.renderOrder = 2;

    // ---- meteors, lightning segments, ice crystals
    this.meteorMesh = this.instanced(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x4a2a1c, emissive: 0xff4a10, emissiveIntensity: 0.7, flatShading: true }),
      24,
    );
    this.boltMesh = this.instanced(new THREE.BoxGeometry(1, 1, 1), additive(), 1400);
    const cone = new THREE.ConeGeometry(1, 1, 5);
    cone.translate(0, 0.5, 0);
    this.shardMesh = this.instanced(
      cone,
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2c6c8c, emissiveIntensity: 0.55, flatShading: true, transparent: true, opacity: 0.9 }),
      420,
    );
    this.shardMesh.castShadow = true;

    this.group.add(sigilMesh, this.meteorMesh, this.shardMesh, this.boltMesh, this.mist.mesh, this.fire.mesh, this.spark.mesh);
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.setColorAt(0, new THREE.Color());
    return mesh;
  }

  reset() {
    this.sigils.length = 0;
    this.meteors.length = 0;
    this.bolts.length = 0;
    this.shards.length = 0;
    this.areas.length = 0;
    this.healed.length = 0;
    for (const p of [this.fire, this.spark, this.mist]) p.clear();
  }

  // ---------------------------------------------------------------- helpers

  private put(pool: ParticlePool, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, o: Opt = {}) {
    this.c.set(color);
    const k = (o.dim ?? 1) * rand(0.85, 1.1);
    pool.add({
      x, y, z, vx, vy, vz,
      t0: this.now + (o.delay ?? 0), life, size, grow: o.grow ?? 0, gravity: o.gravity ?? 0, drag: o.drag ?? 1,
      r: this.c.r * k, g: this.c.g * k, b: this.c.b * k, spin: o.spin ?? rand(-5, 5), bounce: o.bounce ?? false,
    });
  }

  private sigil(x: number, z: number, r: number, life: number, color: number, sides: number, spin: number, y?: number) {
    if (this.sigils.length >= 48) this.sigils.shift();
    // a flat circle on sloping ground would sink into the high side: float it level with the highest ground under it
    let top = y ?? this.ground(x, z);
    if (y === undefined) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 8) * Math.PI;
        const d = i < 8 ? r : r * 0.5;
        top = Math.max(top, this.map.heightAt(x + Math.cos(a) * d, z + Math.sin(a) * d));
      }
    }
    this.sigils.push({ x, y: top + 0.3, z, r, t0: this.now, life, color: new THREE.Color(color), sides, spin });
  }

  private ground(x: number, z: number) {
    return Math.max(0, this.map.heightAt(x, z));
  }

  /** A stain on the ground that lasts `life` seconds (frozen or poisoned earth). */
  private stain(x: number, z: number, r: number, life: number, color: number) {
    this.fx.scorch.add({ x, y: this.ground(x, z) + 0.14, z, t0: this.now, life, r0: r * 0.3, r1: r, color: new THREE.Color(color), fade: "shrink" });
  }

  // ---------------------------------------------------------------- events

  onEvent(e: SimEvent, now: number, sim?: Sim) {
    this.now = now;
    switch (e.k) {
      case "spell":
        if (e.spell === "meteor") this.sigil(e.x, e.z, e.r, e.seconds + 0.6, 0xff5a1a, 3, 0.9);
        else if (e.spell === "lightning") this.sigil(e.x, e.z, e.r * 0.7, 0.9, 0x9fd0ff, 4, 2.4);
        else if (e.spell === "frost") this.castFrost(e.x, e.z, e.r, e.seconds);
        else if (e.spell === "poison") this.castPoison(e.x, e.z, e.r, e.seconds);
        else if (e.spell === "heal") this.castHeal(e.x, e.z, e.kid, sim);
        else if (e.spell === "rage") this.castRage(e.x, e.z, e.kid, sim);
        break;
      case "strike": {
        const y = this.ground(e.x, e.z);
        if (this.meteors.length >= 24) this.meteors.shift();
        this.meteors.push({ x: e.x, y, z: e.z, r: e.r, hit: now + e.delay, landed: false });
        // the spot it will hit glows on the ground while the rock is on its way
        this.sigil(e.x, e.z, e.r, e.delay + 0.15, 0xff3a1a, 3, -2.2, y);
        break;
      }
      case "impact":
        this.meteorImpact(e.x, e.z, e.r, e.dmg, sim?.cfg.spells.meteor.burnSeconds ?? 4);
        break;
      case "chain":
        this.lightning(e.points);
        break;
      case "phase":
        if (e.phase === "LOBBY") this.reset();
        break;
    }
  }

  // ---------------------------------------------------------------- meteor

  private meteorImpact(x: number, z: number, r: number, dmg: number, burnSeconds: number) {
    const now = this.now;
    const y = this.ground(x, z);
    // the rock that was heading here is gone
    let best = -1;
    let bd = 4;
    this.meteors.forEach((m, i) => {
      const d = Math.hypot(m.x - x, m.z - z);
      if (!m.landed && d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) this.meteors[best].landed = true;

    this.fx.explosion(x, y + 0.8, z, now, 2.2, 0xff5a1a);
    // fireball rolling upward
    for (let i = 0; i < 24; i++) {
      this.put(this.fire, x + rand(-1, 1), y + rand(0.3, 1.2), z + rand(-1, 1), rand(-2.5, 2.5), rand(4, 11), rand(-2.5, 2.5), rand(0.5, 0.95), rand(0.8, 1.6), pick(FLAME), { grow: 1.3, gravity: 3, drag: 1.7 });
    }
    // a ring of flame racing along the ground
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU + rand(-0.1, 0.1);
      const sp = rand(9, 14) * (r / 3.4);
      this.put(this.fire, x, y + 0.3, z, Math.cos(a) * sp, rand(0.3, 1.8), Math.sin(a) * sp, rand(0.35, 0.55), rand(0.5, 0.8), pick(FLAME), { grow: 1, drag: 3.4 });
    }
    // molten stones thrown out; they bounce and cool
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * TAU;
      const sp = rand(3, 9);
      this.put(this.spark, x, y + 0.6, z, Math.cos(a) * sp, rand(6, 14), Math.sin(a) * sp, rand(1.1, 1.7), rand(1.6, 2.6), pick([0xffb040, 0xff7a1a, 0xffd870]), { gravity: 18, drag: 0.3, bounce: true });
    }
    this.fx.burst(this.fx.debris, x, y + 0.6, z, now, 12, 0x2e2420, 8, 1.3, 1.6, 1.2, 18);
    this.fx.ring(x, z, now, r * 2.6, 0xff7a2a, 0.55);
    this.fx.ring(x, z, now, r * 1.4, 0xffffff, 0.3);
    this.fx.scorchMark(x, z, now, r * 1.15);
    // dark smoke climbing out of the crater
    for (let i = 0; i < 9; i++) {
      this.put(this.mist, x + rand(-1, 1), y + rand(0.5, 1.5), z + rand(-1, 1), rand(-0.5, 0.5), rand(2.2, 4.2), rand(-0.5, 0.5), rand(1.6, 2.6), rand(0.9, 1.5), pick([0x2b2622, 0x3a322c, 0x1f1b18]), { grow: 2, drag: 0.5, delay: i * 0.07 });
    }
    this.areas.push({ spell: "meteor", x, y, z, r: r * 0.9, t0: now, until: now + burnSeconds });
    if (this.areas.length > 40) this.areas.shift();
    this.fx.onShake(0.55, x, z);
    this.onFlash(0.2, 0xff8a3a, x, z);
    if (dmg >= 1) this.fx.numbers.add(x, y + 3, z, dmg, now, 1.5, new THREE.Color(0xff8a3a));
  }

  private updateMeteors(dt: number) {
    const now = this.now;
    this.meteors = this.meteors.filter((m) => now < m.hit + 0.4 && !(m.landed && now > m.hit - 0.05));
    let n = 0;
    for (const m of this.meteors) {
      const t = 1 - (m.hit - now) / FALL;
      if (t < 0 || t > 1) continue;
      // they all come in from the same quarter of the sky, speeding up
      const k = 1 - Math.pow(t, 1.5);
      const x = m.x - 11 * k;
      const y = m.y + 30 * k;
      const z = m.z - 6 * k;
      const size = m.r * 0.4;
      this.p.set(x, y, z);
      this.e.set(now * 7, now * 5, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(size);
      this.m.compose(this.p, this.q, this.s);
      if (n < 24) this.meteorMesh.setMatrixAt(n++, this.m);
      // white-hot head, flames streaming behind, a rope of smoke
      this.put(this.fire, x, y, z, 0, 0, 0, 0.07, size * 2.1, 0xffa850, { grow: 0, drag: 0, spin: 0 });
      for (let i = count(dt * 260); i > 0; i--) {
        const b = Math.random() * 0.06;
        this.put(this.fire, x - 11 * b + rand(-0.4, 0.4) * size, y + 30 * b + rand(-0.4, 0.4) * size, z - 6 * b + rand(-0.4, 0.4) * size, rand(-1, 1), rand(1, 4), rand(-1, 1), rand(0.3, 0.6), rand(0.55, 1.0) * size, pick(FLAME), { grow: -0.5, drag: 1.5 });
      }
      for (let i = count(dt * 45); i > 0; i--) {
        this.put(this.mist, x + rand(-0.3, 0.3), y + rand(0.2, 1), z + rand(-0.3, 0.3), rand(-0.4, 0.4), rand(0.5, 1.5), rand(-0.4, 0.4), rand(1.0, 1.6), rand(0.6, 0.9) * size, 0x2b2622, { grow: 1.6, drag: 1 });
      }
      for (let i = count(dt * 60); i > 0; i--) {
        this.put(this.spark, x, y, z, rand(-3, 3), rand(-1, 4), rand(-3, 3), rand(0.3, 0.6), rand(1, 1.6), 0xffc060, { gravity: 9 });
      }
    }
    this.meteorMesh.count = n;
    this.meteorMesh.instanceMatrix.needsUpdate = true;
  }

  /** Flames, embers and smoke on a patch of ground a meteor set alight. */
  private burnGround(a: Area, dt: number) {
    const left = (a.until - this.now) / (a.until - a.t0);
    const k = Math.min(1, left / 0.35);
    for (let i = count(dt * a.r * a.r * 9 * k); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      const x = a.x + Math.cos(ang) * d;
      const z = a.z + Math.sin(ang) * d;
      this.put(this.fire, x, this.ground(x, z) + 0.15, z, rand(-0.3, 0.3), rand(1.6, 3.4), rand(-0.3, 0.3), rand(0.35, 0.7), rand(0.35, 0.7), pick(FLAME), { grow: -0.7, gravity: -1.5 });
    }
    for (let i = count(dt * 7 * k); i > 0; i--) {
      this.put(this.spark, a.x + rand(-a.r, a.r) * 0.7, a.y + 0.4, a.z + rand(-a.r, a.r) * 0.7, rand(-0.8, 0.8), rand(3, 6), rand(-0.8, 0.8), rand(0.7, 1.2), rand(0.7, 1.1), 0xffa040, { gravity: -0.5, drag: 0.6 });
    }
    for (let i = count(dt * 5); i > 0; i--) {
      this.put(this.mist, a.x + rand(-a.r, a.r) * 0.6, a.y + 1.2, a.z + rand(-a.r, a.r) * 0.6, rand(0.1, 0.5), rand(1.5, 2.5), rand(-0.2, 0.2), rand(1.6, 2.4), rand(0.7, 1.1), 0x2b2622, { grow: 1.8, drag: 0.4 });
    }
  }

  // ---------------------------------------------------------------- lightning

  private lightning(points: { x: number; z: number; dmg: number }[]) {
    const now = this.now;
    points.forEach((pt, i) => {
      const y = this.ground(pt.x, pt.z);
      const delay = i * 0.05;
      if (i === 0) {
        this.addBolt(pt.x + rand(-7, 7), y + 48, pt.z + rand(-7, 7), pt.x, y + 0.2, pt.z, true, 0.45, 0.2, 0);
        // blinding flash at the foot, sparks, scorched earth, and arcs crawling over the ground
        this.put(this.fire, pt.x, y + 1, pt.z, 0, 0, 0, 0.16, 5, 0xffffff, { spin: 0, drag: 0 });
        this.put(this.fire, pt.x, y + 1, pt.z, 0, 0, 0, 0.4, 2.6, 0x9fc8ff, { grow: 1.5, spin: 0, drag: 0 });
        for (let j = 0; j < 30; j++) {
          const a = Math.random() * TAU;
          const sp = rand(6, 16);
          this.put(this.spark, pt.x, y + 0.6, pt.z, Math.cos(a) * sp, rand(2, 10), Math.sin(a) * sp, rand(0.25, 0.55), rand(1.1, 1.9), pick(SPARK), { gravity: 12, bounce: true });
        }
        for (let j = 0; j < 7; j++) {
          const a = (j / 7) * TAU + rand(-0.3, 0.3);
          const d = rand(2.5, 5);
          this.addBolt(pt.x, y + 0.35, pt.z, pt.x + Math.cos(a) * d, this.ground(pt.x + Math.cos(a) * d, pt.z + Math.sin(a) * d) + 0.3, pt.z + Math.sin(a) * d, false, 0.3, 0.07, 0.05);
        }
        this.fx.ring(pt.x, pt.z, now, 7, 0x9fd0ff, 0.45);
        this.fx.ring(pt.x, pt.z, now, 3.5, 0xffffff, 0.25);
        this.fx.scorchMark(pt.x, pt.z, now, 1.8);
        for (let j = 0; j < 5; j++) this.put(this.mist, pt.x + rand(-0.6, 0.6), y + 0.6, pt.z + rand(-0.6, 0.6), rand(-0.4, 0.4), rand(1.5, 3), rand(-0.4, 0.4), rand(1.2, 1.8), rand(0.6, 1), 0x4a4a52, { grow: 1.6, drag: 0.6, delay: 0.1 });
        this.fx.onShake(0.5, pt.x, pt.z);
        this.onFlash(0.6, 0xcfe4ff, pt.x, pt.z);
      } else {
        const prev = points[i - 1];
        this.addBolt(prev.x, this.ground(prev.x, prev.z) + 1.1, prev.z, pt.x, y + 1.1, pt.z, false, 0.36, 0.11, delay);
        this.put(this.fire, pt.x, y + 1, pt.z, 0, 0, 0, 0.18, 1.8, 0xdfeeff, { spin: 0, drag: 0, delay });
        for (let j = 0; j < 10; j++) {
          const a = Math.random() * TAU;
          const sp = rand(3, 8);
          this.put(this.spark, pt.x, y + 1, pt.z, Math.cos(a) * sp, rand(1, 6), Math.sin(a) * sp, rand(0.2, 0.4), rand(0.9, 1.4), pick(SPARK), { gravity: 12, delay });
        }
        this.fx.ring(pt.x, pt.z, now + delay, 2.4, 0x9fd0ff, 0.3);
      }
      if (pt.dmg >= 20) this.fx.numbers.add(pt.x, y + 2.2, pt.z, pt.dmg, now + delay, i === 0 ? 1.5 : 1, new THREE.Color(0xbfdcff));
    });
  }

  private addBolt(ax: number, ay: number, az: number, bx: number, by: number, bz: number, sky: boolean, life: number, width: number, delay: number) {
    if (this.bolts.length >= 60) this.bolts.shift();
    this.bolts.push({ ax, ay, az, bx, by, bz, sky, t0: this.now + delay, life, jagAt: 0, width, segs: [] });
  }

  /** Break a bolt into crooked segments. Called again every few frames so it writhes. */
  private jag(b: Bolt) {
    b.segs.length = 0;
    const len = Math.hypot(b.bx - b.ax, b.by - b.ay, b.bz - b.az);
    const n = b.sky ? 15 : Math.max(3, Math.round(len / 0.9));
    const amp = b.sky ? 2.6 : Math.min(0.9, len * 0.16);
    let px = b.ax;
    let py = b.ay;
    let pz = b.az;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const env = i === n ? 0 : b.sky ? 1 - t * 0.5 : Math.sin(t * Math.PI);
      const x = b.ax + (b.bx - b.ax) * t + rand(-amp, amp) * env;
      const y = b.ay + (b.by - b.ay) * t + (b.sky ? 0 : rand(-amp, amp) * env * 0.6);
      const z = b.az + (b.bz - b.az) * t + rand(-amp, amp) * env;
      b.segs.push({ ax: px, ay: py, az: pz, bx: x, by: y, bz: z, w: b.width });
      // forks leave the main stroke and die out
      if (b.sky && i > 3 && i < n - 1 && Math.random() < 0.3) {
        let fx = x;
        let fy = y;
        let fz = z;
        const a = Math.random() * TAU;
        for (let j = 0; j < 4; j++) {
          const nx = fx + Math.cos(a) * rand(1, 2.6) + rand(-0.8, 0.8);
          const ny = fy - rand(1, 2.8);
          const nz = fz + Math.sin(a) * rand(1, 2.6) + rand(-0.8, 0.8);
          b.segs.push({ ax: fx, ay: fy, az: fz, bx: nx, by: ny, bz: nz, w: b.width * (0.55 - j * 0.1) });
          fx = nx;
          fy = ny;
          fz = nz;
        }
      }
      px = x;
      py = y;
      pz = z;
    }
  }

  private updateBolts() {
    const now = this.now;
    this.bolts = this.bolts.filter((b) => now - b.t0 < b.life);
    let n = 0;
    const cap = 1400;
    for (const b of this.bolts) {
      const t = (now - b.t0) / b.life;
      if (t < 0) continue;
      if (now >= b.jagAt) {
        this.jag(b);
        b.jagAt = now + 0.05;
      }
      // bright strokes with a dark beat between them, then it fades
      const pulse = b.sky ? (t < 0.25 ? 1 : t < 0.33 ? 0.15 : t < 0.6 ? 0.9 : (1 - t) * 2) : 1 - t * t;
      const k = Math.max(0, pulse) * rand(0.75, 1);
      for (const s of b.segs) {
        this.v.set(s.bx - s.ax, s.by - s.ay, s.bz - s.az);
        const len = this.v.length() || 0.001;
        this.p.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, (s.az + s.bz) / 2);
        this.q.setFromUnitVectors(SpellFx.Z, this.v.divideScalar(len));
        // a white core inside a wide blue glow
        for (let layer = 0; layer < 2 && n < cap; layer++) {
          const w = layer ? s.w * 4 : s.w;
          this.s.set(w, w, len + w * 0.5);
          this.m.compose(this.p, this.q, this.s);
          this.boltMesh.setMatrixAt(n, this.m);
          if (layer) this.c.setRGB(0.1 * k, 0.24 * k, 0.6 * k);
          else this.c.setRGB(k, k, k);
          this.boltMesh.setColorAt(n, this.c);
          n++;
        }
      }
    }
    this.boltMesh.count = n;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    if (this.boltMesh.instanceColor) this.boltMesh.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- frost

  private castFrost(x: number, z: number, r: number, seconds: number) {
    const now = this.now;
    const y = this.ground(x, z);
    this.sigil(x, z, r, seconds, 0x7fdcff, 6, 0.5);
    this.fx.ring(x, z, now, r * 1.2, 0x9fe6ff, 0.6);
    this.fx.ring(x, z, now, r * 0.7, 0xffffff, 0.4);
    this.stain(x, z, r * 1.02, seconds + 1.5, 0xd8f4ff);
    this.areas.push({ spell: "frost", x, y, z, r, t0: now, until: now + seconds });
    const shard = (a: number, d: number, h: number, rad: number, tilt: number, yaw: number) => {
      const sx = x + Math.cos(a) * d;
      const sz = z + Math.sin(a) * d;
      const gy = this.map.heightAt(sx, sz);
      if (gy < 0.05) return; // not out of the water
      if (this.shards.length >= 420) this.shards.shift();
      this.shards.push({
        x: sx, y: gy - 0.15, z: sz, h, r: rad, yaw, tilt,
        t0: now + (d / r) * 0.4 + rand(0, 0.08), until: now + seconds + rand(0, 0.6),
        color: new THREE.Color(pick(ICE)), popped: false,
      });
    };
    // a crown of tall crystals leaning outward, smaller ones inside, a cluster in the middle
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rand(-0.12, 0.12);
      shard(a, r * rand(0.86, 0.97), rand(2.2, 3.8), rand(0.5, 0.85), rand(0.25, 0.5), Math.PI / 2 - a);
    }
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * TAU;
      shard(a, Math.sqrt(Math.random()) * r * 0.82, rand(0.8, 2.1), rand(0.26, 0.5), rand(0, 0.4), Math.random() * TAU);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      shard(a, i === 0 ? 0 : rand(0.6, 1.3), i === 0 ? 5.2 : rand(3, 4.2), i === 0 ? 1.0 : rand(0.55, 0.8), i === 0 ? 0 : rand(0.15, 0.35), Math.PI / 2 - a);
    }
    // cold air bursting outward along the ground
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      this.put(this.mist, x, y + 0.5, z, Math.cos(a) * rand(6, 10), rand(0.2, 1), Math.sin(a) * rand(6, 10), rand(1, 1.6), rand(0.9, 1.5), pick([0xdff3fb, 0xc3e6f5]), { grow: 1.4, drag: 2.4 });
    }
    this.fx.onShake(0.3, x, z);
  }

  private updateShards() {
    const now = this.now;
    let n = 0;
    const keep: Shard[] = [];
    for (const s of this.shards) {
      const age = now - s.t0;
      const left = s.until - now;
      if (left <= 0) {
        // it shatters
        this.fx.burst(this.fx.debris, s.x, s.y + s.h * 0.5, s.z, now, 3, s.color.getHex(), 3.5, 1 + s.r, 0.9, 1, 14);
        for (let i = 0; i < 4; i++) this.put(this.spark, s.x, s.y + rand(0.3, s.h), s.z, rand(-2.5, 2.5), rand(1, 4), rand(-2.5, 2.5), rand(0.4, 0.7), rand(0.9, 1.4), 0xe6f8ff, { gravity: 9 });
        continue;
      }
      keep.push(s);
      if (age < 0) continue;
      if (!s.popped) {
        s.popped = true;
        for (let i = 0; i < 5; i++) this.put(this.spark, s.x, s.y + 0.3, s.z, rand(-3, 3), rand(3, 7) * (s.h / 3), rand(-3, 3), rand(0.35, 0.6), rand(0.9, 1.5), pick(ICE), { gravity: 12 });
        this.put(this.mist, s.x, s.y + 0.4, s.z, rand(-0.6, 0.6), rand(0.4, 1.2), rand(-0.6, 0.6), rand(0.8, 1.2), 0.5 + s.r, 0xe2f4fb, { grow: 1.2, drag: 1.5 });
      }
      // shoots up past its height and settles; sinks back just before it breaks
      const g = Math.min(1, age / 0.2);
      const out = 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2);
      const k = out * Math.min(1, left / 0.15);
      this.p.set(s.x, s.y, s.z);
      this.e.set(s.tilt, s.yaw, 0, "YXZ");
      this.q.setFromEuler(this.e);
      this.s.set(s.r * Math.min(1, 0.5 + g * 0.5), Math.max(0.001, s.h * k), s.r * Math.min(1, 0.5 + g * 0.5));
      this.m.compose(this.p, this.q, this.s);
      this.shardMesh.setMatrixAt(n, this.m);
      this.shardMesh.setColorAt(n, s.color);
      n++;
    }
    this.shards = keep;
    this.shardMesh.count = n;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    if (this.shardMesh.instanceColor) this.shardMesh.instanceColor.needsUpdate = true;
  }

  private frostAir(a: Area, dt: number) {
    // snow drifting down, mist creeping round, glints on the ice
    for (let i = count(dt * a.r * a.r * 0.55); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.spark, a.x + Math.cos(ang) * d, a.y + rand(3, 7.5), a.z + Math.sin(ang) * d, rand(0.3, 1.1), rand(-3, -1.8), rand(-0.4, 0.4), rand(1.4, 2.2), rand(0.8, 1.4), 0xf2fbff, { drag: 0.2, spin: rand(-2, 2) });
    }
    for (let i = count(dt * 15); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.mist, a.x + Math.cos(ang) * d, a.y + rand(0.3, 0.9), a.z + Math.sin(ang) * d, -Math.sin(ang) * 0.8, rand(0, 0.25), Math.cos(ang) * 0.8, rand(1.8, 2.6), rand(1.0, 1.6), pick([0xdff3fb, 0xc3e6f5, 0xeef9fd]), { grow: 0.9, drag: 0.3 });
    }
    for (let i = count(dt * 12); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.fire, a.x + Math.cos(ang) * d, a.y + rand(0.3, 2.8), a.z + Math.sin(ang) * d, 0, 0, 0, rand(0.15, 0.3), rand(0.14, 0.26), 0xcff4ff, { spin: 0, drag: 0 });
    }
  }

  // ---------------------------------------------------------------- poison

  private castPoison(x: number, z: number, r: number, seconds: number) {
    const now = this.now;
    const y = this.ground(x, z);
    this.sigil(x, z, r, seconds, 0x6fe03a, 3, -0.6);
    this.fx.ring(x, z, now, r * 1.15, 0x7ed957, 0.6);
    this.stain(x, z, r, seconds + 2, 0x1c3a12);
    this.areas.push({ spell: "poison", x, y, z, r, t0: now, until: now + seconds });
    // the cloud bursts out of the ground in the middle and rolls outward
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * TAU;
      const sp = rand(2.5, 7);
      this.put(this.mist, x, y + rand(0.4, 1.4), z, Math.cos(a) * sp, rand(0.5, 2.5), Math.sin(a) * sp, rand(1.4, 2.2), rand(1.2, 2.0), pick(TOXIC), { grow: 1.3, drag: 1.4 });
    }
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TAU;
      this.put(this.fire, x + Math.cos(a) * rand(0, 2), y + 0.3, z + Math.sin(a) * rand(0, 2), rand(-1, 1), rand(3, 8), rand(-1, 1), rand(0.5, 0.9), rand(0.2, 0.4), pick([0xa8ff60, 0x6fe03a]), { gravity: 5 });
    }
  }

  private poisonAir(a: Area, dt: number) {
    const left = a.until - this.now;
    const k = Math.min(1, left / 1.2);
    // the cloud turns slowly about its middle
    for (let i = count(dt * 36 * k); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      const sp = rand(1.0, 1.9);
      this.put(this.mist, a.x + Math.cos(ang) * d, a.y + rand(0.4, 2.5), a.z + Math.sin(ang) * d, -Math.sin(ang) * sp - Math.cos(ang) * 0.3, rand(0.1, 0.5), Math.cos(ang) * sp - Math.sin(ang) * 0.3, rand(1.8, 2.8), rand(1.2, 2.1), pick(TOXIC), { grow: 0.9, drag: 0.4, spin: rand(-1.5, 1.5) });
    }
    // a sickly light inside it, and bubbles rising from the ground
    for (let i = count(dt * 7 * k); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r * 0.8;
      this.put(this.fire, a.x + Math.cos(ang) * d, a.y + rand(0.5, 1.4), a.z + Math.sin(ang) * d, 0, 0.2, 0, rand(0.9, 1.4), rand(1.5, 2.6), 0x7fe03a, { grow: 0.5, drag: 0, spin: 0.5, dim: 0.22 });
    }
    for (let i = count(dt * 24 * k); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.fire, a.x + Math.cos(ang) * d, a.y + 0.1, a.z + Math.sin(ang) * d, rand(-0.2, 0.2), rand(1.2, 2.6), rand(-0.2, 0.2), rand(0.6, 1.1), rand(0.14, 0.3), pick([0xa8ff60, 0x6fe03a, 0xd0ff8a]), { grow: 0.5, gravity: -0.4 });
    }
    for (let i = count(dt * 8 * k); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.spark, a.x + Math.cos(ang) * d, a.y + rand(1.5, 2.8), a.z + Math.sin(ang) * d, 0, -0.5, 0, rand(0.5, 0.8), rand(0.8, 1.2), 0x9dff5a, { gravity: 9 });
    }
  }

  // ---------------------------------------------------------------- heal and rage

  private castHeal(x: number, z: number, kid: number, sim?: Sim) {
    const now = this.now;
    const y = this.ground(x, z);
    this.sigil(x, z, 7, 2.4, 0xffe27a, 4, 0.8);
    this.sigil(x, z, 4, 2.4, 0x8dffa8, 6, -1.2);
    this.fx.ring(x, z, now, 18, 0xffe27a, 0.9);
    this.fx.ring(x, z, now, 10, 0x8dffa8, 0.6);
    this.fx.ring(x, z, now + 0.25, 14, 0xffffff, 0.7);
    this.areas.push({ spell: "heal", x, y, z, r: 9, t0: now, until: now + 1.8 });
    this.onFlash(0.14, 0xfff2b0, x, z);
    if (!sim) return;
    let n = 0;
    for (const u of sim.units) {
      if (!u.alive || u.kid !== kid) continue;
      if (this.healed.length < 160) this.healed.push({ id: u.id, t0: now + rand(0, 0.25), until: now + 1.5 });
      if (n++ < 24) this.fx.ring(u.x, u.z, now + rand(0, 0.2), 1.5, 0x8dffa8, 0.5);
    }
  }

  private healLight(a: Area, dt: number) {
    const age = this.now - a.t0;
    if (age < 1.3) {
      // column of light on the castle with two strands winding up it
      for (let i = count(dt * 130); i > 0; i--) {
        const ang = Math.random() * TAU;
        const d = Math.random() * 1.4;
        this.put(this.fire, a.x + Math.cos(ang) * d, a.y + rand(0, 3), a.z + Math.sin(ang) * d, 0, rand(11, 19), 0, rand(0.5, 0.8), rand(0.35, 0.6), pick(HOLY), { drag: 0.2, grow: -0.4, dim: 0.8 });
      }
      for (const off of [0, Math.PI]) {
        const ang = age * 7 + off;
        this.put(this.spark, a.x + Math.cos(ang) * 2.6, a.y + 0.3 + age * 9, a.z + Math.sin(ang) * 2.6, 0, 1.5, 0, 0.7, 2.2, 0xfff2b0, { drag: 0.5 });
        this.put(this.fire, a.x + Math.cos(ang) * 2.6, a.y + 0.3 + age * 9, a.z + Math.sin(ang) * 2.6, 0, 0, 0, 0.3, 0.5, 0xb8ffb0, { drag: 0, spin: 0 });
      }
    }
    // motes of light drifting down around the castle
    for (let i = count(dt * 45); i > 0; i--) {
      const ang = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * a.r;
      this.put(this.spark, a.x + Math.cos(ang) * d, a.y + rand(5, 10), a.z + Math.sin(ang) * d, rand(-0.3, 0.3), rand(-2.6, -1.4), rand(-0.3, 0.3), rand(1.4, 2.2), rand(1, 1.6), pick(HOLY), { drag: 0.2 });
    }
  }

  private castRage(x: number, z: number, kid: number, sim?: Sim) {
    const now = this.now;
    const y = this.ground(x, z);
    this.sigil(x, z, 7, 2.6, 0xff2a1a, 5, 1.6);
    this.fx.ring(x, z, now, 18, 0xff3b30, 0.8);
    this.fx.ring(x, z, now, 9, 0xff9a3a, 0.5);
    // a burst of red fire up the castle and a ring of sparks along the ground
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * TAU;
      const d = rand(0, 2.6);
      this.put(this.fire, x + Math.cos(a) * d, y + rand(0.3, 2), z + Math.sin(a) * d, Math.cos(a) * rand(0, 2), rand(6, 13), Math.sin(a) * rand(0, 2), rand(0.5, 0.9), rand(0.6, 1.1), pick(FURY), { grow: -0.5, drag: 1.2 });
    }
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU;
      const sp = rand(7, 13);
      this.put(this.spark, x, y + 0.5, z, Math.cos(a) * sp, rand(2, 6), Math.sin(a) * sp, rand(0.5, 0.9), rand(1.2, 2), pick(FURY), { gravity: 8, drag: 0.8 });
    }
    this.fx.onShake(0.35, x, z);
    this.onFlash(0.12, 0xff3b30, x, z);
    if (!sim) return;
    let n = 0;
    for (const u of sim.units) {
      if (!u.alive || u.kid !== kid || n++ > 120) continue;
      const uy = this.unitY(sim, u);
      for (let i = 0; i < 3; i++) this.put(this.fire, u.x + rand(-0.3, 0.3), uy + rand(0.3, 1), u.z + rand(-0.3, 0.3), 0, rand(3, 6), 0, rand(0.4, 0.6), rand(0.3, 0.45), pick(FURY), { grow: -0.6, delay: rand(0, 0.3) });
    }
  }

  // ---------------------------------------------------------------- troops under a spell

  private unitY(sim: Sim, u: Unit) {
    return this.ground(u.x, u.z) + (sim.cfg.unitTypes[u.type].flying ? FLY_HEIGHT : 0);
  }

  private unitStates(sim: Sim, dt: number) {
    const t = sim.t;
    const raging = new Map<number, number>();
    for (const k of sim.kingdoms) if (k.alive && k.rageUntil > t) raging.set(k.id, Math.min(4, 220 / Math.max(1, k.unitCount)));
    for (const u of sim.units) {
      if (!u.alive) continue;
      const burn = u.burnUntil > t;
      const poison = u.poisonUntil > t;
      const chill = u.chillUntil > t;
      const stun = u.stunUntil > t;
      const rage = raging.get(u.kid);
      if (!burn && !poison && !chill && !stun && !rage) continue;
      const y = this.unitY(sim, u);
      if (burn) {
        for (let i = count(dt * 13); i > 0; i--) {
          this.put(this.fire, u.x + rand(-0.35, 0.35), y + rand(0.3, 1.3), u.z + rand(-0.35, 0.35), rand(-0.3, 0.3), rand(1.2, 2.4), rand(-0.3, 0.3), rand(0.3, 0.5), rand(0.28, 0.46), pick(FLAME), { grow: -0.6, gravity: -1 });
        }
        if (Math.random() < dt * 3) this.put(this.spark, u.x, y + 1, u.z, rand(-1, 1), rand(2, 4), rand(-1, 1), rand(0.5, 0.9), rand(0.7, 1), 0xffa040, { gravity: -0.4 });
        if (Math.random() < dt * 2.5) this.put(this.mist, u.x, y + 1.5, u.z, rand(-0.2, 0.2), rand(1.2, 2), rand(-0.2, 0.2), rand(0.9, 1.4), rand(0.4, 0.6), 0x2b2622, { grow: 1.5, drag: 0.5 });
      }
      if (poison) {
        for (let i = count(dt * 6); i > 0; i--) {
          this.put(this.fire, u.x + rand(-0.3, 0.3), y + rand(0.2, 1.1), u.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(0.8, 1.6), rand(-0.2, 0.2), rand(0.6, 0.9), rand(0.14, 0.24), pick([0x9dff5a, 0x5fd03a]), { grow: 0.6, gravity: -0.5 });
        }
        if (Math.random() < dt * 2) this.put(this.mist, u.x, y + 0.8, u.z, rand(-0.3, 0.3), rand(0.3, 0.8), rand(-0.3, 0.3), rand(0.8, 1.2), rand(0.45, 0.7), pick(TOXIC), { grow: 1, drag: 0.8 });
      }
      if (chill) {
        for (let i = count(dt * 7); i > 0; i--) {
          this.put(this.spark, u.x + rand(-0.4, 0.4), y + rand(0.9, 1.7), u.z + rand(-0.4, 0.4), rand(-0.2, 0.2), rand(-1, -0.4), rand(-0.2, 0.2), rand(0.4, 0.7), rand(0.6, 0.9), 0xdff6ff, { drag: 0.3 });
        }
        if (Math.random() < dt * 1.6) this.put(this.mist, u.x, y + 0.3, u.z, rand(-0.3, 0.3), 0.2, rand(-0.3, 0.3), rand(0.7, 1), rand(0.4, 0.6), 0xdff3fb, { grow: 0.9, drag: 1 });
      }
      if (stun) {
        for (let i = count(dt * 16); i > 0; i--) {
          const a = Math.random() * TAU;
          const sp = rand(2.5, 6);
          this.put(this.spark, u.x, y + rand(0.4, 1.5), u.z, Math.cos(a) * sp, rand(-2, 3), Math.sin(a) * sp, rand(0.08, 0.18), rand(0.9, 1.3), pick(SPARK));
        }
        if (Math.random() < dt * 9) {
          const a = Math.random() * TAU;
          this.addBolt(u.x + Math.cos(a) * 0.5, y + rand(0.2, 0.6), u.z + Math.sin(a) * 0.5, u.x - Math.cos(a) * 0.5, y + rand(1.2, 1.8), u.z - Math.sin(a) * 0.5, false, 0.1, 0.045, 0);
        }
      }
      if (rage) {
        for (let i = count(dt * rage); i > 0; i--) {
          this.put(this.fire, u.x + rand(-0.3, 0.3), y + rand(0.2, 1.2), u.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(1.5, 3), rand(-0.2, 0.2), rand(0.4, 0.7), rand(0.2, 0.32), pick(FURY), { grow: -0.5, gravity: -0.6 });
        }
      }
    }
    if (this.healed.length) {
      this.healed = this.healed.filter((h) => this.now < h.until);
      if (!this.healed.length) return;
      const byId = new Map<number, Unit>();
      for (const u of sim.units) if (u.alive) byId.set(u.id, u);
      const rate = Math.min(1, 70 / this.healed.length);
      for (const h of this.healed) {
        const u = byId.get(h.id);
        const age = this.now - h.t0;
        if (!u || age < 0 || Math.random() > rate) continue;
        // a spiral of light climbing around the unit
        const a = age * 9 + h.id;
        const y = this.unitY(sim, u);
        this.put(this.spark, u.x + Math.cos(a) * 0.6, y + 0.15 + age * 1.5, u.z + Math.sin(a) * 0.6, 0, 0.8, 0, 0.5, 1.5, a % 2 < 1 ? 0x9dffb0 : 0xffe890, { drag: 0.5 });
        if (Math.random() < dt * 8) this.put(this.fire, u.x + rand(-0.3, 0.3), y + rand(0.2, 1.4), u.z + rand(-0.3, 0.3), 0, rand(1, 2), 0, rand(0.4, 0.6), rand(0.16, 0.26), 0xb8ffb0, { grow: -0.5 });
      }
    }
  }

  // ---------------------------------------------------------------- per frame

  update(sim: Sim, now: number, dt: number) {
    this.now = now;
    this.updateMeteors(dt);
    this.updateBolts();
    this.updateShards();
    if (this.areas.length) {
      this.areas = this.areas.filter((a) => now < a.until);
      for (const a of this.areas) {
        if (a.spell === "meteor") this.burnGround(a, dt);
        else if (a.spell === "frost") this.frostAir(a, dt);
        else if (a.spell === "poison") this.poisonAir(a, dt);
        else if (a.spell === "heal") this.healLight(a, dt);
      }
    }
    this.unitStates(sim, dt);
    for (const p of [this.fire, this.spark, this.mist]) p.update(now, dt);

    // magic circles
    this.sigils = this.sigils.filter((s) => now - s.t0 < s.life);
    let n = 0;
    for (const s of this.sigils) {
      const age = now - s.t0;
      const left = s.life - age;
      const open = Math.min(1, age / 0.35);
      const ease = 1 - (1 - open) * (1 - open);
      const alpha = Math.min(1, age / 0.25) * Math.min(1, left / 0.5) * (0.85 + Math.sin(now * 9 + s.t0 * 7) * 0.15);
      this.sigilPos.setXYZ(n, s.x, s.y, s.z);
      this.sigilPar.setXYZW(n, s.r * (0.55 + 0.45 * ease), alpha * 0.9, age * s.spin, s.sides);
      this.sigilCol.setXYZ(n, s.color.r, s.color.g, s.color.b);
      n++;
    }
    this.sigilGeo.instanceCount = n;
    for (const a of [this.sigilPos, this.sigilPar, this.sigilCol]) a.needsUpdate = true;
  }
}
