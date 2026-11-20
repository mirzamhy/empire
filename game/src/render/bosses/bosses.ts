// The world bosses on screen: the World Dragon, Naga Purba and Titan Neraka. Each is one model,
// animated here by hand from the sim's boss state and its moves (boss events):
//   - World Dragon: circles over the altar, turns to breathe (as before)
//   - Naga Purba: dives out of the sky on arrival, hovers high on slow ragged wingbeats, roars a
//     line of hellfire, crashes to the ground when it dies
//   - Titan: rises out of the earth in a ring of lava, walks with shaking steps, raises its club
//     and smashes, stamps the ground with both fists, crumbles when it dies, sinks when it leaves
import * as THREE from "three";
import type { WorldMap } from "../../sim/map";
import type { BossKind, Sim, SimEvent } from "../../sim/world";
import { modelFor } from "../units/rig";
import type { Fx } from "../fx";
import { ParticlePool } from "../fx";
import { buildElder } from "./elder";
import { buildTitan, type BossModel } from "./titan";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** Angle difference folded to -PI..PI. */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

interface Look {
  model: BossModel;
  scale: number;
  /** base colours of the self-lit parts, for the pulse */
  base: THREE.Color[];
}

/** A move being played: started at t0, the blow lands at hit. */
interface Move {
  act: "slam" | "quake" | "roar" | "inferno";
  t0: number;
  hit: number;
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
    this.looks = { dragon: make(dragonLook, 2.6), elder: make(buildElder(), 3.6), titan: make(buildTitan(), 3.4) };
    const additive = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.embers = new ParticlePool(new THREE.IcosahedronGeometry(0.4, 0), additive, 700, "color", map);
    this.smoke = new ParticlePool(
      new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }),
      400,
      "shrink",
      map,
    );
    this.group.add(this.embers.mesh, this.smoke.mesh);
  }

  /** World position of the active boss's mouth, for its fire. */
  mouth(out: THREE.Vector3): boolean {
    const look = this.kind ? this.looks[this.kind] : null;
    const m = look?.model.sockets.mouth;
    if (!look || !m || !look.model.root.visible) return false;
    look.model.root.updateMatrixWorld(true);
    m.getWorldPosition(out);
    return true;
  }

  /** The boss breathes toward (x, z) for a moment. */
  aim(fromX: number, fromZ: number, x: number, z: number, now: number) {
    this.aimYaw = Math.atan2(x - fromX, z - fromZ);
    this.breathUntil = now + (this.kind === "elder" ? 0.9 : 0.65);
  }

  /** How big the breath stream of the active boss is. */
  get breathScale() {
    return this.kind === "elder" ? 3.4 : 2.2;
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
        this.arrive(e.kind, e.x, e.z, now);
      } else if (this.kind) {
        const root = this.looks[this.kind].model.root;
        this.exit = { kind: this.kind, how: e.state === "dead" ? "dead" : "leave", t0: now, x: e.x, y: root.position.y, z: e.z, yaw: this.yaw };
        this.kind = null;
        if (e.state === "dead") this.fx.explosion(e.x, root.position.y + 3, e.z, now, e.kind === "dragon" ? 2.2 : 3.5, 0xff5a1a);
      }
      return;
    }
    if (e.k !== "boss") return;
    const g = this.ground(e.x, e.z);
    switch (e.act) {
      case "roar":
        this.move = { act: "roar", t0: now, hit: now + 2.2 };
        break;
      case "windup":
        this.move = { act: "slam", t0: now, hit: now + 0.7 };
        // a red ring marks where the club will land
        this.fx.ring(e.x, e.z, now, e.r, 0xff3b1f, 0.75, g);
        this.fx.ring(e.x, e.z, now + 0.35, e.r * 0.6, 0xff6a2a, 0.4, g);
        break;
      case "quakeWindup":
        this.move = { act: "quake", t0: now, hit: now + 1.1 };
        for (let i = 0; i < 3; i++) this.fx.ring(e.x, e.z, now + i * 0.3, e.r, 0xff3b1f, 0.5, g);
        break;
      case "slam":
        this.slam(e.x, e.z, e.r, now, 1);
        break;
      case "quake":
        this.quake(e.x, e.z, e.r, now);
        break;
      case "rampage":
        this.move = { act: "slam", t0: now - 0.6, hit: now };
        this.slam(e.x, e.z, e.r, now, 2);
        break;
      case "inferno":
        this.move = { act: "inferno", t0: now, hit: now + 0.5 };
        this.aimYaw = Math.atan2(e.x - this.x, e.z - this.z);
        this.breathUntil = now + 2.2;
        break;
    }
  }

  private hideAll() {
    for (const l of Object.values(this.looks)) l.model.root.visible = false;
  }

  /** Entrances: the Titan bursts out of the ground, Naga Purba drops out of the clouds. */
  private arrive(kind: BossKind, x: number, z: number, now: number) {
    const g = this.ground(x, z);
    if (kind === "titan") {
      this.fx.ring(x, z, now, 26, 0xff5a1a, 1.4, g);
      this.fx.ring(x, z, now + 0.4, 18, 0xffb040, 1.2, g);
      this.fx.scorchMark(x, z, now, 11, 0x1a0d08);
      for (let i = 0; i < 4; i++) this.fx.burst(this.fx.debris, x, g + 1, z, now + i * 0.5, 22, 0x3a3236, 10, 2.2, 2.2, 1.5, 18);
      for (let i = 0; i < 6; i++) this.fx.burst(this.fx.dust, x, g + 1, z, now + i * 0.4, 14, 0x5a4d44, 9, 2.6, 3, 0.4, -0.3);
      this.fx.onShake(1, x, z);
    } else if (kind === "elder") {
      // the sky darkens around a column of fire where it will land
      for (let i = 0; i < 5; i++) this.fx.ring(x, z, now + i * 0.6, 30 - i * 4, 0xff3b1f, 1.0, g);
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
    // the sim moves in steps; the model glides after it
    const k = 1 - Math.exp(-dt * 6);
    const mx = d.x - this.x;
    const mz = d.z - this.z;
    this.x += mx * k;
    this.z += mz * k;
    const speed = Math.hypot(mx, mz) * k / Math.max(dt, 1e-3);
    const breathing = now < this.breathUntil;
    const want = breathing ? this.aimYaw : speed > 0.3 ? Math.atan2(mx, mz) : Math.atan2(d.tx - d.x, d.tz - d.z);
    this.yaw += turn(this.yaw, want) * Math.min(1, dt * (breathing ? 8 : 2.5));
    if (this.kind === "dragon") this.animDragon(look, d, now, dt, breathing);
    else if (this.kind === "elder") this.animElder(look, now, dt, breathing);
    else this.animTitan(look, now, dt, speed);
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

  private animElder(look: Look, now: number, dt: number, breathing: boolean) {
    const b = look.model.bones;
    const root = look.model.root;
    const g = this.ground(this.x, this.z);
    // arrival: a long dive from high above, wings swept back, pulling up just above the ground
    const since = now - this.spawnAt;
    const dive = 1 - smooth(since / 3.2);
    const hover = 10 + Math.sin(now * 1.3) * 0.8;
    root.position.set(this.x - dive * 40, g + hover + dive * 90, this.z - dive * 25);
    root.rotation.set(dive * 0.6, this.yaw, 0);
    if (since > 2.9 && since < 2.9 + dt * 1.5) {
      // the landing wind: a ring of dust flattening everything below
      this.fx.ring(this.x, this.z, now, 34, 0xffd08a, 0.9, g);
      for (let i = 0; i < 3; i++) this.fx.burst(this.fx.dust, this.x, g + 0.5, this.z, now + i * 0.15, 18, 0x8d8072, 12, 2.2, 2.4, 0.15, -0.2);
      this.fx.onShake(0.9, this.x, this.z);
    }
    // slow, heavy wingbeats; the outer wing trails behind the inner one
    const beat = now * (dive > 0.05 ? 1.2 : 2.1);
    const flap = Math.sin(beat) * (dive > 0.05 ? 0.15 : 0.62);
    b.wingR.rotation.z = -0.15 - flap - dive * 0.5;
    b.wingL.rotation.z = 0.15 + flap + dive * 0.5;
    b.wingR2.rotation.z = -Math.sin(beat - 0.7) * 0.4;
    b.wingL2.rotation.z = Math.sin(beat - 0.7) * 0.4;
    b.wingR.rotation.y = dive * 0.7;
    b.wingL.rotation.y = -dive * 0.7;
    // each downbeat pushes the body up a little
    root.position.y += Math.cos(beat) * 0.5 * (1 - dive);
    // neck: a slow sway; reaching down and forward while it breathes; thrown back to roar
    const roar = this.move && this.move.act !== "slam" && this.move.act !== "quake" ? clamp01((now - this.move.t0) / 0.4) * clamp01((this.move.hit + 0.6 - now) / 0.5) : 0;
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

  private animTitan(look: Look, now: number, dt: number, speed: number) {
    const b = look.model.bones;
    const root = look.model.root;
    const g = this.ground(this.x, this.z);
    // arrival: climbs out of the ground over three seconds, shaking
    const since = now - this.spawnAt;
    const rise = smooth(since / 3);
    const shake = rise < 1 ? Math.sin(now * 40) * 0.25 * (1 - rise) : 0;
    root.position.set(this.x + shake, g - (1 - rise) * 16, this.z);
    root.rotation.y = this.yaw;
    if (rise < 1 && Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      this.fx.burst(this.fx.debris, this.x + Math.cos(a) * 5, g + 0.5, this.z + Math.sin(a) * 5, now, 2, 0x3a3236, 5, 1.4, 1.5, 2, 18);
      this.puff(this.embers, this.x + Math.cos(a) * 4, g + 0.3, this.z + Math.sin(a) * 4, 0xff5a14, 0.8, 4);
    }

    // walking: legs swing, knees bend on the way forward, the body rolls from foot to foot
    const walking = speed > 0.25 && rise >= 1;
    this.walk += dt * (walking ? 2.4 : 0);
    const w = this.walk;
    const amp = walking ? 0.42 : 0;
    const legTo = (n: string, v: number) => (b[n].rotation.x += (v - b[n].rotation.x) * Math.min(1, dt * 8));
    legTo("legR", Math.sin(w) * amp);
    legTo("legL", -Math.sin(w) * amp);
    legTo("legR2", Math.max(0, -Math.sin(w)) * amp * 1.4);
    legTo("legL2", Math.max(0, Math.sin(w)) * amp * 1.4);
    root.position.y += walking ? Math.abs(Math.cos(w)) * 0.35 : 0;
    b.hips.rotation.z = walking ? Math.sin(w) * 0.06 : 0;
    // a heavy step lands every half cycle: dust, a ring, a small shake
    const step = Math.floor(w / Math.PI);
    if (walking && step !== this.lastStep) {
      this.lastStep = step;
      const side = step % 2 ? 1 : -1;
      const fx = this.x + Math.cos(this.yaw) * side * 1.7;
      const fz = this.z - Math.sin(this.yaw) * side * 1.7;
      this.fx.ring(fx, fz, now, 6, 0xd8c8a8, 0.5);
      this.fx.burst(this.fx.dust, fx, this.ground(fx, fz) + 0.3, fz, now, 6, 0x7d7064, 3.5, 1.6, 1.4, 0.3, -0.3);
      this.fx.onShake(0.25, fx, fz);
    }

    // moves: raise the club and smash; both fists up and down on the ground; head back to roar
    const m = this.move;
    let armR = -0.2 + (walking ? -Math.sin(w) * 0.2 : Math.sin(now * 1.2) * 0.05);
    let armL = 0.25 + (walking ? Math.sin(w) * 0.25 : Math.sin(now * 1.2 + 1) * 0.05);
    let lean = 0.32 + Math.sin(now * 1.5) * 0.03;
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
        const struck = m.act === "quake" ? -0.6 : -0.95;
        const rest = m.act === "quake" ? 0.25 : -0.2;
        const v = after < 0 ? rest + (raised - rest) * up : struck + (raised - struck) * (1 - down);
        const arm = after < 0.35 ? v : struck + (rest - struck) * back;
        armR = arm;
        if (m.act === "quake") armL = arm;
        lean = after < 0 ? 0.32 - 0.3 * up : after < 0.35 ? 0.75 : 0.75 - 0.43 * back;
        headX = after < 0 ? -0.25 - 0.3 * up : -0.1;
        jaw = after < 0.4 && after > -0.3 ? 0.55 : 0.1;
        if (after > 1) this.move = null;
      } else if (m.act === "roar") {
        const k = smooth(t / 0.4) * (1 - smooth((t - len) / 0.5));
        headX = -0.25 - 0.75 * k;
        jaw = 0.05 + 0.65 * k;
        lean = 0.32 - 0.25 * k;
        armR = 0.25 - 0.6 * k;
        armL = 0.25 - 0.6 * k;
        if (t > 0.3 && t < len && Math.random() < dt * 20 && this.mouth(this.v)) this.puff(this.embers, this.v.x, this.v.y, this.v.z, 0xff7a1a, 1.2, 5);
        if (t > len + 0.6) this.move = null;
      } else if (t > 2) this.move = null;
    }
    const to = (n: string, v: number, speed = 14) => (b[n].rotation.x += (v - b[n].rotation.x) * Math.min(1, dt * speed));
    to("armR", armR, 18);
    to("armL", armL, 18);
    to("spine", lean, 10);
    to("head", headX, 8);
    to("jaw", jaw, 12);
    // the forearm bends back as the arm is raised, so the club swings in an arc
    b.armR2.rotation.x = -0.5 + Math.min(0, armR + 0.2) * -0.12;
    b.armL2.rotation.x = -0.5 + Math.min(0, armL - 0.25) * -0.12;

    // embers from the spires, smoke from the core, now and then a drop of lava from a seam
    root.updateMatrixWorld(true);
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
    if (e.kind === "titan") {
      // dead: it topples forward and breaks apart; leaving: it sinks back into the earth
      if (e.how === "dead") {
        const fall = smooth(t / 1.6);
        root.rotation.set(fall * 1.3, e.yaw, 0);
        root.position.set(e.x, g - smooth((t - 1.6) / 2) * 14, e.z);
        if (t > 1.5 && t < 1.5 + 0.05) {
          const fx = e.x + Math.sin(e.yaw) * 9;
          const fz = e.z + Math.cos(e.yaw) * 9;
          this.slam(fx, fz, 9, now, 2.2);
          for (let i = 0; i < 3; i++) this.fx.burst(this.fx.debris, fx, g + 2, fz, now + i * 0.2, 30, 0x2e2a2f, 9, 2.2, 2.4, 1.6, 18);
        }
      } else {
        root.position.set(e.x + Math.sin(now * 40) * 0.2, g - smooth(t / 3) * 18, e.z);
        if (Math.random() < 0.3) this.fx.burst(this.fx.dust, e.x + rand(-4, 4), g + 0.5, e.z + rand(-4, 4), now, 2, 0x7d7064, 4, 2, 2, 0.4, -0.3);
      }
      if (t > 4) this.endExit(look);
      return;
    }
    if (e.how === "dead") {
      // a dragon falls out of the sky, turning, and hits the ground in a burst of fire
      const fall = smooth(t / 1.4);
      root.position.set(e.x, e.y + (g - e.y) * fall, e.z);
      root.rotation.set(fall * 0.5, e.yaw + t * 1.5, fall * 1.1);
      if (t > 1.35 && t < 1.4) {
        this.fx.explosion(e.x, g + 1, e.z, now, e.kind === "elder" ? 4 : 2.5, 0xff5a1a);
        this.fx.ring(e.x, e.z, now, e.kind === "elder" ? 40 : 24, 0xffd08a, 0.9, g);
        this.fx.burst(this.fx.dust, e.x, g + 0.5, e.z, now, 30, 0x8d8072, 12, 2.4, 2.6, 0.3, -0.3);
        this.fx.onShake(1, e.x, e.z);
      }
      if (t > 1.4) root.scale.setScalar(look.scale * Math.max(0.01, 1 - (t - 1.4) / 1.2));
      if (t > 2.6) this.endExit(look);
      return;
    }
    this.endExit(look);
  }

  private endExit(look: Look) {
    look.model.root.visible = false;
    look.model.root.rotation.set(0, 0, 0);
    look.model.root.scale.setScalar(look.scale);
    this.exit = null;
  }
}
