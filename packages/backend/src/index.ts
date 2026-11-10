import "dotenv/config";
import { createServer } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { urlsRouter } from "./routes/urls.js";
import { redirectRouter } from "./routes/redirect.js";
import { chatRouter } from "./routes/chat.js";
import { attachChatSocket } from "./chat/socket.js";

const app = express();

// No CORS middleware on purpose (D-021): the browser only ever talks to one
// origin (the Vite dev proxy, or a reverse proxy in production), so
// cross-origin access is not needed and is not enabled.
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/urls", urlsRouter);
app.use("/api/chat", chatRouter);
// Short links live under /s so the site root stays free for the frontend
// when everything is served from one domain behind a reverse proxy.
app.use("/s", redirectRouter);

// Anything that matched no route above: a JSON 404 instead of Express's
// default HTML page, so API clients always get the same { error } shape.
app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Central error handler. Express 5 forwards both thrown errors and rejected
// promises from async routes here. It must be registered last, and it must
// declare all four parameters: that is how Express recognises an error
// handler, even though `next` is unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Errors raised by Express itself (e.g. malformed JSON from the body
  // parser) carry a 4xx `status`: pass those through. Anything else is our
  // bug or a failing dependency, so it is a 500.
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;

  if (status === 500) {
    // The real error goes to the server log only; clients never see SQL
    // text, file paths or stack traces.
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  }
  res.status(status).json({ error: err.message });
};
app.use(errorHandler);

// app.listen() would create the HTTP server for us, but we need a handle on
// it so the WebSocket layer can listen for upgrade requests on the same port.
const server = createServer(app);
attachChatSocket(server);

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
