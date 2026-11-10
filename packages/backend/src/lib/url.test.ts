import { describe, expect, it } from "vitest";
import { isValidHttpUrl, MAX_URL_LENGTH, normalizeLongUrl } from "./url.js";

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

  // new URL() alone is lenient: it trims surrounding whitespace and drops tabs
  // and newlines anywhere in the string. isValidHttpUrl must not be (D-027),
  // because what gets stored is the original string, not the parsed one.
  it.each([
    ["a leading space", " https://example.com"],
    ["a trailing space", "https://example.com "],
    ["a trailing newline", "https://example.com\n"],
    ["a space in the path", "https://example.com/a b"],
    ["a tab in the path", "https://example.com/a\tb"],
    ["a newline inside the host", "https://exa\nmple.com"],
    ["a carriage return", "https://example.com/\r"],
    ["a non-breaking space (U+00A0)", "https://example.com/a b"],
    ["a line separator (U+2028)", "https://example.com/a b"],
    ["a NUL character", "https://example.com/\u0000"],
    ["another control character", "https://example.com/\u0001"],
    ["a DEL character", "https://example.com/\u007f"],
  ])("rejects %s", (_label, url) => {
    expect(isValidHttpUrl(url)).toBe(false);
  });
});

describe("normalizeLongUrl", () => {
  it("returns a clean URL unchanged", () => {
    expect(normalizeLongUrl("https://example.com/path?q=1#frag")).toBe(
      "https://example.com/path?q=1#frag",
    );
  });

  it("trims surrounding whitespace, so a pasted URL with a trailing newline works", () => {
    expect(normalizeLongUrl("  https://example.com/x  ")).toBe("https://example.com/x");
    expect(normalizeLongUrl("https://example.com/x\n")).toBe("https://example.com/x");
    expect(normalizeLongUrl("\t\r\n https://example.com/x \r\n")).toBe("https://example.com/x");
    expect(normalizeLongUrl(" https://example.com/x ")).toBe("https://example.com/x");
  });

  it("stores the URL as typed after trimming, not as new URL() would rewrite it", () => {
    // new URL("https://example.com").href is "https://example.com/" and
    // "HTTPS://EXAMPLE.COM/Path" becomes "https://example.com/Path".
    expect(normalizeLongUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeLongUrl("HTTPS://EXAMPLE.COM/Path")).toBe("HTTPS://EXAMPLE.COM/Path");
    expect(normalizeLongUrl("https://münchen.de")).toBe("https://münchen.de");
  });

  it("rejects whitespace or control characters left inside after trimming", () => {
    expect(normalizeLongUrl("https://example.com/a b")).toBeNull();
    expect(normalizeLongUrl(" https://exa\nmple.com ")).toBeNull();
    expect(normalizeLongUrl("https://example.com/a\tb")).toBeNull();
    expect(normalizeLongUrl("https://example.com/\u0001")).toBeNull();
  });

  it("rejects a control character at either end, which trim() does not remove", () => {
    expect(normalizeLongUrl("\u0001https://example.com")).toBeNull();
    expect(normalizeLongUrl("https://example.com\u0000")).toBeNull();
  });

  it("rejects empty and whitespace-only input", () => {
    expect(normalizeLongUrl("")).toBeNull();
    expect(normalizeLongUrl("   \n\t ")).toBeNull();
  });

  it("rejects anything that is not a string", () => {
    expect(normalizeLongUrl(undefined)).toBeNull();
    expect(normalizeLongUrl(null)).toBeNull();
    expect(normalizeLongUrl(5)).toBeNull();
    expect(normalizeLongUrl(["https://example.com"])).toBeNull();
    expect(normalizeLongUrl({ href: "https://example.com" })).toBeNull();
  });

  it("still rejects non-http schemes and invalid URLs after trimming", () => {
    expect(normalizeLongUrl(" ftp://example.com ")).toBeNull();
    expect(normalizeLongUrl(" javascript:alert(1) ")).toBeNull();
    expect(normalizeLongUrl(" not a url ")).toBeNull();
    expect(normalizeLongUrl(" https:// ")).toBeNull();
  });
});

describe("MAX_URL_LENGTH", () => {
  it("is 2048 characters (D-022)", () => {
    expect(MAX_URL_LENGTH).toBe(2048);
  });
});
