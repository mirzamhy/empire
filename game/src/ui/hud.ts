// HUD overlay: clock, leaderboard, radar, dragon bar, toasts, ticker, castle labels, podium.
import * as THREE from "three";
import "./hud.css";
import { SPELL_COLOR, SPELL_ICON, SPELL_LABEL, UNIT_ICON, type UnitBundle, type UnitType } from "../sim/config";
import { WORLD_H, WORLD_W, type WorldMap } from "../sim/map";
import { THEME } from "../render/theme";
import { BOSS_NAME, LIKE_BOSSES, type BossAct, type BossKind, type Kingdom, type Sim, type SimEvent } from "../sim/world";
import { describeUnits } from "../live/router";

interface BossLook {
  icon: string;
  /** main colour (frame, glow) and the bar's gradient from empty to full */
  color: string;
  bar: [string, string, string];
  how: string;
  reward: string;
}
const BOSS_LOOK: Record<BossKind, BossLook> = {
  dragon: { icon: "🐉", color: "#ff7a3d", bar: ["#ff3d1f", "#ff7a2a", "#ffb02e"], how: "ketik BOSS untuk menyerbu", reward: "" },
  elder: { icon: "🐲", color: "#ff3b1f", bar: ["#6b0f0f", "#ff3b1f", "#ffb02e"], how: "ia memburu kerajaan terkuat · ketik BOSS", reward: "2 Naga + 1 level bergabung ke pasukannya" },
  titan: { icon: "🗿", color: "#ff8a2a", bar: ["#3a2a20", "#ff5a14", "#ffd36a"], how: "tap layar = lempar batu! · 90 dtk sebelum ia mengamuk", reward: "2 Golem + 1 level untuk penyerang terbesar" },
  bone: { icon: "💀", color: "#45f5a8", bar: ["#0b2a1f", "#1fbf7a", "#c8ffe6"], how: "napasnya menyembuhkan dirinya · tap layar = lempar batu!", reward: "12 Skeleton + 2 Necromancer + 1 level" },
  yeti: { icon: "❄️", color: "#7fdcff", bar: ["#1a3550", "#5ac8ff", "#e8f8ff"], how: "lemparan esnya membekukan pasukan · tap layar = lempar batu!", reward: "6 Halberdier + 2 Shieldbearer + 1 level" },
  kraken: { icon: "🐙", color: "#38f2d6", bar: ["#24133a", "#7a3ad8", "#38f2d6"], how: "ia menyeret pasukan di pantai · tap layar = lempar batu!", reward: "4 Griffin + 1 level" },
  treant: { icon: "🌳", color: "#a8ff4a", bar: ["#2c1f15", "#4e7a2a", "#c6ff5a"], how: "akarnya menahan pasukan, di hutan ia pulih · tap layar!", reward: "4 Paladin + 1 level" },
  worm: { icon: "🪱", color: "#f0b45a", bar: ["#4a3018", "#c49a5e", "#ffd36a"], how: "serang saat ia muncul ke permukaan · tap layar!", reward: "2 Gajah + 1 level" },
};

/** What a boss move is called on screen: a big toast for the dangerous ones, a ticker line for the rest. */
const BOSS_MOVE: Partial<Record<BossAct, { text: string; sub: string; big?: boolean }>> = {
  rampage: { text: "AMUKAN TERAKHIR!", sub: "kastil terkuat dihantam sebelum ia pergi", big: true },
  spikes: { text: "TOMBAK TULANG!", sub: "duri tulang mencuat di bawah kastil" },
  wail: { text: "JERITAN ARWAH!", sub: "pasukan di sekitarnya membeku ketakutan", big: true },
  throw: { text: "BONGKAH ES!", sub: "yang kena membeku" },
  blizzard: { text: "BADAI SALJU!", sub: "pasukan di dekatnya melambat dan kedinginan", big: true },
  grab: { text: "DISERET KE LAUT!", sub: "tentakel menyambar pasukan di pantai" },
  waveCall: { text: "GELOMBANG PASANG!", sub: "dinding air menghantam pantai", big: true },
  dive: { text: "KRAKEN MENYELAM…", sub: "ia akan muncul di dekat kerajaan terkuat" },
  roots: { text: "AKAR BELENGGU!", sub: "akar menjalar ke kastil dan menahan pasukan" },
  bloom: { text: "MEKAR PURBA!", sub: "Treant pulih, spora berduri menyebar", big: true },
  burrow: { text: "CACING MENGGALI…", sub: "awas, tanah di bawah pasukan bergetar" },
  erupt: { text: "TELAN!", sub: "Cacing Pasir menyembur dari bawah tanah", big: true },
};

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
  private boss = el("div", "boss", `<div class="lbl">🐉 NAGA DUNIA</div><div class="hp"><i></i><b></b></div><div class="sub"></div><div class="top"></div>`);
  private toasts = el("div", "toasts");
  private ticker = el("div", "ticker");
  private hint = el("div", "hint", "Ketik <b>IKUT</b> untuk punya kerajaan!");
  private center = el("div", "center");
  private doom = el("div", "doom");
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
    this.root.append(this.labels, top, this.board, radarBox, this.boss, this.toasts, this.ticker, this.hint, this.center, this.doom);
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
      case "spell":
        if (k) this.toast(`${SPELL_ICON[e.spell]} ${SPELL_LABEL[e.spell]}`, `${e.from} · ${k.name}`, SPELL_COLOR[e.spell]);
        break;
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
        const b = BOSS_LOOK[e.kind];
        if (e.state === "spawn") this.toast(`${b.icon} ${BOSS_NAME[e.kind].toUpperCase()} MUNCUL!`, by ? `dipanggil oleh ${by.name} · ${b.how}` : b.how, b.color);
        else if (e.state === "leave") this.toast(`${b.icon} ${BOSS_NAME[e.kind]} mengamuk lalu pergi`, "tidak ada yang berhasil menumbangkannya", b.color);
        else if (e.kind === "dragon") this.toast(by ? `🐉 ${by.name} menjinakkan Naga!` : "🐉 Naga Dunia tumbang", by ? "Naga bergabung ke pasukannya" : "", by?.color ?? b.color);
        else this.toast(by ? `${b.icon} ${by.name} menumbangkan ${BOSS_NAME[e.kind]}!` : `${b.icon} ${BOSS_NAME[e.kind]} tumbang`, by ? b.reward : "", by?.color ?? b.color);
        this.boss.querySelector(".lbl")!.textContent = `${b.icon} ${BOSS_NAME[e.kind].toUpperCase()}`;
        break;
      }
      case "boss": {
        const mv = BOSS_MOVE[e.act];
        if (!mv) break;
        const b = BOSS_LOOK[e.kind];
        // a move repeated within a few seconds (the Kraken grabs several troops at once) is told once
        const key = `${e.kind}:${e.act}`;
        if (s.t - (this.moveSaid.get(key) ?? -99) < 4) break;
        this.moveSaid.set(key, s.t);
        if (mv.big) this.toast(`${b.icon} ${mv.text}`, mv.sub, b.color);
        else this.tick(`${b.icon} ${BOSS_NAME[e.kind]}: ${mv.text} · ${mv.sub}`, b.color);
        break;
      }
      case "doom": {
        const target = e.target ? s.kingdomById(e.target) : null;
        this.doomUntil = this.sim.t + e.seconds;
        this.doomStart = this.sim.t + e.warn;
        this.doomTarget = target?.name ?? "";
        this.toast("☄️ HUJAN METEOR DUNIA!", target ? `Meteor Induk mengincar ${target.name}` : "langit terbakar", "#ff5a1a");
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
    this.renderBoss();
    this.renderDoom();
    this.hint.style.display = s.phase === "RESULT" ? "none" : "";
    this.renderCenter();
    this.renderLabels();
  }

  private moveSaid = new Map<string, number>();
  private bossTop = "";
  /** The boss bar: name, timer, health, what it is doing, and the three kingdoms hurting it most. */
  private renderBoss() {
    const s = this.sim;
    const d = s.dragon;
    this.boss.classList.toggle("show", !!d);
    if (!d) return;
    const b = BOSS_LOOK[d.kind];
    const pct = Math.max(0, (d.hp / d.maxHp) * 100);
    (this.boss.querySelector("i") as HTMLElement).style.width = `${pct}%`;
    const num = this.boss.querySelector(".hp b")!;
    const pctText = `${Math.ceil(pct)}%`;
    if (num.textContent !== pctText) num.textContent = pctText;
    const timed = LIKE_BOSSES.includes(d.kind);
    const secs = Math.max(0, Math.ceil(d.until - s.t));
    const left = timed ? ` · ⏳${secs}` : "";
    const label = `${b.icon} ${BOSS_NAME[d.kind].toUpperCase()}${left}`;
    const lbl = this.boss.querySelector(".lbl")!;
    if (lbl.textContent !== label) lbl.textContent = label;
    if (this.boss.dataset.kind !== d.kind) {
      this.boss.dataset.kind = d.kind;
      this.boss.style.setProperty("--bc", b.color);
      this.boss.style.setProperty("--b1", b.bar[0]);
      this.boss.style.setProperty("--b2", b.bar[1]);
      this.boss.style.setProperty("--b3", b.bar[2]);
    }
    this.boss.classList.toggle("urgent", timed && secs <= 15);
    this.boss.classList.toggle("hidden", d.hidden);
    // what it is doing right now, or how to fight it
    const sub = d.hidden
      ? d.kind === "kraken" ? "🌊 menyelam… pasukan tak bisa menyerang" : d.mode === 2 ? "⚠️ tanah bergetar… menjauh!" : "🏜️ di bawah pasir… menuju kerumunan"
      : d.zone && d.zone.until > s.t
        ? d.kind === "yeti" ? "🌨️ badai salju · pasukan melambat" : d.kind === "treant" ? "🌸 spora berduri · Treant pulih" : "🌪️ badai pasir · serang sekarang!"
        : b.how;
    const subEl = this.boss.querySelector(".sub")!;
    if (subEl.textContent !== sub) subEl.textContent = sub;
    // the three biggest hitters
    const top = [...d.damage.entries()]
      .map(([kid, dmg]) => ({ k: s.kingdomById(kid), dmg }))
      .filter((x) => x.k && x.k.alive)
      .sort((a, b2) => b2.dmg - a.dmg)
      .slice(0, 3);
    const html = top.map((x, i) => `<span style="--kc:${x.k!.color}">${["🥇", "🥈", "🥉"][i]} ${esc(x.k!.name)} <em>${Math.round(x.dmg)}</em></span>`).join("");
    if (html !== this.bossTop) {
      this.bossTop = html;
      this.boss.querySelector(".top")!.innerHTML = html;
    }
  }

  private doomUntil = -1;
  private doomStart = -1;
  private doomTarget = "";
  private doomText = "";
  /** The meteor rain banner: a warning, then the countdown to the mother meteor. */
  private renderDoom() {
    const t = this.sim.t;
    const on = t < this.doomUntil + 1 && this.sim.phase !== "RESULT" && this.sim.phase !== "LOBBY";
    this.doom.classList.toggle("show", on);
    if (!on) return;
    const left = Math.max(0, Math.ceil(this.doomUntil - t));
    const html =
      t < this.doomStart
        ? `<div class="big">☄️ HUJAN METEOR DUNIA</div><div class="sub">langit terbakar dalam ${Math.ceil(this.doomStart - t)}…</div>`
        : left > 0
          ? `<div class="big">☄️ METEOR INDUK</div><div class="sub">jatuh${this.doomTarget ? ` di <b>${esc(this.doomTarget)}</b>` : ""} dalam <b>${left}</b> dtk</div>`
          : `<div class="big">💥</div>`;
    if (html !== this.doomText) {
      this.doomText = html;
      this.doom.innerHTML = html;
    }
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
      c.font = s.dragon.kind === "dragon" ? "18px sans-serif" : "26px sans-serif";
      c.textAlign = "center";
      c.fillText(BOSS_LOOK[s.dragon.kind].icon, (s.dragon.x + WORLD_W / 2) * sx, (s.dragon.z + WORLD_H / 2) * sz + 6);
    }
  }

  private radarBase: HTMLCanvasElement | null = null;
  private makeRadarBase(w: number, h: number) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d")!;
    const colors: Record<string, string> = THEME.minimap;
    const step = 2;
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step) {
        c.fillStyle = colors[this.map.biomeAt((x / w) * WORLD_W - WORLD_W / 2, (y / h) * WORLD_H - WORLD_H / 2)];
        c.fillRect(x, y, step, step);
      }
    // rivers as thin blue lines, landmarks as small pale diamonds
    const px = (wx: number) => ((wx + WORLD_W / 2) / WORLD_W) * w;
    const pz = (wz: number) => ((wz + WORLD_H / 2) / WORLD_H) * h;
    c.strokeStyle = "#4f9fc4";
    c.lineJoin = "round";
    for (const r of this.map.rivers) {
      c.lineWidth = Math.max(1.2, (r.points[r.points.length - 1].width / WORLD_W) * w * 1.6);
      c.beginPath();
      r.points.forEach((p, i) => (i ? c.lineTo(px(p.x), pz(p.z)) : c.moveTo(px(p.x), pz(p.z))));
      c.stroke();
    }
    c.fillStyle = "#f3e9c6";
    for (const l of this.map.landmarks) {
      const x = px(l.x);
      const y = pz(l.z);
      c.beginPath();
      c.moveTo(x, y - 3);
      c.lineTo(x + 3, y);
      c.lineTo(x, y + 3);
      c.lineTo(x - 3, y);
      c.fill();
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
