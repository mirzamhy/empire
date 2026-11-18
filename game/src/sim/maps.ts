// The playable maps. One is active per page load or process:
//   browser  ?map=1|2|3|4
//   node     EMPIRE_MAP=1|2|3|4, or globalThis.EMPIRE_MAP set before the sim modules are imported
// The newest map is the default.
//
//   1  Benua Klasik   576 x 432 m, traced from the reference picture: bright, with a desert
//   2  Hutan Gelap    864 x 648 m, dark wooded continent with five ranges and foothills (D-030)
//   3  Hutan Sungai   map 2 plus rivers that troops wade through, landmarks and living air (D-031)
//   4  Tiga Alam      traced from a second picture: snow in the north, green heartland, red desert
import { MAP_H as H1, MAP_ROWS as ROWS1, MAP_W as W1 } from "./mapdata1";
import { MAP_H as H2, MAP_ROWS as ROWS2, MAP_W as W2 } from "./mapdata";
import { MAP_H as H4, MAP_ROWS as ROWS4, MAP_W as W4 } from "./mapdata4";

/** A point in normalised map coordinates: x -1 west .. 1 east, y -1 north .. 1 south. */
export type NPoint = [number, number];

export interface RiverDef {
  name: string;
  /** source: "l" snaps to the nearest land cell, "w" to the nearest water cell (a lake outflow) */
  from: [number, number, "l" | "w"];
  /** mouth: a point in the lake or the sea this stretch flows into */
  to: NPoint;
  /** points the river is routed through, in order */
  via?: NPoint[];
  /** channel width in metres at the top and at the bottom of this stretch */
  width: [number, number];
}

export type LandmarkKind = "dragonBones" | "watchtower" | "ruins" | "greatTree" | "stoneCircle" | "lighthouse" | "sandArch" | "iceSpire";

export interface LandmarkDef {
  kind: LandmarkKind;
  name: string;
  at: NPoint;
  /** footprint radius in metres: kept clear of castles and trees, and levelled */
  r: number;
  /** where it may stand: open lowland, the foot of a range, or the shore */
  on: "low" | "foot" | "shore";
}

export interface MapDef {
  id: number;
  name: string;
  w: number;
  h: number;
  rows: readonly string[];
  /** height model: "classic" = abrupt ranges of the first map, "wild" = foothills and scaled peaks, "alpine" = wild with narrow, sharp ranges */
  terrain: "classic" | "wild" | "alpine";
  /** colours, vegetation and moods: bright daylight, the dark forest, or the saturated three realms */
  theme: "bright" | "dark" | "vivid";
  rivers: RiverDef[];
  landmarks: LandmarkDef[];
  /** valley mist, birds and drifting particles */
  life: boolean;
  /** keeps some clouds over the high ground even in clear weather */
  clouds: boolean;
  /** layered, shaded trees with forest undergrowth instead of the plain ones */
  detailedTrees: boolean;
}

const RIVERS: RiverDef[] = [
  // Sungai Embun: the main river, north range -> north lake -> past the altar -> south lake -> sea
  { name: "Sungai Embun", from: [-0.25, -0.45, "l"], to: [-0.12, -0.3], width: [3.5, 5] },
  { name: "Sungai Embun", from: [-0.12, -0.3, "w"], to: [0.02, 0.36], via: [[-0.13, 0.02]], width: [5.5, 7.5] },
  { name: "Sungai Embun", from: [0.02, 0.36, "w"], to: [-0.35, 0.98], width: [7.5, 9.5] },
  // Sungai Barat: falls from the western range into the west lake, then round the range to the sound
  { name: "Sungai Barat", from: [-0.5, 0.3, "l"], to: [-0.36, 0.14], width: [3, 4.5] },
  { name: "Sungai Barat", from: [-0.36, 0.14, "w"], to: [-0.96, -0.02], width: [5, 8] },
  // Sungai Timur: off the Dragon's Spine into the east lake, then out to the eastern bight
  { name: "Sungai Timur", from: [0.17, 0.02, "l"], to: [0.3, -0.1], width: [3, 4.5] },
  { name: "Sungai Timur", from: [0.3, -0.1, "w"], to: [1.0, 0.16], width: [5, 8] },
  // a short northern stream
  { name: "Kali Utara", from: [0.1, -0.57, "l"], to: [0.34, -0.98], width: [3, 6] },
];

const LANDMARKS: LandmarkDef[] = [
  { kind: "dragonBones", name: "Kerangka Naga", at: [0.25, 0.0], r: 17, on: "foot" },
  { kind: "greatTree", name: "Pohon Purba", at: [-0.5, -0.15], r: 9, on: "low" },
  { kind: "watchtower", name: "Menara Celah Barat", at: [-0.2, -0.45], r: 5, on: "foot" },
  { kind: "watchtower", name: "Menara Celah Timur", at: [0.18, -0.39], r: 5, on: "foot" },
  { kind: "ruins", name: "Reruntuhan Kastil Kuno", at: [-0.12, -0.22], r: 16, on: "low" },
  { kind: "stoneCircle", name: "Lingkaran Batu", at: [0.55, -0.2], r: 11, on: "low" },
  { kind: "lighthouse", name: "Mercusuar Tanjung", at: [0.88, 0.3], r: 5, on: "shore" },
];

const RIVERS_4: RiverDef[] = [
  // Sungai Induk: northern range -> long lake -> central lake -> the great south bay
  { name: "Sungai Induk", from: [0.02, -0.4, "l"], to: [-0.04, -0.14], width: [3.5, 5] },
  { name: "Sungai Induk", from: [-0.04, -0.14, "w"], to: [0.17, 0.2], via: [[0.07, 0.03]], width: [5, 7] },
  { name: "Sungai Induk", from: [0.17, 0.2, "w"], to: [-0.12, 0.72], via: [[0.03, 0.46]], width: [7, 9.5] },
  // Sungai Barat: off the north-western range, across the forest to the west bay
  { name: "Sungai Barat", from: [-0.3, -0.34, "l"], to: [-0.62, -0.04], via: [[-0.42, -0.14]], width: [3, 7] },
  // Sungai Rawa: through the meadows into the south-western lake, then out to sea
  { name: "Sungai Rawa", from: [-0.28, 0.0, "l"], to: [-0.45, 0.37], width: [3, 5] },
  { name: "Sungai Rawa", from: [-0.45, 0.37, "w"], to: [-0.66, 0.56], width: [5, 7] },
  // Sungai Timur: the eastern ranges feed the crater lake, which drains south
  { name: "Sungai Timur", from: [0.3, -0.08, "l"], to: [0.51, 0.25], via: [[0.42, 0.1]], width: [3, 5.5] },
  { name: "Sungai Timur", from: [0.62, 0.37, "w"], to: [0.56, 0.9], via: [[0.6, 0.62]], width: [5, 8] },
  // Wadi Oasis: a thin stream across the desert into the oasis lake, which spills to the east coast
  { name: "Wadi Oasis", from: [0.68, -0.68, "l"], to: [0.52, -0.3], via: [[0.6, -0.48]], width: [2.5, 4] },
  { name: "Wadi Oasis", from: [0.52, -0.3, "w"], to: [0.93, -0.12], width: [4, 6] },
  // Kali Salju: meltwater from the northern snowfields
  { name: "Kali Salju", from: [-0.28, -0.66, "l"], to: [-0.42, -0.97], width: [2.5, 5] },
];

const LANDMARKS_4: LandmarkDef[] = [
  { kind: "iceSpire", name: "Mahkota Es", at: [0.16, -0.68], r: 9, on: "foot" },
  { kind: "watchtower", name: "Menara Salju", at: [-0.36, -0.58], r: 5, on: "foot" },
  { kind: "sandArch", name: "Gerbang Batu Merah", at: [0.62, -0.6], r: 12, on: "low" },
  { kind: "dragonBones", name: "Kerangka Naga Gurun", at: [0.8, -0.38], r: 17, on: "low" },
  { kind: "greatTree", name: "Pohon Purba", at: [-0.55, -0.34], r: 9, on: "low" },
  { kind: "stoneCircle", name: "Lingkaran Batu", at: [-0.3, 0.12], r: 11, on: "low" },
  { kind: "ruins", name: "Reruntuhan Kota Tengah", at: [0.0, 0.1], r: 16, on: "low" },
  { kind: "watchtower", name: "Menara Celah Timur", at: [0.28, 0.0], r: 5, on: "foot" },
  { kind: "lighthouse", name: "Mercusuar Tanjung Selatan", at: [-0.2, 0.86], r: 5, on: "shore" },
  { kind: "lighthouse", name: "Mercusuar Teluk Timur", at: [0.76, 0.1], r: 5, on: "shore" },
];

export const MAPS: Record<number, MapDef> = {
  1: { id: 1, name: "Benua Klasik", w: W1, h: H1, rows: ROWS1, terrain: "classic", theme: "bright", rivers: [], landmarks: [], life: false, clouds: false, detailedTrees: false },
  2: { id: 2, name: "Hutan Gelap", w: W2, h: H2, rows: ROWS2, terrain: "wild", theme: "dark", rivers: [], landmarks: [], life: false, clouds: false, detailedTrees: false },
  3: { id: 3, name: "Hutan Sungai", w: W2, h: H2, rows: ROWS2, terrain: "wild", theme: "dark", rivers: RIVERS, landmarks: LANDMARKS, life: true, clouds: false, detailedTrees: true },
  4: { id: 4, name: "Tiga Alam", w: W4, h: H4, rows: ROWS4, terrain: "alpine", theme: "vivid", rivers: RIVERS_4, landmarks: LANDMARKS_4, life: true, clouds: true, detailedTrees: true },
};
export const DEFAULT_MAP = 4;

function pickMapId(): number {
  const g = globalThis as { EMPIRE_MAP?: unknown; location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  const fromUrl = g.location?.search ? new URLSearchParams(g.location.search).get("map") : null;
  const id = Number(g.EMPIRE_MAP ?? fromUrl ?? g.process?.env?.EMPIRE_MAP);
  return MAPS[id] ? id : DEFAULT_MAP;
}

export const MAP_ID = pickMapId();
export const ACTIVE: MapDef = MAPS[MAP_ID];
