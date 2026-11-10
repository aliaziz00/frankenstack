// The wire format for the chat WebSocket (see DECISIONS.md D-019).
//
// Every frame is a JSON text object shaped { type, payload }. Client frames
// are untrusted input: anything can arrive (bad JSON, unknown types, wrong
// field types), so parseClientMessage() validates by hand and returns either
// a typed message or an error string, and never throws.

// Frames larger than this are rejected by `ws` itself, which closes the
// connection (code 1009) before we ever see the data. Sized for the largest
// legal message: 2000 characters can be up to ~8 KB in UTF-8, plus the JSON
// around it.
export const MAX_FRAME_BYTES = 16 * 1024;

// Matches the CHECK constraint on chat_messages.body. The database stays the
// backstop; we reject earlier so the client gets a clear error.
export const MAX_BODY_LENGTH = 2000;

export type ClientMessage =
  | { type: "join"; payload: { channelId: number } }
  | { type: "leave"; payload: { channelId: number } }
  | { type: "send"; payload: { channelId: number; body: string } };

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Ids are positive integers, and Number.isSafeInteger also rules out values
// past 2^53 that JSON.parse would have silently rounded.
function isChannelId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseClientMessage(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail("frame is not valid JSON");
  }

  if (!isRecord(data)) return fail("frame must be a JSON object");
  if (typeof data.type !== "string") return fail("type must be a string");
  if (!isRecord(data.payload)) return fail("payload must be an object");

  const { payload } = data;

  switch (data.type) {
    case "join":
    case "leave": {
      if (!isChannelId(payload.channelId)) {
        return fail("channelId must be a positive integer");
      }
      return {
        ok: true,
        message: { type: data.type, payload: { channelId: payload.channelId } },
      };
    }

    case "send": {
      if (!isChannelId(payload.channelId)) {
        return fail("channelId must be a positive integer");
      }
      if (typeof payload.body !== "string") {
        return fail("body must be a string");
      }
      const body = payload.body.trim();
      // Spread counts code points, like Postgres char_length. `.length`
      // counts UTF-16 units, so an emoji would count as 2 and we would
      // reject messages the database accepts.
      const length = [...body].length;
      if (length < 1 || length > MAX_BODY_LENGTH) {
        return fail(`body must be 1-${MAX_BODY_LENGTH} characters`);
      }
      return {
        ok: true,
        message: { type: "send", payload: { channelId: payload.channelId, body } },
      };
    }

    default:
      return fail(`unknown type "${data.type}"`);
  }
}

// What the server sends to a client. Errors only for now; "message" (a chat
// message delivered to a channel) arrives with broadcasting.
export type ServerMessage = { type: "error"; payload: { message: string } };

export function errorMessage(message: string): ServerMessage {
  return { type: "error", payload: { message } };
}

// Turns one raw WebSocket frame into a ParseResult. This protocol is JSON
// text only (D-019), so a binary frame is rejected like any other bad input:
// an error reply, and the connection stays open (D-028).
// `data` is typed by what it must do (be turned into text) rather than as ws's
// RawData, so this module stays free of the ws import.
export function parseFrame(data: { toString(): string }, isBinary: boolean): ParseResult {
  if (isBinary) return fail("binary frames are not supported");
  return parseClientMessage(data.toString());
}
