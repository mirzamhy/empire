import { describe, expect, it } from "vitest";
import { loadConfig } from "../game/src/sim/config";
import { WorldMap } from "../game/src/sim/map";
import { Sim } from "../game/src/sim/world";
import { runRound } from "../scripts/sim-smoke";

const map = new WorldMap();
const mk = (seed = 1) => new Sim(loadConfig(), map, seed);
const run = (s: Sim, sec: number) => {
  for (let i = 0; i < sec * 20; i++) s.step(0.05);
};

describe("joining", () => {
  it("gives every kingdom the same start and a unique spot", () => {
    const s = mk();
    const a = s.join("budi", "Budi").kingdom!;
    const b = s.join("sari", "Sari").kingdom!;
    expect(s.join("budi", "Budi").status).toBe("exists");
    expect(a.unitCount).toBe(10);
    expect(b.unitCount).toBe(10);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(7);
    expect(a.color).not.toBe(b.color);
  });

  it("queues viewers beyond the kingdom cap and lets them in when a castle falls", () => {
    const cfg = loadConfig();
    cfg.kingdom.maxActive = 3;
    const s = new Sim(cfg, map, 2);
    for (const n of ["a", "b", "c"]) s.join(n, n);
    expect(s.join("d", "d").status).toBe("queued");
    s.kick("a");
    expect(s.kingdomByKey("d")).not.toBeNull();
  });

  it("enforces the rejoin cooldown and keeps gifts as reserve", () => {
    const s = mk();
    s.join("budi", "Budi");
    s.nextPhase();
    s.kick("budi");
    const u = s.users.get("budi")!;
    u.rejoinAt = s.t + 60;
    expect(s.join("budi", "Budi").status).toBe("cooldown");
    expect(s.addUnits("budi", "Budi", { golem: 1 }, "gift", true)).toBe("reserved");
    run(s, 61);
    const r = s.join("budi", "Budi");
    expect(r.status).toBe("joined");
    expect(s.units.some((x) => x.kid === r.kingdom!.id && x.type === "golem")).toBe(true);
  });
});

describe("troops and caps", () => {
  it("auto-joins a gifter and adds troops to their own kingdom", () => {
    const s = mk();
    expect(s.addUnits("andi", "Andi", { cavalry: 3 }, "gift", true)).toBe("added");
    const k = s.kingdomByKey("andi")!;
    expect(s.units.filter((u) => u.kid === k.id && u.type === "cavalry").length).toBe(3);
  });

  it("likes do not create kingdoms", () => {
    const s = mk();
    expect(s.addUnits("ghost", "Ghost", { spearman: 1 }, "like", false)).toBe("ignored");
    expect(s.kingdomByKey("ghost")).toBeNull();
  });

  it("puts troops over the kingdom cap in pending, not on the field", () => {
    const s = mk();
    s.addUnits("andi", "Andi", { spearman: 80 }, "gift", true);
    const k = s.kingdomByKey("andi")!;
    expect(k.unitCount).toBe(s.unitCap(k));
    expect(k.pending.length).toBeGreaterThan(0);
  });
});

describe("war", () => {
  it("orders target a kingdom by name prefix", () => {
    const s = mk();
    s.join("budi_raja", "budi_raja");
    s.join("sari.ratu", "sari.ratu");
    s.nextPhase();
    const r = s.order("budi_raja", "attack", "sari");
    expect(r.ok).toBe(true);
    expect(r.target?.key).toBe("sari.ratu");
    expect(s.order("budi_raja", "defend").ok).toBe(false); // cooldown
  });

  it("new joiners in war are shielded and cannot be attacked", () => {
    const s = mk();
    s.join("a", "a");
    s.nextPhase();
    const b = s.join("b", "b").kingdom!;
    expect(s.shielded(b)).toBe(true);
    expect(s.order("a", "attack", "b").ok).toBe(false);
  });

  it("a fallen kingdom's troops disband and the attacker gains exp", () => {
    const s = mk();
    const a = s.join("a", "a").kingdom!;
    const b = s.join("b", "b").kingdom!;
    s.nextPhase();
    b.hp = 1;
    for (const x of s.units) if (x.kid === b.id) x.alive = false;
    b.unitCount = 0;
    b.passiveTimer = -999;
    b.towerCd = 999;
    const exp0 = a.exp + a.level * 1000;
    // force one of a's units next to b's castle
    const u = s.units.find((x) => x.kid === a.id)!;
    u.x = b.x + 1;
    u.z = b.z + 1;
    s.order("a", "attack", "b");
    run(s, 3);
    expect(b.alive).toBe(false);
    expect(s.units.some((x) => x.kid === b.id && x.alive)).toBe(false);
    expect(a.exp + a.level * 1000).toBeGreaterThan(exp0);
  });

  it("the dragon spawns and rewards the top damage dealer", () => {
    const s = mk();
    s.join("a", "a");
    s.nextPhase();
    expect(s.summonDragon("a")).toBe(true);
    s.dragon!.hp = 1;
    s.order("a", "boss");
    run(s, 60);
    expect(s.dragon).toBeNull();
    expect(s.units.some((u) => u.type === "dragon")).toBe(true);
  });
});

describe("rounds", () => {
  it("is deterministic for a seed", () => {
    const a = runRound(4, 10, true);
    const b = runRound(4, 10, true);
    expect(a).toMatchObject({ winner: b.winner, t: b.t, fallen: b.fallen });
  });

  it("a no-gift round ends with a winner and several winners across seeds", () => {
    const winners = new Set<string>();
    for (const seed of [1, 2, 3, 4]) {
      const r = runRound(seed, 12, true);
      expect(r.winner).not.toBe("-");
      winners.add(r.winner);
    }
    expect(winners.size).toBeGreaterThanOrEqual(3);
  });

  it("survivors carry into the next round with a fresh equal start", () => {
    const s = mk();
    s.join("a", "a");
    s.join("b", "b");
    s.nextPhase();
    s.levelUp("a", 3);
    s.nextPhase(); // to RESULT
    s.nextPhase(); // new round
    expect(s.phase).toBe("LOBBY");
    expect(s.roundId).toBe(2);
    expect(s.kingdomByKey("a")?.level).toBe(1);
    expect(s.kingdomByKey("a")?.unitCount).toBe(10);
  });
});
