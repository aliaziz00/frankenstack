-- Concept: a single auto-incrementing primary key doubles as our ID generator.
-- We base62-encode it into a short code (see src/lib/base62.ts) instead of
-- generating a random string and checking for collisions. Trade-off: this is
-- simple and guaranteed-unique for a single DB instance, but it reveals
-- roughly how many URLs exist and won't work unmodified if we ever shard
-- writes across multiple databases (see ROADMAP.md).
create table if not exists urls (
  id bigserial primary key,
  -- `unique` here also gives us a b-tree index for free, which is what
  -- matters: the app looks up by short_code on every redirect (the hot
  -- path), so without an index that lookup degrades to a full table scan
  -- once the table grows past what fits in a few disk pages.
  short_code text not null unique,
  long_url text not null,
  click_count bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Chat lab. Tables are prefixed `chat_` to keep each lab's data separate
-- inside the one shared database.
-- display_name is deliberately NOT unique: there is no login, so a name is a
-- label, not an identity. The row id is the identity.
create table if not exists chat_users (
  id bigserial primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_channels (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

-- bigserial gives a total order within the DB, so "after message N" works as
-- a cursor. No `on delete cascade`: deleting a channel with messages is
-- refused rather than silently wiping history.
create table if not exists chat_messages (
  id bigserial primary key,
  channel_id bigint not null references chat_channels(id),
  user_id bigint not null references chat_users(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Serves "latest N messages in a channel":
--   where channel_id = $1 order by id desc limit N
-- Walks the index in order and stops after N rows; no sort, no table scan.
create index if not exists chat_messages_channel_id_id_idx
  on chat_messages (channel_id, id desc);

-- Default channels. on conflict makes re-running the migration safe.
insert into chat_channels (name) values ('general'), ('random')
  on conflict (name) do nothing;
