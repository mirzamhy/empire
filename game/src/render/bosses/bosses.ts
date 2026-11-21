// The world bosses on screen. Each is one model, animated here by hand from the sim's boss state
// and its moves (boss events):
//   - World Dragon: circles over the altar, turns to breathe (as before)
//   - Naga Purba: dives out of the sky on arrival, hovers high on slow ragged wingbeats, roars a
//     line of hellfire, crashes to the ground when it dies
//   - Naga Tengkorak: same flight as Naga Purba (same rig), but it climbs out of the dragon bones
//     wrapped in soul fire, and when it dies it falls apart into a rain of bones
//   - Titan, Raksasa Es, Treant Purba (one rig): rise out of the ground (the Yeti drops from the
//     peaks), walk with shaking steps, raise their arms and smash; the Yeti also throws ice
//   - Kraken: rises from the sea, waves its tentacles, slams and grabs with the two long arms,
//     dives and comes up somewhere else, sinks when it dies
//   - Cacing Pasir: arches out of the sand, spits, plunges back under, bursts up under a crowd
// Everything that is not the model itself (ice, roots, waves, bones, sand) is in monsterfx.ts.
import * as THREE from "three";
import type { WorldMap } from "../../sim/map";
import type { BossKind, Sim, SimEvent } from "../../sim/world";
import { modelFor } from "../units/rig";
import type { Fx } from "../fx";
import { ParticlePool } from "../fx";
import { buildElder } from "./elder";
import { buildTitan, type BossModel } from "./titan";
import { buildBoneDragon } from "./bone";
import { buildYeti } from "./yeti";
import { buildTreant } from "./treant";
import { buildKraken, KRAKEN_ARMS, KRAKEN_SEGS } from "./kraken";
import { buildWorm, WORM_SEGS } from "./worm";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Angle difference folded to -PI..PI. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** The sea's surface (terrain.ts). */
const SEA_Y = -0.25;

interface Look {
  model: BossModel;
  scale: number;
  /** base colours of the self-lit parts, for the pulse */
  base: THREE.Color[];
}

/** A move being played: started at t0, the blow lands at hit. */
interface Move {
  act: "slam" | "quake" | "roar" | "inferno" | "throw" | "strike" | "grab" | "spit";
  t0: number;
  hit: number;
  /** where the blow is aimed (Kraken arms, the worm's spit) */
  x?: number;
  z?: number;
}

/** A boss leaving the stage after the sim let go of it. */
interface Exit {
  kind: BossKind;
  how: "dead" | "leave";
  t0: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Fire, smoke and step colours of each walking boss. */
const WALKER = {
  titan: { ring: 0xff3b1f, ring2: 0xff6a2a, step: 0xd8c8a8, dust: 0x7d7064, debris: 0x3a3236 },
  yeti: { ring: 0x5ad8ff, ring2: 0xbff6ff, step: 0xe8f6ff, dust: 0xdfeaf2, debris: 0xbfe6ff },
  treant: { ring: 0x8cff3a, ring2: 0xd8ff7a, step: 0xa89270, dust: 0x6b5a40, debris: 0x4a3524 },
} as const;
type WalkerKind = keyof typeof WALKER;
const isWalker = (k: BossKind): k is WalkerKind => k === "titan" || k === "yeti" || k === "treant";

export class BossRenderer {
  readonly group = new THREE.Group();
  private looks: Record<BossKind, Look>;
  private embers: ParticlePool;
  private smoke: ParticlePool;

  private kind: BossKind | null = null;
  private spawnAt = -99;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private aimYaw = 0;
  private breathUntil = -9;
  private move: Move | null = null;
  private exit: Exit | null = null;
  private walk = 0;
  private lastStep = 0;
  /** Kraken and worm: when it went under / came up (the sim says hidden; this is for the motion) */
  private sinkAt = -99;
  private riseAt = -99;
  private c = new THREE.Color();
  private v = new THREE.Vector3();

  constructor(
    private fx: Fx,
    private map: WorldMap,
  ) {
    const dragon = modelFor("dragon", 3, "#d4a017", "#facc15");
    const dragonLook: BossModel = { root: dragon.root, bones: dragon.bones as Record<string, THREE.Object3D>, sockets: dragon.sockets as Record<string, THREE.Object3D>, glows: [] };
    const make = (model: BossModel, scale: number): Look => {
      model.root.scale.setScalar(scale);
      model.root.visible = false;
      // turn first, then pitch and roll around the boss's own axes (dives, falls)
      model.root.rotation.order = "YXZ";
      model.root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      this.group.add(model.root);
      return { model, scale, base: model.glows.map((m) => m.color.clone()) };
    };
    this.looks = {
      dragon: make(dragonLook, 2.6),
      elder: make(buildElder(), 3.6),
      titan: make(buildTitan(), 3.4),
      bone: make(buildBoneDragon(), 3.5),
      yeti: make(buildYeti(), 3.5),
      treant: make(buildTreant(), 3.7),
      kraken: make(buildKraken(), 3.4),
      worm: make(buildWorm(), 3.3),
    };
    const additive = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.embers = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive, 900, "color", map);
    this.smoke = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }),
      500,
      "shrink",
      map,
    );
    this.group.add(this.embers.mesh, this.smoke.mesh);
  }

  /** The kind on stage, for the effects that follow it. */
  get active(): BossKind | null {
    return this.kind;
  }

  /** World position of the active boss's mouth, for its fire. */
  mouth(out: THREE.Vector3): boolean {
    return this.socket("mouth", out);
  }

  /** World position of one of the active boss's sockets. */
  socket(name: string, out: THREE.Vector3): boolean {
    const look = this.kind ? this.looks[this.kind] : null;
    const m = look?.model.sockets[name];
    if (!look || !m || !look.model.root.visible) return false;
    look.model.root.updateMatrixWorld(true);
    m.getWorldPosition(out);
    return true;
  }

  /** The boss breathes toward (x, z) for a moment. */
  aim(fromX: number, fromZ: number, x: number, z: number, now: number) {
    this.aimYaw = Math.atan2(x - fromX, z - fromZ);
    this.breathUntil = now + (this.kind === "elder" || this.kind === "bone" ? 0.9 : 0.65);
  }

  /** How big the breath stream of the active boss is. */
  get breathScale() {
    return this.kind === "elder" || this.kind === "bone" ? 3.4 : 2.2;
  }

  /** Colours of the breath, hottest first: fire, or the soul fire of Naga Tengkorak. */
  get breathPalette(): [number, number, number] {
    return this.kind === "bone" ? [0xd8fff0, 0x5dffb0, 0x16a870] : [0xfff0a0, 0xffb030, 0xff5a1a];
  }

  private ground(x: number, z: number) {
    return Math.max(this.map.heightAt(x, z), -0.6);
  }

  // ---------------------------------------------------------------- events

  onEvent(e: SimEvent, now: number) {
    if (e.k === "dragon") {
      if (e.state === "spawn") {
        this.exit = null;
        this.hideAll();
        this.kind = e.kind;
        this.spawnAt = now;
        this.x = e.x;
        this.z = e.z;
        this.move = null;
        this.sinkAt = this.riseAt = -99;
        this.arrive(e.kind, e.x, e.z, now);
      } else if (this.kind) {
        const root = this.looks[this.kind].model.root;
        this.exit = { kind: this.kind, how: e.state === "dead" ? "dead" : "leave", t0: now, x: this.x, y: root.position.y, z: this.z, yaw: this.yaw };
        this.kind = null;
        if (e.state === "dead") {
          const color = e.kind === "bone" ? 0x5dffb0 : e.kind === "yeti" ? 0x9fe4ff : e.kind === "treant" ? 0xb6ff4a : e.kind === "kraken" ? 0x38f2d6 : 0xff5a1a;
          this.fx.explosion(this.x, root.position.y + 3, this.z, now, e.kind === "dragon" ? 2.2 : 3.5, color);
        }
      }
      return;
    }
    if (e.k !== "boss" || e.kind !== this.kind) return;
    const g = this.ground(e.x, e.z);
    const w = isWalker(e.kind) ? WALKER[e.kind] : WALKER.titan;
    switch (e.act) {
      case "roar":
      case "blizzard":
      case "bloom":
      case "wail":
      case "waveCall":
        this.move = { act: "roar", t0: now, hit: now + (e.act === "roar" ? 2.2 : 1.2) };
        break;
      case "windup":
        this.move = { act: "slam", t0: now, hit: now + (e.kind === "yeti" ? 0.75 : e.kind === "treant" ? 0.8 : 0.7) };
        // a ring marks where the blow will land
        this.fx.ring(e.x, e.z, now, e.r, w.ring, 0.75, g);
        this.fx.ring(e.x, e.z, now + 0.35, e.r * 0.6, w.ring2, 0.4, g);
        break;
      case "quakeWindup":
        this.move = { act: "quake", t0: now, hit: now + 1.1 };
        for (let i = 0; i < 3; i++) this.fx.ring(e.x, e.z, now + i * 0.3, e.r, 0xff3b1f, 0.5, g);
        break;
      case "roots":
        // both branch arms are driven into the ground
        this.move = { act: "quake", t0: now, hit: now + 0.45 };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 1.2;
        break;
      case "throw":
        this.move = { act: "throw", t0: now, hit: now + 0.45, x: e.x, z: e.z };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 1;
        break;
      case "spikes":
        this.move = { act: "inferno", t0: now, hit: now + 0.5 };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 1.4;
        break;
      case "slam":
        if (e.kind === "titan") this.slam(e.x, e.z, e.r, now, 1);
        break;
      case "quake":
        this.quake(e.x, e.z, e.r, now);
        break;
      case "rampage":
        this.move = { act: "slam", t0: now - 0.6, hit: now };
        if (e.kind === "titan") this.slam(e.x, e.z, e.r, now, 2);
        break;
      case "inferno":
        this.move = { act: "inferno", t0: now, hit: now + 0.5 };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 2.2;
        break;
      case "tentacleWindup":
        this.move = { act: "strike", t0: now, hit: now + 0.9, x: e.x, z: e.z };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 1.4;
        this.fx.ring(e.x, e.z, now, e.r, 0x38f2d6, 0.9, g);
        this.fx.ring(e.x, e.z, now + 0.45, e.r * 0.6, 0xbffcff, 0.45, g);
        break;
      case "grab":
        if (!this.move || this.move.act !== "grab") this.move = { act: "grab", t0: now, hit: now + 0.35, x: e.x, z: e.z };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 1;
        break;
      case "spit":
        this.move = { act: "spit", t0: now, hit: now + 0.3, x: e.x, z: e.z };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 0.9;
        break;
      case "dive":
      case "burrow":
        this.sinkAt = now;
        this.move = null;
        break;
      case "surface":
        this.riseAt = now;
        this.x = e.x;
        this.z = e.z;
        break;
      case "erupt":
        this.riseAt = now;
        this.x = e.x;
        this.z = e.z;
        this.move = null;
        break;
    }
  }

  private hideAll() {
    for (const l of Object.values(this.looks)) l.model.root.visible = false;
  }

  /** Entrances: out of the ground, out of the clouds, out of the sea, off the peaks. */
  private arrive(kind: BossKind, x: number, z: number, now: number) {
    const g = this.ground(x, z);
    if (kind === "titan" || kind === "treant") {
      const lava = kind === "titan";
      this.fx.ring(x, z, now, 26, lava ? 0xff5a1a : 0x8cff3a, 1.4, g);
      this.fx.ring(x, z, now + 0.4, 18, lava ? 0xffb040 : 0xe6ff9a, 1.2, g);
      this.fx.scorchMark(x, z, now, 11, lava ? 0x1a0d08 : 0x1d1a0c);
      for (let i = 0; i < 4; i++) this.fx.burst(this.fx.debris, x, g + 1, z, now + i * 0.5, 22, lava ? 0x3a3236 : 0x4a3524, 10, 2.2, 2.2, 1.5, 18);
      for (let i = 0; i < 6; i++) this.fx.burst(this.fx.dust, x, g + 1, z, now + i * 0.4, 14, lava ? 0x5a4d44 : 0x5c4c35, 9, 2.6, 3, 0.4, -0.3);
      this.fx.onShake(1, x, z);
    } else if (kind === "elder") {
      // the sky darkens around a column of fire where it will land
      for (let i = 0; i < 5; i++) this.fx.ring(x, z, now + i * 0.6, 30 - i * 4, 0xff3b1f, 1.0, g);
    } else if (kind === "bone") {
      for (let i = 0; i < 5; i++) this.fx.ring(x, z, now + i * 0.5, 34 - i * 5, 0x45f5a8, 1.1, g);
      for (let i = 0; i < 4; i++) this.fx.burst(this.fx.debris, x, g + 1, z, now + i * 0.6, 18, 0xe3dccb, 8, 1.6, 2.0, 1.6, 16);
      this.fx.onShake(0.8, x, z);
    } else if (kind === "yeti") {
      // it leaps down from the peaks: the shadow first, then snow thrown everywhere on landing
      for (let i = 0; i < 4; i++) this.fx.ring(x, z, now + i * 0.35, 20 - i * 3, 0x9fe4ff, 0.7, g);
    } else if (kind === "kraken") {
      for (let i = 0; i < 4; i++) this.fx.ring(x, z, now + i * 0.5, 10 + i * 5, 0xbff8ff, 1.1, SEA_Y);
    }
  }

  // ---------------------------------------------------------------- moves

  private slam(x: number, z: number, r: number, now: number, power: number) {
    const g = this.ground(x, z);
    this.fx.explosion(x, g + 1.2, z, now, 1.6 * power, 0xff6a2a);
    this.fx.ring(x, z, now, r * 2.4 * power, 0xffd08a, 0.55, g);
    this.fx.ring(x, z, now, r * 1.4, 0xffffff, 0.35, g);
    this.fx.burst(this.fx.debris, x, g + 0.8, z, now, Math.round(26 * power), 0x3e3638, 9 * power, 1.6, 1.8, 1.6, 18);
    this.fx.burst(this.fx.dust, x, g + 0.5, z, now, Math.round(16 * power), 0x7d7064, 7 * power, 2.0, 2.2, 0.35, -0.3);
    this.fx.scorchMark(x, z, now, r * 0.9, 0x1a120d);
    // cracks of lava spreading out from the blow
    for (let i = 0; i < 9 * power; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(5, 12) * power;
      this.c.set(Math.random() < 0.5 ? 0xff5a14 : 0xffb040);
      this.embers.add({
        x, y: g + 0.3, z, vx: Math.cos(a) * sp, vy: rand(0.5, 3), vz: Math.sin(a) * sp, t0: now, life: rand(0.5, 0.9), size: rand(0.5, 0.9),
        grow: 0.4, gravity: 6, drag: 2.5, r: this.c.r, g: this.c.g, b: this.c.b, spin: 3, bounce: true,
      });
    }
    this.fx.onShake(0.6 * power, x, z);
  }

  private quake(x: number, z: number, r: number, now: number) {
    const g = this.ground(x, z);
    for (let i = 0; i < 4; i++) this.fx.ring(x, z, now + i * 0.12, r * (0.7 + i * 0.25), i % 2 ? 0xffd08a : 0xff5a1a, 0.7, g);
    // the ground heaves: stones and dust thrown up all over the circle
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const d = rand(0.3, 1) * r;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const py = this.ground(px, pz);
      this.fx.burst(this.fx.debris, px, py + 0.3, pz, now + d * 0.02, 3, 0x4a4040, 4, 1.1, 1.3, 2.5, 18);
      this.fx.burst(this.fx.dust, px, py + 0.3, pz, now + d * 0.02, 2, 0x8a7d70, 3, 1.4, 1.8, 0.4, -0.3);
    }
    this.fx.onShake(1, x, z);
  }

  // ---------------------------------------------------------------- per frame

  update(sim: Sim, now: number, dt: number) {
    this.embers.update(now, dt);
    this.smoke.update(now, dt);
    this.updateExit(now);
    const d = sim.dragon;
    if (!d || !this.kind) {
      if (!this.exit) this.hideAll();
      return;
    }
    if (d.kind !== this.kind) {
      // a boss that was already there when the renderer started (or after a reset)
      this.hideAll();
      this.kind = d.kind;
      this.spawnAt = now - 10;
    }
    const look = this.looks[this.kind];
    look.model.root.visible = true;
    // the sim moves in steps; the model glides after it (a Kraken that came up elsewhere jumps there)
    const k = 1 - Math.exp(-dt * 6);
    if (Math.hypot(d.x - this.x, d.z - this.z) > 30) {
      this.x = d.x;
      this.z = d.z;
    }
    const mx = d.x - this.x;
    const mz = d.z - this.z;
    this.x += mx * k;
    this.z += mz * k;
    const speed = (Math.hypot(mx, mz) * k) / Math.max(dt, 1e-3);
    const breathing = now < this.breathUntil;
    const want = breathing ? this.aimYaw : speed > 0.3 ? Math.atan2(mx, mz) : Math.atan2(d.tx - d.x, d.tz - d.z);
    this.yaw += turn(this.yaw, want) * Math.min(1, dt * (breathing ? 8 : 2.5));
    switch (this.kind) {
      case "dragon": this.animDragon(look, d, now, dt, breathing); break;
      case "elder":
      case "bone": this.animElder(look, now, dt, breathing); break;
      case "kraken": this.animKraken(look, d, now, dt); break;
      case "worm": this.animWorm(look, d, now, dt); break;
      default: this.animWalker(look, this.kind as WalkerKind, now, dt, speed);
    }
    // the self-lit parts throb like a heartbeat
    const pulse = 0.82 + 0.18 * Math.sin(now * 3.1) + (now - d.attackAt < 0.3 ? 0.25 : 0);
    look.model.glows.forEach((m, i) => m.color.copy(look.base[i]).multiplyScalar(pulse));
  }

  private animDragon(look: Look, d: { attackAt: number }, now: number, dt: number, breathing: boolean) {
    const b = look.model.bones;
    const root = look.model.root;
    const flap = Math.sin(now * 4) * 0.5;
    b.wingR.rotation.z = -flap;
    b.wingL.rotation.z = flap;
    if (!breathing) this.yaw += dt * 0.5;
    root.position.set(this.x, this.ground(this.x, this.z) + 4 + Math.sin(now * 4) * 0.4, this.z);
    root.rotation.y = this.yaw;
    const open = breathing ? 1 : 0;
    b.jaw.rotation.x += (open * 0.6 - b.jaw.rotation.x) * Math.min(1, dt * 14);
    b.neck1.rotation.x += (-0.95 + open * 0.75 - b.neck1.rotation.x) * Math.min(1, dt * 10);
    const hit = now - d.attackAt;
    root.scale.setScalar(look.scale + (hit >= 0 && hit < 0.3 ? 0.15 : 0));
    if (Math.random() < dt * 6) this.fx.burst(this.fx.glow, this.x, root.position.y + 1.5, this.z, now, 1, 0xff5a1a, 0.6, 0.4, 0.6, 1, -1.5);
  }

  /** Naga Purba and Naga Tengkorak: the same body, the same wings. */
  private animElder(look: Look, now: number, dt: number, breathing: boolean) {
    const b = look.model.bones;
    const root = look.model.root;
    const bone = this.kind === "bone";
    const g = this.ground(this.x, this.z);
    const since = now - this.spawnAt;
    const hover = 10 + Math.sin(now * 1.3) * 0.8;
    // arrival: Naga Purba dives from high above; Naga Tengkorak climbs slowly out of the bones,
    // wings folded, then spreads them and rises
    const dive = bone ? 0 : 1 - smooth(since / 3.2);
    const climb = bone ? 1 - smooth(since / 4) : 0;
    root.position.set(this.x - dive * 40, g + hover * (1 - climb) + dive * 90 - climb * 3, this.z - dive * 25);
    root.rotation.set(dive * 0.6 - climb * 0.6, this.yaw, 0);
    if (!bone && since > 2.9 && since < 2.9 + dt * 1.5) {
      // the landing wind: a ring of dust flattening everything below
      this.fx.ring(this.x, this.z, now, 34, 0xffd08a, 0.9, g);
      for (let i = 0; i < 3; i++) this.fx.burst(this.fx.dust, this.x, g + 0.5, this.z, now + i * 0.15, 18, 0x8d8072, 12, 2.2, 2.4, 0.15, -0.2);
      this.fx.onShake(0.9, this.x, this.z);
    }
    if (bone && climb > 0 && Math.random() < dt * 30) {
      // soul fire pouring off it as it climbs out of the grave
      this.puff(this.embers, this.x + rand(-5, 5), g + rand(0, 6), this.z + rand(-5, 5), Math.random() < 0.5 ? 0x45f5a8 : 0x2bd48a, 1.2, 4);
      if (Math.random() < 0.3) this.fx.burst(this.fx.debris, this.x + rand(-4, 4), g + 0.4, this.z + rand(-4, 4), now, 2, 0xd8cfbb, 3, 0.9, 1.2, 1.5, 14);
    }
    // slow, heavy wingbeats; the outer wing trails behind the inner one
    const folded = Math.max(dive > 0.05 ? 1 : 0, climb);
    const beat = now * (folded > 0.05 ? 1.2 : 2.1);
    const flap = Math.sin(beat) * (folded > 0.05 ? 0.15 : 0.62);
    b.wingR.rotation.z = -0.15 - flap - folded * 0.5;
    b.wingL.rotation.z = 0.15 + flap + folded * 0.5;
    b.wingR2.rotation.z = -Math.sin(beat - 0.7) * 0.4;
    b.wingL2.rotation.z = Math.sin(beat - 0.7) * 0.4;
    b.wingR.rotation.y = folded * 0.7;
    b.wingL.rotation.y = -folded * 0.7;
    // each downbeat pushes the body up a little
    root.position.y += Math.cos(beat) * 0.5 * (1 - folded);
    // neck: a slow sway; reaching down and forward while it breathes; thrown back to roar
    const roar = this.move && this.move.act !== "slam" && this.move.act !== "quake" ? clamp01((now - this.move.t0) / 0.4) * clamp01((this.move.hit + 0.6 - now) / 0.5) : 0;
    if (this.move && now > this.move.hit + 1.2) this.move = null;
    const open = Math.max(breathing ? 1 : 0, roar);
    const neckTo = -0.8 + Math.sin(now * 0.9) * 0.08 + (breathing ? 0.55 : 0) - roar * 0.35;
    b.neck1.rotation.x += (neckTo - b.neck1.rotation.x) * Math.min(1, dt * 6);
    b.neck2.rotation.x = 0.25 + Math.sin(now * 0.9 - 0.6) * 0.06;
    b.neck3.rotation.x = 0.25 + Math.sin(now * 0.9 - 1.2) * 0.06 - roar * 0.3;
    b.neck1.rotation.y = Math.sin(now * 0.6) * 0.12;
    b.jaw.rotation.x += (open * 0.75 - b.jaw.rotation.x) * Math.min(1, dt * 10);
    // tail: a wave travelling down to the blade
    ["tail1", "tail2", "tail3", "tail4"].forEach((n, i) => {
      b[n].rotation.y = Math.sin(now * 1.4 - i * 0.7) * (0.14 + i * 0.05);
    });
    // claws hang and pedal a little
    b.armR.rotation.x = 0.5 + Math.sin(now * 1.3) * 0.12;
    b.armL.rotation.x = 0.5 + Math.sin(now * 1.3 + 1) * 0.12;
    b.legR.rotation.x = 0.7 + Math.sin(now * 1.1) * 0.08;
    b.legL.rotation.x = 0.7 + Math.sin(now * 1.1 + 1.4) * 0.08;
    if (bone) {
      // ghost fire streams back from the ribcage and the skull, bone dust trickles down
      if (this.socket("chest", this.v) && Math.random() < dt * 22) this.puff(this.embers, this.v.x + rand(-1, 1), this.v.y + rand(-1, 1), this.v.z + rand(-1, 1), Math.random() < 0.6 ? 0x45f5a8 : 0xc8ffe6, 1.0, 2.5);
      if (this.mouth(this.v) && Math.random() < dt * 8) this.puff(this.smoke, this.v.x, this.v.y + 0.5, this.v.z, 0x1d3a30, 1.1, 1.2);
      if (Math.random() < dt * 4) this.fx.burst(this.fx.debris, this.x + rand(-2, 2), root.position.y - 2, this.z + rand(-2, 2), now, 1, 0xd8cfbb, 1, 0.5, 1.6, 0, 14);
      return;
    }
    // smoke from the nostrils, magma dripping from the chest
    if (this.mouth(this.v)) {
      if (Math.random() < dt * 8) this.puff(this.smoke, this.v.x, this.v.y + 0.5, this.v.z, 0x2a2224, 1.2, 1.5);
    }
    if (Math.random() < dt * 5) {
      this.c.set(0xff6a1a);
      this.embers.add({
        x: this.x + rand(-1.5, 1.5), y: root.position.y + 4, z: this.z + rand(-1.5, 1.5), vx: 0, vy: -2, vz: 0, t0: now, life: 1.6, size: rand(0.4, 0.7),
        grow: -0.4, gravity: 9, drag: 0.2, r: this.c.r, g: this.c.g, b: this.c.b, spin: 2, bounce: true,
      });
    }
  }

  /** Titan, Raksasa Es and Treant Purba: one rig, one walk, each with its own blows and breath. */
  private animWalker(look: Look, kind: WalkerKind, now: number, dt: number, speed: number) {
    const b = look.model.bones;
    const root = look.model.root;
    const g = this.ground(this.x, this.z);
    const col = WALKER[kind];
    const since = now - this.spawnAt;
    let rise = 1;
    if (kind === "yeti") {
      // arrival: a leap down from high on the mountain, landing in a burst of snow
      const t = clamp01(since / 1.6);
      const air = 1 - t;
      root.position.set(this.x - air * 30, g + air * air * 60, this.z - air * 20);
      root.rotation.y = this.yaw;
      if (since > 1.55 && since < 1.55 + dt * 1.5) {
        this.fx.ring(this.x, this.z, now, 30, 0xe8f6ff, 1.1, g);
        this.fx.ring(this.x, this.z, now, 16, 0x9fe4ff, 0.7, g);
        for (let i = 0; i < 4; i++) this.fx.burst(this.fx.dust, this.x, g + 0.6, this.z, now + i * 0.12, 22, 0xf2f8ff, 12, 2.4, 2.6, 0.3, -0.2);
        this.fx.burst(this.fx.debris, this.x, g + 1, this.z, now, 30, 0xbfe6ff, 10, 1.6, 2, 1.6, 18);
        this.fx.onShake(1, this.x, this.z);
        this.move = { act: "roar", t0: now, hit: now + 1.6 };
      }
    } else {
      // arrival: climbs out of the ground over three seconds, shaking
      rise = smooth(since / 3);
      const shake = rise < 1 ? Math.sin(now * 40) * 0.25 * (1 - rise) : 0;
      root.position.set(this.x + shake, g - (1 - rise) * 16, this.z);
      root.rotation.y = this.yaw;
      if (rise < 1 && Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2;
        this.fx.burst(this.fx.debris, this.x + Math.cos(a) * 5, g + 0.5, this.z + Math.sin(a) * 5, now, 2, col.debris, 5, 1.4, 1.5, 2, 18);
        if (kind === "titan") this.puff(this.embers, this.x + Math.cos(a) * 4, g + 0.3, this.z + Math.sin(a) * 4, 0xff5a14, 0.8, 4);
        else this.fx.burst(this.fx.debris, this.x + Math.cos(a) * 4, g + 2, this.z + Math.sin(a) * 4, now, 2, 0x4f8a2e, 3, 0.8, 2, 0.5, 4);
      }
    }

    // walking: legs swing, knees bend on the way forward, the body rolls from foot to foot
    const walking = speed > 0.25 && rise >= 1;
    this.walk += dt * (walking ? (kind === "treant" ? 1.8 : 2.4) : 0);
    const w = this.walk;
    const amp = walking ? 0.42 : 0;
    const legTo = (n: string, v: number) => (b[n].rotation.x += (v - b[n].rotation.x) * Math.min(1, dt * 8));
    legTo("legR", Math.sin(w) * amp);
    legTo("legL", -Math.sin(w) * amp);
    legTo("legR2", Math.max(0, -Math.sin(w)) * amp * 1.4);
    legTo("legL2", Math.max(0, Math.sin(w)) * amp * 1.4);
    root.position.y += walking ? Math.abs(Math.cos(w)) * 0.35 : 0;
    b.hips.rotation.z = walking ? Math.sin(w) * 0.06 : 0;
    // a heavy step lands every half cycle: dust (or snow, or dirt), a ring, a small shake
    const step = Math.floor(w / Math.PI);
    if (walking && step !== this.lastStep) {
      this.lastStep = step;
      const side = step % 2 ? 1 : -1;
      const fx = this.x + Math.cos(this.yaw) * side * 1.7;
      const fz = this.z - Math.sin(this.yaw) * side * 1.7;
      this.fx.ring(fx, fz, now, 6, col.step, 0.5);
      this.fx.burst(this.fx.dust, fx, this.ground(fx, fz) + 0.3, fz, now, 6, col.dust, 3.5, 1.6, 1.4, 0.3, -0.3);
      this.fx.onShake(0.25, fx, fz);
      if (kind === "yeti") this.fx.scorchMark(fx, fz, now, 1.6, 0xeaf6ff);
    }

    // moves: raise the arms and smash; throw; roar
    const m = this.move;
    const yeti = kind === "yeti";
    // the Yeti carries its fists low, nearly on the ground, like a great ape
    const restR = yeti ? -0.05 : kind === "treant" ? 0.05 : -0.2;
    const restL = yeti ? -0.05 : 0.25;
    let armR = restR + (walking ? -Math.sin(w) * 0.2 : Math.sin(now * 1.2) * 0.05);
    let armL = restL + (walking ? Math.sin(w) * 0.25 : Math.sin(now * 1.2 + 1) * 0.05);
    let lean = (yeti ? 0.45 : kind === "treant" ? 0.18 : 0.32) + Math.sin(now * 1.5) * 0.03;
    const leanRest = lean;
    let headX = -0.25;
    let jaw = 0.05;
    if (m) {
      const t = now - m.t0;
      const len = m.hit - m.t0;
      const after = now - m.hit;
      if (m.act === "slam" || m.act === "quake") {
        // wind up, hold, then come down fast; after the blow, stay low, then recover
        const up = smooth(t / (len * 0.75));
        const down = smooth(after / 0.1);
        const back = smooth((after - 0.35) / 0.6);
        const raised = -3.2;
        const both = m.act === "quake" || yeti || kind === "treant";
        const struck = both ? -0.6 : -0.95;
        const rest = m.act === "quake" ? 0.25 : restR;
        const v = after < 0 ? rest + (raised - rest) * up : struck + (raised - struck) * (1 - down);
        const arm = after < 0.35 ? v : struck + (rest - struck) * back;
        armR = arm;
        if (both) armL = arm;
        lean = after < 0 ? leanRest - 0.3 * up : after < 0.35 ? 0.75 : 0.75 - (0.75 - leanRest) * back;
        headX = after < 0 ? -0.25 - 0.3 * up : -0.1;
        jaw = after < 0.4 && after > -0.3 ? 0.55 : 0.1;
        if (after > 1) this.move = null;
      } else if (m.act === "throw") {
        // reach back over the shoulder with the right arm, then hurl forward
        const back = smooth(t / len);
        const fling = smooth(after / 0.18);
        armR = after < 0 ? restR + (-3.4 - restR) * back : -3.4 + (3.4 - 1.2) * fling + (after > 0.5 ? (restR + 1.2) * smooth((after - 0.5) / 0.4) : 0);
        lean = after < 0 ? leanRest - 0.25 * back : leanRest + 0.35 * (1 - smooth((after - 0.3) / 0.5));
        jaw = 0.5;
        if (after > 1) this.move = null;
      } else if (m.act === "roar") {
        const k = smooth(t / 0.4) * (1 - smooth((t - len) / 0.5));
        headX = -0.25 - 0.75 * k;
        jaw = 0.05 + 0.65 * k;
        lean = leanRest - 0.25 * k;
        armR = restR + 0.45 - 0.6 * k - (yeti ? 1.6 * k : 0);
        armL = restL - 0.6 * k - (yeti ? 1.6 * k : 0);
        if (t > 0.3 && t < len && Math.random() < dt * 20 && this.mouth(this.v)) {
          if (kind === "titan") this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0xff7a1a, 1.2, 5);
          else if (yeti) this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0x9fdcff, 1.2, 3);
          else this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0xc6ff5a, 0.9, 3);
        }
        // the Yeti beats its chest
        if (yeti && t > 0.4 && t < len) {
          const beat = Math.sin(t * 16);
          armR = -1.2 + beat * 0.35;
          armL = -1.2 - beat * 0.35;
        }
        if (t > len + 0.6) this.move = null;
      } else if (t > 2) this.move = null;
    }
    const to = (n: string, v: number, sp = 14) => (b[n].rotation.x += (v - b[n].rotation.x) * Math.min(1, dt * sp));
    to("armR", armR, 18);
    to("armL", armL, 18);
    to("spine", lean, 10);
    to("head", headX, 8);
    to("jaw", jaw, 12);
    // the forearm bends back as the arm is raised, so the club swings in an arc
    b.armR2.rotation.x = -0.5 + Math.min(0, armR + 0.2) * -0.12;
    b.armL2.rotation.x = -0.5 + Math.min(0, armL - 0.25) * -0.12;

    root.updateMatrixWorld(true);
    if (kind === "titan") {
      // embers from the spires, smoke from the core
      if (Math.random() < dt * 14) {
        this.v.set(rand(-1, 1), rand(2.8, 3.3), rand(-1.2, -0.6));
        b.spine.localToWorld(this.v);
        this.puff(this.embers, this.v.x, this.v.y, this.v.z, Math.random() < 0.5 ? 0xff5a14 : 0xffb040, 0.6, 3);
      }
      if (Math.random() < dt * 4) {
        this.v.set(rand(-0.6, 0.6), 1.6, -0.6);
        b.spine.localToWorld(this.v);
        this.puff(this.smoke, this.v.x, this.v.y, this.v.z, 0x2b2426, 1.6, 2);
      }
    } else if (yeti) {
      // frost glittering off the crystals, cold breath from the mouth, snow shaken off the fur
      if (Math.random() < dt * 12) {
        this.v.set(rand(-1.2, 1.2), rand(1.8, 2.6), rand(-0.9, -0.3));
        b.spine.localToWorld(this.v);
        this.puff(this.embers, this.v.x, this.v.y, this.v.z, Math.random() < 0.5 ? 0x6fdcff : 0xd8f6ff, 0.5, 1.5);
      }
      // (lit particles: plain white ones turn the colour of the warm daylight)
      if (this.mouth(this.v) && Math.random() < dt * 6) this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0x7fc8ff, 0.7, 0.8);
      if (Math.random() < dt * 8) this.fx.burst(this.fx.sparks, this.x + rand(-3, 3), root.position.y + rand(4, 9), this.z + rand(-3, 3), now, 1, 0xdff4ff, 0.8, 1, 1.4, 0, 3);
    } else {
      // leaves drifting off the crown, glowing spores from the heart
      if (Math.random() < dt * 8) {
        this.v.set(rand(-1.8, 1.8), rand(2.4, 3.4), rand(-1, 0.4));
        b.spine.localToWorld(this.v);
        this.c.set(pick([0x3f8a2e, 0x6fb53a, 0xb7a13a]));
        this.fx.debris.add({
          x: this.v.x, y: this.v.y, z: this.v.z, vx: rand(-1.5, 1.5), vy: rand(-0.5, 0.5), vz: rand(-1.5, 1.5), t0: now, life: rand(2, 3.5), size: rand(0.5, 0.9),
          grow: 0, gravity: 1.2, drag: 1.5, r: this.c.r, g: this.c.g, b: this.c.b, spin: rand(-4, 4), bounce: true,
        });
      }
      if (this.socket("core", this.v) && Math.random() < dt * 6) this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0xc6ff5a, 0.4, 1.5);
    }
  }

  /**
   * The Kraken: only the top of it shows. Tentacles roll in slow waves; the two front arms strike
   * and grab; it sinks to dive and rises again; it shakes when it roars.
   */
  private animKraken(look: Look, d: { hidden: boolean; attackAt: number }, now: number, dt: number) {
    const b = look.model.bones;
    const root = look.model.root;
    const since = now - this.spawnAt;
    // in and out of the water: rise on arrival and on surfacing, sink to dive
    const up = Math.min(smooth(since / 2.5), smooth((now - this.riseAt) / 1.6) + (this.riseAt < 0 ? 1 : 0), d.hidden ? 1 - smooth((now - this.sinkAt) / 1.2) : 1);
    const bob = Math.sin(now * 1.1) * 0.35;
    root.position.set(this.x, SEA_Y - 1.2 - (1 - up) * 16 + bob, this.z);
    root.rotation.set(Math.sin(now * 0.7) * 0.04, this.yaw, Math.sin(now * 0.9) * 0.04);
    if (up < 1 && up > 0.02 && Math.random() < dt * 30) {
      // the sea boils around it as it moves through the surface
      const a = Math.random() * Math.PI * 2;
      this.fx.burst(this.fx.dust, this.x + Math.cos(a) * rand(3, 9), SEA_Y + 0.3, this.z + Math.sin(a) * rand(3, 9), now, 2, 0xe8fbff, 4, 1.4, 1.2, 1.6, 5);
    }
    // eyes follow the prey a little, and blink now and then
    const blink = (now % 4.3) < 0.12 ? 0.1 : 1;
    b.eyeR.scale.set(1, blink, 1);
    b.eyeL.scale.set(1, blink, 1);
    b.mantle.rotation.x = -0.35 + Math.sin(now * 0.8) * 0.06;

    const m = this.move;
    const t = m ? now - m.t0 : 0;
    const after = m ? now - m.hit : 0;
    const roar = m && m.act === "roar" ? smooth(t / 0.3) * (1 - smooth((t - (m.hit - m.t0)) / 0.5)) : 0;
    KRAKEN_ARMS.forEach((arm, i) => {
      const base = b[`t${i}`];
      // the tentacles stand up out of the sea and hook over at the tips, swaying in slow waves;
      // the ones at the back stay lower, so the face and the front arms read first
      const back = i >= 4 ? 1 : 0;
      let tilt = 0.05 + back * 0.35 + Math.sin(now * 0.9 + i * 1.3) * 0.12 - roar * 0.35;
      let yaw = arm.a;
      let curl = (j: number) => 0.04 + j * j * 0.035 + Math.sin(now * 1.6 - j * 0.7 + i * 1.1) * (0.08 + j * 0.04) - roar * 0.15;
      // the striking arms: the one on the target's side takes the blow
      const striking = m && (m.act === "strike" || m.act === "grab") && i === this.strikeArm(m);
      if (striking && m) {
        const len = m.hit - m.t0;
        yaw = arm.a * 0.25;
        if (after < 0) {
          // rear up and back, coiled
          const k = smooth(t / len);
          tilt = 0.25 - 1.15 * k;
          curl = (j) => 0.3 - 0.55 * k + j * 0.02;
        } else if (m.act === "strike") {
          // whip down straight onto the ground, lie there a moment, then lift away
          const k = smooth(after / 0.12);
          const rec = smooth((after - 0.5) / 0.7);
          tilt = -0.9 + (1.55 + 0.9) * k - 1.3 * rec;
          curl = (j) => (0.08 + j * 0.02) * (1 - rec) + rec * 0.3;
          if (after > 1.3) this.move = null;
        } else {
          // grab: lash out, wrap tight, drag back toward the body
          const k = smooth(after / 0.15);
          const pull = smooth((after - 0.25) / 0.6);
          tilt = -0.9 + 2.2 * k - 1.6 * pull;
          curl = (j) => 0.1 + (0.75 + j * 0.05) * pull;
          if (after > 1.1) this.move = null;
        }
      }
      base.rotation.set(tilt, yaw, 0);
      for (let j = 0; j < KRAKEN_SEGS; j++) b[`t${i}_${j}`].rotation.x = curl(j);
    });
    if (m && m.act === "roar" && t > (m.hit - m.t0) + 0.6) this.move = null;
    // drops of water falling off the raised tentacles, a ring of foam where it meets the sea
    if (up > 0.5 && Math.random() < dt * 10) {
      const a = Math.random() * Math.PI * 2;
      this.fx.burst(this.fx.dust, this.x + Math.cos(a) * rand(4, 10), SEA_Y + rand(4, 10), this.z + Math.sin(a) * rand(4, 10), now, 1, 0xd8f6ff, 0.6, 0.35, 1.2, 0, 9);
    }
    if (up > 0.3 && Math.random() < dt * 0.9) this.fx.ring(this.x, this.z, now, rand(7, 10), 0xbfe8f2, 1.6, SEA_Y);
  }

  /** Which of the two striking arms reaches for (x, z): the one on that side. */
  private strikeArm(m: Move) {
    if (m.x === undefined || m.z === undefined) return 0;
    const side = Math.sin(this.yaw) * (m.z - this.z) - Math.cos(this.yaw) * (m.x - this.x);
    return side > 0 ? 0 : 1;
  }

  /**
   * Cacing Pasir: arched out of the sand, swaying, its petals breathing open and shut. It plunges
   * head first to burrow, and bursts straight up out of the ground when it erupts.
   */
  private animWorm(look: Look, d: { hidden: boolean; mode: number }, now: number, dt: number) {
    const b = look.model.bones;
    const root = look.model.root;
    const g = this.ground(this.x, this.z);
    const since = now - this.spawnAt;
    const sinking = d.hidden ? smooth((now - this.sinkAt) / 1.1) : 0;
    const erupt = this.riseAt > 0 ? now - this.riseAt : since;
    // coming up: from deep below, straight up and fast, then it bows over into its arch
    const up = smooth(erupt / 0.55);
    const bow = smooth((erupt - 0.5) / 0.9);
    root.visible = !(d.hidden && sinking >= 1);
    root.position.set(this.x, g - 2.2 - (1 - up) * 18 - sinking * 16, this.z);
    root.rotation.set(0, this.yaw, 0);
    const m = this.move;
    const t = m ? now - m.t0 : 0;
    const after = m ? now - m.hit : 0;
    let thrust = 0;
    let open = 0.25 + Math.sin(now * 2.2) * 0.12;
    if (m && m.act === "spit") {
      // rear back, then snap the head forward with the mouth wide
      thrust = after < 0 ? -smooth(t / (m.hit - m.t0)) : smooth(after / 0.1) * (1 - smooth((after - 0.25) / 0.5));
      open = after < 0 ? 0.4 : 1.25;
      if (after > 0.9) this.move = null;
    }
    if (sinking > 0) open = 0.1;
    if (up < 1) open = 1.3;
    // the arch: lean back at the base, bend forward along the body, the head looking at the prey
    const sway = Math.sin(now * 1.3) * 0.05;
    for (let i = 0; i < WORM_SEGS; i++) {
      const s = b[`s${i}`];
      const arch = i === 0 ? -0.45 : 0.16 + (i > WORM_SEGS - 4 ? 0.08 : 0);
      const dive = sinking * (i === 0 ? 0.9 : 0.12);
      s.rotation.x = (arch + thrust * 0.06) * bow + dive;
      s.rotation.z = Math.sin(now * 1.3 - i * 0.5) * 0.05 + sway;
    }
    b.head.rotation.x = 0.55 * bow + thrust * 0.35;
    for (let i = 0; i < 4; i++) b[`p${i}`].rotation.x += (open + Math.sin(now * 3 + i) * 0.04 - b[`p${i}`].rotation.x) * Math.min(1, dt * 12);
    // sand pouring off it while it stands, a heat shimmer of sparks from the throat
    if (!d.hidden && Math.random() < dt * 14) {
      this.v.set(rand(-0.8, 0.8), rand(0, 0.7), rand(-0.9, -0.5));
      b[`s${(Math.random() * WORM_SEGS) | 0}`].localToWorld(this.v);
      this.c.set(pick([0xd8b878, 0xc49a5e, 0xe6cf98]));
      this.fx.dust.add({
        x: this.v.x, y: this.v.y, z: this.v.z, vx: rand(-0.5, 0.5), vy: rand(-1, 0), vz: rand(-0.5, 0.5), t0: now, life: rand(0.8, 1.4), size: rand(0.3, 0.6),
        grow: 0.8, gravity: 6, drag: 1, r: this.c.r, g: this.c.g, b: this.c.b, spin: 2, bounce: false,
      });
    }
    if (!d.hidden && this.mouth(this.v) && Math.random() < dt * 8) this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0xff8a2a, 0.5, 2);
  }

  /** A rising puff in a pool. */
  private puff(pool: ParticlePool, x: number, y: number, z: number, color: number, size: number, rise: number) {
    this.c.set(color);
    pool.add({
      x, y, z, vx: rand(-0.6, 0.6), vy: rand(rise * 0.6, rise), vz: rand(-0.6, 0.6), t0: this.lastNow(), life: rand(1, 1.8), size: size * rand(0.7, 1.2),
      grow: pool === this.smoke ? 1.8 : -0.4, gravity: pool === this.smoke ? 0 : -1, drag: 0.6, r: this.c.r, g: this.c.g, b: this.c.b, spin: rand(-3, 3), bounce: false,
    });
  }

  private now = 0;
  private lastNow() {
    return this.now;
  }

  /** Death and departure, played after the sim has let go of the boss. */
  private updateExit(now: number) {
    this.now = now;
    const e = this.exit;
    if (!e) return;
    const look = this.looks[e.kind];
    const root = look.model.root;
    const t = now - e.t0;
    const g = this.ground(e.x, e.z);
    root.visible = true;
    if (isWalker(e.kind)) {
      const col = WALKER[e.kind];
      // dead: it topples forward and breaks apart; leaving: it sinks back into the earth (the Yeti
      // climbs away into the snow: it sinks too, in a cloud of snow)
      if (e.how === "dead") {
        const fall = smooth(t / 1.6);
        root.rotation.set(fall * 1.3, e.yaw, 0);
        root.position.set(e.x, g - smooth((t - 1.6) / 2) * 14, e.z);
        if (t > 1.5 && t < 1.5 + 0.05) {
          const fx = e.x + Math.sin(e.yaw) * 9;
          const fz = e.z + Math.cos(e.yaw) * 9;
          if (e.kind === "titan") this.slam(fx, fz, 9, now, 2.2);
          else {
            this.fx.ring(fx, fz, now, 26, col.ring2, 0.9, g);
            this.fx.burst(this.fx.dust, fx, g + 1, fz, now, 40, col.dust, 12, 2.6, 2.6, 0.3, -0.3);
            this.fx.onShake(1, fx, fz);
          }
          for (let i = 0; i < 3; i++) this.fx.burst(this.fx.debris, fx, g + 2, fz, now + i * 0.2, 30, col.debris, 9, 2.2, 2.4, 1.6, 18);
          if (e.kind === "treant") for (let i = 0; i < 3; i++) this.fx.burst(this.fx.debris, fx, g + 4, fz, now + i * 0.3, 20, 0x4f8a2e, 6, 1.2, 3, 0.6, 2);
        }
      } else {
        root.position.set(e.x + Math.sin(now * 40) * 0.2, g - smooth(t / 3) * 18, e.z);
        if (Math.random() < 0.3) this.fx.burst(this.fx.dust, e.x + rand(-4, 4), g + 0.5, e.z + rand(-4, 4), now, 2, col.dust, 4, 2, 2, 0.4, -0.3);
      }
      if (t > 4) this.endExit(look);
      return;
    }
    if (e.kind === "kraken") {
      // it sinks, the tentacles last, and the sea closes over it
      root.position.set(e.x, SEA_Y - 1.2 - smooth(t / (e.how === "dead" ? 3 : 1.6)) * 18, e.z);
      root.rotation.set(e.how === "dead" ? smooth(t / 3) * 0.5 : 0, e.yaw, e.how === "dead" ? smooth(t / 3) * 0.3 : 0);
      if (Math.random() < 0.4) this.fx.burst(this.fx.dust, e.x + rand(-8, 8), SEA_Y + 0.3, e.z + rand(-8, 8), now, 2, 0xe8fbff, 4, 1.3, 1.3, 1.5, 5);
      if (t > 3.2) this.endExit(look);
      return;
    }
    if (e.kind === "worm") {
      // dead: it thrashes once, falls over sideways and sinks; leaving: it burrows
      if (e.how === "dead") {
        const fall = smooth(t / 1.4);
        root.rotation.set(0, e.yaw, fall * 1.2 + Math.sin(t * 12) * 0.1 * (1 - fall));
        root.position.set(e.x, g - 2.2 - smooth((t - 1.4) / 1.6) * 14, e.z);
        if (t > 1.35 && t < 1.4) {
          this.fx.burst(this.fx.dust, e.x, g + 1, e.z, now, 40, 0xd8b878, 12, 2.6, 2.6, 0.3, -0.3);
          this.fx.onShake(1, e.x, e.z);
        }
      } else root.position.set(e.x, g - 2.2 - smooth(t / 1.2) * 18, e.z);
      if (t > 3) this.endExit(look);
      return;
    }
    if (e.how === "dead") {
      // a dragon falls out of the sky, turning, and hits the ground in a burst of fire (Naga
      // Tengkorak: it bursts apart, its bones raining down)
      const fall = smooth(t / 1.4);
      root.position.set(e.x, e.y + (g - e.y) * fall, e.z);
      root.rotation.set(fall * 0.5, e.yaw + t * 1.5, fall * 1.1);
      if (t > 1.35 && t < 1.4) {
        const bone = e.kind === "bone";
        this.fx.explosion(e.x, g + 1, e.z, now, e.kind === "elder" || bone ? 4 : 2.5, bone ? 0x45f5a8 : 0xff5a1a);
        this.fx.ring(e.x, e.z, now, e.kind === "elder" || bone ? 40 : 24, bone ? 0xc8ffe6 : 0xffd08a, 0.9, g);
        this.fx.burst(this.fx.dust, e.x, g + 0.5, e.z, now, 30, 0x8d8072, 12, 2.4, 2.6, 0.3, -0.3);
        if (bone) for (let i = 0; i < 3; i++) this.fx.burst(this.fx.debris, e.x, g + 3, e.z, now + i * 0.15, 40, 0xe3dccb, 12, 2.2, 3, 1.8, 16);
        this.fx.onShake(1, e.x, e.z);
      }
      if (t > 1.4) root.scale.setScalar(look.scale * Math.max(0.01, 1 - (t - 1.4) / 1.2));
      if (t > 2.6) this.endExit(look);
      return;
    }
    // leaving: it flies off up into the sky
    root.position.set(e.x, e.y + t * t * 12, e.z - t * 15);
    if (t > 2.5) this.endExit(look);
  }

  private endExit(look: Look) {
    look.model.root.visible = false;
    look.model.root.rotation.set(0, 0, 0);
    look.model.root.scale.setScalar(look.scale);
    this.exit = null;
  }
}

function pick<T>(list: T[]) {
  return list[(Math.random() * list.length) | 0];
}
