// Model contract and rig checks (docs/rencana-visual.md 3.3). The prototype builder paints a few
// canvas textures, so a minimal canvas stub stands in for the DOM before it is imported.
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { UNIT_TYPES, type UnitType } from "../game/src/sim/config";
import type { UnitModel } from "../game/src/render/units/contract";

const ctx = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true });
(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  getElementById: () => null,
};

let rig: typeof import("../game/src/render/units/rig");
let contract: typeof import("../game/src/render/units/contract");
let anims: typeof import("../game/src/render/units/anims");
let animator: typeof import("../game/src/render/units/animator");

beforeAll(async () => {
  rig = await import("../game/src/render/units/rig");
  contract = await import("../game/src/render/units/contract");
  anims = await import("../game/src/render/units/anims");
  animator = await import("../game/src/render/units/animator");
});

/** Known gaps in the prototype models, fixed when the Fable models replace them. */
const PROTOTYPE_EXCEPTIONS: Partial<Record<UnitType, string[]>> = {
  cavalry: ["feet"],
};

const model = (t: UnitType): UnitModel => rig.prototypeModel(t, "#ff00ff", "#e8e2d0");

describe("model contract (prototype adapter)", () => {
  it.each(UNIT_TYPES)("%s passes the contract", (t) => {
    const allowed = PROTOTYPE_EXCEPTIONS[t] ?? [];
    const issues = contract.validateModel(model(t)).filter((i) => !allowed.some((a) => i.startsWith(a)));
    expect(issues).toEqual([]);
  });

  it.each(UNIT_TYPES)("%s bakes every mesh exactly once, parents first, no NaN", (t) => {
    const m = model(t);
    const baked = rig.bakeModel(t, m);
    expect(baked.tris).toBe(contract.countTris(m.root));
    baked.bones.forEach((b, i) => {
      expect(b.parent).toBeLessThan(i);
      if (b.geometry) expect(Array.from(b.geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    });
    const tint = baked.bones.some((b) => b.geometry && Array.from(b.geometry.getAttribute("tint").array).some((v) => v > 0.5));
    expect(tint).toBe(true);
  });

  it.each(UNIT_TYPES)("%s rest pose: chained bone matrices reproduce the model", (t) => {
    const m = model(t);
    const baked = rig.bakeModel(t, m);
    m.root.updateMatrixWorld(true);
    const world: THREE.Matrix4[] = [new THREE.Matrix4()];
    for (let i = 1; i < baked.bones.length; i++) world.push(new THREE.Matrix4().multiplyMatrices(world[baked.bones[i].parent], baked.bones[i].rest));
    for (const [name, obj] of Object.entries(m.bones)) {
      const i = baked.boneIndex[name as keyof typeof baked.boneIndex]!;
      const a = world[i].elements;
      const b = obj!.matrixWorld.elements;
      for (let k = 0; k < 16; k++) expect(a[k]).toBeCloseTo(b[k], 4);
    }
  });

  it("sockets land on the right bones", () => {
    const d = rig.bakeModel("dragon", model("dragon"));
    expect(d.sockets.mouth?.bone).toBe(d.boneIndex.head);
    const s = rig.bakeModel("spearman", model("spearman"));
    expect(s.sockets.weaponTip?.bone).toBe(s.boneIndex.weapon);
    // the spear tip is far from the grip
    expect(s.sockets.weaponTip!.pos.length()).toBeGreaterThan(1);
    const w = rig.bakeModel("wizard", model("wizard"));
    expect(w.sockets.muzzle).toBeDefined();
  });
});

// Every file in models/ (except the helpers) is a model file: it must export build() and pass the
// contract at all three tiers. Dropping a new Fable file into the folder is enough to get it tested.
const files = (import.meta as unknown as { glob: (p: string, o: object) => Record<string, { build?: import("../game/src/render/units/contract").ModelBuilder }> }).glob(
  "../game/src/render/units/models/*.ts",
  { eager: true },
);
const modelFiles = Object.entries(files).filter(([p]) => !/\/(index|kit)\.ts$/.test(p));

describe("model files in models/", () => {
  it("has the reference model", () => {
    expect(modelFiles.some(([p]) => p.endsWith("/_reference.ts"))).toBe(true);
  });

  describe.each(modelFiles)("%s", (_path, mod) => {
    const opts = (tier: 1 | 2 | 3) => ({ tier, tint: "#ff00ff", crest: "#e8e2d0" });

    it("exports build()", () => {
      expect(typeof mod.build).toBe("function");
    });

    it.each([1, 2, 3] as const)("tier %i passes the contract and bakes cleanly", (tier) => {
      const m = mod.build!(opts(tier));
      expect(contract.validateModel(m)).toEqual([]);
      const baked = rig.bakeModel("spearman", m);
      expect(baked.tris).toBe(contract.countTris(m.root));
      baked.bones.forEach((b, i) => expect(b.parent).toBeLessThan(i));
      for (const [name, s] of Object.entries(baked.sockets)) {
        expect(Number.isFinite(s.pos.x + s.pos.y + s.pos.z), `socket ${name}`).toBe(true);
      }
      // every bone the model declares ends up in the baked skeleton
      for (const name of Object.keys(m.bones)) expect(baked.boneIndex[name as keyof typeof baked.boneIndex], `bone ${name}`).toBeDefined();
    });

    it("is deterministic (same input, same vertices)", () => {
      const sig = () => {
        const m = mod.build!(opts(2));
        const baked = rig.bakeModel("spearman", m);
        let h = 0;
        for (const b of baked.bones) if (b.geometry) for (const v of b.geometry.getAttribute("position").array) h = (h * 31 + Math.round(v * 1000)) | 0;
        return h;
      };
      expect(sig()).toBe(sig());
    });

    it("higher tiers do not shrink the model or change the skeleton", () => {
      const a = mod.build!(opts(1));
      const c = mod.build!(opts(3));
      expect(Object.keys(c.bones).sort()).toEqual(Object.keys(a.bones).sort());
      expect(c.meta.tris).toBeGreaterThanOrEqual(a.meta.tris);
      expect(Math.abs(c.meta.height - a.meta.height)).toBeLessThan(a.meta.height * 0.35);
    });
  });
});

describe("animation clips", () => {
  it("sine walk keys follow a sine within 0.03 rad", () => {
    const clip = anims.CLIPS.humanoid.walk!;
    const out = new Float32Array(3);
    for (let i = 0; i < 40; i++) {
      const t = (clip.length * i) / 40 + clip.length * 3; // also checks looping
      anims.sampleKeys(clip.tracks.legR!.rot, t, true, clip.length, out, 0);
      expect(Math.abs(out[0] - 0.48 * Math.sin((2 * Math.PI * t) / clip.length))).toBeLessThan(0.03);
    }
  });

  it("one-shot clips clamp at both ends", () => {
    const clip = anims.CLIPS.humanoid.attack!;
    const out = new Float32Array(3);
    anims.sampleKeys(clip.tracks.armR!.rot, -1, false, clip.length, out, 0);
    expect(out[0]).toBeCloseTo(-1.7, 3);
    anims.sampleKeys(clip.tracks.armR!.rot, 5, false, clip.length, out, 0);
    expect(out[0]).toBeCloseTo(0.2, 2);
  });

  it("the animator walks, stands and swings", () => {
    const baked = rig.bakeModel("spearman", model("spearman"));
    const a = new animator.Animator();
    const pose = new Float32Array(baked.bones.length * animator.POSE_STRIDE);
    const u = { id: 1, moving: false, attackAt: -9 } as Parameters<typeof a.pose>[1];
    const arm = baked.boneIndex.armR! * animator.POSE_STRIDE;
    a.pose(baked, u, 10, 10, pose);
    expect(a.stateOf(1)).toBe("idle");
    expect(pose[arm]).toBeCloseTo(-0.32, 3);
    u.attackAt = 10;
    a.pose(baked, u, 10, 10, pose);
    expect(a.stateOf(1)).toBe("attack");
    expect(pose[arm]).toBeCloseTo(-1.7, 3);
    u.attackAt = -9;
    u.moving = true;
    for (let i = 0; i < 30; i++) a.pose(baked, u, 10 + i / 60, 10, pose);
    expect(a.stateOf(1)).toBe("walk");
  });
});
