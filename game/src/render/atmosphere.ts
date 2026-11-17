// Mood per round phase (docs/rencana-visual.md 9.2): sun colour and direction, sky gradient, fog
// and cloud shadows blend toward the preset of the current phase over a few seconds.
// The presets themselves depend on the map and live in render/theme.ts.
import * as THREE from "three";
import type { Phase } from "../sim/world";
import { WORLD_SCALE } from "../sim/map";
import type { SceneHandles } from "./scene";
import { THEME, type Mood } from "./theme";

const MOODS: Record<Phase, Mood> = THEME.moods;

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
