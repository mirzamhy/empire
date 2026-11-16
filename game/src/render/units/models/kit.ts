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
export function tintMat(hex: number | string = 0xff00ff): THREE.MeshLambertMaterial {
  const m = lambert(hex);
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

/** Box whose top and bottom faces have different sizes (torsos, shields, blades, snouts). */
export function taperBox(wBottom: number, wTop: number, h: number, dBottom: number, dTop = dBottom): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, h, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0;
    p.setX(i, p.getX(i) * (top ? wTop : wBottom));
    p.setZ(i, p.getZ(i) * (top ? dTop : dBottom));
  }
  return g;
}

/** Flat ring (halo, hoops). */
export const ring = (r: number, tube: number, sides = 10) => new THREE.TorusGeometry(r, tube, 4, sides);

/** Free-form triangles from points [[x,y,z],...] and index triples. Used for wing membranes and cloth. */
export function sheet(points: number[][], faces: number[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const f of faces) for (const i of f) pos.push(points[i][0], points[i][1], points[i][2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
/** A tapered limb from point a to point b (radius ra at a, rb at b). Horns, bones, bows, tails. */
export function seg(parent: THREE.Object3D, mat: THREE.Material, a: number[], b: number[], ra: number, rb = ra, sides = 5): THREE.Mesh {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const m = new THREE.Mesh(rb > 0.001 ? new THREE.CylinderGeometry(rb, ra, len, sides, 1) : new THREE.ConeGeometry(ra, len, sides, 1), mat);
  m.position.copy(va).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  parent.add(m);
  return m;
}

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
