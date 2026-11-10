import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { MAX_FRAME_BYTES } from "./protocol.js";

// Attaches a WebSocket endpoint at /ws to an existing HTTP server.
//
// A WebSocket connection starts life as a normal HTTP request carrying
// `Upgrade: websocket`. Node's http server emits that as an "upgrade" event
// instead of routing it through Express, so we handle it ourselves: if the
// path is /ws we complete the handshake (HTTP 101 Switching Protocols) and
// from then on the same TCP connection speaks the WebSocket protocol.
export function attachChatSocket(server: Server) {
  // noServer: true means "don't open your own port or listen for upgrades;
  // I'll hand you the requests I want you to handle".
  // maxPayload: ws closes any connection that sends a bigger frame (code
  // 1009). The default is ~100 MB, far too much for chat messages.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");

    if (pathname !== "/ws") {
      // Not ours. Close the raw TCP socket so the request doesn't hang.
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    console.log(`ws connected (${wss.clients.size} open)`);
    ws.on("close", () => {
      console.log(`ws closed (${wss.clients.size} open)`);
    });
  });

  return wss;
}
