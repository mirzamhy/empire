// Bridge pipeline: dedupe, streak handling, kill switch, buffering while the game is offline.
// Gameplay rules (which gift gives which troops) live in the game, not here.
import { randomUUID } from "node:crypto";
import {
  SCHEMA_VERSION,
  type CommandAck,
  type ControlCommand,
  type ControlOp,
  type GameCommand,
  type GameStatusMessage,
  type LiveCommand,
  type LiveLabel,
  type NormalizedLiveEvent,
  type OverlayCommand,
} from "../../shared/contract";
import { Deduper } from "./dedupe";
import { log } from "./log";

export interface PipelineOptions {
  dedupeWindowMs: number;
  /** events waiting for the game longer than this are dropped */
  bufferTtlMs: number;
  bufferMax: number;
}

export const DEFAULT_PIPELINE: PipelineOptions = { dedupeWindowMs: 15000, bufferTtlMs: 45000, bufferMax: 300 };

export interface RecentEntry {
  at: string;
  kind: string;
  source: string;
  user: string;
  detail: string;
  result: string;
}

export class Pipeline {
  private dedupe: Deduper;
  private buffer: { cmd: LiveCommand; at: number }[] = [];
  killSwitch = false;
  liveLabel: LiveLabel = "DEMO";
  gameStatus: GameStatusMessage | null = null;
  counts = { received: 0, forwarded: 0, duplicate: 0, streakPartial: 0, killed: 0, dropped: 0 };
  recent: RecentEntry[] = [];

  constructor(
    private opt: PipelineOptions,
    private send: (cmd: GameCommand) => boolean,
    private now: () => number = Date.now,
  ) {
    this.dedupe = new Deduper(opt.dedupeWindowMs);
  }

  private note(e: NormalizedLiveEvent, result: string) {
    const detail =
      e.kind === "gift" ? `${e.gift!.giftName} x${e.gift!.repeatCount} (${e.gift!.providerValue ?? "?"})` : e.kind === "chat" ? e.chat!.text : e.kind === "like" ? `${e.like!.count} like` : e.kind;
    this.recent.unshift({ at: new Date(this.now()).toISOString(), kind: e.kind, source: e.source, user: e.user.username, detail, result });
    if (this.recent.length > 60) this.recent.length = 60;
  }

  ingest(e: NormalizedLiveEvent) {
    this.counts.received++;
    if (this.killSwitch && e.source !== "mock") {
      this.counts.killed++;
      return this.note(e, "kill_switch");
    }
    if (e.kind === "gift" && !e.gift!.repeatFinal) {
      // Streak updates: only the final event counts, or the gift would be paid several times.
      this.counts.streakPartial++;
      return;
    }
    if (!this.dedupe.check(e.eventId, this.now())) {
      this.counts.duplicate++;
      return this.note(e, "duplicate");
    }
    const cmd: LiveCommand = { schemaVersion: SCHEMA_VERSION, commandId: randomUUID(), type: "game.live", event: e };
    if (this.send(cmd)) {
      this.counts.forwarded++;
      if (e.kind !== "like") this.note(e, "sent");
    } else {
      this.buffer.push({ cmd, at: this.now() });
      if (this.buffer.length > this.opt.bufferMax) {
        this.buffer.shift();
        this.counts.dropped++;
      }
      this.note(e, "buffered");
    }
  }

  /** Flush buffered events once the game is back. Called on a timer. */
  tick(gameConnected: boolean) {
    const now = this.now();
    while (this.buffer.length && now - this.buffer[0].at > this.opt.bufferTtlMs) {
      this.buffer.shift();
      this.counts.dropped++;
    }
    if (!gameConnected) return;
    while (this.buffer.length) {
      const { cmd } = this.buffer[0];
      if (!this.send(cmd)) break;
      this.buffer.shift();
      this.counts.forwarded++;
    }
  }

  onAck(a: CommandAck) {
    if (a.status === "rejected") log("warn", "game rejected command", { component: "pipeline", commandId: a.commandId, reason: a.reason });
  }

  setKillSwitch(on: boolean) {
    this.killSwitch = on;
    log("warn", `kill switch ${on ? "ON" : "OFF"}`, { component: "pipeline" });
  }

  control(op: ControlOp, target?: string): ControlCommand {
    const c: ControlCommand = { schemaVersion: SCHEMA_VERSION, commandId: randomUUID(), type: "game.control", op };
    if (target) c.target = target;
    return c;
  }

  overlay(): OverlayCommand {
    return { schemaVersion: SCHEMA_VERSION, commandId: randomUUID(), type: "game.overlay", liveState: this.liveLabel };
  }

  snapshot() {
    return { killSwitch: this.killSwitch, buffered: this.buffer.length, counts: this.counts, recent: this.recent.slice(0, 30), game: this.gameStatus };
  }
}
