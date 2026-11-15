// Turn the prototype's per-unit THREE.Group into instanceable parts:
// one body geometry plus one geometry per limb, each limb with its pivot matrix.
// Poses mirror the prototype's applyCharacterPose so movement looks the same.
import * as THREE from "three";
import type { UnitType } from "../../sim/config";
import { bakeGroup, TINT_MARKER } from "../bake";
import { buildReferenceSoldier } from "./proto.js";

export const LIMBS = ["rightArm", "leftArm", "rightLeg", "leftLeg", "backRightLeg", "backLeftLeg"] as const;
export type LimbName = (typeof LIMBS)[number];

export interface BakedPart {
  name: "body" | LimbName;
  geometry: THREE.BufferGeometry;
  /** limb pivot relative to the unit root (identity for body) */
  pivot: THREE.Matrix4;
}

export interface BakedUnit {
  type: UnitType;
  rig: "humanoid" | "cavalry" | "dragon" | "golem";
  parts: BakedPart[];
  tris: number;
}

const MODEL_OF: Record<UnitType, string> = {
  spearman: "spearman",
  swordsman: "swordsman",
  archer: "archer",
  wizard: "wizard",
  paladin: "paladin",
  necromancer: "necromancer",
  cavalry: "cavalry",
  golem: "golem",
  dragon: "dragon",
  demon: "demon",
  skeleton: "necromancer",
};

const TINT = "#" + TINT_MARKER.toString(16).padStart(6, "0");

export function bakeUnit(type: UnitType): BakedUnit {
  const root = buildReferenceSoldier(MODEL_OF[type], TINT, "#e8e2d0");
  const data = root.userData as { limbs?: Record<string, THREE.Object3D>; weaponGroup?: THREE.Object3D; unitType: string };
  const rig = data.unitType === "cavalry" ? "cavalry" : data.unitType === "dragon" ? "dragon" : data.unitType === "golem" ? "golem" : "humanoid";
  // rest pose: limbs at zero, weapon carried the way the prototype's walk pose holds it
  if (data.weaponGroup && data.unitType !== "archer" && rig === "humanoid") data.weaponGroup.rotation.x = 0.72;
  root.updateMatrixWorld(true);
  const parts: BakedPart[] = [];
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const limbs = data.limbs ?? {};
  for (const name of LIMBS) {
    const limb = limbs[name];
    if (!limb) continue;
    limb.rotation.set(0, 0, 0);
    limb.updateMatrixWorld(true);
    const pivot = new THREE.Matrix4().multiplyMatrices(inv, limb.matrixWorld);
    parts.push({ name, geometry: bakeGroup(limb, limb), pivot });
  }
  for (const name of LIMBS) if (limbs[name]) limbs[name].visible = false;
  parts.unshift({ name: "body", geometry: bakeGroup(root, root), pivot: new THREE.Matrix4() });
  for (const name of LIMBS) if (limbs[name]) limbs[name].visible = true;
  const tris = parts.reduce((a, p) => a + p.geometry.getAttribute("position").count / 3, 0);
  return { type, rig, parts, tris };
}

export interface PoseInput {
  t: number;
  moving: boolean;
  /** 0..1 progress of the current attack swing, or -1 */
  attack: number;
}

/** Limb rotation (Euler XYZ) for the current pose. Returns null when the limb stays at rest. */
export function limbRotation(rig: BakedUnit["rig"], limb: LimbName, p: PoseInput, out: THREE.Euler): THREE.Euler | null {
  if (rig === "dragon") {
    const flap = Math.sin(p.t * 6.5) * 0.48;
    if (limb === "rightArm") return out.set(0, 0, -flap);
    if (limb === "leftArm") return out.set(0, 0, flap);
    return null;
  }
  if (rig === "cavalry") {
    const g = p.moving ? Math.sin(p.t * 7) * 0.45 : 0;
    if (limb === "rightLeg") return out.set(g, 0, 0);
    if (limb === "leftLeg") return out.set(-g * 0.7, 0, 0);
    if (limb === "backRightLeg") return out.set(-g, 0, 0);
    if (limb === "backLeftLeg") return out.set(g * 0.7, 0, 0);
    if (limb === "rightArm") return out.set(p.attack >= 0 ? -1.4 + p.attack * 1.6 : -0.35, 0, 0);
    return null;
  }
  if (p.moving) {
    const swing = Math.sin(p.t * 5.5) * 0.48;
    if (limb === "rightLeg") return out.set(swing, 0, 0);
    if (limb === "leftLeg") return out.set(-swing, 0, 0);
    if (limb === "leftArm") return out.set(-0.32 + swing * 0.28, 0, 0);
    if (limb === "rightArm") return out.set(p.attack >= 0 ? -1.7 + p.attack * 1.9 : -0.52 + Math.sin(p.t * 5.5) * 0.42, 0, 0);
    return null;
  }
  // guard / fighting stance
  if (limb === "rightArm") return p.attack >= 0 ? out.set(-1.7 + p.attack * 1.9, 0, -0.22) : out.set(-0.32, 0, -0.22);
  if (limb === "leftArm") return out.set(-0.35, 0.25, 0.18);
  if (limb === "rightLeg") return out.set(0, 0, -0.04);
  if (limb === "leftLeg") return out.set(0, 0, 0.04);
  return null;
}
