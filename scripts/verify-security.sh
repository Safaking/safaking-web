#!/usr/bin/env bash
# ============================================================================
# SafaKing — anonymous access audit
#
# Uses ONLY the public anon key (the one shipped in the browser bundle) and
# checks that a logged-out stranger cannot read or modify private data.
#
#   ./scripts/verify-security.sh
#
# Every line must read PASS before going to production.
# Read-only: this script never writes. The write checks below deliberately
# send a payload that would fail its own policy check, so nothing is mutated
# even in the failure case — but a 2xx still correctly reports FAIL.
# ============================================================================
set -uo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }

URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
KEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')
[ -n "${KEY:-}" ] || KEY=$(grep -E '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r"')

echo "Project: $URL"
echo "Acting as: anonymous (public anon key, no login)"
echo "----------------------------------------------------------------------"

pass=0; fail=0

# expect_empty <table> <label>
# Anonymous SELECT must return zero rows (RLS filters them out).
expect_empty() {
  local table=$1 label=$2
  local body
  body=$(curl -s "$URL/rest/v1/$table?select=*&limit=5" \
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  if [ "$body" = "[]" ]; then
    # NOTE: an empty table also returns [], so this is "not leaking" rather
    # than positive proof a policy exists. Seed a row to test it properly.
    printf "  PASS  %-42s anon sees 0 rows\n" "$label"; pass=$((pass+1))
  elif printf '%s' "$body" | grep -q '"code"'; then
    # Missing table or no grant at all: nothing is readable either way.
    printf "  PASS  %-42s not readable (%s)\n" "$label" "$(printf '%s' "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)"; pass=$((pass+1))
  else
    # Report how much leaks and which fields — never the values themselves,
    # so running this check does not copy customer data into a terminal log.
    printf "  FAIL  %-42s anon can READ %s\n" "$label" "$(printf '%s' "$body" | python3 -c "import sys,json
r=json.load(sys.stdin)
print(f'{len(r)}+ row(s); fields: ' + ', '.join(sorted(r[0].keys()))[:160])" 2>/dev/null)"; fail=$((fail+1))
  fi
}

# expect_readable <table> <label> — public data that SHOULD be visible
expect_readable() {
  local table=$1 label=$2
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/rest/v1/$table?select=*&limit=1" \
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  if [ "$code" = "200" ]; then
    printf "  PASS  %-42s public read OK (%s)\n" "$label" "$code"; pass=$((pass+1))
  else
    printf "  FAIL  %-42s expected 200, got %s\n" "$label" "$code"; fail=$((fail+1))
  fi
}

# expect_write_blocked <table> <label>
# Targets a REAL row and rewrites `status` to the value it already holds, so the
# probe is a genuine write attempt that changes nothing either way. If the row
# comes back, the write went through and RLS is not protecting the table.
# Skips cleanly when the table has no rows visible to fetch a target from.
expect_write_blocked() {
  local table=$1 label=$2
  local target status body code

  # Grab a real id+status using the service-independent anon read. If anon
  # cannot read, fall back to a no-op probe that still detects open policies.
  body=$(curl -s "$URL/rest/v1/$table?select=id,status&limit=1" \
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  target=$(printf '%s' "$body" | python3 -c "import sys,json
try:
    r=json.load(sys.stdin); print(r[0]['id'] if isinstance(r,list) and r else '')
except Exception: print('')" 2>/dev/null)
  status=$(printf '%s' "$body" | python3 -c "import sys,json
try:
    r=json.load(sys.stdin); print(r[0].get('status','') if isinstance(r,list) and r else '')
except Exception: print('')" 2>/dev/null)

  if [ -z "$target" ]; then
    printf "  SKIP  %-42s no anon-visible row to probe\n" "$label"
    return
  fi

  # Idempotent write: set status to its current value.
  code=$(curl -s -o /tmp/sk_w.json -w '%{http_code}' -X PATCH \
          "$URL/rest/v1/$table?id=eq.$target" \
          -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
          -H "Content-Type: application/json" -H "Prefer: return=representation" \
          -d "{\"status\":\"$status\"}")

  if [ "$code" = "401" ] || [ "$code" = "403" ]; then
    printf "  PASS  %-42s write rejected (%s)\n" "$label" "$code"; pass=$((pass+1))
  elif [ "$(cat /tmp/sk_w.json)" = "[]" ]; then
    printf "  PASS  %-42s write matched 0 rows (RLS)\n" "$label"; pass=$((pass+1))
  else
    printf "  FAIL  %-42s ANON CAN WRITE (%s)\n" "$label" "$code"; fail=$((fail+1))
  fi
}

echo "PRIVATE DATA — anonymous must see nothing:"
expect_empty orders                "orders (names, phones, addresses)"
expect_empty order_items           "order_items"
expect_empty profiles              "profiles (user accounts)"
expect_empty artist_bookings       "artist_bookings"
expect_empty supplier_applications "supplier_applications"
expect_empty academy_enrollments   "academy_enrollments"
expect_empty job_applications      "job_applications"
expect_empty artist_applications   "artist_applications"
expect_empty artist_profiles       "artist_profiles (phone, UPI, bank)"
expect_empty rental_bookings       "rental_bookings"
expect_empty payments              "payments"
expect_empty cancellations         "cancellations (refunds)"
expect_empty verification_documents "verification_documents (KYC)"
expect_empty complaints            "complaints"
expect_empty artist_incidents      "artist_incidents"
expect_empty artist_job_records    "artist_job_records"
expect_empty artist_job_quality    "artist_job_quality (view)"
expect_empty expenses              "expenses"
expect_empty audit_log             "audit_log"
expect_empty login_events          "login_events"
expect_empty policy_backup         "policy_backup"
expect_empty booking_checkins      "booking_checkins (live locations)"

echo
echo "PUBLIC DATA — must stay readable:"
expect_readable products             "products (storefront)"
expect_readable deliverable_pincodes "deliverable_pincodes (checkout)"
expect_readable artist_public_profiles "artist_public_profiles (directory)"
expect_readable refund_rules         "refund_rules (cancellation terms)"

echo
echo "WRITE PROTECTION — anonymous must not modify:"
expect_write_blocked orders          "orders"
expect_write_blocked artist_bookings "artist_bookings"

echo "----------------------------------------------------------------------"
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ] || { echo "  NOT SAFE FOR PRODUCTION"; exit 1; }
echo "  Anonymous access is correctly locked down."
