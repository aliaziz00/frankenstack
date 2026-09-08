# Roadmap

Candidate next limbs, roughly ordered by how naturally they follow from
what exists. Not a commitment — pull whichever teaches the concept you
want to focus on next. Each one should earn a new section in
[CONCEPTS.md](./CONCEPTS.md) once built.

## Natural next steps on the URL shortener

- **Caching layer (Redis)** — cache short_code → long_url in front of
  Postgres for the redirect hot path. Teaches cache-aside, invalidation,
  and cache-vs-DB consistency (what happens if the cache and DB disagree).
- **Rate limiting** — stop one client from hammering `POST /api/urls`.
  Teaches token bucket / sliding window algorithms, and where to enforce
  it (app middleware vs. a gateway).
- **Analytics on clicks** — referrer, timestamp, rough geo per click.
  Small step toward write-heavy/read-heavy split and time-series data.
- **Real migration tool** (node-pg-migrate or similar) — once the schema
  needs to change under data that already exists, not just be reapplied
  from scratch. Teaches forward/backward migrations and versioning schema
  changes safely.
- **Custom short codes + collision handling** — user-supplied alias
  instead of an auto-generated one; teaches handling the collision case
  the current design avoids by construction.

## Bigger new limbs (new feature, new concepts)

- **Auth (sessions or JWT)** — most other features benefit from having a
  real user model. Teaches session storage vs. stateless tokens, and where
  each fails under horizontal scaling.
- **Mini feed/social feature** — posts, follows, a feed. Teaches
  fan-out-on-write vs. fan-out-on-read, and read-heavy feed generation at
  scale.
- **Background jobs / message queue** (e.g. BullMQ + Redis, or a raw
  Postgres-backed queue) — offload slow work (e.g. sending a notification,
  processing an upload) out of the request path. Teaches async processing,
  retries, and at-least-once vs. exactly-once delivery.
- **File uploads** — direct-to-storage (S3-compatible/minio) uploads with
  presigned URLs, instead of routing file bytes through the API server.
  Teaches why you don't proxy large blobs through your app tier.
- **Search** — full-text search (Postgres `tsvector` first, maybe
  Elasticsearch/Meilisearch later) over whatever content exists by then.
  Teaches indexing trade-offs beyond a plain b-tree.
- **Real-time feature (WebSockets/SSE)** — live click counts, live feed
  updates, or a tiny chat. Teaches stateful connections and how that
  interacts with horizontal scaling (sticky sessions, pub/sub fan-out).

## Infrastructure / cross-cutting (apply once there's more than one feature)

- **Read replicas** — split reads/writes against Postgres, simulate
  replication lag, and see what breaks when a client reads its own
  just-written data from a stale replica.
- **Sharding / partitioning** — once one table's growth patterns actually
  motivate it; revisit the base62 ID scheme's shard-collision problem
  noted in CONCEPTS.md.
- **API gateway / load balancer** — put something (nginx, or a small
  custom proxy) in front of multiple backend instances. Teaches load
  balancing algorithms and health checks.
- **Observability** — structured logging, request tracing, basic metrics
  (request rate, error rate, latency). Teaches what you'd actually want
  paged on in production.
- **Containerize the app itself** (not just Postgres) + docker-compose for
  the whole stack, or a deploy target. Teaches the dev/prod parity problem.
- **Turborepo/Nx** — only once there are enough packages that plain npm
  workspaces stop being enough (slow installs, no build caching/graph).
  Don't reach for this early — see README's "start small" note.

## Format for adding to this list

One bullet: feature name — what it teaches, one sentence. Keep the "why"
short here; the real reasoning goes in CONCEPTS.md once it's built.
