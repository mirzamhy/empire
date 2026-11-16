// EMPIRE simulation: kingdoms, units, combat, territory, dragon, rounds.
// Pure TS and deterministic for a given seed and input order. Rendering reads its state and events.
import { BANNER_COLORS, UNIT_TYPES, type GameConfig, type UnitBundle, type UnitType } from "./config";
import { CELL, GRID_W, WORLD_H, WORLD_W, type WorldMap } from "./map";
import { Rng } from "./rng";

export type Phase = "LOBBY" | "WAR" | "FINAL" | "RESULT";
export type OrderKind = "attack" | "defend" | "boss" | "expand";

export interface Kingdom {
  id: number;
  key: string;
  name: string;
  color: string;
  x: number;
  z: number;
  level: number;
  exp: number;
  nextExp: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  shieldUntil: number;
  joinedAt: number;
  kills: number;
  castlesDestroyed: number;
  tiles: number;
  score: number;
  passiveTimer: number;
  towerCd: number;
  order: { kind: OrderKind; targetId: number; until: number } | null;
  orderAt: number;
  warTargetId: number;
  warTimer: number;
  field: Uint16Array;
  dragonDamage: number;
  /** villages held (recomputed with the score) */
  villages: number;
  buffUntil: number;
  crown: boolean;
  unitCount: number;
  passiveCount: number;
  pending: { type: UnitType; until: number; from: string }[];
}

export interface Unit {
  id: number;
  kid: number;
  type: UnitType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  dmg: number;
  alive: boolean;
  passive: boolean;
  atkCd: number;
  retarget: number;
  tKind: "unit" | "castle" | "dragon" | "home" | "village" | null;
  tId: number;
  heading: number;
  moving: boolean;
  attackAt: number;
  /** sim time of the last damage taken (render hit flash) */
  hitAt: number;
  raised: number;
  bornAt: number;
  from: string | null;
}

/** Neutral settlement. Standing in it alone for a few seconds takes it; it claims land and trains militia. */
export interface Village {
  id: number;
  name: string;
  x: number;
  z: number;
  /** kingdom id, 0 = neutral */
  owner: number;
  /** kingdom currently taking it and for how long */
  claimKid: number;
  progress: number;
  spawnTimer: number;
  field: Uint16Array;
}

const VILLAGE_NAMES = [
  "Sukamaju", "Karangsari", "Wanareja", "Lembahhijau", "Batuputih", "Sidomulyo", "Tanjungsari", "Mekarjaya",
  "Pasirlaut", "Gunungsari", "Sumberjaya", "Rawabening", "Ciranjang", "Kedungwaru", "Jatimulya", "Bukitasri",
  "Telagamas", "Padangrumput", "Sukaraja", "Mandalasari",
];

export interface Dragon {
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  cd: number;
  summonedBy: number | null;
  damage: Map<number, number>;
  attackAt: number;
}

export type SimEvent =
  | { k: "join"; kid: number }
  | { k: "fall"; kid: number; by: number | null }
  | { k: "troops"; kid: number; units: UnitBundle; from: string; reason: string }
  | { k: "level"; kid: number; level: number }
  | { k: "shot"; fromX: number; fromZ: number; x: number; z: number; type: UnitType | "tower" | "dragon"; dmg: number; on: HitTarget }
  /** melee blow landed (ranged hits land when their shot arrives) */
  | { k: "hit"; fromX: number; fromZ: number; x: number; z: number; type: UnitType; dmg: number; on: HitTarget }
  | { k: "death"; x: number; z: number; kid: number; type: UnitType }
  | { k: "dragon"; state: "spawn" | "dead"; by: number | null }
  /** a village changed hands (prev 0 = it was neutral) */
  | { k: "village"; id: number; kid: number; prev: number }
  | { k: "phase"; phase: Phase }
  | { k: "ticker"; text: string; color?: string };

export type HitTarget = "unit" | "castle" | "dragon";

export interface JoinResult {
  status: "joined" | "exists" | "queued" | "cooldown" | "next_round";
  kingdom?: Kingdom;
  waitSeconds?: number;
}

interface UserRecord {
  name: string;
  rejoinAt: number;
  reserve: UnitBundle;
  reserveUntil: number;
}

const DT = 0.05;
const NEIGH8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

export class Sim {
  readonly rng: Rng;
  t = 0;
  roundId = 1;
  phase: Phase = "LOBBY";
  phaseT = 0;
  warElapsed = 0;
  paused = false;
  extraSeconds = 0;
  kingdoms: Kingdom[] = [];
  units: Unit[] = [];
  dragon: Dragon | null = null;
  dragonSpawnedThisRound = false;
  events: SimEvent[] = [];
  joinQueue: { key: string; name: string }[] = [];
  users = new Map<string, UserRecord>();
  fallenThisRound = 0;
  podium: { key: string; name: string; color: string; score: number }[] = [];
  readonly villages: Village[];
  /** territory owner per tile (kingdom id, 0 = none) */
  readonly tileOwner: Int32Array;
  readonly tileClaim: Int32Array;
  readonly tileProgress: Float32Array;
  readonly tilesW: number;
  readonly tilesH: number;
  private nextKid = 1;
  private nextUid = 1;
  private acc = 0;
  private territoryTimer = 0;
  private healTimer = 0;
  private grid = new Map<number, Unit[]>();
  private altarField: Uint16Array;
  private colorCursor = 0;

  constructor(
    readonly cfg: GameConfig,
    readonly map: WorldMap,
    seed = 1,
  ) {
    this.rng = new Rng(seed);
    this.tilesW = Math.ceil(WORLD_W / cfg.territory.tile);
    this.tilesH = Math.ceil(WORLD_H / cfg.territory.tile);
    const n = this.tilesW * this.tilesH;
    this.tileOwner = new Int32Array(n);
    this.tileClaim = new Int32Array(n);
    this.tileProgress = new Float32Array(n);
    this.altarField = map.fieldTo(map.altar.x, map.altar.z);
    this.villages = this.placeVillages(seed);
  }

  /** Village spots come from their own rng so they do not shift the war's random sequence. */
  private placeVillages(seed: number): Village[] {
    const vc = this.cfg.villages;
    const rng = new Rng((seed * 7919 + 101) >>> 0);
    const out: Village[] = [];
    for (let i = 0; i < vc.count; i++) {
      const spot = this.map.sampleSpawn(rng, out, vc.minDist, vc.minDist * 0.6, 30);
      if (!spot) break;
      out.push({
        id: out.length + 1, name: VILLAGE_NAMES[i % VILLAGE_NAMES.length], x: spot.x, z: spot.z,
        owner: 0, claimKid: 0, progress: 0, spawnTimer: 0, field: this.map.fieldTo(spot.x, spot.z),
      });
    }
    return out;
  }

  village(id: number): Village | null {
    return this.villages[id - 1] ?? null;
  }

  /** Territory bonus to passive production: +100% at productionTiles tiles (capped). */
  productionBonus(k: Kingdom) {
    const tc = this.cfg.territory;
    return Math.min(tc.productionMaxBonus, k.tiles / tc.productionTiles);
  }

  // ---------------------------------------------------------------- queries

  get alive() {
    return this.kingdoms.filter((k) => k.alive);
  }

  kingdomByKey(key: string) {
    return this.kingdoms.find((k) => k.alive && k.key === key) ?? null;
  }

  kingdomById(id: number) {
    return this.kingdoms.find((k) => k.id === id) ?? null;
  }

  /** Match "serang budi" style names: exact key, then key/name prefix, then substring. */
  findKingdom(query: string, exceptId = 0): Kingdom | null {
    const q = query.toLowerCase().replace(/^@/, "").trim();
    if (!q) return null;
    const list = this.alive.filter((k) => k.id !== exceptId);
    return (
      list.find((k) => k.key === q) ??
      list.find((k) => k.key.startsWith(q) || k.name.toLowerCase().startsWith(q)) ??
      list.find((k) => k.key.includes(q) || k.name.toLowerCase().includes(q)) ??
      null
    );
  }

  shielded(k: Kingdom) {
    return this.phase === "LOBBY" || this.phase === "RESULT" || this.t < k.shieldUntil;
  }

  unitCap(k: Kingdom) {
    const c = this.cfg.kingdom;
    return Math.min(c.unitCapMax, c.unitCapBase + c.unitCapPerLevel * k.level);
  }

  secondsLeft() {
    const r = this.cfg.round;
    if (this.phase === "LOBBY") return Math.max(0, Math.ceil(r.lobbySeconds - this.phaseT));
    if (this.phase === "RESULT") return Math.max(0, Math.ceil(r.resultSeconds - this.phaseT));
    return Math.max(0, Math.ceil(r.warSeconds + this.extraSeconds - this.warElapsed));
  }

  leaderboard() {
    return [...this.alive].sort((a, b) => b.score - a.score);
  }

  private emit(e: SimEvent) {
    this.events.push(e);
    if (this.events.length > 500) this.events.splice(0, this.events.length - 500);
  }

  drainEvents(): SimEvent[] {
    return this.events.splice(0);
  }

  // ---------------------------------------------------------------- viewer actions

  join(key: string, name: string): JoinResult {
    const existing = this.kingdomByKey(key);
    if (existing) return { status: "exists", kingdom: existing };
    const user = this.user(key, name);
    if (this.phase === "RESULT") {
      if (!this.joinQueue.some((q) => q.key === key)) this.joinQueue.push({ key, name });
      return { status: "next_round" };
    }
    if (this.t < user.rejoinAt) return { status: "cooldown", waitSeconds: Math.ceil(user.rejoinAt - this.t) };
    if (this.alive.length >= this.cfg.kingdom.maxActive) {
      if (!this.joinQueue.some((q) => q.key === key)) this.joinQueue.push({ key, name });
      return { status: "queued" };
    }
    const taken = [...this.alive, ...this.villages.map((v) => ({ x: v.x, z: v.z }))];
    const spot = this.map.sampleSpawn(this.rng, taken, this.cfg.kingdom.spawnMinDist);
    if (!spot) {
      if (!this.joinQueue.some((q) => q.key === key)) this.joinQueue.push({ key, name });
      return { status: "queued" };
    }
    const kc = this.cfg.kingdom;
    const k: Kingdom = {
      id: this.nextKid++,
      key,
      name: user.name,
      color: this.pickColor(spot.x, spot.z),
      x: spot.x,
      z: spot.z,
      level: 1,
      exp: 0,
      nextExp: this.cfg.exp.levelBase,
      hp: kc.castleHp,
      maxHp: kc.castleHp,
      alive: true,
      shieldUntil: this.phase === "LOBBY" ? 0 : this.t + kc.shieldSeconds,
      joinedAt: this.t,
      kills: 0,
      castlesDestroyed: 0,
      tiles: 0,
      score: 0,
      passiveTimer: this.rng.next() * 2,
      towerCd: 0,
      order: null,
      orderAt: -999,
      warTargetId: 0,
      warTimer: this.rng.next() * 3,
      field: this.map.fieldTo(spot.x, spot.z),
      dragonDamage: 0,
      villages: 0,
      buffUntil: 0,
      crown: this.podium[0]?.key === key,
      unitCount: 0,
      passiveCount: 0,
      pending: [],
    };
    this.kingdoms.push(k);
    this.claimCastleTiles(k);
    this.emit({ k: "join", kid: k.id });
    this.spawnUnits(k, kc.startUnits, "start", null, false);
    if (user.reserveUntil > 0 && this.t <= user.reserveUntil) this.spawnUnits(k, user.reserve, "cadangan", user.name, true);
    user.reserve = {};
    user.reserveUntil = 0;
    return { status: "joined", kingdom: k };
  }

  /**
   * Add troops to a viewer's kingdom. Auto-joins when allowed; while the viewer waits for the
   * rejoin cooldown or a free slot, troops are kept as a reserve (60 s).
   */
  addUnits(key: string, name: string, units: UnitBundle, reason: string, autoJoin: boolean): "added" | "reserved" | "ignored" {
    let k = this.kingdomByKey(key);
    if (!k && autoJoin) {
      const r = this.join(key, name);
      k = r.kingdom ?? null;
    }
    if (!k) {
      if (!autoJoin) return "ignored";
      const u = this.user(key, name);
      for (const [t, n] of Object.entries(units) as [UnitType, number][]) u.reserve[t] = (u.reserve[t] ?? 0) + n;
      u.reserveUntil = Math.max(u.rejoinAt, this.t) + this.cfg.kingdom.reserveHoldSeconds;
      return "reserved";
    }
    this.spawnUnits(k, units, reason, name, true);
    return "added";
  }

  levelUp(key: string, n: number) {
    const k = this.kingdomByKey(key);
    if (!k) return;
    for (let i = 0; i < n; i++) this.gainExp(k, Math.max(0, k.nextExp - k.exp));
  }

  order(key: string, kind: OrderKind | "free", targetName?: string): { ok: boolean; reason?: string; target?: Kingdom } {
    const k = this.kingdomByKey(key);
    if (!k) return { ok: false, reason: "no_kingdom" };
    const oc = this.cfg.orders;
    if (this.t - k.orderAt < oc.cooldownSeconds) return { ok: false, reason: "cooldown" };
    if (kind === "free") {
      k.order = null;
      k.orderAt = this.t;
      return { ok: true };
    }
    if (kind === "attack") {
      const target = this.findKingdom(targetName ?? "", k.id);
      if (!target || this.shielded(target)) return { ok: false, reason: "no_target" };
      k.order = { kind, targetId: target.id, until: this.t + oc.durationSeconds };
      k.orderAt = this.t;
      for (const u of this.units) if (u.kid === k.id) u.retarget = 0;
      return { ok: true, target };
    }
    if (kind === "boss" && !this.dragon) return { ok: false, reason: "no_dragon" };
    k.order = { kind, targetId: 0, until: this.t + oc.durationSeconds };
    k.orderAt = this.t;
    for (const u of this.units) if (u.kid === k.id) u.retarget = 0;
    return { ok: true };
  }

  buff(key: string, seconds: number) {
    const k = this.kingdomByKey(key);
    if (k) k.buffUntil = Math.max(k.buffUntil, this.t) + seconds;
  }

  kick(key: string) {
    const k = this.kingdomByKey(key);
    if (k) this.fall(k, null);
    const u = this.users.get(key);
    if (u) u.rejoinAt = this.t + 3600;
  }

  summonDragon(byKey: string | null) {
    if (this.dragon || this.phase === "LOBBY" || this.phase === "RESULT") return false;
    const dc = this.cfg.dragon;
    const by = byKey ? this.kingdomByKey(byKey) : null;
    const hp = dc.hpBase + dc.hpPerKingdom * this.alive.length;
    this.dragon = { hp, maxHp: hp, x: this.map.altar.x, z: this.map.altar.z, cd: 2, summonedBy: by?.id ?? null, damage: new Map(), attackAt: -9 };
    this.dragonSpawnedThisRound = true;
    this.emit({ k: "dragon", state: "spawn", by: by?.id ?? null });
    return true;
  }

  // ---------------------------------------------------------------- admin

  nextPhase() {
    if (this.phase === "LOBBY") this.startWar();
    else if (this.phase === "WAR" || this.phase === "FINAL") this.endRound();
    else this.newRound();
  }

  extend(seconds: number) {
    this.extraSeconds += seconds;
  }

  resetRound() {
    this.newRound(false);
  }

  // ---------------------------------------------------------------- loop

  /** Advance by real seconds; runs fixed 50 ms steps. */
  advance(seconds: number) {
    if (this.paused) return;
    this.acc += Math.min(seconds, 0.25);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.step(DT);
    }
  }

  step(dt: number) {
    this.t += dt;
    this.phaseT += dt;
    this.updateRound();
    if (this.phase === "RESULT") return;
    this.buildGrid();
    this.updateKingdoms(dt);
    this.updateUnits(dt);
    this.updateDragon(dt);
    this.healTimer += dt;
    if (this.healTimer >= 1) {
      this.healTimer = 0;
      this.applyHeals();
    }
    this.territoryTimer += dt;
    if (this.territoryTimer >= 0.5) {
      this.updateTerritory(this.territoryTimer);
      this.territoryTimer = 0;
    }
    if (this.units.length > 600 || this.units.some((u) => !u.alive)) this.units = this.units.filter((u) => u.alive);
  }

  private updateRound() {
    const r = this.cfg.round;
    if (this.phase === "LOBBY" && this.phaseT >= r.lobbySeconds) this.startWar();
    else if (this.phase === "WAR" || this.phase === "FINAL") {
      this.warElapsed += DT;
      const total = r.warSeconds + this.extraSeconds;
      if (this.phase === "WAR" && this.warElapsed >= total - r.finalSeconds) this.setPhase("FINAL");
      if (!this.dragonSpawnedThisRound && this.warElapsed >= r.dragonAtSecond) this.summonDragon(null);
      if (this.warElapsed >= total) this.endRound();
      else if (this.fallenThisRound >= 3 && this.alive.length === 1 && this.joinQueue.length === 0) this.endRound();
    } else if (this.phase === "RESULT" && this.phaseT >= r.resultSeconds) this.newRound();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    this.emit({ k: "phase", phase: p });
  }

  private startWar() {
    this.warElapsed = 0;
    this.setPhase("WAR");
    this.emit({ k: "ticker", text: "⚔️ PERANG DIMULAI! Semua perisai turun." });
  }

  private endRound() {
    this.recomputeScores();
    this.podium = this.leaderboard()
      .slice(0, 3)
      .map((k) => ({ key: k.key, name: k.name, color: k.color, score: Math.round(k.score) }));
    this.setPhase("RESULT");
    if (this.podium[0]) this.emit({ k: "ticker", text: `👑 ${this.podium[0].name} memenangkan ronde ${this.roundId}!`, color: this.podium[0].color });
  }

  /** New round: survivors (and queued viewers) re-enter at fresh random spots with equal start. */
  private newRound(carry = true) {
    const carryList = carry ? [...this.alive.map((k) => ({ key: k.key, name: k.name })), ...this.joinQueue] : [];
    this.kingdoms = [];
    this.units = [];
    this.dragon = null;
    this.dragonSpawnedThisRound = false;
    this.joinQueue = [];
    this.fallenThisRound = 0;
    this.extraSeconds = 0;
    this.warElapsed = 0;
    this.tileOwner.fill(0);
    this.tileClaim.fill(0);
    this.tileProgress.fill(0);
    for (const v of this.villages) {
      v.owner = 0;
      v.claimKid = 0;
      v.progress = 0;
      v.spawnTimer = 0;
    }
    for (const u of this.users.values()) u.rejoinAt = 0;
    this.roundId++;
    this.setPhase("LOBBY");
    const seen = new Set<string>();
    for (const c of carryList) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      this.join(c.key, c.name);
    }
  }

  // ---------------------------------------------------------------- kingdoms

  private user(key: string, name: string): UserRecord {
    let u = this.users.get(key);
    if (!u) {
      u = { name, rejoinAt: 0, reserve: {}, reserveUntil: 0 };
      this.users.set(key, u);
    }
    if (name && name !== "anon") u.name = name;
    return u;
  }

  /** Pick the banner colour that differs most from the 3 nearest kingdoms. */
  private pickColor(x: number, z: number) {
    const near = [...this.alive].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, 3);
    const used = new Set(near.map((k) => k.color));
    for (let i = 0; i < BANNER_COLORS.length; i++) {
      const c = BANNER_COLORS[(this.colorCursor + i) % BANNER_COLORS.length];
      if (!used.has(c)) {
        this.colorCursor = (this.colorCursor + i + 1) % BANNER_COLORS.length;
        return c;
      }
    }
    return BANNER_COLORS[this.colorCursor++ % BANNER_COLORS.length];
  }

  private spawnUnits(k: Kingdom, units: UnitBundle, reason: string, from: string | null, gift: boolean) {
    const added: UnitBundle = {};
    for (const [type, count] of Object.entries(units) as [UnitType, number][]) {
      for (let i = 0; i < count; i++) {
        if (this.canSpawn(k)) {
          this.makeUnit(k, type, false, from);
          added[type] = (added[type] ?? 0) + 1;
        } else k.pending.push({ type, until: this.t + this.cfg.kingdom.reserveHoldSeconds, from: from ?? "" });
      }
    }
    if (gift && from) this.emit({ k: "troops", kid: k.id, units, from, reason });
  }

  private canSpawn(k: Kingdom) {
    return k.unitCount < this.unitCap(k) && this.units.length < this.cfg.units.global;
  }

  private makeUnit(k: Kingdom, type: UnitType, passive: boolean, from: string | null, at?: { x: number; z: number }): Unit {
    const st = this.cfg.unitTypes[type];
    const ec = this.cfg.exp;
    const a = this.rng.next() * Math.PI * 2;
    const r = at ? 0 : 3.2 + this.rng.next() * 1.2;
    const hp = st.hp + ec.unitHpPerLevel * (k.level - 1);
    const u: Unit = {
      id: this.nextUid++,
      kid: k.id,
      type,
      x: (at?.x ?? k.x) + Math.cos(a) * r,
      z: (at?.z ?? k.z) + Math.sin(a) * r,
      hp,
      maxHp: hp,
      dmg: st.dmg + ec.unitDmgPerLevel * (k.level - 1),
      alive: true,
      passive,
      atkCd: this.rng.next() * 0.5,
      retarget: 0,
      tKind: null,
      tId: 0,
      heading: a,
      moving: false,
      attackAt: -9,
      hitAt: -9,
      raised: 0,
      bornAt: this.t,
      from,
    };
    this.units.push(u);
    k.unitCount++;
    if (passive) k.passiveCount++;
    return u;
  }

  private updateKingdoms(dt: number) {
    const pc = this.cfg.passive;
    const war = this.phase === "WAR" || this.phase === "FINAL";
    for (const k of this.kingdoms) {
      if (!k.alive) continue;
      if (k.order && this.t > k.order.until) k.order = null;
      // pending troops (cap overflow) leave as soon as there is room; expired ones become a war buff
      if (k.pending.length) {
        for (let i = 0; i < k.pending.length; i++) {
          const p = k.pending[i];
          if (this.canSpawn(k)) {
            this.makeUnit(k, p.type, false, p.from || null);
            k.pending.splice(i--, 1);
          } else if (this.t > p.until) {
            k.pending.splice(i--, 1);
            k.buffUntil = Math.max(k.buffUntil, this.t) + 6;
            k.hp = Math.min(k.maxHp, k.hp + this.cfg.unitTypes[p.type].hp * 0.25);
          }
        }
      }
      // passive production
      k.passiveTimer += dt * (this.phase === "FINAL" ? pc.finalMultiplier : 1) * (1 + this.productionBonus(k));
      if (k.passiveTimer >= pc.everySeconds) {
        k.passiveTimer = 0;
        if (k.passiveCount < pc.maxUnits && this.canSpawn(k)) {
          const unlock = [...pc.unlocks].reverse().find((u) => k.level >= u.level) ?? pc.unlocks[0];
          this.makeUnit(k, this.rng.pick(unlock.units), true, null);
        }
      }
      if (!war) continue;
      // castle tower
      k.towerCd -= dt;
      if (k.towerCd <= 0) {
        const kc = this.cfg.kingdom;
        const target = this.nearestEnemyUnit(k.x, k.z, kc.towerRange + k.level * 0.3, k.id);
        if (target) {
          k.towerCd = kc.towerCooldown;
          const tdmg = kc.towerDamage + kc.towerDamagePerLevel * k.level;
          this.emit({ k: "shot", fromX: k.x, fromZ: k.z, x: target.x, z: target.z, type: "tower", dmg: tdmg, on: "unit" });
          this.damageUnit(target, tdmg, k, true);
        }
      }
      // war target
      k.warTimer -= dt;
      if (k.warTimer <= 0) {
        k.warTimer = this.cfg.kingdom.warTargetEverySeconds;
        k.warTargetId = this.pickWarTarget(k);
      }
    }
  }

  private pickWarTarget(k: Kingdom): number {
    const leader = this.leaderboard()[0];
    let best = 0;
    let bestScore = Infinity;
    for (const o of this.kingdoms) {
      if (!o.alive || o.id === k.id || this.shielded(o)) continue;
      const d = k.field[this.map.cellAt(o.x, o.z)];
      if (d === 65535) continue;
      let s = d * (0.8 + this.rng.next() * 0.4);
      if (leader && o.id === leader.id && o.id !== k.id) s *= 1 - this.cfg.hunted.weight;
      if (s < bestScore) {
        bestScore = s;
        best = o.id;
      }
    }
    return best;
  }

  private gainExp(k: Kingdom, amount: number) {
    const ec = this.cfg.exp;
    k.exp += amount;
    while (k.exp >= k.nextExp && k.level < ec.maxLevel) {
      k.exp -= k.nextExp;
      k.level++;
      k.nextExp = Math.round(k.nextExp * ec.levelGrowth);
      k.maxHp += this.cfg.kingdom.castleHpPerLevel;
      k.hp = k.maxHp;
      this.emit({ k: "level", kid: k.id, level: k.level });
    }
    if (k.level >= ec.maxLevel) k.exp = Math.min(k.exp, k.nextExp);
  }

  private fall(k: Kingdom, by: Kingdom | null) {
    if (!k.alive) return;
    k.alive = false;
    k.hp = 0;
    for (const u of this.units) if (u.alive && u.kid === k.id) {
      u.alive = false;
      this.emit({ k: "death", x: u.x, z: u.z, kid: u.kid, type: u.type });
    }
    k.unitCount = 0;
    k.passiveCount = 0;
    k.pending = [];
    for (let i = 0; i < this.tileOwner.length; i++) if (this.tileOwner[i] === k.id) {
      this.tileOwner[i] = 0;
      this.tileProgress[i] = 0;
    }
    for (const v of this.villages) {
      if (v.owner === k.id) v.owner = 0;
      if (v.claimKid === k.id) {
        v.claimKid = 0;
        v.progress = 0;
      }
    }
    if (by) {
      by.castlesDestroyed++;
      this.gainExp(by, this.cfg.exp.castleBase + this.cfg.exp.castlePerLevel * k.level);
    }
    this.fallenThisRound++;
    const u = this.user(k.key, k.name);
    u.rejoinAt = this.t + this.cfg.kingdom.rejoinCooldownSeconds;
    this.emit({ k: "fall", kid: k.id, by: by?.id ?? null });
    // free slot: let the next queued viewer in
    while (this.joinQueue.length && this.alive.length < this.cfg.kingdom.maxActive) {
      const q = this.joinQueue.shift()!;
      if (this.join(q.key, q.name).status === "joined") break;
    }
  }

  // ---------------------------------------------------------------- units

  private buildGrid() {
    this.grid.clear();
    for (const u of this.units) {
      if (!u.alive) continue;
      const key = Math.floor(u.x / 4) * 1000 + Math.floor(u.z / 4);
      let list = this.grid.get(key);
      if (!list) this.grid.set(key, (list = []));
      list.push(u);
    }
  }

  private forNear(x: number, z: number, r: number, fn: (u: Unit) => void) {
    const x0 = Math.floor((x - r) / 4);
    const x1 = Math.floor((x + r) / 4);
    const z0 = Math.floor((z - r) / 4);
    const z1 = Math.floor((z + r) / 4);
    for (let gx = x0; gx <= x1; gx++)
      for (let gz = z0; gz <= z1; gz++) {
        const list = this.grid.get(gx * 1000 + gz);
        if (list) for (const u of list) if (u.alive) fn(u);
      }
  }

  private isEnemy(u: Unit, kid: number) {
    if (u.kid === kid) return false;
    const k = this.kingdomById(u.kid);
    return !!k && k.alive && !this.shielded(k);
  }

  private nearestEnemyUnit(x: number, z: number, r: number, kid: number): Unit | null {
    let best: Unit | null = null;
    let bd = r;
    this.forNear(x, z, r, (o) => {
      if (!this.isEnemy(o, kid)) return;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    });
    return best;
  }

  private chooseTarget(u: Unit, k: Kingdom) {
    const uc = this.cfg.units;
    u.tKind = "home";
    u.tId = 0;
    if (this.shielded(k)) return;
    const dr = this.dragon;
    if (dr) {
      const d = Math.hypot(dr.x - u.x, dr.z - u.z);
      if (k.order?.kind === "boss" || d < this.cfg.dragon.pullRange) {
        u.tKind = "dragon";
        return;
      }
    }
    const order = k.order;
    if (order?.kind === "defend") {
      const e = this.nearestEnemyUnit(k.x, k.z, this.cfg.orders.defendRadius + 4, k.id);
      if (e) {
        u.tKind = "unit";
        u.tId = e.id;
      }
      return;
    }
    const near = this.nearestEnemyUnit(u.x, u.z, uc.aggroRange, k.id);
    if (near) {
      u.tKind = "unit";
      u.tId = near.id;
      return;
    }
    // expansion: on the "ekspansi" order everyone goes; otherwise small garrisons and a share
    // of the passive troops take villages near home
    const vc = this.cfg.villages;
    const homebody = u.passive && k.unitCount < this.cfg.kingdom.marchAtUnits;
    const v =
      order?.kind === "expand"
        ? this.nearestVillage(u.x, u.z, k, Infinity)
        : !order && (homebody || (u.passive && u.id % vc.expandShare === 0))
          ? this.nearestVillage(k.x, k.z, k, vc.expandRange)
          : null;
    if (v) {
      u.tKind = "village";
      u.tId = v.id;
      return;
    }
    const castleId = order?.kind === "attack" ? order.targetId : u.passive && k.unitCount < this.cfg.kingdom.marchAtUnits ? 0 : k.warTargetId;
    const target = castleId ? this.kingdomById(castleId) : null;
    if (target && target.alive && !this.shielded(target)) {
      u.tKind = "castle";
      u.tId = target.id;
    }
  }

  /** Closest village not held by k within range of (x, z). */
  private nearestVillage(x: number, z: number, k: Kingdom, range: number): Village | null {
    let best: Village | null = null;
    let bd = range;
    for (const v of this.villages) {
      if (v.owner === k.id) continue;
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  private updateUnits(dt: number) {
    const war = this.phase === "WAR" || this.phase === "FINAL";
    const byId = new Map<number, Unit>();
    for (const u of this.units) if (u.alive) byId.set(u.id, u);
    for (const u of this.units) {
      if (!u.alive) continue;
      const k = this.kingdomById(u.kid);
      if (!k || !k.alive) {
        u.alive = false;
        continue;
      }
      const st = this.cfg.unitTypes[u.type];
      u.atkCd -= dt;
      u.retarget -= dt;
      if (u.retarget <= 0) {
        u.retarget = this.cfg.units.retargetSeconds * (0.8 + this.rng.next() * 0.4);
        if (war) this.chooseTarget(u, k);
        else u.tKind = "home";
      }
      // resolve target position
      let tx = k.x;
      let tz = k.z;
      let reach = 4.5;
      let tUnit: Unit | undefined;
      let tCastle: Kingdom | null = null;
      if (u.tKind === "unit") {
        tUnit = byId.get(u.tId);
        if (!tUnit || !this.isEnemy(tUnit, k.id)) {
          u.retarget = 0;
          tUnit = undefined;
        } else {
          tx = tUnit.x;
          tz = tUnit.z;
          reach = st.range + 0.4;
        }
      } else if (u.tKind === "castle") {
        tCastle = this.kingdomById(u.tId);
        if (!tCastle || !tCastle.alive || this.shielded(tCastle)) {
          u.retarget = 0;
          tCastle = null;
        } else {
          tx = tCastle.x;
          tz = tCastle.z;
          reach = st.range + 2.2;
        }
      } else if (u.tKind === "dragon" && this.dragon) {
        tx = this.dragon.x;
        tz = this.dragon.z;
        reach = st.range + 3;
      } else if (u.tKind === "village") {
        const v = this.village(u.tId);
        if (!v || v.owner === k.id) {
          u.retarget = 0;
          u.tKind = "home";
        } else {
          // spread out inside the village so the whole squad counts
          const a = (u.id * 2.39996) % (Math.PI * 2);
          const ring = 1 + (u.id % 3) * 1.3;
          tx = v.x + Math.cos(a) * ring;
          tz = v.z + Math.sin(a) * ring;
          reach = 0.6;
        }
      }
      if (u.tKind === "home" || (!tUnit && !tCastle && u.tKind !== "dragon" && u.tKind !== "village")) {
        // guard ring around own castle
        const a = (u.id * 2.39996) % (Math.PI * 2);
        const ring = 4.5 + (u.id % 3) * 1.2;
        tx = k.x + Math.cos(a) * ring;
        tz = k.z + Math.sin(a) * ring;
        reach = 0.6;
      }
      const dist = Math.hypot(tx - u.x, tz - u.z);
      if (dist > reach) {
        this.moveUnit(u, k, tx, tz, tCastle, st.speed * dt * this.map.speedFactor(u.x, u.z) * (st.flying ? 1 / this.map.speedFactor(u.x, u.z) : 1), !!st.flying);
        u.moving = true;
      } else {
        u.moving = false;
        if (u.tKind !== "home") u.heading = Math.atan2(tx - u.x, tz - u.z);
        if (war && u.atkCd <= 0 && (tUnit || tCastle || (u.tKind === "dragon" && this.dragon))) {
          u.atkCd = this.cfg.units.attackCooldown * (0.9 + this.rng.next() * 0.2);
          u.attackAt = this.t;
          let dmg = u.dmg * (0.9 + this.rng.next() * 0.2);
          if (this.t < k.buffUntil) dmg *= 1.2;
          if (this.hasAura(u, k)) dmg *= 1 + (this.cfg.unitTypes.demon.aura ?? 0);
          const on: HitTarget = tUnit ? "unit" : tCastle ? "castle" : "dragon";
          if (st.ranged || u.type === "dragon") this.emit({ k: "shot", fromX: u.x, fromZ: u.z, x: tx, z: tz, type: u.type, dmg, on });
          else this.emit({ k: "hit", fromX: u.x, fromZ: u.z, x: tx, z: tz, type: u.type, dmg, on });
          if (tUnit) {
            this.damageUnit(tUnit, dmg, k, !!st.ranged, u);
            if (st.splash) this.forNear(tUnit.x, tUnit.z, st.splash, (o) => o !== tUnit && this.isEnemy(o, k.id) && this.damageUnit(o, dmg * 0.5, k, true, u));
          } else if (tCastle) {
            tCastle.hp -= dmg;
            if (tCastle.hp <= 0) this.fall(tCastle, k);
          } else if (this.dragon) {
            const bonus = this.dragon.summonedBy === k.id ? 1 + this.cfg.dragon.giftDamageBonus : 1;
            this.dragon.hp -= dmg * bonus;
            this.dragon.damage.set(k.id, (this.dragon.damage.get(k.id) ?? 0) + dmg * bonus);
            if (this.dragon.hp <= 0) this.killDragon();
          }
        }
      }
    }
    this.separate(dt);
  }

  private hasAura(u: Unit, k: Kingdom) {
    const range = this.cfg.unitTypes.demon.auraRange ?? 0;
    let found = false;
    this.forNear(u.x, u.z, range, (o) => {
      if (!found && o.type === "demon" && o.kid === k.id && o !== u && Math.hypot(o.x - u.x, o.z - u.z) <= range) found = true;
    });
    return found;
  }

  /** Walk toward a point. Castles use the target kingdom's BFS field so units route around water. */
  private moveUnit(u: Unit, k: Kingdom, tx: number, tz: number, tCastle: Kingdom | null, step: number, flying: boolean) {
    let dx = tx - u.x;
    let dz = tz - u.z;
    if (!flying) {
      const field = tCastle
        ? tCastle.field
        : u.tKind === "dragon"
          ? this.altarField
          : u.tKind === "home"
            ? k.field
            : u.tKind === "village"
              ? (this.village(u.tId)?.field ?? null)
              : null;
      const direct = Math.hypot(dx, dz);
      const nx = u.x + (dx / (direct || 1)) * Math.max(step, 0.8);
      const nz = u.z + (dz / (direct || 1)) * Math.max(step, 0.8);
      const blocked = !this.map.walkable(this.map.cellAt(nx, nz));
      if (field && (blocked || direct > 10)) {
        const c = this.map.cellAt(u.x, u.z);
        const cx = c % GRID_W;
        const cz = (c / GRID_W) | 0;
        let best = field[c];
        let bx = 0;
        let bz = 0;
        for (const [ox, oz] of NEIGH8) {
          const x = cx + ox;
          const z = cz + oz;
          if (x < 0 || z < 0 || x >= GRID_W || z * GRID_W >= field.length) continue;
          const i = z * GRID_W + x;
          if (field[i] >= best) continue;
          if (ox && oz && (!this.map.walkable(cz * GRID_W + x) || !this.map.walkable(z * GRID_W + cx))) continue;
          best = field[i];
          bx = ox;
          bz = oz;
        }
        if (bx || bz) {
          const p = this.map.cellCenter(c);
          dx = p.x + bx * CELL - u.x;
          dz = p.z + bz * CELL - u.z;
        }
      } else if (blocked) {
        // slide: try rotating the direction left/right
        for (const rot of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const a = Math.atan2(dx, dz) + rot;
          if (this.map.walkable(this.map.cellAt(u.x + Math.sin(a) * 1, u.z + Math.cos(a) * 1))) {
            dx = Math.sin(a);
            dz = Math.cos(a);
            break;
          }
        }
      }
    }
    const len = Math.hypot(dx, dz) || 1;
    const nx = u.x + (dx / len) * step;
    const nz = u.z + (dz / len) * step;
    if (flying || this.map.walkable(this.map.cellAt(nx, nz))) {
      u.x = nx;
      u.z = nz;
    }
    u.heading = Math.atan2(dx, dz);
  }

  /** Light push-apart so crowds do not stack into one point. */
  private separate(dt: number) {
    const r = this.cfg.units.separation;
    for (const u of this.units) {
      if (!u.alive) continue;
      let px = 0;
      let pz = 0;
      this.forNear(u.x, u.z, r, (o) => {
        if (o === u) return;
        const dx = u.x - o.x;
        const dz = u.z - o.z;
        const d = Math.hypot(dx, dz);
        if (d > 0 && d < r) {
          px += (dx / d) * (r - d);
          pz += (dz / d) * (r - d);
        } else if (d === 0) px += (u.id % 2 ? 1 : -1) * 0.1;
      });
      if (px || pz) {
        const nx = u.x + px * dt * 4;
        const nz = u.z + pz * dt * 4;
        if (this.cfg.unitTypes[u.type].flying || this.map.walkable(this.map.cellAt(nx, nz))) {
          u.x = nx;
          u.z = nz;
        }
      }
    }
  }

  private damageUnit(target: Unit, dmg: number, by: Kingdom, ranged: boolean, attacker?: Unit) {
    if (!target.alive) return false;
    const resist = ranged ? this.cfg.unitTypes[target.type].arrowResist ?? 0 : 0;
    const forest = ranged && this.map.biomeAt(target.x, target.z) === "forest" ? 0.2 : 0;
    target.hp -= dmg * (1 - resist) * (1 - forest);
    target.hitAt = this.t;
    if (target.hp > 0) return false;
    target.alive = false;
    const owner = this.kingdomById(target.kid);
    if (owner) {
      owner.unitCount = Math.max(0, owner.unitCount - 1);
      if (target.passive) owner.passiveCount = Math.max(0, owner.passiveCount - 1);
    }
    this.emit({ k: "death", x: target.x, z: target.z, kid: target.kid, type: target.type });
    by.kills++;
    const ec = this.cfg.exp;
    this.gainExp(by, ec.killBase + target.maxHp * ec.killPerMaxHp);
    // necromancers raise the fallen as skeletons
    if (target.type !== "skeleton") {
      let necro: Unit | null = null;
      this.forNear(target.x, target.z, 6, (o) => {
        if (!necro && o.kid === by.id && o.type === "necromancer" && o.raised < (this.cfg.unitTypes.necromancer.raise ?? 0)) necro = o;
      });
      if (necro && this.units.length < this.cfg.units.global) {
        (necro as Unit).raised++;
        const s = this.makeUnit(by, "skeleton", false, null, { x: target.x, z: target.z });
        s.passive = false;
      }
    }
    void attacker;
    return true;
  }

  private applyHeals() {
    for (const u of this.units) {
      if (!u.alive || u.type !== "paladin") continue;
      const st = this.cfg.unitTypes.paladin;
      this.forNear(u.x, u.z, st.healRange ?? 4, (o) => {
        if (o.kid === u.kid && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + (st.heal ?? 0));
      });
    }
  }

  // ---------------------------------------------------------------- dragon

  private updateDragon(dt: number) {
    const d = this.dragon;
    if (!d) return;
    d.cd -= dt;
    if (d.cd > 0) return;
    const dc = this.cfg.dragon;
    let target: Unit | null = null;
    let bd = dc.range;
    this.forNear(d.x, d.z, dc.range, (o) => {
      const dist = Math.hypot(o.x - d.x, o.z - d.z);
      if (dist < bd) {
        bd = dist;
        target = o;
      }
    });
    if (!target) return;
    const t: Unit = target;
    d.cd = dc.cooldown;
    d.attackAt = this.t;
    this.emit({ k: "shot", fromX: d.x, fromZ: d.z, x: t.x, z: t.z, type: "dragon", dmg: dc.dmg, on: "unit" });
    this.forNear(t.x, t.z, dc.splash, (o) => {
      if (Math.hypot(o.x - t.x, o.z - t.z) > dc.splash) return;
      o.hp -= dc.dmg;
      o.hitAt = this.t;
      if (o.hp <= 0 && o.alive) {
        o.alive = false;
        const owner = this.kingdomById(o.kid);
        if (owner) {
          owner.unitCount = Math.max(0, owner.unitCount - 1);
          if (o.passive) owner.passiveCount = Math.max(0, owner.passiveCount - 1);
        }
        this.emit({ k: "death", x: o.x, z: o.z, kid: o.kid, type: o.type });
      }
    });
  }

  private killDragon() {
    const d = this.dragon!;
    let best: Kingdom | null = null;
    let bd = 0;
    for (const [kid, dmg] of d.damage) {
      const k = this.kingdomById(kid);
      if (k && k.alive && dmg > bd) {
        bd = dmg;
        best = k;
      }
    }
    this.dragon = null;
    if (best) {
      best.dragonDamage += bd;
      this.gainExp(best, this.cfg.dragon.rewardExp);
      this.makeUnit(best, "dragon", false, null, { x: d.x, z: d.z });
    }
    this.emit({ k: "dragon", state: "dead", by: best?.id ?? null });
  }

  // ---------------------------------------------------------------- territory and score

  private tileIndex(x: number, z: number) {
    const t = this.cfg.territory.tile;
    const tx = Math.floor((x + WORLD_W / 2) / t);
    const tz = Math.floor((z + WORLD_H / 2) / t);
    if (tx < 0 || tz < 0 || tx >= this.tilesW || tz >= this.tilesH) return -1;
    return tz * this.tilesW + tx;
  }

  private claimCastleTiles(k: Kingdom) {
    this.claimTiles(k.id, k.x, k.z, this.cfg.territory.castleRadius);
  }

  private claimTiles(kid: number, x: number, z: number, r: number) {
    const t = this.cfg.territory.tile;
    for (let dz = -r; dz <= r; dz += t)
      for (let dx = -r; dx <= r; dx += t) {
        if (Math.hypot(dx, dz) > r) continue;
        const i = this.tileIndex(x + dx, z + dz);
        if (i < 0 || !this.map.walkable(this.map.cellAt(x + dx, z + dz))) continue;
        this.tileOwner[i] = kid;
        this.tileProgress[i] = this.cfg.territory.captureSeconds;
      }
  }

  private updateVillages(dt: number) {
    const vc = this.cfg.villages;
    const war = this.phase === "WAR" || this.phase === "FINAL";
    for (const v of this.villages) {
      if (v.owner && !this.kingdomById(v.owner)?.alive) v.owner = 0;
      if (war) {
        const present = new Map<number, number>();
        this.forNear(v.x, v.z, vc.radius, (u) => {
          if (u.type === "dragon" || Math.hypot(u.x - v.x, u.z - v.z) > vc.radius) return;
          present.set(u.kid, (present.get(u.kid) ?? 0) + 1);
        });
        if (present.size === 1) {
          const [kid] = present.keys();
          if (kid === v.owner) {
            v.claimKid = 0;
            v.progress = 0;
          } else {
            if (v.claimKid !== kid) {
              v.claimKid = kid;
              v.progress = 0;
            }
            v.progress += dt;
            if (v.progress >= vc.captureSeconds) this.captureVillage(v, kid);
          }
        } else if (present.size === 0 && v.progress > 0) {
          v.progress = Math.max(0, v.progress - dt);
          if (v.progress === 0) v.claimKid = 0;
        }
      }
      if (!v.owner) continue;
      const k = this.kingdomById(v.owner)!;
      this.claimTiles(k.id, v.x, v.z, vc.claimRadius);
      if (!war) continue;
      v.spawnTimer += dt;
      if (v.spawnTimer >= vc.spawnEverySeconds) {
        v.spawnTimer = 0;
        if (this.canSpawn(k)) this.makeUnit(k, vc.spawnUnit as UnitType, false, null, { x: v.x, z: v.z });
      }
    }
  }

  private captureVillage(v: Village, kid: number) {
    const k = this.kingdomById(kid);
    if (!k || !k.alive) return;
    const prev = v.owner;
    v.owner = kid;
    v.claimKid = 0;
    v.progress = 0;
    v.spawnTimer = 0;
    this.gainExp(k, this.cfg.villages.captureExp);
    this.emit({ k: "village", id: v.id, kid, prev });
    for (const u of this.units) if (u.kid === kid && u.tKind === "village" && u.tId === v.id) u.retarget = 0;
  }

  private updateTerritory(dt: number) {
    const presence = new Map<number, Map<number, number>>();
    for (const u of this.units) {
      if (!u.alive || u.type === "dragon") continue;
      const i = this.tileIndex(u.x, u.z);
      if (i < 0) continue;
      let m = presence.get(i);
      if (!m) presence.set(i, (m = new Map()));
      m.set(u.kid, (m.get(u.kid) ?? 0) + 1);
    }
    const cap = this.cfg.territory.captureSeconds;
    for (const [i, m] of presence) {
      if (m.size !== 1) continue;
      const [kid] = m.keys();
      if (this.tileOwner[i] === kid) continue;
      if (this.tileClaim[i] !== kid) {
        this.tileClaim[i] = kid;
        this.tileProgress[i] = 0;
      }
      this.tileProgress[i] += dt;
      if (this.tileProgress[i] >= cap) this.tileOwner[i] = kid;
    }
    this.updateVillages(dt);
    for (const k of this.alive) this.claimCastleTiles(k);
    this.recomputeScores();
  }

  recomputeScores() {
    const counts = new Map<number, number>();
    for (let i = 0; i < this.tileOwner.length; i++) if (this.tileOwner[i]) counts.set(this.tileOwner[i], (counts.get(this.tileOwner[i]) ?? 0) + 1);
    const held = new Map<number, number>();
    for (const v of this.villages) if (v.owner) held.set(v.owner, (held.get(v.owner) ?? 0) + 1);
    const sc = this.cfg.score;
    for (const k of this.kingdoms) {
      k.tiles = counts.get(k.id) ?? 0;
      k.villages = held.get(k.id) ?? 0;
      k.score =
        k.tiles * sc.perTile + k.level * sc.perLevel + k.kills * sc.perKill + k.castlesDestroyed * sc.perCastle + k.villages * sc.perVillage;
    }
  }

  unitTypesPresent(): UnitType[] {
    const s = new Set<UnitType>();
    for (const u of this.units) if (u.alive) s.add(u.type);
    return UNIT_TYPES.filter((t) => s.has(t));
  }
}
