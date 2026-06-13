-- ============================================================
-- A booking must not overlap an owner-blocked day. The 0012 exclusion constraint covers
-- booking-vs-booking overlap; availability_blocks live in a separate table, so guard them
-- with a trigger (race-safe, unlike an app-level pre-check). Idempotent.
-- ============================================================

create or replace function public.bookings_block_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' and exists (
    select 1 from public.availability_blocks b
    where b.apartment_id = new.apartment_id
      and b.date >= new.checkin and b.date < new.checkout
  ) then
    raise exception 'apartment blocked for these dates' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_block_check_trg on public.bookings;
create trigger bookings_block_check_trg
  before insert or update on public.bookings
  for each row execute function public.bookings_block_check();
