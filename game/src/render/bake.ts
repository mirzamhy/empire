// Bake a THREE.Group of coloured meshes into one non-indexed geometry with vertex colours.
// Meshes whose material is flagged `userData.tint = true` get a `tint` attribute of 1 so the
// instanced shader can multiply them by the per-instance kingdom colour.
import * as THREE from "three";

export const TINT_MARKER = 0xff00ff;

export function bakeGroup(root: THREE.Object3D, relativeTo?: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  if (relativeTo) {
    relativeTo.updateMatrixWorld(true);
    inv.copy(relativeTo.matrixWorld).invert();
  }
  const pos: number[] = [];
  const col: number[] = [];
  const tint: number[] = [];
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshBasicMaterial;
    const c = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
    const isTint = mat.userData?.tint === true || c.getHex() === TINT_MARKER;
    if (isTint) c.setRGB(1, 1, 1);
    const glow = mat.type === "MeshBasicMaterial" ? 1 : 0;
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = g.getAttribute("position");
    m.multiplyMatrices(inv, mesh.matrixWorld);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
      tint.push(isTint ? 1 : glow ? -1 : 0);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("tint", new THREE.Float32BufferAttribute(tint, 1));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Lambert material for baked, instanced geometry. tint=1 vertices take the instance colour,
 * tint=-1 vertices are emissive (glow parts such as fire and magic crystals).
 */
export function instancedMaterial(): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float tint;\nvarying float vTint;")
      .replace(
        "#include <color_vertex>",
        `#if defined( USE_COLOR_ALPHA )
vColor = vec4(1.0);
#else
vColor = vec3(1.0);
#endif
#ifdef USE_COLOR
  vColor.rgb *= color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
  if (tint > 0.5) vColor.rgb *= instanceColor.rgb;
#endif
vTint = tint;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vTint;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nif (vTint < -0.5) totalEmissiveRadiance += diffuseColor.rgb * 0.9;");
  };
  return mat;
}
