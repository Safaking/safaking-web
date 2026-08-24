-- ---------------------------------------------------------------------------
-- 019_client_feedback_updates.sql
--
-- A batch of client-requested changes to the artist-booking flow and the
-- customer contract text.
--
-- Note on the ALTER TYPE below: it must actually commit before the INSERT
-- further down can use the new enum value. Paste and run this whole file in
-- one go in the Supabase SQL Editor (each statement runs and commits in
-- turn) — don't wrap it in an explicit BEGIN/COMMIT block of your own.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. artist_bookings — the fields the quick-booking form was missing:
--    a second contact number, a real "wedding date" + time, the window the
--    artist is actually booked for, a full address (was folded into
--    city_venue as one free-text field), and an optional second function
--    (Haldi / Sangeet / etc.) with its own date, time and venue.
-- ---------------------------------------------------------------------------
alter table public.artist_bookings
  add column if not exists customer_phone_alt text,
  add column if not exists venue_address       text,
  add column if not exists event_time          text,
  add column if not exists booking_start_time  text,
  add column if not exists booking_end_time    text,
  add column if not exists second_event_name   text,
  add column if not exists second_event_date   date,
  add column if not exists second_event_time   text,
  add column if not exists second_event_venue  text;

comment on column public.artist_bookings.event_time is
  'Wedding ceremony time, distinct from event_date (the date).';
comment on column public.artist_bookings.booking_start_time is
  'When the artist is expected on-site — the window this booking actually reserves them for.';

-- ---------------------------------------------------------------------------
-- 2. A third contract audience: the return/postal-charge policy only makes
--    sense for a groom safa bought outright through the shop (there is a
--    physical safa in the customer's hands to return or damage) — it never
--    applied to an artist-tying booking or a rental, where nothing is
--    shipped to the customer. It was living in the shared 'customer'
--    contract by mistake; this splits it into its own audience.
-- ---------------------------------------------------------------------------
alter type contract_audience add value if not exists 'groom_safa';

-- ---------------------------------------------------------------------------
-- 3. The shared 'customer' contract (shown on both the artist quick-booking
--    form and the safa rental form) — loses the return/postal clause, gains
--    two clauses the client asked for directly: cooperation if the artist
--    has a medical emergency en route, and payment-before-departure.
-- ---------------------------------------------------------------------------
update public.contracts
set body =
  'I understand that: if the assigned safa artist is delayed by a genuine ' ||
  'medical emergency while travelling to the venue, I agree to cooperate ' ||
  'with SafaKing''s support team — arranging a replacement artist, or ' ||
  'confirming a revised arrival time, may take additional time in that ' ||
  'situation. The balance payment beyond the advance must be completed at ' ||
  'least one day before the event date — the artist is dispatched only ' ||
  'once that balance is received. I must not pay the assigned artist ' ||
  'directly — all payment is handled by SafaKing. I must provide an ' ||
  'accurate event address and pincode at the time of booking.',
  version = version + 1
where audience = 'customer' and active;

-- ---------------------------------------------------------------------------
-- 4. New 'groom_safa' contract — shown only at shop checkout (see
--    src/components/cart/CartDrawer.tsx) — carries the return/postal clause
--    that used to live in the shared contract above.
-- ---------------------------------------------------------------------------
insert into public.contracts (audience, title, body, active)
select
  'groom_safa',
  'Groom Safa Purchase Terms',
  'I understand that: SafaKing does not accept returns on tied/used safas — ' ||
  'if a safa is returned in usable, unused condition a postal handling ' ||
  'charge applies and is deducted from my advance; a damaged, cut or used ' ||
  'safa is not eligible for any refund of the advance paid; I must provide ' ||
  'accurate sizing and a complete postal address with pincode at the time ' ||
  'of booking.',
  true
where not exists (select 1 from public.contracts where audience = 'groom_safa');
