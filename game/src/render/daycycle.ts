// Time of day: morning, noon, afternoon and night follow each other during a round. The clock is
// read from the round timer, so it stops when the game is paused and every round starts in the
// morning. Lobby plus war last one and a half days and end on the afternoon, which runs straight
// into the red sun of the final phase. Purely visual: nothing here is read by the sim.
// `?time=pagi|siang|sore|malam` freezes one time, `?time=off` brings back the moods per phase.
import type { Phase } from "../sim/world";

export const TIMES = ["pagi", "siang", "sore", "malam"] as const;
export type TimeOfDay = (typeof TIMES)[number];
export type TimeMode = "auto" | "off" | TimeOfDay;

export interface RoundTimes {
  lobbySeconds: number;
  warSeconds: number;
  finalSeconds: number;
}

export interface DayBlend {
  from: TimeOfDay;
  to: TimeOfDay;
  /** 0 = fully `from`, 1 = fully `to` */
  k: number;
}

export interface PoolLight {
  x: number;
  z: number;
  /** metres */
  r: number;
  /** 0..1 */
  power: number;
}

export const DAYS_PER_ROUND = 1.5;
/** share of each quarter of the day that stays on its time before blending to the next */
const HOLD = 0.55;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function parseTimeMode(value: string | null): TimeMode {
  if (value === "off") return "off";
  return TIMES.includes(value as TimeOfDay) ? (value as TimeOfDay) : "auto";
}

/** Position in the day (0..1, 0 = morning), or null in the final and result phases. */
export function dayClock(phase: Phase, phaseT: number, round: RoundTimes): number | null {
  if (phase === "FINAL" || phase === "RESULT") return null;
  const length = round.lobbySeconds + round.warSeconds - round.finalSeconds;
  const t = phase === "LOBBY" ? Math.min(phaseT, round.lobbySeconds) : round.lobbySeconds + phaseT;
  return ((t / length) * DAYS_PER_ROUND) % 1;
}

export function dayBlend(clock: number): DayBlend {
  const s = clock * TIMES.length;
  const i = Math.floor(s) % TIMES.length;
  return { from: TIMES[i], to: TIMES[(i + 1) % TIMES.length], k: smooth(HOLD, 1, s - Math.floor(s)) };
}

/** Sun and moon swap places below the horizon: true for the two blends that touch the night. */
export const swapsLight = (b: DayBlend) => b.from === "malam" || b.to === "malam";

/** Light strength during a swap: gone around the middle, so the shadows never swing across the map. */
export const swapPower = (k: number) => smooth(0.08, 0.35, Math.abs(k - 0.5));

/** Moments of the day (0..1) when the light is out and the sun and moon change places. */
const DAWN_SWAP = (3 + (HOLD + 1) / 2) / TIMES.length;
const DUSK_SWAP = (2 + (HOLD + 1) / 2) / TIMES.length;

/**
 * Where the light comes from, relative to the view: the sun climbs from the east, stands high at
 * noon and sinks in the west, a little to the south so the faces the camera sees are lit. The moon
 * takes a lower arc behind the map at night. It never drops so low that shadows cross the map.
 */
export function sunArc(clock: number): [number, number, number] {
  const sinceDawn = (clock - DAWN_SWAP + 1) % 1;
  const dayLength = (DUSK_SWAP - DAWN_SWAP + 1) % 1;
  if (sinceDawn < dayLength) {
    const a = Math.PI * (sinceDawn / dayLength);
    return [Math.cos(a) * 215, Math.max(75, Math.sin(a) * 230), 85];
  }
  const a = Math.PI * ((sinceDawn - dayLength) / (1 - dayLength));
  return [Math.cos(a) * 150, Math.max(120, Math.sin(a) * 195), -90];
}

/** 0 by day, 1 at full night. */
export function nightOf(b: DayBlend): number {
  if (b.from === "malam") return 1 - b.k;
  return b.to === "malam" ? b.k : 0;
}

/** Paint soft pools of light into a one-channel map laid over the world (origin at its centre). */
export function paintLightPool(data: Uint8Array, w: number, h: number, tile: number, lights: PoolLight[]) {
  data.fill(0);
  for (const l of lights) {
    const cx = l.x / tile + w / 2;
    const cz = l.z / tile + h / 2;
    const r = l.r / tile;
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const z1 = Math.min(h - 1, Math.ceil(cz + r));
    for (let z = Math.max(0, Math.floor(cz - r)); z <= z1; z++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= x1; x++) {
        const d = ((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2) / (r * r);
        if (d >= 1) continue;
        const v = (1 - d) * (1 - d) * l.power * 255;
        const i = z * w + x;
        if (v > data[i]) data[i] = v;
      }
    }
  }
}
