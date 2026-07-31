# SafaKing

Next.js 15 (App Router) + Supabase storefront and operations panel for a royal safa / turban business.

## First-time setup

The app talks to a real Postgres database. Until the schema is applied, every form
will tell you so instead of pretending to succeed.

### 1. Apply the database schema

Open **Supabase Dashboard → SQL Editor → New query**, then run these in order:

| File | What it does |
| --- | --- |
| `supabase/schema.sql` | Tables, enums, signup trigger, RLS policies. Safe to re-run. |
| `supabase/seed.sql` | The 10-product catalogue. Safe to re-run. |

### 2. Configure environment

`.env.local` needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

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
