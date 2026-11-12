-- 054 — put the shop's real address on the parcels.
--
-- business_profile was created in 009 with placeholder defaults and nobody
-- ever filled it in, because nothing in the admin panel edits it. So every
-- document that prints "where this came from" has been printing the seed:
--
--     SafaKing Turban House / Jaipur, Rajasthan, India / +91 90013 47143
--
-- It went unnoticed on invoices and showed up the first time a parcel label
-- was printed: a Jaipur return address on a parcel posted from Partapur. A
-- failed delivery would have gone back to a town the shop has never traded in.
--
-- The address below is the counter the goods actually leave from — the same
-- one the POS prints on a GST invoice.
--
-- The name is left alone on purpose. It already reads SafaKing, which is what
-- should be on a customer's parcel whoever packed it, and it is also the
-- heading of every tax invoice this shop has issued — not something to change
-- in passing while fixing an address.
--
-- Only the seeded placeholder is overwritten. If somebody has since typed a
-- real address, theirs is the right one and this leaves it alone.

update public.business_profile
   set address    = 'Near Pandya Memorial School, Char Khamba, Partapur, Dist. Banswara, Rajasthan 327024',
       email      = coalesce(email, 'safakingn111@gmail.com'),
       updated_at = now()
 where address in ('Jaipur, Rajasthan, India', '');

select legal_name, address, phone, email from public.business_profile;
