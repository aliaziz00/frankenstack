# Decisions log

System design decisions made while building each lab: the options, the
trade-offs, and what was chosen. Only design decisions go here (architecture,
data model, API shape, scaling trade-offs), not tooling or workflow choices.
See [CONCEPTS.md](./CONCEPTS.md) for the concepts behind them.

Entry format:

```
### D-000 Title
Lab · Status
**Options**: each option with its trade-offs; the chosen one is marked.
**Decision:** what was chosen.
**Why:** the reasoning.
```

The URL shortener and platform entries were backfilled from the code and its
comments, so the wording is reconstructed; the Chat entries were recorded as
they were decided.

---

## Platform

### D-001 Lab registry: one folder plus one entry per system
Platform · Decided

**Options**
- **Registry list (chosen):** `labs/registry.ts` holds metadata and design notes per lab; Home and LabPage render from it. Adding a system is a folder plus one entry. Trade-off: a single file everything depends on, and metadata lives in code.
- **Hand-built page per lab:** full freedom per page, but navigation and layout drift and every new lab touches several files.

**Decision:** Registry list.
**Why:** Keeps the portfolio shell generic and makes each new lab cheap to add.

### D-002 Short links under `/s`, API under `/api`
Platform · Decided

**Options**
- **Prefixed paths (chosen):** `/s/:code` for redirects, `/api/*` for the API. The site root stays free for the frontend, so everything can sit on one domain behind a reverse proxy. Trade-off: slightly longer short URLs.
- **Short codes at the root (`/:code`):** shortest URLs, but collides with frontend routes and needs a reserved-word list.

**Decision:** Prefixed paths.
**Why:** One origin for browser and API (no CORS surprises), and no route collisions.

---

## Lab 1: URL shortener

### D-003 Short code = base62 of a database sequence id
URL shortener · Decided

**Options**
- **Base62-encode the auto-increment id (chosen):** simple, guaranteed unique on one database, no collision handling. Trade-offs: reveals roughly how many URLs exist, codes are guessable in sequence, and it breaks if writes are sharded across databases.
- **Random string plus collision check:** not guessable, but needs a retry loop and gets slower as the keyspace fills.
- **Hash of the URL:** same URL gives the same code, but truncation causes collisions and needs handling.

**Decision:** Base62 of the sequence id.
**Why:** Simplest correct option for a single database; revisit when sharding is on the table.

### D-004 Take the id from the sequence before inserting
URL shortener · Decided

**Options**
- **`nextval()` first, then insert id and code together (chosen):** `nextval` is atomic, so concurrent requests get distinct ids with no locking. One insert, no window.
- **Insert a placeholder code, then update with the encoded id:** two steps, and concurrent inserts can collide on the placeholder (the original version's race).

**Decision:** `nextval` before insert.
**Why:** Removes a race condition by construction.

### D-005 Count clicks with one atomic UPDATE
URL shortener · Decided

**Options**
- **`UPDATE … SET click_count = click_count + 1 … RETURNING` (chosen):** the database serialises concurrent updates, so no clicks are lost. Trade-off: every redirect is a write to a hot row, which becomes a bottleneck at high traffic.
- **Read, add one in the app, write back:** simple to read, but concurrent requests overwrite each other and lose counts.
- **Buffer counts in memory or a queue and flush in batches:** removes the hot-row write, but adds complexity and can lose counts on a crash.

**Decision:** Atomic UPDATE.
**Why:** Correct and simple at this scale; batching is the known next step.

### D-006 The unique constraint is the lookup index
URL shortener · Decided

**Options**
- **`unique` on `short_code` (chosen):** enforces uniqueness and gives a b-tree index for the redirect lookup in one declaration.
- **Plain column plus a separate index:** two objects doing overlapping work.
- **No index:** lookups degrade to a full table scan as the table grows.

**Decision:** `unique` constraint.
**Why:** Redirect is the hot path and must be an index lookup.

### D-007 Redirect with 302, not 301
URL shortener · Decided

**Options**
- **302 temporary (chosen):** browsers don't cache it, so every click reaches the server and is counted. Trade-off: more load on the server.
- **301 permanent:** cacheable by browsers and CDNs, so it is faster and cheaper, but repeat clicks never reach the server and analytics undercount.

**Decision:** 302.
**Why:** Click counting is a feature; correctness of the count outweighs caching.

### D-008 Pool database connections
URL shortener · Decided

**Options**
- **Shared `pg` Pool (chosen):** a bounded set of connections is reused, so each request avoids connection setup and Postgres isn't flooded with connections. Trade-off: the pool size has to be tuned, and requests queue when it's exhausted.
- **A new connection per request:** simplest, but slow and it exhausts Postgres's connection limit under load.

**Decision:** One shared pool.
**Why:** Standard practice; connection setup is expensive.

---

## Lab 2: Chat

### D-009 MVP scope: channels with live messages
Chat · Decided

**Options**
- **Channels + live messages (chosen):** the smallest recognisable Slack. Covers WebSocket fan-out, persistence and history paging.
- **Add presence and typing:** ephemeral state outside Postgres (memory or Redis); more event types.
- **Add threads and DMs:** richer data modelling, roughly double the schema and UI work.
- **Channels with polling:** quickest, but skips real-time delivery, the main lesson.

**Decision:** Channels and live messages.
**Why:** Smallest scope that teaches real-time delivery; presence, threads and DMs can be added later.

### D-010 Identity: display name, no login
Chat · Decided

**Options**
- **Display name only (chosen):** no passwords or sessions; easy to impersonate, which is fine for a demo.
- **Real accounts:** teaches auth, but it is a project of its own and delays the chat design.
- **Anonymous server-assigned guest names:** zero friction, but identity changes on refresh unless stored.

**Decision:** Display name only; auth can be its own lab.
**Why:** Keeps focus on messaging.

### D-011 Real-time transport: WebSockets with `ws`
Chat · Decided

**Options**
- **WebSockets via `ws` (chosen):** bidirectional and low latency, the standard interview answer. Connections, heartbeats and reconnection are managed by hand.
- **Socket.IO:** rooms and reconnect built in, faster to build, but hides the mechanics.
- **Server-Sent Events plus POST to send:** simple, proxy-friendly HTTP, but one-directional.

**Decision:** `ws`.
**Why:** Maximises learning of the real mechanics.

### D-012 Data model: separate users table
Chat · Decided

**Options**
- **`chat_users`, `chat_channels`, `chat_messages` (chosen):** normalised; messages reference a user id, so auth can be added later without reshaping messages. Cost: one more table and a join on reads.
- **Author name stored on each message:** simplest, but names are free text with no identity, and adding auth later means a migration.

**Decision:** Normalised with a users table.
**Why:** The real shape of the problem, and it extends cleanly.

### D-013 Primary keys: `bigserial` on every table
Chat · Decided

**Options**
- **`bigserial` everywhere (chosen):** one rule, foreign keys match their targets, and ids sort by insertion. Cost: 4 extra bytes per row versus `serial`. Caveat: ids are allocated in order but can commit out of order, so a "give me everything after id N" cursor could miss a row at scale.
- **`bigserial` on messages, `serial` elsewhere:** smaller foreign keys in the big table, but mixed types.
- **UUIDs:** not guessable and good when ids appear in URLs, but they don't sort by time and are larger.
- **`GENERATED ALWAYS AS IDENTITY`:** the modern SQL-standard form with the same behaviour; not used, to match the existing schema.

**Decision:** `bigserial` on all tables.
**Why:** Consistent, overflow-proof, and matches the shortener's schema.

### D-014 Display names are not unique
Chat · Decided

**Options**
- **Not unique (chosen):** no "name taken" case and no one locked out of a name. Two users can look identical, so the row id is the identity.
- **Unique:** unambiguous names, but with no login anyone can claim a name and the next person is blocked.

**Decision:** Not unique; every sign-in creates a new user row and the client stores the id.
**Why:** With no login a name is a label, not an identity.

### D-015 Foreign keys without cascade
Chat · Decided

**Options**
- **No `on delete cascade` (chosen):** deleting a channel that has messages is refused, so history can't be wiped by accident.
- **Cascade:** convenient cleanup, but one delete can silently remove a lot of data.

**Decision:** No cascade.
**Why:** Safe default; no delete feature exists yet.

### D-016 History paging: cursor, not offset
Chat · Decided

**Options**
- **Cursor on message id, `before=<id>` (chosen):** fast at any depth because the index `(channel_id, id DESC)` jumps straight to the position, and stable while new messages arrive. Cost: no jumping to an arbitrary page.
- **Offset (`limit`/`offset`):** simple and supports page numbers, but slows with depth (it walks and discards rows) and shifts or repeats rows as new ones arrive.

**Decision:** Cursor paging, newest first.
**Why:** Chat is append-heavy and read from the newest end, where offset's weaknesses show most.

### D-017 History API contract: flat shape, bounded limit, 404
Chat · Decided

**Options**
- **Flat message with the display name joined in (chosen):** the client renders it directly. The alternative, ids only, needs a second lookup per message.
- **Default 50, max 100, `400` on invalid input (chosen):** callers can't pull the whole table in one call, and mistakes are visible. The alternative, silent clamping, hides bugs.
- **`404` for an unknown channel (chosen):** a typo isn't mistaken for an empty channel, at the cost of one extra lookup. The alternative is an empty list.

**Decision:** As marked above.
**Why:** Clear contract, bounded cost per request.

### D-018 Ids in the API are JSON numbers
Chat · Decided

**Options**
- **Numbers everywhere (chosen):** simplest client code and uniform. Limit: JS numbers are exact only to 2^53 (about 9e15), beyond which ids would be silently rounded. Unreachable for this project.
- **Strings everywhere:** always exact, and the convention at Slack, Discord and Twitter, whose ids exceed 2^53. Slightly more awkward client code.
- **Strings only for messages:** safe where growth is unbounded, but inconsistent, and the "bounded" assumption is fragile.

**Decision:** Numbers everywhere, with the limit noted in the code.
**Why:** Simplicity, with the production alternative understood. A production system would use strings.

### D-019 WebSocket message format: typed envelope
Chat · Decided

**Options**
- **Envelope `{ type, payload }` (chosen):** one connection carries every event type, so adding typing or presence later is a new `type`, not a new structure. One place to validate (check `type`, then that type's payload), and a clean TypeScript discriminated union. Matches Discord's gateway and Slack's events. Cost: one extra nesting level, and the payload must be checked against its type.
- **One socket per channel (`/ws/channels/1`):** the URL carries the routing, so no `join` is needed, but a user in 10 channels holds 10 connections (server memory, browser per-host limits), and non-message events have nowhere to go.
- **Flat objects with an `action` field:** slightly less nesting, but routing fields and data share one namespace, and it degrades into an envelope without the structure as events are added.

**Decision:** Envelope, JSON text frames. Client to server: `join`, `leave`, `send`. Server to client: `message`, `error`.
**Why:** Keeps one connection per user and leaves room for more event types.

**At larger scale (not built):** binary schema'd encoding (Protobuf) with versioning for old clients, compression, per-user inbox subscriptions with multi-device fan-out, acks and sequence numbers for reliable delivery, push notifications for offline users, end-to-end encrypted payloads, and separating droppable events (typing, presence) from durable messages. The harder scaling problem is routing a message to whichever server holds the recipient's socket (shared pub/sub), not the format.

---

## Platform: backend robustness

### D-020 Async route errors: upgrade to Express 5
Platform · Decided

**Options**
- **Upgrade to Express 5 (chosen):** rejected promises from async routes are forwarded to the error handler natively, with no helper code and no extra package. Express 5 is the `latest` npm tag (5.3.0), so it is also where new projects start. Cost: a major-version upgrade. A scratch trial found no code changes were needed (route paths here are simple); the one visible difference is the default query parser, which no longer builds nested objects from `a[b]=1`.
- **Small `asyncHandler` wrapper on Express 4:** no dependency and explicit, but every route must be wrapped (easy to forget on a new one), and it is throwaway code once on Express 5.
- **`express-async-errors` package:** one import and no route changes, but it monkey-patches Express internals to work around an Express 4 limitation.
- **`try/catch` in every route:** fully explicit, but repetitive and easy to forget.

**Decision:** Express 5.3.0.
**Why:** It fixes the problem at the framework level instead of working around it. On Express 4 a rejected async route either crashed the process (Node's default for an unhandled rejection) or left the request hanging forever if a global `unhandledRejection` listener swallowed it. On Express 5 the client gets a `500` and the server keeps running.

**Still needed:** Express 5's default error responses are HTML, and outside production they include the stack trace and server file paths. A malformed JSON body also gets an HTML `400`. A central error middleware that returns the API's `{ "error": "…" }` shape (and logs real errors server-side only) is the next step.

**Error handler choices (recorded with the upgrade):** the central handler passes through a 4xx `status` that an error carries (so a malformed JSON body stays `400` and an oversized one `413`), and treats everything else as `500`. A `500` replies with a generic `{ "error": "internal server error" }` and logs the real error server-side only, so SQL text, file paths and stack traces never reach clients. Unknown routes get a JSON `404`. Express's defaults were rejected because they reply with HTML and, outside production, expose stack traces.

### D-021 No CORS: single origin
Platform · Decided

**Options**
- **Remove CORS (chosen):** the browser only ever talks to one origin (the Vite dev proxy locally, a reverse proxy in production, per D-002), so cross-origin access isn't needed. Smallest attack surface, and one less dependency. Cost: a browser page on a different origin cannot call the API, so a split-domain deployment would need CORS added back.
- **Allowlist from an env var (`CORS_ORIGINS`):** the usual production answer when the frontend lives on its own domain; restrictive and flexible, but more configuration and one more value to validate.
- **Keep `cors()` open (`*`):** nothing to do, and low risk while there is no login, but any website can make a visitor's browser call the API, and it becomes unsafe once credentials are involved.

**Decision:** No CORS middleware; `cors` and `@types/cors` removed.
**Why:** It matches D-002 and the code's actual behavior. CORS is enforced by browsers only (curl and Postman ignore it), so the old "for curl/Postman use" comment was wrong.

**Related, not covered by CORS:** WebSocket handshakes ignore CORS. Browsers send an `Origin` header on the upgrade, but nothing enforces it, so the server has to check it (cross-site WebSocket hijacking). Low impact with no auth; to be decided with the connection logic.

### D-022 Maximum URL length: 2048 characters
URL shortener · Decided

**Options**
- **2048 characters (chosen):** the de-facto practical ceiling for URLs; browsers, CDNs and many servers reject or truncate anything longer, so a longer stored URL often would not work when redirected to anyway.
- **8192 characters:** roomier and in line with common web-server limits, but more storage per row and more data in every list response.
- **No limit:** only the 100 KB JSON body cap applies, so a client can store a 100 KB URL that is then served back in every list response.

**Decision:** 2048, checked in the API (`POST /api/urls` returns `400` above it).
**Why:** It bounds row size and response size at the edge with a number that matches real-world URL limits.

**Database backstop (decided: none):** no matching `CHECK` on `urls.long_url`, unlike chat message length. Only the API enforces the limit. Trade-off: anything that bypasses the API (a script, a future route, a manual `INSERT`) can store a longer URL. Adding the constraint later needs a guarded `alter table` in `schema.sql`, since there is no migration tool.
