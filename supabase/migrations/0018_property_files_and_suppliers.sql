-- ============================================================
-- Maskan — property files (per-apartment internal ops DB) + suppliers
-- Both are ADMIN-ONLY. Mirrors the apartment_private RLS pattern.
-- Run AFTER 0017.
-- ============================================================

-- ---------- property_files ----------
-- One-to-one with an apartment, but may also exist standalone (before a public
-- listing). When apartment_id is set, the UI derives title/district/cover LIVE
-- from the apartment (single source of truth — never copied here). Standalone
-- files carry their own name/district instead.
create table if not exists public.property_files (
  id                    uuid primary key default gen_random_uuid(),
  apartment_id          text unique references public.apartments(id) on delete cascade,
  name                  text,                                   -- standalone only
  district              text,                                   -- standalone only

  -- 1) owner & lease
  owner_name            text,
  owner_phone           text,
  lease_start           date,
  lease_end             date,
  deposit_uzs           bigint,

  -- 2) monthly rent (paid to owner)
  rent_amount           bigint,
  rent_currency         text not null default 'UZS' check (rent_currency in ('UZS', 'USD')),
  rent_day              int  not null default 1   check (rent_day between 1 and 31),
  rent_last_paid        date,

  -- 3) utilities & meters
  electric_meter_no     text,
  electric_last_reading text,
  gas_account           text,
  water_account         text,
  internet_provider     text,
  internet_account      text,
  hoa_fee_uzs           bigint,

  -- 4) access & keys
  floor                 text,
  intercom_code         text,
  keybox_code           text,
  key_sets              int not null default 1,

  -- 5) notes
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.property_files enable row level security;
drop policy if exists "property_files admin only" on public.property_files;
create policy "property_files admin only" on public.property_files
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- suppliers (dead simple: name / product / contact) ----------
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  product     text,
  contact     text,
  created_at  timestamptz not null default now()
);
alter table public.suppliers enable row level security;
drop policy if exists "suppliers admin only" on public.suppliers;
create policy "suppliers admin only" on public.suppliers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- backfill: one blank property file per existing apartment ----------
-- (new apartments get theirs from saveApartment(); a DB-side guarantee for the
--  rows that already exist.)
insert into public.property_files (apartment_id)
  select id from public.apartments
  on conflict (apartment_id) do nothing;
