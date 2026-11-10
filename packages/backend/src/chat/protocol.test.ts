import { describe, expect, it } from "vitest";
import { MAX_BODY_LENGTH, MAX_FRAME_BYTES, parseClientMessage } from "./protocol.js";

// Frames arrive as untrusted text, so these tests are mostly about rejecting
// bad input with a clear message. Error strings are part of the contract: a
// client shows them, so they are asserted exactly.

const send = (payload: unknown) => JSON.stringify({ type: "send", payload });
const join = (payload: unknown) => JSON.stringify({ type: "join", payload });

function expectError(raw: string, error: string) {
  expect(parseClientMessage(raw)).toEqual({ ok: false, error });
}

describe("parseClientMessage: valid messages", () => {
  it("accepts join", () => {
    expect(parseClientMessage(join({ channelId: 1 }))).toEqual({
      ok: true,
      message: { type: "join", payload: { channelId: 1 } },
    });
  });

  it("accepts leave", () => {
    expect(
      parseClientMessage(JSON.stringify({ type: "leave", payload: { channelId: 2 } })),
    ).toEqual({
      ok: true,
      message: { type: "leave", payload: { channelId: 2 } },
    });
  });

  it("accepts send", () => {
    expect(parseClientMessage(send({ channelId: 1, body: "hi" }))).toEqual({
      ok: true,
      message: { type: "send", payload: { channelId: 1, body: "hi" } },
    });
  });

  it("trims whitespace around a message body", () => {
    expect(parseClientMessage(send({ channelId: 1, body: "  hi there \n" }))).toEqual({
      ok: true,
      message: { type: "send", payload: { channelId: 1, body: "hi there" } },
    });
  });

  it("drops unknown payload fields instead of passing them through", () => {
    expect(
      parseClientMessage(join({ channelId: 1, admin: true, userId: 99 })),
    ).toEqual({
      ok: true,
      message: { type: "join", payload: { channelId: 1 } },
    });
  });
});

describe("parseClientMessage: the frame itself", () => {
  it("rejects text that is not JSON", () => {
    expectError("hello", "frame is not valid JSON");
    expectError("", "frame is not valid JSON");
    expectError("{bad", "frame is not valid JSON");
  });

  it("rejects JSON that is not an object", () => {
    expectError("[1]", "frame must be a JSON object");
    expectError("null", "frame must be a JSON object");
    expectError("5", "frame must be a JSON object");
    expectError('"join"', "frame must be a JSON object");
  });

  it("rejects a missing or non-string type", () => {
    expectError('{"payload":{}}', "type must be a string");
    expectError('{"type":5,"payload":{}}', "type must be a string");
  });

  it("rejects a missing or non-object payload", () => {
    expectError('{"type":"join"}', "payload must be an object");
    expectError('{"type":"join","payload":null}', "payload must be an object");
    expectError('{"type":"join","payload":[1]}', "payload must be an object");
    expectError('{"type":"join","payload":"x"}', "payload must be an object");
  });

  it("rejects an unknown type and names it", () => {
    expectError('{"type":"nuke","payload":{}}', 'unknown type "nuke"');
    // Not a way to reach Object.prototype members.
    expectError('{"type":"__proto__","payload":{}}', 'unknown type "__proto__"');
    expectError('{"type":"toString","payload":{}}', 'unknown type "toString"');
  });
});

describe("parseClientMessage: channelId", () => {
  const bad = "channelId must be a positive integer";

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["a string", '"1"'],
    ["a fraction", 1.5],
    ["null", null],
    ["a boolean", true],
  ])("rejects %s", (_label, value) => {
    const channelId = typeof value === "string" ? JSON.parse(value) : value;
    expectError(join({ channelId }), bad);
  });

  it("rejects a missing channelId", () => {
    expectError(join({}), bad);
  });

  it("accepts the largest safe integer", () => {
    expect(parseClientMessage(`{"type":"join","payload":{"channelId":9007199254740991}}`)).toEqual({
      ok: true,
      message: { type: "join", payload: { channelId: Number.MAX_SAFE_INTEGER } },
    });
  });

  it("rejects 2^53 and beyond, which JSON.parse would have silently rounded", () => {
    // 9007199254740993 is 2^53 + 1; parsed as a double it becomes 2^53, which
    // is not a safe integer. It is written as raw text: JSON.stringify of the
    // JS literal would already have lost the digit.
    expectError(`{"type":"join","payload":{"channelId":9007199254740993}}`, bad);
    expectError(`{"type":"join","payload":{"channelId":1e300}}`, bad);
  });

  it("applies to leave and send as well", () => {
    expectError(JSON.stringify({ type: "leave", payload: { channelId: 0 } }), bad);
    expectError(send({ channelId: 0, body: "hi" }), bad);
  });
});

describe("parseClientMessage: send body", () => {
  const bad = `body must be 1-${MAX_BODY_LENGTH} characters`;

  it("rejects a missing or non-string body", () => {
    expectError(send({ channelId: 1 }), "body must be a string");
    expectError(send({ channelId: 1, body: 5 }), "body must be a string");
    expectError(send({ channelId: 1, body: null }), "body must be a string");
  });

  it("rejects an empty or whitespace-only body", () => {
    expectError(send({ channelId: 1, body: "" }), bad);
    expectError(send({ channelId: 1, body: "   \n\t " }), bad);
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(parseClientMessage(send({ channelId: 1, body: "a".repeat(MAX_BODY_LENGTH) })).ok).toBe(
      true,
    );
    expectError(send({ channelId: 1, body: "a".repeat(MAX_BODY_LENGTH + 1) }), bad);
  });

  it("counts characters, not UTF-16 units: an emoji is one character", () => {
    // "😀".length is 2 in JavaScript but Postgres char_length counts 1, and the
    // database CHECK is what this limit has to agree with.
    expect(parseClientMessage(send({ channelId: 1, body: "😀".repeat(MAX_BODY_LENGTH) })).ok).toBe(
      true,
    );
    expectError(send({ channelId: 1, body: "😀".repeat(MAX_BODY_LENGTH + 1) }), bad);
  });

  it("applies the length limit after trimming", () => {
    const padded = ` ${"a".repeat(MAX_BODY_LENGTH)} `;
    expect(parseClientMessage(send({ channelId: 1, body: padded })).ok).toBe(true);
  });
});

describe("limits", () => {
  it("leaves room for the largest legal message inside one frame", () => {
    // 2000 four-byte characters plus the JSON envelope must fit in the frame
    // size ws enforces, or a legal message would be rejected by maxPayload.
    const largest = send({ channelId: 9007199254740991, body: "😀".repeat(MAX_BODY_LENGTH) });
    expect(Buffer.byteLength(largest, "utf8")).toBeLessThan(MAX_FRAME_BYTES);
  });
});
