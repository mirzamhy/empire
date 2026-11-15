// Auto-director camera for the portrait stream: overview, gift senders, falling castles,
// new kingdoms, the dragon and the biggest battle. One shot at a time, with priorities.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { Sim, SimEvent } from "../sim/world";

interface Shot {
  x: number;
  z: number;
  dist: number;
  until: number;
  priority: number;
  label: string;
}

const MIN_SHOT = 2;

export class Director {
  private shot: Shot | null = null;
  private shotStart = 0;
  private lastOverview = -999;
  private lastJoinShot = -999;
  private target = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private look = new THREE.Vector3();
  enabled = true;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private map: WorldMap,
  ) {
    this.look.set(0, 0, 0);
  }

  private propose(s: Omit<Shot, "until"> & { seconds: number }, now: number) {
    const cur = this.shot;
    if (cur && now < cur.until) {
      const minDone = now - this.shotStart >= MIN_SHOT;
      if (s.priority < cur.priority || (s.priority === cur.priority && !minDone)) return;
      if (!minDone && s.priority < cur.priority + 20) return;
    }
    this.shot = { x: s.x, z: s.z, dist: s.dist, priority: s.priority, label: s.label, until: now + s.seconds };
    this.shotStart = now;
  }

  onEvent(e: SimEvent, sim: Sim, now: number) {
    const k = "kid" in e ? sim.kingdomById(e.kid) : null;
    if (e.k === "troops" && k && e.reason !== "like") {
      const power = Object.entries(e.units).reduce((a, [t, n]) => a + sim.cfg.unitTypes[t as keyof typeof sim.cfg.unitTypes].hp * (n ?? 0), 0);
      if (power >= 450) this.propose({ x: k.x, z: k.z, dist: 42, priority: power >= 1000 ? 80 : 60, label: "gift", seconds: 4 }, now);
    } else if (e.k === "fall" && k) this.propose({ x: k.x, z: k.z, dist: 40, priority: 70, label: "fall", seconds: 3 }, now);
    else if (e.k === "join" && k && now - this.lastJoinShot > 6 && sim.phase !== "LOBBY") {
      this.lastJoinShot = now;
      this.propose({ x: k.x, z: k.z, dist: 44, priority: 40, label: "join", seconds: 2.5 }, now);
    } else if (e.k === "dragon") this.propose({ x: this.map.altar.x, z: this.map.altar.z, dist: 52, priority: 90, label: "dragon", seconds: 5 }, now);
  }

  /** Pick an idle shot when nothing important is happening. */
  private idle(sim: Sim, now: number) {
    if (sim.phase === "LOBBY" || sim.phase === "RESULT" || now - this.lastOverview > 40 || sim.alive.length === 0) {
      this.lastOverview = now;
      this.propose({ x: 0, z: 0, dist: 150, priority: 5, label: "overview", seconds: sim.phase === "WAR" || sim.phase === "FINAL" ? 6 : 8 }, now);
      return;
    }
    if (sim.dragon && Math.random() < 0.35) {
      this.propose({ x: sim.dragon.x, z: sim.dragon.z, dist: 50, priority: 10, label: "dragon", seconds: 5 }, now);
      return;
    }
    // biggest fight: unit with most enemies within 10 m (sampled)
    let best: { x: number; z: number } | null = null;
    let bestN = 0;
    const units = sim.units;
    for (let i = 0; i < units.length; i += Math.max(1, Math.floor(units.length / 60))) {
      const u = units[i];
      let n = 0;
      for (const o of units) if (o.kid !== u.kid && Math.abs(o.x - u.x) < 10 && Math.abs(o.z - u.z) < 10) n++;
      if (n > bestN) {
        bestN = n;
        best = u;
      }
    }
    if (best && bestN >= 4) {
      this.propose({ x: best.x, z: best.z, dist: 46, priority: 10, label: "battle", seconds: 6 }, now);
      return;
    }
    const lead = sim.leaderboard()[0];
    this.propose({ x: lead.x, z: lead.z, dist: 50, priority: 10, label: "leader", seconds: 5 }, now);
  }

  update(sim: Sim, now: number, dt: number) {
    if (!this.enabled) return;
    if (!this.shot || now >= this.shot.until) this.idle(sim, now);
    const s = this.shot!;
    this.target.set(s.x, this.map.heightAt(s.x, s.z), s.z);
    // portrait framing: steep angle so the map fills the tall screen
    const d = s.dist;
    this.desired.set(s.x, this.target.y + d * 0.95, s.z + d * 0.62);
    const k = 1 - Math.exp(-dt * (s.label === "overview" ? 1.2 : 2.2));
    this.camera.position.lerp(this.desired, k);
    this.look.lerp(this.target, 1 - Math.exp(-dt * 3));
    this.camera.lookAt(this.look);
  }

  get current() {
    return this.shot?.label ?? "-";
  }
}
