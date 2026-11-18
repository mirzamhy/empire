import { describe, expect, it } from "vitest";
import { dayBlend, dayClock, nightOf, paintLightPool, parseTimeMode, swapPower, swapsLight } from "../game/src/render/daycycle";

const round = { lobbySeconds: 60, warSeconds: 900, finalSeconds: 120 };

describe("day cycle", () => {
  it("starts the round in the morning and stays there through the lobby", () => {
    expect(dayClock("LOBBY", 0, round)).toBe(0);
    const b = dayBlend(dayClock("LOBBY", 60, round)!);
    expect(b.from).toBe("pagi");
    expect(b.k).toBe(0);
  });

  it("reaches the afternoon when the war hands over to the final phase", () => {
    const b = dayBlend(dayClock("WAR", 779.9, round)!);
    expect(b.from).toBe("siang");
    expect(b.to).toBe("sore");
    expect(b.k).toBeGreaterThan(0.99);
  });

  it("has a full night in the middle of the war", () => {
    const b = dayBlend(dayClock("WAR", 400, round)!);
    expect(b.from).toBe("malam");
    expect(nightOf(b)).toBe(1);
  });

  it("leaves the final and result phases to their own moods", () => {
    expect(dayClock("FINAL", 5, round)).toBeNull();
    expect(dayClock("RESULT", 5, round)).toBeNull();
  });

  it("blends without jumps, and hides the sun while it swaps with the moon", () => {
    let last = nightOf(dayBlend(0));
    for (let c = 0; c < 1; c += 0.001) {
      const n = nightOf(dayBlend(c));
      expect(Math.abs(n - last)).toBeLessThan(0.05);
      last = n;
    }
    expect(swapsLight({ from: "sore", to: "malam", k: 0 })).toBe(true);
    expect(swapsLight({ from: "pagi", to: "siang", k: 0 })).toBe(false);
    expect(swapPower(0.5)).toBe(0);
    expect(swapPower(0)).toBe(1);
    expect(swapPower(1)).toBe(1);
  });

  it("reads the url option", () => {
    expect(parseTimeMode("malam")).toBe("malam");
    expect(parseTimeMode("off")).toBe("off");
    expect(parseTimeMode(null)).toBe("auto");
    expect(parseTimeMode("x")).toBe("auto");
  });

  it("paints pools that fade out and stay inside the map", () => {
    const data = new Uint8Array(100);
    paintLightPool(data, 10, 10, 4, [{ x: 0, z: 0, r: 8, power: 1 }, { x: 19, z: 19, r: 8, power: 0.5 }]);
    expect(data[5 * 10 + 5]).toBeGreaterThan(180);
    expect(data[0]).toBe(0);
    expect(data[9 * 10 + 9]).toBeGreaterThan(0);
    expect(data[9 * 10 + 9]).toBeLessThan(128);
  });
});
