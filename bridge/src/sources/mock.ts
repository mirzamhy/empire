// Mock event source: default for development. Events are always labelled source "mock".
import { randomUUID } from "node:crypto";
import { SCHEMA_VERSION, type ConnectionState, type LiveKind, type NormalizedLiveEvent } from "../../../shared/contract";
import { Emitter, type LiveEventSource } from "./types";

/** Coin values for mock gifts. Real values come from the connector (diamondCount). */
export const MOCK_GIFTS: Record<string, number> = {
  Rose: 1,
  TikTok: 1,
  "Finger Heart": 5,
  Perfume: 20,
  Doughnut: 30,
  "Hand Hearts": 100,
  Corgi: 299,
  "Money Gun": 500,
  Galaxy: 1000,
  Lion: 29999,
};

const NAMES = [
  "budi_raja", "sari.ratu", "raka77", "dinda_ff", "joko_gaming", "nadia", "fajar.id", "putri_x", "agus_kuat", "rina99",
  "bayu.sakti", "citra", "dewa_perang", "eka", "gilang_x", "hana.chan", "indra", "kevin_id", "lala", "mega",
];
const SMALL = ["Rose", "Rose", "Rose", "TikTok", "Finger Heart", "Perfume", "Doughnut"];

export class MockEventSource implements LiveEventSource {
  readonly name = "mock" as const;
  private state: ConnectionState = "disconnected";
  private events = new Emitter<[NormalizedLiveEvent]>();
  private status = new Emitter<[ConnectionState, string | undefined]>();
  private autoTimer: NodeJS.Timeout | null = null;

  async connect() {
    this.state = "connected";
    this.status.emit(this.state, "mock source ready");
  }
  async disconnect() {
    this.stopAuto();
    this.state = "disconnected";
    this.status.emit(this.state, undefined);
  }
  getState() {
    return this.state;
  }
  onEvent(h: (e: NormalizedLiveEvent) => void) {
    return this.events.on(h);
  }
  onStatus(h: (s: ConnectionState, m?: string) => void) {
    return this.status.on(h);
  }

  private base(kind: LiveKind, username: string): NormalizedLiveEvent {
    return {
      schemaVersion: SCHEMA_VERSION,
      eventId: `mock-${randomUUID()}`,
      source: "mock",
      kind,
      receivedAt: new Date().toISOString(),
      user: { username: username.toLowerCase(), displayName: username, userId: null },
    };
  }

  gift(giftName: string, username: string, repeatCount = 1, providerValue: number | null = null, repeatFinal = true, eventId?: string) {
    const e = this.base("gift", username);
    if (eventId) e.eventId = eventId;
    e.gift = { giftId: null, giftName, repeatCount, repeatFinal, providerValue: providerValue ?? MOCK_GIFTS[giftName] ?? 1 };
    this.events.emit(e);
    return e;
  }

  /** Streak: several non-final updates followed by one final event. */
  streak(giftName: string, username: string, finalCount: number) {
    const id = `mock-streak-${randomUUID()}`;
    for (let i = 1; i < finalCount; i++) this.gift(giftName, username, i, null, false, `${id}-${i}`);
    this.gift(giftName, username, finalCount, null, true, id);
  }

  chat(username: string, text: string) {
    const e = this.base("chat", username);
    e.chat = { text };
    this.events.emit(e);
  }

  like(username: string, count: number) {
    const e = this.base("like", username);
    e.like = { count };
    this.events.emit(e);
  }

  social(kind: "follow" | "share", username: string) {
    this.events.emit(this.base(kind, username));
  }

  /** n viewers type "ikut" at once. */
  joinMany(n: number) {
    for (let i = 0; i < n; i++) this.chat(NAMES[i % NAMES.length] + (i >= NAMES.length ? `_${i}` : ""), "ikut");
  }

  /** Ambient demo audience: joins, chats, likes and small gifts. */
  startAuto() {
    if (this.autoTimer) return;
    let tick = 0;
    this.autoTimer = setInterval(() => {
      tick++;
      const who = NAMES[Math.floor(Math.random() * NAMES.length)];
      const other = NAMES[Math.floor(Math.random() * NAMES.length)];
      if (tick % 3 === 0) this.chat(who, "ikut");
      if (Math.random() < 0.5) this.like(who, 5 + Math.floor(Math.random() * 30));
      if (Math.random() < 0.2) this.chat(who, `serang ${other}`);
      if (Math.random() < 0.25) this.gift(SMALL[Math.floor(Math.random() * SMALL.length)], who);
      if (Math.random() < 0.03) this.gift("Hand Hearts", who);
      if (Math.random() < 0.05) this.social("share", who);
    }, 2000);
  }
  stopAuto() {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }
  get autoRunning() {
    return this.autoTimer !== null;
  }
}
