// EMPIRE simulation: kingdoms, units, combat, territory, dragon, rounds.
// Pure TS and deterministic for a given seed and input order. Rendering reads its state and events.
import { BANNER_COLORS, UNIT_TYPES, type GameConfig, type SpellId, type UnitBundle, type UnitType } from "./config";
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
  /** Amarah Perang: troops hit harder and march faster until this time */
  rageUntil: number;
  /** earliest time the next queued spell may be cast */
  spellAt: number;
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
  tKind: "unit" | "castle" | "dragon" | "home" | "village" | "build" | null;
  tId: number;
  heading: number;
  moving: boolean;
  attackAt: number;
  /** sim time of the last damage taken (render hit flash) */
  hitAt: number;
  raised: number;
  bornAt: number;
  from: string | null;
  /** stealth units become targetable after their first attack or the first damage they take */
  revealed: boolean;
  trampleCd: number;
  /** spell effects, as the sim time they end: on fire, poisoned, slowed by frost, stunned by lightning */
  burnUntil: number;
  poisonUntil: number;
  chillUntil: number;
  stunUntil: number;
  /** kingdom that gets the kills of burn and poison */
  dotKid: number;
}

/** Lingering spell area: frost slows and bites, poison keeps hurting after leaving the cloud. */
export interface Zone {
  spell: "frost" | "poison";
  kid: number;
  x: number;
  z: number;
  r: number;
  until: number;
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
  /** watchtower built by an Engineer; lost when the village changes hands */
  tower: boolean;
  /** seconds of building done */
  build: number;
  towerCd: number;
}

const VILLAGE_NAMES = [
  "Sukamaju", "Karangsari", "Wanareja", "Lembahhijau", "Batuputih", "Sidomulyo", "Tanjungsari", "Mekarjaya",
  "Pasirlaut", "Gunungsari", "Sumberjaya", "Rawabening", "Ciranjang", "Kedungwaru", "Jatimulya", "Bukitasri",
  "Telagamas", "Padangrumput", "Sukaraja", "Mandalasari",
];

/** The world boss: the World Dragon of every round, or a milestone boss (Naga Purba, the Titan). */
export type BossKind = "dragon" | "elder" | "titan";
export const BOSS_NAME: Record<BossKind, string> = { dragon: "Naga Dunia", elder: "Naga Purba", titan: "Titan Neraka" };

export interface Dragon {
  kind: BossKind;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  cd: number;
  summonedBy: number | null;
  damage: Map<number, number>;
  attackAt: number;
  /** body radius: melee troops strike from this far */
  radius: number;
  /** where it is heading (Naga Purba and the Titan move), and the kingdom it hunts */
  tx: number;
  tz: number;
  prey: number;
  retargetAt: number;
  /** seconds to its special attack (inferno, quake) */
  special: number;
  /** the Titan leaves at this time if it still stands */
  until: number;
  /** a blow being wound up: it lands at `at` on (x, z) */
  windup: { act: "slam" | "quake"; at: number; x: number; z: number } | null;
  /** likes per viewer waiting to become a shot (Titan) */
  likes: Map<string, number>;
  lastHit: number;
}

/** A meteor, a mother meteor or a burst of hellfire on its way; kid 0 = nobody's (world events). */
interface Strike {
  kid: number;
  x: number;
  z: number;
  at: number;
  r?: number;
  dmg?: number;
  castle?: number;
}

export type StrikeStyle = "meteor" | "mother" | "inferno";

export type SimEvent =
  | { k: "join"; kid: number }
  | { k: "fall"; kid: number; by: number | null }
  | { k: "troops"; kid: number; units: UnitBundle; from: string; reason: string }
  | { k: "level"; kid: number; level: number }
  | { k: "shot"; fromX: number; fromZ: number; x: number; z: number; type: UnitType | "tower" | "dragon"; dmg: number; on: HitTarget; id?: number }
  /** melee blow landed (ranged hits land when their shot arrives) */
  | { k: "hit"; fromX: number; fromZ: number; x: number; z: number; type: UnitType; dmg: number; on: HitTarget }
  /** id and heading let the renderer leave a corpse; they do not affect the sim */
  | { k: "death"; x: number; z: number; kid: number; type: UnitType; id: number; heading: number }
  | { k: "dragon"; state: "spawn" | "dead" | "leave"; by: number | null; kind: BossKind; x: number; z: number }
  /** a boss move: a blow wound up or landing, a quake, the Titan's last rampage, a roar */
  | { k: "boss"; kind: BossKind; act: "windup" | "slam" | "quakeWindup" | "quake" | "rampage" | "roar" | "inferno"; x: number; z: number; r: number }
  /** a viewer's like hits the boss (the Titan): from (fromX, fromZ), credited to kid (0 = no kingdom) */
  | { k: "likeShot"; fromX: number; fromZ: number; x: number; z: number; dmg: number; kid: number; name: string }
  /** Hujan Meteor Dunia: warning, then `seconds` of meteors and the mother meteor on (x, z) */
  | { k: "doom"; warn: number; seconds: number; x: number; z: number; target: number | null }
  /** a village changed hands (prev 0 = it was neutral) */
  | { k: "village"; id: number; kid: number; prev: number }
  | { k: "tower"; id: number; kid: number }
  /** a spell was cast: (x, z) is its centre, r its reach, seconds how long it lasts (0 = instant) */
  | { k: "spell"; spell: SpellId; kid: number; x: number; z: number; r: number; seconds: number; from: string }
  /** a meteor is on its way and lands after `delay` seconds */
  | { k: "strike"; x: number; z: number; r: number; delay: number; style?: StrikeStyle }
  | { k: "impact"; x: number; z: number; r: number; dmg: number }
  /** lightning: first point is struck from the sky, the rest are jumps between units */
  | { k: "chain"; kid: number; points: { x: number; z: number; dmg: number }[] }
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
  zones: Zone[] = [];
  private strikes: Strike[] = [];
  /** Hujan Meteor Dunia runs until this time */
  doomUntil = -1;
  private spellQueue: { key: string; spell: SpellId; from: string }[] = [];
  private spellTimer = 0;

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
        tower: false, build: 0, towerCd: 0,
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
      rageUntil: 0,
      spellAt: 0,
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

  /**
   * Queue a spell for a kingdom. It is cast as soon as the war is on, the kingdom's cooldown has
   * passed and (for attack spells) there is something to hit.
   */
  castSpell(key: string, name: string, spell: SpellId): "queued" | "ignored" {
    if (!this.kingdomByKey(key) || this.spellQueue.length >= 60) return "ignored";
    this.spellQueue.push({ key, spell, from: name });
    return "queued";
  }

  kick(key: string) {
    const k = this.kingdomByKey(key);
    if (k) this.fall(k, null);
    const u = this.users.get(key);
    if (u) u.rejoinAt = this.t + 3600;
  }

  summonDragon(byKey: string | null) {
    return this.summonBoss("dragon", byKey);
  }

  /**
   * Bring a world boss to the altar. Only one boss at a time: a second one is refused (the World
   * Dragon of the round simply comes later).
   */
  summonBoss(kind: BossKind, byKey: string | null = null) {
    if (this.dragon || this.phase === "LOBBY" || this.phase === "RESULT") return false;
    const dc = this.cfg.dragon;
    const by = byKey ? this.kingdomByKey(byKey) : null;
    const mult = kind === "elder" ? this.cfg.elder.hpMultiplier : kind === "titan" ? this.cfg.titan.hpMultiplier : 1;
    const hp = Math.round((dc.hpBase + dc.hpPerKingdom * this.alive.length) * mult);
    const { x, z } = this.map.altar;
    this.dragon = {
      kind, hp, maxHp: hp, x, z, cd: kind === "dragon" ? 2 : 4, summonedBy: by?.id ?? null, damage: new Map(), attackAt: -9,
      radius: kind === "titan" ? this.cfg.titan.radius : 3, tx: x, tz: z, prey: 0, retargetAt: this.t + 3,
      special: kind === "elder" ? this.cfg.elder.infernoEvery : this.cfg.titan.quakeEvery,
      until: kind === "titan" ? this.t + this.cfg.titan.seconds : Infinity, windup: null, likes: new Map(), lastHit: 0,
    };
    if (kind === "dragon") this.dragonSpawnedThisRound = true;
    this.emit({ k: "dragon", state: "spawn", by: by?.id ?? null, kind, x, z });
    if (kind !== "dragon") this.emit({ k: "boss", kind, act: "roar", x, z, r: 0 });
    return true;
  }

  /** Likes become shots at the Titan: every `likesPerShot` likes of one viewer is one stone. */
  bossLike(key: string, name: string, count: number) {
    const d = this.dragon;
    if (!d || d.kind !== "titan" || (this.phase !== "WAR" && this.phase !== "FINAL")) return 0;
    const tc = this.cfg.titan;
    const acc = (d.likes.get(key) ?? 0) + count;
    const shots = Math.min(tc.maxShotsPerEvent, Math.floor(acc / tc.likesPerShot));
    d.likes.set(key, acc - shots * tc.likesPerShot);
    const k = this.kingdomByKey(key);
    for (let i = 0; i < shots && this.dragon; i++) {
      // from the viewer's castle, or from the crowd on the hills around the Titan
      const a = this.rng.next() * Math.PI * 2;
      const fromX = k ? k.x : d.x + Math.cos(a) * 26;
      const fromZ = k ? k.z : d.z + Math.sin(a) * 26;
      this.emit({ k: "likeShot", fromX, fromZ, x: d.x, z: d.z, dmg: tc.likeShotDamage, kid: k?.id ?? 0, name });
      this.hitBoss(tc.likeShotDamage, k);
    }
    return shots;
  }

  /**
   * Hujan Meteor Dunia: after a warning, meteors fall across the whole map for `seconds`, more of
   * them on the three leading kingdoms; then the mother meteor lands on `focusKey` (or the leader).
   */
  worldMeteor(focusKey: string | null = null) {
    if ((this.phase !== "WAR" && this.phase !== "FINAL") || this.doomUntil > this.t) return false;
    const c = this.cfg.worldMeteor;
    const top = this.leaderboard().slice(0, 3);
    const focus = (focusKey ? this.kingdomByKey(focusKey) : null) ?? top[0] ?? null;
    const start = this.t + c.warnSeconds;
    const rnd = () => this.rng.next();
    for (let i = 0; i < c.count; i++) {
      const at = start + (i / c.count) * c.seconds + rnd() * 0.3;
      let x = 0;
      let z = 0;
      if (top.length && rnd() < c.topShare) {
        const k = top[i % top.length];
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * c.topSpread;
        x = k.x + Math.cos(a) * d;
        z = k.z + Math.sin(a) * d;
      } else {
        // anywhere there is something to hit: next to a random unit, else on random land
        const alive = this.units.filter((u) => u.alive);
        const u = alive.length ? alive[Math.floor(rnd() * alive.length)] : null;
        if (u) {
          x = u.x + (rnd() - 0.5) * 12;
          z = u.z + (rnd() - 0.5) * 12;
        } else {
          for (let tries = 0; tries < 20; tries++) {
            x = (rnd() - 0.5) * WORLD_W * 0.9;
            z = (rnd() - 0.5) * WORLD_H * 0.9;
            if (this.map.biomeAt(x, z) !== "water") break;
          }
        }
      }
      const r = c.radius * (0.7 + rnd() * 0.7);
      const k = r / c.radius;
      this.strikes.push({ kid: 0, x, z, at, r, dmg: c.damage * k, castle: c.castleDamage * k });
      this.emit({ k: "strike", x, z, r, delay: at - this.t, style: "meteor" });
    }
    const mx = focus?.x ?? this.map.altar.x;
    const mz = focus?.z ?? this.map.altar.z;
    const motherAt = start + c.seconds + c.motherDelay;
    this.strikes.push({ kid: 0, x: mx, z: mz, at: motherAt, r: c.motherRadius, dmg: c.motherDamage, castle: c.motherCastleDamage });
    this.emit({ k: "strike", x: mx, z: mz, r: c.motherRadius, delay: motherAt - this.t, style: "mother" });
    this.doomUntil = motherAt + 2;
    this.emit({ k: "doom", warn: c.warnSeconds, seconds: motherAt - this.t, x: mx, z: mz, target: focus?.id ?? null });
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
    this.updateSpells(dt);
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
    this.zones = [];
    this.strikes = [];
    this.doomUntil = -1;
    this.spellQueue = [];
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
      revealed: false,
      trampleCd: 0,
      burnUntil: 0,
      poisonUntil: 0,
      chillUntil: 0,
      stunUntil: 0,
      dotKid: 0,
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
      this.emit({ k: "death", x: u.x, z: u.z, kid: u.kid, type: u.type, id: u.id, heading: u.heading });
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

  /** Does a unit type carry a tag? Flying and ranged count as tags. */
  private hasTag(type: UnitType, tag: string) {
    const st = this.cfg.unitTypes[type];
    return (tag === "flying" && !!st.flying) || (tag === "ranged" && !!st.ranged) || !!st.tags?.includes(tag);
  }

  /** Stealth units cannot be picked as a target until they reveal themselves. */
  private hidden(u: Unit) {
    return !u.revealed && !!this.cfg.unitTypes[u.type].stealth;
  }

  /** Damage multiplier of an attacker type against a unit type, "castle" or "dragon". */
  private bonusVs(attacker: UnitType, target: UnitType | "castle" | "dragon") {
    const b = this.cfg.unitTypes[attacker].bonusVs;
    if (!b) return 1;
    let m = 1;
    if (target === "castle" || target === "dragon") m += b[target] ?? 0;
    else {
      m += b.unit ?? 0;
      for (const tag of Object.keys(b)) if (tag !== "unit" && tag !== "castle" && tag !== "dragon" && this.hasTag(target, tag)) m += b[tag];
    }
    return Math.max(0.1, m);
  }

  /** Closest enemy that passes `want` within r of (x, z). */
  private nearestEnemyWhere(x: number, z: number, r: number, kid: number, want: (o: Unit, d: number) => boolean): Unit | null {
    let best: Unit | null = null;
    let bd = r;
    this.forNear(x, z, r, (o) => {
      if (!this.isEnemy(o, kid) || this.hidden(o)) return;
      const d = Math.hypot(o.x - x, o.z - z);
      if (d < bd && want(o, d)) {
        bd = d;
        best = o;
      }
    });
    return best;
  }

  private nearestEnemyUnit(x: number, z: number, r: number, kid: number): Unit | null {
    let best: Unit | null = null;
    let bd = r;
    this.forNear(x, z, r, (o) => {
      if (!this.isEnemy(o, kid) || this.hidden(o)) return;
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
    const st = this.cfg.unitTypes[u.type];
    // a shieldbearer nearby draws the attack; hunters look for their favourite prey first
    const taunter = this.nearestEnemyWhere(u.x, u.z, 6, k.id, (o, d) => d <= (this.cfg.unitTypes[o.type].taunt ?? 0));
    const prey = !taunter && st.hunts ? this.nearestEnemyWhere(u.x, u.z, uc.aggroRange * 1.5, k.id, (o) => st.hunts!.some((tag) => this.hasTag(o.type, tag))) : null;
    const near = taunter ?? prey ?? this.nearestEnemyUnit(u.x, u.z, Math.max(uc.aggroRange, st.range), k.id);
    if (near) {
      u.tKind = "unit";
      u.tId = near.id;
      return;
    }
    // engineers with nothing to fight go and fortify one of their own villages
    if (st.builds) {
      let site: Village | null = null;
      let sd = this.cfg.villages.buildRange;
      for (const v of this.villages) {
        if (v.owner !== k.id || v.tower) continue;
        const d = Math.hypot(v.x - u.x, v.z - u.z);
        if (d < sd) {
          sd = d;
          site = v;
        }
      }
      if (site) {
        u.tKind = "build";
        u.tId = (site as Village).id;
        return;
      }
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
      if (u.stunUntil > this.t) {
        u.moving = false;
        continue;
      }
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
        reach = st.range + this.dragon.radius;
      } else if (u.tKind === "build") {
        const v = this.village(u.tId);
        if (!v || v.owner !== k.id || v.tower) {
          u.retarget = 0;
          u.tKind = "home";
        } else {
          const a = (u.id * 2.39996) % (Math.PI * 2);
          tx = v.x + Math.cos(a) * 2.2;
          tz = v.z + Math.sin(a) * 2.2;
          reach = 0.6;
        }
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
      if (u.tKind === "home" || (!tUnit && !tCastle && u.tKind !== "dragon" && u.tKind !== "village" && u.tKind !== "build")) {
        // guard ring around own castle
        const a = (u.id * 2.39996) % (Math.PI * 2);
        const ring = 4.5 + (u.id % 3) * 1.2;
        tx = k.x + Math.cos(a) * ring;
        tz = k.z + Math.sin(a) * ring;
        reach = 0.6;
      }
      const dist = Math.hypot(tx - u.x, tz - u.z);
      if (dist > reach) {
        const pace = (u.chillUntil > this.t ? this.cfg.spells.frost.slow : 1) * (k.rageUntil > this.t ? this.cfg.spells.rage.speed : 1);
        this.moveUnit(u, k, tx, tz, tCastle, st.speed * pace * dt * this.map.speedFactor(u.x, u.z) * (st.flying ? 1 / this.map.speedFactor(u.x, u.z) : 1), !!st.flying);
        u.moving = true;
        // trample: a charging elephant hurts and shoves the small ground units in its way
        if (st.trample && war) {
          u.trampleCd -= dt;
          if (u.trampleCd <= 0) {
            let hit = false;
            this.forNear(u.x, u.z, 1.9, (o) => {
              if (!this.isEnemy(o, k.id) || this.hasTag(o.type, "big") || this.hasTag(o.type, "flying") || Math.hypot(o.x - u.x, o.z - u.z) > 1.9) return;
              hit = true;
              const d = Math.hypot(o.x - u.x, o.z - u.z) || 1;
              const px = o.x + ((o.x - u.x) / d) * 1.2;
              const pz = o.z + ((o.z - u.z) / d) * 1.2;
              if (this.map.walkable(this.map.cellAt(px, pz))) {
                o.x = px;
                o.z = pz;
              }
              this.damageUnit(o, st.trample!, k, false, u);
            });
            if (hit) {
              u.trampleCd = 0.8;
              this.emit({ k: "hit", fromX: u.x, fromZ: u.z, x: u.x, z: u.z, type: u.type, dmg: st.trample, on: "unit" });
            }
          }
        }
      } else {
        u.moving = false;
        if (u.tKind !== "home") u.heading = Math.atan2(tx - u.x, tz - u.z);
        if (u.tKind === "build" && war) {
          // hammer away: every engineer on site adds to the tower
          const v = this.village(u.tId);
          if (v && v.owner === k.id && !v.tower) {
            v.build += dt;
            if (u.atkCd <= 0) {
              u.atkCd = 0.8;
              u.attackAt = this.t;
            }
            if (v.build >= this.cfg.villages.towerBuildSeconds) {
              v.tower = true;
              this.emit({ k: "tower", id: v.id, kid: k.id });
            }
          }
        }
        const tooClose = !!st.minRange && dist < st.minRange && !!(tUnit || tCastle);
        if (war && !tooClose && u.atkCd <= 0 && (tUnit || tCastle || (u.tKind === "dragon" && this.dragon))) {
          u.atkCd = this.cfg.units.attackCooldown * (0.9 + this.rng.next() * 0.2);
          u.attackAt = this.t;
          let dmg = u.dmg * (0.9 + this.rng.next() * 0.2);
          if (this.t < k.buffUntil) dmg *= 1.2;
          if (this.t < k.rageUntil) dmg *= this.cfg.spells.rage.damage;
          if (this.hasAura(u, k)) dmg *= 1 + (this.cfg.unitTypes.demon.aura ?? 0);
          if (st.rage) dmg *= 1 + st.rage * (1 - Math.max(0, u.hp) / u.maxHp);
          dmg *= this.bonusVs(u.type, tUnit ? tUnit.type : tCastle ? "castle" : "dragon");
          u.revealed = true;
          const on: HitTarget = tUnit ? "unit" : tCastle ? "castle" : "dragon";
          if (st.ranged || u.type === "dragon") this.emit({ k: "shot", fromX: u.x, fromZ: u.z, x: tx, z: tz, type: u.type, dmg, on, id: u.id });
          else this.emit({ k: "hit", fromX: u.x, fromZ: u.z, x: tx, z: tz, type: u.type, dmg, on });
          if (tUnit) {
            this.damageUnit(tUnit, dmg, k, !!st.ranged, u);
            if (st.splash) this.forNear(tUnit.x, tUnit.z, st.splash, (o) => o !== tUnit && this.isEnemy(o, k.id) && this.damageUnit(o, dmg * 0.5, k, true, u));
          } else if (tCastle) {
            tCastle.hp -= dmg;
            if (tCastle.hp <= 0) this.fall(tCastle, k);
          } else if (this.dragon) {
            const bonus = this.dragon.summonedBy === k.id ? 1 + this.cfg.dragon.giftDamageBonus : 1;
            this.hitBoss(dmg * bonus, k);
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
            : u.tKind === "village" || u.tKind === "build"
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
    const tst = this.cfg.unitTypes[target.type];
    let resist = ranged ? tst.arrowResist ?? 0 : 0;
    if (ranged && tst.dodge && target.moving) resist = 1 - (1 - resist) * (1 - tst.dodge);
    if (ranged) {
      // a shieldbearer covers the allies standing close to it
      let cover = 0;
      this.forNear(target.x, target.z, 4, (o) => {
        if (o === target || o.kid !== target.kid) return;
        const os = this.cfg.unitTypes[o.type];
        if (os.cover && os.cover > cover && Math.hypot(o.x - target.x, o.z - target.z) <= (os.coverRange ?? 3)) cover = os.cover;
      });
      resist = 1 - (1 - resist) * (1 - cover);
    }
    const forest = ranged && this.map.biomeAt(target.x, target.z) === "forest" ? 0.2 : 0;
    target.hp -= dmg * (1 - resist) * (1 - forest);
    target.hitAt = this.t;
    target.revealed = true;
    if (target.hp > 0) return false;
    target.alive = false;
    const owner = this.kingdomById(target.kid);
    if (owner) {
      owner.unitCount = Math.max(0, owner.unitCount - 1);
      if (target.passive) owner.passiveCount = Math.max(0, owner.passiveCount - 1);
    }
    this.emit({ k: "death", x: target.x, z: target.z, kid: target.kid, type: target.type, id: target.id, heading: target.heading });
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

  // ---------------------------------------------------------------- spells

  private updateSpells(dt: number) {
    const sc = this.cfg.spells;
    const war = this.phase === "WAR" || this.phase === "FINAL";
    if (war && this.spellQueue.length) {
      // at most one cast per kingdom per cooldown; the rest wait their turn
      const waiting = this.spellQueue;
      this.spellQueue = [];
      for (const q of waiting) {
        const k = this.kingdomByKey(q.key);
        if (!k) continue;
        if (this.t < k.spellAt) {
          this.spellQueue.push(q);
          continue;
        }
        if (this.cast(k, q.spell, q.from)) k.spellAt = this.t + sc.cooldownSeconds;
        else {
          // nothing to hit yet: try again shortly
          k.spellAt = this.t + 2;
          this.spellQueue.push(q);
        }
      }
    }
    if (this.strikes.length) {
      const due = this.strikes.filter((s) => s.at <= this.t);
      if (due.length) {
        this.strikes = this.strikes.filter((s) => s.at > this.t);
        for (const s of due) {
          if (s.kid) this.meteorImpact(s.kid, s.x, s.z);
          else this.worldImpact(s.x, s.z, s.r ?? 4, s.dmg ?? 100, s.castle ?? 0);
        }
      }
    }
    this.spellTimer += dt;
    if (this.spellTimer < 0.5) return;
    const span = this.spellTimer;
    this.spellTimer = 0;
    if (this.zones.length) {
      this.zones = this.zones.filter((z) => z.until > this.t);
      for (const z of this.zones) {
        const by = this.kingdomById(z.kid);
        if (!by) continue;
        this.forNear(z.x, z.z, z.r, (o) => {
          if (!this.isEnemy(o, z.kid) || Math.hypot(o.x - z.x, o.z - z.z) > z.r) return;
          if (z.spell === "frost") {
            o.chillUntil = this.t + 1.2;
            this.damageUnit(o, sc.frost.dps * span, by, false);
          } else {
            o.poisonUntil = this.t + sc.poison.lingerSeconds;
            o.dotKid = z.kid;
          }
        });
      }
    }
    // burning and poisoned troops keep losing health
    for (const u of this.units) {
      if (!u.alive || (u.burnUntil <= this.t && u.poisonUntil <= this.t)) continue;
      const by = this.kingdomById(u.dotKid);
      if (!by) continue;
      const dps = (u.burnUntil > this.t ? sc.meteor.burnDps : 0) + (u.poisonUntil > this.t ? sc.poison.dps : 0);
      this.damageUnit(u, dps * span, by, false);
    }
  }

  /** Cast now. False when an attack spell finds nothing to hit. */
  private cast(k: Kingdom, spell: SpellId, from: string): boolean {
    const sc = this.cfg.spells;
    if (spell === "heal") {
      for (const u of this.units) {
        if (!u.alive || u.kid !== k.id) continue;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * sc.heal.unitPercent);
        u.burnUntil = u.poisonUntil = u.chillUntil = 0;
      }
      k.hp = Math.min(k.maxHp, k.hp + k.maxHp * sc.heal.castlePercent);
      this.emit({ k: "spell", spell, kid: k.id, x: k.x, z: k.z, r: 0, seconds: 0, from });
      return true;
    }
    if (spell === "rage") {
      k.rageUntil = Math.max(k.rageUntil, this.t) + sc.rage.seconds;
      this.emit({ k: "spell", spell, kid: k.id, x: k.x, z: k.z, r: 0, seconds: sc.rage.seconds, from });
      return true;
    }
    const reach = spell === "meteor" ? sc.meteor.spread : spell === "lightning" ? sc.lightning.chainRange : sc[spell].radius;
    let spot = this.densestEnemies(k, reach);
    if (!spot && spell === "meteor") {
      // no troops in sight: bombard the nearest castle that is not shielded
      let bd = Infinity;
      for (const e of this.kingdoms) {
        if (!e.alive || e.id === k.id || this.shielded(e)) continue;
        const d = Math.hypot(e.x - k.x, e.z - k.z);
        if (d < bd) {
          bd = d;
          spot = { x: e.x, z: e.z };
        }
      }
    }
    if (!spot) return false;
    if (spell === "meteor") {
      const c = sc.meteor;
      this.emit({ k: "spell", spell, kid: k.id, x: spot.x, z: spot.z, r: c.spread + c.radius, seconds: c.seconds + 1, from });
      for (let i = 0; i < c.count; i++) {
        const a = this.rng.next() * Math.PI * 2;
        const d = i === 0 ? 0 : Math.sqrt(this.rng.next()) * c.spread;
        const delay = 1 + (i / Math.max(1, c.count - 1)) * c.seconds + this.rng.next() * 0.15;
        const x = spot.x + Math.cos(a) * d;
        const z = spot.z + Math.sin(a) * d;
        this.strikes.push({ kid: k.id, x, z, at: this.t + delay });
        this.emit({ k: "strike", x, z, r: c.radius, delay });
      }
    } else if (spell === "lightning") {
      const c = sc.lightning;
      // the bolt picks the toughest enemy in the crowd, then jumps to whoever stands closest
      let cur: Unit | null = null;
      this.forNear(spot.x, spot.z, reach, (o) => {
        if (this.isEnemy(o, k.id) && Math.hypot(o.x - spot!.x, o.z - spot!.z) <= reach && (!cur || o.hp > cur.hp)) cur = o;
      });
      if (!cur) return false;
      const seen = new Set<number>();
      const points: { x: number; z: number; dmg: number }[] = [];
      let dmg = c.damage;
      for (let i = 0; i <= c.chains && cur; i++) {
        const u: Unit = cur;
        seen.add(u.id);
        points.push({ x: u.x, z: u.z, dmg });
        u.stunUntil = this.t + c.stunSeconds;
        this.damageUnit(u, dmg, k, false);
        dmg *= c.falloff;
        let next: Unit | null = null;
        let nd = c.chainRange;
        this.forNear(u.x, u.z, c.chainRange, (o) => {
          const d = Math.hypot(o.x - u.x, o.z - u.z);
          if (d < nd && !seen.has(o.id) && this.isEnemy(o, k.id)) {
            nd = d;
            next = o;
          }
        });
        cur = next;
      }
      this.emit({ k: "spell", spell, kid: k.id, x: points[0].x, z: points[0].z, r: c.chainRange, seconds: 0, from });
      this.emit({ k: "chain", kid: k.id, points });
    } else {
      const c = sc[spell];
      this.zones.push({ spell, kid: k.id, x: spot.x, z: spot.z, r: c.radius, until: this.t + c.seconds });
      this.emit({ k: "spell", spell, kid: k.id, x: spot.x, z: spot.z, r: c.radius, seconds: c.seconds, from });
    }
    return true;
  }

  /** Centre of the thickest crowd of k's enemies within `r`; crowds nearer to k's castle win ties. */
  private densestEnemies(k: Kingdom, r: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null;
    let bestScore = 0;
    for (const u of this.units) {
      if (!u.alive || !this.isEnemy(u, k.id)) continue;
      let n = 0;
      this.forNear(u.x, u.z, r, (o) => {
        if (this.isEnemy(o, k.id) && Math.hypot(o.x - u.x, o.z - u.z) <= r) n++;
      });
      const score = n / (1 + Math.hypot(u.x - k.x, u.z - k.z) / 120);
      if (score > bestScore) {
        bestScore = score;
        best = { x: u.x, z: u.z };
      }
    }
    return best;
  }

  private meteorImpact(kid: number, x: number, z: number) {
    const c = this.cfg.spells.meteor;
    const by = this.kingdomById(kid);
    let total = 0;
    if (by) {
      this.forNear(x, z, c.radius, (o) => {
        const d = Math.hypot(o.x - x, o.z - z);
        if (d > c.radius || !this.isEnemy(o, kid)) return;
        const dmg = c.damage * (1 - 0.5 * (d / c.radius));
        total += dmg;
        o.burnUntil = this.t + c.burnSeconds;
        o.dotKid = kid;
        this.damageUnit(o, dmg, by, false);
      });
      for (const e of this.kingdoms) {
        if (!e.alive || e.id === kid || this.shielded(e) || Math.hypot(e.x - x, e.z - z) > c.radius + 3) continue;
        e.hp -= c.castleDamage;
        total += c.castleDamage;
        if (e.hp <= 0) this.fall(e, by);
      }
    }
    this.emit({ k: "impact", x, z, r: c.radius, dmg: total });
  }

  /** Damage from a world event or a boss: nobody gets the kill. Shielded kingdoms are spared. */
  private hurt(o: Unit, dmg: number) {
    if (!o.alive) return;
    const owner = this.kingdomById(o.kid);
    if (owner && this.shielded(owner)) return;
    o.hp -= dmg;
    o.hitAt = this.t;
    if (o.hp > 0) return;
    o.alive = false;
    if (owner) {
      owner.unitCount = Math.max(0, owner.unitCount - 1);
      if (o.passive) owner.passiveCount = Math.max(0, owner.passiveCount - 1);
    }
    this.emit({ k: "death", x: o.x, z: o.z, kid: o.kid, type: o.type, id: o.id, heading: o.heading });
  }

  /** A blast that belongs to nobody: units lose health toward the edge, castles a fixed amount. */
  private blast(x: number, z: number, r: number, dmg: number, castleDmg: number) {
    let total = 0;
    this.forNear(x, z, r, (o) => {
      const d = Math.hypot(o.x - x, o.z - z);
      if (d > r) return;
      const v = dmg * (1 - 0.5 * (d / r));
      total += v;
      this.hurt(o, v);
    });
    if (castleDmg > 0)
      for (const e of this.kingdoms) {
        if (!e.alive || this.shielded(e) || Math.hypot(e.x - x, e.z - z) > r + 3) continue;
        e.hp -= castleDmg;
        total += castleDmg;
        if (e.hp <= 0) this.fall(e, null);
      }
    return total;
  }

  private worldImpact(x: number, z: number, r: number, dmg: number, castleDmg: number) {
    const total = this.blast(x, z, r, dmg, castleDmg);
    this.emit({ k: "impact", x, z, r, dmg: total });
  }

  // ---------------------------------------------------------------- dragon and the other bosses

  private updateDragon(dt: number) {
    const d = this.dragon;
    if (!d || (this.phase !== "WAR" && this.phase !== "FINAL")) return;
    if (d.kind === "titan") return this.updateTitan(d, dt);
    if (d.kind === "elder") this.updateElder(d, dt);
    d.cd -= dt;
    if (d.cd > 0) return;
    const elder = d.kind === "elder";
    const st = elder ? this.cfg.elder : this.cfg.dragon;
    let target: Unit | null = null;
    let bd = st.range;
    this.forNear(d.x, d.z, st.range, (o) => {
      const k = this.kingdomById(o.kid);
      if (k && this.shielded(k)) return;
      const dist = Math.hypot(o.x - d.x, o.z - d.z);
      if (dist < bd) {
        bd = dist;
        target = o;
      }
    });
    if (!target) {
      // Naga Purba burns the castle it hunts when no troops stand in its way
      const prey = elder ? this.kingdomById(d.prey) : null;
      if (prey && prey.alive && !this.shielded(prey) && Math.hypot(prey.x - d.x, prey.z - d.z) <= st.range) {
        d.cd = st.cooldown;
        d.attackAt = this.t;
        this.emit({ k: "shot", fromX: d.x, fromZ: d.z, x: prey.x, z: prey.z, type: "dragon", dmg: this.cfg.elder.castleDamage, on: "castle" });
        prey.hp -= this.cfg.elder.castleDamage;
        if (prey.hp <= 0) this.fall(prey, null);
      }
      return;
    }
    const t: Unit = target;
    d.cd = st.cooldown;
    d.attackAt = this.t;
    this.emit({ k: "shot", fromX: d.x, fromZ: d.z, x: t.x, z: t.z, type: "dragon", dmg: st.dmg, on: "unit" });
    this.forNear(t.x, t.z, st.splash, (o) => {
      if (Math.hypot(o.x - t.x, o.z - t.z) <= st.splash) this.hurt(o, st.dmg);
    });
  }

  /** The kingdom a moving boss goes after: the leader that is not shielded. */
  private bossPrey(d: Dragon) {
    if (this.t < d.retargetAt && this.kingdomById(d.prey)?.alive) return this.kingdomById(d.prey);
    const lead = this.leaderboard().find((k) => !this.shielded(k)) ?? null;
    d.prey = lead?.id ?? 0;
    d.retargetAt = this.t + (d.kind === "elder" ? this.cfg.elder.retargetSeconds : this.cfg.titan.retargetSeconds);
    return lead;
  }

  private moveBoss(d: Dragon, tx: number, tz: number, speed: number, stopAt: number, dt: number) {
    d.tx = tx;
    d.tz = tz;
    const dist = Math.hypot(tx - d.x, tz - d.z);
    if (dist <= stopAt) return false;
    const step = Math.min(dist - stopAt, speed * dt);
    d.x += ((tx - d.x) / dist) * step;
    d.z += ((tz - d.z) / dist) * step;
    return true;
  }

  /** Naga Purba flies to the leading kingdom and every few seconds pours a line of hellfire. */
  private updateElder(d: Dragon, dt: number) {
    const ec = this.cfg.elder;
    const prey = this.bossPrey(d);
    if (prey) this.moveBoss(d, prey.x, prey.z, ec.speed, ec.range * 0.7, dt);
    d.special -= dt;
    if (d.special > 0 || !prey) return;
    // it saves its fire until the prey is within reach of the breath
    const dist = Math.hypot(prey.x - d.x, prey.z - d.z) || 1;
    if (dist > ec.range * 2.5) return;
    d.special = ec.infernoEvery;
    const ux = (prey.x - d.x) / dist;
    const uz = (prey.z - d.z) / dist;
    this.emit({ k: "boss", kind: "elder", act: "inferno", x: prey.x, z: prey.z, r: ec.infernoRadius });
    const half = ((ec.infernoCount - 1) * ec.infernoSpacing) / 2;
    for (let i = 0; i < ec.infernoCount; i++) {
      // the line of fire is laid across the prey's castle, along the dragon's line of flight
      const along = i * ec.infernoSpacing - half;
      const x = prey.x + ux * along;
      const z = prey.z + uz * along;
      const at = this.t + 0.5 + i * 0.18;
      this.strikes.push({ kid: 0, x, z, at, r: ec.infernoRadius, dmg: ec.infernoDamage, castle: ec.infernoCastleDamage });
      this.emit({ k: "strike", x, z, r: ec.infernoRadius, delay: at - this.t, style: "inferno" });
    }
  }

  /** The Titan walks to the leading kingdom, smashes what is near, shakes the ground, and leaves in a rage. */
  private updateTitan(d: Dragon, dt: number) {
    const tc = this.cfg.titan;
    if (this.t >= d.until) {
      // time is up: one last blow on the leader's castle, then it walks out of the world
      const lead = this.leaderboard().find((k) => !this.shielded(k));
      if (lead) {
        this.emit({ k: "boss", kind: "titan", act: "rampage", x: lead.x, z: lead.z, r: tc.slamRadius * 1.6 });
        this.blast(lead.x, lead.z, tc.slamRadius * 1.6, tc.slamDamage * 2, tc.rampageCastleDamage);
      }
      this.dragon = null;
      this.emit({ k: "dragon", state: "leave", by: null, kind: "titan", x: d.x, z: d.z });
      return;
    }
    if (d.windup) {
      if (this.t < d.windup.at) return;
      const w = d.windup;
      d.windup = null;
      d.attackAt = this.t;
      if (w.act === "slam") {
        this.emit({ k: "boss", kind: "titan", act: "slam", x: w.x, z: w.z, r: tc.slamRadius });
        this.blast(w.x, w.z, tc.slamRadius, tc.slamDamage, tc.castleDamage);
      } else {
        this.emit({ k: "boss", kind: "titan", act: "quake", x: d.x, z: d.z, r: tc.quakeRadius });
        this.blast(d.x, d.z, tc.quakeRadius, tc.quakeDamage, 0);
      }
      return;
    }
    const prey = this.bossPrey(d);
    let crowd = 0;
    let near: Unit | null = null;
    let nd = tc.range + d.radius;
    this.forNear(d.x, d.z, tc.quakeRadius, (o) => {
      const k = this.kingdomById(o.kid);
      if (k && this.shielded(k)) return;
      const dist = Math.hypot(o.x - d.x, o.z - d.z);
      if (dist <= tc.quakeRadius) crowd++;
      if (dist < nd) {
        nd = dist;
        near = o;
      }
    });
    d.cd -= dt;
    d.special -= dt;
    // a crowd at its feet: stamp the ground
    if (d.special <= 0 && crowd >= 6) {
      d.special = tc.quakeEvery;
      d.windup = { act: "quake", at: this.t + tc.quakeWindupSeconds, x: d.x, z: d.z };
      this.emit({ k: "boss", kind: "titan", act: "quakeWindup", x: d.x, z: d.z, r: tc.quakeRadius });
      return;
    }
    const castleNear = prey && Math.hypot(prey.x - d.x, prey.z - d.z) <= tc.range + d.radius + 2 ? prey : null;
    const target: { x: number; z: number } | null = castleNear ?? near;
    if (target && d.cd <= 0) {
      d.cd = tc.cooldown;
      // the club lands a little in front of it, toward the target
      const dist = Math.hypot(target.x - d.x, target.z - d.z) || 1;
      const reach = Math.min(dist, tc.range);
      const x = d.x + ((target.x - d.x) / dist) * reach;
      const z = d.z + ((target.z - d.z) / dist) * reach;
      d.tx = target.x;
      d.tz = target.z;
      d.windup = { act: "slam", at: this.t + tc.windupSeconds, x, z };
      this.emit({ k: "boss", kind: "titan", act: "windup", x, z, r: tc.slamRadius });
      return;
    }
    if (!target && prey) this.moveBoss(d, prey.x, prey.z, tc.speed * this.map.speedFactor(d.x, d.z), d.radius + 3, dt);
    else if (near && !castleNear) this.moveBoss(d, (near as Unit).x, (near as Unit).z, tc.speed, tc.range, dt);
  }

  /** Damage to the boss from a kingdom (or from nobody, a viewer without a kingdom). */
  private hitBoss(dmg: number, by: Kingdom | null) {
    const d = this.dragon;
    if (!d) return;
    d.hp -= dmg;
    if (by) {
      d.damage.set(by.id, (d.damage.get(by.id) ?? 0) + dmg);
      d.lastHit = by.id;
    }
    if (d.hp <= 0) this.killDragon();
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
      if (d.kind === "dragon") {
        this.gainExp(best, this.cfg.dragon.rewardExp);
        this.makeUnit(best, "dragon", false, null, { x: d.x, z: d.z });
      } else if (d.kind === "elder") {
        const ec = this.cfg.elder;
        this.gainExp(best, this.cfg.dragon.rewardExp * ec.rewardExpMultiplier);
        for (let i = 0; i < ec.rewardLevels; i++) this.gainExp(best, Math.max(0, best.nextExp - best.exp));
        for (let i = 0; i < ec.rewardDragons; i++) this.makeUnit(best, "dragon", false, null, { x: d.x + i * 3, z: d.z });
      } else {
        const tc = this.cfg.titan;
        for (let i = 0; i < tc.rewardLevels; i++) this.gainExp(best, Math.max(0, best.nextExp - best.exp));
        this.spawnUnits(best, tc.rewardUnits as UnitBundle, "titan", null, false);
      }
    }
    // the killing blow on the Titan earns a level of its own
    const last = d.kind === "titan" ? this.kingdomById(d.lastHit) : null;
    if (last && last.alive) for (let i = 0; i < this.cfg.titan.lastHitLevels; i++) this.gainExp(last, Math.max(0, last.nextExp - last.exp));
    this.emit({ k: "dragon", state: "dead", by: best?.id ?? null, kind: d.kind, x: d.x, z: d.z });
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
      if (v.tower) {
        v.towerCd -= dt;
        if (v.towerCd <= 0) {
          const target = this.nearestEnemyUnit(v.x, v.z, vc.towerRange, k.id);
          if (target) {
            v.towerCd = vc.towerCooldown;
            this.emit({ k: "shot", fromX: v.x, fromZ: v.z, x: target.x, z: target.z, type: "tower", dmg: vc.towerDamage, on: "unit" });
            this.damageUnit(target, vc.towerDamage, k, true);
          }
        }
      }
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
    v.tower = false;
    v.build = 0;
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
