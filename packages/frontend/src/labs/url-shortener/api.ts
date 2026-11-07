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
