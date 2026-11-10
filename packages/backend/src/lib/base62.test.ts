import { describe, expect, it } from "vitest";
import { toBase62 } from "./base62.js";

// An independent decoder, used only to check round trips. It is deliberately
// written differently from toBase62 (a fold over the characters) so a mistake
// in one is unlikely to be mirrored in the other.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function fromBase62(code: string): bigint {
  return [...code].reduce((acc, char) => acc * 62n + BigInt(ALPHABET.indexOf(char)), 0n);
}

describe("toBase62", () => {
  it("encodes zero as a single zero", () => {
    expect(toBase62(0n)).toBe("0");
    expect(toBase62(0)).toBe("0");
  });

  it("uses the alphabet in order: digits, then lowercase, then uppercase", () => {
    expect(toBase62(1)).toBe("1");
    expect(toBase62(9)).toBe("9");
    expect(toBase62(10)).toBe("a");
    expect(toBase62(35)).toBe("z");
    expect(toBase62(36)).toBe("A");
    expect(toBase62(61)).toBe("Z");
  });

  it("carries over at powers of 62", () => {
    expect(toBase62(62)).toBe("10");
    expect(toBase62(62 * 62 - 1)).toBe("ZZ");
    expect(toBase62(62 * 62)).toBe("100");
  });

  it("gives the same result for a number and the equivalent bigint", () => {
    expect(toBase62(123456)).toBe(toBase62(123456n));
  });

  it("is exact beyond 2^53, where JS numbers lose precision", () => {
    const big = 2n ** 63n - 1n; // the largest value a Postgres bigint can hold
    expect(toBase62(big)).toBe("aZl8N0y58M7");
    expect(fromBase62(toBase62(big))).toBe(big);
  });

  it("round-trips a spread of values", () => {
    for (const value of [1n, 61n, 62n, 1000n, 987654321n, 2n ** 40n + 7n]) {
      expect(fromBase62(toBase62(value))).toBe(value);
    }
  });

  it("produces unique codes for distinct ids", () => {
    const codes = new Set<string>();
    for (let id = 0; id < 5000; id++) codes.add(toBase62(id));
    expect(codes.size).toBe(5000);
  });

  it("rejects negative numbers", () => {
    expect(() => toBase62(-1)).toThrow(RangeError);
    expect(() => toBase62(-1n)).toThrow(RangeError);
  });

  it("rejects non-integers", () => {
    expect(() => toBase62(1.5)).toThrow(RangeError);
  });
});
