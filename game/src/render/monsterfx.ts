// Effects of the regional bosses and Naga Tengkorak, on top of their models (bosses/bosses.ts):
//   - Naga Tengkorak: a spiral of bone spikes bursting out of the ground in soul fire; its wail, a
//     green shock wave with ghost faces rising from it
//   - Raksasa Es: blocks of ice hurled in an arc that shatter and leave crystals holding the troops;
//     fists that burst into ice; a blizzard swirling around it
//   - Kraken: tentacle slams that throw up the sea, troops dragged off the beach, a wall of water
//     breaking over the shore, whirlpools where it dives and comes up
//   - Treant Purba: roots tearing up out of the ground in a line and holding troops; a cloud of
//     spores and falling petals when it blooms
//   - Cacing Pasir: sand spat in an arc, a moving hump of sand where it tunnels, the ground
//     shaking and caving in before it bursts out, a sandstorm while it stands
// The damage numbers come from the sim's impact events; the fire explosion of an ordinary meteor
// is not drawn for these (spellfx.ts skips styled impacts it does not own).
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { BossKind, Sim, SimEvent, StrikeStyle } from "../sim/world";
import { ParticlePool, type Fx } from "./fx";

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]) => list[(Math.random() * list.length) | 0];
const count = (perFrame: number) => Math.floor(perFrame) + (Math.random() < perFrame % 1 ? 1 : 0);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const SEA_Y = -0.25;

const SOUL = [0xc8ffe6, 0x6dffc0, 0x45f5a8, 0x1fbf7a] as const;
const ICE = [0xffffff, 0xd8f6ff, 0x9fe4ff, 0x5ac8ff] as const;
const SPORE = [0xf6ff9a, 0xc6ff5a, 0x8cff3a, 0xffe27a] as const;
const SAND = [0xe6cf98, 0xd8b878, 0xc49a5e, 0xa8804a] as const;
const WATER = [0xffffff, 0xe8fbff, 0xbff0ff, 0x7fd8f0] as const;

/** The styles drawn here (the rest belong to doomfx.ts and spellfx.ts). */
export const MONSTER_STYLES: readonly StrikeStyle[] = ["bone", "ice", "root", "wave", "sand"];

/** A thing growing out of the ground for a while: a bone spike, an ice crystal, a root. */
interface Prop {
  kind: "spike" | "crystal" | "root";
  x: number;
  y: number;
  z: number;
  t0: number;
  until: number;
  h: number;
  r: number;
  ry: number;
  tilt: number;
}

/** Something thrown by a boss: a block of ice, a gob of sand. */
interface Throw {
  kind: "ice" | "sand";
  fx: number;
  fy: number;
  fz: number;
  x: number;
  y: number;
  z: number;
  t0: number;
  hit: number;
  size: number;
}

/** A strike on its way: its warning ring pulses until it lands. */
interface Warn {
  style: StrikeStyle;
  x: number;
  z: number;
  r: number;
  hit: number;
  last: number;
}

/** A wall of water rolling from the Kraken to the shore. */
interface Crest {
  fx: number;
  fz: number;
  x: number;
  z: number;
  t0: number;
  hit: number;
}

/** A troop pulled off the beach into the sea. */
interface Drag {
  x: number;
  z: number;
  tx: number;
  tz: number;
  t0: number;
}

export class MonsterFx {
  readonly group = new THREE.Group();
  private light: ParticlePool;
  private mist: ParticlePool;
  private chips: ParticlePool;
  private spikes: THREE.InstancedMesh;
  private crystals: THREE.InstancedMesh;
  private roots: THREE.InstancedMesh;
  private blocks: THREE.InstancedMesh;
  private gobs: THREE.InstancedMesh;
  private hump: THREE.Mesh;
  private props: Prop[] = [];
  private throws: Throw[] = [];
  private warns: Warn[] = [];
  private crests: Crest[] = [];
  private drags: Drag[] = [];
  private now = 0;
  private c = new THREE.Color();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(
    private fx: Fx,
    private map: WorldMap,
  ) {
    const additive = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.light = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive, 2400, "color", map);
    this.mist = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      // a little light of its own, so snow and spray stay white under the warm daylight
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x3a4048, transparent: true, opacity: 0.6, depthWrite: false, flatShading: true }),
      1600,
      "shrink",
      map,
    );
    this.chips = new ParticlePool(new THREE.TetrahedronGeometry(0.25, 0), new THREE.MeshLambertMaterial({ flatShading: true }), 700, "shrink", map);

    const cone = (r: number, h: number, sides: number) => {
      const g = new THREE.ConeGeometry(r, h, sides, 1);
      g.translate(0, h / 2, 0);
      return g;
    };
    const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, cap: number) => {
      const mesh = new THREE.InstancedMesh(geo, mat, cap);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      return mesh;
    };
    // a bone spike: a long hooked point, pale bone with a greenish burn at the root
    this.spikes = instanced(cone(1, 1, 5), new THREE.MeshLambertMaterial({ color: 0xe3dccb, emissive: 0x0e3a26, flatShading: true }), 120);
    // an ice crystal: six-sided, glassy, lit from inside
    this.crystals = instanced(
      cone(1, 1, 6),
      new THREE.MeshLambertMaterial({ color: 0xbfeeff, emissive: 0x2a8cc0, emissiveIntensity: 0.55, transparent: true, opacity: 0.88, flatShading: true }),
      160,
    );
    // a root: a gnarled, bending point of bark
    const rootGeo = cone(1, 1, 5);
    const rp = rootGeo.getAttribute("position");
    for (let i = 0; i < rp.count; i++) rp.setZ(i, rp.getZ(i) + Math.pow(rp.getY(i), 2) * 0.9);
    rootGeo.computeVertexNormals();
    this.roots = instanced(rootGeo, new THREE.MeshLambertMaterial({ color: 0x4a3524, emissive: 0x1a2a05, flatShading: true }), 160);
    this.blocks = instanced(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0xcff4ff, emissive: 0x3aa0d8, emissiveIntensity: 0.5, transparent: true, opacity: 0.92, flatShading: true }),
      12,
    );
    this.gobs = instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xc49a5e, flatShading: true }), 16);
    // the moving hump of sand above the tunnelling worm
    this.hump = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xcaa26a, flatShading: true }));
    this.hump.visible = false;
    this.hump.receiveShadow = true;
    this.group.add(this.spikes, this.crystals, this.roots, this.blocks, this.gobs, this.hump, this.chips.mesh, this.mist.mesh, this.light.mesh);
  }

  reset() {
    this.props.length = 0;
    this.throws.length = 0;
    this.warns.length = 0;
    this.crests.length = 0;
    this.drags.length = 0;
    this.light.clear();
    this.mist.clear();
    this.chips.clear();
    this.hump.visible = false;
  }

  private ground(x: number, z: number) {
    return Math.max(SEA_Y, this.map.heightAt(x, z));
  }

  private put(pool: ParticlePool, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grow = 0, gravity = 0, drag = 1, delay = 0, bounce = false) {
    this.c.set(color);
    const k = rand(0.88, 1.08);
    pool.add({ x, y, z, vx, vy, vz, t0: this.now + delay, life, size, grow, gravity, drag, r: this.c.r * k, g: this.c.g * k, b: this.c.b * k, spin: rand(-5, 5), bounce });
  }

  /** Particles thrown out of a point in every direction. */
  private spray(pool: ParticlePool, x: number, y: number, z: number, n: number, colors: readonly number[], speed: number, up: number, life: number, size: number, grow = 0, gravity = 0, drag = 1, bounce = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * rand(0.3, 1);
      this.put(pool, x, y, z, Math.cos(a) * sp, up * rand(0.4, 1), Math.sin(a) * sp, life * rand(0.7, 1.2), size * rand(0.7, 1.3), pick(colors), grow, gravity, drag, 0, bounce);
    }
  }

  private grow(kind: Prop["kind"], x: number, z: number, h: number, r: number, seconds: number, tilt = rand(-0.25, 0.25), ry = rand(0, TAU)) {
    if (this.props.length > 420) this.props.shift();
    this.props.push({ kind, x, y: this.ground(x, z), z, t0: this.now, until: this.now + seconds, h, r, ry, tilt });
  }

  // ---------------------------------------------------------------- events

  onEvent(e: SimEvent, now: number, sim?: Sim) {
    this.now = now;
    switch (e.k) {
      case "strike":
        if (!e.style || !MONSTER_STYLES.includes(e.style)) break;
        this.warns.push({ style: e.style, x: e.x, z: e.z, r: e.r, hit: now + e.delay, last: -9 });
        if (e.style === "ice" || e.style === "sand") this.launch(e.style, e.x, e.z, e.r, now, now + e.delay, sim);
        break;
      case "impact":
        if (e.style && MONSTER_STYLES.includes(e.style)) this.impact(e.style, e.x, e.z, e.r, e.dmg);
        break;
      case "boss":
        this.bossAct(e.kind, e.act, e.x, e.z, e.r, e.fromX ?? e.x, e.fromZ ?? e.z, sim);
        break;
      case "phase":
        if (e.phase === "LOBBY") this.reset();
        break;
    }
  }

  /** Something thrown from the boss's hand or mouth, landing exactly when the sim's strike does. */
  private launch(kind: "ice" | "sand", x: number, z: number, r: number, now: number, hit: number, sim?: Sim) {
    const d = sim?.dragon;
    const from = kind === "ice" ? this.fx.bosses.socket("fistR", this.v) : this.fx.bosses.mouth(this.v);
    const fx = from ? this.v.x : (d?.x ?? x);
    const fy = from ? this.v.y : this.ground(x, z) + 12;
    const fz = from ? this.v.z : (d?.z ?? z);
    // the Yeti lets go when its arm comes over; the worm spits at once
    const t0 = kind === "ice" ? Math.min(hit - 0.4, now + 0.45) : now;
    this.throws.push({ kind, fx, fy, fz, x, y: this.ground(x, z), z, t0, hit, size: kind === "ice" ? r * 0.38 : r * 0.28 });
  }

  private impact(style: StrikeStyle, x: number, z: number, r: number, dmg: number) {
    const now = this.now;
    const g = this.ground(x, z);
    switch (style) {
      case "bone": {
        // a cluster of spikes bursts up, the biggest in the middle, soul fire pouring out round them
        this.grow("spike", x, z, r * 2.4, r * 0.55, 2.4, rand(-0.12, 0.12));
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + rand(-0.3, 0.3);
          const d = r * rand(0.45, 0.8);
          this.grow("spike", x + Math.cos(a) * d, z + Math.sin(a) * d, r * rand(1.1, 1.7), r * 0.35, 2.2, 0.35, -a + Math.PI / 2);
        }
        this.spray(this.light, x, g + 0.5, z, 22, SOUL, 5, 7, 0.8, 0.7, 0.6, -2, 1.5);
        this.spray(this.chips, x, g + 0.6, z, 12, [0xe3dccb, 0xb9ad94], 6, 9, 1.2, 0.8, 0, 18, 0.5, true);
        this.spray(this.mist, x, g + 0.4, z, 8, [0x3a4a40, 0x2a3530], 3, 2, 1.6, 1.1, 1.6, 0, 1.2);
        this.fx.ring(x, z, now, r * 2.2, 0x45f5a8, 0.5, g);
        this.fx.scorchMark(x, z, now, r, 0x0e2a1c);
        this.fx.onShake(0.25, x, z);
        break;
      }
      case "ice": {
        // the block shatters; crystals stay up through the freeze, frost spreads on the ground
        this.grow("crystal", x, z, r * 1.2, r * 0.32, 2.3, 0);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + rand(-0.2, 0.2);
          const d = r * rand(0.35, 0.85);
          this.grow("crystal", x + Math.cos(a) * d, z + Math.sin(a) * d, r * rand(0.45, 0.85), r * 0.18, 2.1, 0.5, -a + Math.PI / 2);
        }
        this.spray(this.chips, x, g + 1, z, 30, [0xd8f6ff, 0x9fe4ff, 0xffffff], 9, 9, 1.3, 1, 0, 18, 0.4, true);
        this.spray(this.light, x, g + 1, z, 26, ICE, 7, 3, 0.6, 0.8, 0.6, 0, 2);
        this.spray(this.mist, x, g + 0.5, z, 14, [0xf2f8ff, 0xdff0ff], 5, 1.5, 1.8, 1.4, 1.8, -0.3, 1.6);
        this.fx.ring(x, z, now, r * 2.4, 0x9fe4ff, 0.6, g);
        this.fx.ring(x, z, now, r * 1.2, 0xffffff, 0.3, g);
        this.fx.scorchMark(x, z, now, r * 1.2, 0xd8f0ff);
        this.fx.spells.onFlash(0.15, 0xcff4ff, x, z);
        this.fx.onShake(0.45, x, z);
        break;
      }
      case "root": {
        // roots tear up through the turf, bending over the troops they hold
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + rand(-0.4, 0.4);
          const d = r * rand(0.2, 0.7);
          this.grow("root", x + Math.cos(a) * d, z + Math.sin(a) * d, r * rand(1.1, 1.7), r * 0.28, 2.8, 0.5, -a - Math.PI / 2);
        }
        this.spray(this.chips, x, g + 0.4, z, 14, [0x4a3524, 0x6b5038, 0x3a2a1c], 5, 7, 1.1, 0.9, 0, 18, 0.5, true);
        this.spray(this.mist, x, g + 0.3, z, 8, [0x5c4c35, 0x6b5a40], 3, 1.5, 1.4, 1.2, 1.6, 0, 1.5);
        this.spray(this.light, x, g + 0.4, z, 8, SPORE, 2, 3, 0.9, 0.4, 0.4, -1, 1);
        this.fx.ring(x, z, now, r * 2, 0x8cff3a, 0.45, g);
        this.fx.scorchMark(x, z, now, r * 0.9, 0x2a2015);
        this.fx.onShake(0.2, x, z);
        break;
      }
      case "wave": {
        // the wall of water breaks: a fountain of spray, foam racing out, the ground left dark and wet
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * TAU;
          const sp = rand(2, 9);
          this.put(this.mist, x + rand(-1, 1) * r * 0.5, g + 0.5, z + rand(-1, 1) * r * 0.5, Math.cos(a) * sp, rand(6, 14), Math.sin(a) * sp, rand(0.9, 1.5), rand(0.7, 1.3), pick(WATER), 0.8, 16, 0.5);
        }
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          this.put(this.mist, x, g + 0.3, z, Math.cos(a) * rand(8, 12), 0.5, Math.sin(a) * rand(8, 12), 0.6, 0.6, 0xffffff, 1, 0, 3);
        }
        this.fx.ring(x, z, now, r * 2.2, 0xbff0ff, 0.6, g);
        this.fx.ring(x, z, now + 0.1, r * 1.5, 0xffffff, 0.45, g);
        this.fx.scorchMark(x, z, now, r * 1.1, 0x1a3040);
        this.fx.onShake(0.4, x, z);
        break;
      }
      case "sand": {
        this.spray(this.mist, x, g + 0.4, z, 22, SAND, 6, 4, 1.4, 1.1, 1.6, 2, 1.6);
        this.spray(this.chips, x, g + 0.6, z, 10, [0xc49a5e, 0x8d6636], 5, 6, 1, 0.7, 0, 18, 0.5, true);
        this.spray(this.light, x, g + 0.6, z, 8, [0xff8a2a, 0xffd36a], 4, 3, 0.4, 0.5, 0.6);
        this.fx.ring(x, z, now, r * 2, 0xe6cf98, 0.45, g);
        this.fx.scorchMark(x, z, now, r * 0.9, 0x5a4020);
        break;
      }
    }
    void dmg;
  }

  private bossAct(kind: BossKind, act: string, x: number, z: number, r: number, fromX: number, fromZ: number, sim?: Sim) {
    const now = this.now;
    const g = this.ground(x, z);
    switch (act) {
      case "wail": {
        // a scream you can see: rings of soul fire racing out, ghost faces climbing out of it
        for (let i = 0; i < 4; i++) this.fx.ring(x, z, now + i * 0.12, r * (0.6 + i * 0.3), i % 2 ? 0xc8ffe6 : 0x45f5a8, 0.8, g);
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * TAU;
          this.put(this.light, x, g + 1, z, Math.cos(a) * rand(14, 20), rand(0, 2), Math.sin(a) * rand(14, 20), rand(0.6, 0.9), rand(0.6, 1), pick(SOUL), 0.6, 0, 2.2);
        }
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * TAU;
          const d = rand(0.3, 1) * r;
          this.put(this.light, x + Math.cos(a) * d, this.ground(x + Math.cos(a) * d, z + Math.sin(a) * d) + 0.5, z + Math.sin(a) * d, 0, rand(3, 6), 0, rand(1.4, 2), rand(1.2, 1.8), 0x6dffc0, 0.8, -0.5, 0.6, i * 0.05);
        }
        this.fx.spells.onFlash(0.22, 0x6dffc0, x, z);
        this.fx.onShake(0.6, x, z);
        break;
      }
      case "spikes":
        // a sigil of soul fire under the castle, a moment before the bones break out
        for (let i = 0; i < 3; i++) this.fx.ring(x, z, now + i * 0.2, r * (1 - i * 0.25), 0x45f5a8, 0.9, g);
        break;
      case "blizzard":
        for (let i = 0; i < 3; i++) this.fx.ring(x, z, now + i * 0.15, r * (0.7 + i * 0.2), 0xd8f6ff, 0.9, g);
        this.spray(this.mist, x, g + 2, z, 40, [0xffffff, 0xeaf6ff], 16, 3, 1.8, 1.6, 1.4, 0, 1.2);
        this.fx.spells.onFlash(0.3, 0xeaf6ff, x, z);
        break;
      case "bloom":
        // petals and spores burst out; a column of green light where it heals
        this.spray(this.light, x, g + 6, z, 50, SPORE, 9, 4, 1.4, 0.6, 0.4, -0.5, 1.2);
        for (let i = 0; i < 30; i++) {
          this.c.set(pick([0xff9ac8, 0xffd2e6, 0xfff2a0]));
          const a = Math.random() * TAU;
          this.fx.debris.add({ x, y: g + rand(6, 10), z, vx: Math.cos(a) * rand(3, 8), vy: rand(1, 4), vz: Math.sin(a) * rand(3, 8), t0: now, life: rand(2, 3.5), size: rand(0.5, 0.8), grow: 0, gravity: 2, drag: 1.4, r: this.c.r, g: this.c.g, b: this.c.b, spin: rand(-5, 5), bounce: true });
        }
        for (let i = 0; i < 3; i++) this.fx.ring(x, z, now + i * 0.2, r * (0.5 + i * 0.25), 0xc6ff5a, 0.9, g);
        this.fx.spells.onFlash(0.25, 0xc6ff5a, x, z);
        break;
      case "roots":
        this.fx.ring(fromX, fromZ, now, 7, 0x8cff3a, 0.6, this.ground(fromX, fromZ));
        break;
      case "slam": {
        if (kind === "yeti") {
          this.spray(this.chips, x, g + 1, z, 34, [0xd8f6ff, 0x9fe4ff, 0xffffff], 10, 9, 1.3, 1.1, 0, 18, 0.4, true);
          this.spray(this.mist, x, g + 0.5, z, 24, [0xffffff, 0xeaf6ff], 9, 2, 1.8, 1.6, 1.6, 0, 1.6);
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + rand(-0.2, 0.2);
            const d = r * rand(0.4, 0.8);
            this.grow("crystal", x + Math.cos(a) * d, z + Math.sin(a) * d, r * rand(0.4, 0.7), r * 0.15, 2.1, 0.55, -a + Math.PI / 2);
          }
          this.fx.ring(x, z, now, r * 2.6, 0xd8f6ff, 0.6, g);
          this.fx.scorchMark(x, z, now, r * 1.1, 0xe0f4ff);
        } else if (kind === "treant") {
          this.spray(this.chips, x, g + 0.8, z, 26, [0x4a3524, 0x6b5038, 0x2c1f15], 9, 8, 1.2, 1, 0, 18, 0.5, true);
          this.spray(this.mist, x, g + 0.5, z, 20, [0x6b5a40, 0x5c4c35], 8, 2, 1.8, 1.5, 1.6, 0, 1.6);
          for (let i = 0; i < 12; i++) {
            this.c.set(pick([0x3f8a2e, 0x6fb53a, 0xb7a13a]));
            const a = Math.random() * TAU;
            this.fx.debris.add({ x, y: g + 4, z, vx: Math.cos(a) * rand(2, 6), vy: rand(1, 4), vz: Math.sin(a) * rand(2, 6), t0: now, life: rand(2, 3), size: rand(0.5, 0.8), grow: 0, gravity: 2, drag: 1.4, r: this.c.r, g: this.c.g, b: this.c.b, spin: rand(-5, 5), bounce: true });
          }
          this.fx.ring(x, z, now, r * 2.4, 0xd8ff7a, 0.55, g);
          this.fx.scorchMark(x, z, now, r, 0x2a2015);
        } else if (kind === "kraken") {
          // the tentacle comes down on the beach: sea water and sand thrown up together
          for (let i = 0; i < 36; i++) {
            const a = Math.random() * TAU;
            const sp = rand(3, 10);
            this.put(this.mist, x, g + 0.5, z, Math.cos(a) * sp, rand(5, 12), Math.sin(a) * sp, rand(0.9, 1.4), rand(0.6, 1.1), pick(WATER), 0.8, 16, 0.5);
          }
          this.spray(this.chips, x, g + 0.5, z, 12, [0xd8c8a0, 0x8a7d68], 7, 7, 1.1, 0.8, 0, 18, 0.5, true);
          this.fx.ring(x, z, now, r * 2.6, 0xbff0ff, 0.55, g);
          this.fx.scorchMark(x, z, now, r * 1.1, 0x1a3040);
        } else break;
        this.fx.onShake(0.6, x, z);
        break;
      }
      case "rampage":
        if (kind === "titan") break;
        // the parting blow: a huge burst in the boss's own colours on the leader's castle
        this.impact(kind === "yeti" ? "ice" : kind === "kraken" ? "wave" : kind === "treant" ? "root" : kind === "worm" ? "sand" : "bone", x, z, r, 0);
        this.impact(kind === "yeti" ? "ice" : kind === "kraken" ? "wave" : kind === "treant" ? "root" : kind === "worm" ? "sand" : "bone", x + 3, z - 2, r * 0.8, 0);
        this.fx.explosion(x, g + 2, z, now, 3, kind === "bone" ? 0x45f5a8 : kind === "yeti" ? 0x9fe4ff : kind === "treant" ? 0xb6ff4a : kind === "kraken" ? 0x38f2d6 : 0xd8b878);
        this.fx.onShake(1, x, z);
        break;
      case "grab": {
        // a splash where the tentacle closes, then the troop is hauled across the sand to the sea
        this.spray(this.mist, x, g + 0.5, z, 10, WATER, 4, 7, 0.9, 0.7, 0.8, 14, 0.6);
        this.fx.ring(x, z, now, 3.5, 0x38f2d6, 0.4, g);
        this.drags.push({ x, z, tx: fromX, tz: fromZ, t0: now });
        break;
      }
      case "waveCall":
        for (let i = 0; i < 4; i++) this.fx.ring(fromX, fromZ, now + i * 0.15, 10 + i * 6, 0xbff0ff, 1, SEA_Y);
        this.crests.push({ fx: fromX, fz: fromZ, x, z, t0: now, hit: now + 1.1 });
        break;
      case "dive":
      case "surface": {
        // a whirlpool where it goes down, a dome of spray where it comes up
        const up = act === "surface";
        for (let i = 0; i < 5; i++) this.fx.ring(x, z, now + i * 0.25, (up ? 10 : 18) - i * 2.5 + (up ? i * 5 : 0), 0xe8fbff, 1.2, SEA_Y);
        for (let i = 0; i < (up ? 70 : 40); i++) {
          const a = Math.random() * TAU;
          const d = rand(1, 7);
          this.put(this.mist, x + Math.cos(a) * d, SEA_Y + 0.4, z + Math.sin(a) * d, Math.cos(a) * rand(1, 5), rand(up ? 8 : 3, up ? 18 : 8), Math.sin(a) * rand(1, 5), rand(1, 1.8), rand(0.8, 1.5), pick(WATER), 0.8, 14, 0.4);
        }
        if (up) this.fx.onShake(0.5, x, z);
        break;
      }
      case "burrow":
        this.spray(this.mist, x, g + 1, z, 40, SAND, 8, 8, 1.8, 1.3, 1.6, 6, 1.2);
        this.spray(this.chips, x, g + 1, z, 20, [0xc49a5e, 0x8d6636], 7, 9, 1.2, 0.8, 0, 18, 0.5, true);
        this.fx.ring(x, z, now, 10, 0xe6cf98, 0.6, g);
        this.fx.scorchMark(x, z, now, 4, 0x6a4a24);
        break;
      case "eruptWindup":
        // the ground trembles and caves in; rings closing in on the spot
        for (let i = 0; i < 5; i++) this.fx.ring(x, z, now + i * 0.25, r * (1.3 - i * 0.18), i % 2 ? 0xffd36a : 0xe08a2a, 0.5, g);
        this.fx.scorchMark(x, z, now, r * 0.9, 0x4a3018);
        this.fx.onShake(0.35, x, z);
        break;
      case "erupt":
        this.spray(this.mist, x, g + 1, z, 70, SAND, 14, 14, 2, 1.6, 1.4, 8, 1);
        this.spray(this.chips, x, g + 1, z, 40, [0xc49a5e, 0x8d6636, 0x6b4a28], 12, 14, 1.6, 1, 0, 18, 0.4, true);
        this.spray(this.light, x, g + 1, z, 20, [0xff8a2a, 0xffd36a], 6, 8, 0.6, 0.8, 0.6);
        for (let i = 0; i < 3; i++) this.fx.ring(x, z, now + i * 0.1, r * (1.4 + i * 0.6), i ? 0xe6cf98 : 0xffffff, 0.7, g);
        this.fx.scorchMark(x, z, now, r * 1.2, 0x4a3018);
        this.fx.onShake(1, x, z);
        break;
    }
    void sim;
  }

  // ---------------------------------------------------------------- per frame

  update(sim: Sim, now: number, dt: number) {
    this.now = now;
    this.updateWarns(now);
    this.updateThrows(now, dt);
    this.updateCrests(now, dt);
    this.updateDrags(now, dt);
    this.updateAuras(sim, now, dt);
    this.updateProps(now);
    this.light.update(now, dt);
    this.mist.update(now, dt);
    this.chips.update(now, dt);
  }

  private updateWarns(now: number) {
    this.warns = this.warns.filter((w) => now < w.hit);
    for (const w of this.warns) {
      const left = w.hit - now;
      const every = Math.max(0.16, left * 0.25);
      if (now - w.last < every) continue;
      w.last = now;
      const color = w.style === "bone" ? 0x45f5a8 : w.style === "ice" ? 0x9fe4ff : w.style === "root" ? 0x8cff3a : w.style === "wave" ? 0xbff0ff : 0xe6a04a;
      this.fx.ring(w.x, w.z, now, w.r, color, Math.min(0.5, every * 1.4), this.ground(w.x, w.z));
      // roots and bones push the soil up before they break out
      if ((w.style === "root" || w.style === "bone") && left < 0.5) {
        const g = this.ground(w.x, w.z);
        this.put(this.chips, w.x + rand(-1, 1), g + 0.2, w.z + rand(-1, 1), rand(-1, 1), rand(2, 4), rand(-1, 1), 0.6, 0.5, w.style === "root" ? 0x5c4c35 : 0x3a4a40, 0, 16, 0.5, 0, true);
      }
    }
  }

  private updateThrows(now: number, dt: number) {
    this.throws = this.throws.filter((t) => now < t.hit);
    let ni = 0;
    let ns = 0;
    for (const t of this.throws) {
      if (now < t.t0) continue;
      const k = clamp01((now - t.t0) / (t.hit - t.t0));
      const d = Math.hypot(t.x - t.fx, t.z - t.fz);
      const x = t.fx + (t.x - t.fx) * k;
      const z = t.fz + (t.z - t.fz) * k;
      const y = t.fy + (t.y - t.fy) * k + Math.sin(k * Math.PI) * d * (t.kind === "ice" ? 0.32 : 0.18);
      this.p.set(x, y, z);
      this.e.set(now * 3, now * 2, 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(t.size);
      this.m.compose(this.p, this.q, this.s);
      if (t.kind === "ice") {
        if (ni < 12) this.blocks.setMatrixAt(ni++, this.m);
        // frost trailing behind the block
        for (let i = count(dt * 40); i > 0; i--) this.put(this.mist, x + rand(-1, 1) * t.size, y + rand(-1, 1) * t.size, z + rand(-1, 1) * t.size, 0, rand(-0.5, 0.5), 0, rand(0.5, 0.8), t.size * 0.6, pick([0xffffff, 0xd8f6ff]), 1, 0, 1);
        if (Math.random() < dt * 30) this.put(this.light, x, y, z, rand(-2, 2), rand(-2, 2), rand(-2, 2), 0.4, 0.5, 0x9fe4ff, 0.4);
      } else {
        if (ns < 16) this.gobs.setMatrixAt(ns++, this.m);
        for (let i = count(dt * 40); i > 0; i--) this.put(this.mist, x, y, z, rand(-1, 1), rand(-1, 0), rand(-1, 1), rand(0.4, 0.7), t.size * 0.7, pick(SAND), 1, 3, 1);
      }
    }
    this.blocks.count = ni;
    this.blocks.instanceMatrix.needsUpdate = true;
    this.gobs.count = ns;
    this.gobs.instanceMatrix.needsUpdate = true;
  }

  /** The wall of water: a band of spray running from the Kraken to where it will break. */
  private updateCrests(now: number, dt: number) {
    this.crests = this.crests.filter((c) => now < c.hit);
    for (const c of this.crests) {
      const k = clamp01((now - c.t0) / (c.hit - c.t0));
      const dx = c.x - c.fx;
      const dz = c.z - c.fz;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len;
      const pz = dx / len;
      const x = c.fx + dx * k;
      const z = c.fz + dz * k;
      const h = 2 + Math.sin(k * Math.PI) * 6;
      for (let i = count(dt * 220); i > 0; i--) {
        const side = rand(-1, 1) * 22;
        const sx = x + px * side;
        const sz = z + pz * side;
        this.put(this.mist, sx, Math.max(SEA_Y, this.map.heightAt(sx, sz)) + rand(0, h), sz, (dx / len) * rand(6, 10), rand(1, 4), (dz / len) * rand(6, 10), rand(0.4, 0.7), rand(0.8, 1.4), pick(WATER), 0.6, 8, 0.6);
      }
    }
  }

  /** Troops being dragged into the sea leave a trail of spray behind them. */
  private updateDrags(now: number, dt: number) {
    this.drags = this.drags.filter((d) => now - d.t0 < 0.9);
    for (const d of this.drags) {
      const k = clamp01((now - d.t0 - 0.3) / 0.6);
      const x = d.x + (d.tx - d.x) * k;
      const z = d.z + (d.tz - d.z) * k;
      for (let i = count(dt * 40); i > 0; i--) this.put(this.mist, x, this.ground(x, z) + 0.5, z, rand(-1, 1), rand(1, 3), rand(-1, 1), 0.5, 0.5, pick(WATER), 0.8, 6, 1);
    }
  }

  /** Areas that follow the boss (blizzard, spores, sandstorm) and the worm's tunnel. */
  private updateAuras(sim: Sim, now: number, dt: number) {
    const d = sim.dragon;
    this.hump.visible = false;
    if (!d) return;
    const g = this.ground(d.x, d.z);
    if (d.zone && d.zone.until > sim.t) {
      const r = d.zone.r;
      if (d.kind === "yeti") {
        // snow driving round in a circle, thick near the ground
        for (let i = count(dt * 340); i > 0; i--) {
          const a = Math.random() * TAU;
          const rr = Math.sqrt(Math.random()) * r;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          const sp = rand(10, 16);
          this.put(this.mist, x, this.ground(x, z) + rand(0.3, 8), z, -Math.sin(a) * sp, rand(-2, 0.5), Math.cos(a) * sp, rand(0.6, 1.1), rand(0.35, 0.75), pick([0xffffff, 0xeaf6ff, 0xd8ecff]), 0.5, 0, 0.4);
        }
        // glittering ice in the wind, and a low drift of snow along the ground
        for (let i = count(dt * 90); i > 0; i--) {
          const a = Math.random() * TAU;
          const rr = Math.sqrt(Math.random()) * r;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          this.put(this.light, x, this.ground(x, z) + rand(0.5, 7), z, -Math.sin(a) * 14, rand(-1, 0.5), Math.cos(a) * 14, rand(0.4, 0.7), rand(0.15, 0.3), pick(ICE), 0, 0, 0.3);
        }
        for (let i = count(dt * 40); i > 0; i--) {
          const a = Math.random() * TAU;
          const rr = rand(0.5, 1) * r;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          this.put(this.mist, x, this.ground(x, z) + 0.4, z, -Math.sin(a) * 8, 0.2, Math.cos(a) * 8, rand(1, 1.6), rand(1.2, 2), 0xf2f8ff, 1.2, 0, 0.6);
        }
        if (Math.random() < dt * 3) this.fx.ring(d.x, d.z, now, r, 0xd8f6ff, 0.8, g);
      } else if (d.kind === "treant") {
        for (let i = count(dt * 70); i > 0; i--) {
          const a = Math.random() * TAU;
          const rr = Math.sqrt(Math.random()) * r;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          this.put(this.light, x, this.ground(x, z) + rand(0.3, 4), z, rand(-0.6, 0.6), rand(0.2, 1.2), rand(-0.6, 0.6), rand(1.2, 2), rand(0.2, 0.4), pick(SPORE), 0.3, -0.2, 0.5);
        }
        if (Math.random() < dt * 2) this.fx.ring(d.x, d.z, now, r, 0x8cff3a, 0.9, g);
      } else if (d.kind === "worm" && !d.hidden) {
        // a low sandstorm whirling round the worm
        for (let i = count(dt * 90); i > 0; i--) {
          const a = Math.random() * TAU;
          const rr = rand(0.4, 1) * r;
          const x = d.x + Math.cos(a) * rr;
          const z = d.z + Math.sin(a) * rr;
          this.put(this.mist, x, this.ground(x, z) + rand(0.2, 3), z, -Math.sin(a) * 9, rand(0, 1), Math.cos(a) * 9, rand(0.7, 1.2), rand(0.4, 0.8), pick(SAND), 1, 0, 0.4);
        }
      }
    }
    if (d.kind === "worm" && d.hidden) {
      // the hump of sand rolling over the worm, cracks behind it, sand spouting off its back
      const moving = d.mode === 1;
      this.hump.visible = true;
      this.hump.position.set(d.x, g - 0.3, d.z);
      const pulse = moving ? 1 + Math.sin(now * 14) * 0.08 : 1.2 + Math.sin(now * 30) * 0.1;
      this.hump.scale.set(3.4 * pulse, (moving ? 1.3 : 1.8) * pulse, 3.4 * pulse);
      if (Math.random() < dt * (moving ? 40 : 60)) this.put(this.mist, d.x + rand(-2.5, 2.5), g + 0.5, d.z + rand(-2.5, 2.5), rand(-2, 2), rand(2, 6), rand(-2, 2), rand(0.8, 1.4), rand(0.6, 1.1), pick(SAND), 1.2, 6, 1);
      if (moving && Math.random() < dt * 8) this.fx.scorchMark(d.x, d.z, now, 2.6, 0x7a5a30);
      if (!moving && Math.random() < dt * 20) this.put(this.chips, d.x + rand(-4, 4), g + 0.2, d.z + rand(-4, 4), rand(-1, 1), rand(3, 6), rand(-1, 1), 0.8, 0.6, pick(SAND), 0, 16, 0.5, 0, true);
    }
    if (d.kind === "kraken" && d.hidden && Math.random() < dt * 6) this.fx.ring(d.x, d.z, now, rand(6, 14), 0xe8fbff, 1, SEA_Y);
  }

  /** Spikes, crystals and roots: burst up fast, stand, then sink back down. */
  private updateProps(now: number) {
    this.props = this.props.filter((p) => now < p.until);
    const n = { spike: 0, crystal: 0, root: 0 };
    for (const p of this.props) {
      const age = now - p.t0;
      const up = Math.min(1, age / 0.14);
      const down = clamp01((p.until - now) / 0.5);
      const h = p.h * up * (0.3 + 0.7 * down);
      this.p.set(p.x, p.y - 0.2 - (1 - down) * p.h * 0.3, p.z);
      this.e.set(p.tilt, p.ry, 0, "YXZ");
      this.q.setFromEuler(this.e);
      this.s.set(p.r * (0.6 + 0.4 * up), Math.max(0.01, h), p.r * (0.6 + 0.4 * up));
      this.m.compose(this.p, this.q, this.s);
      const mesh = p.kind === "spike" ? this.spikes : p.kind === "crystal" ? this.crystals : this.roots;
      const cap = p.kind === "spike" ? 120 : 160;
      if (n[p.kind] < cap) mesh.setMatrixAt(n[p.kind]++, this.m);
    }
    for (const [k, mesh] of [["spike", this.spikes], ["crystal", this.crystals], ["root", this.roots]] as const) {
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
