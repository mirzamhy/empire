// Mechanics of the second wave of units: bonus damage, taunt, cover, rage, stealth, trample,
// siege rules and engineer-built village towers.
import { describe, expect, it } from "vitest";
import { loadConfig, UNIT_TYPES, type UnitType } from "../game/src/sim/config";
import { WorldMap } from "../game/src/sim/map";
import { Sim, type Unit } from "../game/src/sim/world";

const map = new WorldMap();
/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

/** Two kingdoms at war; returns helpers to drop units at exact spots. */
function duel(seed = 3) {
  const s = new Sim(loadConfig(), map, seed);
  const a = s.join("a", "A").kingdom!;
  const b = s.join("b", "B").kingdom!;
  s.nextPhase();
  // clear the starting troops so only the units under test act
  for (const u of s.units) u.alive = false;
  const put = (key: string, type: UnitType, x: number, z: number): Unit => {
    const before = new Set(s.units.map((u) => u.id));
    s.addUnits(key, key.toUpperCase(), { [type]: 1 }, "test", false);
    const u = s.units.find((x2) => !before.has(x2.id))!;
    u.x = x;
    u.z = z;
    return u;
  };
  // an open spot between the two castles
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  return { s, a, b, put, mx, mz, priv: s as Any };
}
const run = (s: Sim, sec: number) => {
  for (let i = 0; i < sec * 20; i++) s.step(0.05);
};

describe("unit roster", () => {
  it("every unit type has stats, and tags only use known words", () => {
    const cfg = loadConfig();
    for (const t of UNIT_TYPES) {
      const st = cfg.unitTypes[t];
      expect(st, t).toBeDefined();
      expect(st.hp).toBeGreaterThan(0);
      for (const tag of st.tags ?? []) expect(["big", "support", "siege"]).toContain(tag);
    }
  });
});

describe("bonus damage", () => {
  it("follows bonusVs for tags, castles and dragons", () => {
    const { priv } = duel();
    expect(priv.bonusVs("halberdier", "cavalry")).toBeCloseTo(1.6);
    expect(priv.bonusVs("halberdier", "elephant")).toBeCloseTo(1.6);
    expect(priv.bonusVs("halberdier", "spearman")).toBe(1);
    expect(priv.bonusVs("ballista", "dragon")).toBeCloseTo(2);
    expect(priv.bonusVs("trebuchet", "castle")).toBeCloseTo(4);
    expect(priv.bonusVs("trebuchet", "spearman")).toBeCloseTo(0.25);
    expect(priv.bonusVs("spearman", "castle")).toBe(1);
  });

  it("a berserker hits harder when wounded", () => {
    const { s, put, mx, mz } = duel();
    const fresh = put("a", "berserker", mx, mz);
    const dummy = put("b", "golem", mx + 1, mz);
    dummy.hp = dummy.maxHp = 100000;
    dummy.dmg = 0;
    run(s, 4);
    const healthy = 100000 - dummy.hp;
    dummy.hp = 100000;
    fresh.hp = fresh.maxHp * 0.2;
    const before = dummy.hp;
    run(s, 4);
    expect(before - dummy.hp).toBeGreaterThan(healthy * 1.3);
  });
});

describe("shieldbearer", () => {
  it("draws attacks from enemies within its taunt range", () => {
    const { s, put, mx, mz } = duel();
    const attacker = put("a", "swordsman", mx, mz);
    const close = put("b", "spearman", mx + 2, mz);
    const shield = put("b", "shieldbearer", mx - 4, mz);
    run(s, 0.2);
    expect(attacker.tKind).toBe("unit");
    expect(attacker.tId).toBe(shield.id);
    expect(close.alive).toBe(true);
  });

  it("covers nearby allies from ranged damage", () => {
    const { a, put, mx, mz, priv } = duel();
    const open = put("b", "spearman", mx, mz);
    const covered = put("b", "spearman", mx + 30, mz);
    put("b", "shieldbearer", mx + 31.5, mz);
    priv.rebuildGrid?.();
    priv.step(0.05);
    const h1 = open.hp;
    const h2 = covered.hp;
    priv.damageUnit(open, 50, a, true);
    priv.damageUnit(covered, 50, a, true);
    const lostOpen = h1 - open.hp;
    const lostCovered = h2 - covered.hp;
    expect(lostCovered).toBeLessThan(lostOpen * 0.75);
  });
});

describe("assassin", () => {
  it("cannot be targeted until it strikes or is hit", () => {
    const { s, a, put, mx, mz, priv } = duel();
    const sneak = put("b", "assassin", mx + 3, mz);
    s.step(0.05);
    expect(priv.nearestEnemyUnit(mx, mz, 10, a.id)).toBeNull();
    sneak.revealed = true;
    expect(priv.nearestEnemyUnit(mx, mz, 10, a.id)?.id).toBe(sneak.id);
  });

  it("goes for archers before closer melee units", () => {
    const { s, put, mx, mz } = duel();
    const sneak = put("a", "assassin", mx, mz);
    put("b", "spearman", mx + 3, mz);
    const archer = put("b", "archer", mx + 9, mz);
    run(s, 0.2);
    expect(sneak.tId).toBe(archer.id);
  });
});

describe("siege", () => {
  it("a trebuchet does not fire at targets inside its minimum range", () => {
    const { s, put, mx, mz } = duel();
    const treb = put("a", "trebuchet", mx, mz);
    const near = put("b", "golem", mx + 3, mz);
    near.dmg = 0;
    near.hp = near.maxHp = 5000;
    run(s, 4);
    expect(near.hp).toBe(5000);
    expect(treb.attackAt).toBeLessThan(0);
  });

  it("an elephant tramples small units it walks through", () => {
    const { s, b, put, mx, mz } = duel();
    const el = put("a", "elephant", mx, mz);
    // far target keeps the elephant walking; a spearman stands in the way
    const dx = (b.x - mx) / Math.hypot(b.x - mx, b.z - mz);
    const dz = (b.z - mz) / Math.hypot(b.x - mx, b.z - mz);
    const victim = put("b", "skeleton", mx + dx * 1.2, mz + dz * 1.2);
    victim.dmg = 0;
    const hp = victim.hp;
    el.tKind = "castle";
    el.tId = b.id;
    el.retarget = 99;
    el.moving = true;
    el.atkCd = 99;
    run(s, 1);
    expect(victim.hp).toBeLessThan(hp);
  });
});

describe("engineer", () => {
  it("builds a tower in an owned village, and capture removes it", () => {
    const { s, a, b, put, priv } = duel();
    const v = s.villages[0];
    v.owner = a.id;
    const eng = put("a", "engineer", v.x + 3, v.z);
    run(s, loadConfig().villages.towerBuildSeconds + 8);
    expect(eng.alive).toBe(true);
    expect(v.tower).toBe(true);
    priv.captureVillage(v, b.id);
    expect(v.tower).toBe(false);
    expect(v.build).toBe(0);
  });
});
