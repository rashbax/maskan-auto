-- ============================================================
-- Bookings move to a trusted server route (/api/book, service role).
--   1) DB-level guarantee against double-booking (race-safe, any source).
--   2) Lock down direct public inserts — guests now go through /api/book.
-- Idempotent — safe to re-run.
-- ============================================================

-- 1) No two ACTIVE bookings for the same apartment may overlap. '[)' = checkout day is free
--    (a new guest can check in the day the previous one leaves). This holds no matter how the
--    row is inserted, and closes the two-users-same-instant race.
create extension if not exists btree_gist;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap') then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (
        apartment_id with =,
        daterange(checkin, checkout, '[)') with &&
      ) where (status = 'active');
  end if;
end $$;

-- 2) Guest bookings are created by /api/book with the service role (which bypasses RLS and
--    computes price/nights/availability server-side). So direct client inserts are now
--    admin-only (manual / OTA bookings from the admin panel).
drop policy if exists "bookings insert any" on public.bookings;
drop policy if exists "bookings insert guest or admin" on public.bookings;
drop policy if exists "bookings insert admin only" on public.bookings;
create policy "bookings insert admin only" on public.bookings for insert
  with check (public.is_admin());
