// Event contract shared by the live bridge and the game.
// The bridge only transports and cleans live events. All gameplay rules live in the game.

export const SCHEMA_VERSION = 1 as const;

export type LiveSourceName = "mock" | "tiktok-live-connector";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "degraded" | "error";
export type LiveKind = "gift" | "chat" | "like" | "follow" | "share";
export const LIVE_KINDS: readonly LiveKind[] = ["gift", "chat", "like", "follow", "share"];

export interface LiveUser {
  /** @handle, used as the stable kingdom key */
  username: string;
  /** nickname shown on screen when short enough */
  displayName: string;
  userId: string | null;
}

export interface NormalizedLiveEvent {
  schemaVersion: typeof SCHEMA_VERSION;
  eventId: string;
  source: LiveSourceName;
  kind: LiveKind;
  receivedAt: string;
  user: LiveUser;
  gift?: {
    giftId: string | null;
    giftName: string;
    repeatCount: number;
    repeatFinal: boolean;
    /** Coin value reported by the provider (diamondCount). Not an official TikTok value. */
    providerValue: number | null;
  };
  chat?: { text: string };
  like?: { count: number };
}

export type ControlOp = "pause" | "resume" | "reset_round" | "next_phase" | "extend_round" | "safe_mode_on" | "safe_mode_off" | "kick";
export const CONTROL_OPS: readonly ControlOp[] = ["pause", "resume", "reset_round", "next_phase", "extend_round", "safe_mode_on", "safe_mode_off", "kick"];

export interface LiveCommand {
  schemaVersion: typeof SCHEMA_VERSION;
  commandId: string;
  type: "game.live";
  event: NormalizedLiveEvent;
}

export interface ControlCommand {
  schemaVersion: typeof SCHEMA_VERSION;
  commandId: string;
  type: "game.control";
  op: ControlOp;
  /** username for kick */
  target?: string;
}

export type LiveLabel = "DEMO" | "LIVE_CONNECTED" | "RECONNECTING" | "OFFLINE";

export interface OverlayCommand {
  schemaVersion: typeof SCHEMA_VERSION;
  commandId: string;
  type: "game.overlay";
  liveState: LiveLabel;
}

export type GameCommand = LiveCommand | ControlCommand | OverlayCommand;

/** Game -> bridge: what happened to a live command. */
export interface CommandAck {
  schemaVersion: typeof SCHEMA_VERSION;
  type: "game.ack";
  commandId: string;
  status: "applied" | "ignored" | "rejected";
  reason: string | null;
}

export interface GameStatusMessage {
  schemaVersion: typeof SCHEMA_VERSION;
  type: "game.status";
  roundId: number;
  phase: string;
  secondsLeft: number;
  paused: boolean;
  safeMode: boolean;
  fps: number;
  kingdoms: number;
  units: number;
  joinQueue: number;
  leader: string | null;
}

export const MAX_NAME_LEN = 20;
export const MAX_CHAT_LEN = 80;

/** Strip control chars, markup and bidi overrides; collapse whitespace; truncate by code point. */
export function sanitizeText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  const cleaned = input
    .normalize("NFC")
    .replace(/[\t\n\r]/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[<>`"\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(cleaned);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : cleaned;
}

export function sanitizeName(input: unknown): string {
  return sanitizeText(input, MAX_NAME_LEN) || "anon";
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 128): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;

/** Validate and clean a live event. Returns null when the shape is wrong. */
export function validateLiveEvent(raw: unknown): NormalizedLiveEvent | null {
  if (!isObj(raw) || raw.schemaVersion !== SCHEMA_VERSION) return null;
  if (!isStr(raw.eventId, 160)) return null;
  if (raw.source !== "mock" && raw.source !== "tiktok-live-connector") return null;
  if (typeof raw.kind !== "string" || !(LIVE_KINDS as readonly string[]).includes(raw.kind)) return null;
  if (!isObj(raw.user)) return null;
  const u = raw.user;
  const ev: NormalizedLiveEvent = {
    schemaVersion: SCHEMA_VERSION,
    eventId: raw.eventId,
    source: raw.source,
    kind: raw.kind as LiveKind,
    receivedAt: isStr(raw.receivedAt, 40) ? raw.receivedAt : new Date().toISOString(),
    user: {
      username: sanitizeName(u.username).toLowerCase(),
      displayName: sanitizeName(u.displayName ?? u.username),
      userId: isStr(u.userId, 40) ? u.userId : null,
    },
  };
  if (ev.kind === "gift") {
    if (!isObj(raw.gift)) return null;
    const g = raw.gift;
    ev.gift = {
      giftId: isStr(g.giftId, 40) ? g.giftId : null,
      giftName: sanitizeText(g.giftName, 40) || "unknown",
      repeatCount: Math.round(num(g.repeatCount, 1, 9999, 1)),
      repeatFinal: g.repeatFinal !== false,
      providerValue: typeof g.providerValue === "number" ? num(g.providerValue, 0, 1e6, 0) : null,
    };
  } else if (ev.kind === "chat") {
    if (!isObj(raw.chat)) return null;
    ev.chat = { text: sanitizeText(raw.chat.text, MAX_CHAT_LEN) };
  } else if (ev.kind === "like") {
    ev.like = { count: Math.round(num(isObj(raw.like) ? raw.like.count : 1, 1, 10000, 1)) };
  }
  return ev;
}

export type ValidationResult = { ok: true; cmd: GameCommand } | { ok: false; reason: string };

/** Validate an untrusted command coming over the socket. Pure; no side effects. */
export function validateCommand(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, reason: "not_object" };
  if (raw.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: "schema_version" };
  if (!isStr(raw.commandId, 80)) return { ok: false, reason: "command_id" };
  switch (raw.type) {
    case "game.live": {
      const event = validateLiveEvent(raw.event);
      if (!event) return { ok: false, reason: "event" };
      return { ok: true, cmd: { schemaVersion: SCHEMA_VERSION, commandId: raw.commandId, type: "game.live", event } };
    }
    case "game.control": {
      if (typeof raw.op !== "string" || !(CONTROL_OPS as readonly string[]).includes(raw.op)) return { ok: false, reason: "control_op" };
      const op = raw.op as ControlOp;
      const cmd: ControlCommand = { schemaVersion: SCHEMA_VERSION, commandId: raw.commandId, type: "game.control", op };
      if (op === "kick") {
        if (!isStr(raw.target, 40)) return { ok: false, reason: "target" };
        cmd.target = sanitizeName(raw.target).toLowerCase();
      }
      return { ok: true, cmd };
    }
    case "game.overlay": {
      const ls = raw.liveState;
      if (ls !== "DEMO" && ls !== "LIVE_CONNECTED" && ls !== "RECONNECTING" && ls !== "OFFLINE") return { ok: false, reason: "live_state" };
      return { ok: true, cmd: { schemaVersion: SCHEMA_VERSION, commandId: raw.commandId, type: "game.overlay", liveState: ls } };
    }
    default:
      return { ok: false, reason: "unknown_type" };
  }
}
