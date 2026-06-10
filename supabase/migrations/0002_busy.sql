-- ============================================================
-- Maskan — public availability (busy dates) without exposing booking PII.
-- A security-definer function returns only (apartment_id, date) for active
-- bookings + manual blocks, so guests see free/busy days but not who booked.
-- Run AFTER 0001_init.sql + seed.sql.
-- ============================================================

create or replace function public.busy_dates()
returns table (apartment_id text, d date)
language sql
stable
security definer
set search_path = public
as $$
  -- manually blocked days
  select apartment_id, date as d
  from public.availability_blocks
  union
  -- every night of every active booking (checkout day stays free)
  select b.apartment_id, gs::date as d
  from public.bookings b,
       lateral generate_series(b.checkin, b.checkout - 1, interval '1 day') gs
  where b.status = 'active'
$$;

grant execute on function public.busy_dates() to anon, authenticated;
