// Structured JSON-line logger. Never pass secrets in here.
export type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  component: string;
  eventId?: string;
  commandId?: string;
  action?: string;
  result?: string;
  reason?: string | null;
  source?: string;
  [k: string]: unknown;
}

let quiet = false;
export function setQuiet(q: boolean) {
  quiet = q;
}

/** Strip newlines/control chars from any string field to prevent log injection. */
function clean(v: unknown): unknown {
  if (typeof v === "string") return v.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);
  return v;
}

export function log(level: Level, msg: string, fields: LogFields) {
  if (quiet && level !== "error") return;
  const out: Record<string, unknown> = { ts: new Date().toISOString(), level, msg: clean(msg) };
  for (const [k, v] of Object.entries(fields)) out[k] = clean(v);
  const line = JSON.stringify(out);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}
