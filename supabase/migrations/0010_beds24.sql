-- ============================================================
-- Beds24 channel-manager integration (two-way sync).
-- Map each apartment to a Beds24 property/room, remember which Beds24 booking a
-- row mirrors, and keep an audit trail of inbound/outbound sync. The sync logic
-- itself lives in app code (lib/beds24.ts + /api/beds24/*).
-- ============================================================

-- apartment -> Beds24 room mapping (null = not connected to Beds24 yet)
alter table public.apartments
  add column if not exists beds24_prop_id text,
  add column if not exists beds24_room_id text;

-- which Beds24 booking a row mirrors (null = site-only / not pushed yet).
-- `source` already allows 'booking' for OTA-origin rows imported from Beds24.
alter table public.bookings
  add column if not exists beds24_booking_id text;

create unique index if not exists bookings_beds24_id
  on public.bookings (beds24_booking_id) where beds24_booking_id is not null;

-- audit/debug trail for every sync attempt (both directions)
create table if not exists public.beds24_sync_log (
  id                uuid primary key default gen_random_uuid(),
  direction         text not null check (direction in ('inbound', 'outbound')),
  beds24_booking_id text,
  booking_id        text,
  apartment_id      text,
  action            text,
  ok                boolean,
  detail            text,
  created_at        timestamptz not null default now()
);
alter table public.beds24_sync_log enable row level security;
create policy "beds24 log admin only" on public.beds24_sync_log
  for all using (public.is_admin()) with check (public.is_admin());
