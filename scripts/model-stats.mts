// Detail table of every unit model: triangles, parts and colours per tier, for both model sets.
// Run: npx tsx scripts/model-stats.mts [v1|v2]
import * as THREE from "three";
import { MODEL_SETS } from "../game/src/render/units/sets";

const which = (process.argv[2] ?? "v2") as keyof typeof MODEL_SETS;
const rows: string[] = [];
let min = Infinity;
let max = 0;
for (const [name, b] of Object.entries(MODEL_SETS[which])) {
  const out = ([1, 2, 3] as const).map((t) => {
    const m = b!({ tier: t, tint: "#ff00ff", crest: "#ffffff" });
    let meshes = 0;
    const mats = new Set<number>();
    m.root.traverse((o) => {
      const me = o as THREE.Mesh;
      if (me.isMesh) {
        meshes++;
        mats.add((me.material as THREE.MeshLambertMaterial).color.getHex());
      }
    });
    if (t === 1) {
      min = Math.min(min, m.meta.tris);
      max = Math.max(max, m.meta.tris);
    }
    return `${String(m.meta.tris).padStart(4)}t ${String(meshes).padStart(3)}p ${String(mats.size).padStart(2)}c`;
  });
  const m = b!({ tier: 1, tint: "#ff00ff", crest: "#ffffff" });
  rows.push(`${name.padEnd(13)} ${m.rig.padEnd(10)} h=${m.meta.height.toFixed(1)}  ${out.join("  |  ")}`);
}
console.log(rows.join("\n"));
console.log(`\n${which}: tier-1 triangles ${min}..${max}, ratio ${(max / min).toFixed(2)}`);
