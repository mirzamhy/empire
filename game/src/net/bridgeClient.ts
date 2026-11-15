// WebSocket link to the local live bridge. Game keeps simulating if this is down.
import type { CommandAck, GameStatusMessage } from "../../../shared/contract";

export type LinkState = "connecting" | "open" | "closed";

export class BridgeClient {
  state: LinkState = "closed";
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: number | null = null;
  reconnects = 0;

  constructor(
    private url: string,
    private onMessage: (msg: unknown) => void,
    private onState: (s: LinkState) => void,
  ) {}

  connect() {
    if (this.ws) return;
    this.setState("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setState("open");
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string" || ev.data.length > 16384) return;
      try {
        this.onMessage(JSON.parse(ev.data));
      } catch {
        /* malformed JSON ignored; bridge is the only sender */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.setState("closed");
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private setState(s: LinkState) {
    this.state = s;
    this.onState(s);
  }

  private scheduleReconnect() {
    if (this.timer !== null) return;
    const base = Math.min(15000, 1000 * 2 ** this.attempt);
    const delay = base * (0.7 + Math.random() * 0.6);
    this.attempt = Math.min(this.attempt + 1, 6);
    this.reconnects++;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  send(msg: CommandAck | GameStatusMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
