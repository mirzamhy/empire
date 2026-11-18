// Weather rules for every map: which weather a map can have, when it comes, and how it changes the
// light. The schedule is read from the round number and the round timer, so it pauses with the game
// and needs no state. Purely visual: nothing here is read by the sim.
// `?weather=cerah|berawan|hujan|badai|salju|kabut|pasir` holds one weather, `?weather=off` none.
import type { Biome } from "../sim/map";
import type { Phase } from "../sim/world";
import type { RoundTimes } from "./daycycle";

export const WEATHERS = ["cerah", "berawan", "hujan", "badai", "salju", "kabut", "pasir"] as const;
export type Weather = (typeof WEATHERS)[number];
export type WeatherMode = "auto" | "off" | Weather;
export type Precip = "none" | "rain" | "snow" | "sand";
export type WeatherWeights = Record<Weather, number>;

export interface WeatherNow {
  kind: Weather;
  /** 0..1, fades in and out at both ends of a spell of weather */
  strength: number;
}

export interface WeatherLook {
  sun: number;
  ambient: number;
  /** share of the sky under cloud */
  cover: number;
  /** added to the drifting cloud shadows on the ground */
  shade: number;
  /** where the haze starts and closes, as multiples of the camera distance: every zoom stays readable */
  fogNear: number;
  fogFar: number;
  /** 0..1, how far the view has moved from the normal haze to the weather's own */
  fog: number;
  tint: number;
  tintAmount: number;
  wet: number;
  snow: number;
}

/** What the atmosphere needs from the weather this frame. */
export interface WeatherFx {
  sun: number;
  ambient: number;
  shade: number;
  tint: number;
  tintAmount: number;
  /** 0..1, lightning */
  flash: number;
}

export const CLEAR_FX: WeatherFx = { sun: 1, ambient: 1, shade: 0, tint: 0xffffff, tintAmount: 0, flash: 0 };

export const LOOKS: Record<Weather, WeatherLook> = {
  cerah: { sun: 1, ambient: 1, cover: 0, shade: 0, fogNear: 9, fogFar: 9, fog: 0, tint: 0xffffff, tintAmount: 0, wet: 0, snow: 0 },
  berawan: { sun: 0.62, ambient: 0.97, cover: 0.62, shade: 0.14, fogNear: 9, fogFar: 9, fog: 0, tint: 0x9aa6b2, tintAmount: 0.35, wet: 0, snow: 0 },
  hujan: { sun: 0.36, ambient: 0.84, cover: 0.86, shade: 0.2, fogNear: 0.75, fogFar: 3.6, fog: 1, tint: 0x75818e, tintAmount: 0.62, wet: 0.85, snow: 0 },
  badai: { sun: 0.2, ambient: 0.7, cover: 1, shade: 0.28, fogNear: 0.6, fogFar: 3, fog: 1, tint: 0x46505e, tintAmount: 0.8, wet: 1, snow: 0 },
  salju: { sun: 0.5, ambient: 1.02, cover: 0.76, shade: 0.1, fogNear: 0.65, fogFar: 3.4, fog: 1, tint: 0xdce6ec, tintAmount: 0.62, wet: 0, snow: 0.8 },
  kabut: { sun: 0.45, ambient: 0.96, cover: 0.3, shade: 0.04, fogNear: 0.3, fogFar: 2.1, fog: 1, tint: 0xc9d2d6, tintAmount: 0.82, wet: 0.2, snow: 0 },
  pasir: { sun: 0.55, ambient: 0.92, cover: 0.1, shade: 0.05, fogNear: 0.4, fogFar: 2.5, fog: 1, tint: 0xd6a566, tintAmount: 0.72, wet: 0, snow: 0 },
};

export const LABELS: Record<Weather, { title: string; note: string }> = {
  cerah: { title: "☀️ Langit cerah", note: "Awan mulai menyingkir" },
  berawan: { title: "☁️ Berawan", note: "Awan menutup matahari" },
  hujan: { title: "🌧️ Hujan turun", note: "Tanah mulai basah" },
  badai: { title: "⛈️ Badai petir", note: "Langit menggelap" },
  salju: { title: "❄️ Salju turun", note: "Daratan memutih" },
  kabut: { title: "🌫️ Kabut tebal", note: "Pandangan menyempit" },
  pasir: { title: "🏜️ Badai pasir", note: "Angin dari gurun" },
};

const hash = (a: number, b: number) => {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ 0x51ed27;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function parseWeatherMode(value: string | null): WeatherMode {
  if (value === "off") return "off";
  return WEATHERS.includes(value as Weather) ? (value as Weather) : "auto";
}

/** Every map gets the same engine; only the odds follow its land. */
export function weatherWeights(biome: readonly Biome[], theme: "bright" | "dark" | "vivid"): WeatherWeights {
  let land = 0;
  let snow = 0;
  let sand = 0;
  for (const b of biome) {
    if (b === "water") continue;
    land++;
    if (b === "snow") snow++;
    if (b === "desert" || b === "mesa") sand++;
  }
  const share = (n: number) => n / Math.max(1, land);
  return {
    cerah: 4,
    berawan: 3,
    hujan: 2.5,
    badai: 1.2,
    kabut: theme === "dark" ? 2 : 1.2,
    salju: share(snow) > 0.01 ? 1.5 : 0.7,
    // the "desert" of the dark maps is a wet moor, so no sand blows there
    pasir: theme !== "dark" && share(sand) > 0.03 ? 1.6 : 0,
  };
}

/** Seconds since the round began, running on through every phase. */
export function roundClock(phase: Phase, phaseT: number, r: RoundTimes & { resultSeconds?: number }): number {
  if (phase === "LOBBY") return Math.min(phaseT, r.lobbySeconds);
  if (phase === "WAR") return r.lobbySeconds + phaseT;
  if (phase === "FINAL") return r.lobbySeconds + r.warSeconds - r.finalSeconds + phaseT;
  return r.lobbySeconds + r.warSeconds + phaseT;
}

const FADE = 12;

/** The weather at a moment of a round. The lobby and the result screen stay clear. */
export function weatherAt(roundId: number, t: number, phase: Phase, weights: WeatherWeights, lobbySeconds: number): WeatherNow {
  if (phase === "LOBBY" || phase === "RESULT") return { kind: "cerah", strength: 0 };
  const total = WEATHERS.reduce((s, w) => s + weights[w], 0);
  let start = lobbySeconds;
  let last: Weather = "cerah";
  for (let i = 0; i < 64; i++) {
    const length = 70 + hash(roundId, i * 2 + 1) * 90;
    let pick = hash(roundId, i * 2 + 2) * total;
    let kind: Weather = "cerah";
    for (const w of WEATHERS) {
      pick -= weights[w];
      if (pick <= 0 && weights[w] > 0) {
        kind = w;
        break;
      }
    }
    // no weather follows itself, and a clear spell separates two storms of different kinds
    if (kind === last) kind = "cerah";
    if (kind !== "cerah" && last !== "cerah") kind = "cerah";
    if (t < start + length) return { kind, strength: smooth(0, FADE, t - start) * smooth(0, FADE, start + length - t) };
    start += length;
    last = kind;
  }
  return { kind: "cerah", strength: 0 };
}

/** What falls at a place under this weather: the same front is snow on snowfields, nothing on sand. */
export function precipAt(kind: Weather, biome: Biome): Precip {
  const dry = biome === "desert" || biome === "mesa";
  if (kind === "hujan" || kind === "badai") return biome === "snow" ? "snow" : "rain";
  if (kind === "salju") return dry ? "none" : "snow";
  if (kind === "pasir") return "sand";
  return "none";
}

/** The look of a weather at some strength: it grows out of the clear sky. */
export function lookAt(now: WeatherNow): WeatherLook {
  const a = LOOKS.cerah;
  const b = LOOKS[now.kind];
  const s = now.strength;
  const mix = (x: number, y: number) => x + (y - x) * s;
  return {
    sun: mix(a.sun, b.sun),
    ambient: mix(a.ambient, b.ambient),
    cover: mix(a.cover, b.cover),
    shade: mix(a.shade, b.shade),
    fogNear: b.fogNear,
    fogFar: b.fogFar,
    fog: b.fog * s,
    tint: b.tint,
    tintAmount: b.tintAmount * s,
    wet: b.wet * s,
    snow: b.snow * s,
  };
}
