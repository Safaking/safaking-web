# What to test

Everything below is live. Nothing here has been run against real data yet —
that is what this list is for.

Two systems:

- **Website / customer app** — www.safaking.in (and the Android app, which
  loads the same site)
- **Shop POS** — store.safaking.in (and the Windows desktop app)

Please note the **order number, the amounts on screen, and what you expected**
whenever something looks wrong. Amounts matter most: a wrong total is worse
than a crooked button.

---

## A. Referrals (website)

### A1. Getting a code

1. Sign in, open `/refer`
2. A code like `SKAB3DE` should appear under **Your code**

**If you see `…` or a red error, stop and send the error text.** That means
codes cannot be issued and nothing else in section A will work.

### A2. The QR poster

1. On `/refer`, press **Download A4 poster**
2. Open it. Check:
   - the SafaKing mark across the top
   - **Book your safa today**
   - the QR, the code in figures, the phone number, the address
   - **www.safaking.in** large, and the Play Store line under it
3. **Scan the QR with another phone.** It should open an invitation page
   showing that same code
4. **Do this from the Android app too** — it should open the share sheet
   (WhatsApp, Files, etc.), not a download. This never worked before, so it
   is worth checking properly

### A3. Someone joining with a code

1. From a second account (different phone or number), open the link from the
   QR, or type the code into **Got somebody else's code?** on `/refer`
2. It should be accepted and credit should land on the new account
3. On the first account, `/refer` should now list that person under
   **People who joined with your code**

### A4. Earning from their order

1. From the joiner's account, place a real order **over ₹1,000**
2. On the referrer's account, `/refer` should show:
   - that order, what was bought, and what it earned
   - the credit added to **Your credit**

**Expected: 2% for an ordinary customer** — ₹100 on a ₹5,000 order.
Approved business partners earn more (see B2).

Orders **under ₹1,000 earn nothing** — that is deliberate.

### A5. Spending credit

1. With credit on the account, place an order
2. The credit should come off the total automatically at checkout
3. No more than half the order can be paid with credit

**Known gap, do not report it:** if an order is cancelled or refunded, credit
spent on it does **not** come back. Not built yet.

---

## B. Business partners

### B1. Applying

1. On `/refer`, press **Sign up as a business partner**
2. Fill it in. **Business name and the full address are required** — address
   line, village/town, district, state. An office is as good as a shop
3. Also try: WhatsApp number, UPI id
4. It should save and show the business back to you as **awaiting approval**
5. **Apply again with a changed city** — it should update, not create a
   second entry, and should not lose the fields you left blank

### B2. Approving (admin)

1. Admin → **Referrals**. The application should be at the top, with
   **waiting** against it
2. Check the card shows the address, phone, WhatsApp, UPI, and what they have
   brought in so far
3. Press **Approve**
4. Now have that partner's referred customer place an order over ₹1,000
5. **Expected: 10%, not 2%** — ₹500 on a ₹5,000 order

Also try **Reject** and **Put back to waiting**.

---

## C. GST tax invoice (POS)

### C1. An ordinary sale is unchanged

1. Ring up a sale **without** ticking the GST box
2. The bill should print exactly as it always did — no tax anywhere, and
   **no GST Bill button** on that sale afterwards

### C2. A GST sale

1. Ring up a ₹800 safa and **tick "GST बिल / Tax Invoice"**
2. Optionally enter the customer's GSTIN — the state code should fill itself
   from the first two digits
3. **The till should ask for ₹840, not ₹800** — tax is added on top
4. Save. The tax invoice should open, showing:
   - **JOSHI STORE**, the Partapur address, GSTIN
   - taxable 800, CGST 20, SGST 20, **net ₹840**
   - the amount in words
5. **Check the till total and the bill total match.** If they differ by even
   a rupee, that is the most important thing you can report

### C3. Tying on the bill

Ring up a sale with safa tying and the GST box ticked. The tying charge must
appear as its own line, and the total must include it.

---

## D. One customer, one bill (POS)

1. Ring up a small **sale** for a customer
2. On the success screen, press the yellow
   **"इसी ग्राहक का किराया भी जोड़ें"**
3. The booking screen should open **with that customer already filled in**
4. Add a rental and save
5. Press **"ख़रीद + किराया — एक बिल"**

The bill should show the customer once, **both order numbers**, purchase and
hire as separate sections, and one total with one balance.

Also try it the other way round — start with the rental and add the purchase.

**Not ticking the yellow button must leave both orders completely separate.**

---

## E. Wholesale rates (POS)

1. Admin → a product → set **होलसेल रेट** (say ₹600 against a ₹900 sale price)
2. Open a **wholesale** sale. The product tile should show **₹600 in amber**
3. A retail sale should still show ₹900
4. Leave another product's wholesale rate blank — wholesale should pay the
   ordinary price for it

Per-branch rates: Admin → **Branch prices** → the amber columns.

---

## F. Handover dates and warnings (POS)

1. Ring up a sale and set **"सामान कब देना है"** to two days from now
2. The dashboard should list it under **"आने वाले सप्ताह में"**, marked
   **बिक्री**
3. Clicking that card should open the **sales** list, not rentals
4. Press **तैयार करें** on it — it should leave the list

Do the same for a booking: its first date is now labelled **हैंड ओवर**.

---

## G. Bigger baraats (website)

On the home page, **Book a Safa Artist**:

1. Press **100+** and type **250**
2. **Expected: ₹12,500 total, ₹6,250 advance**
3. The three safa cards should no longer be selectable — images only

---

## H. Everything else worth a look

- **Artists menu** — "Book a Safa Artist" should be the first item
- **Home page** — a refer section with two buttons; "Sign up as a business
  partner" should open `/refer` with the form already open
- **Bilingual help** — a short English + Hindi note near the top of: shop,
  rent, artists, enquiry, my-bookings, academy, gallery, faq, knowledge, plan,
  policies, delete-account, contact, careers, about
- **Chat button** on a phone — it should sit clear of the bottom menu, not on
  top of it
- **Suppliers page** — should invite kalgi, sehra, mojari and the rest, not
  only safas
- **`/try-on`** — should be gone (404). The virtual mirror was removed

---

## Known and deliberate — please do not report

- Cancelled or refunded orders do not return spent credit
- The referral code does **not** apply itself after installing the app from
  the Play Store — only within the same browser
- Partners cannot upload a shop photo or visiting card, and there is no map
  location
- Rentals have no GST invoice — only sales do
- Desktop notifications for upcoming handovers need a new Windows build
  (`npm run dist:win`) and are not in the current one
