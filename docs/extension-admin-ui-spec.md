# Marketplace Extension — Admin UI Spec
### Name Override & Name List Management

**Date:** April 6, 2026  
**Status:** Backend complete. Extension UI implementation required.  
**Audience:** Extension developer

---

## Background

When `/api/marketplace/precheck` returns `reason: "name_score_below_threshold"`, the seller's
name didn't score high enough to be recognized as Hispanic. Admins now have two options instead
of just stopping:

1. **Override** — skip the name score for this one seller and continue anyway (CRM duplicate
   check still runs)
2. **Add name** — permanently add the missing first name, surname, or both to the scoring
   lists so future lookups on the same name pass automatically

Both options are gated on a new `adminActionsAllowed` field that the backend returns on every
precheck response.

---

## 1. Updated Precheck Response

Every response from `POST /api/marketplace/precheck` now includes one additional field:

```json
{
  "shouldContinue": false,
  "reason": "name_score_below_threshold",
  "normalizedName": "john smith",
  "firstName": "john",
  "lastName": "smith",
  "hispanicNameScore": 25,
  "spanishOutreachRecommended": false,
  "sellerExistsInCrm": false,
  "adminActionsAllowed": true
}
```

| Field | Type | Meaning |
|---|---|---|
| `adminActionsAllowed` | `boolean` | `true` when the request was authenticated with the bot secret. `false` for all session-authenticated callers regardless of role. |

This field is present on **all three** precheck response shapes (name score fail, CRM duplicate,
and pass).

---

## 2. When to Show Admin Buttons

Show the admin action buttons **only when all three conditions are true:**

```
shouldContinue === false
AND reason === "name_score_below_threshold"
AND adminActionsAllowed === true
```

If `adminActionsAllowed` is `false`, show nothing different from today — the extension behavior
is completely unchanged for non-bot-secret callers.

---

## 3. Buttons to Show

When the conditions above are met, show four actions:

| Button | Enabled when | API call |
|---|---|---|
| **Override** | Always | `POST /precheck-override` |
| **Add first name** | `firstName` is non-empty string | `POST /admin/add-names { firstName }` |
| **Add surname** | `lastName` is non-empty string | `POST /admin/add-names { lastName }` |
| **Add both** | Both `firstName` and `lastName` are non-empty | `POST /admin/add-names { firstName, lastName }` |

Use the `firstName` and `lastName` values from the precheck response as the inputs.
If either is an empty string, disable that button and show a short inline note like
"(first name not detected)" or "(surname not detected)".

---

## 4. API: Override

### Request

```
POST /api/marketplace/precheck-override
Authorization: Bearer <MARKETPLACE_BOT_SECRET>
Content-Type: application/json

{
  "sellerName": "<same value sent to /precheck>",
  "sellerProfileUrl": "<same value sent to /precheck>"
}
```

### Success response

```json
{
  "shouldContinue": true,
  "reason": "override_name_score",
  "normalizedName": "john smith",
  "firstName": "john",
  "lastName": "smith",
  "hispanicNameScore": 25,
  "spanishOutreachRecommended": false,
  "sellerExistsInCrm": false,
  "adminActionsAllowed": true
}
```

**On `shouldContinue: true`** → proceed with the normal downstream flow (same as a passing
precheck). The `reason` will be `"override_name_score"` instead of `"passed"` — handle it the
same way.

### Duplicate found response

```json
{
  "shouldContinue": false,
  "reason": "seller_already_in_crm",
  "sellerExistsInCrm": true,
  "existingLeadId": "...",
  "existingLeadName": "...",
  "adminActionsAllowed": true
}
```

**On `shouldContinue: false, reason: "seller_already_in_crm"`** → show the same "already in
CRM" message as a normal precheck duplicate. The override cannot bypass a real CRM duplicate.

---

## 5. API: Add Name(s)

### Request

Send whichever combination the user chose (firstName only, lastName only, or both):

```
POST /api/marketplace/admin/add-names
Authorization: Bearer <MARKETPLACE_BOT_SECRET>
Content-Type: application/json

{ "firstName": "john" }           // Add first name only
{ "lastName": "smith" }           // Add surname only
{ "firstName": "john", "lastName": "smith" }  // Add both
```

At least one of `firstName` or `lastName` must be present. The backend normalizes both
(strips accents, lowercases, trims) so you can pass the raw values from the precheck response.

### Success response

```json
{
  "added":          { "firstNames": ["john"], "surnames": [] },
  "alreadyExisted": { "firstNames": [],       "surnames": [] }
}
```

- `added` — names that were new and have been saved
- `alreadyExisted` — names that were already in the list (no duplicate stored, idempotent)

Both arrays can be empty. A name that was already in the base list (not just admin-added) will
appear in `alreadyExisted`.

---

## 6. Full Flow — Add Name then Re-check

```
1. Precheck fails: name_score_below_threshold, adminActionsAllowed: true
2. Admin clicks "Add surname" (or "Add both")
3. POST /admin/add-names → success
4. Show brief inline status: "Added."
5. Automatically re-run POST /precheck with the same inputs
6a. If precheck now passes (shouldContinue: true) → proceed normally
6b. If precheck still fails (shouldn't happen, but safe fallback):
    → show updated score + keep Override button visible
7. On API error → show inline error message, do not proceed
```

---

## 7. Full Flow — Override (skip name check)

```
1. Precheck fails: name_score_below_threshold, adminActionsAllowed: true
2. Admin clicks "Override"
3. POST /precheck-override
4a. shouldContinue: true, reason: "override_name_score" → proceed normally
4b. shouldContinue: false, reason: "seller_already_in_crm" → show duplicate message
4c. API error → show inline error, stay in current state
```

---

## 8. Authentication

No change. The extension already sends:

```
Authorization: Bearer <MARKETPLACE_BOT_SECRET>
```

Send the same header to both new endpoints. The bot secret is the only credential accepted
by these routes for extension use.

---

## 9. Error Handling Summary

| HTTP status | Meaning | Show to user |
|---|---|---|
| 200 | Success | Per flow above |
| 400 | Validation error (missing fields, bad URL) | "Invalid request — check inputs" |
| 401 | Bot secret missing or wrong | "Authentication error — check extension config" |
| 403 | Session auth used but not admin/developer | Not expected from extension |
| 500 | Server error | "Server error — try again" |

---

## 10. Base URLs

| Environment | Base URL |
|---|---|
| Production | `https://<deployed-domain>/api/marketplace` |
| Development | `https://<replit-dev-domain>/api/marketplace` |

Both environments share the same database, so names added in dev are immediately live in
production.
