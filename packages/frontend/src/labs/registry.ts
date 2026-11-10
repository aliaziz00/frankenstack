import { lazy } from "react";
import type { Lab } from "./types";

export const labs: Lab[] = [
  {
    slug: "url-shortener",
    title: "URL Shortener",
    summary: "Short links with a read-heavy redirect path and atomic click counting.",
    status: "live",
    concepts: ["ID generation", "Indexing", "Atomic updates", "Connection pooling"],
    Demo: lazy(() => import("./url-shortener/Demo")),
    design: {
      problem:
        "Turn long URLs into short codes and redirect quickly. Reads (redirects) vastly outnumber writes (creating links).",
      requirements: [
        "Create a short link for any http(s) URL",
        "Redirect a short code to its URL with low latency",
        "Count clicks without losing updates under concurrency",
      ],
      decisions: [
        {
          title: "Base62-encode a database sequence",
          body: "Codes come from Postgres nextval() encoded in base62. Collision-free on one database and trivial to implement, but sequential (guessable) and it breaks if writes are sharded, since two shards would mint the same id. Random codes with a collision check, or a Snowflake-style generator, are the alternatives.",
        },
        {
          title: "Take the id before inserting",
          body: "An earlier draft inserted a placeholder code then updated it, which races under concurrent requests. Fetching the id first and inserting id and code together removes the window.",
        },
        {
          title: "Count clicks in one UPDATE",
          body: "click_count = click_count + 1 ... RETURNING does the read-modify-write inside the database. Doing it in the app loses updates when two redirects interleave.",
        },
      ],
      limits: [
        "Every redirect hits Postgres. A Redis cache-aside layer is the first scaling step.",
        "One counter row per link becomes a write hotspot for viral links; batch or shard counters.",
        "No rate limiting, so the public create endpoint can be abused.",
      ],
    },
  },
  {
    slug: "chat",
    title: "Real-time Chat",
    summary: "Channels, live delivery over WebSockets, and message history.",
    status: "planned",
    concepts: ["WebSockets", "Cursor paging", "Message ordering", "Input validation"],
    design: {
      problem:
        "Deliver messages to everyone in a channel within moments, and keep a history that someone joining later can scroll back through.",
      requirements: [
        "Pick a display name and see the list of channels",
        "Join a channel and see live messages from others",
        "Save every message before broadcasting it, so nothing is lost",
        "Load history on join, newest first, one page at a time",
        "Reconnect after a dropped connection",
      ],
      decisions: [
        {
          title: "Plan: WebSockets with a typed envelope",
          body: "One connection per user carries every event as { type, payload }: join, leave and send from the client; message and error from the server. A hand-written validator treats every frame as untrusted input, and the server drops frames over 16 KB. The alternatives were Socket.IO, which hides the mechanics, and Server-Sent Events, which only flow one way.",
        },
        {
          title: "Plan: Postgres is the source of truth, paged by cursor",
          body: "Sequential ids give a total order inside one database. History is read newest first with a cursor (before=<id>) over a (channel_id, id desc) index, because offset paging slows down with depth and shifts as new messages arrive.",
        },
        {
          title: "Identity is a display name, not a login",
          body: "Names are not unique and every sign-in creates a user row, so the id is the identity. Real authentication is big enough to be its own lab.",
        },
      ],
      limits: [
        "Built so far: the schema, the REST endpoints and a WebSocket endpoint that accepts connections. Not built: joining channels, sending, broadcasting and the UI.",
        "Presence, typing indicators, threads and direct messages are out of scope for the first version.",
        "One server process only. A second instance could not reach the sockets held by the first without a shared pub/sub layer (Redis is the usual answer), so running several instances is a later step.",
      ],
    },
  },
];

export function findLab(slug: string | undefined): Lab | undefined {
  return labs.find((lab) => lab.slug === slug);
}
