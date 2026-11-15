// Typed game config. Values live in config/game.config.json.
import raw from "../../../config/game.config.json";

export const UNIT_TYPES = ["spearman", "swordsman", "archer", "wizard", "paladin", "necromancer", "cavalry", "golem", "dragon", "demon", "skeleton"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
export type UnitBundle = Partial<Record<UnitType, number>>;

export interface UnitStats {
  hp: number;
  dmg: number;
  range: number;
  speed: number;
  scale: number;
  ranged?: boolean;
  splash?: number;
  heal?: number;
  healRange?: number;
  raise?: number;
  arrowResist?: number;
  flying?: boolean;
  aura?: number;
  auraRange?: number;
}

export type GameConfig = Omit<typeof raw, "unitTypes" | "kingdom" | "passive"> & {
  unitTypes: Record<UnitType, UnitStats>;
  kingdom: Omit<typeof raw.kingdom, "startUnits"> & { startUnits: UnitBundle };
  passive: Omit<typeof raw.passive, "unlocks"> & { unlocks: { level: number; units: UnitType[] }[] };
};

export function loadConfig(): GameConfig {
  return structuredClone(raw) as unknown as GameConfig;
}

export const UNIT_LABEL: Record<UnitType, string> = {
  spearman: "Spearman",
  swordsman: "Knight",
  archer: "Ranger",
  wizard: "Wizard",
  paladin: "Paladin",
  necromancer: "Necromancer",
  cavalry: "Cavalry",
  golem: "Golem",
  dragon: "Naga",
  demon: "Demon Lord",
  skeleton: "Skeleton",
};

export const UNIT_ICON: Record<UnitType, string> = {
  spearman: "🔱",
  swordsman: "🗡️",
  archer: "🏹",
  wizard: "🔥",
  paladin: "✨",
  necromancer: "💀",
  cavalry: "🐎",
  golem: "🗿",
  dragon: "🐉",
  demon: "👹",
  skeleton: "☠️",
};

/** 24 banner colours, spread around the hue wheel so neighbours differ. */
export const BANNER_COLORS = [
  "#c0392b", "#2563eb", "#16a34a", "#9333ea", "#ea8a0c", "#0d9488", "#db2777", "#0ea5e9",
  "#eab308", "#4f46e5", "#65a30d", "#e11d48", "#7c3aed", "#f97316", "#059669", "#1d4ed8",
  "#be123c", "#ca8a04", "#0891b2", "#a21caf", "#b45309", "#15803d", "#6d28d9", "#dc2626",
];
