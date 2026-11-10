import { Router } from "express";
import { parseBefore, parseChannelId, parseLimit } from "../chat/params.js";
import { pool } from "../db/pool.js";

export const chatRouter = Router();

// Rows as pg returns them: bigint columns arrive as strings and timestamptz
// columns as Date objects.
interface ChannelRow {
  id: string;
  name: string;
  created_at: Date;
}

interface UserRow {
  id: string;
  display_name: string;
}

interface MessageRow {
  id: string;
  channel_id: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: Date;
}

// GET /api/chat/channels -> every channel, alphabetical.
// No pagination: channels are a small, bounded list (unlike messages).
chatRouter.get("/channels", async (_req, res) => {
  const result = await pool.query<ChannelRow>(
    "select id, name, created_at from chat_channels order by name",
  );
  res.json(
    result.rows.map((row) => ({
      // pg returns bigint columns as strings (a JS number can't hold every
      // bigint safely). We convert every id to a number across this API; see
      // the note in the messages route for the 2^53 limit.
      id: Number(row.id),
      name: row.name,
      createdAt: row.created_at,
    })),
  );
});

// POST /api/chat/users  { displayName } -> create a user, return its id.
// Every call creates a new row: a name is a label, not an identity, so the
// client must store the returned id (localStorage) and not call this again
// on every page load.
chatRouter.post("/users", async (req, res) => {
  const { displayName } = req.body ?? {};

  // Trim first so "  ali " and "ali" are treated the same, and so a
  // whitespace-only name is rejected. The 30-char cap stops someone storing a
  // huge name that would then be shown next to every message they send.
  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (name.length < 1 || name.length > 30) {
    return res
      .status(400)
      .json({ error: "displayName must be 1-30 characters" });
  }

  const result = await pool.query<UserRow>(
    "insert into chat_users (display_name) values ($1) returning id, display_name",
    [name],
  );
  const row = result.rows[0];
  res.status(201).json({ id: Number(row.id), displayName: row.display_name });
});

// GET /api/chat/channels/:id/messages?limit=50&before=<messageId>
// Newest first. `before` is a cursor: "messages older than this id". The
// client passes the oldest id it already has to load the next page back.
chatRouter.get("/channels/:id/messages", async (req, res) => {
  const channelIdResult = parseChannelId(req.params.id);
  if (!channelIdResult.ok) {
    return res.status(400).json({ error: channelIdResult.error });
  }
  const limitResult = parseLimit(req.query.limit);
  if (!limitResult.ok) {
    return res.status(400).json({ error: limitResult.error });
  }
  const beforeResult = parseBefore(req.query.before);
  if (!beforeResult.ok) {
    return res.status(400).json({ error: beforeResult.error });
  }
  const channelId = channelIdResult.value;
  const limit = limitResult.value;
  const before = beforeResult.value;

  // 404 for an unknown channel, so a typo'd id isn't mistaken for an empty one.
  const channel = await pool.query("select 1 from chat_channels where id = $1", [
    channelId,
  ]);
  if (channel.rows.length === 0) {
    return res.status(404).json({ error: "channel not found" });
  }

  // Uses chat_messages_channel_id_id_idx: jump to (channel, before) in the
  // index, then read `limit` entries in order. No sort, no table scan.
  const result = await pool.query<MessageRow>(
    `select m.id, m.channel_id, m.user_id, u.display_name, m.body, m.created_at
       from chat_messages m
       join chat_users u on u.id = m.user_id
      where m.channel_id = $1
        and ($2::bigint is null or m.id < $2::bigint)
      order by m.id desc
      limit $3`,
    [channelId, before, limit],
  );

  res.json(
    result.rows.map((row) => ({
      // pg returns bigint as a string; convert to a number like every other
      // id in this API. Known limit: JS numbers are only exact up to 2^53
      // (~9e15), so past that ids would be silently rounded. Unreachable for
      // this project; a production system would send ids as strings.
      id: Number(row.id),
      channelId: Number(row.channel_id),
      userId: Number(row.user_id),
      displayName: row.display_name,
      body: row.body,
      createdAt: row.created_at,
    })),
  );
});
