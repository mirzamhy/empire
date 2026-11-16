// Per-unit animation state (docs/rencana-visual.md 4.4). Holds a small record per unit id and
// turns sim state into a pose: one rotation and one offset per bone.
//
// V0 states: idle, walk (blended over ~0.1 s) and attack (overlay on the bones its clip names).
// V2 adds spawn, run, hit, death and cheer on top of the same records.
import type { Unit } from "../../sim/world";
import { CLIPS, sampleKeys, type Clip } from "./anims";
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
    const next: AnimStateName = since >= 0 && since < ATTACK_SECONDS ? "attack" : u.moving ? "walk" : "idle";
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
    const clips = CLIPS[rig.rig];
    const t = time + u.id * 0.37;
    const since = simT - u.attackAt;
    out.fill(0, 0, rig.bones.length * POSE_STRIDE);
    if (clips.fly) this.apply(rig, clips.fly, t, 1, out);
    else {
      if (clips.idle && walk < 0.999) this.apply(rig, clips.idle, t, 1, out);
      if (clips.walk && walk > 0.001) this.apply(rig, clips.walk, t, walk, out);
    }
    if (since >= 0 && since < ATTACK_SECONDS && clips.attack) this.apply(rig, clips.attack, since, 1, out);
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
