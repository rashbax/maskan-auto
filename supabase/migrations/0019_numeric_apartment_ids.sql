-- ============================================================
-- Maskan — human-friendly apartment IDs (6-digit numbers, no letters)
-- so they're easy for people to read / dictate.
--
-- 1) Add ON UPDATE CASCADE to every FK that references apartments(id) — without
--    it, renaming an apartment id fails (children still point at the old value).
-- 2) Rename existing apartment ids (e.g. 'apt-mq9xf8hk') to a unique random
--    6-digit number. The cascade updates all FK children automatically; the two
--    plain-text (non-FK) columns are updated by hand.
--
-- NOTE: existing /apartment/<old-id> URLs and any shared 'apt-...' Telegram
-- deep-links will 404 after this runs (the new ids are numeric). Photos are
-- unaffected (apartment_photos.url stores absolute R2 URLs, not the id).
--
-- New apartments created in the app already get a 6-digit id (see admin EditApt).
-- Run AFTER 0018.
-- ============================================================

-- 1) recreate each apartments(id) FK with ON UPDATE CASCADE (keep ON DELETE CASCADE)
alter table public.apartment_photos     drop constraint if exists apartment_photos_apartment_id_fkey;
alter table public.apartment_photos     add  constraint apartment_photos_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.bookings             drop constraint if exists bookings_apartment_id_fkey;
alter table public.bookings             add  constraint bookings_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.availability_blocks  drop constraint if exists availability_blocks_apartment_id_fkey;
alter table public.availability_blocks  add  constraint availability_blocks_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.favorites            drop constraint if exists favorites_apartment_id_fkey;
alter table public.favorites            add  constraint favorites_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.reviews              drop constraint if exists reviews_apartment_id_fkey;
alter table public.reviews              add  constraint reviews_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.apartment_private    drop constraint if exists apartment_private_apartment_id_fkey;
alter table public.apartment_private    add  constraint apartment_private_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

alter table public.property_files        drop constraint if exists property_files_apartment_id_fkey;
alter table public.property_files        add  constraint property_files_apartment_id_fkey
  foreign key (apartment_id) references public.apartments(id) on update cascade on delete cascade;

-- 2) rename existing non-numeric ids to a unique random 6-digit number
do $$
declare
  r   record;
  nid text;
begin
  for r in select id from public.apartments where id !~ '^[0-9]{6}$' loop
    loop
      nid := lpad((100000 + floor(random() * 900000))::int::text, 6, '0'); -- 100000..999999
      exit when not exists (select 1 from public.apartments where id = nid);
    end loop;
    update public.apartments      set id = nid           where id = r.id;  -- cascades to FK children
    update public.telegram_contact set apartment_id = nid where apartment_id = r.id; -- plain text, no FK
    update public.beds24_sync_log  set apartment_id = nid where apartment_id = r.id; -- audit log, no FK
  end loop;
end $$;
