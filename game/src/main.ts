// EMPIRE game entry. F1: terrain from the reference map and random castle spawns on "ikut".
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SCHEMA_VERSION, validateCommand, type GameStatusMessage } from "../../shared/contract";
import { BridgeClient } from "./net/bridgeClient";
import { WorldMap } from "./sim/map";
import { Rng } from "./sim/rng";
import { buildTerrain } from "./render/terrain";
import { buildCastle, buildShield } from "./render/castle";
import { createScene } from "./render/scene";

const app = document.getElementById("app")!;
const view = createScene(app);
const map = new WorldMap();
const terrain = buildTerrain(map);
view.scene.add(terrain.group);
const controls = new OrbitControls(view.camera, view.renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

const COLORS = ["#9e2b25", "#1d4ed8", "#15803d", "#6d28d9", "#d97706", "#0f766e", "#be185d", "#0284c7", "#dc2626", "#4f46e5", "#b91c1c", "#ca8a04"];
const rng = new Rng(Date.now() & 0xffff);
const castles = new Map<string, { x: number; z: number }>();

function spawn(name: string) {
  if (castles.has(name)) return;
  const p = map.sampleSpawn(rng, [...castles.values()]);
  if (!p) return;
  castles.set(name, p);
  const color = COLORS[castles.size % COLORS.length];
  const c = buildCastle(1, color);
  c.position.set(p.x, map.heightAt(p.x, p.z), p.z);
  c.add(buildShield(color));
  view.scene.add(c);
  terrain.clearTrees(p.x, p.z, 5);
}

const bridge = new BridgeClient(
  `ws://127.0.0.1:8788/ws/game`,
  (raw) => {
    const v = validateCommand(raw);
    if (!v.ok || v.cmd.type !== "game.live") return;
    const e = v.cmd.event;
    if (e.kind === "chat" && /\b(ikut|join|gabung)\b/i.test(e.chat!.text)) spawn(e.user.username);
  },
  () => {},
);
bridge.connect();

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  terrain.altarCrystal.rotation.y = t * 1.6;
  terrain.water.position.y = -0.25 + Math.sin(t * 1.4) * 0.05;
  controls.update();
  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}
frame();

setInterval(() => {
  const status: GameStatusMessage = {
    schemaVersion: SCHEMA_VERSION, type: "game.status", roundId: 0, phase: "F1", secondsLeft: 0,
    paused: false, safeMode: false, fps: 0, kingdoms: castles.size, units: 0, joinQueue: 0, leader: null,
  };
  bridge.send(status);
}, 1000);

Object.assign(window, { __em: { map, view, spawn } });
