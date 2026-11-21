// Boss models are built from hundreds of small parts (a tooth, a rib, a sucker). Drawn as they are,
// each one is a draw call, twice with shadows. The parts never move on their own, only with the
// bone they hang from, so after building, the parts of each bone are merged into one mesh per
// material. Bones, sockets and the shared materials stay as they were: the animators turn bones
// and pulse glow materials, and both still work.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Merge the plain meshes under every node, per material. Returns how many meshes are left. */
export function mergeParts(root: THREE.Object3D): number {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) nodes.push(o);
  });
  let left = 0;
  for (const node of nodes) {
    const byMat = new Map<THREE.Material, THREE.Mesh[]>();
    for (const c of node.children) {
      const m = c as THREE.Mesh;
      // only leaf meshes with one material; anything with children of its own is a bone
      if (!m.isMesh || m.children.length || Array.isArray(m.material)) continue;
      const list = byMat.get(m.material) ?? [];
      list.push(m);
      byMat.set(m.material, list);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) {
        left += list.length;
        continue;
      }
      const geos = list.map((m) => {
        m.updateMatrix();
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
        for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
        if (!g.attributes.normal) g.computeVertexNormals();
        return g;
      });
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) {
        left += list.length;
        continue;
      }
      for (const m of list) node.remove(m);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `${node.name || "node"}:merged`;
      node.add(mesh);
      left++;
    }
  }
  return left;
}
