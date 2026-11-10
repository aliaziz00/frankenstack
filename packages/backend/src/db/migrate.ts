import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";

// A "real" project would use a migration tool (node-pg-migrate, Prisma
// Migrate, Flyway...) that tracks which migrations have already run in a
// version table, so you can evolve the schema over time without wiping
// data. For this first slice we just (re)apply one idempotent schema.sql
// file. Worth revisiting once the schema needs to change under real data --
// see ROADMAP.md.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Schema applied.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
