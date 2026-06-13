-- ============================================================
-- Remember which apartment/booking a guest opened the bot from, so the operator sees the
-- apartment on EVERY relayed message (not just the one-shot /start ping). Written/read only by
-- the webhook with the service role; RLS on with no policies = no anon/auth access.
-- ============================================================
create table if not exists public.telegram_contact (
  chat_id      text primary key,
  apartment_id text,
  title        text,
  booking_id   text,
  updated_at   timestamptz not null default now()
);
alter table public.telegram_contact enable row level security;
