/** Time-windowed id set with a hard size cap, so memory never grows without bound. */
export class Deduper {
  private seen = new Map<string, number>();
  constructor(
    private windowMs: number,
    private maxEntries = 5000,
  ) {}

  /** Returns true if id is new (and records it), false if seen within the window. */
  check(id: string, now: number): boolean {
    this.prune(now);
    const t = this.seen.get(id);
    if (t !== undefined && now - t < this.windowMs) return false;
    this.seen.set(id, now);
    if (this.seen.size > this.maxEntries) {
      const first = this.seen.keys().next().value;
      if (first !== undefined) this.seen.delete(first);
    }
    return true;
  }

  private prune(now: number) {
    for (const [id, t] of this.seen) {
      if (now - t < this.windowMs) break; // Map keeps insertion order: oldest first
      this.seen.delete(id);
    }
  }

  get size() {
    return this.seen.size;
  }
}
