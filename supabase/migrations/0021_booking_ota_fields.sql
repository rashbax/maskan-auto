-- OTA (Booking.com) bookings now carry the guest email (a channel proxy alias) and the channel's
-- confirmation reference, available once the Beds24 token has the bookings-personal scope.
-- adults/children already exist (0006_living_room_and_booking_guests).
alter table public.bookings
  add column if not exists email          text,
  add column if not exists ota_reference  text;
