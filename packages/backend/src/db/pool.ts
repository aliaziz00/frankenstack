import { Pool } from "pg";
import { config } from "../config.js";

// A connection pool, not one connection per request: opening a Postgres
// connection is relatively expensive (TCP + TLS + auth handshake), so we
// keep a small set of connections open and hand them out to whichever
// request needs one. This is the same idea behind connection pooling in
// every backend framework/ORM you'll meet later.
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on("error", (err) => {
  // A background/idle client hit an error (e.g. DB restarted). Log it
  // instead of crashing the whole process for a single bad connection.
  console.error("Unexpected error on idle Postgres client", err);
});
