// ?perf overlay: milliseconds per frame stage, draw calls and triangles (plan section 10).
// Stages are timed with performance.now(); "render" is CPU submit time, not GPU time.
import type * as THREE from "three";

export class PerfOverlay {
  private el: HTMLDivElement;
  private sums = new Map<string, number>();
  private frames = 0;
  private marks = new Map<string, number>();
  private last = performance.now();
  private frameMs = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.el = document.createElement("div");
    this.el.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:50;font:12px/1.35 ui-monospace,Consolas,monospace;color:#d6f5d6;" +
      "background:rgba(0,0,0,.72);padding:6px 9px;border-radius:6px;white-space:pre;pointer-events:none";
    document.body.append(this.el);
  }

  begin(stage: string) {
    this.marks.set(stage, performance.now());
  }

  end(stage: string) {
    const t0 = this.marks.get(stage);
    if (t0 === undefined) return;
    this.sums.set(stage, (this.sums.get(stage) ?? 0) + performance.now() - t0);
  }

  /** Call once at the end of a frame; refreshes the text twice a second. */
  frame(extra: Record<string, string | number> = {}) {
    const now = performance.now();
    this.frameMs += now - this.last;
    this.last = now;
    this.frames++;
    if (this.frameMs < 500) return;
    const n = this.frames;
    const info = this.renderer.info.render;
    const lines = [`frame ${(this.frameMs / n).toFixed(1)} ms  (${Math.round((1000 * n) / this.frameMs)} fps)`];
    for (const [k, v] of this.sums) lines.push(`${k.padEnd(8)} ${(v / n).toFixed(2)} ms`);
    lines.push(`calls    ${info.calls}`, `tris     ${(info.triangles / 1000).toFixed(0)}k`);
    for (const [k, v] of Object.entries(extra)) lines.push(`${k.padEnd(8)} ${v}`);
    this.el.textContent = lines.join("\n");
    this.sums.clear();
    this.frames = 0;
    this.frameMs = 0;
  }
}
