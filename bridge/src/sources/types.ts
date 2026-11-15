import type { ConnectionState, NormalizedLiveEvent } from "../../../shared/contract";

export interface LiveEventSource {
  readonly name: "mock" | "tiktok";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getState(): ConnectionState;
  onEvent(handler: (event: NormalizedLiveEvent) => void): () => void;
  onStatus(handler: (state: ConnectionState, message?: string) => void): () => void;
}

export class Emitter<T extends unknown[]> {
  private hs = new Set<(...a: T) => void>();
  on(h: (...a: T) => void) {
    this.hs.add(h);
    return () => this.hs.delete(h);
  }
  emit(...a: T) {
    for (const h of this.hs) {
      try {
        h(...a);
      } catch (err) {
        console.error("handler error", err);
      }
    }
  }
}
