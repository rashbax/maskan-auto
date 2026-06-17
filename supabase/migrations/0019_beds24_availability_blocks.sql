-- Track Beds24 black-booking mirrors for manual owner calendar blocks.
alter table public.availability_blocks
  add column if not exists beds24_booking_id text;

create unique index if not exists availability_blocks_beds24_id
  on public.availability_blocks (beds24_booking_id)
  where beds24_booking_id is not null;
