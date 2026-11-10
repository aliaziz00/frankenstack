import { describe, expect, it } from "vitest";
import { isValidHttpUrl, MAX_URL_LENGTH } from "./url.js";

describe("isValidHttpUrl", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "https://example.com/path/to/page",
    "https://example.com/p?q=1&r=2#frag",
    "HTTPS://EXAMPLE.COM/Path",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://[::1]:8080/",
    "https://user:pass@example.com",
    "https://münchen.de",
  ])("accepts %j", (url) => {
    expect(isValidHttpUrl(url)).toBe(true);
  });

  it.each([
    ["not a URL at all", "not a url"],
    ["no scheme", "example.com"],
    ["protocol-relative", "//example.com"],
    ["empty", ""],
    ["scheme with no host", "https://"],
    ["a space inside the host", "https://exa mple.com"],
    ["a port out of range", "http://example.com:99999"],
  ])("rejects %s", (_label, url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });

  // Only http and https may be stored: anything else (javascript:, data:)
  // would be handed back to a browser by the redirect.
  it.each([
    "ftp://example.com",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,hi",
    "file:///etc/passwd",
    "mailto:a@b.c",
  ])("rejects the non-http scheme in %j", (url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });

  // Known gap, not yet decided: new URL() silently trims surrounding
  // whitespace (and drops tabs and newlines anywhere), so " https://x.com "
  // passes, but the route stores the original string and the redirect then
  // sends a broken Location. Asserting either answer here would enshrine a
  // choice that has not been made.
  it.todo("decides what to do with surrounding or embedded whitespace");
});

describe("MAX_URL_LENGTH", () => {
  it("is 2048 characters (D-022)", () => {
    expect(MAX_URL_LENGTH).toBe(2048);
  });
});
