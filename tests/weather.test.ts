import { describe, expect, it } from "vitest";
import { dayClock, sunArc } from "../game/src/render/daycycle";
import { CLEAR_FX, LOOKS, WEATHERS, lookAt, parseWeatherMode, precipAt, roundClock, weatherAt, weatherWeights } from "../game/src/render/weathercycle";
import type { Biome } from "../game/src/sim/map";

const round = { lobbySeconds: 60, warSeconds: 900, finalSeconds: 120 };
const land = (b: Biome, n: number) => Array<Biome>(n).fill(b);

describe("sun path", () => {
  it("crosses the sky from east to west during the day", () => {
    const morning = sunArc(dayClock("LOBBY", 0, round)!);
    const noon = sunArc(0.25);
    const evening = sunArc(0.5);
    expect(morning[0]).toBeGreaterThan(noon[0]);
    expect(noon[0]).toBeGreaterThan(evening[0]);
    expect(evening[0]).toBeLessThan(-100);
    expect(noon[1]).toBeGreaterThan(morning[1]);
    expect(noon[1]).toBeGreaterThan(evening[1]);
  });

  it("stays high enough to keep shadows on the map, and moves smoothly while it is up", () => {
    for (let c = 0; c < 1; c += 0.01) expect(sunArc(c)[1]).toBeGreaterThanOrEqual(75);
    for (let c = 0; c < 0.6; c += 0.002) expect(Math.abs(sunArc(c + 0.002)[0] - sunArc(c)[0])).toBeLessThan(3);
  });
});

describe("weather", () => {
  const green = weatherWeights([...land("forest", 90), ...land("plains", 10)], "dark");
  const three = weatherWeights([...land("forest", 70), ...land("snow", 10), ...land("desert", 20)], "vivid");

  it("adapts its odds to the land of the map", () => {
    expect(green.pasir).toBe(0);
    expect(three.pasir).toBeGreaterThan(0);
    expect(three.salju).toBeGreaterThan(green.salju);
    expect(weatherWeights(land("desert", 100), "dark").pasir).toBe(0);
    for (const w of ["cerah", "berawan", "hujan", "badai", "kabut", "salju"] as const) expect(green[w]).toBeGreaterThan(0);
  });

  it("keeps the lobby and the result screen clear", () => {
    expect(weatherAt(3, 20, "LOBBY", three, 60).strength).toBe(0);
    expect(weatherAt(3, 980, "RESULT", three, 60).strength).toBe(0);
  });

  it("is the same for the same round, differs between rounds, and fades without jumps", () => {
    const seq = (id: number) => Array.from({ length: 80 }, (_, i) => weatherAt(id, 60 + i * 10, "WAR", three, 60).kind).join();
    expect(seq(5)).toBe(seq(5));
    expect(seq(5)).not.toBe(seq(6));
    let last = weatherAt(5, 60, "WAR", three, 60);
    for (let t = 60; t < 960; t += 0.5) {
      const n = weatherAt(5, t, "WAR", three, 60);
      if (n.kind !== last.kind) {
        expect(last.strength).toBeLessThan(0.02);
        expect(n.strength).toBeLessThan(0.02);
      }
      expect(Math.abs(n.strength - last.strength)).toBeLessThan(0.1);
      last = n;
    }
  });

  it("brings every kind the map allows over a few rounds, and never a forbidden one", () => {
    const seen = new Set<string>();
    for (let id = 1; id <= 30; id++) for (let t = 60; t < 960; t += 20) seen.add(weatherAt(id, t, "WAR", green, 60).kind);
    expect(seen.has("pasir")).toBe(false);
    for (const w of WEATHERS) if (w !== "pasir") expect(seen.has(w)).toBe(true);
  });

  it("falls according to the ground below", () => {
    expect(precipAt("hujan", "forest")).toBe("rain");
    expect(precipAt("hujan", "snow")).toBe("snow");
    expect(precipAt("salju", "desert")).toBe("none");
    expect(precipAt("salju", "plains")).toBe("snow");
    expect(precipAt("pasir", "plains")).toBe("sand");
    expect(precipAt("kabut", "plains")).toBe("none");
  });

  it("grows out of the clear sky", () => {
    const off = lookAt({ kind: "badai", strength: 0 });
    expect(off.sun).toBe(CLEAR_FX.sun);
    expect(off.tintAmount).toBe(0);
    expect(lookAt({ kind: "badai", strength: 1 }).sun).toBeCloseTo(LOOKS.badai.sun);
  });

  it("keeps one clock through the phases, and reads the url option", () => {
    expect(roundClock("LOBBY", 10, round)).toBe(10);
    expect(roundClock("WAR", 10, round)).toBe(70);
    expect(roundClock("FINAL", 10, round)).toBe(850);
    expect(roundClock("RESULT", 10, round)).toBe(970);
    expect(parseWeatherMode("badai")).toBe("badai");
    expect(parseWeatherMode("off")).toBe("off");
    expect(parseWeatherMode("x")).toBe("auto");
  });
});
