// Query-string parsing for the messages route, kept in its own module with
// no database imports so it can be unit tested directly (importing a route
// file would pull in the pool, and with it config.ts, which exits the process
// when DATABASE_URL is missing).

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
// Ids are positive bigints. Capping at 18 digits keeps the value inside
// Postgres's bigint range (max 19 digits), so a huge number gets a clean 400
// from us instead of a database error.
export const ID_PATTERN = /^[1-9]\d{0,17}$/;

// Query-string parsing for the messages route. Each function takes the raw,
// untrusted value and returns either the parsed value or an error message,
// the same result shape as parseClientMessage in chat/protocol.ts. They are
// pure (no req/res), so they can be unit tested directly.
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// Ids stay strings: they are passed to Postgres as text and cast to bigint,
// so nothing is lost to JS number precision on the way in.
export function parseChannelId(raw: unknown): Parsed<string> {
  if (typeof raw !== "string" || !ID_PATTERN.test(raw)) {
    return { ok: false, error: "channel id must be a positive integer" };
  }
  return { ok: true, value: raw };
}

export function parseLimit(raw: unknown): Parsed<number> {
  if (raw === undefined) return { ok: true, value: DEFAULT_LIMIT };
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    return { ok: false, error: "limit must be a positive integer" };
  }
  const value = Number(raw);
  if (value < 1 || value > MAX_LIMIT) {
    return { ok: false, error: `limit must be between 1 and ${MAX_LIMIT}` };
  }
  return { ok: true, value };
}

// `before` is optional: absent means "start from the newest message".
export function parseBefore(raw: unknown): Parsed<string | null> {
  if (raw === undefined) return { ok: true, value: null };
  if (typeof raw !== "string" || !ID_PATTERN.test(raw)) {
    return { ok: false, error: "before must be a message id" };
  }
  return { ok: true, value: raw };
}
