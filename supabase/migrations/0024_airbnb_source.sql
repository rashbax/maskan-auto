-- Add 'airbnb' as a booking source. We now list on Airbnb too; Airbnb reservations arrive via the
-- Beds24 channel manager (like Booking.com) and are tagged from the Beds24 `referer` field in
-- lib/beds24-sync.ts. The source CHECK constraint (from 0001) must allow the new value first, or
-- those inserts/updates would be rejected.
--
-- Inline column checks from 0001 are auto-named "<table>_<column>_check". Drop-if-exists keeps this
-- idempotent even if the constraint was renamed.

alter table public.bookings drop constraint if exists bookings_source_check;

alter table public.bookings
  add constraint bookings_source_check
  check (source in ('website', 'booking', 'manual', 'airbnb'));
