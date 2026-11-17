// Turn a unit model (prototype adapter or a Fable model that follows contract.ts) into
// instanceable parts: one baked geometry per bone, each with its rest transform relative to
// its parent bone. The renderer chains bone matrices per unit every frame.
import * as THREE from "three";
import type { UnitType } from "../../sim/config";
import { bakeGroup, TINT_MARKER } from "../bake";
import { countTris, type BoneName, type RigKind, type SocketName, type UnitModel } from "./contract";
import { activeModels } from "./sets";
import { buildReferenceSoldier } from "./proto.js";

export interface BakedBone {
  name: BoneName | "root";
  /** index of the parent bone, -1 for the root */
  parent: number;
  /** transform from the parent bone's frame at rest */
  rest: THREE.Matrix4;
  /** geometry carried by this bone only (child bones excluded); null when empty */
  geometry: THREE.BufferGeometry | null;
}

export interface BakedRig {
  type: UnitType;
  rig: RigKind;
  /** parents always come before their children */
  bones: BakedBone[];
  boneIndex: Partial<Record<BoneName, number>>;
  sockets: Partial<Record<SocketName, { bone: number; pos: THREE.Vector3 }>>;
  tris: number;
  height: number;
}

// ---------------------------------------------------------------- prototype adapter

const MODEL_OF: Partial<Record<UnitType, string>> = {
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

const RIG_OF: Record<string, RigKind> = { cavalry: "rider", dragon: "dragon", golem: "golem" };

/** Vertices of obj's meshes in `frame` space, skipping the subtrees in `skip`. */
function pointsIn(obj: THREE.Object3D, frame: THREE.Object3D, skip: Set<THREE.Object3D>) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const out: THREE.Vector3[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o !== obj && skip.has(o)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const p = mesh.geometry.getAttribute("position");
      m.multiplyMatrices(inv, mesh.matrixWorld);
      for (let i = 0; i < p.count; i++) out.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone());
    }
    o.children.forEach(visit);
  };
  visit(obj);
  return out;
}

function addSocket(model: UnitModel, name: SocketName, parent: THREE.Object3D, pos: THREE.Vector3) {
  const s = new THREE.Object3D();
  s.name = `socket:${name}`;
  s.position.copy(pos);
  parent.add(s);
  model.sockets[name] = s;
}

/**
 * Wrap a prototype character (proto.js) in the model contract. Bone names follow the plan:
 * torso = spine, limbs = arms and legs, horse legs = legFR/legFL/legBR/legBL, dragon arms = wings.
 */
export function prototypeModel(type: UnitType, tint: string, crest: string): UnitModel {
  const root = buildReferenceSoldier(MODEL_OF[type] ?? "spearman", tint, crest);
  const d = root.userData as {
    unitType: string;
    limbs?: Record<string, THREE.Object3D>;
    torsoGroup?: THREE.Object3D;
    headGroup?: THREE.Object3D;
    weaponGroup?: THREE.Object3D;
    shieldGroup?: THREE.Object3D;
    magmaCore?: THREE.Object3D;
  };
  const rig: RigKind = RIG_OF[d.unitType] ?? "humanoid";
  const L = d.limbs ?? {};
  for (const limb of Object.values(L)) limb.rotation.set(0, 0, 0);
  // rest pose: weapon carried the way the prototype's walk pose holds it
  if (d.weaponGroup && d.unitType !== "archer" && (rig === "humanoid" || rig === "golem")) d.weaponGroup.rotation.x = 0.72;

  const bones: UnitModel["bones"] = {};
  if (rig === "rider") {
    Object.assign(bones, { body: d.torsoGroup, head: d.headGroup, legFR: L.rightLeg, legFL: L.leftLeg, legBR: L.backRightLeg, legBL: L.backLeftLeg, armR: L.rightArm, armL: L.leftArm, weapon: d.weaponGroup });
  } else if (rig === "dragon") {
    Object.assign(bones, { body: d.torsoGroup, head: d.headGroup, wingR: L.rightArm, wingL: L.leftArm, legR: L.rightLeg, legL: L.leftLeg });
  } else {
    Object.assign(bones, { spine: d.torsoGroup, head: d.headGroup, armR: L.rightArm, armL: L.leftArm, legR: L.rightLeg, legL: L.leftLeg, weapon: d.weaponGroup, offhand: d.shieldGroup });
  }
  for (const k of Object.keys(bones) as BoneName[]) if (!bones[k]) delete bones[k];

  const model: UnitModel = { root, rig, bones, sockets: {}, meta: { tris: countTris(root), height: 0 } };
  root.updateMatrixWorld(true);
  const boneSet = new Set(Object.values(bones) as THREE.Object3D[]);
  const box = new THREE.Box3();

  // headTop: centre top of the head
  if (bones.head) {
    const pts = pointsIn(bones.head, bones.head, boneSet);
    box.setFromPoints(pts);
    addSocket(model, "headTop", bones.head, new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2));
    // dragon mouth: the front-most point of the head
    if (rig === "dragon") {
      const front = pts.reduce((a, p) => (p.z > a.z ? p : a), pts[0]);
      addSocket(model, "mouth", bones.head, new THREE.Vector3(0, front.y, front.z));
    }
  }
  // chest: centre of the torso or body
  const trunk = bones.spine ?? bones.body;
  if (trunk) {
    box.setFromPoints(pointsIn(trunk, trunk, boneSet));
    addSocket(model, "chest", trunk, box.getCenter(new THREE.Vector3()));
  }
  // weapon tip: the weapon vertex furthest from the grip; bows shoot from their middle
  if (bones.weapon) {
    const pts = pointsIn(bones.weapon, bones.weapon, boneSet);
    const tip = pts.reduce((a, p) => (p.lengthSq() > a.lengthSq() ? p : a), pts[0]);
    addSocket(model, "weaponTip", bones.weapon, tip);
    addSocket(model, "weaponMid", bones.weapon, tip.clone().multiplyScalar(0.5));
    if (d.unitType === "archer") addSocket(model, "muzzle", bones.weapon, box.setFromPoints(pts).getCenter(new THREE.Vector3()));
    else if (type === "wizard" || type === "necromancer") addSocket(model, "muzzle", bones.weapon, tip);
  }
  if (bones.offhand) addSocket(model, "offhand", bones.offhand, new THREE.Vector3());
  if (d.magmaCore) addSocket(model, "core", d.magmaCore, new THREE.Vector3());

  model.meta.height = new THREE.Box3().setFromObject(root).max.y;
  return model;
}

// ---------------------------------------------------------------- baking

/** Bake any contract model into per-bone geometry and rest matrices. */
export function bakeModel(type: UnitType, model: UnitModel): BakedRig {
  const { root } = model;
  root.updateMatrixWorld(true);
  const nameOf = new Map<THREE.Object3D, BoneName>();
  for (const [name, obj] of Object.entries(model.bones) as [BoneName, THREE.Object3D][]) nameOf.set(obj, name);

  // bones in pre-order so parents come first
  const order: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (nameOf.has(o)) order.push(o);
  });
  const index = new Map<THREE.Object3D, number>();
  index.set(root, 0);
  const bones: BakedBone[] = [{ name: "root", parent: -1, rest: new THREE.Matrix4(), geometry: null }];
  const parentBoneOf = (o: THREE.Object3D) => {
    let p = o.parent;
    while (p && !index.has(p)) p = p.parent;
    return p ? index.get(p)! : 0;
  };
  for (const o of order) {
    const parent = parentBoneOf(o);
    const parentObj = parent === 0 ? root : order[parent - 1];
    const rest = new THREE.Matrix4().copy(parentObj.matrixWorld).invert().multiply(o.matrixWorld);
    index.set(o, bones.length);
    bones.push({ name: nameOf.get(o)!, parent, rest, geometry: null });
  }

  // geometry per bone: hide every other bone while baking one
  const all = [root, ...order];
  const vis = all.map((o) => o.visible);
  all.forEach((obj, i) => {
    for (const o of order) o.visible = o === obj;
    if (obj === root) for (const o of order) o.visible = false;
    obj.visible = true;
    const geo = bakeGroup(obj, obj);
    const n = geo.getAttribute("position").count;
    bones[i].geometry = n ? geo : null;
  });
  all.forEach((o, i) => (o.visible = vis[i]));

  const outSockets: BakedRig["sockets"] = {};
  for (const [name, s] of Object.entries(model.sockets) as [SocketName, THREE.Object3D][]) {
    const b = parentBoneOf(s);
    const frame = b === 0 ? root : order[b - 1];
    const pos = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(frame.matrixWorld).invert().multiply(s.matrixWorld));
    outSockets[name] = { bone: b, pos };
  }

  const boneIndex: BakedRig["boneIndex"] = {};
  bones.forEach((b, i) => {
    if (b.name !== "root") boneIndex[b.name] = i;
  });
  const tris = bones.reduce((a, b) => a + (b.geometry ? b.geometry.getAttribute("position").count / 3 : 0), 0);
  return { type, rig: model.rig, bones, boneIndex, sockets: outSockets, tris, height: model.meta.height };
}

const TINT = "#" + TINT_MARKER.toString(16).padStart(6, "0");

const CREST = "#e8e2d0";

/** The model for a type: a registered Fable model when there is one, else the prototype. */
export function modelFor(type: UnitType, tier: 1 | 2 | 3 = 1, tint = TINT, crest = CREST): UnitModel {
  const build = activeModels()[type];
  return build ? build({ tier, tint, crest }) : prototypeModel(type, tint, crest);
}

export function bakeUnit(type: UnitType, tier: 1 | 2 | 3 = 1): BakedRig {
  return bakeModel(type, modelFor(type, tier));
}
