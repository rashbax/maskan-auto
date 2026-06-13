-- ============================================================
-- Security hardening (audit follow-up).
-- ============================================================

-- 1) Constrain public booking inserts. A guest may only create their own ACTIVE
--    WEBSITE booking with valid dates; admins may still record manual/OTA bookings.
--    Stops anon users from faking admin revenue (source), impersonating user_id,
--    or choosing an arbitrary status.
drop policy if exists "bookings insert any" on public.bookings;
create policy "bookings insert guest or admin" on public.bookings for insert
  with check (
    public.is_admin()
    or (
      source = 'website'
      and status = 'active'
      and (user_id is null or user_id = auth.uid())
      and checkout > checkin
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

-- 3) One-shot owner notification: an idempotency guard so /api/notify-booking can't
--    be replayed to spam the host (the route claims this column atomically).
alter table public.bookings add column if not exists notified_at timestamptz;
