# SafaKing

Next.js 15 (App Router) + Supabase storefront and operations panel for a royal safa / turban business.

## First-time setup

The app talks to a real Postgres database. Until the schema is applied, every form
will tell you so instead of pretending to succeed.

### 1. Apply the database schema

Open **Supabase Dashboard → SQL Editor → New query**, then run these in order:

| Order | File | What it does |
| --- | --- | --- |
| 1 | `supabase/002_production_hardening.sql` | **Run this first.** Adds missing columns/tables and turns RLS on. Without it, anyone can read and edit your orders. |
| 2 | `supabase/003_payments.sql` | Razorpay columns, payment ledger, atomic stock, and removes the client's ability to insert orders. |

`supabase/schema.sql` and `seed.sql` describe a greenfield install and do **not**
match the live database — see `002` for the reconciliation. Verify with:

```bash
./scripts/verify-security.sh
```

Every line must read PASS before taking real orders.

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill it in. Checkout will not work
without `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
— it returns "Payments are not configured yet" until they are set.

## How money is handled

Prices are **never** taken from the browser. The cart posts only product ids and
quantities to `/api/checkout/create-order`, which:

1. looks each product up in the `products` table and prices it there,
2. checks stock and the delivery pincode,
3. computes the total and the 50% advance,
4. creates a Razorpay order for the advance and a `pending` SafaKing order.

`/api/checkout/verify` then checks Razorpay's HMAC signature before marking
anything paid, and only then applies stock via the `apply_order_stock()`
function, which is atomic and runs at most once per order. A replayed or forged
confirmation is rejected; a signature mismatch marks the payment `failed`.

`003_payments.sql` drops the INSERT policy on `orders` and `order_items`, so the
service-role route is the only thing that can create an order. That is what
stops a customer paying ₹1 for a ₹5,000 safa.

### 3. Create the first admin

`admin` cannot be selected at signup — the `handle_new_user()` trigger forces every
new account to `customer` or `artist`. To bootstrap:

1. Sign up on the site with the email you want to be the administrator.
2. Edit the email in `supabase/make-admin.sql` and run it in the SQL Editor.

After that, admins promote other users from the **Users & Roles** tab of `/admin`.

### 4. Run it

```bash
npm run dev
```

## Roles and access

| Role | Gets |
| --- | --- |
| `customer` | Shop, cart, checkout, artist booking, own orders |
| `artist` | `/artist-portal` — only the bookings assigned to them |
| `admin` | `/admin` — orders, bookings, product CRUD, suppliers, academy, careers, user roles |

`src/middleware.ts` enforces this server-side: it refreshes the Supabase session on
every request and redirects anyone without the right role away from `/admin` and
`/artist-portal`. Row Level Security enforces the same rules at the database layer,
so a crafted client request can't read another customer's orders.

## Data flow

| Page / section | Table |
| --- | --- |
| Landing → Book a Safa Artist | `artist_bookings` |
| Landing → Supplier Registration | `supplier_applications` |
| Landing → Academy Enrollment | `academy_enrollments` |
| Careers → Apply | `job_applications` |
| Shop / Featured → catalogue | `products` |
| Cart → Checkout | `orders` + `order_items` |
| Wishlist (signed in) | `wishlists` |
| Signup | `auth.users` → `profiles` via trigger |

The product catalogue falls back to a static list in `src/lib/products.ts` when the
`products` table is empty or unreachable, so the storefront is never a blank grid.

## Deploy on Vercel

Set the two `NEXT_PUBLIC_SUPABASE_*` variables in the project settings, then deploy.
