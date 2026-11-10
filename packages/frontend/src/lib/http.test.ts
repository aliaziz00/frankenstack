import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./http";

// request() is a thin wrapper over fetch, so the tests replace fetch with a
// stub and assert on exactly what was sent and how the response is handled.

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// What the stub was called with, with the headers flattened for easy asserts.
function sent() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
  return { path, init, headers: Object.fromEntries(init.headers.entries()) };
}

describe("request: what is sent", () => {
  it("sends to the given path, unchanged", async () => {
    respondWith({});
    await request("/api/urls");
    expect(sent().path).toBe("/api/urls");
  });

  it("defaults Content-Type to application/json", async () => {
    respondWith({});
    await request("/api/urls");
    expect(sent().headers).toEqual({ "content-type": "application/json" });
  });

  it("passes method, body and signal through", async () => {
    respondWith({});
    const controller = new AbortController();
    await request("/api/urls", {
      method: "POST",
      body: '{"a":1}',
      signal: controller.signal,
    });
    const { init } = sent();
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"a":1}');
    expect(init.signal).toBe(controller.signal);
  });
});

// The bug this guards against: `{ headers: defaults, ...init }` let a caller's
// own headers replace the defaults, silently dropping Content-Type.
describe("request: merging caller headers with the defaults", () => {
  it("keeps the default Content-Type when headers are given as an object", async () => {
    respondWith({});
    await request("/api/x", { headers: { "X-Test": "1" } });
    expect(sent().headers).toEqual({ "content-type": "application/json", "x-test": "1" });
  });

  it("keeps the default Content-Type when headers are given as an array of pairs", async () => {
    respondWith({});
    await request("/api/x", { headers: [["X-Test", "2"]] });
    expect(sent().headers).toEqual({ "content-type": "application/json", "x-test": "2" });
  });

  it("keeps the default Content-Type when headers are given as a Headers instance", async () => {
    respondWith({});
    await request("/api/x", { headers: new Headers({ "X-Test": "3" }) });
    expect(sent().headers).toEqual({ "content-type": "application/json", "x-test": "3" });
  });

  it("lets the caller override Content-Type", async () => {
    respondWith({});
    await request("/api/x", { headers: { "Content-Type": "text/plain" } });
    expect(sent().headers).toEqual({ "content-type": "text/plain" });
  });

  it("treats header names case-insensitively when deciding whether to add the default", async () => {
    respondWith({});
    await request("/api/x", { headers: { "content-TYPE": "text/plain" } });
    expect(sent().headers).toEqual({ "content-type": "text/plain" });
  });

  it("does not modify the caller's Headers object", async () => {
    respondWith({});
    const callers = new Headers({ "X-Test": "1" });
    await request("/api/x", { headers: callers });
    expect([...callers.keys()]).toEqual(["x-test"]);
  });
});

describe("request: successful responses", () => {
  it("returns the parsed JSON body", async () => {
    respondWith([{ shortCode: "4", clickCount: 9 }]);
    await expect(request("/api/urls")).resolves.toEqual([{ shortCode: "4", clickCount: 9 }]);
  });

  it("rejects when a 200 response is not valid JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    await expect(request("/api/urls")).rejects.toThrow();
  });
});

describe("request: errors", () => {
  it("throws the backend's { error } message", async () => {
    respondWith({ error: "short code not found" }, 404);
    await expect(request("/api/urls/zzz/stats")).rejects.toThrow("short code not found");
  });

  it("throws an Error instance, so callers can use instanceof", async () => {
    respondWith({ error: "nope" }, 400);
    await expect(request("/api/x")).rejects.toBeInstanceOf(Error);
  });

  it("falls back to the status when the body has no error field", async () => {
    respondWith({ message: "something else" }, 503);
    await expect(request("/api/x")).rejects.toThrow("Request failed: 503");
  });

  it("falls back to the status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(request("/api/x")).rejects.toThrow("Request failed: 502");
  });

  it("falls back to the status when the error body is empty", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(request("/api/x")).rejects.toThrow("Request failed: 500");
  });

  it("treats every non-2xx status as an error", async () => {
    for (const status of [400, 401, 404, 413, 500, 503]) {
      fetchMock.mockReset();
      respondWith({ error: `status ${status}` }, status);
      await expect(request("/api/x")).rejects.toThrow(`status ${status}`);
    }
  });

  it("lets a network failure or abort propagate as thrown by fetch", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    fetchMock.mockRejectedValue(abort);
    await expect(request("/api/x")).rejects.toBe(abort);
  });
});
