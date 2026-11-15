// Local HTTP + WebSocket server. Binds to 127.0.0.1 by default. No shell/console endpoints.
import { createServer, type IncomingMessage, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { SCHEMA_VERSION, sanitizeName, sanitizeText, MAX_CHAT_LEN, CONTROL_OPS, type CommandAck, type ControlOp, type GameCommand, type GameStatusMessage } from "../../shared/contract";
import type { Pipeline } from "./pipeline";
import { log } from "./log";

export interface ServerOptions {
  host: string;
  port: number;
  adminToken: string | null;
  allowedGameOrigins: string[];
  adminHtmlPath: string;
}

export interface AdminHandlers {
  gift(giftName: string, username: string, repeatCount: number, value: number | null): void;
  streak(giftName: string, username: string, count: number): void;
  chat(username: string, text: string): void;
  like(username: string, count: number): void;
  social(kind: "follow" | "share", username: string): void;
  joinMany(n: number): void;
  setSource(source: "mock" | "tiktok", username?: string): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setAuto(on: boolean): void;
  status(): Record<string, unknown>;
}

const MAX_PAYLOAD = 16 * 1024;

function tokenOk(given: string | null, expected: string | null) {
  if (!expected) return true;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isLoopback(req: IncomingMessage) {
  const a = req.socket.remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

/** Per-connection token bucket. */
function limiter(perSecond: number) {
  let tokens = perSecond;
  let last = Date.now();
  return () => {
    const now = Date.now();
    tokens = Math.min(perSecond, tokens + ((now - last) / 1000) * perSecond);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

export class BridgeServer {
  http: Server;
  private gameWss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  private adminWss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  game: WebSocket | null = null;
  private admins = new Set<WebSocket>();

  constructor(
    private opt: ServerOptions,
    private pipeline: Pipeline,
    readonly admin: AdminHandlers,
  ) {
    const adminOrigins = [`http://127.0.0.1:${opt.port}`, `http://localhost:${opt.port}`];
    this.http = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");
      if (url.pathname === "/health") return void res.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
      if (url.pathname === "/status") return void res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(this.admin.status()));
      if (url.pathname === "/admin" || url.pathname === "/") {
        if (!tokenOk(url.searchParams.get("token"), opt.adminToken)) return void res.writeHead(401).end("admin token required: /admin?token=...");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
        });
        return void res.end(readFileSync(opt.adminHtmlPath, "utf8"));
      }
      res.writeHead(404).end("not found");
    });

    this.http.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://x");
      const origin = req.headers.origin;
      if (opt.host === "127.0.0.1" && !isLoopback(req)) return socket.destroy();
      if (url.pathname === "/ws/game") {
        if (origin && !opt.allowedGameOrigins.includes(origin)) {
          log("warn", "game ws origin rejected", { component: "server", reason: origin });
          return socket.destroy();
        }
        this.gameWss.handleUpgrade(req, socket, head, (ws) => this.onGame(ws));
      } else if (url.pathname === "/ws/admin") {
        if (!origin || !adminOrigins.includes(origin)) return socket.destroy();
        if (!tokenOk(url.searchParams.get("token"), opt.adminToken)) return socket.destroy();
        this.adminWss.handleUpgrade(req, socket, head, (ws) => this.onAdmin(ws));
      } else socket.destroy();
    });
  }

  listen() {
    return new Promise<void>((resolve) => this.http.listen(this.opt.port, this.opt.host, () => resolve()));
  }

  close() {
    for (const ws of this.admins) ws.terminate();
    this.game?.terminate();
    this.gameWss.close();
    this.adminWss.close();
    return new Promise<void>((r) => this.http.close(() => r()));
  }

  get boundPort(): number {
    const a = this.http.address();
    return typeof a === "object" && a ? a.port : this.opt.port;
  }

  get gameConnected() {
    return !!this.game && this.game.readyState === WebSocket.OPEN;
  }

  sendToGame(cmd: GameCommand): boolean {
    if (!this.gameConnected) return false;
    this.game!.send(JSON.stringify(cmd));
    return true;
  }

  /** Only one game page is accepted; a newer one replaces the old (avoids online/offline flapping). */
  private onGame(ws: WebSocket) {
    if (this.game) this.game.close(4000, "replaced by newer game connection");
    this.game = ws;
    const allow = limiter(60);
    log("info", "game connected", { component: "server" });
    this.sendToGame(this.pipeline.overlay());
    ws.on("message", (data, isBinary) => {
      if (isBinary || !allow()) return;
      let m: { type?: string; schemaVersion?: number };
      try {
        m = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (m?.schemaVersion !== SCHEMA_VERSION) return;
      if (m.type === "game.ack") this.pipeline.onAck(m as CommandAck);
      else if (m.type === "game.status") this.pipeline.gameStatus = m as GameStatusMessage;
    });
    ws.on("close", () => {
      if (this.game === ws) {
        this.game = null;
        log("warn", "game disconnected", { component: "server" });
      }
    });
  }

  private onAdmin(ws: WebSocket) {
    this.admins.add(ws);
    const allow = limiter(20);
    ws.on("message", async (data, isBinary) => {
      if (isBinary || !allow()) return;
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(data.toString());
      } catch {
        return;
      }
      try {
        await this.handleAdmin(m);
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: String(err).slice(0, 200) }));
      }
    });
    ws.on("close", () => this.admins.delete(ws));
  }

  /** Admin commands map to a fixed allowlist. Strings are sanitized, numbers range-checked. */
  private async handleAdmin(m: Record<string, unknown>) {
    const a = this.admin;
    const name = (v: unknown) => sanitizeName(v);
    const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
    switch (m.type) {
      case "gift":
        return a.gift(sanitizeText(m.giftName, 40), name(m.username), int(m.repeatCount, 1, 99, 1), typeof m.value === "number" ? int(m.value, 1, 100000, 1) : null);
      case "streak":
        return a.streak(sanitizeText(m.giftName, 40), name(m.username), int(m.count, 2, 50, 5));
      case "chat":
        return a.chat(name(m.username), sanitizeText(m.text, MAX_CHAT_LEN));
      case "like":
        return a.like(name(m.username), int(m.count, 1, 1000, 30));
      case "social":
        return a.social(m.kind === "share" ? "share" : "follow", name(m.username));
      case "joinMany":
        return a.joinMany(int(m.n, 1, 60, 10));
      case "control": {
        if (typeof m.op !== "string" || !(CONTROL_OPS as readonly string[]).includes(m.op)) return;
        const op = m.op as ControlOp;
        this.sendToGame(this.pipeline.control(op, op === "kick" ? name(m.target).toLowerCase() : undefined));
        return;
      }
      case "killSwitch": {
        const on = m.on === true;
        this.pipeline.setKillSwitch(on);
        this.sendToGame(this.pipeline.control(on ? "safe_mode_on" : "safe_mode_off"));
        return;
      }
      case "setSource":
        return a.setSource(m.source === "tiktok" ? "tiktok" : "mock", typeof m.username === "string" ? m.username.replace(/^@/, "").slice(0, 24) : undefined);
      case "connect":
        return a.connect();
      case "disconnect":
        return a.disconnect();
      case "auto":
        return a.setAuto(m.on === true);
      default:
        return;
    }
  }

  broadcastAdmin(payload: unknown) {
    const s = JSON.stringify(payload);
    for (const ws of this.admins) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }
}
