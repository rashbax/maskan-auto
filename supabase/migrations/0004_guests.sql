-- Split apartment capacity into adults + children.
-- `sleeps` stays = total (adults + children) for backward-compatible display/filtering.

alter table apartments add column if not exists max_adults int;
alter table apartments add column if not exists max_children int not null default 0;

-- backfill existing rows: treat the old `sleeps` as the adult capacity
update apartments set max_adults = coalesce(max_adults, sleeps, 2);
