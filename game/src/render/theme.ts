// Look of the active map: ground and leaf colours, water, height bands, minimap colours and the
// mood of every round phase. "bright" is the first map (daylight, desert, palms); "dark" is the
// wooded continent of maps 2 and 3, a shade darker and cooler so kingdom colours stand out.
import type { Biome } from "../sim/map";
import { ACTIVE } from "../sim/maps";
import type { Phase } from "../sim/world";

export interface Mood {
  sun: number;
  sunPower: number;
  /** sun position relative to the camera focus */
  sunFrom: [number, number, number];
  skyLight: number;
  groundLight: number;
  ambient: number;
  rim: number;
  fog: number;
  skyTop: number;
  /** strength of the drifting cloud shadows */
  cloud: number;
  exposure: number;
}

export interface Theme {
  id: "bright" | "dark";
  /** two tones per biome; a 40 m noise picks between them */
  ground: Record<Biome, [number, number]>;
  rock: number;
  rockDark: number;
  wetSand: number;
  snowLine: number;
  /** trees thin out above this height (dark theme); mountains are wooded below it */
  treeLine: number;
  /** lower mountain slopes take the forest floor colour */
  woodedSlopes: boolean;
  deepSea: number;
  water: { shallow: number; mid: number; deep: number };
  leaf: Record<string, number[]>;
  minimap: Record<Biome, string>;
  moods: Record<Phase, Mood>;
}

const BRIGHT: Theme = {
  id: "bright",
  ground: {
    water: [0x4f8a86, 0x2c5a66],
    beach: [0xe0cfa0, 0xd0bd88],
    plains: [0x9fb565, 0xb7ae74],
    desert: [0xdba556, 0xc98a3c],
    forest: [0x55833a, 0x3e6b2f],
    mountain: [0x8d7e6c, 0x74675a],
  },
  rock: 0x80776b,
  rockDark: 0x5a524b,
  wetSand: 0xb39f76,
  snowLine: 25,
  treeLine: 19,
  woodedSlopes: false,
  deepSea: 0x163d4d,
  water: { shallow: 0x63c7cb, mid: 0x2f7f93, deep: 0x1a4a5e },
  leaf: {
    oakRound: [0x3f8a2a, 0x4c9a30, 0x357a2a],
    oakTall: [0x2f7a34, 0x3d8a3a],
    oakWide: [0x5a9a2e, 0x6aa838, 0x8aa83a],
    pine: [0x1f6b3a, 0x245f3a],
    pineTall: [0x1a5a38, 0x1f6b4a],
    pineSnow: [0x2a6a4a],
    birch: [0x9ab83a, 0xb8c040, 0xd0b03a],
    bush: [0x4a8a30, 0x5a7a2a, 0x3a7a3a],
    palm: [0x4d8c1f, 0x5a9a2a],
    grass: [0x8fb04a, 0xa8b85a, 0x7aa040],
    flower: [0xf5d040, 0xc070e0, 0xf5f0e0, 0xf08a5a],
    reed: [0x8fa04a, 0xa8a85a],
    fern: [0x4f9a3a, 0x5fa844],
    log: [0x5a7a3a],
  },
  minimap: { water: "#1f4e5c", beach: "#cdb98a", plains: "#a9a06c", desert: "#c98b42", forest: "#4f7a34", mountain: "#6e6152" },
  //   LOBBY = morning, low sun from the east · WAR = clear midday · FINAL = low orange sun · RESULT = dusk
  moods: {
    LOBBY: { sun: 0xffe2b0, sunPower: 1.25, sunFrom: [190, 150, 70], skyLight: 0xffeed8, groundLight: 0x4a5540, ambient: 0.9, rim: 0.3, fog: 0x9fbfc4, skyTop: 0x4f8fb5, cloud: 0.2, exposure: 1.0 },
    WAR: { sun: 0xfff1d6, sunPower: 1.4, sunFrom: [110, 220, 95], skyLight: 0xfff4dc, groundLight: 0x3a4a3f, ambient: 0.95, rim: 0.3, fog: 0x6fa6ba, skyTop: 0x2f6fa5, cloud: 0.22, exposure: 1.0 },
    FINAL: { sun: 0xff9b5a, sunPower: 1.45, sunFrom: [-200, 120, 60], skyLight: 0xffc9a0, groundLight: 0x3b2f45, ambient: 0.8, rim: 0.4, fog: 0xc58a6e, skyTop: 0x5a4a8f, cloud: 0.3, exposure: 1.05 },
    RESULT: { sun: 0xc58cff, sunPower: 0.85, sunFrom: [-90, 150, -130], skyLight: 0x8f8fd0, groundLight: 0x1f1a33, ambient: 0.75, rim: 0.5, fog: 0x2f2850, skyTop: 0x14102e, cloud: 0.1, exposure: 1.0 },
  },
};

const DARK: Theme = {
  id: "dark",
  ground: {
    water: [0x35676a, 0x1c3f4d],
    beach: [0xb3a587, 0x9c8f73], // grey shingle
    plains: [0x5f7f3e, 0x717c46], // forest meadows
    desert: [0x87764a, 0x74603a], // dry moor (the "desert" biome of these maps)
    forest: [0x34602c, 0x254a26],
    mountain: [0x6c655b, 0x585149],
  },
  rock: 0x716a61,
  rockDark: 0x4c4640,
  wetSand: 0x857a62,
  // peaks reach 40 to 50 m, so only the crests carry snow
  snowLine: 36,
  treeLine: 24,
  woodedSlopes: true,
  deepSea: 0x0e2a37,
  water: { shallow: 0x4a9fa3, mid: 0x1f5b6e, deep: 0x103444 },
  leaf: {
    oakRound: [0x2f6a24, 0x3a7628, 0x2a5e24],
    oakTall: [0x265e2a, 0x30692e],
    oakWide: [0x44762a, 0x527f30, 0x6a8034],
    pine: [0x17502e, 0x1b4a30, 0x143f2a, 0x1f5636, 0x20482a],
    pineTall: [0x13442c, 0x184f36, 0x103a28, 0x164a3c, 0x1c4426],
    pineSnow: [0x21553c],
    birch: [0x7f9a34, 0x969f3a, 0xa88f36],
    bush: [0x3a6c2a, 0x466226, 0x2e5e2e],
    palm: [0x4d8c1f, 0x5a9a2a],
    grass: [0x6f8c40, 0x82904a, 0x5f7f38],
    flower: [0xf5d040, 0xc070e0, 0xf5f0e0, 0xf08a5a],
    reed: [0x7d8c44, 0x91904c, 0x6c7a3a],
    fern: [0x3f7a30, 0x4c8636, 0x356a2e],
    log: [0x4a6a34, 0x55703a],
  },
  minimap: { water: "#143845", beach: "#a89a7c", plains: "#768c4a", desert: "#86744a", forest: "#2f5a2a", mountain: "#7a7268" },
  //   LOBBY = misty dawn · WAR = overcast noon · FINAL = low red sun, long shadows · RESULT = dusk
  moods: {
    LOBBY: { sun: 0xffd6a0, sunPower: 1.1, sunFrom: [190, 130, 70], skyLight: 0xd9e2d2, groundLight: 0x2c3a30, ambient: 0.68, rim: 0.3, fog: 0x6f8c88, skyTop: 0x35596c, cloud: 0.3, exposure: 0.96 },
    WAR: { sun: 0xf4ead6, sunPower: 1.25, sunFrom: [120, 200, 95], skyLight: 0xcddacd, groundLight: 0x26342c, ambient: 0.7, rim: 0.32, fog: 0x4a6a6e, skyTop: 0x27485c, cloud: 0.38, exposure: 0.96 },
    FINAL: { sun: 0xff8648, sunPower: 1.35, sunFrom: [-200, 110, 60], skyLight: 0xdfa684, groundLight: 0x2c2236, ambient: 0.58, rim: 0.4, fog: 0x86564a, skyTop: 0x372c5e, cloud: 0.36, exposure: 1.0 },
    RESULT: { sun: 0xb58cf0, sunPower: 0.8, sunFrom: [-90, 150, -130], skyLight: 0x8080c0, groundLight: 0x18142a, ambient: 0.62, rim: 0.5, fog: 0x231f3e, skyTop: 0x0f0c24, cloud: 0.1, exposure: 0.98 },
  },
};

export const THEME: Theme = ACTIVE.theme === "bright" ? BRIGHT : DARK;
