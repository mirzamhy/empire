// EMPIRE game entry. F0: bridge link and status heartbeat only.
import { SCHEMA_VERSION, validateCommand, type GameStatusMessage } from "../../shared/contract";
import { BridgeClient } from "./net/bridgeClient";

const app = document.getElementById("app")!;
const info = document.createElement("pre");
info.style.cssText = "color:#e8dcc0;font:16px monospace;padding:24px";
app.appendChild(info);

const lines: string[] = [];
const bridge = new BridgeClient(
  `ws://127.0.0.1:${import.meta.env.VITE_BRIDGE_PORT ?? 8788}/ws/game`,
  (raw) => {
    const v = validateCommand(raw);
    if (!v.ok || v.cmd.type !== "game.live") return;
    const e = v.cmd.event;
    lines.unshift(`${e.kind} ${e.user.username} ${e.chat?.text ?? e.gift?.giftName ?? ""}`);
    lines.length = Math.min(lines.length, 20);
    bridge.send({ schemaVersion: SCHEMA_VERSION, type: "game.ack", commandId: v.cmd.commandId, status: "applied", reason: null });
  },
  () => {},
);
bridge.connect();

setInterval(() => {
  const status: GameStatusMessage = {
    schemaVersion: SCHEMA_VERSION, type: "game.status", roundId: 0, phase: "F0", secondsLeft: 0,
    paused: false, safeMode: false, fps: 0, kingdoms: 0, units: 0, joinQueue: 0, leader: null,
  };
  bridge.send(status);
  info.textContent = `EMPIRE F0 · bridge ${bridge.state}\n\n${lines.join("\n")}`;
}, 1000);
