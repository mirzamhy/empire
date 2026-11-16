// Typed game config. Values live in config/game.config.json.
import raw from "../../../config/game.config.json";

export const UNIT_TYPES = ["spearman", "swordsman", "archer", "wizard", "paladin", "necromancer", "cavalry", "golem", "dragon", "demon", "skeleton",
  "halberdier", "shieldbearer", "berserker", "assassin", "engineer", "ballista", "elephant", "trebuchet",
] as const;
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
  /** labels other units react to: "big", "support", "siege" (flying and ranged count as tags too) */
  tags?: string[];
  /** extra damage against a tag, "unit", "castle" or "dragon": 0.6 = +60%, -0.75 = a quarter */
  bonusVs?: Record<string, number>;
  /** enemies within this range attack this unit first */
  taunt?: number;
  /** allies within coverRange take this much less ranged damage */
  cover?: number;
  coverRange?: number;
  /** extra damage at zero health (scales with missing health) */
  rage?: number;
  /** cannot be targeted until its first attack */
  stealth?: boolean;
  /** prefers targets with one of these tags */
  hunts?: string[];
  /** ranged damage avoided while moving */
  dodge?: number;
  /** damage to small ground enemies it walks through */
  trample?: number;
  /** cannot attack targets closer than this */
  minRange?: number;
  /** builds watchtowers in own villages */
  builds?: boolean;
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
  halberdier: "Halberdier",
  shieldbearer: "Shieldbearer",
  berserker: "Berserker",
  assassin: "Assassin",
  engineer: "Engineer",
  ballista: "Ballista",
  elephant: "Gajah Perang",
  trebuchet: "Trebuchet",
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
  halberdier: "🪓",
  shieldbearer: "🛡️",
  berserker: "💢",
  assassin: "🥷",
  engineer: "🔨",
  ballista: "🎯",
  elephant: "🐘",
  trebuchet: "🪨",
};

/** 24 banner colours, spread around the hue wheel so neighbours differ. */
export const BANNER_COLORS = [
  "#c0392b", "#2563eb", "#16a34a", "#9333ea", "#ea8a0c", "#0d9488", "#db2777", "#0ea5e9",
  "#eab308", "#4f46e5", "#65a30d", "#e11d48", "#7c3aed", "#f97316", "#059669", "#1d4ed8",
  "#be123c", "#ca8a04", "#0891b2", "#a21caf", "#b45309", "#15803d", "#6d28d9", "#dc2626",
];
