import { Router } from "express";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { toBase62 } from "../lib/base62.js";

export const urlsRouter = Router();

// A row of the `urls` table as pg returns it: bigint columns arrive as
// strings, and timestamptz columns arrive as Date objects.
interface UrlRow {
  short_code: string;
  long_url: string;
  click_count: string;
  created_at: Date;
}

// Row -> API JSON (snake_case columns to camelCase fields, bigint to number).
function toShortLink(row: UrlRow) {
  return {
    shortCode: row.short_code,
    longUrl: row.long_url,
    clickCount: Number(row.click_count),
    createdAt: row.created_at,
  };
}

// 2048 is the de-facto practical ceiling for URLs: browsers, CDNs and many
// servers reject or truncate anything longer (see D-022). Without a cap, the
// only limit is the 100 KB JSON body parser, and a stored URL is served back
// in every list response.
const MAX_URL_LENGTH = 2048;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    // Restrict to http(s) so nobody can store a `javascript:` or `data:`
    // URL that we then happily redirect a browser to.
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// POST /api/urls  { longUrl } -> create a short link
urlsRouter.post("/", async (req, res) => {
  const { longUrl } = req.body ?? {};

  if (typeof longUrl !== "string" || !isValidHttpUrl(longUrl)) {
    return res.status(400).json({ error: "longUrl must be a valid http(s) URL" });
  }
  if (longUrl.length > MAX_URL_LENGTH) {
    return res
      .status(400)
      .json({ error: `longUrl must be at most ${MAX_URL_LENGTH} characters` });
  }

  // Pull the next id straight from the table's sequence, then encode it and
  // insert id + short_code together in one statement. `nextval()` is
  // atomic -- concurrent requests each get a distinct id with no locking in
  // application code. (An earlier version of this route inserted a
  // placeholder short_code and updated it after encoding the id; that's a
  // race: two concurrent inserts could both try to write the same
  // placeholder and collide on the unique constraint. Handing out the id
  // first avoids the two-step window entirely.)
  const idResult = await pool.query<{ nextval: string }>(
    "select nextval(pg_get_serial_sequence('urls', 'id')) as nextval",
  );
  const id = BigInt(idResult.rows[0].nextval);
  const shortCode = toBase62(id);

  const insertResult = await pool.query<{ created_at: Date }>(
    "insert into urls (id, short_code, long_url) values ($1, $2, $3) returning created_at",
    [id.toString(), shortCode, longUrl],
  );
  const { created_at } = insertResult.rows[0];

  const baseUrl = config.baseUrl ?? `${req.protocol}://${req.get("host")}`;
  res.status(201).json({
    shortCode,
    shortUrl: `${baseUrl}/s/${shortCode}`,
    longUrl,
    clickCount: 0,
    createdAt: created_at,
  });
});

// GET /api/urls -> most recently created links, for the homepage list
urlsRouter.get("/", async (_req, res) => {
  const result = await pool.query<UrlRow>(
    "select short_code, long_url, click_count, created_at from urls order by created_at desc limit 50",
  );
  res.json(result.rows.map(toShortLink));
});

// GET /api/urls/:code/stats -> lookup without incrementing the click count
urlsRouter.get("/:code/stats", async (req, res) => {
  const result = await pool.query<UrlRow>(
    "select short_code, long_url, click_count, created_at from urls where short_code = $1",
    [req.params.code],
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: "short code not found" });
  }
  res.json(toShortLink(result.rows[0]));
});
