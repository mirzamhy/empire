// EMPIRE game entry: sim + renderers + HUD + live bridge.
// URL flags: ?free (orbit camera), ?studio (unit model line-up), ?seed=N, ?demo=N (N mock kingdoms, no bridge needed).
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
import { Director } from "./render/director";
import { Fx } from "./render/fx";
import { Hud } from "./ui/hud";

const params = new URLSearchParams(location.search);
const app = document.getElementById("app")!;
const view = createScene(app);
const map = new WorldMap();
const terrain = buildTerrain(map);
view.scene.add(terrain.group);

const sim = new Sim(loadConfig(), map, Number(params.get("seed") ?? (Date.now() & 0xffff)));
const castles = new CastleRenderer(map, (x, z) => terrain.clearTrees(x, z, 5));
const units = new UnitRenderer(map);
units.warmup();
const fx = new Fx(map);
view.scene.add(castles.group, units.group, fx.group);
const director = new Director(view.camera, map);
fx.onShake = (power, x, z) => director.shake(power, x, z);
const studio = params.has("studio");
const hud = studio ? null : new Hud(sim, map, view.camera);
let controls: OrbitControls | null = null;

if (studio || params.has("free")) {
  director.enabled = false;
  controls = new OrbitControls(view.camera, view.renderer.domElement);
  controls.target.set(0, 0, 0);
  view.camera.position.set(0, 400, 290);
  controls.update();
}

if (studio) {
  // one of each unit next to the altar for model checks
  const k = sim.join("studio", "Studio").kingdom!;
  sim.units.length = 0;
  UNIT_TYPES.forEach((t, i) => {
    sim.addUnits("studio", "Studio", { [t]: 1 }, "studio", false);
    const u = sim.units[sim.units.length - 1];
    u.x = map.altar.x - 8 + i * 1.6;
    u.z = map.altar.z + 12;
    u.heading = 0;
  });
  k.x = map.altar.x + 100;
  sim.paused = true;
  terrain.group.children.forEach((c) => {
    if ((c as THREE.InstancedMesh).isInstancedMesh) c.visible = false;
  });
  view.scene.background = new THREE.Color(0x363438);
  controls!.target.set(map.altar.x, 0.8, map.altar.z + 12);
  view.camera.position.set(map.altar.x, 2.2, map.altar.z + 21);
  controls!.update();
}

const demo = Number(params.get("demo") ?? 0);
for (let i = 0; i < demo; i++) sim.join(`demo${i + 1}`, `Demo${i + 1}`);

// ---------------------------------------------------------------- live bridge

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
  } else if (cmd.type === "game.overlay") {
    liveState = cmd.liveState;
    hud?.setLive(liveState);
  }
}

const bridge = new BridgeClient(`ws://127.0.0.1:${import.meta.env.VITE_BRIDGE_PORT ?? 8788}/ws/game`, onCommand, (s) => {
  if (s !== "open") hud?.setLive("OFFLINE");
});
if (!studio) bridge.connect();

// ---------------------------------------------------------------- territory paint

const terrData = terrain.territoryTex.image.data as Uint8Array;
const tmpColor = new THREE.Color();
function paintTerritory() {
  const colors = new Map(sim.kingdoms.map((k) => [k.id, k.color]));
  for (let i = 0; i < sim.tileOwner.length; i++) {
    const o = sim.tileOwner[i];
    const j = i * 4;
    if (!o) {
      terrData[j + 3] = 0;
      continue;
    }
    tmpColor.set(colors.get(o) ?? "#ffffff");
    terrData[j] = tmpColor.r * 255;
    terrData[j + 1] = tmpColor.g * 255;
    terrData[j + 2] = tmpColor.b * 255;
    terrData[j + 3] = 255;
  }
  terrain.territoryTex.needsUpdate = true;
}

// ---------------------------------------------------------------- loop

function dispatch(now: number) {
  for (const e of sim.drainEvents()) {
    hud?.onEvent(e);
    fx.onEvent(e, now, sim);
    director.onEvent(e, sim, now);
  }
}

// The world is too big for one sharp shadow map: the shadow box follows the camera focus.
const sunOffset = view.sun.position.clone();
function followSun() {
  const f = controls ? controls.target : director.focus;
  view.sun.target.position.set(f.x, 0, f.z);
  view.sun.position.set(f.x + sunOffset.x, sunOffset.y, f.z + sunOffset.z);
}

const clock = new THREE.Clock();
let fps = 60;
let paintTimer = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  sim.advance(dt);
  dispatch(t);
  paintTimer += dt;
  if (paintTimer > 0.5) {
    paintTimer = 0;
    paintTerritory();
  }
  terrain.altarCrystal.rotation.y = t * 1.6;
  terrain.water.position.y = -0.25 + Math.sin(t * 1.4) * 0.05;
  castles.update(sim, t);
  units.update(sim, t);
  fx.update(sim, t);
  director.update(sim, t, dt);
  controls?.update();
  followSun();
  hud?.update(t);
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

Object.assign(window, {
  __em: {
    sim, map, view, units, fx, hud, director, router, controls, liveState: () => liveState,
    render: () => view.renderer.render(view.scene, view.camera),
    /** Advance the sim and draw once. The browser pane throttles rAF, so tests drive frames by hand. */
    run: (seconds: number) => {
      const now = clock.elapsedTime + seconds;
      for (let i = 0; i < seconds * 20; i++) sim.step(0.05);
      dispatch(now);
      paintTerritory();
      castles.update(sim, now);
      units.update(sim, now);
      fx.update(sim, now);
      for (let i = 0; i < 60; i++) director.update(sim, now, 0.05);
      followSun();
      hud?.update(now);
      view.renderer.render(view.scene, view.camera);
    },
  },
});
