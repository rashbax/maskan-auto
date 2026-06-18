-- Allow one Beds24 black booking to mirror multiple blocked nights locally.
-- Older code created one black booking per local blocked day, but Beds24-origin blocks
-- can span more than one night.
drop index if exists public.availability_blocks_beds24_id;

create unique index if not exists availability_blocks_beds24_id_date
  on public.availability_blocks (beds24_booking_id, apartment_id, date)
  where beds24_booking_id is not null;
