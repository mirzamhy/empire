// World event effects: Hujan Meteor Dunia and Naga Purba's hellfire.
//   - the sky turns dark red (level() is read by main.ts for the light and the screen tint)
//   - meteors come in from one quarter of the sky in long burning arcs, with smoke and sparks;
//     far-off streaks cross the sky above the field and burn out before they land
//   - a warning ring pulses on the ground where each one will land
//   - the mother meteor falls slowly for five seconds, its shadow growing over the target, then
//     hits with a flash, three shock waves, a dome of dust and a column of fire
//   - hellfire: a line of fire pillars erupting from the ground one after the other
// The damage and the ordinary explosion of each impact come from the sim's impact event, drawn
// by spellfx.ts; what is here comes on top.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { SimEvent, StrikeStyle } from "../sim/world";
import { ParticlePool, type Fx } from "./fx";

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[(Math.random() * list.length) | 0];
const count = (perFrame: number) => Math.floor(perFrame) + (Math.random() < perFrame % 1 ? 1 : 0);
const FLAME = [0xffe08a, 0xffb040, 0xff7a1a, 0xff5a1a, 0xd9361a];
const SMOKE = [0x2b2622, 0x3a322c, 0x1f1b18];

/** Seconds a meteor is in the air (the mother meteor uses the sim's own timing). */
const FALL = 2.4;
/**
 * Where they all come from (offset at the start of the fall): high up and from the far side of the
 * field, so on the portrait stream they cross the screen from the top down toward their target.
 */
const FROM = new THREE.Vector3(18, 70, -95);
/** The mother meteor comes down far more steeply. */
const MOTHER_FROM = new THREE.Vector3(8, 75, -45);

interface Fall {
  style: StrikeStyle;
  x: number;
  y: number;
  z: number;
  r: number;
  hit: number;
  dur: number;
  warned: number;
}

interface Streak {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t0: number;
  life: number;
  size: number;
}

interface Column {
  x: number;
  y: number;
  z: number;
  t0: number;
  until: number;
  power: number;
}

export class DoomFx {
  readonly group = new THREE.Group();
  private fire: ParticlePool;
  private smoke: ParticlePool;
  private rocks: THREE.InstancedMesh;
  private mother: THREE.Group;
  private motherHalo: THREE.Mesh;
  private shadow: THREE.Mesh;
  private falls: Fall[] = [];
  private streaks: Streak[] = [];
  private columns: Column[] = [];
  private doom: { warnAt: number; start: number; end: number; x: number; z: number } | null = null;
  private now = 0;
  private c = new THREE.Color();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(
    private fx: Fx,
    private map: WorldMap,
  ) {
    const additive = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.fire = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive, 3200, "color", map);
    this.smoke = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false, flatShading: true }),
      1400,
      "shrink",
      map,
    );
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x3a2418, emissive: 0xff4a10, emissiveIntensity: 0.8, flatShading: true });
    this.rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 48);
    this.rocks.count = 0;
    this.rocks.frustumCulled = false;

    // the mother meteor: a cracked boulder with a molten heart, wrapped in a halo of fire
    this.mother = new THREE.Group();
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x2a1c16, emissive: 0xff3a0a, emissiveIntensity: 0.55, flatShading: true }));
    const p = boulder.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      // knock the boulder out of round
      const k = 0.85 + 0.3 * Math.abs(Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.7 + p.getZ(i) * 4.3));
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    boulder.geometry.computeVertexNormals();
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }));
    this.motherHalo = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3, 2),
      new THREE.MeshBasicMaterial({ color: 0xff4a10, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false }),
    );
    // molten seams: glowing ribbons wrapped around the rock
    for (let i = 0; i < 5; i++) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.05, 4, 18, Math.PI * (0.6 + (i % 3) * 0.3)), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }));
      seam.rotation.set(i * 1.3, i * 2.1, i * 0.7);
      this.mother.add(seam);
    }
    this.mother.add(heart, boulder, this.motherHalo);
    this.mother.visible = false;

    // its shadow on the ground, growing as it comes down
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.visible = false;

    this.group.add(this.rocks, this.mother, this.shadow, this.smoke.mesh, this.fire.mesh);
  }

  /** How dark the sky is: 0 normal, 1 at the height of the meteor rain. */
  level(now: number) {
    const d = this.doom;
    if (!d) return 0;
    if (now < d.start) return Math.max(0, (now - d.warnAt) / (d.start - d.warnAt));
    if (now < d.end) return 1;
    return Math.max(0, 1 - (now - d.end) / 4);
  }

  reset() {
    this.falls.length = 0;
    this.streaks.length = 0;
    this.columns.length = 0;
    this.doom = null;
    this.fire.clear();
    this.smoke.clear();
    this.mother.visible = false;
    this.shadow.visible = false;
  }

  private ground(x: number, z: number) {
    return Math.max(0, this.map.heightAt(x, z));
  }

  private put(pool: ParticlePool, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grow = 0, gravity = 0, drag = 1, delay = 0) {
    this.c.set(color);
    const k = rand(0.85, 1.1);
    pool.add({
      x, y, z, vx, vy, vz, t0: this.now + delay, life, size, grow, gravity, drag,
      r: this.c.r * k, g: this.c.g * k, b: this.c.b * k, spin: rand(-5, 5), bounce: false,
    });
  }

  // ---------------------------------------------------------------- events

  onEvent(e: SimEvent, now: number) {
    this.now = now;
    switch (e.k) {
      case "doom":
        this.doom = { warnAt: now, start: now + e.warn, end: now + e.seconds, x: e.x, z: e.z };
        break;
      case "strike":
        if (!e.style) break;
        this.falls.push({
          style: e.style, x: e.x, z: e.z, y: this.ground(e.x, e.z), r: e.r, hit: now + e.delay,
          dur: e.style === "mother" ? Math.min(e.delay, 5) : e.style === "inferno" ? Math.min(e.delay, 0.5) : FALL, warned: -9,
        });
        break;
      case "impact":
        if (e.r >= 10) this.motherImpact(e.x, e.z, e.r, now);
        break;
      case "phase":
        if (e.phase === "LOBBY") this.reset();
        break;
    }
  }

  private motherImpact(x: number, z: number, r: number, now: number) {
    const g = this.ground(x, z);
    this.fx.spells.onFlash(1, 0xffd6a0, x, z);
    this.fx.onShake(1, x, z);
    this.fx.ring(x, z, now, r * 5.5, 0xffd08a, 1.8, g);
    this.fx.ring(x, z, now, r * 3.4, 0xff5a1a, 1.3, g);
    this.fx.ring(x, z, now, r * 1.8, 0xffffff, 0.6, g);
    this.fx.ring(x, z, now + 0.35, r * 7.5, 0xff8a3a, 2.2, g);
    this.fx.burst(this.fx.dust, x, g + 2, z, now, 70, 0x6a5a4c, 24, 4.5, 4.5, 0.35, -0.2);
    this.fx.burst(this.fx.dust, x, g + 6, z, now + 0.2, 40, 0x3a302a, 10, 5, 5, 1.2, -0.4);
    this.fx.burst(this.fx.debris, x, g + 2, z, now, 90, 0x2e2420, 22, 2.4, 2.6, 1.6, 18);
    this.fx.burst(this.fx.debris, x, g + 2, z, now, 30, 0xff7a1a, 16, 1.6, 2.2, 1.8, 18);
    this.fx.scorchMark(x, z, now, r * 1.5, 0x120a06);
    // a racing ring of flame and a column of fire climbing into the dark
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * TAU + rand(-0.05, 0.05);
      const sp = rand(28, 40);
      this.put(this.fire, x, g + 0.6, z, Math.cos(a) * sp, rand(0.5, 3), Math.sin(a) * sp, rand(0.6, 0.9), rand(1.2, 2), pick(FLAME), 1.2, 0, 2.6);
    }
    this.columns.push({ x, y: g, z, t0: now, until: now + 3, power: 3 });
    for (let i = 0; i < 40; i++) {
      this.put(this.smoke, x + rand(-4, 4), g + rand(1, 6), z + rand(-4, 4), rand(-2, 2), rand(4, 9), rand(-2, 2), rand(3, 5), rand(2.5, 4), pick(SMOKE), 2.2, 0, 0.5, i * 0.05);
    }
  }

  // ---------------------------------------------------------------- per frame

  update(now: number, dt: number) {
    this.now = now;
    this.updateFalls(now, dt);
    this.updateStreaks(now, dt);
    this.updateColumns(now, dt);
    this.fire.update(now, dt);
    this.smoke.update(now, dt);
  }

  private updateFalls(now: number, dt: number) {
    this.falls = this.falls.filter((f) => now < f.hit + 0.1);
    let n = 0;
    let mother: Fall | null = null;
    for (const f of this.falls) {
      const left = f.hit - now;
      // the warning on the ground: a ring pulsing faster as it comes
      const warnFor = f.style === "mother" ? f.dur + 3 : f.style === "inferno" ? 0.6 : 1.1;
      const every = f.style === "mother" ? Math.max(0.18, left * 0.12) : 0.35;
      if (left < warnFor && now - f.warned > every) {
        f.warned = now;
        this.fx.ring(f.x, f.z, now, f.r * (f.style === "mother" ? 1.15 : 1), f.style === "inferno" ? 0xff7a1a : 0xff2a10, Math.min(0.6, every * 1.4), f.y);
      }
      if (f.style === "inferno") {
        if (left < 0.6 && Math.random() < dt * 30) this.put(this.fire, f.x + rand(-1, 1) * f.r, f.y + 0.2, f.z + rand(-1, 1) * f.r, 0, rand(1, 3), 0, rand(0.3, 0.5), rand(0.4, 0.8), pick(FLAME), 0.5);
        if (left <= dt * 1.5) this.columns.push({ x: f.x, y: f.y, z: f.z, t0: now, until: now + 0.9, power: 1 });
        continue;
      }
      const t = 1 - left / f.dur;
      if (t < 0 || t > 1) continue;
      if (f.style === "mother") {
        mother = f;
        continue;
      }
      const k = 1 - Math.pow(t, 1.4);
      const size = f.r * 0.62;
      const x = f.x + FROM.x * k;
      const y = f.y + FROM.y * k;
      const z = f.z + FROM.z * k;
      this.p.set(x, y, z);
      this.e.set(now * 6, now * 4, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(size);
      this.m.compose(this.p, this.q, this.s);
      if (n < 48) this.rocks.setMatrixAt(n++, this.m);
      this.trail(x, y, z, size, dt, 1.4);
    }
    this.rocks.count = n;
    this.rocks.instanceMatrix.needsUpdate = true;
    this.updateMother(mother, now, dt);
  }

  /** White-hot head, a long tail of flame, a rope of smoke and sparks. */
  private trail(x: number, y: number, z: number, size: number, dt: number, power: number, from = FROM, head = 1) {
    const len = from.length();
    const ux = from.x / len;
    const uy = from.y / len;
    const uz = from.z / len;
    // a glow around the head; on the mother meteor it stays small so the rock itself shows
    this.put(this.fire, x, y, z, 0, 0, 0, 0.08, size * 2.8 * head, head < 1 ? 0xff8a3a : 0xffd08a, 0, 0, 0);
    this.put(this.fire, x, y, z, 0, 0, 0, 0.08, size * 3.6 * head, 0xb8380c, 0, 0, 0);
    // the tail is long: flames are left all along the path, not only at the head
    for (let i = count(dt * 260 * power); i > 0; i--) {
      const back = Math.random() * size * 6;
      this.put(
        this.fire, x + ux * back + rand(-0.5, 0.5) * size, y + uy * back + rand(-0.5, 0.5) * size, z + uz * back + rand(-0.5, 0.5) * size,
        ux * rand(2, 6), uy * rand(2, 6), uz * rand(2, 6), rand(0.4, 0.8), rand(0.7, 1.3) * size, pick(FLAME), -0.5, 0, 1.5,
      );
    }
    for (let i = count(dt * 40 * power); i > 0; i--) {
      this.put(this.smoke, x + ux * size * 2, y + uy * size * 2, z + uz * size * 2, rand(-0.4, 0.4), rand(0.2, 1), rand(-0.4, 0.4), rand(1.4, 2.2), rand(0.6, 0.9) * size, pick(SMOKE), 1.8, 0, 0.8);
    }
    for (let i = count(dt * 30 * power); i > 0; i--) {
      this.put(this.fire, x, y, z, rand(-4, 4), rand(-2, 4), rand(-4, 4), rand(0.3, 0.6), 0.35, 0xffc060, 0, 9, 1);
    }
  }

  private updateMother(f: Fall | null, now: number, dt: number) {
    this.mother.visible = !!f;
    this.shadow.visible = !!f;
    if (!f) return;
    const t = Math.max(0, 1 - (f.hit - now) / f.dur);
    // a slow, heavy fall that speeds up at the end; it comes down steeply, so on the portrait
    // stream it hangs above the target for the whole five seconds, growing as it nears
    const k = 1 - Math.pow(t, 1.8);
    const size = f.r * 0.55;
    const x = f.x + MOTHER_FROM.x * k;
    const y = f.y + size + MOTHER_FROM.y * k;
    const z = f.z + MOTHER_FROM.z * k;
    this.mother.position.set(x, y, z);
    this.mother.rotation.set(now * 0.7, now * 0.4, 0);
    this.mother.scale.setScalar(size);
    this.motherHalo.scale.setScalar(1 + Math.sin(now * 9) * 0.06);
    this.trail(x, y, z, size, dt, 3, MOTHER_FROM, 0.42);
    // embers shed from the boulder all the way down
    if (Math.random() < dt * 30) this.put(this.fire, x + rand(-1, 1) * size, y + rand(-1, 1) * size, z + rand(-1, 1) * size, rand(-3, 3), rand(-6, -2), rand(-3, 3), rand(0.8, 1.4), rand(0.5, 0.9), pick(FLAME), -0.3, 4, 0.5);
    const shade = this.shadow.material as THREE.MeshBasicMaterial;
    shade.opacity = 0.15 + t * 0.5;
    this.shadow.position.set(f.x, f.y + 0.25, f.z);
    this.shadow.scale.setScalar(f.r * (0.6 + t * 0.9));
  }

  /** Far-off meteors crossing the sky above the field: they never land, they just burn out. */
  private updateStreaks(now: number, dt: number) {
    const d = this.doom;
    if (d && now > d.warnAt && now < d.end - 2) {
      for (let i = count(dt * 6); i > 0; i--) {
        const len = FROM.length();
        const sp = rand(70, 110);
        this.streaks.push({
          x: d.x + rand(-140, 140) + FROM.x * 0.6, y: rand(70, 120), z: d.z + rand(-140, 140) + FROM.z * 0.6,
          vx: (-FROM.x / len) * sp, vy: (-FROM.y / len) * sp * 0.55, vz: (-FROM.z / len) * sp, t0: now, life: rand(0.6, 1.2), size: rand(1.2, 2.4),
        });
      }
    }
    this.streaks = this.streaks.filter((s) => now - s.t0 < s.life);
    for (const s of this.streaks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      const fade = 1 - (now - s.t0) / s.life;
      this.put(this.fire, s.x, s.y, s.z, 0, 0, 0, 0.06, s.size * 2 * fade, 0xffe0a0, 0, 0, 0);
      for (let i = count(dt * 90); i > 0; i--) this.put(this.fire, s.x, s.y, s.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(0.25, 0.45), s.size * fade, pick(FLAME), -0.6, 0, 1);
    }
  }

  /** Columns of fire roaring out of the ground (hellfire, the mother meteor's crater). */
  private updateColumns(now: number, dt: number) {
    this.columns = this.columns.filter((c) => now < c.until);
    for (const c of this.columns) {
      const left = (c.until - now) / (c.until - c.t0);
      for (let i = count(dt * 140 * c.power * left); i > 0; i--) {
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * 1.6 * c.power;
        this.put(this.fire, c.x + Math.cos(a) * r, c.y + 0.3, c.z + Math.sin(a) * r, rand(-1, 1), rand(8, 16) * Math.sqrt(c.power), rand(-1, 1), rand(0.5, 0.9), rand(0.8, 1.5) * c.power * 0.7, pick(FLAME), 1.4, -2, 1.2);
      }
      if (Math.random() < dt * 10 * c.power) this.put(this.smoke, c.x + rand(-1, 1), c.y + rand(2, 6) * c.power, c.z + rand(-1, 1), rand(-0.5, 0.5), rand(3, 6), rand(-0.5, 0.5), rand(2, 3), rand(1, 2) * c.power, pick(SMOKE), 2, 0, 0.6);
    }
  }
}
