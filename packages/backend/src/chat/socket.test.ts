import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WebSocket, type WebSocketServer } from "ws";
import { MAX_FRAME_BYTES } from "./protocol.js";
import { attachChatSocket } from "./socket.js";

// These tests start the real WebSocket server on an ephemeral port and talk to
// it with a real client. No database is involved: socket.ts does not import
// the pool.

let server: Server;
let wss: WebSocketServer;
let url: string;
const open: WebSocket[] = [];

beforeAll(async () => {
  // The server logs every connection; keep the test output readable.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  server = createServer();
  wss = attachChatSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const ws of open.splice(0)) ws.terminate();
});

afterAll(async () => {
  for (const client of wss.clients) client.terminate();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function timeout<T>(ms: number, what: string): Promise<T> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${ms} ms waiting for ${what}`)), ms),
  );
}

async function connect(path = "/ws"): Promise<WebSocket> {
  const ws = new WebSocket(url + path);
  open.push(ws);
  await Promise.race([
    new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    }),
    timeout<void>(2000, "the connection to open"),
  ]);
  return ws;
}

// The next frame from the server, with whether it was binary.
function nextFrame(ws: WebSocket): Promise<{ message: unknown; isBinary: boolean }> {
  return Promise.race([
    new Promise<{ message: unknown; isBinary: boolean }>((resolve) =>
      ws.once("message", (data, isBinary) =>
        resolve({ message: JSON.parse(data.toString()), isBinary }),
      ),
    ),
    timeout<never>(2000, "a message from the server"),
  ]);
}

async function nextMessage(ws: WebSocket) {
  return (await nextFrame(ws)).message;
}

// Resolves true if the server sent nothing within `ms`.
function stayedSilent(ws: WebSocket, ms = 150): Promise<boolean> {
  return new Promise((resolve) => {
    const onMessage = () => resolve(false);
    ws.once("message", onMessage);
    setTimeout(() => {
      ws.off("message", onMessage);
      resolve(true);
    }, ms);
  });
}

function closeCode(ws: WebSocket): Promise<number> {
  return Promise.race([
    new Promise<number>((resolve) => ws.once("close", (code) => resolve(code))),
    timeout<number>(2000, "the connection to close"),
  ]);
}

const err = (message: string) => ({ type: "error", payload: { message } });

// ---------------------------------------------------------------------------
// the endpoint
// ---------------------------------------------------------------------------

describe("/ws endpoint", () => {
  it("accepts a connection on /ws", async () => {
    const ws = await connect();
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it("rejects an upgrade on any other path", async () => {
    await expect(connect("/nope")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// bad frames: an error reply, and the connection stays open (D-028)
// ---------------------------------------------------------------------------

describe("bad frames", () => {
  it("replies with an error for text that is not JSON", async () => {
    const ws = await connect();
    ws.send("hello");
    expect(await nextMessage(ws)).toEqual(err("frame is not valid JSON"));
  });

  it("replies with an error for an unknown message type", async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ type: "nuke", payload: {} }));
    expect(await nextMessage(ws)).toEqual(err('unknown type "nuke"'));
  });

  it("replies with the validation error for a bad payload", async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ type: "join", payload: { channelId: 0 } }));
    expect(await nextMessage(ws)).toEqual(err("channelId must be a positive integer"));
  });

  it("replies with an error for a binary frame", async () => {
    const ws = await connect();
    ws.send(Buffer.from(JSON.stringify({ type: "join", payload: { channelId: 1 } })), {
      binary: true,
    });
    expect(await nextMessage(ws)).toEqual(err("binary frames are not supported"));
  });

  it("keeps the connection open and usable after bad frames", async () => {
    const ws = await connect();
    ws.send("one");
    expect(await nextMessage(ws)).toEqual(err("frame is not valid JSON"));
    ws.send(Buffer.from("two"), { binary: true });
    expect(await nextMessage(ws)).toEqual(err("binary frames are not supported"));
    ws.send("[]");
    expect(await nextMessage(ws)).toEqual(err("frame must be a JSON object"));
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it("sends errors as JSON text frames, not binary", async () => {
    const ws = await connect();
    ws.send("hello");
    expect((await nextFrame(ws)).isBinary).toBe(false);
  });

  it("replies only to the client that sent the bad frame", async () => {
    const sender = await connect();
    const bystander = await connect();
    const silent = stayedSilent(bystander);
    sender.send("hello");
    expect(await nextMessage(sender)).toEqual(err("frame is not valid JSON"));
    expect(await silent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// valid frames: nothing is sent back yet (join/leave/send are not built)
// ---------------------------------------------------------------------------

describe("valid frames", () => {
  it.each([
    ["join", { channelId: 1 }],
    ["leave", { channelId: 1 }],
    ["send", { channelId: 1, body: "hi" }],
  ])("accepts %s without an error reply, and keeps the connection", async (type, payload) => {
    const ws = await connect();
    const silent = stayedSilent(ws);
    ws.send(JSON.stringify({ type, payload }));
    expect(await silent).toBe(true);
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
});

// ---------------------------------------------------------------------------
// oversized frames: ws closes the connection (1009); the server must survive
// ---------------------------------------------------------------------------

describe("oversized frames", () => {
  it("closes the offending connection with code 1009", async () => {
    const ws = await connect();
    const closed = closeCode(ws);
    ws.send("x".repeat(MAX_FRAME_BYTES + 1));
    expect(await closed).toBe(1009);
  });

  // Regression test for a crash: ws emits an "error" event for an oversized
  // frame, and with no listener Node throws it as an uncaught exception and
  // takes the whole process down. If the "error" handler in socket.ts goes
  // missing, this test (or the whole run) fails.
  it("keeps serving other clients afterwards", async () => {
    const attacker = await connect();
    const closed = closeCode(attacker);
    attacker.send("x".repeat(MAX_FRAME_BYTES * 2));
    await closed;

    const survivor = await connect();
    survivor.send("hello");
    expect(await nextMessage(survivor)).toEqual(err("frame is not valid JSON"));
  });

  it("accepts a frame of exactly the limit (it is only a bad frame)", async () => {
    const ws = await connect();
    ws.send("x".repeat(MAX_FRAME_BYTES));
    expect(await nextMessage(ws)).toEqual(err("frame is not valid JSON"));
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
});
