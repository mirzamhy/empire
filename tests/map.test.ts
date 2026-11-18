import { describe, expect, it } from "vitest";
import { WorldMap } from "../game/src/sim/map";
import { Rng } from "../game/src/sim/rng";

const map = new WorldMap();

describe("world map", () => {
  it("has a continent, an altar on land and enough buildable ground", () => {
    expect(map.mainComponent).toBeGreaterThanOrEqual(0);
    expect(map.biomeAt(map.altar.x, map.altar.z)).not.toBe("water");
    const buildable = map.buildable.reduce((a, b) => a + b, 0);
    expect(buildable).toBeGreaterThan(1500);
  });

  it("places 40 castles on valid, separated land", () => {
    const rng = new Rng(7);
    const taken: { x: number; z: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const p = map.sampleSpawn(rng, taken);
      expect(p).not.toBeNull();
      const b = map.biomeAt(p!.x, p!.z);
      expect(["plains", "desert", "forest", "snow"]).toContain(b);
      taken.push(p!);
    }
    for (let i = 0; i < taken.length; i++)
      for (let j = i + 1; j < taken.length; j++) expect(Math.hypot(taken[i].x - taken[j].x, taken[i].z - taken[j].z)).toBeGreaterThanOrEqual(6.9);
  });

  it("every castle can walk to the altar", () => {
    const field = map.fieldTo(map.altar.x, map.altar.z);
    const rng = new Rng(3);
    for (let i = 0; i < 20; i++) {
      const p = map.sampleSpawn(rng, [])!;
      expect(field[map.cellAt(p.x, p.z)]).toBeLessThan(65535);
    }
  });
});
