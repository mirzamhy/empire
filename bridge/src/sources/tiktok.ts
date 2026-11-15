// EXPERIMENTAL / UNOFFICIAL adapter around the community package "tiktok-live-connector".
// It reads TikTok's internal LIVE (Webcast) stream; it is not an official TikTok API and can
// break or stop at any time. Not installed by default: `npm install tiktok-live-connector`.
// Only a public LIVE username is used. No passwords, cookies or session ids.
import { createHash } from "node:crypto";
import { SCHEMA_VERSION, sanitizeName, sanitizeText, MAX_CHAT_LEN, type ConnectionState, type NormalizedLiveEvent } from "../../../shared/contract";
import { backoffDelay } from "../backoff";
import { Emitter, type LiveEventSource } from "./types";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);
const numOr = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/**
 * Pull user fields. Connector 2.x decodes with the v3 schema (`displayId` = @handle, `id` = numeric id),
 * older schemas use `uniqueId` / `userId`. All are accepted.
 */
function readUser(raw: Raw) {
  const u = obj(raw.user);
  const username = (str(u.uniqueId) ?? str(u.displayId) ?? str(raw.uniqueId) ?? str(raw.displayId) ?? "anon").toLowerCase();
  const displayName = str(u.nickname) ?? str(raw.nickname) ?? username;
  const userId = str(u.userId) ?? str(u.id) ?? str(raw.userId);
  return { username: sanitizeName(username), displayName: sanitizeName(displayName), userId };
}

function readMsgId(raw: Raw): string | null {
  return str(raw.msgId) ?? str(obj(raw.common).msgId) ?? str(obj(raw.event).msgId);
}

/**
 * Normalize a gift payload. Streak semantics (as documented by the community library, verify
 * against captured fixtures): giftType 1 = streakable; repeatEnd=false while the streak runs.
 * Only the final event should trigger an action.
 */
export function normalizeTikTokGift(raw: Raw, now = Date.now()): NormalizedLiveEvent {
  // v1/v2 put gift info in `giftDetails`; the v3 schema used by connector 2.x puts it in `gift`.
  const details = { ...obj(raw.gift), ...obj(raw.giftDetails) };
  const giftId = str(raw.giftId) ?? str(details.id);
  const giftName = sanitizeText(str(raw.giftName) ?? str(details.giftName) ?? str(details.name) ?? (giftId ? `gift_${giftId}` : "unknown"), 40);
  const repeatCount = Math.max(1, Math.min(9999, numOr(raw.repeatCount, 1)));
  const giftType = numOr(raw.giftType ?? details.giftType ?? details.type, -1);
  const repeatEnd = raw.repeatEnd;
  const repeatFinal = giftType === 1 ? repeatEnd === true || repeatEnd === 1 : repeatEnd !== false;
  const diamond = raw.diamondCount ?? details.diamondCount;
  const user = readUser(raw);
  const msgId = readMsgId(raw);
  // Without a provider id we fingerprint (user, gift, count, 2 s bucket). Not perfect: documented.
  const eventId = msgId
    ? `tt-${msgId}${repeatFinal ? "" : `-r${repeatCount}`}`
    : "tt-fp-" + createHash("sha1").update(`${user.username}|${giftId}|${repeatCount}|${repeatFinal}|${Math.floor(now / 2000)}`).digest("hex").slice(0, 16);
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId,
    source: "tiktok-live-connector",
    kind: "gift",
    receivedAt: new Date(now).toISOString(),
    user,
    gift: {
      giftId,
      giftName,
      repeatCount,
      repeatFinal,
      providerValue: typeof diamond === "number" && Number.isFinite(diamond) ? diamond : null,
    },
  };
}

export function normalizeTikTokChat(raw: Raw, now = Date.now()): NormalizedLiveEvent {
  const user = readUser(raw);
  const msgId = readMsgId(raw);
  const text = sanitizeText(str(raw.comment) ?? str(raw.content) ?? "", MAX_CHAT_LEN);
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: msgId ? `tt-${msgId}` : `tt-chat-${createHash("sha1").update(`${user.username}|${text}|${Math.floor(now / 1000)}`).digest("hex").slice(0, 16)}`,
    source: "tiktok-live-connector",
    kind: "chat",
    receivedAt: new Date(now).toISOString(),
    user,
    chat: { text },
  };
}

export function normalizeTikTokLike(raw: Raw, now = Date.now()): NormalizedLiveEvent {
  const user = readUser(raw);
  const msgId = readMsgId(raw);
  const count = Math.max(1, Math.min(10000, numOr(raw.likeCount, 1)));
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: msgId ? `tt-${msgId}` : `tt-like-${user.username}-${now}`,
    source: "tiktok-live-connector",
    kind: "like",
    receivedAt: new Date(now).toISOString(),
    user,
    like: { count },
  };
}

export function normalizeTikTokSocial(kind: "follow" | "share", raw: Raw, now = Date.now()): NormalizedLiveEvent {
  const user = readUser(raw);
  const msgId = readMsgId(raw);
  return {
    schemaVersion: SCHEMA_VERSION,
    eventId: msgId ? `tt-${msgId}` : `tt-${kind}-${user.username}-${Math.floor(now / 10000)}`,
    source: "tiktok-live-connector",
    kind,
    receivedAt: new Date(now).toISOString(),
    user,
  };
}

interface Conn {
  connect(): Promise<unknown>;
  disconnect(): unknown;
  on(ev: string, cb: (d: unknown) => void): unknown;
}

export class TikTokEventSource implements LiveEventSource {
  readonly name = "tiktok" as const;
  private state: ConnectionState = "disconnected";
  private events = new Emitter<[NormalizedLiveEvent]>();
  private status = new Emitter<[ConnectionState, string | undefined]>();
  private conn: Conn | null = null;
  private attempt = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private wanted = false;
  reconnects = 0;
  lastError: string | null = null;

  constructor(private username: string) {}

  getState() {
    return this.state;
  }
  onEvent(h: (e: NormalizedLiveEvent) => void) {
    return this.events.on(h);
  }
  onStatus(h: (s: ConnectionState, m?: string) => void) {
    return this.status.on(h);
  }

  private set(s: ConnectionState, msg?: string) {
    this.state = s;
    this.status.emit(s, msg);
  }

  async connect() {
    if (!/^[A-Za-z0-9._]{2,24}$/.test(this.username)) {
      this.set("error", "invalid TikTok username");
      return;
    }
    this.wanted = true;
    await this.open();
  }

  private async open() {
    this.set(this.attempt === 0 ? "connecting" : "degraded", this.attempt ? `reconnect attempt ${this.attempt}` : undefined);
    let mod: Raw;
    try {
      const name = "tiktok-live-connector"; // optional dependency, resolved at runtime
      mod = (await import(/* @vite-ignore */ name)) as Raw;
    } catch {
      this.wanted = false;
      this.lastError = "package tiktok-live-connector not installed";
      this.set("error", "Install optional package: npm install tiktok-live-connector");
      return;
    }
    const Ctor = (mod.TikTokLiveConnection ?? mod.WebcastPushConnection ?? obj(mod.default).TikTokLiveConnection ??
      obj(mod.default).WebcastPushConnection) as (new (u: string, o?: object) => Conn) | undefined;
    if (!Ctor) {
      this.set("error", "tiktok-live-connector: unsupported version (no connection class found)");
      return;
    }
    try {
      // enableExtendedGiftInfo is left off: on v2 it triggers a signed request that needs a paid Euler plan.
      // Gift name, id and diamondCount already arrive in the gift message itself.
      const conn = new Ctor(this.username, { processInitialData: false });
      this.conn = conn;
      conn.on("gift", (d) => this.events.emit(normalizeTikTokGift(obj(d))));
      conn.on("chat", (d) => this.events.emit(normalizeTikTokChat(obj(d))));
      conn.on("like", (d) => this.events.emit(normalizeTikTokLike(obj(d))));
      conn.on("follow", (d) => this.events.emit(normalizeTikTokSocial("follow", obj(d))));
      conn.on("share", (d) => this.events.emit(normalizeTikTokSocial("share", obj(d))));
      conn.on("disconnected", () => this.handleDrop("disconnected"));
      conn.on("streamEnd", () => this.handleDrop("stream ended"));
      conn.on("error", (e) => {
        this.lastError = String((e as Error)?.message ?? e).slice(0, 160);
      });
      await conn.connect();
      this.attempt = 0;
      // Connected state comes from the provider resolving connect(), not from our process being alive.
      this.set("connected", `LIVE @${this.username}`);
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err).slice(0, 160);
      this.handleDrop(this.lastError);
    }
  }

  private handleDrop(reason: string) {
    this.conn = null;
    if (!this.wanted) {
      this.set("disconnected", reason);
      return;
    }
    const delay = backoffDelay(this.attempt, 3000, 60000);
    this.attempt = Math.min(this.attempt + 1, 10);
    this.reconnects++;
    this.set("degraded", `${reason}; retry in ${Math.round(delay / 1000)}s`);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.open(), delay);
  }

  async disconnect() {
    this.wanted = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    try {
      this.conn?.disconnect();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.attempt = 0;
    this.set("disconnected");
  }
}
