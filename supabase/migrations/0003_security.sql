-- ============================================================
-- Maskan — security hardening (addresses the audit findings)
-- Run ONCE, AFTER 0001 + seed + 0002.
-- ============================================================

-- 1) CRITICAL: stop privilege escalation. A user must NOT be able to set their
--    own role='admin'. The role becomes mutable only via service_role / SQL editor.
--    NOTE: security INVOKER (default) so current_user reflects the real caller.
create or replace function public.lock_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and current_user in ('anon', 'authenticated') then
    new.role := old.role;  -- silently keep old role; client cannot self-promote
  end if;
  return new;
end; $$;
drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role before update on public.profiles
  for each row execute function public.lock_profile_role();

-- 2) CRITICAL: keep the exact building address OUT of the public apartments row.
--    Even though the UI never shows it, the anon key could `select address`.
--    Move it to an admin-only table so it can never be read with the anon key.
create table if not exists public.apartment_private (
  apartment_id text primary key references public.apartments(id) on delete cascade,
  address text
);
alter table public.apartment_private enable row level security;
drop policy if exists "private admin only" on public.apartment_private;
create policy "private admin only" on public.apartment_private
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.apartment_private (apartment_id, address)
  select id, address from public.apartments where address is not null
  on conflict (apartment_id) do nothing;
alter table public.apartments drop column if exists address;

-- 3) HIGH: booking integrity at the DB level (independent of any client).
--    a) ranges must be valid; b) no two ACTIVE bookings can overlap on a flat
--       -> real double-booking guard.
alter table public.bookings drop constraint if exists bookings_dates_valid;
alter table public.bookings add constraint bookings_dates_valid check (checkout > checkin);

create extension if not exists btree_gist;
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    apartment_id with =,
    daterange(checkin, checkout, '[)') with &&
  ) where (status = 'active');

-- 4) HIGH: review eligibility. Only a guest who actually stayed (a past booking
--    for THAT apartment) may post a review for it.
drop policy if exists "reviews insert auth" on public.reviews;
drop policy if exists "reviews insert eligible" on public.reviews;
create policy "reviews insert eligible" on public.reviews
  for insert with check (
    auth.uid() is not null
    and exists (
      select 1 from public.bookings b
      where b.apartment_id = reviews.apartment_id
        and b.user_id = auth.uid()
        and b.status in ('past', 'checked-out')
    )
  );
