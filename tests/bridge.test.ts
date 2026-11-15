import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateCommand, validateLiveEvent, type GameCommand, type NormalizedLiveEvent } from "../shared/contract";
import { DEFAULT_PIPELINE, Pipeline } from "../bridge/src/pipeline";
import { setQuiet } from "../bridge/src/log";
import { normalizeTikTokGift, normalizeTikTokLike } from "../bridge/src/sources/tiktok";

setQuiet(true);

const ev = (over: Partial<NormalizedLiveEvent> = {}): NormalizedLiveEvent => ({
  schemaVersion: SCHEMA_VERSION,
  eventId: "e1",
  source: "mock",
  kind: "chat",
  receivedAt: new Date().toISOString(),
  user: { username: "budi", displayName: "Budi", userId: null },
  chat: { text: "ikut" },
  ...over,
});

describe("pipeline", () => {
  it("forwards, dedupes and drops partial streaks", () => {
    const sent: GameCommand[] = [];
    const p = new Pipeline(DEFAULT_PIPELINE, (c) => (sent.push(c), true));
    p.ingest(ev());
    p.ingest(ev());
    p.ingest(ev({ eventId: "g1", kind: "gift", gift: { giftId: null, giftName: "Rose", repeatCount: 2, repeatFinal: false, providerValue: 1 } }));
    p.ingest(ev({ eventId: "g2", kind: "gift", gift: { giftId: null, giftName: "Rose", repeatCount: 3, repeatFinal: true, providerValue: 1 } }));
    expect(sent.length).toBe(2);
    expect(p.counts.duplicate).toBe(1);
    expect(p.counts.streakPartial).toBe(1);
  });

  it("buffers while the game is offline and flushes later", () => {
    let online = false;
    const sent: GameCommand[] = [];
    let t = 0;
    const p = new Pipeline(DEFAULT_PIPELINE, (c) => (online ? (sent.push(c), true) : false), () => t);
    p.ingest(ev({ eventId: "a" }));
    p.ingest(ev({ eventId: "b" }));
    online = true;
    p.tick(true);
    expect(sent.length).toBe(2);
    online = false;
    p.ingest(ev({ eventId: "c" }));
    t = 60000;
    online = true;
    p.tick(true);
    expect(sent.length).toBe(2);
  });

  it("kill switch drops real events but keeps mock", () => {
    const sent: GameCommand[] = [];
    const p = new Pipeline(DEFAULT_PIPELINE, (c) => (sent.push(c), true));
    p.setKillSwitch(true);
    p.ingest(ev({ eventId: "x", source: "tiktok-live-connector" }));
    p.ingest(ev({ eventId: "y" }));
    expect(sent.length).toBe(1);
  });
});

describe("contract", () => {
  it("validates live commands and lowercases usernames", () => {
    const r = validateCommand({ schemaVersion: 1, commandId: "c1", type: "game.live", event: ev({ user: { username: "BuDi<b>", displayName: "B", userId: null } }) });
    expect(r.ok).toBe(true);
    if (r.ok && r.cmd.type === "game.live") expect(r.cmd.event.user.username).toBe("budib");
  });
  it("rejects unknown kinds and bad shapes", () => {
    expect(validateLiveEvent({ ...ev(), kind: "hack" })).toBeNull();
    expect(validateLiveEvent({ ...ev(), kind: "gift" })).toBeNull();
    expect(validateCommand({ schemaVersion: 1, commandId: "c", type: "game.control", op: "rm -rf" }).ok).toBe(false);
  });
});

describe("tiktok normalizers", () => {
  it("reads v3 gift and like payloads", () => {
    const g = normalizeTikTokGift({ user: { displayId: "Sari.Ratu", nickname: "Sari" }, gift: { name: "Rose", diamondCount: 1, type: 1 }, repeatCount: 5, repeatEnd: true, common: { msgId: "77" } });
    expect(g.user.username).toBe("sari.ratu");
    expect(g.gift).toMatchObject({ giftName: "Rose", repeatCount: 5, repeatFinal: true, providerValue: 1 });
    const l = normalizeTikTokLike({ user: { uniqueId: "budi" }, likeCount: 15 });
    expect(l.like?.count).toBe(15);
  });
});
