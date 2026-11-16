// Helpers for writing unit models (docs/rencana-visual.md section 3). Keeps model files short and
// guarantees the conventions the baker relies on:
//   - a *bone* is a Group whose origin is the joint; rotation zero = rest pose
//   - bones nest to any depth; meshes added to a bone move with it
//   - a *socket* is an empty marker; the bone above it carries it
//   - +Y up, faces +Z, the unit's right side is -X, feet at y = 0
import * as THREE from "three";
import { countTris, type BoneName, type RigKind, type SocketName, type UnitModel } from "../contract";

/** Plain flat-shaded colour. */
export function lambert(hex: number | string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(hex), flatShading: true });
}

/** Self-lit part (eyes, runes, fire, magic). Baked as emissive. */
export function glow(hex: number | string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
}

/** Kingdom-colour part: painted #ff00ff here, replaced by the kingdom colour in game. */
export function tintMat(): THREE.MeshLambertMaterial {
  const m = lambert(0xff00ff);
  m.userData.tint = true;
  return m;
}

/** A bone pivot at (x, y, z) in its parent's space, with an optional rest rotation (radians). */
export function pivot(parent: THREE.Object3D, name: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Group {
  const g = new THREE.Group();
  g.name = `bone:${name}`;
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  parent.add(g);
  return g;
}

/** A mesh in `parent` space. Optional rotation (radians). */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

/** Marker object for effects and attachments. */
export function socketAt(parent: THREE.Object3D, name: SocketName, x = 0, y = 0, z = 0): THREE.Object3D {
  const s = new THREE.Object3D();
  s.name = `socket:${name}`;
  s.position.set(x, y, z);
  parent.add(s);
  return s;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** Cylinder with few sides; rTop/rBottom differ for tapers. */
export const cyl = (rTop: number, rBottom: number, h: number, sides = 6) => new THREE.CylinderGeometry(rTop, rBottom, h, sides, 1);
export const cone = (r: number, h: number, sides = 6) => new THREE.ConeGeometry(r, h, sides, 1);
/** Low-poly sphere (icosahedron, detail 0 = 20 triangles, 1 = 80). */
export const ico = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);

/** Collect bones and sockets into a UnitModel and fill in meta (tris, height). */
export function finishModel(
  root: THREE.Group,
  rig: RigKind,
  bones: Partial<Record<BoneName, THREE.Object3D>>,
  sockets: Partial<Record<SocketName, THREE.Object3D>>,
): UnitModel {
  root.updateMatrixWorld(true);
  const height = new THREE.Box3().setFromObject(root).max.y;
  return { root, rig, bones, sockets, meta: { tris: countTris(root), height } };
}
