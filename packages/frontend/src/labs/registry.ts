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
    summary: "Rooms, live delivery over WebSockets, and message history.",
    status: "planned",
    concepts: ["WebSockets", "Pub/Sub", "Presence", "Horizontal scaling"],
    design: {
      problem:
        "Deliver messages to everyone in a room within moments, keep history, and keep working when more than one server is running.",
      requirements: [
        "Join a room and see live messages from others",
        "Persist history and load it on join",
        "Show who is online",
        "Stay correct with multiple backend instances",
      ],
      decisions: [
        {
          title: "Plan: Postgres for history, Redis pub/sub for fan-out",
          body: "Persist each message, then publish it so every instance can push to its own connected sockets. This is the standard answer to stateful connections not being shareable across servers.",
        },
      ],
      limits: ["Not built yet."],
    },
  },
];

export function findLab(slug: string | undefined): Lab | undefined {
  return labs.find((l) => l.slug === slug);
}
