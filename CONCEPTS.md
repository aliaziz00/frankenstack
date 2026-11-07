# Concepts log

A running record of what each feature was built to teach — useful as
interview-prep review material later. Newest first.

## Feature 1: URL shortener

| Concept | Where | Notes |
| --- | --- | --- |
| ID generation strategies | `src/lib/base62.ts` | Encode a DB sequence counter vs. generate-random-and-check-for-collisions. We used the counter approach: simple and collision-free on one DB, but codes are sequential/guessable and the scheme breaks if writes ever get sharded (two shards could hand out the same id). A distributed ID generator (Twitter Snowflake-style) is the usual fix — see ROADMAP. |
| Indexing | `src/db/schema.sql` | The redirect path (`GET /s/:code`) is the hot, read-heavy path, so `short_code` needs an index or every redirect is a full table scan as the table grows. A `unique` constraint gives you that index for free — don't also hand-add one, Postgres already built it. |
| Atomicity / race conditions | `src/routes/redirect.ts`, `src/routes/urls.ts` | Click counting uses `update ... set click_count = click_count + 1 ... returning`, one round trip at the DB, instead of read-count/add-one/write-count from the app (which loses updates under concurrent requests — a classic read-modify-write race). ID assignment uses `nextval()` (atomic in Postgres) called *before* the insert, rather than inserting a placeholder and updating it after — the placeholder approach has its own race: two concurrent inserts can collide on the same placeholder value before either gets updated. |
| Connection pooling | `src/db/pool.ts` | One pooled set of connections shared across requests, not one connection per request — opening a Postgres connection (TCP + auth handshake) is comparatively expensive. Same idea every ORM/framework wraps for you. |
| Input validation / basic security | `src/routes/urls.ts` | Reject anything that isn't an `http(s)` URL before storing it, so the redirect endpoint can't be turned into an open redirector for `javascript:`/`data:` payloads. |
| Reverse proxy (dev version) | `packages/frontend/vite.config.ts` | Vite's dev proxy forwards `/api/*` to the backend so the browser only sees one origin — a small-scale stand-in for the gateway/reverse-proxy that would sit in front of both services in production. |
| Routing on one domain | `src/index.ts`, `vite.config.ts` | Short links moved from `/:code` to `/s/:code` so the site root belongs to the frontend. Gotcha hit while doing it: Vite proxy keys are prefix matches, so `'/s'` also captured `/src/main.tsx` and the whole app went blank with 404s. Anchor with `'^/s/'`. Same class of bug as an overly greedy location block in nginx. |
| Migrations (minimal version) | `src/db/migrate.ts` | Currently just (re)applies one idempotent `schema.sql`. Fine with no data to preserve; revisit with a real migration tool once the schema needs to change under real data — see ROADMAP. |

## How to use this file

Every time a new feature/limb gets added to frankenstack, add a section
above (newest on top) with: what was built, and a short table of concept →
file → the actual trade-off reasoning (not just the term). The "why", not
just the buzzword, is what's worth reviewing before an interview.
