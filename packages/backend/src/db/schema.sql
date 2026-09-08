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
