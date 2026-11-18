// Weather on screen, for every map: clouds, rain, snow, blowing sand, fog and lightning. The rules
// live in render/weathercycle.ts. The falling particles fill a box around the camera's view that
// grows with distance, so a storm reads from the overview as well as from a close shot.
import * as THREE from "three";
import { WORLD_H, WORLD_W, type WorldMap } from "../sim/map";
import type { Phase } from "../sim/world";
import type { RoundTimes } from "./daycycle";
import type { SceneHandles } from "./scene";
import type { TerrainHandles } from "./terrain";
import { CLEAR_FX, lookAt, parseWeatherMode, precipAt, roundClock, weatherAt, weatherWeights, type Precip, type Weather, type WeatherFx, type WeatherNow } from "./weathercycle";

const RAIN_LINES = 2400;
const FLAKES = 1700;
const CLOUDS = 60;
const CLOUD_PUFFS = 5;
const CLOUD_HEIGHT = 58;
/** the share of the sky a map with its own clouds keeps even in clear weather */
const MAP_CLOUDS = 0.27;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const FLAKE_LOOK: Record<"snow" | "sand", { color: number; size: number; alpha: number; fall: number; wind: number }> = {
  snow: { color: 0xf4f8fb, size: 0.003, alpha: 0.9, fall: 0.1, wind: 0.05 },
  sand: { color: 0xd9ab6c, size: 0.0036, alpha: 0.78, fall: 0.015, wind: 0.42 },
};

const BOX_SHADER = `
uniform vec3 uCentre;
uniform vec3 uOffset;
uniform float uBox;
vec3 boxed(vec3 seed) {
  return mod(seed * uBox + uOffset, vec3(uBox)) - vec3(uBox * 0.5) + uCentre;
}`;

export class WeatherRenderer {
  readonly group = new THREE.Group();
  fx: WeatherFx = { ...CLEAR_FX };
  now: WeatherNow = { kind: "cerah", strength: 0 };
  /** called once when a new weather starts to show */
  onChange: ((kind: Weather) => void) | null = null;
  private weights;
  private mode;
  private announced: Weather = "cerah";
  private wet = 0;
  private snow = 0;
  private rainAmount = 0;
  private flakeAmount = 0;
  private flakeKind: "snow" | "sand" = "snow";
  private flash = 0;
  private nextBolt = 2;
  private boltLife = 0;
  private fall = 0;
  private drift = 0;
  private seed = 73019;
  private fogNear: number;
  private fogFar: number;
  private c = new THREE.Color();
  private v = new THREE.Vector3();
  private centre = new THREE.Vector3();
  private shared = { uCentre: { value: this.centre }, uBox: { value: 100 } };
  private rain: THREE.LineSegments;
  private rainU = { uOffset: { value: new THREE.Vector3() }, uStreak: { value: new THREE.Vector3() }, uAlpha: { value: 0 } };
  private flakes: THREE.Points;
  private flakeU = { uOffset: { value: new THREE.Vector3() }, uSize: { value: 1 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color() }, uTime: { value: 0 } };
  private clouds: THREE.InstancedMesh;
  private cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0 });
  private cloudCover = 0;
  private bolt: THREE.Mesh;

  constructor(private map: WorldMap, private view: SceneHandles, private terrain: TerrainHandles, mode: string | null) {
    this.mode = parseWeatherMode(mode);
    this.weights = weatherWeights(map.biome, map.def.theme);
    const fog = view.scene.fog as THREE.Fog;
    this.fogNear = fog.near;
    this.fogFar = fog.far;
    this.rain = this.buildRain();
    this.flakes = this.buildFlakes();
    this.clouds = this.buildClouds();
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xeaf2ff, fog: false, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    this.bolt.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(14 * 2 * 3), 3));
    const index: number[] = [];
    for (let i = 0; i < 13; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    this.bolt.geometry.setIndex(index);
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    this.group.add(this.rain, this.flakes, this.clouds, this.bolt);
  }

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private buildRain() {
    const pos = new Float32Array(RAIN_LINES * 6);
    const end = new Float32Array(RAIN_LINES * 2);
    for (let i = 0; i < RAIN_LINES; i++) {
      const x = this.rnd();
      const y = this.rnd();
      const z = this.rnd();
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { ...this.shared, ...this.rainU },
      vertexShader: `${BOX_SHADER}
attribute float aEnd;
uniform vec3 uStreak;
varying float vEnd;
void main() {
  vEnd = aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(boxed(position) + uStreak * aEnd, 1.0);
}`,
      fragmentShader: `uniform float uAlpha;
varying float vEnd;
void main() {
  gl_FragColor = vec4(0.78, 0.86, 0.95, uAlpha * (0.25 + 0.75 * vEnd));
  #include <colorspace_fragment>
}`,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 6;
    return lines;
  }

  private buildFlakes() {
    const pos = new Float32Array(FLAKES * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = this.rnd();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { ...this.shared, ...this.flakeU },
      vertexShader: `${BOX_SHADER}
uniform float uSize;
uniform float uTime;
void main() {
  vec3 p = boxed(position);
  float k = position.x * 40.0 + position.z * 17.0;
  p.xz += vec2(sin(uTime * 0.9 + k), cos(uTime * 0.7 + k)) * uBox * 0.006;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.6, uSize * (0.6 + fract(k) * 0.8) / -mv.z);
}`,
      fragmentShader: `uniform float uAlpha;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, uAlpha * smoothstep(0.5, 0.2, d));
  #include <colorspace_fragment>
}`,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 6;
    return points;
  }

  /** Flat-bottomed clusters of puffs. High ground comes first, so light cover gathers on the peaks. */
  private buildClouds() {
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.cloudMat, CLOUDS * CLOUD_PUFFS);
    mesh.frustumCulled = false;
    mesh.name = "clouds";
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    for (let c = 0; c < CLOUDS; c++) {
      let x = 0;
      let z = 0;
      const wantHigh = c < 16;
      for (let t = 0; t < 60; t++) {
        x = (this.rnd() - 0.5) * WORLD_W * 0.94;
        z = (this.rnd() - 0.5) * WORLD_H * 0.94;
        const b = this.map.biomeAt(x, z);
        if (wantHigh ? b === "mountain" || (t > 30 && b !== "water") : t > 4 || b !== "water") break;
      }
      const y = CLOUD_HEIGHT + this.rnd() * 12;
      const size = 4.5 + this.rnd() * (wantHigh ? 4.5 : 8);
      for (let p = 0; p < CLOUD_PUFFS; p++) {
        const a = (p / CLOUD_PUFFS) * Math.PI * 2 + c;
        const r = p ? size * (0.8 + this.rnd() * 0.5) : 0;
        const k = size * (p ? 0.62 + this.rnd() * 0.3 : 1.15);
        q.setFromEuler(e.set(0, this.rnd() * 6.28, 0));
        m.compose(this.v.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r * 0.7), q, s.set(k * 1.25, k * 0.5, k));
        mesh.setMatrixAt(c * CLOUD_PUFFS + p, m);
      }
    }
    mesh.count = 0;
    return mesh;
  }

  private current(phase: Phase, phaseT: number, round: RoundTimes, roundId: number): WeatherNow {
    if (this.mode === "off") return { kind: "cerah", strength: 0 };
    if (this.mode !== "auto") return { kind: this.mode, strength: 1 };
    return weatherAt(roundId, roundClock(phase, phaseT, round), phase, this.weights, round.lobbySeconds);
  }

  /** Lightning: a jagged ribbon from the cloud base to the ground, turned toward the camera. */
  private strike(focus: THREE.Vector3, box: number) {
    const x = focus.x + (this.rnd() - 0.5) * box * 0.8;
    const z = focus.z + (this.rnd() - 0.5) * box * 0.8;
    const ground = Math.max(0, this.map.heightAt(x, z));
    const top = ground + 95;
    const cam = this.view.camera.position;
    const dx = cam.z - z;
    const dz = x - cam.x;
    const len = Math.hypot(dx, dz) || 1;
    const width = Math.max(0.5, box * 0.0028);
    const attr = this.bolt.geometry.getAttribute("position") as THREE.BufferAttribute;
    let px = x + (this.rnd() - 0.5) * 18;
    let pz = z + (this.rnd() - 0.5) * 18;
    for (let i = 0; i < 14; i++) {
      const k = i / 13;
      px += (x - px) * (k * 0.5) + (this.rnd() - 0.5) * 7 * (1 - k);
      pz += (z - pz) * (k * 0.5) + (this.rnd() - 0.5) * 7 * (1 - k);
      const y = top + (ground - top) * k;
      const w = width * (1.2 - k * 0.7);
      attr.setXYZ(i * 2, px + (dx / len) * w, y, pz + (dz / len) * w);
      attr.setXYZ(i * 2 + 1, px - (dx / len) * w, y, pz - (dz / len) * w);
    }
    attr.needsUpdate = true;
    this.boltLife = 0.2;
    this.flash = 1;
  }

  /** Call once a frame, before the atmosphere. */
  update(phase: Phase, phaseT: number, round: RoundTimes, roundId: number, t: number, dt: number, focus: THREE.Vector3, night: number) {
    const now = (this.now = this.current(phase, phaseT, round, roundId));
    const look = lookAt(now);
    if (now.kind !== this.announced && now.strength > 0.05) {
      this.announced = now.kind;
      this.onChange?.(now.kind);
    } else if (now.strength < 0.02 && this.announced !== "cerah") this.announced = "cerah";

    const cam = this.view.camera;
    const dist = cam.position.distanceTo(focus);
    const box = Math.max(70, Math.min(640, dist * 0.85));
    this.shared.uBox.value = box;
    this.centre.lerpVectors(focus, cam.position, 0.32);

    // what falls here depends on the ground under the view
    const precip: Precip = now.strength > 0 ? precipAt(now.kind, this.map.biomeAt(focus.x, focus.z)) : "none";
    const k = 1 - Math.exp(-dt / 1.5);
    const storm = now.kind === "badai" ? 1 : 0.68;
    this.rainAmount += ((precip === "rain" ? now.strength * storm : 0) - this.rainAmount) * k;
    if (precip === "snow" || precip === "sand") this.flakeKind = precip;
    const flake = FLAKE_LOOK[this.flakeKind];
    this.flakeAmount += ((precip === "snow" || precip === "sand" ? now.strength : 0) - this.flakeAmount) * k;

    // rain: long thin streaks leaning with the wind
    const slant = now.kind === "badai" ? 0.24 : 0.1;
    this.fall = (this.fall + dt * 1.25) % 1;
    this.rainU.uOffset.value.set(this.fall * box * slant, -this.fall * box, 0);
    this.rainU.uStreak.value.set(-slant * box * 0.05, box * 0.05, 0);
    this.rainU.uAlpha.value = this.rainAmount * 0.5;
    this.rain.visible = this.rainAmount > 0.01;

    this.drift = (this.drift + dt) % 3600;
    const u = this.flakeU;
    u.uOffset.value.set(this.drift * box * flake.wind, -this.drift * box * flake.fall, this.drift * box * flake.wind * 0.3);
    u.uTime.value = t;
    u.uAlpha.value = this.flakeAmount * flake.alpha * (1 - night * 0.45);
    u.uSize.value = flake.size * box * this.view.renderer.domElement.height;
    u.uColor.value.set(flake.color);
    this.flakes.visible = this.flakeAmount > 0.01;

    // the ground wets quickly and dries slowly; snow settles and melts more slowly still
    const ease = (from: number, to: number, up: number, down: number) => from + (to - from) * (1 - Math.exp(-dt / (to > from ? up : down)));
    this.wet = ease(this.wet, look.wet, 6, 28);
    this.snow = ease(this.snow, look.snow, 12, 34);
    this.terrain.setWeather(this.wet, this.snow);

    // clouds: a map's own light cover, plus what the weather brings
    const cover = Math.max(look.cover, this.map.def.clouds ? MAP_CLOUDS : 0);
    this.cloudCover += (cover - this.cloudCover) * (1 - Math.exp(-dt / 4));
    // a smaller map needs fewer clouds for the same share of sky
    const density = Math.min(1, (WORLD_W * WORLD_H) / (864 * 648));
    this.clouds.count = Math.round(this.cloudCover * CLOUDS * density) * CLOUD_PUFFS;
    const opacity = (0.62 + 0.26 * look.cover) * smooth(130, 300, dist);
    this.cloudMat.opacity = opacity;
    this.clouds.visible = opacity > 0.01 && this.clouds.count > 0;
    const grey = now.kind === "badai" ? 0.72 : now.kind === "hujan" ? 0.48 : now.kind === "berawan" ? 0.16 : 0;
    this.cloudMat.color.set(0xffffff).lerp(this.c.set(0x4c5564), grey * now.strength).lerp(this.c.set(0x4a5672), night);
    this.clouds.position.set(Math.sin(t * 0.016) * 34, 0, Math.cos(t * 0.011) * 14);

    // lightning
    this.nextBolt -= dt;
    if (now.kind === "badai" && now.strength > 0.55 && this.nextBolt <= 0) {
      this.strike(focus, box);
      this.nextBolt = 4 + this.rnd() * 8;
    }
    this.boltLife -= dt;
    this.bolt.visible = this.boltLife > 0;
    (this.bolt.material as THREE.MeshBasicMaterial).opacity = Math.min(1, this.boltLife / 0.08);
    this.flash *= Math.exp(-dt / 0.14);

    const fog = this.view.scene.fog as THREE.Fog;
    fog.near = this.fogNear + (Math.min(this.fogNear, dist * look.fogNear) - this.fogNear) * look.fog;
    fog.far = this.fogFar + (Math.min(this.fogFar, dist * look.fogFar) - this.fogFar) * look.fog;

    const fx = this.fx;
    fx.sun = look.sun;
    fx.ambient = look.ambient;
    fx.shade = look.shade;
    fx.tint = look.tint;
    fx.tintAmount = look.tintAmount;
    fx.flash = this.flash;
  }
}
