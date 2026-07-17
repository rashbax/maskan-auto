-- ============================================================
-- Finance: real OTA money + expense journal. Idempotent — safe to re-run.
-- ============================================================

-- 1) OTA bookings now import the channel's real gross into total_usd (beds24-sync);
--    the channel fee lands here so the finance page can show NET OTA revenue.
alter table public.bookings add column if not exists commission_usd numeric(10,2);

-- 2) Expense journal (admin-only). apartment_id nullable — general business expenses
--    (e.g. marketing) live alongside per-apartment ones. Amounts stay in the entered
--    currency; display conversion uses the daily CBU rates (exchange_rates).
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  text references public.apartments(id) on delete set null,
  date          date not null default current_date,
  category      text not null check (category in ('cleaning','repair','supplies','rent','utilities','marketing','other')),
  amount        numeric(12,2) not null check (amount > 0),
  currency      text not null default 'UZS' check (currency in ('USD','UZS')),
  note          text,
  created_at    timestamptz not null default now()
);
alter table public.expenses enable row level security;
drop policy if exists "expenses admin only" on public.expenses;
create policy "expenses admin only" on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());
create index if not exists expenses_apt_date on public.expenses (apartment_id, date);
