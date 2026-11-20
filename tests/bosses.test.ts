import { describe, expect, it } from "vitest";
import { loadConfig } from "../game/src/sim/config";
import { WorldMap } from "../game/src/sim/map";
import { Sim, type SimEvent } from "../game/src/sim/world";

const map = new WorldMap();
/** A war with a few kingdoms, five seconds in. */
const war = (cfgEdit: (c: ReturnType<typeof loadConfig>) => void = () => {}) => {
  const cfg = loadConfig();
  cfgEdit(cfg);
  const s = new Sim(cfg, map, 7);
  for (const n of ["andi", "budi", "sari", "tono"]) s.join(n, n);
  s.nextPhase();
  run(s, 5);
  s.drainEvents();
  return s;
};
const run = (s: Sim, sec: number, into?: SimEvent[]) => {
  for (let i = 0; i < sec * 20; i++) {
    s.step(0.05);
    if (into) into.push(...s.drainEvents());
  }
};

describe("Hujan Meteor Dunia", () => {
  it("only falls during the war, and not twice at once", () => {
    const cfg = loadConfig();
    const lobby = new Sim(cfg, map, 1);
    lobby.join("andi", "andi");
    expect(lobby.worldMeteor()).toBe(false);
    const s = war();
    expect(s.worldMeteor()).toBe(true);
    expect(s.worldMeteor()).toBe(false);
  });

  it("rains meteors over the map, then the mother meteor lands on the chosen kingdom", () => {
    const s = war();
    const target = s.kingdomByKey("sari")!;
    s.worldMeteor("sari");
    const first = s.drainEvents();
    const c = s.cfg.worldMeteor;
    const doom = first.find((e) => e.k === "doom");
    expect(doom && doom.k === "doom" && doom.target).toBe(target.id);
    expect(first.filter((e) => e.k === "strike" && e.style === "meteor").length).toBe(c.count);
    const mother = first.find((e) => e.k === "strike" && e.style === "mother");
    expect(mother && mother.k === "strike" && Math.hypot(mother.x - target.x, mother.z - target.z)).toBe(0);

    const later: SimEvent[] = [];
    run(s, c.warnSeconds + c.seconds + c.motherDelay + 1, later);
    const impacts = later.filter((e) => e.k === "impact");
    expect(impacts.length).toBe(c.count + 1);
    const big = impacts.find((e) => e.k === "impact" && e.r === c.motherRadius);
    expect(big && big.k === "impact" && big.dmg).toBeGreaterThan(0);
    // the sky clears: a new rain can be called again
    run(s, 3);
    expect(s.worldMeteor()).toBe(true);
  });
});

describe("Titan Neraka", () => {
  it("is the only boss on the field, and the World Dragon waits for it", () => {
    const s = war();
    expect(s.summonBoss("titan")).toBe(true);
    expect(s.summonDragon(null)).toBe(false);
    expect(s.dragon?.kind).toBe("titan");
    expect(s.dragonSpawnedThisRound).toBe(false);
  });

  it("walks toward the leading kingdom", () => {
    const s = war((c) => (c.titan.hpMultiplier = 100));
    s.summonBoss("titan");
    const d = s.dragon!;
    run(s, 1);
    const prey = s.kingdomById(d.prey)!;
    const before = Math.hypot(prey.x - d.x, prey.z - d.z);
    run(s, 8);
    expect(Math.hypot(prey.x - d.x, prey.z - d.z)).toBeLessThan(before);
  });

  it("turns likes into stones thrown at it, credited to the viewer's kingdom", () => {
    const s = war((c) => (c.titan.hpMultiplier = 100));
    s.summonBoss("titan");
    const d = s.dragon!;
    const hp = d.hp;
    const tc = s.cfg.titan;
    expect(s.bossLike("andi", "andi", tc.likesPerShot - 1)).toBe(0);
    expect(s.bossLike("andi", "andi", 1)).toBe(1);
    expect(d.hp).toBe(hp - tc.likeShotDamage);
    expect(d.damage.get(s.kingdomByKey("andi")!.id)).toBe(tc.likeShotDamage);
    // a viewer without a kingdom still throws, and a flood of likes is capped per event
    expect(s.bossLike("penonton", "penonton", tc.likesPerShot * 50)).toBe(tc.maxShotsPerEvent);
    expect(s.drainEvents().filter((e) => e.k === "likeShot").length).toBe(1 + tc.maxShotsPerEvent);
  });

  it("leaves in a rage when its time is up, and hits the leader's castle", () => {
    const s = war((c) => (c.titan.hpMultiplier = 1000));
    s.summonBoss("titan");
    const ev: SimEvent[] = [];
    run(s, s.cfg.titan.seconds + 1, ev);
    expect(s.dragon).toBeNull();
    expect(ev.some((e) => e.k === "boss" && e.act === "rampage")).toBe(true);
    expect(ev.some((e) => e.k === "dragon" && e.state === "leave")).toBe(true);
    // it swings its club along the way
    expect(ev.some((e) => e.k === "boss" && e.act === "slam")).toBe(true);
  });

  it("rewards the biggest attacker with golems and a level", () => {
    const s = war();
    s.summonBoss("titan");
    const k = s.kingdomByKey("budi")!;
    const level = k.level;
    const golems = () => s.units.filter((u) => u.alive && u.kid === k.id && u.type === "golem").length;
    const before = golems();
    s.dragon!.hp = s.cfg.titan.likeShotDamage;
    s.bossLike("budi", "budi", s.cfg.titan.likesPerShot);
    expect(s.dragon).toBeNull();
    expect(golems()).toBe(before + 2);
    // a level for the most damage and one more for the killing blow
    expect(k.level).toBe(level + 2);
  });
});

describe("Naga Purba", () => {
  it("hunts the leader and pours a line of hellfire", () => {
    const s = war((c) => (c.elder.hpMultiplier = 100));
    s.summonBoss("elder");
    const ev: SimEvent[] = [];
    run(s, s.cfg.elder.infernoEvery + 2, ev);
    const fire = ev.filter((e) => e.k === "strike" && e.style === "inferno");
    expect(fire.length).toBeGreaterThanOrEqual(s.cfg.elder.infernoCount);
    expect(ev.some((e) => e.k === "boss" && e.kind === "elder" && e.act === "inferno")).toBe(true);
    expect(s.dragon!.prey).toBe(s.leaderboard().find((k) => k.id === s.dragon!.prey)?.id);
  });

  it("is much tougher than the World Dragon and pays double", () => {
    const s = war();
    s.summonBoss("elder");
    const elderHp = s.dragon!.maxHp;
    expect(elderHp).toBe(Math.round((s.cfg.dragon.hpBase + s.cfg.dragon.hpPerKingdom * s.alive.length) * s.cfg.elder.hpMultiplier));
    const k = s.kingdomByKey("tono")!;
    const dragons = () => s.units.filter((u) => u.alive && u.kid === k.id && u.type === "dragon").length;
    s.dragon!.hp = 1;
    (s as unknown as { hitBoss: (d: number, by: unknown) => void }).hitBoss(5, k);
    expect(s.dragon).toBeNull();
    expect(dragons()).toBe(s.cfg.elder.rewardDragons);
  });
});
