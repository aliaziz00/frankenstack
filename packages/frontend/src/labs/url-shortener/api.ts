import { request } from "../../lib/http";

export interface ShortLink {
  shortCode: string;
  shortUrl?: string;
  longUrl: string;
  clickCount: number;
  createdAt: string;
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
