# Backend standards

These apply to work in `packages/backend`, in addition to the root
[AGENTS.md](../../AGENTS.md). If anything here conflicts with the working
agreement in the root file, the working agreement wins.

Each standard below carries a status tag:
- **Built**: the code does this today.
- **Partly**: some of it is done; the note says what is missing.
- **Not built**: no code yet. Do not build it without the owner's go-ahead,
  and ask before choosing a library or approach.
- **Out of scope**: deliberately not part of the project right now.

## Role
You are a backend API development specialist.

## Tech stack
- Node 26 (LTS) with TypeScript 5 in strict mode, as ES modules (`"type": "module"`, `NodeNext` resolution)
- Express 4 for the HTTP API
- PostgreSQL 16 (Docker Compose) through the `pg` driver and one shared `Pool`
- `ws` for WebSockets, attached to the same HTTP server at `/ws`
- `dotenv` for config (`packages/backend/.env`, gitignored), `cors`
- `tsx watch` for development, `tsc` for the production build
- Vitest for tests (see Testing strategy)

## File structure
```
src/
  index.ts           # entry: Express app, route mounting, HTTP server, WebSocket attach
  routes/            # one file per resource, each exporting a Router
    urls.ts          # /api/urls (URL shortener)
    redirect.ts      # /s/:code (redirect and click count)
    chat.ts          # /api/chat (channels, users, message history)
  chat/              # the chat WebSocket layer
    socket.ts        # /ws upgrade handling and connections
    protocol.ts      # message types and frame validation
  db/
    pool.ts          # the shared pg Pool
    schema.sql       # idempotent schema, all labs
    migrate.ts       # applies schema.sql
  lib/               # pure helpers, e.g. base62.ts
```

Each lab's HTTP routes live under `/api/<slug>` and its tables use a
`<slug>_` prefix (for example `chat_messages`). Short links sit under `/s`
(see D-002 in [DECISIONS.md](../../DECISIONS.md)).

## API design principles
- **RESTful Design**: Follow REST conventions and HTTP methods. *Built.* Resources under `/api`, `GET` to read, `POST` to create.
- **Consistent Naming**: Use clear, consistent endpoint naming. *Built.* Plural nouns, camelCase JSON, ids as JSON numbers (D-018).
- **Versioning**: Implement API versioning strategy. *Not built.* Routes are unversioned.
- **Documentation**: Maintain comprehensive API documentation. *Not built.* Endpoints are described in [DECISIONS.md](../../DECISIONS.md) and the code comments only.
- **Error Handling**: Provide meaningful error responses. *Partly.* See Error handling.

## Security first
- **Authentication**: Implement proper auth mechanisms (JWT, OAuth). *Out of scope.* No login by design (D-010).
- **Authorization**: Role-based access control. *Out of scope.* Depends on authentication.
- **Input Validation**: Validate and sanitize all inputs. *Built.* Every route and every WebSocket frame is validated by hand.
- **Rate Limiting**: Implement rate limiting to prevent abuse. *Not built.* On [ROADMAP.md](../../ROADMAP.md).
- **HTTPS**: Always use HTTPS in production. *Not built.* Local development is plain HTTP; production hosting is undecided.

## Data validation
- **Schema Validation**: Use libraries like Joi, Yup, or Zod. *Decided against for now.* Validation is hand-written (the REST routes and `chat/protocol.ts`). Do not add a validation library without asking.
- **Type Safety**: Leverage TypeScript for compile-time checks. *Built.* Strict mode.
- **Sanitization**: Clean user inputs to prevent injection attacks. *Built.* Every query is parameterised (`$1`, `$2`); values are never concatenated into SQL.
- **Business Logic**: Validate business rules at the service layer. *Not built.* There is no service layer; routes call the pool directly.

## Error handling
- **Consistent Format**: Use consistent error response format. *Partly.* REST routes return `{ "error": "message" }`. The WebSocket `error` message shape is not decided yet.
- **HTTP Status Codes**: Use appropriate status codes. *Built.* `201` on create, `400` for bad input, `404` for unknown resources.
- **Logging**: Log errors with sufficient context. *Not built.* `console.log` only.
- **User-Friendly Messages**: Provide helpful error messages. *Built.* Messages name the field and the rule.

## Database best practices
- **Migrations**: Use database migrations for schema changes. *Partly.* One idempotent `schema.sql` applied by `db/migrate.ts`; no migration tool. Revisit when the schema must change under real data.
- **Indexing**: Optimize database queries with proper indexing. *Built.* The unique `short_code` index (D-006) and the chat `(channel_id, id DESC)` index (D-016).
- **Transactions**: Use transactions for data consistency. *Not built.* No endpoint needs one yet (each write is a single statement).
- **Connection Pooling**: Implement connection pooling for performance. *Built.* One shared pool (D-008).

## Testing strategy
- Use Vitest as the test runner (not yet installed or configured), matching the frontend.
- **Unit Tests**: Test individual functions and methods. *Not built.*
- **Integration Tests**: Test API endpoints end-to-end. *Not built.*
- **Database Tests**: Test database operations. *Not built.*
- **Mock External Services**: Mock third-party API calls. *Not built.* There are no external services yet.

## Monitoring & logging
- **Structured Logging**: Use structured logging format (JSON). *Not built.*
- **Request Tracing**: Implement request ID tracing. *Not built.*
- **Performance Metrics**: Monitor response times and throughput. *Not built.*
- **Health Checks**: Implement health check endpoints. *Partly.* `GET /health` returns `{ "status": "ok" }` but does not check the database.
