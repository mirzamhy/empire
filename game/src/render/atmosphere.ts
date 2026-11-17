// Mood per round phase (docs/rencana-visual.md 9.2): sun colour and direction, sky gradient, fog
// and cloud shadows blend toward the preset of the current phase over a few seconds.
// The world is a dark, wooded continent, so every mood is a shade darker and cooler than daylight:
// the ground stays deep green and the kingdom colours of troops and castles stand out against it.
//   LOBBY  = misty dawn, low sun from the east
//   WAR    = overcast noon under heavy cloud (the sun still gives shape to units and peaks)
//   FINAL  = low red sun from the west, long shadows
//   RESULT = dusk, violet and dark
import * as THREE from "three";
import type { Phase } from "../sim/world";
import { WORLD_SCALE } from "../sim/map";
import type { SceneHandles } from "./scene";

interface Mood {
  sun: number;
  sunPower: number;
  /** where the sun stands relative to the camera focus */
  sunFrom: [number, number, number];
  skyLight: number;
  groundLight: number;
  ambient: number;
  rim: number;
  fog: number;
  skyTop: number;
  cloud: number;
  exposure: number;
}

const MOODS: Record<Phase, Mood> = {
  LOBBY: { sun: 0xffd6a0, sunPower: 1.1, sunFrom: [190, 130, 70], skyLight: 0xd9e2d2, groundLight: 0x2c3a30, ambient: 0.68, rim: 0.3, fog: 0x6f8c88, skyTop: 0x35596c, cloud: 0.3, exposure: 0.96 },
  WAR: { sun: 0xf4ead6, sunPower: 1.25, sunFrom: [120, 200, 95], skyLight: 0xcddacd, groundLight: 0x26342c, ambient: 0.7, rim: 0.32, fog: 0x4a6a6e, skyTop: 0x27485c, cloud: 0.38, exposure: 0.96 },
  FINAL: { sun: 0xff8648, sunPower: 1.35, sunFrom: [-200, 110, 60], skyLight: 0xdfa684, groundLight: 0x2c2236, ambient: 0.58, rim: 0.4, fog: 0x86564a, skyTop: 0x372c5e, cloud: 0.36, exposure: 1.0 },
  RESULT: { sun: 0xb58cf0, sunPower: 0.8, sunFrom: [-90, 150, -130], skyLight: 0x8080c0, groundLight: 0x18142a, ambient: 0.62, rim: 0.5, fog: 0x231f3e, skyTop: 0x0f0c24, cloud: 0.1, exposure: 0.98 },
};

export class Atmosphere {
  /** sun position relative to the focus point; main.ts adds the focus */
  readonly sunOffset = new THREE.Vector3();
  private sky: THREE.Mesh;
  private top = new THREE.Color();
  private horizon = new THREE.Color();
  private c = new THREE.Color();
  private v = new THREE.Vector3();
  private started = false;

  constructor(private view: SceneHandles, private cloud: { value: number }) {
    // sky dome: horizon colour (same as the fog) rising to a deeper tone overhead
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: this.top }, horizon: { value: this.horizon } },
      vertexShader: "varying vec3 vDir;\nvoid main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform vec3 top;\nuniform vec3 horizon;\nvarying vec3 vDir;\nvoid main() {\n  float h = normalize(vDir).y;\n  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.5, h)), 1.0);\n  #include <colorspace_fragment>\n}",
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400 * WORLD_SCALE, 20, 10), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    view.scene.add(this.sky);
  }

  /** Blend toward the mood of `phase`. Call every frame. */
  update(phase: Phase, dt: number) {
    const m = MOODS[phase];
    const k = this.started ? 1 - Math.exp(-dt / 2) : 1;
    this.started = true;
    const { sun, hemi, rim, scene, renderer, camera } = this.view;
    sun.color.lerp(this.c.set(m.sun), k);
    sun.intensity += (m.sunPower - sun.intensity) * k;
    this.sunOffset.lerp(this.v.set(m.sunFrom[0], m.sunFrom[1], m.sunFrom[2]), k);
    hemi.color.lerp(this.c.set(m.skyLight), k);
    hemi.groundColor.lerp(this.c.set(m.groundLight), k);
    hemi.intensity += (m.ambient - hemi.intensity) * k;
    rim.intensity += (m.rim - rim.intensity) * k;
    this.horizon.lerp(this.c.set(m.fog), k);
    this.top.lerp(this.c.set(m.skyTop), k);
    if (scene.fog) scene.fog.color.copy(this.horizon);
    if (scene.background instanceof THREE.Color) scene.background.copy(this.horizon);
    this.cloud.value += (m.cloud - this.cloud.value) * k;
    renderer.toneMappingExposure += (m.exposure - renderer.toneMappingExposure) * k;
    this.sky.position.copy(camera.position);
  }

  /** Studio and other fixed-light views switch the sky off. */
  setVisible(on: boolean) {
    this.sky.visible = on;
  }
}
