-- ============================================================
-- Make the booking <-> owner-block guard fully race-safe and reciprocal.
--   - A per-apartment transaction advisory lock serializes both write paths, so the
--     existence checks can't be bypassed by two concurrent transactions.
--   - A reciprocal trigger forbids blocking a day that already has an active booking.
--   - Both raise a DISTINCT SQLSTATE (23B01) so the app maps only this to 409 and never
--     masks a real check-constraint failure.
-- Idempotent.
-- ============================================================

-- booking must not land on an owner-blocked day
create or replace function public.bookings_block_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' then
    perform pg_advisory_xact_lock(hashtext(new.apartment_id)::bigint);
    if exists (
      select 1 from public.availability_blocks b
      where b.apartment_id = new.apartment_id
        and b.date >= new.checkin and b.date < new.checkout
    ) then
      raise exception 'apartment blocked for these dates' using errcode = '23B01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_block_check_trg on public.bookings;
create trigger bookings_block_check_trg
  before insert or update on public.bookings
  for each row execute function public.bookings_block_check();

-- reciprocal: can't block a day that already has an active booking
create or replace function public.blocks_booking_check()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.apartment_id)::bigint);
  if exists (
    select 1 from public.bookings b
    where b.apartment_id = new.apartment_id
      and b.status = 'active'
      and new.date >= b.checkin and new.date < b.checkout
  ) then
    raise exception 'date already has an active booking' using errcode = '23B01';
  end if;
  return new;
end;
$$;

drop trigger if exists blocks_booking_check_trg on public.availability_blocks;
create trigger blocks_booking_check_trg
  before insert or update on public.availability_blocks
  for each row execute function public.blocks_booking_check();
