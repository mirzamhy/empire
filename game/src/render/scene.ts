// Renderer, camera and lights. Portrait 1080x1920 is the target, any size works.
import * as THREE from "three";

export interface SceneHandles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  resize(): void;
}

export function createScene(container: HTMLElement): SceneHandles {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x163d4d);
  scene.fog = new THREE.Fog(0x163d4d, 420, 950);

  const camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.5, 1600);
  camera.position.set(0, 400, 290);
  camera.lookAt(0, 0, 0);

  const hemi = new THREE.HemisphereLight(0xfff4dc, 0x3a4a3f, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
  sun.position.set(110, 220, 95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera as THREE.OrthographicCamera;
  s.left = -160;
  s.right = 160;
  s.top = 130;
  s.bottom = -130;
  s.near = 10;
  s.far = 520;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x93c5fd, 0.3);
  rim.position.set(-60, 50, -60);
  scene.add(rim);

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();
  return { renderer, scene, camera, sun, hemi, rim, resize };
}
