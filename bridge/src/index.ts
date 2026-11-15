// EMPIRE live bridge entry point.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ConnectionState } from "../../shared/contract";
import { DEFAULT_PIPELINE, Pipeline } from "./pipeline";
import { BridgeServer } from "./server";
import { MockEventSource } from "./sources/mock";
import { TikTokEventSource } from "./sources/tiktok";
import type { LiveEventSource } from "./sources/types";
import { log } from "./log";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Minimal .env loader (KEY=VALUE lines). Values are never logged.
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT || 8788);
const GAME_PORT = Number(process.env.GAME_PORT || 5200);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
if (HOST !== "127.0.0.1" && HOST !== "localhost") log("warn", "bridge bound to a non-loopback address; protect it (ADMIN_TOKEN, firewall)", { component: "boot", reason: HOST });

let server: BridgeServer;
const pipeline = new Pipeline(DEFAULT_PIPELINE, (cmd) => server.sendToGame(cmd));

const mock = new MockEventSource();
let tiktok: TikTokEventSource | null = null;
let active: LiveEventSource = mock;
let providerState: ConnectionState = "disconnected";
let providerMessage = "";
const unsubs: (() => void)[] = [];

function attach(src: LiveEventSource) {
  unsubs.splice(0).forEach((u) => u());
  active = src;
  unsubs.push(src.onEvent((e) => pipeline.ingest(e)));
  unsubs.push(
    src.onStatus((s, msg) => {
      providerState = s;
      providerMessage = msg ?? "";
      log(s === "error" ? "error" : "info", "provider status", { component: "source", source: src.name, result: s, reason: msg ?? null });
    }),
  );
}

function liveLabel() {
  if (active.name === "mock") return "DEMO" as const;
  if (providerState === "connected") return "LIVE_CONNECTED" as const;
  if (providerState === "connecting" || providerState === "degraded") return "RECONNECTING" as const;
  return "OFFLINE" as const;
}

// Admin simulator events always go through the mock source, labelled "mock", even while LIVE is active.
mock.onEvent((e) => {
  if (active !== mock) pipeline.ingest(e);
});

const origins = [GAME_PORT, 4173].flatMap((p) => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]);

server = new BridgeServer(
  { host: HOST, port: PORT, adminToken: ADMIN_TOKEN, allowedGameOrigins: origins, adminHtmlPath: resolve(root, "bridge/admin/admin.html") },
  pipeline,
  {
    gift: (g, u, n, v) => void mock.gift(g, u, n, v),
    streak: (g, u, n) => mock.streak(g, u, n),
    chat: (u, t) => mock.chat(u, t),
    like: (u, n) => mock.like(u, n),
    social: (k, u) => mock.social(k, u),
    joinMany: (n) => mock.joinMany(n),
    setSource: async (s, username) => {
      await active.disconnect();
      if (s === "tiktok") {
        tiktok = new TikTokEventSource(username || process.env.TIKTOK_USERNAME || "");
        attach(tiktok);
      } else attach(mock);
      await active.connect();
    },
    connect: () => active.connect(),
    disconnect: () => active.disconnect(),
    setAuto: (on) => (on ? mock.startAuto() : mock.stopAuto()),
    status: () => ({
      bridge: "up",
      source: active.name,
      provider: { state: providerState, message: providerMessage, reconnects: tiktok?.reconnects ?? 0, lastError: tiktok?.lastError ?? null },
      liveLabel: liveLabel(),
      gameConnected: server.gameConnected,
      autoDemo: mock.autoRunning,
      ...pipeline.snapshot(),
    }),
  },
);

attach(mock);
await mock.connect();
if ((process.env.LIVE_SOURCE || "mock") === "tiktok" && process.env.TIKTOK_USERNAME) {
  tiktok = new TikTokEventSource(process.env.TIKTOK_USERNAME);
  attach(tiktok);
  void tiktok.connect();
}

await server.listen();
log("info", `bridge listening on http://${HOST}:${PORT} (admin: /admin${ADMIN_TOKEN ? "?token=<ADMIN_TOKEN>" : ""})`, { component: "boot" });

setInterval(() => pipeline.tick(server.gameConnected), 250);
setInterval(() => {
  pipeline.liveLabel = liveLabel();
  server.sendToGame(pipeline.overlay());
  server.broadcastAdmin({ type: "status", data: server.admin.status() });
}, 1000);

const shutdown = async () => {
  await active.disconnect();
  await server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
