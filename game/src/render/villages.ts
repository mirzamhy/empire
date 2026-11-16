// Villages: a few low-poly houses around a flag. The flag takes the owner's colour, a second flag
// climbs the pole in the attacker's colour while the village is being taken, and the capture
// zone shows as a ring on the ground.
import * as THREE from "three";
import type { WorldMap } from "../sim/map";
import type { Sim, Village } from "../sim/world";

const lam = (color: number) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const WALLS = [0xe9dcc0, 0xd8c7a3, 0xf2eadb, 0xcbb894].map(lam);
const ROOFS = [0x9c4a2f, 0x7a5232, 0xb2643a, 0x6b3f2a].map(lam);
const WOOD = lam(0x6b4a2a);
const STONE = lam(0x8d8a83);
const NEUTRAL = new THREE.Color(0xf4f1ea);

interface VillageView {
  group: THREE.Group;
  flag: THREE.Mesh;
  claim: THREE.Mesh;
  ring: THREE.Mesh;
  /** watchtower built by engineers; scaled up while under construction */
  tower: THREE.Group;
  owner: number;
}

export class VillageRenderer {
  readonly group = new THREE.Group();
  private views = new Map<number, VillageView>();
  private c = new THREE.Color();

  constructor(
    private map: WorldMap,
    private onPlaced: (x: number, z: number) => void,
  ) {}

  private build(v: Village, radius: number): VillageView {
    const g = new THREE.Group();
    const ground = this.map.heightAt(v.x, v.z);
    g.position.set(v.x, ground, v.z);
    // deterministic layout from the village id
    let seed = v.id * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const houses = 4 + (v.id % 3);
    for (let i = 0; i < houses; i++) {
      const a = (i / houses) * Math.PI * 2 + rnd() * 0.5;
      const r = 3 + rnd() * 1.6;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const w = 1.3 + rnd() * 0.6;
      const d = 1.1 + rnd() * 0.5;
      const h = 0.9 + rnd() * 0.4;
      const house = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), WALLS[i % WALLS.length]);
      body.position.y = h / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 0.8, 4), ROOFS[(i + v.id) % ROOFS.length]);
      roof.position.y = h + 0.4;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.05), WOOD);
      door.position.set(0, 0.25, d / 2 + 0.01);
      house.add(body, roof, door);
      house.position.set(x, this.map.heightAt(v.x + x, v.z + z) - ground, z);
      house.rotation.y = -a + Math.PI / 2;
      for (const m of [body, roof]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      g.add(house);
    }
    // well and flag pole in the middle
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.5, 8), STONE);
    well.position.set(1.2, 0.25, -0.6);
    g.add(well);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6), WOOD);
    pole.position.y = 2.1;
    pole.castShadow = true;
    g.add(pole);
    const flagGeo = new THREE.BoxGeometry(1.3, 0.8, 0.05);
    flagGeo.translate(0.68, 0, 0);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: NEUTRAL, flatShading: true }));
    flag.position.y = 3.75;
    const claim = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    claim.visible = false;
    g.add(flag, claim);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.35, radius, 40),
      new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    // watchtower: stone base, wooden platform, pointed roof
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 3.2, 6), STONE);
    base.position.y = 1.6;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.0, 0.5, 6), WOOD);
    deck.position.y = 3.4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.3, 6), ROOFS[v.id % ROOFS.length]);
    roof.position.y = 4.9;
    for (let i = 0; i < 6; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), WOOD);
      post.position.set(Math.cos((i * Math.PI) / 3) * 1.0, 3.95, Math.sin((i * Math.PI) / 3) * 1.0);
      tower.add(post);
    }
    tower.add(base, deck, roof);
    tower.traverse((o) => (o.castShadow = true));
    tower.position.set(-1.6, 0, 1.4);
    tower.visible = false;
    g.add(tower);
    this.onPlaced(v.x, v.z);
    return { group: g, flag, claim, ring, tower, owner: -1 };
  }

  update(sim: Sim, time: number) {
    const radius = sim.cfg.villages.radius;
    const cap = sim.cfg.villages.captureSeconds;
    for (const v of sim.villages) {
      let view = this.views.get(v.id);
      if (!view) {
        view = this.build(v, radius);
        this.views.set(v.id, view);
        this.group.add(view.group);
      }
      if (view.owner !== v.owner) {
        view.owner = v.owner;
        const k = v.owner ? sim.kingdomById(v.owner) : null;
        this.c.set(k ? k.color : NEUTRAL);
        (view.flag.material as THREE.MeshLambertMaterial).color.copy(this.c);
        (view.ring.material as THREE.MeshBasicMaterial).color.copy(this.c);
        (view.ring.material as THREE.MeshBasicMaterial).opacity = k ? 0.8 : 0.5;
      }
      const built = v.tower ? 1 : Math.min(1, v.build / sim.cfg.villages.towerBuildSeconds);
      view.tower.visible = built > 0.02;
      view.tower.scale.set(1, Math.max(0.05, built), 1);
      const wave = Math.sin(time * 3 + v.id) * 0.25;
      view.flag.rotation.y = wave;
      // attacker's flag climbs the pole as the capture progresses
      const taking = v.claimKid && v.progress > 0 ? sim.kingdomById(v.claimKid) : null;
      view.claim.visible = !!taking;
      if (taking) {
        (view.claim.material as THREE.MeshLambertMaterial).color.set(taking.color);
        view.claim.position.y = 0.6 + Math.min(1, v.progress / cap) * 2.6;
        view.claim.rotation.y = -wave;
        view.ring.scale.setScalar(1 + Math.sin(time * 10) * 0.03);
      } else view.ring.scale.setScalar(1);
    }
  }
}
