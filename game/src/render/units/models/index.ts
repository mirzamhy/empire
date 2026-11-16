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

export const MODELS: Partial<Record<UnitType, ModelBuilder>> = {};
