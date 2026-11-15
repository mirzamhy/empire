/** Exponential backoff with full-range jitter, capped. attempt starts at 0. */
export function backoffDelay(attempt: number, baseMs = 2000, maxMs = 60000, rand: () => number = Math.random): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  // jitter in [0.5, 1.0] of the exponential value; never below baseMs/2
  return Math.max(baseMs / 2, Math.round(exp * (0.5 + rand() * 0.5)));
}
