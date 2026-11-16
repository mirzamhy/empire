// Mood per round phase (docs/rencana-visual.md 9.2): sun colour and direction, sky gradient, fog
// and cloud shadows blend toward the preset of the current phase over a few seconds.
//   LOBBY  = morning, low sun from the east, pale golden haze
//   WAR    = midday, clear and neutral (best readability)
//   FINAL  = late afternoon, low orange sun from the west
//   RESULT = dusk, violet and dark
import * as THREE from "three";
import type { Phase } from "../sim/world";
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
  LOBBY: { sun: 0xffe2b0, sunPower: 1.25, sunFrom: [190, 150, 70], skyLight: 0xffeed8, groundLight: 0x4a5540, ambient: 0.9, rim: 0.3, fog: 0x9fbfc4, skyTop: 0x4f8fb5, cloud: 0.2, exposure: 1.0 },
  WAR: { sun: 0xfff1d6, sunPower: 1.4, sunFrom: [110, 220, 95], skyLight: 0xfff4dc, groundLight: 0x3a4a3f, ambient: 0.95, rim: 0.3, fog: 0x6fa6ba, skyTop: 0x2f6fa5, cloud: 0.22, exposure: 1.0 },
  FINAL: { sun: 0xff9b5a, sunPower: 1.45, sunFrom: [-200, 120, 60], skyLight: 0xffc9a0, groundLight: 0x3b2f45, ambient: 0.8, rim: 0.4, fog: 0xc58a6e, skyTop: 0x5a4a8f, cloud: 0.3, exposure: 1.05 },
  RESULT: { sun: 0xc58cff, sunPower: 0.85, sunFrom: [-90, 150, -130], skyLight: 0x8f8fd0, groundLight: 0x1f1a33, ambient: 0.75, rim: 0.5, fog: 0x2f2850, skyTop: 0x14102e, cloud: 0.1, exposure: 1.0 },
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
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 20, 10), mat);
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
