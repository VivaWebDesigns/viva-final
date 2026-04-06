# Marketplace Extension — Resume State Spec
### Popup Reopen / Stage Restore on Same Listing

**Date:** April 6, 2026
**Status:** Backend route live (Task #25 complete). Extension implementation required.
**Audience:** Extension developer

---

## Problem

When the popup is closed (e.g. to click into Facebook and send a message), all in-memory
popup state is lost. Reopening the extension on the same listing behaves like a fresh session
and shows "Create Pending Outreach" even if a record already exists. If the user clicks it
again the backend returns a 409 conflict but the extension does not gracefully resume.

---

## Solution

On every popup open, after extracting the current seller/listing identifiers, call a new
backend lookup route before rendering any UI. Use the response to decide which stage to show.

---

## Backend Lookup Route (now live)

```
GET /api/marketplace/pending-outreach/lookup?sellerProfileUrl=<encoded-url>
Authorization: Bearer <MARKETPLACE_BOT_SECRET>
```

Use the same bot secret already used for all other marketplace extension calls.
Construct the URL as: `CONFIG.BACKEND_BASE_URL + "/api/marketplace/pending-outreach/lookup"`.
`sellerProfileUrl` must be URL-encoded.

### Response — no record found

```json
{ "found": false }
```

### Response — record found

```json
{
  "found": true,
  "record": {
    "id": "...",
    "messageStatus": "awaiting_reply",
    "sellerFullName": "...",
    "nameScore": 85,
    "city": "...",
    "state": "TX",
    "listingUrl": "...",
    "outreachSentAt": "2026-04-06T12:00:00.000Z",
    "replyReceivedAt": null,
    "convertedAt": null,
    "crmLeadId": null
  }
}
```

`messageStatus` will be one of:
`ready_to_message` | `message_sent` | `awaiting_reply` | `reply_received` |
`manual_review_required` | `converted` | `skipped`

The backend returns the **most recent** record for the seller URL, across all statuses
including terminal ones (`converted`, `skipped`). If the seller has been worked before
and converted, the popup will correctly show the converted state instead of offering
to create a new record.

---

## Where to Add the Lookup

In `popup.js`, add a lookup call immediately after the seller profile URL is extracted
and before any precheck or result UI is rendered.

Pseudocode:

```javascript
async function initPopup() {
  const sellerProfileUrl = extractSellerProfileUrl();
  const listingUrl = extractListingUrl();

  if (!sellerProfileUrl) {
    showError("Could not detect seller profile URL.");
    return;
  }

  // Look up any existing record for this seller before doing anything else
  let lookup;
  try {
    lookup = await lookupPendingOutreach(sellerProfileUrl);
  } catch (err) {
    console.error("[lookup] failed, falling back to fresh session:", err);
    lookup = { found: false };
  }

  if (lookup.found) {
    currentPendingOutreachId = lookup.record.id;
    showResumedState(lookup.record);
  } else {
    runCheck(); // fresh session — precheck as normal
  }
}

async function lookupPendingOutreach(sellerProfileUrl) {
  const url = CONFIG.BACKEND_BASE_URL
    + "/api/marketplace/pending-outreach/lookup"
    + "?sellerProfileUrl=" + encodeURIComponent(sellerProfileUrl);
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + CONFIG.AUTH_TOKEN }
  });
  if (!res.ok) throw new Error("Lookup failed: " + res.status);
  return res.json();
}
```

---

## UI States for Resumed Records

Map `record.messageStatus` to these UI states:

| messageStatus | Banner copy | Actions shown |
|---|---|---|
| `ready_to_message` | "Existing pending outreach found — message not yet sent" | Mark Message Sent |
| `message_sent` | "Message sent — awaiting reply" | None (waiting state) |
| `awaiting_reply` | "Message sent — awaiting reply" | None (waiting state) |
| `reply_received` | "Reply received — ready to convert" | Convert to CRM |
| `manual_review_required` | "Reply received — pending manual review in Viva" | None (admin resolves in Viva) |
| `converted` | "Already converted to CRM" | Open in Viva link |
| `skipped` | "This seller was previously skipped" | None |

For `converted`, use `record.crmLeadId` to build the Viva link:
`CONFIG.BACKEND_BASE_URL + "/crm/leads/" + record.crmLeadId`

Show the resumed-state banner visually distinct from a fresh check result — e.g. a muted
blue border or italic label — so the user immediately knows this is a restored state.

---

## What NOT to Change

- The precheck flow for fresh sessions (no record found) is unchanged
- All existing button handlers remain unchanged
- Do not create a new pending outreach record if a resumed one already exists
- The 409 handling in Create Pending Outreach stays as a defensive fallback (race condition)

---

## Error Handling

If the lookup call fails (network error, 401, 500), catch the error, log it, and fall back
to the normal fresh-session precheck flow. Do not block the popup from loading.

---

## Edge Cases and Limitations

**Multiple listings, same seller**
The lookup is by `sellerProfileUrl` (seller identity), not `listingUrl` (specific ad).
If the same seller has multiple listings, the most recent record is returned. This matches
the existing duplicate-detection behavior throughout the system.

**Skipped records**
Show "Previously skipped" and offer no actions. Do not auto-create a new record —
skipped is a deliberate terminal state.

**Lookup API error**
Fall back to the normal fresh precheck. Do not crash or block the popup.

---

## Test Checklist

| Scenario | Expected behavior |
|---|---|
| New seller, no record | Normal precheck runs, fresh UI shown |
| Record exists, `ready_to_message` | Resume banner shown, Mark Message Sent available |
| Record exists, `awaiting_reply` | "Awaiting reply" state shown, no actions |
| Record exists, `reply_received` | "Ready to convert" shown, Convert to CRM available |
| Record exists, `converted` | "Already converted" shown, Open in Viva link |
| Record exists, `skipped` | "Previously skipped" shown, no actions |
| Close popup, check other sellers, return to same listing | Correct state resumes |
| Lookup API returns error | Falls back to normal precheck, logs error |
| `sellerProfileUrl` not extractable | Error shown, popup does not crash |
