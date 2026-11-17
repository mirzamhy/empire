// Living air for maps that ask for it (MapDef.life): mist that lies in valleys and over lakes,
// flocks of birds that scatter from battles, crows over the dead in the final phase, and drifting
// particles near the camera (dust at dawn, leaves in the war, embers and ash at the end, fireflies
// at dusk). All of it is decoration: nothing here is read by the sim. `?atmo=0` switches it off.
import * as THREE from "three";
import { GRID_H, GRID_W, WORLD_H, WORLD_W, type WorldMap } from "../sim/map";
import type { Phase, SimEvent } from "../sim/world";

const GLSL_NOISE = `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- valley mist

/** how thick the mist lies per phase (0..1) */
const MIST: Record<Phase, number> = { LOBBY: 0.36, WAR: 0.12, FINAL: 0.18, RESULT: 0.32 };
/** heights of the two mist sheets; ground above a sheet stands clear of it */
const MIST_TOPS = [6.5, 3.4];
/** the height texture stores -1..12 m in one byte */
const H_MIN = -1;
const H_SPAN = 13;

function buildMist(map: WorldMap, time: { value: number }, density: { value: number }, color: THREE.Color) {
  // Over water the "ground" is the surface near the shore and rises with the distance from land,
  // so mist hangs over lakes and along the coast but the open sea stays clear.
  const offshore = map.bfs((i) => map.biome[i] !== "water", () => true);
  const data = new Uint8Array(GRID_W * GRID_H);
  for (let i = 0; i < data.length; i++) {
    const h = map.biome[i] === "water" ? H_MIN + (Math.min(offshore[i], 9) / 9) * H_SPAN : map.height[i];
    data[i] = Math.round(Math.min(1, Math.max(0, (h - H_MIN) / H_SPAN)) * 255);
  }
  const tex = new THREE.DataTexture(data, GRID_W, GRID_H, THREE.RedFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return MIST_TOPS.map((top, layer) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHeight: { value: tex },
        uTime: time,
        uDensity: density,
        uColor: { value: color },
        uTop: { value: top },
        uSize: { value: new THREE.Vector2(WORLD_W, WORLD_H) },
        uLayer: { value: layer },
      },
      vertexShader: "varying vec2 vXZ;\nvoid main() { vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D uHeight;
uniform float uTime;
uniform float uDensity;
uniform vec3 uColor;
uniform float uTop;
uniform vec2 uSize;
uniform float uLayer;
varying vec2 vXZ;
${GLSL_NOISE}
void main() {
  vec2 uv = vXZ / uSize + 0.5;
  float ground = texture2D(uHeight, clamp(uv, 0.0, 1.0)).r * ${H_SPAN.toFixed(1)} + ${H_MIN.toFixed(1)};
  // how much air lies between the ground and this sheet: none on a hillside, most over a lake
  float depth = clamp((uTop - ground) / uTop, 0.0, 1.0);
  vec2 drift = vec2(uTime * 0.9, uTime * 0.5) * (1.0 + uLayer * 0.6);
  float n = vnoise((vXZ + drift) / 58.0 + uLayer * 31.0) * 0.6 + vnoise((vXZ - drift * 1.7) / 21.0 + uLayer * 7.0) * 0.4;
  float a = smoothstep(0.02, 0.55, depth) * smoothstep(0.3, 0.72, n + depth * 0.22);
  // fade out toward the open sea
  vec2 edge = min(uv, 1.0 - uv);
  a *= smoothstep(-0.04, 0.06, min(edge.x, edge.y));
  gl_FragColor = vec4(uColor, a * uDensity * (0.75 - uLayer * 0.25));
  #include <colorspace_fragment>
}`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 1.2, WORLD_H * 1.2).rotateX(-Math.PI / 2), mat);
    mesh.position.y = top;
    mesh.renderOrder = 2 + layer;
    mesh.name = `mist${layer}`;
    return mesh;
  });
}

// ---------------------------------------------------------------- birds

interface Flock {
  crows: boolean;
  /** centre of the circle the flock flies, and where that centre is heading */
  x: number;
  z: number;
  tx: number;
  tz: number;
  radius: number;
  height: number;
  speed: number;
  first: number;
  count: number;
}

const FLOCKS = 4;
const BIRDS_PER_FLOCK = 11;
const CROWS = 9;

function birdGeometry() {
  // body pointing +Z with two flat wings; the shader lifts the wing tips to flap
  const p = [
    0, 0, 0.55, -0.12, 0, -0.35, 0.12, 0, -0.35, // body
    -0.06, 0.02, 0.2, -1.15, 0.02, -0.1, -0.1, 0.02, -0.25, // left wing
    0.06, 0.02, 0.2, 0.1, 0.02, -0.25, 1.15, 0.02, -0.1, // right wing
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- particles

interface Drift {
  color: number;
  size: number;
  vel: [number, number, number];
  sway: number;
  alpha: number;
  twinkle: number;
  /** height of the layer the particles fill, metres above the ground */
  tall: number;
}
const NONE: Drift = { color: 0xffffff, size: 0.1, vel: [0, 0, 0], sway: 0, alpha: 0, twinkle: 0, tall: 30 };
/** matt particles: dust motes, leaves, ash */
const MATT: Record<Phase, Drift> = {
  LOBBY: { color: 0xfff0c8, size: 0.13, vel: [0.35, 0.12, 0.15], sway: 0.6, alpha: 0.5, twinkle: 0.3, tall: 30 },
  WAR: { color: 0x8c7a3c, size: 0.24, vel: [2.4, -1.2, 0.9], sway: 1.4, alpha: 0.8, twinkle: 0, tall: 30 },
  FINAL: { color: 0x2c2826, size: 0.17, vel: [1.3, -0.55, 0.5], sway: 0.9, alpha: 0.65, twinkle: 0, tall: 30 },
  RESULT: { ...NONE, color: 0xcfc8ff, alpha: 0.18, vel: [0.2, 0.05, 0.1], tall: 30 },
};
/** glowing particles: embers, fireflies */
const GLOW: Record<Phase, Drift> = {
  LOBBY: NONE,
  WAR: NONE,
  FINAL: { color: 0xff7a2a, size: 0.17, vel: [0.9, 1.7, 0.3], sway: 1.0, alpha: 0.95, twinkle: 0.6, tall: 30 },
  RESULT: { color: 0xd4ff6a, size: 0.2, vel: [0.12, 0.03, 0.1], sway: 2.2, alpha: 0.95, twinkle: 1, tall: 7 },
};
const BOX = 130;
const PARTICLES = 520;

class DriftLayer {
  readonly points: THREE.Points;
  private u: Record<string, { value: number | THREE.Vector3 | THREE.Color }>;
  private offset = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private presets: Record<Phase, Drift>, additive: boolean) {
    const seed = new Float32Array(PARTICLES * 3);
    let s = additive ? 977 : 311;
    for (let i = 0; i < seed.length; i++) seed[i] = (s = (s * 16807) % 2147483647) / 2147483647;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(seed, 3));
    this.u = {
      uCentre: { value: new THREE.Vector3() },
      uOffset: { value: this.offset },
      uBox: { value: new THREE.Vector3(BOX, 30, BOX) },
      uColor: { value: new THREE.Color(1, 1, 1) },
      uSize: { value: 0.1 },
      uSway: { value: 0 },
      uAlpha: { value: 0 },
      uTwinkle: { value: 0 },
      uTime: { value: 0 },
      uPixels: { value: 900 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: this.u,
      vertexShader: `uniform vec3 uCentre;
uniform vec3 uOffset;
uniform vec3 uBox;
uniform float uSize;
uniform float uSway;
uniform float uTime;
uniform float uPixels;
varying float vSeed;
void main() {
  vec3 p = position * uBox + uOffset;
  p.x += sin(uTime * 0.7 + position.y * 40.0) * uSway;
  p.z += cos(uTime * 0.5 + position.x * 40.0) * uSway;
  // wrap around the centre, so the cloud follows the camera while each mote stays put in the world
  p = uCentre + mod(p - uCentre + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uSize * uPixels / -mv.z);
  vSeed = position.z;
}`,
      fragmentShader: `uniform vec3 uColor;
uniform float uAlpha;
uniform float uTwinkle;
uniform float uTime;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float blink = mix(1.0, 0.5 + 0.5 * sin(uTime * 2.6 + vSeed * 90.0), uTwinkle);
  gl_FragColor = vec4(uColor, uAlpha * blink * smoothstep(0.5, 0.2, d));
  #include <colorspace_fragment>
}`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  update(phase: Phase, t: number, dt: number, centre: THREE.Vector3, ground: number, fade: number, pixels: number) {
    const d = this.presets[phase];
    const k = 1 - Math.exp(-dt / 1.5);
    const u = this.u;
    (u.uColor.value as THREE.Color).lerp(this.c.set(d.color), k);
    u.uSize.value = (u.uSize.value as number) + (d.size - (u.uSize.value as number)) * k;
    u.uSway.value = (u.uSway.value as number) + (d.sway - (u.uSway.value as number)) * k;
    u.uTwinkle.value = (u.uTwinkle.value as number) + (d.twinkle - (u.uTwinkle.value as number)) * k;
    u.uAlpha.value = (u.uAlpha.value as number) + (d.alpha * fade - (u.uAlpha.value as number)) * Math.max(k, 0.2);
    const box = u.uBox.value as THREE.Vector3;
    box.y += (d.tall - box.y) * k;
    this.vel.lerp(new THREE.Vector3(d.vel[0], d.vel[1], d.vel[2]), k);
    this.offset.addScaledVector(this.vel, dt);
    (u.uCentre.value as THREE.Vector3).set(centre.x, ground + box.y / 2 + 0.3, centre.z);
    u.uTime.value = t;
    u.uPixels.value = pixels;
    this.points.visible = (u.uAlpha.value as number) > 0.01;
  }
}

// ---------------------------------------------------------------- all of it

export class Life {
  readonly group = new THREE.Group();
  private time = { value: 0 };
  private mistDensity = { value: 0 };
  private mistColor = new THREE.Color(0xdfe8e4);
  private birds: THREE.InstancedMesh;
  private flocks: Flock[] = [];
  private matt = new DriftLayer(MATT, false);
  private glow = new DriftLayer(GLOW, true);
  /** where troops have been dying lately; the crows circle it */
  private dead = new THREE.Vector3();
  private deaths = 0;
  private crowShow = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();
  private c = new THREE.Color();
  private seed = 20261117;

  constructor(private map: WorldMap) {
    this.group.add(...buildMist(map, this.time, this.mistDensity, this.mistColor));

    const total = FLOCKS * BIRDS_PER_FLOCK + CROWS;
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  float phase = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
  transformed.y += abs(position.x) * sin(uTime * 9.0 + phase) * 0.55;
#endif`,
      );
    };
    this.birds = new THREE.InstancedMesh(birdGeometry(), mat, total);
    this.birds.frustumCulled = false;
    this.birds.name = "birds";
    for (let f = 0; f < FLOCKS; f++) {
      const p = this.landPoint();
      this.flocks.push({ crows: false, x: p.x, z: p.z, tx: p.x, tz: p.z, radius: 22 + this.rnd() * 22, height: 20 + this.rnd() * 10, speed: 0.28 + this.rnd() * 0.16, first: f * BIRDS_PER_FLOCK, count: BIRDS_PER_FLOCK });
      for (let i = 0; i < BIRDS_PER_FLOCK; i++) this.birds.setColorAt(f * BIRDS_PER_FLOCK + i, this.c.set(f % 2 ? 0x2a2a30 : 0xe8e4da));
    }
    this.flocks.push({ crows: true, x: map.altar.x, z: map.altar.z, tx: map.altar.x, tz: map.altar.z, radius: 13, height: 15, speed: 0.5, first: FLOCKS * BIRDS_PER_FLOCK, count: CROWS });
    for (let i = 0; i < CROWS; i++) this.birds.setColorAt(FLOCKS * BIRDS_PER_FLOCK + i, this.c.set(0x0e0d10));
    this.dead.set(map.altar.x, 0, map.altar.z);
    this.group.add(this.birds, this.matt.points, this.glow.points);
  }

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** A random point over land (forest or meadow), for a flock to circle. */
  private landPoint() {
    for (let t = 0; t < 40; t++) {
      const x = (this.rnd() - 0.5) * WORLD_W * 0.8;
      const z = (this.rnd() - 0.5) * WORLD_H * 0.8;
      const b = this.map.biomeAt(x, z);
      if (b === "forest" || b === "plains" || b === "desert") return { x, z };
    }
    return { x: this.map.altar.x, z: this.map.altar.z };
  }

  onEvent(e: SimEvent) {
    if (e.k !== "death") return;
    this.dead.x += (e.x - this.dead.x) * 0.06;
    this.dead.z += (e.z - this.dead.z) * 0.06;
    this.deaths = Math.min(40, this.deaths + 1);
    // a fight under a flock sends it off to quieter woods
    for (const f of this.flocks) {
      if (f.crows || Math.hypot(f.x - f.tx, f.z - f.tz) > 5) continue;
      if (Math.hypot(e.x - f.x, e.z - f.z) < f.radius + 25 && this.rnd() < 0.25) {
        const p = this.landPoint();
        f.tx = p.x;
        f.tz = p.z;
      }
    }
  }

  /**
   * @param focus point on the ground the camera is looking at
   * @param haze current fog colour (the mist takes a lighter shade of it)
   */
  update(phase: Phase, t: number, dt: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, haze: THREE.Color, viewportHeight: number) {
    this.time.value = t;
    const k = 1 - Math.exp(-dt / 3);
    this.mistDensity.value += (MIST[phase] - this.mistDensity.value) * k;
    this.mistColor.copy(haze).lerp(this.c.set(0xffffff), 0.42);
    this.deaths = Math.max(0, this.deaths - dt * 0.5);

    // crows gather only in the final phase, once enough have fallen
    this.crowShow += ((phase === "FINAL" && this.deaths > 4 ? 1 : 0) - this.crowShow) * (1 - Math.exp(-dt / 2));
    for (const f of this.flocks) {
      if (f.crows) {
        f.tx = this.dead.x;
        f.tz = this.dead.z;
      }
      const dx = f.tx - f.x;
      const dz = f.tz - f.z;
      const dist = Math.hypot(dx, dz);
      const fleeing = dist > 5;
      if (dist > 0.01) {
        const step = Math.min(dist, (f.crows ? 9 : 16) * dt);
        f.x += (dx / dist) * step;
        f.z += (dz / dist) * step;
      }
      const ground = Math.max(0, this.map.heightAt(f.x, f.z));
      const show = f.crows ? this.crowShow : 1;
      for (let i = 0; i < f.count; i++) {
        const a = t * f.speed * (f.crows ? -1 : 1) + (i / f.count) * Math.PI * 2 + Math.sin(i * 12.9) * 0.5;
        const r = f.radius * (0.55 + 0.45 * Math.abs(Math.sin(i * 7.3))) * (fleeing ? 0.5 : 1);
        const y = ground + f.height + Math.sin(t * 0.6 + i * 2.1) * 2.4 + (i % 3) * 1.6;
        this.v.set(f.x + Math.cos(a) * r, y, f.z + Math.sin(a) * r);
        // heading: along the circle, or along the escape route while fleeing
        const dir = f.crows ? -1 : 1;
        const hx = fleeing ? dx / dist : -Math.sin(a) * dir;
        const hz = fleeing ? dz / dist : Math.cos(a) * dir;
        this.e.set(0, Math.atan2(hx, hz), fleeing ? 0 : -0.35 * dir, "YXZ");
        this.q.setFromEuler(this.e);
        const size = (f.crows ? 1.15 : 0.95) * show;
        this.m.compose(this.v, this.q, this.s.set(size, size, size));
        this.birds.setMatrixAt(f.first + i, this.m);
      }
    }
    this.birds.instanceMatrix.needsUpdate = true;
    if (this.birds.instanceColor) this.birds.instanceColor.needsUpdate = true;

    // particles: only worth drawing when the camera is close to the ground it looks at
    const ground = Math.max(0, this.map.heightAt(focus.x, focus.z));
    const fade = 1 - smooth(110, 240, camera.position.distanceTo(focus));
    const pixels = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.matt.update(phase, t, dt, focus, ground, fade, pixels);
    this.glow.update(phase, t, dt, focus, ground, fade, pixels);
  }
}
