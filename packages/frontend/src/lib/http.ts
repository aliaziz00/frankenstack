// The shared fetch wrapper for every lab's API client.
//
// Talks to same-origin `/api/*`, which Vite's dev proxy forwards to the
// backend (see vite.config.ts). No base URL to configure here, which is
// the point of the proxy.
//
// On a non-2xx response it throws an Error carrying the `{ "error": "..." }`
// message the backend sends (see the central error handler, D-020), or a
// generic message if the body is not that shape.
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Merge, don't replace: spreading `{ headers: defaults, ...init }` would
  // silently drop the default Content-Type whenever a caller passes any
  // headers of its own. `Headers` also accepts all three forms a caller may
  // use (plain object, array of pairs, or a Headers instance).
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
