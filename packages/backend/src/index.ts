import { createServer } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import { urlsRouter } from "./routes/urls.js";
import { redirectRouter } from "./routes/redirect.js";
import { chatRouter } from "./routes/chat.js";
import { attachChatSocket } from "./chat/socket.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";

const app = express();

// No CORS middleware on purpose (D-021): the browser only ever talks to one
// origin (the Vite dev proxy, or a reverse proxy in production), so
// cross-origin access is not needed and is not enabled.
app.use(express.json());

// Set by shutdown() further down. Declared here because the readiness probe
// below needs to read it.
let shuttingDown = false;

// Health checks (D-025). Two endpoints because they answer different
// questions, and platforms react to them differently:
//   /health        liveness: "is the process running?" Deliberately checks
//                  nothing else. If this fails the platform RESTARTS us, and
//                  restarting does not fix a database outage.
//   /health/ready  readiness: "can this instance serve traffic?" If this fails
//                  the platform stops routing to us but leaves us running.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const READINESS_TIMEOUT_MS = 2_000;

app.get("/health/ready", async (_req, res) => {
  // Fail readiness once shutdown has started. Known limit (D-025): shutdown()
  // calls server.close() immediately, which refuses new connections and closes
  // idle keep-alive ones, so in practice this branch is rarely reached. It only
  // becomes a real "drain" signal if shutdown waits a few seconds, still
  // serving, between flipping this flag and calling server.close().
  if (shuttingDown) {
    return res
      .status(503)
      .json({ status: "unavailable", checks: { server: "shutting down" } });
  }

  // pg has no per-query timeout, so race the query against a timer: an
  // unreachable database must produce a fast 503, not a probe that hangs.
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`no response within ${READINESS_TIMEOUT_MS} ms`)),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
    res.json({ status: "ok" });
  } catch (err) {
    // The real error goes to the log only: connection errors can contain
    // hostnames or credentials, so clients get a fixed body.
    console.error("readiness check failed:", err);
    res.status(503).json({ status: "unavailable", checks: { database: "down" } });
  } finally {
    clearTimeout(timer);
  }
});

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
const wss = attachChatSocket(server);

server.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port}`);
});

// Graceful shutdown (D-024). `docker stop` and most deploy tools send
// SIGTERM, then SIGKILL after a grace period (Docker's default is 10 s);
// Ctrl-C sends SIGINT. Without handlers the process dies instantly: requests
// in flight are cut off, WebSocket clients just see the connection drop, and
// database connections are abandoned.
const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(signal: string) {
  // A second signal while we are already shutting down is ignored.
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Safety net: if a connection refuses to close, exit anyway rather than
  // hanging until the platform sends SIGKILL. unref() so the timer itself
  // never keeps the process alive.
  setTimeout(() => {
    console.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  // 1. Stop accepting new connections. The callback runs once every
  //    existing connection has ended, i.e. in-flight requests have finished
  //    and the WebSocket clients below have closed.
  server.close(async () => {
    try {
      // 3. Close the pool last: requests that were still running needed it.
      await pool.end();
      console.log("shutdown complete");
      process.exit(0);
    } catch (err) {
      console.error("error closing the database pool:", err);
      process.exit(1);
    }
  });

  // 2. Close WebSocket clients with 1001 ("going away"). Upgraded sockets
  //    count as open connections, so server.close() would wait on them
  //    forever. The code also tells clients this was a restart, not a crash,
  //    so they know to reconnect.
  for (const client of wss.clients) {
    client.close(1001, "server shutting down");
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
