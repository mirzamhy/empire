// Registry of finished (Fable-made) unit models. A unit type that is listed here is drawn from its
// model file; every other type still comes from the prototype in proto.js.
//
// To plug in a new model (docs/fable/README.md step 4):
//   1. save the file as models/<unit>.ts exporting `build(opts)`
//   2. import it below and add it to MODELS
//
//   import { build as buildDragon } from "./dragon";
//   export const MODELS = { dragon: buildDragon };
import type { UnitType } from "../../../sim/config";
import type { ModelBuilder } from "../contract";
import { build as archer } from "./archer";
import { build as cavalry } from "./cavalry";
import { build as demon } from "./demon";
import { build as dragon } from "./dragon";
import { build as golem } from "./golem";
import { build as necromancer } from "./necromancer";
import { build as paladin } from "./paladin";
import { build as skeleton } from "./skeleton";
import { build as spearman } from "./spearman";
import { build as swordsman } from "./swordsman";
import { build as wizard } from "./wizard";

export const MODELS: Partial<Record<UnitType, ModelBuilder>> = { archer, cavalry, demon, dragon, golem, necromancer, paladin, skeleton, spearman, swordsman, wizard };
