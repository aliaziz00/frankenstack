// URL rules for the shortener, kept free of database and Express imports so
// they can be unit tested directly.

// 2048 is the de-facto practical ceiling for URLs: browsers, CDNs and many
// servers reject or truncate anything longer (see D-022). Without a cap, the
// only limit is the 100 KB JSON body parser, and a stored URL is served back
// in every list response.
export const MAX_URL_LENGTH = 2048;

// Any whitespace (including Unicode spaces such as U+00A0), any C0 control
// character (tab, newline, NUL ...) and DEL.
// no-control-regex exists to catch control characters in a regex by accident;
// here matching them is the whole point.
// eslint-disable-next-line no-control-regex
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001f\u007f]/;

// True for a clean absolute http(s) URL. Strict on purpose: no whitespace or
// control characters anywhere in the string. `new URL()` alone is far more
// forgiving (see D-027), so the check has to be ours.
export function isValidHttpUrl(value: string): boolean {
  if (WHITESPACE_OR_CONTROL.test(value)) return false;
  try {
    const url = new URL(value);
    // Restrict to http(s) so nobody can store a `javascript:` or `data:`
    // URL that we then happily redirect a browser to.
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Turns a submitted value into the string we store, or null if it is not an
// acceptable URL (D-027): surrounding whitespace is trimmed (a pasted URL with
// a trailing newline just works), then anything with whitespace or control
// characters left inside is rejected. The URL is stored as typed after the
// trim, not as `new URL()` would rewrite it, so what the user sees is what
// was submitted.
export function normalizeLongUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return isValidHttpUrl(trimmed) ? trimmed : null;
}
