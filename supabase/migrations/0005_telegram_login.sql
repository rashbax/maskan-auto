-- Bot-based Telegram login (t.me/<bot>?start=<nonce>). The login page creates a pending
-- nonce; the bot webhook confirms it with the user's verified Telegram identity; the page
-- polls and mints a Supabase session. Bypasses the OAuth login widget entirely.

create table if not exists telegram_login (
  nonce       text primary key,
  status      text not null default 'pending',  -- pending | confirmed
  telegram_id text,
  first_name  text,
  last_name   text,
  username    text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

-- Only the service role (API routes + webhook) touches this table; deny everyone else.
alter table telegram_login enable row level security;
