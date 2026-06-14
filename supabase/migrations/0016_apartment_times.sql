-- ============================================================
-- Owner-editable check-in / check-out times (local property time, 24h "HH:mm").
-- Existing apartments backfill to the previous hardcoded 14:00 / 12:00.
-- ============================================================
alter table public.apartments
  add column if not exists check_in_time  text not null default '14:00',
  add column if not exists check_out_time text not null default '12:00';
