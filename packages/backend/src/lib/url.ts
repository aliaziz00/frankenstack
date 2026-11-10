// URL rules for the shortener, kept free of database and Express imports so
// they can be unit tested directly.

// 2048 is the de-facto practical ceiling for URLs: browsers, CDNs and many
// servers reject or truncate anything longer (see D-022). Without a cap, the
// only limit is the 100 KB JSON body parser, and a stored URL is served back
// in every list response.
export const MAX_URL_LENGTH = 2048;

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Restrict to http(s) so nobody can store a `javascript:` or `data:`
    // URL that we then happily redirect a browser to.
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
