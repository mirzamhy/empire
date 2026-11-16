// Model contract shared by the prototype adapter and future Fable-made models.
// See docs/rencana-visual.md section 3 (contract) and 4.1 (bones and sockets per rig).
import * as THREE from "three";

export type RigKind = "humanoid" | "quadruped" | "rider" | "dragon" | "golem" | "siege";

export const BONE_NAMES = [
  // humanoid / golem
  "hips", "spine", "head", "armR", "forearmR", "weapon", "armL", "forearmL", "offhand", "cape", "legR", "legL",
  // quadruped / rider mount
  "body", "neck", "jaw", "legFR", "legFL", "legBR", "legBL", "tail", "trunk1", "trunk2",
  // dragon
  "neck1", "neck2", "wingR", "wingR2", "wingL", "wingL2", "tail1", "tail2", "tail3",
  // siege
  "base", "turret", "arm", "sling", "wheelFR", "wheelFL", "wheelBR", "wheelBL",
] as const;
export type BoneName = (typeof BONE_NAMES)[number];

export const SOCKET_NAMES = [
  "weaponTip", "weaponMid", "muzzle", "offhand", "headTop", "chest", "back", "mouth", "saddle", "tusk", "core", "fistR", "fistL", "load",
] as const;
export type SocketName = (typeof SOCKET_NAMES)[number];

export interface UnitModel {
  root: THREE.Group;
  rig: RigKind;
  /** Pivot of each bone. Rotation zero = rest pose. Bones may be nested at any depth. */
  bones: Partial<Record<BoneName, THREE.Object3D>>;
  /** Marker objects; their parent chain decides which bone carries them. */
  sockets: Partial<Record<SocketName, THREE.Object3D>>;
  meta: { tris: number; height: number };
}

/** What a model file's `build()` receives. Tier 1 = castle level 1-4, 2 = 5-7, 3 = 8-10. */
export interface ModelOpts {
  tier: 1 | 2 | 3;
  /** hex of the kingdom-colour placeholder (always "#ff00ff"); tint parts use kit.tintMat() */
  tint: string;
  /** trim colour for small heraldic accents (plumes, banners) */
  crest: string;
}
export type ModelBuilder = (opts: ModelOpts) => UnitModel;

/** Bones every model of a rig must have (the rest are optional). */
export const REQUIRED_BONES: Record<RigKind, BoneName[]> = {
  humanoid: ["spine", "head", "armR", "armL", "legR", "legL"],
  golem: ["spine", "head", "armR", "armL", "legR", "legL"],
  rider: ["body", "legFR", "legFL", "legBR", "legBL", "armR"],
  quadruped: ["body", "head", "legFR", "legFL", "legBR", "legBL"],
  dragon: ["body", "head", "wingR", "wingL"],
  siege: ["base"],
};

/** Sockets every model of a rig must have. */
export const REQUIRED_SOCKETS: Record<RigKind, SocketName[]> = {
  humanoid: ["headTop", "chest"],
  golem: ["headTop", "chest"],
  rider: ["headTop", "chest"],
  quadruped: ["headTop", "chest"],
  dragon: ["headTop", "chest", "mouth"],
  siege: ["muzzle"],
};

/** Triangle budgets for LOD0 (docs/rencana-visual.md 3.2). */
export const TRI_BUDGET: Record<RigKind, number> = {
  humanoid: 1600,
  golem: 2200,
  rider: 2200,
  quadruped: 2200,
  dragon: 2600,
  siege: 1800,
};

export function countTris(root: THREE.Object3D) {
  let tris = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !o.visible) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return Math.round(tris);
}

/**
 * Check a model against the contract. Returns human-readable problems (empty = valid).
 * Used by tests/models.test.ts and by the codex lab when a Fable model is loaded.
 */
export function validateModel(m: UnitModel): string[] {
  const issues: string[] = [];
  for (const b of REQUIRED_BONES[m.rig]) if (!m.bones[b]) issues.push(`missing bone ${b}`);
  for (const s of REQUIRED_SOCKETS[m.rig]) if (!m.sockets[s]) issues.push(`missing socket ${s}`);
  const tris = countTris(m.root);
  if (tris > TRI_BUDGET[m.rig]) issues.push(`tris ${tris} > ${TRI_BUDGET[m.rig]}`);
  m.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.root);
  if (Math.abs(box.min.y) > 0.05) issues.push(`feet at y=${box.min.y.toFixed(2)} (want 0 ±0.05)`);
  let tint = false;
  let nan = false;
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshLambertMaterial;
    if (mat.userData?.tint === true || mat.color?.getHex() === 0xff00ff || mat.map) tint = true;
    const p = mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.array.length; i++)
      if (!Number.isFinite(p.array[i])) {
        nan = true;
        break;
      }
  });
  if (!tint) issues.push("no kingdom-colour (tint) part");
  if (nan) issues.push("NaN or infinite vertex");
  return issues;
}
