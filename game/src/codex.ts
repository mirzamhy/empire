// Troop codex page (units.html): every unit type with its real 3D model, stats from the game
// config, abilities and where it comes from (passive production, gifts, likes, villages...).
import * as THREE from "three";
import { UNIT_DESCRIPTIONS } from "./render/units/proto.js";
import { Animator, POSE_STRIDE } from "./render/units/animator";
import { clipFor } from "./render/units/anims";
import { bakeModel, modelFor, type BakedRig } from "./render/units/rig";
import type { Unit } from "./sim/world";
import { BANNER_COLORS, loadConfig, UNIT_ICON, UNIT_LABEL, UNIT_TYPES, type UnitStats, type UnitType } from "./sim/config";
import { loadEventsConfig } from "./live/router";

const cfg = loadConfig();
const ev = loadEventsConfig();

// ---------------------------------------------------------------- data

type Tier = "Ringan" | "Menengah" | "Berat" | "Legendaris";

const tierOf = (hp: number): Tier => (hp >= 1000 ? "Legendaris" : hp >= 500 ? "Berat" : hp >= 200 ? "Menengah" : "Ringan");

function roleOf(t: UnitType, s: UnitStats) {
  if (s.tags?.includes("siege")) return "Mesin kepung";
  if (s.flying) return "Terbang";
  if (s.heal) return "Pendukung";
  if (s.raise) return "Pemanggil";
  if (s.ranged) return "Jarak jauh";
  if (s.builds) return "Pembangun";
  if (s.stealth) return "Pembunuh";
  if (s.taunt) return "Penahan";
  if (s.speed >= 6) return "Penyerbu cepat";
  if (t === "skeleton") return "Panggilan";
  return "Jarak dekat";
}

function abilities(t: UnitType, s: UnitStats): string[] {
  const out: string[] = [];
  if (s.ranged) out.push(`Menyerang dari jauh (${s.range} m)`);
  if (s.splash) out.push(`Damage area radius ${s.splash} m: musuh di sekitar sasaran kena 50%`);
  if (s.heal) out.push(`Menyembuhkan teman ${s.heal} HP/dtk dalam radius ${s.healRange} m`);
  if (s.raise) out.push(`Musuh yang mati dalam 6 m bangkit jadi Skeleton (maks ${s.raise} per Necromancer)`);
  if (s.arrowResist) out.push(`Kebal sebagian: -${Math.round(s.arrowResist * 100)}% damage dari panah dan sihir`);
  if (s.flying) out.push("Terbang: melewati sungai, laut, dan gunung");
  if (s.aura) out.push(`Aura +${Math.round(s.aura * 100)}% damage untuk teman dalam ${s.auraRange} m`);
  const fastest = Math.max(...UNIT_TYPES.filter((u) => !cfg.unitTypes[u].flying).map((u) => cfg.unitTypes[u].speed));
  if (!s.flying && s.speed === fastest) out.push("Unit darat tercepat");
  const TAG: Record<string, string> = { big: "unit besar", flying: "unit terbang", ranged: "unit jarak jauh", support: "unit pendukung", siege: "mesin kepung", castle: "kastil", dragon: "Naga Dunia", unit: "pasukan" };
  for (const [tag, v] of Object.entries(s.bonusVs ?? {})) out.push(`${v > 0 ? "+" : ""}${Math.round(v * 100)}% damage ke ${TAG[tag] ?? tag}`);
  if (s.taunt) out.push(`Memancing serangan: musuh dalam ${s.taunt} m menyerangnya lebih dulu`);
  if (s.cover) out.push(`Melindungi teman dalam ${s.coverRange} m: -${Math.round(s.cover * 100)}% damage panah dan sihir`);
  if (s.rage) out.push(`Amuk: damage naik sampai +${Math.round(s.rage * 100)}% saat HP menipis`);
  if (s.stealth) out.push("Siluman: tidak bisa diincar sampai menyerang atau terkena serangan");
  if (s.hunts) out.push(`Mengincar ${s.hunts.map((h) => TAG[h] ?? h).join(" dan ")} lebih dulu`);
  if (s.dodge) out.push(`Lincah: -${Math.round(s.dodge * 100)}% damage panah saat bergerak`);
  if (s.trample) out.push(`Menginjak: unit kecil di jalurnya kena ${s.trample} damage dan terdorong`);
  if (s.minRange) out.push(`Tidak bisa menyerang sasaran yang lebih dekat dari ${s.minRange} m`);
  if (s.builds) out.push(`Membangun menara jaga di desa sendiri (${cfg.villages.towerBuildSeconds} dtk, menara menembak ${cfg.villages.towerDamage} damage)`);
  if (t === "skeleton") out.push("Tidak bisa dibeli, hanya muncul dari Necromancer");
  if (t === "spearman") out.push("Modal awal setiap kerajaan");
  if (!out.length) out.push("Prajurit jarak dekat tanpa kemampuan khusus");
  return out;
}

function sources(t: UnitType): string[] {
  const out: string[] = [];
  const start = cfg.kingdom.startUnits[t];
  if (start) out.push(`Modal awal: ${start} unit saat ketik IKUT`);
  const unlock = cfg.passive.unlocks.find((u) => u.units.includes(t));
  if (unlock) out.push(`Produksi pasif kastil sejak Level ${unlock.level}`);
  const tiers = [...ev.gift.valueTiers].sort((a, b) => a.minValue - b.minValue);
  tiers.forEach((tier, i) => {
    const next = tiers[i + 1]?.minValue;
    const range = next ? `${tier.minValue}–${next - 1}` : `${tier.minValue}+`;
    const units = (tier as { units?: Record<string, number> }).units;
    const perCoin = (tier as { perCoin?: Record<string, number> }).perCoin;
    if (units?.[t]) out.push(`Gift ${range} koin: ${units[t]} unit`);
    if (perCoin?.[t]) out.push(`Gift ${range} koin: ${perCoin[t]} unit per koin`);
  });
  if (ev.likes.unit === t) out.push(`Like: 1 unit tiap ${ev.likes.perUnit} like (maks ${ev.likes.maxUnitsPerMinute}/menit)`);
  const share = (ev.share.units as Record<string, number>)[t];
  if (share) out.push(`Share: ${share} unit`);
  const follow = (ev.follow.units as Record<string, number>)[t];
  if (follow) out.push(`Follow: ${follow} unit (sekali per ronde)`);
  if (cfg.villages.spawnUnit === t) out.push(`Milisi desa: 1 unit tiap ${cfg.villages.spawnEverySeconds} dtk per desa`);
  if (t === "dragon") out.push("Hadiah mengalahkan Naga Dunia (damage terbanyak)");
  if (t === "skeleton") out.push("Dibangkitkan Necromancer dari musuh yang mati");
  return out;
}

const ec = cfg.exp;
const hpAt = (t: UnitType, lv: number) => cfg.unitTypes[t].hp + ec.unitHpPerLevel * (lv - 1);
const dmgAt = (t: UnitType, lv: number) => cfg.unitTypes[t].dmg + ec.unitDmgPerLevel * (lv - 1);
const dpsAt = (t: UnitType, lv: number) => dmgAt(t, lv) / cfg.units.attackCooldown;
const MAX = {
  hp: Math.max(...UNIT_TYPES.map((t) => hpAt(t, ec.maxLevel))),
  dmg: Math.max(...UNIT_TYPES.map((t) => dmgAt(t, ec.maxLevel))),
  range: Math.max(...UNIT_TYPES.map((t) => cfg.unitTypes[t].range)),
  speed: Math.max(...UNIT_TYPES.map((t) => cfg.unitTypes[t].speed)),
};

const DESC: Record<string, string> = {
  ...UNIT_DESCRIPTIONS,
  skeleton: "Tulang belulang prajurit yang gugur, dibangkitkan Necromancer. Lemah tapi datang tanpa biaya.",
  halberdier: "Prajurit berkapak galah. Kaitnya menjatuhkan penunggang dan menahan raksasa.",
  shieldbearer: "Pembawa perisai menara. Berdiri paling depan, menyerap serangan dan menaungi pemanah di belakangnya.",
  berserker: "Petarung dua kapak tanpa zirah. Makin terluka, makin ganas.",
  assassin: "Pembunuh bertudung. Menyelinap melewati barisan depan untuk menghabisi pemanah dan penyihir.",
  engineer: "Tukang bangun kerajaan. Mengubah desa jadi pos berjaga dengan menara panah.",
  ballista: "Busur raksasa beroda dengan dua awak. Jangkauannya jauh dan mematikan bagi Naga.",
  elephant: "Gajah perang dengan menara penombak di punggungnya. Menerjang barisan dan menginjak apa pun yang kecil.",
  trebuchet: "Pelontar batu raksasa. Menghancurkan kastil dari jauh, tapi tak berdaya bila musuh sudah dekat.",
};

// ---------------------------------------------------------------- 3D

const armourTier = (level: number): 1 | 2 | 3 => (level >= 8 ? 3 : level >= 5 ? 2 : 1);

/** Same models as the game (Fable models where registered), at the tier of the chosen castle level. */
function buildModel(t: UnitType, color: string) {
  return modelFor(t, armourTier(state.level), color, "#facc15").root;
}

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x3a4a3f, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x93c5fd, 0.5);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
}

/** Put the model's feet at y=0 and aim the camera so it fills the frame. */
function frame(model: THREE.Object3D, camera: THREE.PerspectiveCamera, fill = 1) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  const h = Math.max(size.y * 0.85, size.x * 0.7, size.z * 0.7);
  const dist = (h / 2 / Math.tan((camera.fov * Math.PI) / 360)) * 1.35 * fill;
  camera.position.set(dist * 0.55, size.y * 0.62 + dist * 0.18, dist * 0.85);
  camera.lookAt(0, size.y * 0.5, 0);
}

// Thumbnails: one hidden renderer draws every model, copied into each card's 2D canvas.
const THUMB = 256;
const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setSize(THUMB, THUMB, false);
const thumbScene = new THREE.Scene();
lights(thumbScene);
const thumbCam = new THREE.PerspectiveCamera(32, 1, 0.05, 100);

function drawThumb(t: UnitType, color: string, canvas: HTMLCanvasElement) {
  const model = buildModel(t, color);
  model.rotation.y = 0.45;
  thumbScene.add(model);
  frame(model, thumbCam, 0.85);
  thumbRenderer.render(thumbScene, thumbCam);
  thumbScene.remove(model);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(thumbRenderer.domElement, 0, 0, canvas.width, canvas.height);
}

// Detail stage: live, slowly turning, drag to rotate.
const stage = document.getElementById("stage")!;
const stageRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
stageRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.prepend(stageRenderer.domElement);
const stageScene = new THREE.Scene();
lights(stageScene);
const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0x0b1820, transparent: true, opacity: 0.55 }));
ground.rotation.x = -Math.PI / 2;
stageScene.add(ground);
const stageCam = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
const turntable = new THREE.Group();
stageScene.add(turntable);
let spin = 0;
let dragging = false;
let fixedSpin = false;
let lastX = 0;
let idleSince = 0;

function showOnStage(t: UnitType, color: string) {
  turntable.clear();
  turntable.rotation.y = 0;
  const unitModel = modelFor(t, armourTier(state.level), color, "#facc15");
  const model = unitModel.root;
  turntable.add(model);
  frame(model, stageCam, 0.95);
  // animation lab: remember each bone's rest transform so clips can be applied on top
  const baked = bakeModel(t, unitModel);
  lab.rig = baked;
  lab.bones = baked.bones.map((b) => {
    const obj = b.name === "root" ? null : unitModel.bones[b.name] ?? null;
    return obj ? { obj, pos: obj.position.clone(), quat: obj.quaternion.clone() } : null;
  });
  lab.started = clock.elapsedTime;
  const box = new THREE.Box3().setFromObject(model);
  const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.62;
  ground.scale.setScalar(r);
}

function resizeStage() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  stageRenderer.setSize(w, h, false);
  stageCam.aspect = w / h;
  stageCam.updateProjectionMatrix();
}
new ResizeObserver(resizeStage).observe(stage);

stage.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  spin += (e.clientX - lastX) * 0.012;
  lastX = e.clientX;
});
stage.addEventListener("pointerup", () => {
  dragging = false;
  idleSince = performance.now();
});

// ---------------------------------------------------------------- animation lab
// Plays the game's own clips on the stage model. Deep link: &clip=attack&t=0.1 freezes a frame.
type LabClip = "idle" | "walk" | "attack";
const lab = {
  rig: null as BakedRig | null,
  bones: [] as ({ obj: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion } | null)[],
  clip: "idle" as LabClip,
  speed: 1,
  frozen: null as number | null,
  started: 0,
  time: 0,
};
const labAnimator = new Animator();
const labPose = new Float32Array(48 * POSE_STRIDE);
const labQ = new THREE.Quaternion();
const labE = new THREE.Euler();
const labV = new THREE.Vector3();

function applyLab(dt: number) {
  const rig = lab.rig;
  if (!rig) return;
  lab.time += dt * lab.speed;
  const attackLen = clipFor(rig.type, rig.rig, "attack")?.length ?? 0.35;
  // attack loops: the swing, then a short rest in idle
  const since = lab.frozen ?? (lab.time - lab.started) % (attackLen + 0.7);
  const u = { id: 0, moving: lab.clip === "walk", attackAt: lab.clip === "attack" ? lab.time - since : -99 } as Unit;
  labAnimator.pose(rig, u, lab.frozen !== null && lab.clip !== "attack" ? lab.frozen : lab.time, lab.time, labPose);
  lab.bones.forEach((b, i) => {
    if (!b) return;
    const o = i * POSE_STRIDE;
    b.obj.quaternion.copy(b.quat).multiply(labQ.setFromEuler(labE.set(labPose[o], labPose[o + 1], labPose[o + 2])));
    b.obj.position.copy(b.pos).add(labV.set(labPose[o + 3], labPose[o + 4], labPose[o + 5]).applyQuaternion(b.quat));
  });
}

const labBar = document.createElement("div");
labBar.style.cssText = "position:absolute;left:10px;bottom:8px;display:flex;gap:6px;align-items:center";
const labButtons: [LabClip, string][] = [["idle", "Diam"], ["walk", "Jalan"], ["attack", "Serang"]];
function paintLab() {
  labBar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.clip === lab.clip)));
}
for (const [clip, label] of labButtons) {
  const b = document.createElement("button");
  b.textContent = label;
  b.dataset.clip = clip;
  b.style.cssText = "font:inherit;font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid #2b4250;background:#0f1d26;color:#cfe3ee;cursor:pointer";
  b.addEventListener("pointerdown", (e) => e.stopPropagation());
  b.addEventListener("click", () => {
    lab.clip = clip;
    lab.frozen = null;
    lab.started = lab.time;
    paintLab();
  });
  labBar.append(b);
}
const labSpeed = document.createElement("select");
labSpeed.setAttribute("aria-label", "Kecepatan animasi");
labSpeed.style.cssText = "font:inherit;font-size:11px;padding:2px 4px;border-radius:6px;border:1px solid #2b4250;background:#0f1d26;color:#cfe3ee";
for (const s of [1, 0.5, 0.2]) labSpeed.add(new Option(s === 1 ? "1x" : s + "x", String(s)));
labSpeed.addEventListener("pointerdown", (e) => e.stopPropagation());
labSpeed.addEventListener("change", () => (lab.speed = Number(labSpeed.value)));
labBar.append(labSpeed);
stage.append(labBar);
const labStyle = document.createElement("style");
labStyle.textContent = '.stage button[aria-pressed="true"]{background:#f5c451 !important;color:#10202a !important;border-color:#f5c451 !important}';
document.head.append(labStyle);
paintLab();

const clock = new THREE.Clock();
function loop() {
  const dt = clock.getDelta();
  applyLab(dt);
  if (!dragging && !fixedSpin && performance.now() - idleSince > 1200) spin += dt * 0.5;
  turntable.rotation.y = spin;
  stageRenderer.render(stageScene, stageCam);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- UI

const state = { unit: "spearman" as UnitType, color: BANNER_COLORS[1], level: 1, sort: { key: "hp", dir: -1 } };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const grid = document.getElementById("grid")!;
const thumbs = new Map<UnitType, HTMLCanvasElement>();
for (const t of UNIT_TYPES) {
  const s = cfg.unitTypes[t];
  const card = document.createElement("button");
  card.className = "card";
  card.dataset.unit = t;
  const canvas = document.createElement("canvas");
  canvas.width = THUMB;
  canvas.height = THUMB;
  thumbs.set(t, canvas);
  card.append(canvas);
  card.insertAdjacentHTML(
    "beforeend",
    `<div class="title">${UNIT_ICON[t]} ${esc(UNIT_LABEL[t])}</div>
     <div class="sub">${roleOf(t, s)} · ${tierOf(s.hp)}</div>
     <div class="mini" data-mini></div>`,
  );
  card.addEventListener("click", () => select(t));
  grid.append(card);
}

function renderMini() {
  for (const card of grid.querySelectorAll<HTMLElement>(".card")) {
    const t = card.dataset.unit as UnitType;
    card.setAttribute("aria-pressed", String(t === state.unit));
    card.querySelector("[data-mini]")!.innerHTML =
      `<div><b>${hpAt(t, state.level)}</b><span>HP</span></div>` +
      `<div><b>${dmgAt(t, state.level)}</b><span>DMG</span></div>` +
      `<div><b>${fmt(cfg.unitTypes[t].range)}</b><span>m</span></div>` +
      `<div><b>${fmt(cfg.unitTypes[t].speed)}</b><span>m/s</span></div>`;
  }
}

function bar(name: string, value: number, max: number, color: string, unit = "") {
  return `<div class="stat"><span class="name">${name}</span><span class="bar"><i style="width:${Math.max(3, (value / max) * 100)}%;background:${color}"></i></span><span class="val">${fmt(value)}${unit}</span></div>`;
}

function renderDetail() {
  const t = state.unit;
  const s = cfg.unitTypes[t];
  const lv = state.level;
  const css = getComputedStyle(document.documentElement);
  const c = (v: string) => css.getPropertyValue(v).trim();
  document.getElementById("detailBody")!.innerHTML = `
    <h2>${UNIT_ICON[t]} ${esc(UNIT_LABEL[t])}</h2>
    <div class="tags">
      <span class="tag tier-${tierOf(s.hp)}">${tierOf(s.hp)}</span>
      <span class="tag">${roleOf(t, s)}</span>
      <span class="tag">Level kastil ${lv}</span>
    </div>
    <div class="stats">
      ${bar("HP", hpAt(t, lv), MAX.hp, c("--hp"))}
      ${bar("Damage", dmgAt(t, lv), MAX.dmg, c("--dmg"))}
      ${bar("DPS", dpsAt(t, lv), MAX.dmg / cfg.units.attackCooldown, c("--dmg"))}
      ${bar("Jangkauan", s.range, MAX.range, c("--range"), " m")}
      ${bar("Kecepatan", s.speed, MAX.speed, c("--speed"), " m/s")}
    </div>
    <h3>Kemampuan</h3>
    <ul class="list">${abilities(t, s).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    <h3>Cara mendapatkan</h3>
    <ul class="list">${sources(t).map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
    <h3>Penampilan</h3>
    <p class="desc">${esc(DESC[t] ?? "")}</p>`;
}

const COLUMNS: { key: string; label: string; num?: boolean; get: (t: UnitType) => number | string }[] = [
  { key: "name", label: "Unit", get: (t) => UNIT_LABEL[t] },
  { key: "role", label: "Peran", get: (t) => roleOf(t, cfg.unitTypes[t]) },
  { key: "hp", label: "HP", num: true, get: (t) => hpAt(t, state.level) },
  { key: "dmg", label: "Damage", num: true, get: (t) => dmgAt(t, state.level) },
  { key: "dps", label: "DPS", num: true, get: (t) => +dpsAt(t, state.level).toFixed(1) },
  { key: "range", label: "Jangkauan", num: true, get: (t) => cfg.unitTypes[t].range },
  { key: "speed", label: "Kecepatan", num: true, get: (t) => cfg.unitTypes[t].speed },
  { key: "src", label: "Sumber utama", get: (t) => sources(t)[0] ?? "-" },
];

function renderTable() {
  const table = document.getElementById("table")!;
  const col = COLUMNS.find((c) => c.key === state.sort.key)!;
  const rows = [...UNIT_TYPES].sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * state.sort.dir;
  });
  table.innerHTML =
    `<thead><tr>${COLUMNS.map((c) => `<th data-key="${c.key}" ${c.key === state.sort.key ? `aria-sort="${state.sort.dir < 0 ? "descending" : "ascending"}"` : ""}>${c.label}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows
      .map(
        (t) =>
          `<tr data-unit="${t}" class="${t === state.unit ? "sel" : ""}">${COLUMNS.map((c) => {
            const v = c.get(t);
            return `<td class="${c.num ? "num" : ""}">${c.key === "name" ? `${UNIT_ICON[t]} ` : ""}${esc(String(v))}</td>`;
          }).join("")}</tr>`,
      )
      .join("")}</tbody>`;
  table.querySelectorAll<HTMLElement>("th").forEach((th) =>
    th.addEventListener("click", () => {
      const key = th.dataset.key!;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : COLUMNS.find((c) => c.key === key)!.num ? -1 : 1 };
      renderTable();
    }),
  );
  table.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => tr.addEventListener("click", () => select(tr.dataset.unit as UnitType, true)));
  document.getElementById("foot")!.textContent =
    `Stat di level kastil ${state.level}: +${ec.unitHpPerLevel} HP dan +${ec.unitDmgPerLevel} damage per level di atas 1. ` +
    `DPS = damage ÷ jeda serang ${cfg.units.attackCooldown} dtk. Unit di layar digambar lebih besar dari ukuran sim agar terlihat di HP.`;
}

function select(t: UnitType, scroll = false) {
  state.unit = t;
  showOnStage(t, state.color);
  renderDetail();
  renderMini();
  renderTable();
  if (scroll) document.getElementById("detail")!.scrollIntoView({ behavior: "smooth", block: "start" });
}

function redrawThumbs() {
  for (const [t, canvas] of thumbs) drawThumb(t, state.color, canvas);
}

// colour swatches
const swatches = document.getElementById("swatches")!;
for (const color of BANNER_COLORS.slice(0, 12)) {
  const b = document.createElement("button");
  b.className = "swatch";
  b.style.background = color;
  b.title = color;
  b.setAttribute("aria-label", `Warna ${color}`);
  b.setAttribute("aria-pressed", String(color === state.color));
  b.addEventListener("click", () => {
    state.color = color;
    swatches.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
    redrawThumbs();
    showOnStage(state.unit, color);
  });
  swatches.append(b);
}

// level slider
const level = document.getElementById("level") as HTMLInputElement;
level.max = String(ec.maxLevel);
level.addEventListener("input", () => {
  const before = armourTier(state.level);
  state.level = Number(level.value);
  if (armourTier(state.level) !== before) {
    redrawThumbs();
    showOnStage(state.unit, state.color);
  }
  document.getElementById("levelOut")!.textContent = `Lv ${state.level}`;
  renderDetail();
  renderMini();
  renderTable();
});

// deep links: units.html?unit=dragon&level=8&spin=1.6 (spin in radians stops the turntable)
const q = new URLSearchParams(location.search);
const qUnit = q.get("unit") as UnitType | null;
if (qUnit && UNIT_TYPES.includes(qUnit)) state.unit = qUnit;
if (q.has("level")) {
  state.level = Math.min(ec.maxLevel, Math.max(1, Number(q.get("level")) || 1));
  level.value = String(state.level);
  document.getElementById("levelOut")!.textContent = `Lv ${state.level}`;
}
const qClip = q.get("clip") as LabClip | null;
if (qClip && ["idle", "walk", "attack"].includes(qClip)) {
  lab.clip = qClip;
  if (q.has("t")) lab.frozen = Number(q.get("t")) || 0;
  paintLab();
}
if (q.has("spin")) {
  spin = Number(q.get("spin")) || 0;
  fixedSpin = true;
}

resizeStage();
redrawThumbs();
select(state.unit);
turntable.rotation.y = spin;
applyLab(0);
stageRenderer.render(stageScene, stageCam);
loop();
