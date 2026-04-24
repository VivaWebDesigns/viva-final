#!/usr/bin/env bash
# Verify /api/marketplace/pending-outreach/my-leads contract
# Run against the local dev server (must be running on port 5000).
#
# Usage: bash tests/verify-my-leads-contract.sh
#
# Exit 0 = all checks passed
# Exit 1 = one or more checks failed

set -euo pipefail

BASE="http://localhost:5000"
PASS=0
FAIL=0

ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# ── Sign in as admin ────────────────────────────────────────────────────────
echo ""
echo "=== Setup: sign in as admin and create a test extension_worker ==="

ADMIN_RESP=$(curl -s -X POST "$BASE/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vivawebdesigns.com","password":"VivaAdmin2026!"}' -i)

ADMIN_TOKEN=$(echo "$ADMIN_RESP" | grep "set-auth-token:" | sed 's/set-auth-token: //' | tr -d '\r\n')

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: Could not sign in as admin. Is the server running on port 5000?"
  exit 1
fi

# Create a temporary test worker
WORKER_CREATE=$(curl -s -X POST "$BASE/api/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Verify Worker","email":"verify.worker.tmp@vivawebdesigns.com","password":"VerifyTest2026!","role":"extension_worker"}')

WORKER_ID=$(echo "$WORKER_CREATE" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')

if [ -z "$WORKER_ID" ]; then
  echo "ERROR: Could not create test worker. Response: $WORKER_CREATE"
  exit 1
fi
echo "  Test worker ID: $WORKER_ID"

# Sign in as worker (simulate extension chrome-extension:// origin)
WORKER_RESP=$(curl -s -X POST "$BASE/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -H "Origin: chrome-extension://verify-test-id" \
  -d '{"email":"verify.worker.tmp@vivawebdesigns.com","password":"VerifyTest2026!"}' -i)

WORKER_TOKEN=$(echo "$WORKER_RESP" | grep "set-auth-token:" | sed 's/set-auth-token: //' | tr -d '\r\n')

if [ -z "$WORKER_TOKEN" ]; then
  echo "ERROR: Worker sign-in failed. chrome-extension:// origin may not be trusted."
  exit 1
fi
echo "  Worker signed in OK"

BOT_SECRET="mktbot-viva-2026-xK9pQ"

# ── Test 1: /my-leads requires real session (bot secret rejected) ────────────
echo ""
echo "=== Test 1: Bot secret is rejected by /my-leads (requireRole, not botOrRole) ==="
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/marketplace/pending-outreach/my-leads" \
  -H "Authorization: Bearer $BOT_SECRET")
[ "$STATUS" = "401" ] && ok "/my-leads rejects bot secret with 401" || fail "/my-leads should return 401 for bot secret, got $STATUS"

# ── Test 2: Worker token accepted, empty queue initially ────────────────────
echo ""
echo "=== Test 2: Worker token accepted by /my-leads, returns correct response shape ==="
RESP=$(curl -s "$BASE/api/marketplace/pending-outreach/my-leads" -H "Authorization: Bearer $WORKER_TOKEN")
TOTAL=$(echo "$RESP" | grep -o '"total":[0-9]*' | sed 's/"total"://')
HAS_ITEMS=$(echo "$RESP" | grep -c '"items":\[')
[ "$TOTAL" = "0" ] && ok "Empty worker queue returns total=0" || fail "Expected total=0 for new worker, got $TOTAL"
[ "$HAS_ITEMS" -ge "1" ] && ok "Response has items array" || fail "Response missing items array"

# ── Test 3: Create record with worker token → createdBy = workerId ──────────
echo ""
echo "=== Test 3: createdBy is set when worker token is used on create ==="
CREATE_RESP=$(curl -s -X POST "$BASE/api/marketplace/pending-outreach" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WORKER_TOKEN" \
  -d '{
    "sellerFullName":"Verify Test Seller",
    "sellerProfileUrl":"https://www.facebook.com/marketplace/profile/verify.test.seller.001",
    "nameScore":80,
    "precheckPassed":true
  }')
CREATED_BY=$(echo "$CREATE_RESP" | grep -o '"createdBy":"[^"]*"' | sed 's/"createdBy":"//;s/"//')
RECORD_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ "$CREATED_BY" = "$WORKER_ID" ] && ok "createdBy = workerId when worker token used" || fail "Expected createdBy=$WORKER_ID, got '$CREATED_BY'"

# ── Test 4: Create record with bot secret → createdBy = null ────────────────
echo ""
echo "=== Test 4: createdBy is null when bot secret is used on create ==="
BOT_RESP=$(curl -s -X POST "$BASE/api/marketplace/pending-outreach" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOT_SECRET" \
  -d '{
    "sellerFullName":"Bot Created Seller",
    "sellerProfileUrl":"https://www.facebook.com/marketplace/profile/verify.bot.seller.001",
    "nameScore":80,
    "precheckPassed":true
  }')
BOT_CREATED_BY=$(echo "$BOT_RESP" | grep -o '"createdBy":[^,}]*' | sed 's/"createdBy"://')
BOT_RECORD_ID=$(echo "$BOT_RESP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
[ "$BOT_CREATED_BY" = "null" ] && ok "createdBy = null when bot secret used" || fail "Expected null createdBy for bot, got '$BOT_CREATED_BY'"

# ── Test 5: /my-leads scoping — worker sees only their own record ────────────
echo ""
echo "=== Test 5: Worker queue is scoped to createdBy = workerId ==="
MINE=$(curl -s "$BASE/api/marketplace/pending-outreach/my-leads" -H "Authorization: Bearer $WORKER_TOKEN")
MINE_TOTAL=$(echo "$MINE" | grep -o '"total":[0-9]*' | sed 's/"total"://')
MINE_STATUS=$(echo "$MINE" | grep -o '"messageStatus":"[^"]*"' | head -1)
[ "$MINE_TOTAL" = "1" ] && ok "Worker sees exactly 1 record (their own)" || fail "Expected total=1, got $MINE_TOTAL"
echo "$MINE" | grep -q '"messageStatus":"ready_to_message"' && ok "Record is the worker-created one (ready_to_message)" || fail "Worker record has unexpected status"

# ── Test 6: statusGroup=open includes ready_to_message, excludes converted ──
echo ""
echo "=== Test 6: statusGroup=open filters correctly ==="
OPEN_TOTAL=$(curl -s "$BASE/api/marketplace/pending-outreach/my-leads?statusGroup=open" \
  -H "Authorization: Bearer $WORKER_TOKEN" | grep -o '"total":[0-9]*' | sed 's/"total"://')
CONV_TOTAL=$(curl -s "$BASE/api/marketplace/pending-outreach/my-leads?statusGroup=converted" \
  -H "Authorization: Bearer $WORKER_TOKEN" | grep -o '"total":[0-9]*' | sed 's/"total"://')
[ "$OPEN_TOTAL" = "1" ] && ok "?statusGroup=open returns 1 (the ready_to_message record)" || fail "Expected 1, got $OPEN_TOTAL"
[ "$CONV_TOTAL" = "0" ] && ok "?statusGroup=converted returns 0 (not yet converted)" || fail "Expected 0, got $CONV_TOTAL"

# ── Test 7: group alias works (backend v2+) ──────────────────────────────────
echo ""
echo "=== Test 7: group alias for statusGroup prevents silent filter bypass ==="
ALIAS_TOTAL=$(curl -s "$BASE/api/marketplace/pending-outreach/my-leads?group=open" \
  -H "Authorization: Bearer $WORKER_TOKEN" | grep -o '"total":[0-9]*' | sed 's/"total"://')
[ "$ALIAS_TOTAL" = "1" ] && ok "?group=open (alias) returns same result as ?statusGroup=open" || fail "Expected 1, got $ALIAS_TOTAL"

# ── Cleanup ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Cleanup: remove test records and worker ==="
# Delete test pending outreach records via admin
curl -s -X DELETE "$BASE/api/marketplace/pending-outreach/$RECORD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1 || true
curl -s -X DELETE "$BASE/api/marketplace/pending-outreach/$BOT_RECORD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1 || true
# Delete test worker via admin
curl -s -X DELETE "$BASE/api/admin/users/$WORKER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1 || true
echo "  Cleanup attempted (failures OK if delete endpoints not available)"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "================================="
echo "Results: $PASS passed, $FAIL failed"
echo "================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
