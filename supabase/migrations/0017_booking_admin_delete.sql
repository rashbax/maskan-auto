-- ============================================================
-- Let an admin HARD-delete a booking (removing test/sample/junk rows). Real cancellations keep
-- the row via status='cancelled' (the existing admin update path). RLS otherwise denies delete.
-- ============================================================
drop policy if exists "bookings admin delete" on public.bookings;
create policy "bookings admin delete" on public.bookings
  for delete using (public.is_admin());
