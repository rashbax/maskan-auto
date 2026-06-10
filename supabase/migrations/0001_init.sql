-- ============================================================
-- Maskan — initial schema (run in Supabase SQL editor or via CLI)
-- Tables, Row Level Security (RLS) policies, and signup trigger.
-- ============================================================

-- ---------- profiles (1 row per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  telegram    text,
  lang        text not null default 'uz',
  role        text not null default 'guest' check (role in ('guest', 'admin')),
  created_at  timestamptz not null default now()
);

-- admin check helper (security definer so policies can read profiles.role)
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

alter table public.profiles enable row level security;
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);

-- auto-create a profile row whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- apartments ----------
create table if not exists public.apartments (
  id            text primary key,                 -- 'a1', slug, etc.
  tone          text not null default 'stone',    -- placeholder colour while real photos load
  price_usd     int  not null,
  district      text not null,                    -- key: mirobod, chilonzor, ...
  sleeps        int  not null default 2,
  beds          int  not null default 1,
  baths         int  not null default 1,
  size_m2       int,
  rating        numeric(3,2) default 5.0,
  reviews_count int default 0,
  photos_count  int default 0,
  host          text,
  superhost     boolean default false,
  near          jsonb not null default '{}'::jsonb,   -- {uz,ru,en}
  title         jsonb not null default '{}'::jsonb,   -- {uz,ru,en}
  blurb         jsonb not null default '{}'::jsonb,   -- {uz,ru,en}
  amenities     text[] not null default '{}',
  lat           numeric,
  lng           numeric,
  address       text,                              -- PRIVATE: shown to guest only after booking
  status        text not null default 'active' check (status in ('active', 'hidden')),
  created_at    timestamptz not null default now()
);
alter table public.apartments enable row level security;
create policy "apartments public read" on public.apartments for select using (status = 'active' or public.is_admin());
create policy "apartments admin write" on public.apartments for all using (public.is_admin()) with check (public.is_admin());

-- ---------- apartment photos (URLs live in Cloudflare R2) ----------
create table if not exists public.apartment_photos (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  text not null references public.apartments(id) on delete cascade,
  url           text not null,
  sort          int  not null default 0,
  is_cover      boolean default false
);
alter table public.apartment_photos enable row level security;
create policy "photos public read" on public.apartment_photos for select using (true);
create policy "photos admin write" on public.apartment_photos for all using (public.is_admin()) with check (public.is_admin());

-- ---------- bookings ----------
create table if not exists public.bookings (
  id            text primary key,                 -- 'BK-3120'
  apartment_id  text not null references public.apartments(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,   -- nullable: guest booking w/o account
  guest_name    text,
  phone         text,
  telegram      text,
  messenger     text default 'telegram',
  checkin       date not null,
  checkout      date not null,
  nights        int,
  total_usd     int,
  source        text not null default 'website' check (source in ('website', 'booking', 'manual')),
  status        text not null default 'active'   check (status in ('active', 'past', 'cancelled', 'checked-out')),
  created_at    timestamptz not null default now()
);
alter table public.bookings enable row level security;
create policy "bookings own or admin read" on public.bookings for select using (user_id = auth.uid() or public.is_admin());
create policy "bookings insert any"        on public.bookings for insert with check (true);          -- instant booking (also anonymous)
create policy "bookings admin update"      on public.bookings for update using (public.is_admin());
create index if not exists bookings_apt_dates on public.bookings (apartment_id, checkin, checkout) where status = 'active';

-- ---------- manual availability blocks (owner closes a day) ----------
create table if not exists public.availability_blocks (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  text not null references public.apartments(id) on delete cascade,
  date          date not null,
  reason        text,
  created_at    timestamptz not null default now(),
  unique (apartment_id, date)
);
alter table public.availability_blocks enable row level security;
create policy "blocks public read" on public.availability_blocks for select using (true);
create policy "blocks admin write" on public.availability_blocks for all using (public.is_admin()) with check (public.is_admin());

-- ---------- favorites ----------
create table if not exists public.favorites (
  user_id       uuid not null references auth.users(id) on delete cascade,
  apartment_id  text not null references public.apartments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, apartment_id)
);
alter table public.favorites enable row level security;
create policy "favorites own all" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- reviews ----------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  apartment_id  text not null references public.apartments(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  booking_id    text references public.bookings(id) on delete set null,
  name          text,
  country       text,
  rating        int not null check (rating between 1 and 5),
  cons          text,
  text          text,
  host_reply    text,                              -- owner public reply
  hidden        boolean not null default false,    -- admin soft-hide (never hard delete by default)
  created_at    timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "reviews public read"    on public.reviews for select using (hidden = false or public.is_admin());
create policy "reviews insert auth"     on public.reviews for insert with check (auth.uid() is not null);  -- only logged-in (post-stay) guests
create policy "reviews admin moderate"  on public.reviews for update using (public.is_admin());             -- hide/reply only; text edit not exposed in app

-- ---------- review moderation audit log ----------
create table if not exists public.review_audit (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid references public.reviews(id) on delete cascade,
  action      text,
  reason      text,
  who         text,
  created_at  timestamptz not null default now()
);
alter table public.review_audit enable row level security;
create policy "audit admin only" on public.review_audit for all using (public.is_admin()) with check (public.is_admin());
