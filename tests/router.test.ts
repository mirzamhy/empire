import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type NormalizedLiveEvent } from "../shared/contract";
import { loadConfig } from "../game/src/sim/config";
import { WorldMap } from "../game/src/sim/map";
import { Sim } from "../game/src/sim/world";
import { LiveRouter, loadEventsConfig, troopsForValue } from "../game/src/live/router";

const map = new WorldMap();
let n = 0;
const ev = (kind: NormalizedLiveEvent["kind"], user: string, extra: Partial<NormalizedLiveEvent> = {}): NormalizedLiveEvent => ({
  schemaVersion: SCHEMA_VERSION,
  eventId: `t${n++}`,
  source: "mock",
  kind,
  receivedAt: "",
  user: { username: user, displayName: user, userId: null },
  ...extra,
});
const chat = (u: string, text: string) => ev("chat", u, { chat: { text } });
const gift = (u: string, giftName: string, value: number, repeatCount = 1) =>
  ev("gift", u, { gift: { giftId: null, giftName, repeatCount, repeatFinal: true, providerValue: value } });
const setup = () => {
  const sim = new Sim(loadConfig(), map, 3);
  return { sim, r: new LiveRouter(sim) };
};
const count = (sim: Sim, key: string, type: string) => {
  const k = sim.kingdomByKey(key)!;
  return sim.units.filter((u) => u.kid === k.id && u.type === type).length;
};

describe("gift tiers", () => {
  const cfg = loadEventsConfig();
  it("maps coin values to troops", () => {
    expect(troopsForValue(1, cfg).units).toEqual({ spearman: 3 });
    expect(troopsForValue(4, cfg).units).toEqual({ spearman: 12 });
    expect(troopsForValue(5, cfg).units).toEqual({ swordsman: 3 });
    expect(troopsForValue(30, cfg).units).toEqual({ wizard: 3, paladin: 2 });
    expect(troopsForValue(100, cfg).units).toEqual({ golem: 1, necromancer: 2, spearman: 3 });
    expect(troopsForValue(299, cfg).units).toEqual({ dragon: 1 });
    const big = troopsForValue(1000, cfg);
    expect(big.units).toEqual({ demon: 1 });
    expect(big.levels).toBe(1);
    expect(troopsForValue(29999, cfg).dragon).toBe(true);
    expect(troopsForValue(29999, cfg).units.demon).toBe(5);
  });
});

describe("live router", () => {
  it("chat ikut joins, case-insensitive and inside a sentence", () => {
    const { sim, r } = setup();
    expect(r.handle(chat("budi", "Aku IKUT dong")).status).toBe("applied");
    expect(sim.kingdomByKey("budi")).not.toBeNull();
    expect(r.handle(chat("budi", "ikut")).status).toBe("ignored");
  });

  it("gift from a viewer who has not joined creates their kingdom and troops", () => {
    const { sim, r } = setup();
    r.handle(gift("sari", "Rose", 1, 5));
    expect(count(sim, "sari", "spearman")).toBe(10 + 15);
  });

  it("name overrides set the value when the provider gives none", () => {
    const { sim, r } = setup();
    r.handle(ev("gift", "andi", { gift: { giftId: null, giftName: "Doughnut", repeatCount: 1, repeatFinal: true, providerValue: null } }));
    expect(count(sim, "andi", "wizard")).toBe(3);
  });

  it("likes give a spearman per 30 likes, capped per minute, only for joined viewers", () => {
    const { sim, r } = setup();
    expect(r.handle(ev("like", "x", { like: { count: 300 } })).reason).toBe("not_joined");
    r.handle(chat("x", "ikut"));
    r.handle(ev("like", "x", { like: { count: 15 } }));
    r.handle(ev("like", "x", { like: { count: 15 } }));
    expect(count(sim, "x", "spearman")).toBe(11);
    r.handle(ev("like", "x", { like: { count: 1000 } }));
    expect(count(sim, "x", "spearman")).toBe(20);
  });

  it("share has a cooldown and follow pays once per round", () => {
    const { sim, r } = setup();
    r.handle(chat("y", "ikut"));
    r.handle(ev("share", "y"));
    r.handle(ev("share", "y"));
    expect(count(sim, "y", "archer")).toBe(3);
    r.handle(ev("follow", "y"));
    r.handle(ev("follow", "y"));
    expect(count(sim, "y", "spearman")).toBe(15);
  });

  it("serang targets by partial name; bertahan and boss work", () => {
    const { sim, r } = setup();
    r.handle(chat("budi_raja", "ikut"));
    r.handle(chat("sari.ratu", "ikut"));
    sim.nextPhase();
    expect(r.handle(chat("budi_raja", "serang sari")).status).toBe("applied");
    expect(sim.kingdomByKey("budi_raja")!.order?.kind).toBe("attack");
    expect(r.handle(chat("sari.ratu", "bertahan")).status).toBe("applied");
    expect(r.handle(chat("sari.ratu", "boss")).reason).toBe("cooldown");
  });

  it("safe mode ignores real events but not mock", () => {
    const { r } = setup();
    r.safeMode = true;
    expect(r.handle({ ...chat("z", "ikut"), source: "tiktok-live-connector" }).reason).toBe("safe_mode");
    expect(r.handle(chat("z", "ikut")).status).toBe("applied");
  });

  it("a 1000+ gift levels the castle; 5000+ summons the dragon in war", () => {
    const { sim, r } = setup();
    r.handle(chat("k", "ikut"));
    sim.nextPhase();
    r.handle(gift("k", "Galaxy", 1000));
    expect(sim.kingdomByKey("k")!.level).toBe(2);
    r.handle(gift("k", "Lion", 29999));
    expect(sim.dragon?.summonedBy).toBe(sim.kingdomByKey("k")!.id);
  });
});

describe("expansion command", () => {
  it("ekspansi sends the kingdom to take villages", () => {
    const { sim, r } = setup();
    r.handle(chat("budi_raja", "ikut"));
    sim.nextPhase();
    expect(r.handle(chat("budi_raja", "ayo ekspansi!")).status).toBe("applied");
    expect(sim.kingdomByKey("budi_raja")!.order?.kind).toBe("expand");
  });
});
