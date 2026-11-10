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
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function createShortLink(longUrl: string): Promise<ShortLink> {
  return request<ShortLink>("/api/urls", {
    method: "POST",
    body: JSON.stringify({ longUrl }),
  });
}

// `signal` lets the caller cancel the request, e.g. when the component that
// asked for the list unmounts before the response arrives.
export function listShortLinks(signal?: AbortSignal): Promise<ShortLink[]> {
  return request<ShortLink[]>("/api/urls", { signal });
}
