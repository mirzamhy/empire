// Live event -> game action. Mapping lives in config/events.config.json.
// Pure logic on top of Sim so it can be tested headless.
import raw from "../../../config/events.config.json";
import type { NormalizedLiveEvent } from "../../../shared/contract";
import { SPELLS, UNIT_ICON, UNIT_LABEL, type SpellId, type UnitBundle, type UnitType } from "../sim/config";
import type { Sim } from "../sim/world";

export type EventsConfig = typeof raw;
export const loadEventsConfig = (): EventsConfig => structuredClone(raw);

export interface RouteResult {
  status: "applied" | "ignored" | "rejected";
  reason: string | null;
}

interface ViewerState {
  likeAcc: number;
  likeUnitsThisMinute: number;
  likeMinute: number;
  shareAt: number;
  followRound: number;
  infoAt: number;
}

interface Tier {
  minValue: number;
  units?: Record<string, number>;
  perCoin?: Record<string, number>;
  castleLevel?: number;
  event?: string;
  /** spell cast for the giver's kingdom on top of the troops */
  spell?: string;
}

/** Turn a coin value into troops by walking the value tiers (highest first). */
export function troopsForValue(value: number, cfg: EventsConfig): { units: UnitBundle; levels: number; dragon: boolean; leftover: number; spells: SpellId[] } {
  const tiers = [...(cfg.gift.valueTiers as Tier[])].sort((a, b) => b.minValue - a.minValue);
  const units: UnitBundle = {};
  const add = (b: Record<string, number>, mult = 1) => {
    for (const [t, n] of Object.entries(b)) units[t as UnitType] = (units[t as UnitType] ?? 0) + n * mult;
  };
  let remaining = Math.max(0, Math.floor(value));
  let levels = 0;
  let dragon = false;
  const spells: SpellId[] = [];
  for (let loop = 0; loop < cfg.gift.maxTierLoops && remaining > 0; loop++) {
    const tier = tiers.find((t) => remaining >= t.minValue);
    if (!tier) break;
    if (tier.perCoin) {
      add(tier.perCoin, remaining);
      remaining = 0;
      break;
    }
    if (tier.units) add(tier.units);
    if (tier.castleLevel) levels += tier.castleLevel;
    if (tier.event === "WORLD_DRAGON") dragon = true;
    if (tier.spell && (SPELLS as readonly string[]).includes(tier.spell)) spells.push(tier.spell as SpellId);
    remaining -= tier.minValue;
  }
  return { units, levels, dragon, leftover: remaining, spells };
}

export function describeUnits(b: UnitBundle) {
  return (Object.entries(b) as [UnitType, number][])
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `+${n} ${UNIT_ICON[t]} ${UNIT_LABEL[t]}`)
    .join(" ");
}

export class LiveRouter {
  private viewers = new Map<string, ViewerState>();
  safeMode = false;

  constructor(
    private sim: Sim,
    readonly cfg: EventsConfig = loadEventsConfig(),
  ) {}

  private viewer(key: string): ViewerState {
    let v = this.viewers.get(key);
    if (!v) this.viewers.set(key, (v = { likeAcc: 0, likeUnitsThisMinute: 0, likeMinute: -1, shareAt: -9999, followRound: 0, infoAt: -9999 }));
    return v;
  }

  handle(e: NormalizedLiveEvent): RouteResult {
    if (this.safeMode && e.source !== "mock") return { status: "ignored", reason: "safe_mode" };
    const key = e.user.username;
    const name = shortName(e.user.displayName, key);
    switch (e.kind) {
      case "chat":
        return this.chat(key, name, e.chat?.text ?? "");
      case "gift":
        return this.gift(key, name, e);
      case "like":
        return this.like(key, name, e.like?.count ?? 1);
      case "share": {
        const v = this.viewer(key);
        if (this.sim.t - v.shareAt < this.cfg.share.cooldownSeconds) return { status: "ignored", reason: "share_cooldown" };
        v.shareAt = this.sim.t;
        const r = this.sim.addUnits(key, name, this.cfg.share.units as UnitBundle, "share", false);
        return r === "ignored" ? { status: "ignored", reason: "not_joined" } : { status: "applied", reason: null };
      }
      case "follow": {
        const v = this.viewer(key);
        if (this.cfg.follow.oncePerRound && v.followRound === this.sim.roundId) return { status: "ignored", reason: "follow_once" };
        v.followRound = this.sim.roundId;
        const r = this.sim.addUnits(key, name, this.cfg.follow.units as UnitBundle, "follow", false);
        return r === "ignored" ? { status: "ignored", reason: "not_joined" } : { status: "applied", reason: null };
      }
      default:
        return { status: "ignored", reason: "kind" };
    }
  }

  private chat(key: string, name: string, text: string): RouteResult {
    const words = text.toLowerCase().split(/[^\p{L}\p{N}._@]+/u).filter(Boolean);
    if (!words.length) return { status: "ignored", reason: "empty" };
    const c = this.cfg.commands;
    const has = (list: string[]) => words.findIndex((w) => list.includes(w));
    if (has(this.cfg.join.keywords) >= 0) {
      const r = this.sim.join(key, name);
      if (r.status === "cooldown") this.sim.events.push({ k: "ticker", text: `⏳ ${name} bisa ikut lagi dalam ${r.waitSeconds} dtk` });
      if (r.status === "queued") this.sim.events.push({ k: "ticker", text: `🕓 ${name} masuk antrean #${this.sim.joinQueue.findIndex((q) => q.key === key) + 1}` });
      if (r.status === "next_round") this.sim.events.push({ k: "ticker", text: `🕓 ${name} ikut ronde berikutnya` });
      return { status: r.status === "exists" ? "ignored" : "applied", reason: r.status };
    }
    const atk = has(c.attack);
    if (atk >= 0) {
      const target = words.slice(atk + 1).join(" ") || "";
      const r = this.sim.order(key, "attack", target);
      if (r.ok && r.target) {
        const k = this.sim.kingdomByKey(key)!;
        this.sim.events.push({ k: "ticker", text: `⚔️ ${k.name} menyerang ${r.target.name}!`, color: k.color });
      }
      return r.ok ? { status: "applied", reason: null } : { status: "ignored", reason: r.reason ?? null };
    }
    for (const [list, kind] of [[c.defend, "defend"], [c.free, "free"], [c.boss, "boss"], [c.expand, "expand"]] as const) {
      if (has(list) >= 0) {
        const r = this.sim.order(key, kind);
        if (r.ok) {
          const k = this.sim.kingdomByKey(key)!;
          const text =
            kind === "defend"
              ? `🛡️ ${k.name} bertahan di kastil`
              : kind === "boss"
                ? `🐉 ${k.name} menyerbu Naga!`
                : kind === "expand"
                  ? `🚩 ${k.name} memperluas wilayah!`
                  : `🏳️ ${k.name} kembali bebas`;
          this.sim.events.push({ k: "ticker", text, color: k.color });
        }
        return r.ok ? { status: "applied", reason: null } : { status: "ignored", reason: r.reason ?? null };
      }
    }
    if (has(c.info) >= 0) {
      const v = this.viewer(key);
      const k = this.sim.kingdomByKey(key);
      if (!k || this.sim.t - v.infoAt < 30) return { status: "ignored", reason: "info" };
      v.infoAt = this.sim.t;
      const rank = this.sim.leaderboard().findIndex((x) => x.id === k.id) + 1;
      this.sim.events.push({ k: "ticker", text: `ℹ️ ${k.name}: Lv${k.level} · ${k.unitCount} pasukan · peringkat #${rank}`, color: k.color });
      return { status: "applied", reason: null };
    }
    return { status: "ignored", reason: "no_command" };
  }

  private gift(key: string, name: string, e: NormalizedLiveEvent): RouteResult {
    const g = e.gift!;
    const override = this.cfg.gift.nameOverrides.find((o) => o.giftName.toLowerCase() === g.giftName.toLowerCase());
    // Tiers apply to one gift; a streak repeats it (5 Roses = 5 x the Rose reward).
    const unitValue = Math.max(1, override?.value ?? g.providerValue ?? 1);
    const repeat = Math.max(1, g.repeatCount);
    const one = troopsForValue(unitValue, this.cfg);
    const units: UnitBundle = {};
    for (const [t, n] of Object.entries(one.units) as [UnitType, number][]) units[t] = n * repeat;
    const reason = `${g.giftName}${repeat > 1 ? ` x${repeat}` : ""}`;
    const r = this.sim.addUnits(key, name, units, reason, this.cfg.join.autoJoinOnGift);
    if (one.levels) this.sim.levelUp(key, one.levels * repeat);
    if (one.dragon) this.sim.summonDragon(key);
    // a streak repeats the spell too, up to three casts per gift
    for (let i = 0; i < Math.min(repeat, 3); i++) for (const s of one.spells) this.sim.castSpell(key, name, s);
    if (one.leftover > 0) this.sim.buff(key, this.cfg.gift.leftoverBuffSeconds);
    return r === "ignored" ? { status: "ignored", reason: "not_joined" } : { status: "applied", reason: r };
  }

  private like(key: string, name: string, count: number): RouteResult {
    const v = this.viewer(key);
    const lc = this.cfg.likes;
    const minute = Math.floor(this.sim.t / 60);
    if (minute !== v.likeMinute) {
      v.likeMinute = minute;
      v.likeUnitsThisMinute = 0;
    }
    if (!this.sim.kingdomByKey(key)) return { status: "ignored", reason: "not_joined" };
    v.likeAcc += count;
    let n = 0;
    while (v.likeAcc >= lc.perUnit && v.likeUnitsThisMinute < lc.maxUnitsPerMinute) {
      v.likeAcc -= lc.perUnit;
      v.likeUnitsThisMinute++;
      n++;
    }
    if (v.likeUnitsThisMinute >= lc.maxUnitsPerMinute) v.likeAcc = Math.min(v.likeAcc, lc.perUnit);
    if (!n) return { status: "applied", reason: "accumulating" };
    this.sim.addUnits(key, name, { [lc.unit]: n } as UnitBundle, "like", false);
    return { status: "applied", reason: null };
  }
}

/** Short on-screen name: nickname when short and printable, else the handle. */
export function shortName(display: string, handle: string) {
  const d = display.trim();
  if (d && d !== "anon" && Array.from(d).length <= 14) return d;
  return Array.from(handle).slice(0, 14).join("");
}
