import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { urlsRouter } from "./routes/urls.js";
import { redirectRouter } from "./routes/redirect.js";
import { chatRouter } from "./routes/chat.js";
import { attachChatSocket } from "./chat/socket.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/urls", urlsRouter);
app.use("/api/chat", chatRouter);
// Short links live under /s so the site root stays free for the frontend
// when everything is served from one domain behind a reverse proxy.
app.use("/s", redirectRouter);

// app.listen() would create the HTTP server for us, but we need a handle on
// it so the WebSocket layer can listen for upgrade requests on the same port.
const server = createServer(app);
attachChatSocket(server);

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
