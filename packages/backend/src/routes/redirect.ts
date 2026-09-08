import { Router } from "express";
import { pool } from "../db/pool.js";

export const redirectRouter = Router();

// GET /:code -> 302 redirect to the long URL, atomically incrementing the
// click counter. `update ... returning` does the read-and-write in one
// round trip at the database, so concurrent redirects can't stomp on each
// other's counter update the way a separate "read count, add one, write
// count" from the app would.
redirectRouter.get("/:code", async (req, res) => {
  const result = await pool.query<{ long_url: string }>(
    "update urls set click_count = click_count + 1 where short_code = $1 returning long_url",
    [req.params.code],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "short code not found" });
  }

  res.redirect(302, result.rows[0].long_url);
});
