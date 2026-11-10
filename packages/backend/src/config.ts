// The one place the backend reads environment variables (see D-023).
//
// Importing this module loads packages/backend/.env (a no-op if the file is
// absent, e.g. in production where the platform supplies real environment
// variables) and validates the result once, at startup. A missing or invalid
// value stops the process with a clear message, instead of the server
// starting "healthy" and failing on every request later.
import "dotenv/config";

function fail(message: string): never {
  console.error(`Configuration error: ${message}`);
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name];
  // An empty string counts as missing: `DATABASE_URL=` in a .env file is a
  // set-but-blank variable, which is almost always a mistake.
  if (value === undefined || value.trim() === "") {
    fail(`${name} is required but not set (see .env.example)`);
  }
  return value;
}

function port(): number {
  const raw = process.env.PORT ?? "4000";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    fail(`PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return value;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  port: port(),
  // Optional: when unset, short URLs are built from the incoming request's
  // protocol and host instead.
  baseUrl: process.env.BASE_URL || undefined,
};
