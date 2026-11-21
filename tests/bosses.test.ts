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

/** Move every troop of the war to a ring around (x, z), on land. */
const gather = (s: Sim, x: number, z: number, r: number) => {
  let i = 0;
  for (const u of s.units) {
    if (!u.alive) continue;
    for (let tries = 0; tries < 30; tries++) {
      const a = (i++ * 2.39996) % (Math.PI * 2);
      const d = r * (0.3 + ((i * 7) % 10) / 14);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      if (map.walkable(map.cellAt(px, pz))) {
        u.x = px;
        u.z = pz;
        break;
      }
    }
  }
};
const tough = (c: ReturnType<typeof loadConfig>) => {
  for (const k of ["boneDragon", "yeti", "kraken", "treant", "worm"] as const) c[k].hpMultiplier = 1000;
};

describe("regional bosses", () => {
  it("each map names its own monster, and it comes out of its landmark", () => {
    const s = war();
    expect(["treant", "yeti", "kraken", "worm"]).toContain(s.regionBoss());
    for (const [kind, lm] of [["bone", "dragonBones"], ["yeti", "iceSpire"], ["treant", "greatTree"], ["worm", "sandArch"]] as const) {
      const t = war();
      const l = map.landmarks.find((x) => x.kind === lm);
      expect(t.summonBoss(kind)).toBe(true);
      const d = t.dragon!;
      if (l) expect(Math.hypot(d.x - l.x, d.z - l.z)).toBeLessThan(l.r + 45);
      if (kind !== "bone") expect(map.walkable(map.cellAt(d.x, d.z))).toBe(true);
    }
  });

  it("takes likes as shots and leaves in a rampage when time is up", () => {
    const s = war(tough);
    s.summonBoss("yeti");
    expect(s.bossLike("andi", "andi", s.cfg.titan.likesPerShot)).toBe(1);
    const ev: SimEvent[] = [];
    run(s, s.cfg.yeti.seconds + 1, ev);
    expect(s.dragon).toBeNull();
    expect(ev.some((e) => e.k === "boss" && e.kind === "yeti" && e.act === "rampage")).toBe(true);
    expect(ev.some((e) => e.k === "dragon" && e.state === "leave" && e.kind === "yeti")).toBe(true);
  });

  it("pays its own reward: the Kraken gives griffins and a level", () => {
    const s = war();
    s.summonBoss("kraken");
    const k = s.kingdomByKey("sari")!;
    const level = k.level;
    const griffins = () => s.units.filter((u) => u.alive && u.kid === k.id && u.type === "griffin").length;
    s.dragon!.hp = 1;
    s.bossLike("sari", "sari", s.cfg.titan.likesPerShot);
    expect(s.dragon).toBeNull();
    expect(griffins()).toBe(s.cfg.kraken.rewardUnits.griffin);
    expect(k.level).toBe(level + 1);
  });
});

describe("Naga Tengkorak", () => {
  it("raises bone spikes under its prey, wails at a crowd, and breathes soul fire", () => {
    const s = war(tough);
    s.summonBoss("bone");
    const d = s.dragon!;
    d.hp = d.maxHp * 0.5;
    const ev: SimEvent[] = [];
    // keep the troops crowding under it as it flies
    for (let i = 0; i < 30; i++) {
      gather(s, d.x, d.z, 8);
      run(s, 1, ev);
    }
    expect(ev.some((e) => e.k === "boss" && e.act === "wail")).toBe(true);
    expect(ev.filter((e) => e.k === "strike" && e.style === "bone").length).toBeGreaterThanOrEqual(s.cfg.boneDragon.spikeCount);
    expect(ev.some((e) => e.k === "shot" && e.type === "dragon")).toBe(true);
    // troops hit it too, but the drain has to show: it must have healed at some point
    expect(ev.some((e) => e.k === "death")).toBe(true);
  });
});

describe("Naga Tengkorak drain", () => {
  it("heals for every troop its breath kills", () => {
    const s = war(tough);
    s.summonBoss("bone");
    const d = s.dragon!;
    d.hp = d.maxHp * 0.5;
    d.special = d.special2 = 99;
    d.cd = 99;
    const u = s.units.find((o) => o.alive)!;
    u.x = d.x + 3;
    u.z = d.z;
    u.hp = 1;
    // one step so the spatial grid knows where the troop stands
    s.step(0.05);
    d.cd = 0;
    d.hp = d.maxHp * 0.5;
    (s as unknown as { updateBone: (d: unknown, dt: number) => void }).updateBone(d, 0.05);
    expect(u.alive).toBe(false);
    expect(d.hp).toBeGreaterThan(d.maxHp * 0.5);
  });
});

describe("Raksasa Es", () => {
  it("calls a blizzard on a crowd and throws ice that freezes troops", () => {
    const s = war(tough);
    s.summonBoss("yeti");
    const d = s.dragon!;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 8 && !ev.some((e) => e.k === "boss" && e.act === "blizzard"); i++) {
      gather(s, d.x, d.z, 14);
      run(s, 1, ev);
    }
    expect(ev.some((e) => e.k === "boss" && e.act === "blizzard")).toBe(true);
    expect(d.zone).not.toBeNull();
    // some troops further out: a block of ice for them
    for (let i = 0; i < s.cfg.yeti.throwEvery + 3; i++) {
      gather(s, d.x + 22, d.z, 6);
      run(s, 1, ev);
    }
    const ice = ev.find((e) => e.k === "impact" && e.style === "ice");
    expect(ice).toBeTruthy();
    expect(s.units.some((u) => u.alive && u.stunUntil > s.t - 3)).toBe(true);
  });
});

describe("Kraken", () => {
  it("comes up in the sea off the leader's coast and dives out of reach", () => {
    const s = war(tough);
    s.summonBoss("kraken");
    const d = s.dragon!;
    expect(map.walkable(map.cellAt(d.x, d.z))).toBe(false);
    const ev: SimEvent[] = [];
    // a blow being wound up holds its other timers, so give it a few seconds of slack
    run(s, s.cfg.kraken.diveEvery - 1, ev);
    for (let i = 0; i < 60 && !d.hidden; i++) run(s, 0.1, ev);
    expect(ev.some((e) => e.k === "boss" && e.act === "dive")).toBe(true);
    expect(d.hidden).toBe(true);
    expect(s.bossTargetable()).toBe(false);
    run(s, s.cfg.kraken.diveSeconds + 0.5, ev);
    expect(ev.some((e) => e.k === "boss" && e.act === "surface")).toBe(true);
    expect(d.hidden).toBe(false);
    expect(map.walkable(map.cellAt(d.x, d.z))).toBe(false);
  });

  it("grabs troops on the beach and slams the shore", () => {
    const s = war(tough);
    s.summonBoss("kraken");
    const d = s.dragon!;
    gather(s, d.x, d.z, 14);
    const ev: SimEvent[] = [];
    run(s, 12, ev);
    expect(ev.filter((e) => e.k === "boss" && e.act === "grab").length).toBeGreaterThan(0);
    expect(ev.some((e) => e.k === "boss" && e.act === "tentacleWindup")).toBe(true);
    expect(ev.some((e) => e.k === "boss" && e.kind === "kraken" && e.act === "slam")).toBe(true);
    // the troops on the beach reach it and fight back
    expect([...d.damage.values()].some((v) => v > 0)).toBe(true);
  });
});

describe("Treant Purba", () => {
  it("sends a line of roots to its prey that holds the troops they catch, and heals in the forest", () => {
    const s = war(tough);
    s.summonBoss("treant");
    const d = s.dragon!;
    run(s, 0.1);
    const prey = s.kingdomById(d.prey) ?? s.leaderboard()[0];
    d.x = prey.x + 18;
    d.z = prey.z;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 8; i++) {
      d.x = prey.x + 18;
      d.z = prey.z;
      gather(s, prey.x + 9, prey.z, 4);
      run(s, 1, ev);
    }
    const roots = ev.filter((e) => e.k === "strike" && e.style === "root");
    expect(roots.length).toBe(s.cfg.treant.rootCount);
    expect(s.units.some((u) => u.alive && u.stunUntil > s.t - 6)).toBe(true);
    // in a forest it grows back
    const forest = map.biome.findIndex((b, i) => b === "forest" && map.component[i] === map.mainComponent);
    const c = map.cellCenter(forest);
    const t = war(tough);
    t.summonBoss("treant");
    const tr = t.dragon!;
    tr.x = c.x;
    tr.z = c.z;
    tr.hp = tr.maxHp * 0.9;
    const before = tr.hp;
    (t as unknown as { updateTreant: (d: unknown, dt: number) => void }).updateTreant(tr, 1);
    expect(tr.hp).toBeGreaterThan(before);
  });
});

describe("walking bosses", () => {
  it("find their way round water to the prey's castle", () => {
    for (const kind of ["treant", "yeti"] as const) {
      const s = war(tough);
      s.summonBoss(kind);
      const d = s.dragon!;
      // nobody fights it, so it only walks
      for (const u of s.units) u.alive = false;
      run(s, 0.5);
      const prey = s.kingdomById(d.prey)!;
      const before = Math.hypot(prey.x - d.x, prey.z - d.z);
      run(s, 40);
      const after = Math.hypot(prey.x - d.x, prey.z - d.z);
      expect(after).toBeLessThan(Math.max(d.radius + 6, before - 40));
    }
  });
});

describe("Cacing Pasir", () => {
  it("burrows, tunnels to the crowd, warns, and bursts up swallowing troops", () => {
    const s = war(tough);
    s.summonBoss("worm");
    const ev: SimEvent[] = [];
    run(s, s.cfg.worm.surfaceSeconds + 0.5, ev);
    expect(ev.some((e) => e.k === "boss" && e.act === "burrow")).toBe(true);
    expect(s.dragon!.hidden).toBe(true);
    run(s, 16, ev);
    const order = ev.filter((e) => e.k === "boss" && e.kind === "worm").map((e) => (e.k === "boss" ? e.act : ""));
    const b = order.indexOf("burrow");
    const w = order.indexOf("eruptWindup");
    const x = order.indexOf("erupt");
    expect(b).toBeGreaterThanOrEqual(0);
    expect(w).toBeGreaterThan(b);
    expect(x).toBeGreaterThan(w);
  });
});
