// The redirect route (GET /:code) lives on the backend itself, not behind
// the /api proxy -- a real short link has to be a URL you can hand to
// anyone, not just an in-app fetch path. Same idea as bit.ly serving
// redirects from its own domain rather than your app's.
export const BACKEND_ORIGIN = "http://localhost:4000";

export interface ShortLink {
  shortCode: string;
  shortUrl?: string;
  longUrl: string;
  clickCount: number;
  createdAt: string;
}

// Talks to same-origin `/api/*`, which Vite's dev proxy forwards to the
// backend (see vite.config.ts). No base URL to configure here, which is
// the point of the proxy.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createShortLink(longUrl: string): Promise<ShortLink> {
  return request<ShortLink>("/api/urls", {
    method: "POST",
    body: JSON.stringify({ longUrl }),
  });
}

export function listShortLinks(): Promise<ShortLink[]> {
  return request<ShortLink[]>("/api/urls");
}
