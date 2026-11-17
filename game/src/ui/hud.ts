// HUD overlay: clock, leaderboard, radar, dragon bar, toasts, ticker, castle labels, podium.
import * as THREE from "three";
import "./hud.css";
import { UNIT_ICON, type UnitBundle, type UnitType } from "../sim/config";
import { WORLD_H, WORLD_W, type WorldMap } from "../sim/map";
import type { Kingdom, Sim, SimEvent } from "../sim/world";
import { describeUnits } from "../live/router";

const el = (tag: string, cls = "", html = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const PHASE_ID: Record<string, string> = { LOBBY: "LOBI", WAR: "PERANG", FINAL: "PERANG AKHIR", RESULT: "HASIL" };

/** Rough strength of a bundle, used to decide toast vs small float. */
export function bundlePower(b: UnitBundle, hp: Record<UnitType, { hp: number }>) {
  return (Object.entries(b) as [UnitType, number][]).reduce((a, [t, n]) => a + hp[t].hp * n, 0);
}

export class Hud {
  readonly root = el("div");
  private clock = el("span", "clock");
  private phase = el("span", "phase");
  private live = el("span", "live", "DEMO");
  private board = el("div", "bar board");
  private radar = document.createElement("canvas");
  private boss = el("div", "boss", `<div class="lbl">🐉 NAGA DUNIA</div><div class="hp"><i></i></div>`);
  private toasts = el("div", "toasts");
  private ticker = el("div", "ticker");
  private hint = el("div", "hint", "Ketik <b>IKUT</b> untuk punya kerajaan!");
  private center = el("div", "center");
  private labels = el("div");
  private labelEls = new Map<number, HTMLElement>();
  private v = new THREE.Vector3();
  private lastBoard = 0;

  constructor(
    private sim: Sim,
    private map: WorldMap,
    private camera: THREE.Camera,
  ) {
    this.root.id = "hud";
    this.labels.id = "labels";
    const top = el("div", "top");
    const title = el("div", "bar title");
    title.append(el("span", "brand", "EMPIRE"), this.clock, this.phase);
    top.append(title, this.live);
    this.radar.width = 300;
    this.radar.height = 225;
    const radarBox = el("div", "bar radar");
    radarBox.append(this.radar);
    this.root.append(this.labels, top, this.board, radarBox, this.boss, this.toasts, this.ticker, this.hint, this.center);
    document.body.append(this.root);
  }

  setLive(state: string) {
    this.live.textContent = state === "LIVE_CONNECTED" ? "● LIVE" : state === "DEMO" ? "DEMO" : state === "RECONNECTING" ? "MENYAMBUNG…" : "OFFLINE";
    this.live.classList.toggle("on", state === "LIVE_CONNECTED");
  }

  toast(text: string, sub = "", color = "#f2c14e") {
    const t = el("div", "toast", `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}`);
    t.style.setProperty("--c", color);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => t.remove(), 3400);
  }

  tick(text: string, color = "#f2c14e") {
    const t = el("div", "tick", esc(text));
    t.style.setProperty("--c", color);
    this.ticker.append(t);
    while (this.ticker.children.length > 5) this.ticker.firstElementChild!.remove();
  }

  floatAt(x: number, z: number, text: string, color: string) {
    const f = el("div", "float", esc(text));
    f.style.color = color;
    f.dataset.x = String(x);
    f.dataset.z = String(z);
    this.labels.append(f);
    this.place(f, x, this.map.heightAt(x, z) + 6, z);
    setTimeout(() => f.remove(), 3000);
  }

  onEvent(e: SimEvent) {
    const s = this.sim;
    const k = "kid" in e ? s.kingdomById(e.kid) : null;
    switch (e.k) {
      case "join":
        if (k) this.tick(`🏰 ${k.name} mendirikan kerajaan!`, k.color);
        break;
      case "troops": {
        if (!k) break;
        const desc = describeUnits(e.units);
        if (!desc) break;
        const power = bundlePower(e.units, s.cfg.unitTypes);
        const src = e.reason === "like" ? "like" : e.reason === "share" ? "share" : e.reason === "follow" ? "follow" : e.reason;
        if (power >= 600 && e.reason !== "like") this.toast(`${e.from} · ${src}`, desc, k.color);
        else if (e.reason !== "like") this.tick(`🎁 ${e.from} ${src}: ${desc}`, k.color);
        this.floatAt(k.x, k.z, desc.split(" ").slice(0, 3).join(" "), k.color);
        break;
      }
      case "fall": {
        const by = e.by ? s.kingdomById(e.by) : null;
        if (k) this.toast(by ? `⚔️ ${by.name} menghancurkan ${k.name}!` : `💥 Kerajaan ${k.name} runtuh`, "ketik IKUT lagi setelah 60 dtk", by?.color ?? k.color);
        break;
      }
      case "tower": {
        const v = s.village(e.id);
        const tk = s.kingdomById(e.kid);
        if (tk && v) {
          this.tick(`🗼 ${tk.name} membangun menara jaga di Desa ${v.name}`, tk.color);
          this.floatAt(v.x, v.z, "🗼 Menara", tk.color);
        }
        break;
      }
      case "village": {
        const v = s.village(e.id);
        const prev = e.prev ? s.kingdomById(e.prev) : null;
        if (k && v) {
          this.tick(prev ? `🏘️ ${k.name} merebut Desa ${v.name} dari ${prev.name}!` : `🏘️ ${k.name} menguasai Desa ${v.name}`, k.color);
          this.floatAt(v.x, v.z, `🚩 ${v.name}`, k.color);
        }
        break;
      }
      case "level":
        if (k) {
          this.tick(`⬆️ ${k.name} naik ke Level ${e.level}`, k.color);
          this.floatAt(k.x, k.z, `Lv ${e.level}!`, "#f2c14e");
        }
        break;
      case "dragon": {
        const by = e.by ? s.kingdomById(e.by) : null;
        if (e.state === "spawn") this.toast("🐉 NAGA DUNIA MUNCUL!", by ? `dipanggil oleh ${by.name} · ketik BOSS untuk menyerbu` : "ketik BOSS untuk menyerbu", "#ff7a3d");
        else this.toast(by ? `🐉 ${by.name} menjinakkan Naga!` : "🐉 Naga Dunia tumbang", by ? "Naga bergabung ke pasukannya" : "", by?.color ?? "#ff7a3d");
        break;
      }
      case "phase":
        if (e.phase === "WAR") this.toast("⚔️ PERANG DIMULAI", "perisai turun · semua kerajaan bertempur", "#e5484d");
        if (e.phase === "FINAL") this.toast("🔥 PERANG AKHIR", "produksi pasukan ×2", "#ff7a3d");
        break;
      case "ticker":
        this.tick(e.text, e.color);
        break;
    }
  }

  update(time: number) {
    const s = this.sim;
    this.clock.textContent = fmt(s.secondsLeft());
    this.phase.textContent = `R${s.roundId} · ${PHASE_ID[s.phase]}`;
    if (time - this.lastBoard > 0.5) {
      this.lastBoard = time;
      this.renderBoard();
      this.renderRadar();
    }
    const d = s.dragon;
    this.boss.classList.toggle("show", !!d);
    if (d) (this.boss.querySelector("i") as HTMLElement).style.width = `${Math.max(0, (d.hp / d.maxHp) * 100)}%`;
    this.hint.style.display = s.phase === "RESULT" ? "none" : "";
    this.renderCenter();
    this.renderLabels();
  }

  private renderBoard() {
    const top = this.sim.leaderboard().slice(0, 5);
    this.board.innerHTML =
      `<h3>🏆 KLASEMEN</h3>` +
      (top.length
        ? top.map((k, i) => `<div class="row"><span class="rank">${i + 1}</span><span class="dot" style="background:${k.color}"></span><span class="name">${esc(k.name)}</span><span class="meta">Lv${k.level} · ${k.unitCount}⚔${k.villages ? ` · ${k.villages}🏘` : ""}</span></div>`).join("")
        : `<div class="row"><span class="name" style="color:var(--mute)">belum ada kerajaan</span></div>`);
  }

  private renderRadar() {
    const c = this.radar.getContext("2d")!;
    const w = this.radar.width;
    const h = this.radar.height;
    const sx = w / WORLD_W;
    const sz = h / WORLD_H;
    if (!this.radarBase) this.radarBase = this.makeRadarBase(w, h);
    c.drawImage(this.radarBase, 0, 0);
    const s = this.sim;
    const tw = s.tilesW;
    const tile = s.cfg.territory.tile;
    const colors = new Map(s.kingdoms.map((k) => [k.id, k.color]));
    c.globalAlpha = 0.5;
    for (let i = 0; i < s.tileOwner.length; i++) {
      const o = s.tileOwner[i];
      if (!o) continue;
      c.fillStyle = colors.get(o) ?? "#fff";
      c.fillRect((i % tw) * tile * sx, Math.floor(i / tw) * tile * sz, tile * sx + 0.5, tile * sz + 0.5);
    }
    c.globalAlpha = 1;
    for (const v of s.villages) {
      const owner = v.owner ? s.kingdomById(v.owner) : null;
      c.fillStyle = owner?.color ?? "#f4f1ea";
      c.strokeStyle = "#1a1a1a";
      c.lineWidth = 1;
      const x = (v.x + WORLD_W / 2) * sx;
      const y = (v.z + WORLD_H / 2) * sz;
      c.fillRect(x - 2.5, y - 2.5, 5, 5);
      c.strokeRect(x - 2.5, y - 2.5, 5, 5);
    }
    for (const k of s.alive) {
      c.fillStyle = k.color;
      c.strokeStyle = "#fff";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc((k.x + WORLD_W / 2) * sx, (k.z + WORLD_H / 2) * sz, 3 + k.level * 0.4, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    if (s.dragon) {
      c.font = "18px sans-serif";
      c.textAlign = "center";
      c.fillText("🐉", (s.dragon.x + WORLD_W / 2) * sx, (s.dragon.z + WORLD_H / 2) * sz + 6);
    }
  }

  private radarBase: HTMLCanvasElement | null = null;
  private makeRadarBase(w: number, h: number) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d")!;
    const colors: Record<string, string> = { water: "#143845", beach: "#a89a7c", plains: "#768c4a", desert: "#86744a", forest: "#2f5a2a", mountain: "#7a7268" };
    const step = 2;
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        c.fillStyle = colors[this.map.biomeAt((x / w) * WORLD_W - WORLD_W / 2, (y / h) * WORLD_H - WORLD_H / 2)];
        c.fillRect(x, y, step, step);
      }
    return cv;
  }

  private centerKey = "";
  private renderCenter() {
    const s = this.sim;
    let key = "";
    let html = "";
    if (s.phase === "LOBBY") {
      key = `lobby${s.secondsLeft()}${s.alive.length}`;
      html = `<div class="big">LOBI</div><div class="sub">Ketik <b>IKUT</b> · perang mulai ${fmt(s.secondsLeft())}<br>${s.alive.length} kerajaan siap</div>`;
    } else if (s.phase === "RESULT") {
      key = `result${s.roundId}`;
      const [p1, p2, p3] = s.podium;
      const card = (p: (typeof s.podium)[number] | undefined, cls: string, medal: string) =>
        p ? `<div class="${cls}" style="--c:${p.color}"><b>${medal}</b>${esc(p.name)}<br><span style="color:var(--mute)">${p.score}</span></div>` : "";
      html = `<div class="big">👑 ${p1 ? esc(p1.name) : "-"}</div><div class="sub">pemenang ronde ${s.roundId}</div><div class="podium">${card(p2, "p2", "🥈")}${card(p1, "p1", "🥇")}${card(p3, "p3", "🥉")}</div>`;
    }
    if (key !== this.centerKey) {
      this.centerKey = key;
      this.center.innerHTML = html;
      this.center.classList.toggle("show", !!html);
    }
  }

  private place(e: HTMLElement, x: number, y: number, z: number) {
    this.v.set(x, y, z).project(this.camera);
    const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
    e.style.display = visible ? "" : "none";
    if (!visible) return null;
    const px = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    e.style.left = `${px}px`;
    e.style.top = `${py}px`;
    return { px, py };
  }

  private renderLabels() {
    const s = this.sim;
    const leader = s.leaderboard()[0];
    const alive = new Set<number>();
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const order = [...s.alive].sort((a, b) => b.level - a.level || b.score - a.score);
    for (const k of order) {
      alive.add(k.id);
      let e = this.labelEls.get(k.id);
      if (!e) {
        e = el("div", "clabel", `<div class="n"><em></em><span></span></div><div class="hp"><i></i></div>`);
        e.style.setProperty("--c", k.color);
        this.labels.append(e);
        this.labelEls.set(k.id, e);
      }
      this.updateLabel(e, k, k === leader);
      const p = this.place(e, k.x, this.map.heightAt(k.x, k.z) + 5.5 + k.level * 0.35, k.z);
      if (!p) continue;
      const w = e.offsetWidth || 120;
      const h = e.offsetHeight || 30;
      const box = { x0: p.px - w / 2, x1: p.px + w / 2, y0: p.py - h, y1: p.py };
      if (placed.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) e.style.display = "none";
      else placed.push(box);
    }
    for (const [id, e] of this.labelEls) if (!alive.has(id)) {
      e.remove();
      this.labelEls.delete(id);
    }
    for (const f of this.labels.querySelectorAll<HTMLElement>(".float")) {
      const x = Number(f.dataset.x);
      const z = Number(f.dataset.z);
      this.place(f, x, this.map.heightAt(x, z) + 6, z);
    }
  }

  private updateLabel(e: HTMLElement, k: Kingdom, lead: boolean) {
    const lv = e.querySelector("em")!;
    const nm = e.querySelector("span")!;
    const lvText = `${lead ? "👑 " : ""}Lv${k.level}`;
    if (lv.textContent !== lvText) lv.textContent = lvText;
    if (nm.textContent !== k.name) nm.textContent = k.name;
    (e.querySelector(".hp i") as HTMLElement).style.width = `${Math.max(0, (k.hp / k.maxHp) * 100)}%`;
    e.classList.toggle("lead", lead);
  }
}

export { UNIT_ICON };
