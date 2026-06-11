-- Apartment capacity = a single total (sleeps), set by the admin. The adults/children split
-- now lives on the booking (the guest enters it; total must stay <= the apartment's sleeps).
-- Also add a living-room count alongside bedrooms.

alter table apartments add column if not exists living_rooms int default 0;

alter table bookings add column if not exists adults int;
alter table bookings add column if not exists children int not null default 0;
