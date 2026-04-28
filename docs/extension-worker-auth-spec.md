# Marketplace Extension — Worker Auth and My-Leads API Spec

**Date:** April 24, 2026
**Status:** Backend complete. Extension implementation required.
**Audience:** Extension developer

---

## Overview

When a user is signed in as `extension_worker`, the extension must use their personal bearer token
(not the shared bot secret) for all worker-scoped API calls. The bot secret is for anonymous/bot
automation only. Worker tokens enable attribution, scoping, and per-worker queue views.

---

## Sign-In Flow

```
POST /api/auth/sign-in/email
Content-Type: application/json
Origin: chrome-extension://<extension-id>

{ "email": "<worker-email>", "password": "<worker-password>" }
```

**Success response (200):**
```json
{
  "token": "<short-token>",
  "user": { "id": "...", "name": "...", "email": "...", "role": "extension_worker" }
}
```

**Critical:** Read the `set-auth-token` response **header** (not the body token). This is the full
bearer token value to store and use on subsequent requests.

```
set-auth-token: <full-bearer-token>
```

Store in `chrome.storage.local`:
```javascript
const token = response.headers.get('set-auth-token');
await chrome.storage.local.set({ workerToken: token, workerId: user.id });
```

---

## Authentication in Worker Mode

When `workerToken` is present in `chrome.storage.local`, the extension is in `worker_signed_in`
mode. All three marketplace operations listed below **must** send the worker token, not the bot
secret:

```
Authorization: Bearer <workerToken>
```

The bot secret must **never** be sent when a worker token is available. Bot-secret requests:
- Set `createdBy = null` on created records (no attribution)
- Are rejected with 401 on `/my-leads` (bot secret is not accepted there)

---

## Create Pending Outreach

```
POST /api/marketplace/pending-outreach
Authorization: Bearer <workerToken>   ← use worker token, NOT bot secret
Content-Type: application/json
```

When the worker token is used, the created record will have `createdBy = <workerId>` in the
database. This is what makes the record appear in that worker's queue and attributes the lead
to them in admin views.

---

## My-Leads Queue

```
GET /api/marketplace/pending-outreach/my-leads
Authorization: Bearer <workerToken>   ← required; bot secret returns 401
```

**Query parameters:**

| Param | Type | Accepted values | Default |
|---|---|---|---|
| `statusGroup` | string | `open`, `converted`, `closed` | (all statuses) |
| `page` | number | ≥ 1 | 1 |
| `limit` | number | 1–100 | 50 |

> **Important:** The canonical parameter name is `statusGroup`. The alias `group` is also accepted
> as a fallback (backend v2+). Always prefer `statusGroup` in new code.

**statusGroup mapping:**
- `open` → `ready_to_message`, `message_sent`, `awaiting_reply`, `reply_received`, `manual_review_required`
- `converted` → `converted`
- `closed` → `skipped`, `duplicate_business`

**If `statusGroup` is omitted**, all statuses are returned — do not use this for the Active or
Converted views. Always pass a statusGroup when showing filtered counts.

**Response shape:**
```json
{
  "items": [
    {
      "id": "...",
      "sellerFullName": "...",
      "businessName": null,
      "city": "...",
      "state": "TX",
      "tradeGuess": "...",
      "messageStatus": "ready_to_message",
      "createdAt": "2026-04-24T18:00:00.000Z",
      "updatedAt": "2026-04-24T18:00:00.000Z",
      "convertedAt": null,
      "listingUrl": "...",
      "sellerProfileUrl": "..."
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 50
}
```

**How to use in the extension:**

```javascript
// On popup open in worker_signed_in mode — initialize both counters from backend
async function initWorkerCounts(workerToken) {
  const [activeRes, convertedRes] = await Promise.all([
    fetch(CONFIG.BACKEND_BASE_URL + '/api/marketplace/pending-outreach/my-leads?statusGroup=open', {
      headers: { Authorization: 'Bearer ' + workerToken }
    }),
    fetch(CONFIG.BACKEND_BASE_URL + '/api/marketplace/pending-outreach/my-leads?statusGroup=converted', {
      headers: { Authorization: 'Bearer ' + workerToken }
    }),
  ]);
  const active    = await activeRes.json();
  const converted = await convertedRes.json();

  setActiveCount(active.total);       // use result.total, not items.length
  setConvertedCount(converted.total); // use result.total, not items.length
}
```

> **Do not initialize counts from session-local state.** Always fetch from backend on popup open
> so counts survive popup close/reopen. Local increments after in-session operations are fine,
> but the backend is the source of truth on every new popup open.

---

## Convert to CRM

```
POST /api/marketplace/pending-outreach/:id/convert-to-crm
Authorization: Bearer <workerToken>   ← use worker token, NOT bot secret
Content-Type: application/json
```

Using the worker token here ensures the CRM lead's `assignedTo` defaults to the worker's user ID
when no explicit `assignedTo` is provided.

Conversion attribution is tracked separately from origination:
- `createdBy` preserves the worker who originally created/sourced the pending outreach record.
- `convertedBy` is set to the authenticated user who completes `convert-to-crm`.

Admin payroll and conversion reporting should credit worker conversions by `convertedBy`, with
`createdBy` used only as a fallback for legacy records created before `convertedBy` existed.

---

## Token Priority Rules

```
┌─────────────────────────────────────────────────────────┐
│ workerToken in chrome.storage.local?                    │
│   YES → use workerToken for ALL three operations above  │
│   NO  → use bot secret (anonymous/bot mode)             │
└─────────────────────────────────────────────────────────┘
```

Never mix tokens within a session. If the worker is signed in, all three calls use the worker token.

---

## Sign-Out

Clear `workerToken` and `workerId` from `chrome.storage.local`. Subsequent requests revert to
using the bot secret.

---

## Live Verification Results (April 24, 2026)

The following was verified against the live dev backend:

| Test | Result |
|---|---|
| Sign in as extension_worker | ✅ Returns `set-auth-token` header |
| chrome-extension:// origin accepted | ✅ No CSRF rejection |
| Create record with worker token | ✅ `createdBy = workerId` in DB |
| Create record with bot secret | ✅ `createdBy = null` (by design) |
| `/my-leads` with worker token | ✅ Returns only worker's records |
| `/my-leads?statusGroup=open` | ✅ Excludes converted/closed records |
| `/my-leads?statusGroup=converted` | ✅ Returns only converted records |
| `/my-leads?group=open` (alias) | ✅ Accepted as statusGroup alias (backend v2+) |
| `/my-leads` with bot secret | ✅ Returns 401 (correctly rejected) |
| Worker scoping | ✅ Bot-created records (createdBy=null) do NOT appear in worker queue |
