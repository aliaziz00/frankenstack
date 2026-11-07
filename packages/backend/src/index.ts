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
// Short links live under /s so the site root stays free for the frontend
// when everything is served from one domain behind a reverse proxy.
app.use("/s", redirectRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
