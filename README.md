# 🧟 frankenstack

[![CI](https://github.com/aliaziz00/frankenstack/actions/workflows/ci.yml/badge.svg)](https://github.com/aliaziz00/frankenstack/actions/workflows/ci.yml)

A personal system-design lab and portfolio site: one growing app where each
system is a self-contained "lab" with a live demo, the requirements it was
built against, the design trade-offs, and where it breaks first. Each lab is
picked because it forces a specific system-design concept to become real
instead of theoretical — see [CONCEPTS.md](./CONCEPTS.md) for
what's been covered so far and [ROADMAP.md](./ROADMAP.md) for what's next.

## Stack

- **Frontend:** React + TypeScript, [Vite](https://vite.dev) dev server
- **Backend:** Express + TypeScript (`packages/backend`)
- **Database:** PostgreSQL, run locally via Docker

npm workspaces tie `packages/frontend` and `packages/backend` together
under one repo — no extra monorepo tooling (Turborepo/Nx) yet. That's a
deliberate "start small" choice; see ROADMAP.md for when that might change.

## Project structure

```
frankenstack/
  docker-compose.yml       # Postgres for local dev
  packages/
    backend/
      src/
        index.ts           # Express app entrypoint
        routes/             # one file per resource
        db/                 # pool + schema + migration runner
        lib/                 # pure helper functions (e.g. base62)
    frontend/
      src/
        App.tsx             # router + site shell
        pages/              # Home (lab index), LabPage (demo + design write-up)
        labs/
          registry.ts       # one entry per system: metadata + design notes
          url-shortener/    # a lab = demo component + its API client
```

## Local setup

1. **Create your env files** (both are gitignored; never commit them). Set
   the same password in both:
   ```bash
   cp .env.example .env                                     # set POSTGRES_PASSWORD
   cp packages/backend/.env.example packages/backend/.env   # put it in DATABASE_URL
   ```
2. **Start Postgres:**
   ```bash
   npm run db:up
   ```
3. **Install dependencies** (from repo root — installs both workspaces):
   ```bash
   npm install
   ```
4. **Apply the schema:**
   ```bash
   npm run db:migrate
   ```
5. **Run the backend** (http://localhost:4000):
   ```bash
   npm run dev:backend
   ```
6. **Run the frontend** (http://localhost:5173), in another terminal:
   ```bash
   npm run dev:frontend
   ```

The frontend's Vite dev server proxies `/api/*` to the backend (see
`packages/frontend/vite.config.ts`), so the browser only ever talks to one
origin. Short links (`GET /s/:code`) are proxied the same way; they live
under `/s` so the site root stays free for the frontend on a single domain.

Config lives in two gitignored files: the root `.env` (read by Docker Compose
for the Postgres password) and `packages/backend/.env` (the backend's
`DATABASE_URL`, `PORT`, `BASE_URL`). Postgres only applies `POSTGRES_PASSWORD`
when it first creates its data volume, so changing it later means running
`ALTER USER` inside the container, or recreating the volume.

## CI

GitHub Actions runs on every pull request into `main` and on every push to
`main` (see `.github/workflows/ci.yml`):

- **checks:** `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- **audit:** `npm audit --audit-level=high` (fails on high or critical advisories only)

Run the same commands locally before opening a PR:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Tests use [Vitest](https://vitest.dev) and live next to the code as `*.test.ts`.
They need no database: they cover pure logic (ID encoding, request validation,
the WebSocket message parser, the frontend fetch wrapper). `npm run test:watch`
inside a package re-runs them as you edit.

Known, accepted advisories: React Router (moderate; the fix is a breaking v7
upgrade) and the ESLint toolchain's `minimatch` (moderate, dev-only; waiting on
upstream). Neither blocks CI.

## Adding a new system

1. Create `packages/frontend/src/labs/<slug>/` with a `Demo.tsx`.
2. Add an entry to `labs/registry.ts` (summary, concepts, design notes).
3. Add backend routes under `/api/<slug>` and any schema to `schema.sql`.
4. Add a section to CONCEPTS.md.

## Feature 1: URL shortener

`POST /api/urls`, `GET /api/urls`, `GET /s/:code` (redirect), on the `urls`
table. Chosen as the seed feature because it's a small surface area that
still touches several core system-design ideas — see
[CONCEPTS.md](./CONCEPTS.md) for what each piece is teaching.

## Scripts (from repo root)

| Script              | Description                              |
| -------------------- | ----------------------------------------- |
| `npm run db:up`      | Start the Postgres container              |
| `npm run db:down`    | Stop it                                   |
| `npm run db:migrate` | Apply `schema.sql` to the database        |
| `npm run dev:backend`  | Start the Express API with hot reload   |
| `npm run dev:frontend` | Start the Vite dev server               |
| `npm test`           | Run the unit tests in both packages       |
| `npm run lint`       | ESLint across the repo                    |
| `npm run typecheck`  | TypeScript, both packages (tests included) |
| `npm run build`      | Production build of both packages         |
