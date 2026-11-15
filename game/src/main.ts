// EMPIRE game entry. F4: sim + terrain + castles + instanced units. ?studio shows all 10 unit models.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SCHEMA_VERSION, validateCommand, type GameStatusMessage } from "../../shared/contract";
import { BridgeClient } from "./net/bridgeClient";
import { LiveRouter, type RouteResult } from "./live/router";
import { loadConfig, UNIT_TYPES } from "./sim/config";
import { WorldMap } from "./sim/map";
import { Sim } from "./sim/world";
import { buildTerrain } from "./render/terrain";
import { createScene } from "./render/scene";
import { CastleRenderer } from "./render/castles";
import { UnitRenderer } from "./render/units/units";

const params = new URLSearchParams(location.search);
const app = document.getElementById("app")!;
const view = createScene(app);
const map = new WorldMap();
const terrain = buildTerrain(map);
view.scene.add(terrain.group);
const controls = new OrbitControls(view.camera, view.renderer.domElement);

const sim = new Sim(loadConfig(), map, Number(params.get("seed") ?? (Date.now() & 0xffff)));
const castles = new CastleRenderer(map, (x, z) => terrain.clearTrees(x, z, 5));
const units = new UnitRenderer(map);
units.warmup();
view.scene.add(castles.group, units.group);

if (params.has("studio")) {
  // line up one of each unit next to the altar for model checks
  const k = sim.join("studio", "Studio").kingdom!;
  sim.units.length = 0;
  UNIT_TYPES.forEach((t, i) => {
    sim.addUnits("studio", "Studio", { [t]: 1 }, "studio", false);
    const u = sim.units[sim.units.length - 1];
    u.x = map.altar.x - 14 + i * 2.6;
    u.z = map.altar.z + 12;
    u.heading = 0;
  });
  k.x = map.altar.x + 100;
  sim.paused = true;
  terrain.group.children.forEach((c) => {
    if ((c as THREE.InstancedMesh).isInstancedMesh) c.visible = false;
  });
  view.scene.background = new THREE.Color(0x363438);
  controls.target.set(map.altar.x, 1, map.altar.z + 12);
  view.camera.position.set(map.altar.x, 4, map.altar.z + 22);
} else {
  controls.target.set(0, 0, 0);
  view.camera.position.set(0, 150, 110);
}
controls.update();

const router = new LiveRouter(sim);
let liveState = "DEMO";

function onCommand(raw: unknown) {
  const v = validateCommand(raw);
  if (!v.ok) return;
  const cmd = v.cmd;
  if (cmd.type === "game.live") {
    let res: RouteResult;
    try {
      res = router.handle(cmd.event);
    } catch (err) {
      console.error("router error", err);
      res = { status: "rejected", reason: "handler_error" };
    }
    bridge.send({ schemaVersion: SCHEMA_VERSION, type: "game.ack", commandId: cmd.commandId, status: res.status, reason: res.reason });
  } else if (cmd.type === "game.control") {
    switch (cmd.op) {
      case "pause": sim.paused = true; break;
      case "resume": sim.paused = false; break;
      case "next_phase": sim.nextPhase(); break;
      case "extend_round": sim.extend(300); break;
      case "reset_round": sim.resetRound(); break;
      case "safe_mode_on": router.safeMode = true; break;
      case "safe_mode_off": router.safeMode = false; break;
      case "kick": if (cmd.target) sim.kick(cmd.target); break;
    }
  } else if (cmd.type === "game.overlay") liveState = cmd.liveState;
}

const bridge = new BridgeClient(`ws://127.0.0.1:8788/ws/game`, onCommand, () => {});
bridge.connect();

const clock = new THREE.Clock();
let fps = 60;
function frame() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  sim.advance(dt);
  sim.drainEvents();
  terrain.altarCrystal.rotation.y = t * 1.6;
  terrain.water.position.y = -0.25 + Math.sin(t * 1.4) * 0.05;
  castles.update(sim, t);
  units.update(sim, t);
  controls.update();
  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}
frame();

setInterval(() => {
  const status: GameStatusMessage = {
    schemaVersion: SCHEMA_VERSION, type: "game.status", roundId: sim.roundId, phase: sim.phase, secondsLeft: sim.secondsLeft(),
    paused: sim.paused, safeMode: router.safeMode, fps: Math.round(fps), kingdoms: sim.alive.length, units: sim.units.length,
    joinQueue: sim.joinQueue.length, leader: sim.leaderboard()[0]?.name ?? null,
  };
  bridge.send(status);
}, 1000);

Object.assign(window, { __em: { sim, router, liveState: () => liveState, map, view, units, controls, render: () => view.renderer.render(view.scene, view.camera) } });
