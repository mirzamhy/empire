// EMPIRE game entry: sim + renderers + HUD + live bridge.
// URL flags: ?free (orbit camera), ?studio (unit model line-up), ?seed=N, ?demo=N (N mock kingdoms, no bridge needed),
// ?map=1|2|3 (which map, see sim/maps.ts), ?veg=0.6 (thinner vegetation), ?atmo=0 (no mist, birds or particles),
// ?trees=simple (plain trees on a map that has detailed ones).
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SCHEMA_VERSION, validateCommand, type GameStatusMessage } from "../../shared/contract";
import { BridgeClient } from "./net/bridgeClient";
import { LiveRouter, type RouteResult } from "./live/router";
import { loadConfig, UNIT_TYPES } from "./sim/config";
import { WORLD_SCALE, WorldMap } from "./sim/map";
import { Sim } from "./sim/world";
import { Atmosphere } from "./render/atmosphere";
import { buildTerrain } from "./render/terrain";
import { createScene } from "./render/scene";
import { CastleRenderer } from "./render/castles";
import { VillageRenderer } from "./render/villages";
import { UnitRenderer } from "./render/units/units";
import { Director } from "./render/director";
import { Fx } from "./render/fx";
import { Hud } from "./ui/hud";
import { PerfOverlay } from "./ui/perf";

const params = new URLSearchParams(location.search);
const app = document.getElementById("app")!;
const view = createScene(app);
const map = new WorldMap();
const terrain = buildTerrain(map, Math.min(1.5, Math.max(0.2, Number(params.get("veg")) || 1)), params.get("trees") === "simple");
view.scene.add(terrain.group);

const sim = new Sim(loadConfig(), map, Number(params.get("seed") ?? (Date.now() & 0xffff)));
const castles = new CastleRenderer(map, (x, z) => terrain.clearTrees(x, z, 5));
const villages = new VillageRenderer(map, (x, z) => terrain.clearTrees(x, z, 7.5));
const units = new UnitRenderer(map);
units.warmup();
const fx = new Fx(map);
view.scene.add(castles.group, villages.group, units.group, fx.group);
const director = new Director(view.camera, map);
fx.onShake = (power, x, z) => director.shake(power, x, z);
// effects that start at a body part (dragon fire from the mouth) ask the unit renderer where it is
let fxTime = 0;
fx.socketOf = (id, socket, out) => {
  const u = sim.units.find((x) => x.id === id && x.alive);
  return !!u && units.socketWorld(sim, u, socket, fxTime, out);
};
const studio = params.has("studio");
const hud = studio ? null : new Hud(sim, map, view.camera);
let controls: OrbitControls | null = null;

if (studio || params.has("free")) {
  director.enabled = false;
  controls = new OrbitControls(view.camera, view.renderer.domElement);
  controls.target.set(0, 0, 0);
  view.camera.position.set(0, 400 * WORLD_SCALE, 290 * WORLD_SCALE);
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
/** Land tint per tile: soft fill inside, a bright solid edge where the owner changes (the border). */
function paintTerritory() {
  const colors = new Map(sim.kingdoms.map((k) => [k.id, k.color]));
  const own = sim.tileOwner;
  const w = sim.tilesW;
  const h = sim.tilesH;
  for (let i = 0; i < own.length; i++) {
    const o = own[i];
    const j = i * 4;
    if (!o) {
      terrData[j + 3] = 0;
      continue;
    }
    const x = i % w;
    const z = (i / w) | 0;
    // a border tile touches other land but is itself part of a solid patch (2+ own neighbours);
    // thin trails left by marching troops stay soft so the map does not turn into confetti
    let same = 0;
    let diff = 0;
    if (x > 0) own[i - 1] === o ? same++ : diff++;
    if (x < w - 1) own[i + 1] === o ? same++ : diff++;
    if (z > 0) own[i - w] === o ? same++ : diff++;
    if (z < h - 1) own[i + w] === o ? same++ : diff++;
    const edge = diff > 0 && same >= 2;
    tmpColor.set(colors.get(o) ?? "#ffffff");
    terrData[j] = tmpColor.r * 255;
    terrData[j + 1] = tmpColor.g * 255;
    terrData[j + 2] = tmpColor.b * 255;
    terrData[j + 3] = edge ? 255 : 130;
  }
  terrain.territoryTex.needsUpdate = true;
}

// ---------------------------------------------------------------- loop

function dispatch(now: number) {
  for (const e of sim.drainEvents()) {
    hud?.onEvent(e);
    fx.onEvent(e, now, sim);
    if (e.k === "death") units.addCorpse(sim, e, now);
    director.onEvent(e, sim, now);
  }
}

// The world is too big for one sharp shadow map: the shadow box follows the camera focus.
// The sun's direction and colour come from the atmosphere (mood per round phase).
const atmosphere = new Atmosphere(view, terrain.cloudShadow);
if (studio) atmosphere.setVisible(false);
function followSun() {
  const f = controls ? controls.target : director.focus;
  const o = atmosphere.sunOffset;
  view.sun.target.position.set(f.x, 0, f.z);
  view.sun.position.set(f.x + o.x, o.y, f.z + o.z);
}

const perf = params.has("perf") ? new PerfOverlay(view.renderer) : null;
const clock = new THREE.Clock();
let fps = 60;
let paintTimer = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  perf?.begin("sim");
  sim.advance(dt);
  dispatch(t);
  perf?.end("sim");
  paintTimer += dt;
  if (paintTimer > 0.5) {
    paintTimer = 0;
    paintTerritory();
  }
  terrain.altarCrystal.rotation.y = t * 1.6;
  terrain.water.position.y = -0.25 + Math.sin(t * 1.4) * 0.05;
  terrain.update(t);
  if (!studio) atmosphere.update(sim.phase, dt);
  castles.update(sim, t);
  villages.update(sim, t);
  perf?.begin("units");
  units.update(sim, t);
  perf?.end("units");
  perf?.begin("fx");
  fxTime = t;
  fx.update(sim, t);
  perf?.end("fx");
  director.update(sim, t, dt);
  controls?.update();
  followSun();
  perf?.begin("hud");
  hud?.update(t);
  perf?.end("hud");
  perf?.begin("render");
  view.renderer.render(view.scene, view.camera);
  perf?.end("render");
  perf?.frame({ units: sim.units.length, kingdoms: sim.alive.length });
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
    sim, map, view, units, villages, fx, hud, director, router, controls, perf, liveState: () => liveState,
    render: () => view.renderer.render(view.scene, view.camera),
    /** Advance the sim and draw once. The browser pane throttles rAF, so tests drive frames by hand. */
    run: (seconds: number) => {
      const now = clock.elapsedTime + seconds;
      for (let i = 0; i < seconds * 20; i++) sim.step(0.05);
      dispatch(now);
      paintTerritory();
      castles.update(sim, now);
      villages.update(sim, now);
      units.update(sim, now);
      fxTime = now;
      fx.update(sim, now);
      for (let i = 0; i < 60; i++) director.update(sim, now, 0.05);
      terrain.update(now);
      if (!studio) atmosphere.update(sim.phase, seconds);
      followSun();
      hud?.update(now);
      view.renderer.render(view.scene, view.camera);
    },
  },
});
