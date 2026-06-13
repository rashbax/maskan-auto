-- ============================================================
-- Security hardening (audit follow-up). Idempotent — safe to re-run.
-- ============================================================

-- One-shot owner notification guard (claimed atomically by /api/notify-booking).
-- Added first so the booking insert policy below can reference it.
alter table public.bookings add column if not exists notified_at timestamptz;

-- 1) Constrain public booking inserts. A guest may only create their own ACTIVE
--    WEBSITE booking with valid dates, and may NOT preset the side-effect columns
--    (notified_at / beds24_booking_id) to suppress the owner notice or Beds24 push.
--    Admins keep full insert rights for manual/OTA bookings.
drop policy if exists "bookings insert any" on public.bookings;
drop policy if exists "bookings insert guest or admin" on public.bookings;
create policy "bookings insert guest or admin" on public.bookings for insert
  with check (
    public.is_admin()
    or (
      source = 'website'
      and status = 'active'
      and ((auth.uid() is null and user_id is null) or user_id = auth.uid())
      and checkout > checkin
      and notified_at is null
      and beds24_booking_id is null
    )
  );

-- 2) Don't leak photos of hidden apartments through the public anon key — tie photo
--    reads to an apartment that is active (or the caller is an admin).
drop policy if exists "photos public read" on public.apartment_photos;
create policy "photos public read" on public.apartment_photos for select using (
  exists (
    select 1 from public.apartments a
    where a.id = apartment_id and (a.status = 'active' or public.is_admin())
  )
);
