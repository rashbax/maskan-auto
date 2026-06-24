-- ============================================================
-- Maskan — exchange rates for multi-currency PRICE DISPLAY (USD stays canonical).
-- A single row holds "units of currency C per 1 USD" (per_usd). The UI multiplies
-- price_usd × per_usd[C] to show an approximate local price. Booking totals are
-- still computed/stored in USD server-side — this table never affects what's charged.
--
-- Refreshed daily from the Central Bank of Uzbekistan (cbu.uz) by lib/rates.ts,
-- piggy-backed on the existing beds24-pull cron (no new Vercel cron — Hobby = 2).
-- Run AFTER 0021.
-- ============================================================

create table if not exists public.exchange_rates (
  id          int primary key default 1 check (id = 1), -- single-row table
  per_usd     jsonb not null,                            -- { "USD":1, "UZS":…, "RUB":…, "KZT":…, "KGS":… }
  updated_at  timestamptz not null default now()
);

alter table public.exchange_rates enable row level security;

-- public can read (prices are shown to everyone); only admin/service-role writes
drop policy if exists "exchange_rates public read" on public.exchange_rates;
create policy "exchange_rates public read" on public.exchange_rates for select using (true);
drop policy if exists "exchange_rates admin write" on public.exchange_rates;
create policy "exchange_rates admin write" on public.exchange_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- seed approximate fallbacks (per 1 USD) — the cron overwrites these with live CBU rates
insert into public.exchange_rates (id, per_usd) values
  (1, '{"USD": 1, "UZS": 12650, "RUB": 90, "KZT": 480, "KGS": 87}'::jsonb)
  on conflict (id) do nothing;
