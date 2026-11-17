// The two model sets. v2 is the current one (models/); v1 is the frozen archive from before the
// detail pass (models-v1/). The game uses v2 unless it is opened with ?models=v1.
import type { UnitType } from "../../sim/config";
import type { ModelBuilder } from "./contract";
import { MODELS as V2 } from "./models/index";
import { MODELS as V1 } from "./models-v1/index";

export type ModelSet = "v1" | "v2";
export const MODEL_SETS: Record<ModelSet, Partial<Record<UnitType, ModelBuilder>>> = { v1: V1, v2: V2 };

let active: ModelSet = "v2";
export const modelSet = () => active;
export function useModelSet(set: ModelSet) {
  active = set;
}
export const activeModels = () => MODEL_SETS[active];
