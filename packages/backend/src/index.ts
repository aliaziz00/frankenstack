import "dotenv/config";
import express from "express";
import cors from "cors";
import { urlsRouter } from "./routes/urls.js";
import { redirectRouter } from "./routes/redirect.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/urls", urlsRouter);
// Mounted last, at the root: any single-segment path that isn't matched
// above (/health, /api/*) is treated as a short code lookup. This is what
// lets short links look like http://host/abc123 instead of
// http://host/r/abc123.
app.use("/", redirectRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
