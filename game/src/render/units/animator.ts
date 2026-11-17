// Per-unit animation state (docs/rencana-visual.md 4.4). Holds a small record per unit id and
// turns sim state into a pose: one rotation and one offset per bone.
//
// V0 states: idle, walk (blended over ~0.1 s) and attack (overlay on the bones its clip names).
// Corpses are posed with poseDeath(); they have no per-unit record.
// V2 adds spawn, run, hit and cheer on top of the same records.
//
// Combat feel (v2 models): on top of the clips, compute() adds a small procedural layer that
// needs no clip data: breathing, body bob and twist while walking, a guard stance for a few
// seconds after a blow, a lunge with every melee attack, a recoil when hit, and a tremble while
// stunned by lightning. It only touches bones the rig has, so every rig gets what fits it.
import type { Unit } from "../../sim/world";
import { clipFor, sampleKeys, type Clip, type ClipName } from "./anims";
import type { BakedRig } from "./rig";

export type AnimStateName = "idle" | "walk" | "attack";

interface UnitAnim {
  state: AnimStateName;
  since: number;
  /** 0 = standing, 1 = walking */
  walk: number;
  last: number;
  seen: number;
}

/** Floats per bone in a pose buffer: rx, ry, rz, px, py, pz. */
export const POSE_STRIDE = 6;
export const ATTACK_SECONDS = 0.35;
/** how long a hit makes a unit recoil, and how long it stays on guard after its last blow */
export const FLINCH_SECONDS = 0.28;
export const GUARD_SECONDS = 2.5;
const WALK_RATE = 5.5; // matches HUMAN_WALK in anims.ts

export class Animator {
  private units = new Map<number, UnitAnim>();
  private a = new Float32Array(3);
  private b = new Float32Array(3);
  private frame = 0;

  /** Current state of a unit (for debugging and the codex lab). */
  stateOf(id: number): AnimStateName | null {
    return this.units.get(id)?.state ?? null;
  }

  /**
   * Fill `out` (bones × POSE_STRIDE) with the pose of unit u.
   * `time` is render time in seconds, `simT` the sim clock (attack timing comes from the sim).
   */
  pose(rig: BakedRig, u: Unit, time: number, simT: number, out: Float32Array) {
    let s = this.units.get(u.id);
    if (!s) {
      s = { state: u.moving ? "walk" : "idle", since: time, walk: u.moving ? 1 : 0, last: time, seen: this.frame };
      this.units.set(u.id, s);
    }
    s.seen = this.frame;
    const dt = Math.min(Math.max(time - s.last, 0), 0.1);
    s.last = time;
    s.walk += ((u.moving ? 1 : 0) - s.walk) * Math.min(1, dt * 12);

    const since = simT - u.attackAt;
    const len = clipFor(rig.type, rig.rig, "attack")?.length ?? ATTACK_SECONDS;
    const next: AnimStateName = since >= 0 && since < len ? "attack" : u.moving ? "walk" : "idle";
    if (next !== s.state) {
      s.state = next;
      s.since = time;
    }
    this.compute(rig, u, time, simT, s.walk, out);
  }

  /** Same pose as pose() but without advancing the unit's state (socket lookups, previews). */
  peek(rig: BakedRig, u: Unit, time: number, simT: number, out: Float32Array) {
    this.compute(rig, u, time, simT, this.units.get(u.id)?.walk ?? (u.moving ? 1 : 0), out);
  }

  private compute(rig: BakedRig, u: Unit, time: number, simT: number, walk: number, out: Float32Array) {
    const clip = (name: ClipName) => clipFor(rig.type, rig.rig, name);
    const t = time + u.id * 0.37;
    const since = simT - u.attackAt;
    out.fill(0, 0, rig.bones.length * POSE_STRIDE);
    const fly = clip("fly");
    if (fly) this.apply(rig, fly, t, 1, out);
    else {
      const idle = clip("idle");
      const walkClip = clip("walk");
      if (idle && walk < 0.999) this.apply(rig, idle, t, 1, out);
      if (walkClip && walk > 0.001) this.apply(rig, walkClip, t, walk, out);
    }
    const ambient = clip("ambient");
    if (ambient) this.apply(rig, ambient, t, 1, out);
    const attack = clip("attack");
    if (attack && since >= 0 && since < attack.length) {
      // fade out over the last quarter so the pose melts back into idle or walk
      const w = Math.min(1, (attack.length - since) / (attack.length * 0.25));
      this.apply(rig, attack, since, w, out);
    }
    this.feel(rig, u, t, simT, walk, since, attack?.length ?? ATTACK_SECONDS, out);
  }

  /** The procedural combat layer (see the header). Everything here is added to the clip pose. */
  private feel(rig: BakedRig, u: Unit, t: number, simT: number, walk: number, since: number, attackLen: number, out: Float32Array) {
    const B = rig.boneIndex;
    const add = (bone: number | undefined, slot: number, v: number) => {
      if (bone !== undefined) out[bone * POSE_STRIDE + slot] += v;
    };
    const legged = rig.rig === "humanoid" || rig.rig === "golem";
    const heavy = rig.rig === "golem" ? 0.6 : 1;
    // the bone that carries the whole upper body, and the one that carries everything
    const trunk = B.spine ?? B.body;
    const rootBone = B.hips ?? B.body ?? B.base;

    if (legged) {
      // breathing: chest and shoulders rise and fall, slower for big bodies
      const breath = Math.sin(t * 1.9 * heavy);
      add(B.spine, 0, 0.018 * breath * (1 - walk));
      add(B.armR, 2, -0.02 * breath * (1 - walk));
      add(B.armL, 2, 0.02 * breath * (1 - walk));
      add(B.head, 0, -0.012 * breath * (1 - walk));
      // walking: the body dips twice per stride, the shoulders counter the legs, the head stays level
      const stride = t * WALK_RATE;
      add(B.hips, 4, -0.05 * walk * Math.abs(Math.sin(stride)));
      add(B.spine, 1, 0.09 * walk * Math.sin(stride));
      add(B.spine, 0, 0.05 * walk);
      add(B.head, 1, -0.07 * walk * Math.sin(stride));
    }

    const attacking = since >= 0 && since < attackLen;
    if (legged) {
      // guard: after a blow the unit stays low and braced, one foot forward, until the fight moves on
      const rest = since - attackLen;
      const guard = since < 0 ? 0 : attacking ? 1 : Math.max(0, 1 - rest / GUARD_SECONDS);
      const g = guard * (1 - walk);
      if (g > 0.001) {
        add(B.hips, 4, -0.07 * g);
        add(B.spine, 0, 0.09 * g);
        add(B.legR, 0, 0.2 * g);
        add(B.legL, 0, -0.22 * g);
        add(B.head, 0, -0.06 * g);
      }
      // lunge: weight goes into every strike and comes back
      if (attacking) {
        const k = Math.sin(Math.PI * Math.min(1, since / (attackLen * 0.7)));
        add(B.hips, 5, 0.14 * heavy * k);
        add(B.legL, 0, -0.16 * k);
        add(B.legR, 0, 0.12 * k);
      }
    }

    // recoil when hit: the upper body snaps back and the whole unit is pushed a little
    const hit = simT - u.hitAt;
    if (hit >= 0 && hit < FLINCH_SECONDS) {
      const k = Math.sin((Math.PI * hit) / FLINCH_SECONDS) * (attacking ? 0.5 : 1) * heavy;
      if (rig.rig === "siege") add(rootBone, 2, 0.03 * k * Math.sin(hit * 60));
      else {
        add(trunk, 0, (legged ? -0.24 : -0.06) * k);
        add(B.head, 0, -0.18 * k);
        add(rootBone, 5, -0.1 * k);
        add(B.armL, 0, 0.25 * k * (legged ? 1 : 0));
      }
    }

    // stunned by lightning: head drops, the body shakes
    if (u.stunUntil > simT) {
      const shake = Math.sin(t * 43 + u.id);
      add(trunk, 2, 0.05 * shake);
      add(B.head, 0, 0.3);
      add(B.head, 2, 0.08 * Math.sin(t * 37));
      add(B.armR, 2, -0.06 * shake);
      add(B.armL, 2, 0.06 * shake);
      add(rootBone, 3, 0.012 * shake);
    }
  }

  /**
   * Pose of a corpse `age` seconds after death: the idle stance with the death clip on top.
   * Types without a death clip (they shatter instead) just keep the idle stance.
   */
  poseDeath(rig: BakedRig, age: number, out: Float32Array) {
    out.fill(0, 0, rig.bones.length * POSE_STRIDE);
    const idle = clipFor(rig.type, rig.rig, "idle");
    if (idle) this.apply(rig, idle, 0, 1, out);
    const death = clipFor(rig.type, rig.rig, "death");
    if (death) this.apply(rig, death, age, 1, out);
  }

  /** Blend a clip into the pose with weight w (bones the clip does not name are left alone). */
  private apply(rig: BakedRig, clip: Clip, t: number, w: number, out: Float32Array) {
    for (const [name, track] of Object.entries(clip.tracks)) {
      const i = rig.boneIndex[name as keyof BakedRig["boneIndex"]];
      if (i === undefined || !track) continue;
      const o = i * POSE_STRIDE;
      if (sampleKeys(track.rot, t, clip.loop, clip.length, this.a, 0)) {
        out[o] += (this.a[0] - out[o]) * w;
        out[o + 1] += (this.a[1] - out[o + 1]) * w;
        out[o + 2] += (this.a[2] - out[o + 2]) * w;
      }
      if (sampleKeys(track.pos, t, clip.loop, clip.length, this.b, 0)) {
        out[o + 3] += (this.b[0] - out[o + 3]) * w;
        out[o + 4] += (this.b[1] - out[o + 4]) * w;
        out[o + 5] += (this.b[2] - out[o + 5]) * w;
      }
    }
  }

  /** Call once per frame after posing everyone: drops records of units not seen for a while. */
  endFrame() {
    this.frame++;
    if (this.frame % 120 !== 0) return;
    for (const [id, s] of this.units) if (this.frame - s.seen > 60) this.units.delete(id);
  }
}
