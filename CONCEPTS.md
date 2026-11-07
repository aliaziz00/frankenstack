# Concepts log

A running record of what each feature was built to teach — useful as
interview-prep review material later. Newest first.

## Platform: CI, repo protection and secrets hygiene

Not a feature, but the project's delivery pipeline. Every row is a decision
that had real alternatives, with the reasoning for the one chosen.

| Concept | Where | Notes |
| --- | --- | --- |
| CI vs CD | `.github/workflows/ci.yml` | We built continuous integration: every PR and every push to `main` is checked automatically. Continuous delivery (deploying on merge) is deliberately not built yet; it depends on a hosting decision. CI is the safety net CD later relies on, so it comes first. |
| Job layout | `ci.yml` (`checks`, `audit`) | Two jobs, not one and not four. `checks` runs lint, typecheck and build sequentially behind one install; `audit` is separate because it can fail for reasons unrelated to a change (a new advisory published overnight). A separate job means it can be made non-required without losing the other gate. Four parallel jobs would be faster but pay for four installs, which is overkill at this size. |
| Fail-fast ordering | `ci.yml` steps | Cheapest check first: lint, then typecheck, then the slower build. A deliberately broken PR failed at lint and the typecheck and build steps were skipped, which saves minutes and gives the quickest possible signal. |
| Reproducible installs | `npm ci`, `package-lock.json` | `npm ci` installs exactly what the lockfile pins and fails if it disagrees with `package.json`; `npm install` can silently drift. The lockfile was generated on macOS, so there was a real risk it lacked Linux native binaries (esbuild, rollup). It did include them and the first Linux run passed. Worth knowing because it breaks in practice (npm issue 4828). |
| Shared commands | root `package.json` scripts | CI calls `lint`, `typecheck` and `build` by name, the same commands used locally, so "passes on my machine" and "passes in CI" mean the same thing. Calling `tsc` directly inside the workflow would let the two drift apart. |
| Dependency auditing and thresholds | `ci.yml` (`npm audit --audit-level=high`) | Failing on moderate would fail today (accepted dev-only findings), and a gate that is always red gets ignored. High/critical blocks; moderate is reported. Two accepted advisories are documented in the README: React Router (the fix is a breaking v7 upgrade) and the ESLint toolchain's `minimatch` (dev-only, pinned by upstream, unreachable here). Note that npm lists one vulnerable package once per dependent, so one advisory showed up as ten. |
| Patch fixes and two-pass resolution | `npm audit fix` | The non-breaking fixes were patch bumps in the lockfile only. `npm audit fix` needed two passes because the Express fix only became visible after the first. The critical and high findings were in runtime dependencies (Express's `proxy-addr`, `body-parser`), which matter far more than dev-only ones. |
| Branch protection with rulesets | repo ruleset "Protect main" | Rules on `main`: changes must come via a PR, and the `checks` job must pass. Rulesets over classic branch protection because the owner-bypass can be "only through a pull request": nobody pushes straight to `main`, but a PR can still be merged in an emergency. Verified in practice: a PR showed `BLOCKED` while checks ran and `CLEAN` after. Without protection, a red PR was still mergeable. |
| Required approvals = 0 | ruleset | A solo project can't approve its own PR, so requiring an approval would deadlock. The PR requirement still forces CI to run before code lands. A team would require at least one review. |
| Least privilege | `ci.yml` (`permissions: contents: read`) | The workflow's token can only read the repo, so a compromised step couldn't push code or change settings. No secrets are used by CI at all. |
| Supply-chain choices | `ci.yml` (`uses: ...@v7`, `ubuntu-latest`) | Actions are pinned to a major version tag, which is readable but movable; pinning to a commit SHA is stricter and needs Dependabot to stay current. `ubuntu-latest` was accepted knowing GitHub moves the label (a migration to Ubuntu 26 was announced); a pinned image is reproducible but needs manual bumps before end of life. |
| Secrets hygiene | `docker-compose.yml`, `.env.example` | The first commit hardcoded a local DB password. Fix: Compose reads `POSTGRES_PASSWORD` from a gitignored `.env` (`${VAR:?message}` fails loudly if unset), with a committed `.env.example` placeholder. History was left alone because it only protected a throwaway local database, a deliberate trade-off. Rule of thumb: a committed secret can only be rotated, never un-leaked, so stop it at the door and rotate on suspicion. |
| Rotating a DB credential | `ALTER USER` | Postgres reads `POSTGRES_PASSWORD` only when it first initialises the data volume, so changing the environment variable later does nothing to an existing database. Rotating in place means `ALTER USER`, sent over stdin so the password stays out of process arguments and shell history. |
| Verifying a negative | password test | A first check "proved" the old password still worked, but it connected over the container's loopback, which is trusted. A trustworthy check goes through the published port and the real auth path. A test that cannot fail proves nothing. |
| Runtime version hygiene | Node 20 to 26 | Node 20 reached end of life (April 2026) and the machine had three installs, so an old one could silently win on `PATH`. Moving to the current LTS line meant removing the extra install first; otherwise the upgrade would not have taken effect. Check the official release page, not a snippet: an earlier answer used a stale source. |

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
