// Boss model sheet (bosses.html): every boss model on a plain background, seen from the six sides
// (front, right, back, left, top, bottom) with an orthographic camera, so the shapes can be checked
// without the map, the fog or the animation. bosses.html?boss=worm opens one boss; &pose=0 shows the
// rest pose of the rig instead of the pose it holds in play.
import * as THREE from "three";
import type { BossModel } from "./render/bosses/titan";
import { buildTitan } from "./render/bosses/titan";
import { buildElder } from "./render/bosses/elder";
import { buildBoneDragon } from "./render/bosses/bone";
import { buildYeti } from "./render/bosses/yeti";
import { buildTreant } from "./render/bosses/treant";
import { buildKraken, KRAKEN_ARMS, KRAKEN_SEGS } from "./render/bosses/kraken";
import { buildWorm, WORM_SEGS } from "./render/bosses/worm";
import { mergeParts } from "./render/bosses/merge";

const BOSSES: Record<string, { label: string; build: () => BossModel; pose?: (m: BossModel) => void }> = {
  bone: { label: "Naga Tengkorak", build: buildBoneDragon, pose: poseFlyer },
  worm: { label: "Cacing Pasir", build: buildWorm, pose: poseWorm },
  yeti: { label: "Raksasa Es", build: buildYeti },
  kraken: { label: "Kraken", build: buildKraken, pose: poseKraken },
  treant: { label: "Treant Purba", build: buildTreant },
  titan: { label: "Titan", build: buildTitan },
  elder: { label: "Naga Purba", build: buildElder, pose: poseFlyer },
};

/** The worm standing in its arch with the mouth half open, as in play. */
function poseWorm(m: BossModel) {
  const b = m.bones;
  for (let i = 0; i < WORM_SEGS; i++) b[`s${i}`].rotation.x = i === 0 ? -0.45 : 0.16 + (i > WORM_SEGS - 4 ? 0.08 : 0);
  b.head.rotation.x = 0.55;
  for (let i = 0; i < 4; i++) b[`p${i}`].rotation.x = 0.7;
}

/** Dragons hovering: neck up, wings half raised, tail trailing. */
function poseFlyer(m: BossModel) {
  const b = m.bones;
  if (b.wingR) b.wingR.rotation.z = -0.25;
  if (b.wingL) b.wingL.rotation.z = 0.25;
  if (b.jaw) b.jaw.rotation.x = 0.3;
}

/** Tentacles raised and curling over at the tips. */
function poseKraken(m: BossModel) {
  KRAKEN_ARMS.forEach((_, i) => {
    for (let j = 0; j < KRAKEN_SEGS; j++) m.bones[`t${i}_${j}`].rotation.x = j === 0 ? 0.35 : 0.12 + j * 0.05;
  });
}

const VIEWS: { name: string; dir: [number, number, number]; up?: [number, number, number] }[] = [
  { name: "Depan", dir: [0, 0, 1] },
  { name: "Kanan", dir: [-1, 0, 0] },
  { name: "Belakang", dir: [0, 0, -1] },
  { name: "Kiri", dir: [1, 0, 0] },
  { name: "Atas", dir: [0, 1, 0], up: [0, 0, 1] },
  { name: "Bawah", dir: [0, -1, 0], up: [0, 0, 1] },
];

const SIZE = 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 1.5));
const key = new THREE.DirectionalLight(0xfff3e0, 1.4);
key.position.set(4, 8, 6);
scene.add(key);
const fill = new THREE.DirectionalLight(0xdbe7ff, 0.6);
fill.position.set(-6, -3, -5);
scene.add(fill);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);

const grid = document.getElementById("grid")!;
const pick = document.getElementById("pick")!;
const poseBox = document.getElementById("pose") as HTMLInputElement;
const stats = document.getElementById("stats")!;
const tris = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((c) => {
    const g = (c as THREE.Mesh).geometry;
    if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(n);
};
const cells = VIEWS.map((v) => {
  const fig = document.createElement("figure");
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const cap = document.createElement("figcaption");
  cap.textContent = v.name;
  fig.append(canvas, cap);
  grid.append(fig);
  // click a view to see it alone and large; click again for all six
  fig.onclick = () => {
    const on = !fig.classList.contains("big");
    for (const f of grid.children) f.classList.remove("big");
    fig.classList.toggle("big", on);
    grid.classList.toggle("one", on);
  };
  return canvas.getContext("2d")!;
});

const params = new URLSearchParams(location.search);
let current = BOSSES[params.get("boss") ?? ""] ? params.get("boss")! : "bone";
poseBox.checked = params.get("pose") !== "0";
let model: BossModel | null = null;

function show() {
  if (model) scene.remove(model.root);
  const def = BOSSES[current];
  model = def.build();
  if (poseBox.checked) def.pose?.(model);
  // merged as in play, so the count below is the real number of draw calls
  const meshes = mergeParts(model.root);
  scene.add(model.root);
  model.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model.root);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = sphere.radius;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => new THREE.Vector3(n & 1 ? box.max.x : box.min.x, n & 2 ? box.max.y : box.min.y, n & 4 ? box.max.z : box.min.z));
  VIEWS.forEach((v, i) => {
    camera.up.set(...(v.up ?? [0, 1, 0]));
    camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(...v.dir), r * 4);
    camera.lookAt(sphere.center);
    camera.updateMatrixWorld();
    // fit each side on its own: the box as this camera sees it, made square, with a little margin
    const lo = new THREE.Vector2(Infinity, Infinity);
    const hi = new THREE.Vector2(-Infinity, -Infinity);
    for (const c of corners) {
      const p = c.clone().applyMatrix4(camera.matrixWorldInverse);
      lo.min(new THREE.Vector2(p.x, p.y));
      hi.max(new THREE.Vector2(p.x, p.y));
    }
    const half = Math.max(hi.x - lo.x, hi.y - lo.y) * 0.53;
    const cx = (lo.x + hi.x) / 2;
    const cy = (lo.y + hi.y) / 2;
    camera.left = cx - half;
    camera.right = cx + half;
    camera.top = cy + half;
    camera.bottom = cy - half;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    cells[i].clearRect(0, 0, SIZE, SIZE);
    cells[i].drawImage(renderer.domElement, 0, 0);
  });
  for (const b of pick.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.boss === current));
  document.title = `EMPIRE · ${def.label}`;
  stats.textContent = `${meshes} mesh · ${tris(model.root).toLocaleString("id-ID")} segitiga`;
  const url = new URL(location.href);
  url.searchParams.set("boss", current);
  if (poseBox.checked) url.searchParams.delete("pose");
  else url.searchParams.set("pose", "0");
  history.replaceState(null, "", url);
}

for (const [k, def] of Object.entries(BOSSES)) {
  const b = document.createElement("button");
  b.textContent = def.label;
  b.dataset.boss = k;
  b.onclick = () => {
    current = k;
    show();
  };
  pick.append(b);
}
poseBox.onchange = show;
show();
