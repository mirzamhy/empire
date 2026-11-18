// All maps load and are playable; the rivers of map 3 never get in the way of troops.
import { afterAll, describe, expect, it, vi } from "vitest";
import { Rng } from "../game/src/sim/rng";

type MapModule = typeof import("../game/src/sim/map");

async function loadMap(id: number): Promise<MapModule> {
  vi.resetModules();
  (globalThis as { EMPIRE_MAP?: number }).EMPIRE_MAP = id;
  return import("../game/src/sim/map");
}

afterAll(() => {
  delete (globalThis as { EMPIRE_MAP?: number }).EMPIRE_MAP;
});

describe("map selection", () => {
  it.each([
    [1, 256, 192],
    [2, 384, 288],
    [3, 384, 288],
    [4, 384, 288],
  ])("map %i loads with its own size, an altar and room for 40 castles", async (id, w, h) => {
    const m = await loadMap(id);
    expect(m.GRID_W).toBe(w);
    expect(m.GRID_H).toBe(h);
    const map = new m.WorldMap();
    expect(map.def.id).toBe(id);
    expect(map.biomeAt(map.altar.x, map.altar.z)).not.toBe("water");
    const rng = new Rng(11);
    const taken: { x: number; z: number }[] = [];
    const field = map.fieldTo(map.altar.x, map.altar.z);
    for (let i = 0; i < 40; i++) {
      const p = map.sampleSpawn(rng, taken);
      expect(p).not.toBeNull();
      expect(field[map.cellAt(p!.x, p!.z)]).toBeLessThan(65535);
      taken.push(p!);
    }
  });

  it("only maps 3 and 4 have rivers and landmarks", async () => {
    for (const id of [1, 2]) {
      const map = new (await loadMap(id)).WorldMap();
      expect(map.rivers).toHaveLength(0);
      expect(map.landmarks).toHaveLength(0);
    }
    for (const id of [3, 4]) {
      const map = new (await loadMap(id)).WorldMap();
      expect(map.rivers.length).toBeGreaterThanOrEqual(6);
      expect(map.landmarks.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("map 4, the three realms", () => {
  it("has every landmark it asks for", async () => {
    const map = new (await loadMap(4)).WorldMap();
    expect(map.landmarks.map((l) => l.name).sort()).toEqual(map.def.landmarks.map((l) => l.name).sort());
  });

  it("holds snow, red rock and sand, all reachable from the altar", async () => {
    const map = new (await loadMap(4)).WorldMap();
    const field = map.fieldTo(map.altar.x, map.altar.z);
    const reached: Record<string, number> = {};
    map.biome.forEach((b, i) => {
      if (field[i] < 65535) reached[b] = (reached[b] ?? 0) + 1;
    });
    expect(reached.snow).toBeGreaterThan(800);
    expect(reached.mesa).toBeGreaterThan(1500);
    expect(reached.desert).toBeGreaterThan(2500);
  });

  it("keeps castles off red rock but allows them on snow", async () => {
    const map = new (await loadMap(4)).WorldMap();
    let onSnow = 0;
    map.biome.forEach((b, i) => {
      if (b === "mesa") expect(map.buildable[i]).toBe(0);
      if (b === "snow" && map.buildable[i]) onSnow++;
    });
    expect(onSnow).toBeGreaterThan(100);
    expect(Math.max(...map.height)).toBeGreaterThan(38);
  });
});

describe.each([3, 4])("rivers of map %i", (id) => {
  it.runIf(id === 3)("leave biomes and navigation exactly as on map 2", async () => {
    const m2 = await loadMap(2);
    const plain = new m2.WorldMap();
    const m3 = await loadMap(3);
    const rivers = new m3.WorldMap();
    expect(rivers.biome).toEqual(plain.biome);
    // walking distance to a fixed point is the same from every cell
    expect(Array.from(rivers.fieldTo(0, 0))).toEqual(Array.from(plain.fieldTo(0, 0)));
  });

  it("are walkable everywhere, and no castle may stand in one", async () => {
    const m = await loadMap(id);
    const map = new m.WorldMap();
    let wet = 0;
    for (let i = 0; i < map.riverBank.length; i++) {
      if (map.riverBank[i] > 0 || map.biome[i] === "water") continue;
      wet++;
      expect(map.walkable(i)).toBe(true);
      expect(map.buildable[i]).toBe(0);
    }
    expect(wet).toBeGreaterThan(300);
  });

  it("always run downhill and end in a lake or the sea", async () => {
    const m = await loadMap(id);
    const map = new m.WorldMap();
    for (const r of map.rivers) {
      for (let i = 1; i < r.points.length; i++) expect(r.points[i].bed).toBeLessThanOrEqual(r.points[i - 1].bed + 1e-6);
      const mouth = r.points[r.points.length - 1];
      // the ribbon reaches into the water at the mouth
      expect(mouth.wet).toBe(true);
      expect(map.biomeAt(mouth.x, mouth.z)).toBe("water");
      for (const p of r.points) if (!p.wet) expect(p.surface).toBeGreaterThan(p.bed);
    }
  });

  it("have gentle banks in the lowlands, so troops walk in and out smoothly", async () => {
    const m = await loadMap(id);
    const map = new m.WorldMap();
    let worst = 0;
    for (const r of map.rivers) {
      for (let i = 2; i < r.points.length - 3; i += 3) {
        const p = r.points[i];
        const q = r.points[i + 1];
        if (p.bed > 2 || p.wet) continue; // lowland stretches on land only
        const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        const nx = -(q.z - p.z) / len;
        const nz = (q.x - p.x) / len;
        const hs: number[] = [];
        let rock = false;
        for (let t = -14; t <= 14; t += 0.5) {
          hs.push(map.heightAt(p.x + nx * t, p.z + nz * t));
          rock ||= map.biomeAt(p.x + nx * t, p.z + nz * t) === "mountain";
        }
        if (rock || Math.max(...hs) > 6) continue; // a hillside beside the river is steep on its own
        for (let k = 1; k < hs.length; k++) worst = Math.max(worst, Math.abs(hs[k] - hs[k - 1]));
      }
    }
    expect(worst).toBeLessThan(0.45);
  });

  it("keep landmarks on dry land, clear of castles", async () => {
    const m = await loadMap(id);
    const map = new m.WorldMap();
    for (const l of map.landmarks) {
      expect(map.biomeAt(l.x, l.z)).not.toBe("water");
      expect(map.riverBank[map.cellAt(l.x, l.z)]).toBeGreaterThan(l.r);
      expect(map.buildable[map.cellAt(l.x, l.z)]).toBe(0);
      expect(Math.hypot(l.x - map.altar.x, l.z - map.altar.z)).toBeGreaterThan(25);
    }
    expect(map.landmarkNear(map.landmarks[0].x + 5, map.landmarks[0].z)?.name).toBe(map.landmarks[0].name);
  });
});
