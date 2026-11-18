// Light and sky. During the lobby and the war they follow the time of day (render/daycycle.ts);
// the final and result phases keep their own moods (docs/rencana-visual.md 9.2). Everything blends
// toward its target over a few seconds. The presets depend on the map and live in render/theme.ts.
import * as THREE from "three";
import type { Phase } from "../sim/world";
import { WORLD_SCALE } from "../sim/map";
import { dayBlend, dayClock, nightOf, sunArc, swapPower, swapsLight, type RoundTimes, type TimeMode } from "./daycycle";
import type { SceneHandles } from "./scene";
import { THEME, type Mood } from "./theme";
import { CLEAR_FX, type WeatherFx } from "./weathercycle";

const MOODS: Record<Phase, Mood> = THEME.moods;
/** how dark each phase counts as when it uses its own mood */
const PHASE_NIGHT: Record<Phase, number> = { LOBBY: 0, WAR: 0, FINAL: 0.2, RESULT: 0.75 };

export class Atmosphere {
  /** sun position relative to the focus point; main.ts adds the focus */
  readonly sunOffset = new THREE.Vector3();
  /** 0 by day, 1 at full night; lamplight, fireflies and the stars follow it */
  night = 0;
  private sky: THREE.Mesh;
  private top = new THREE.Color();
  private horizon = new THREE.Color();
  private disc = new THREE.Color();
  private discDir = new THREE.Vector3(0, 1, 0);
  private stars = { value: 0 };
  private flash = { value: 0 };
  /** ambient light before lightning is added */
  private ambient = -1;
  private c3 = new THREE.Color();
  private c = new THREE.Color();
  private c2 = new THREE.Color();
  private v = new THREE.Vector3();
  private started = false;

  constructor(private view: SceneHandles, private cloud: { value: number }, private mode: TimeMode = "auto") {
    // sky dome: horizon colour (same as the fog) rising to a deeper tone overhead, with the sun or
    // moon on it and stars that come out at night
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: this.top },
        horizon: { value: this.horizon },
        disc: { value: this.disc },
        discDir: { value: this.discDir },
        stars: this.stars,
        flash: this.flash,
      },
      vertexShader: "varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 top;
uniform vec3 horizon;
uniform vec3 disc;
uniform vec3 discDir;
uniform float stars;
uniform float flash;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(horizon, top, smoothstep(0.0, 0.5, d.y));
  float a = max(dot(d, discDir), 0.0);
  col += disc * (smoothstep(0.9988, 0.9993, a) + 0.22 * pow(a, 160.0));
  if (stars > 0.01) {
    float h = fract(sin(dot(floor(d * 170.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9965, 1.0, h) * smoothstep(0.02, 0.2, d.y) * stars;
  }
  col += vec3(0.7, 0.76, 0.9) * flash;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400 * WORLD_SCALE, 20, 10), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    view.scene.add(this.sky);
  }

  /** Blend toward the time of day or the mood of `phase`. Call every frame. */
  update(phase: Phase, phaseT: number, round: RoundTimes, dt: number, weather: WeatherFx = CLEAR_FX) {
    let a = MOODS[phase];
    let b = a;
    let mix = 0;
    let lightMix = 0;
    let power = 1;
    let night = PHASE_NIGHT[phase];
    let arc: [number, number, number] | null = null;
    if (this.mode !== "auto" && this.mode !== "off") {
      a = b = THEME.day[this.mode];
      night = this.mode === "malam" ? 1 : 0;
    } else if (this.mode === "auto") {
      const clock = dayClock(phase, phaseT, round);
      if (clock !== null) {
        const blend = dayBlend(clock);
        a = THEME.day[blend.from];
        b = THEME.day[blend.to];
        mix = lightMix = blend.k;
        night = nightOf(blend);
        arc = sunArc(clock);
        if (swapsLight(blend)) {
          // the light fades out, moves while nothing shows it, and fades back in
          lightMix = blend.k < 0.5 ? 0 : 1;
          power = swapPower(blend.k);
        }
      }
    }
    const num = (x: number, y: number, m = mix) => x + (y - x) * m;
    const col = (x: number, y: number, m = mix) => this.c.set(x).lerp(this.c2.set(y), m);

    const k = this.started ? 1 - Math.exp(-dt / 2) : 1;
    this.started = true;
    const { sun, hemi, rim, scene, renderer, camera } = this.view;
    sun.color.lerp(col(a.sun, b.sun, lightMix), k);
    sun.intensity += (num(a.sunPower, b.sunPower, lightMix) * power * weather.sun - sun.intensity) * k;
    if (arc) this.v.set(arc[0], arc[1], arc[2]);
    else this.v.set(num(a.sunFrom[0], b.sunFrom[0], lightMix), num(a.sunFrom[1], b.sunFrom[1], lightMix), num(a.sunFrom[2], b.sunFrom[2], lightMix));
    this.sunOffset.lerp(this.v, k);
    hemi.color.lerp(col(a.skyLight, b.skyLight), k);
    hemi.groundColor.lerp(col(a.groundLight, b.groundLight), k);
    const ambient = num(a.ambient, b.ambient) * weather.ambient;
    this.ambient = this.ambient < 0 ? ambient : this.ambient + (ambient - this.ambient) * k;
    hemi.intensity = this.ambient + weather.flash * 1.15;
    rim.intensity += (num(a.rim, b.rim) - rim.intensity) * k;
    // weather greys the air; at night that haze is dark as well
    this.c3.set(weather.tint).multiplyScalar(1 - 0.82 * this.night);
    this.horizon.lerp(col(a.fog, b.fog).lerp(this.c3, weather.tintAmount), k);
    this.top.lerp(col(a.skyTop, b.skyTop).lerp(this.c3, weather.tintAmount * 0.85), k);
    this.flash.value = weather.flash;
    if (scene.fog) scene.fog.color.copy(this.horizon).lerp(this.c.set(0xdde6f5), weather.flash * 0.4);
    if (scene.background instanceof THREE.Color) scene.background.copy(this.horizon);
    this.cloud.value += (Math.min(0.75, num(a.cloud, b.cloud) + weather.shade) - this.cloud.value) * k;
    renderer.toneMappingExposure += (num(a.exposure, b.exposure) - renderer.toneMappingExposure) * k;
    this.night += (night - this.night) * k;
    this.stars.value = this.night;
    this.discDir.copy(this.sunOffset).normalize();
    this.disc.copy(sun.color).multiplyScalar(Math.min(1, sun.intensity));
    this.sky.position.copy(camera.position);
  }

  /** Studio and other fixed-light views switch the sky off. */
  setVisible(on: boolean) {
    this.sky.visible = on;
  }
}
