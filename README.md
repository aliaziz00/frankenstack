# 🧟 frankenstack

A personal system-design lab: one growing app, stitched together limb by
limb, each new feature picked because it forces a specific system-design
concept to become real instead of theoretical. Built for learning system
design concepts ahead of interviews — see [CONCEPTS.md](./CONCEPTS.md) for
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
        App.tsx             # UI
        api.ts               # typed fetch client
```

## Local setup

1. **Start Postgres:**
   ```bash
   npm run db:up
   ```
2. **Install dependencies** (from repo root — installs both workspaces):
   ```bash
   npm install
   ```
3. **Apply the schema:**
   ```bash
   npm run db:migrate
   ```
4. **Run the backend** (http://localhost:4000):
   ```bash
   npm run dev:backend
   ```
5. **Run the frontend** (http://localhost:5173), in another terminal:
   ```bash
   npm run dev:frontend
   ```

The frontend's Vite dev server proxies `/api/*` to the backend (see
`packages/frontend/vite.config.ts`), so the browser only ever talks to one
origin. Short links themselves (`GET /:code`) are served directly from the
backend, since a real short link has to be a URL you can hand to anyone —
see `BACKEND_ORIGIN` in `packages/frontend/src/api.ts`.

Backend config lives in `packages/backend/.env` (already filled in for the
local Docker Postgres — copy `.env.example` if you ever need to point it
somewhere else).

## Feature 1: URL shortener

`POST /api/urls`, `GET /api/urls`, `GET /:code` (redirect), on the `urls`
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
