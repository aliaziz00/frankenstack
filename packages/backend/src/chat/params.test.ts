import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseBefore,
  parseChannelId,
  parseLimit,
} from "./params.js";

// These are the query-string rules of GET /api/chat/channels/:id/messages.
// Raw values are what Express hands over: usually a string, but an array when
// a parameter is repeated (?limit=1&limit=2) and undefined when absent.

const ok = (value: unknown) => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });

describe("parseChannelId", () => {
  const bad = err("channel id must be a positive integer");

  it("accepts positive integers, kept as strings", () => {
    expect(parseChannelId("1")).toEqual(ok("1"));
    expect(parseChannelId("42")).toEqual(ok("42"));
  });

  it("accepts up to 18 digits (inside Postgres bigint range)", () => {
    expect(parseChannelId("999999999999999999")).toEqual(ok("999999999999999999"));
  });

  it("rejects 19 digits or more, so Postgres never sees an out-of-range value", () => {
    expect(parseChannelId("1000000000000000000")).toEqual(bad);
    expect(parseChannelId("99999999999999999999")).toEqual(bad);
  });

  it.each(["0", "-1", "+1", "01", "1.5", "1e3", "abc", "", " 1", "1 ", "0x10"])(
    "rejects %j",
    (raw) => {
      expect(parseChannelId(raw)).toEqual(bad);
    },
  );

  it("rejects values that are not strings", () => {
    expect(parseChannelId(undefined)).toEqual(bad);
    expect(parseChannelId(5)).toEqual(bad);
    expect(parseChannelId(["1"])).toEqual(bad);
    expect(parseChannelId({ a: "1" })).toEqual(bad);
  });
});

describe("parseLimit", () => {
  it("defaults to 50 when absent", () => {
    expect(DEFAULT_LIMIT).toBe(50);
    expect(parseLimit(undefined)).toEqual(ok(50));
  });

  it("accepts 1 through the maximum, as numbers", () => {
    expect(MAX_LIMIT).toBe(100);
    expect(parseLimit("1")).toEqual(ok(1));
    expect(parseLimit("50")).toEqual(ok(50));
    expect(parseLimit("100")).toEqual(ok(100));
  });

  it.each(["0", "101", "1000"])("rejects %j as out of range", (raw) => {
    expect(parseLimit(raw)).toEqual(err("limit must be between 1 and 100"));
  });

  it.each(["x", "-1", "1.5", "+5", "", " 5", "5 ", "1e2", "0x10"])(
    "rejects %j as not a positive integer",
    (raw) => {
      expect(parseLimit(raw)).toEqual(err("limit must be a positive integer"));
    },
  );

  it("rejects a repeated or nested parameter", () => {
    expect(parseLimit(["1", "2"])).toEqual(err("limit must be a positive integer"));
    expect(parseLimit({ a: "1" })).toEqual(err("limit must be a positive integer"));
  });

  it("rejects a one-element array even though it stringifies to a valid number", () => {
    expect(parseLimit(["5"])).toEqual(err("limit must be a positive integer"));
  });
});

describe("parseBefore", () => {
  const bad = err("before must be a message id");

  it("means 'start from the newest message' when absent", () => {
    expect(parseBefore(undefined)).toEqual(ok(null));
  });

  it("accepts a message id, kept as a string", () => {
    expect(parseBefore("1")).toEqual(ok("1"));
    expect(parseBefore("4821")).toEqual(ok("4821"));
    expect(parseBefore("999999999999999999")).toEqual(ok("999999999999999999"));
  });

  it.each(["0", "-1", "abc", "", "1.5", "01", "99999999999999999999"])(
    "rejects %j",
    (raw) => {
      expect(parseBefore(raw)).toEqual(bad);
    },
  );

  it("rejects a repeated or nested parameter", () => {
    expect(parseBefore(["1", "2"])).toEqual(bad);
    expect(parseBefore({ a: "1" })).toEqual(bad);
  });

  // String(["1"]) is "1", so a check that stringifies instead of testing the
  // type would let a one-element array through.
  it("rejects a one-element array even though it stringifies to a valid id", () => {
    expect(parseBefore(["1"])).toEqual(bad);
  });
});
