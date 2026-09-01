-- Head size is a reference measurement for the artist tying the safa at the
-- event — it belongs on artist_bookings, not on a shop purchase (orders).
alter table public.artist_bookings
  add column if not exists head_size_inches numeric(4,1);
