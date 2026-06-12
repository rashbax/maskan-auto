-- Parameterized availability for ONE apartment, so the public apartment page doesn't pull every
-- apartment's occupancy to the client. Same logic as busy_dates() (manual blocks + active bookings).

create or replace function public.busy_dates_for(p_apartment_id text)
returns table (d date)
language sql
stable
security definer
set search_path = public
as $$
  select date as d
  from public.availability_blocks
  where apartment_id = p_apartment_id
  union
  select gs::date as d
  from public.bookings b,
       lateral generate_series(b.checkin, b.checkout - 1, interval '1 day') gs
  where b.status = 'active' and b.apartment_id = p_apartment_id
$$;

grant execute on function public.busy_dates_for(text) to anon, authenticated;
