// Castle mesh per kingdom level, adapted from the prototype's buildCastle3D.
import * as THREE from "three";

const lam = (color: number | string) => new THREE.MeshLambertMaterial({ color, flatShading: true });

export function buildCastle(level: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const wall = lam(level >= 5 ? 0xb4bcc8 : 0x7b8494);
  const roof = lam(color);
  const gold = lam(0xfacc15);
  const scale = 1 + Math.min(level, 10) * 0.07;
  g.scale.setScalar(scale);

  const claim = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.9, 24), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  claim.rotation.x = -Math.PI / 2;
  claim.position.y = 0.08;
  g.add(claim);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.35, 12), lam(0x5a5048));
  base.position.y = 0.17;
  g.add(base);

  const keepH = 1.8 + level * 0.16;
  const keep = new THREE.Mesh(new THREE.BoxGeometry(1.8, keepH, 1.8), wall);
  keep.position.y = 0.35 + keepH / 2;
  keep.castShadow = true;
  g.add(keep);

  const top = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.2, 4), roof);
  top.position.y = 0.35 + keepH + 0.6;
  top.rotation.y = Math.PI / 4;
  g.add(top);

  const gate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.1), lam(0x3b2a1e));
  gate.position.set(0, 0.75, 0.92);
  g.add(gate);

  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  banner.position.set(0.3, 0.35 + keepH + 1.55, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), lam(0x3b2a1e));
  pole.position.set(0, 0.35 + keepH + 1.3, 0);
  banner.userData.banner = true;
  g.add(pole, banner);

  if (level >= 2) {
    for (const [tx, tz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 2.2, 8), wall);
      tower.position.set(tx, 1.1 + 0.35, tz);
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 8), level >= 6 ? gold : roof);
      tRoof.position.set(tx, 2.95, tz);
      g.add(tower, tRoof);
    }
  }
  if (level >= 10) {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 4, 8), gold);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 0.35 + keepH + 1.6;
    g.add(crown);
  }
  return g;
}

/** Transparent dome shown while a new kingdom is protected. */
export function buildShield(color: string) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  );
  return m;
}
