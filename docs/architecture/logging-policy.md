# Logging Policy

This document defines what the Viva Web Designs CRM/admin platform logs, what it deliberately omits, and why.

## Guiding Principles

1. **Never log PII in plain text.** Names, email addresses, phone numbers, message contents, and other contact/lead data must never appear in application logs.
2. **Error context without data.** Errors are logged with their message string and structural context (method, path, status, requestId). They do not include request or response bodies.
3. **Useful for debugging.** Every log line carries enough information to correlate a request, find it in a log stream, and understand whether it succeeded or failed.

## Request / Response Logging

Every inbound API call to `/api/**` (excluding `/api/auth/**`) emits a single structured log line on completion:

```
METHOD /path STATUS in DURATIONms [requestId]
METHOD /path STATUS in DURATIONms [requestId] — error message
```

| Field | Source | Notes |
|-------|--------|-------|
| `METHOD` | `req.method` | GET, POST, PUT, DELETE |
| `/path` | `req.path` | Route path, no query string |
| `STATUS` | `res.statusCode` | HTTP status integer |
| `DURATIONms` | `Date.now() - start` | Wall-clock request latency |
| `requestId` | Random 8-char base36 string | Set on `res.locals.requestId` at middleware entry; reused by the global error handler |
| `error message` | `body.message` (string only) | Only appended for 4xx/5xx responses; always a short human-readable string, never a data dump |

### What is NOT logged

- Response bodies for 2xx/3xx responses (no data dumping).
- Full 4xx/5xx response objects — only the `message` string field.
- Request bodies — input data is never echoed to logs.
- `/api/auth/**` traffic — handled by better-auth before this middleware.

### Log level routing

- Status ≥ 500 → `console.error`
- All other API lines → `console.log` (via `log()` helper)

## Global Error Handler

Unhandled errors caught by the Express error middleware log:

```
[express] error METHOD /path STATUS [requestId] — message
```

In non-production environments (`NODE_ENV !== "production"`), the full error object (including stack trace) is additionally printed to `console.error` to aid debugging. This is suppressed in production to prevent SQL query fragments or internal paths appearing in hosted logs.

## Email / Notification Logging

The Mailgun integration logs:

```
[Mailgun] Email sent — ID: <messageId>
[Mailgun] Send failed (STATUS): <raw Mailgun error body>
[Mailgun] Send error: <error.message>
[Mailgun] Not configured — skipping email send
```

Recipient email addresses are **not** included in success log lines. Failed send responses from Mailgun's API may include technical error details but not message content.

## Feature-Level Error Logging

Each feature module (`console.error`) logs:

- The operation that failed (e.g. `"CRM ingest error (non-blocking):"`)
- The error object itself

This is safe because these catch blocks receive `Error` objects, not user-submitted request data.

## What to Avoid

- Do NOT log `req.body`, `res.body`, or any parsed user input.
- Do NOT log full error objects in production (stack traces may embed SQL containing user data).
- Do NOT log email addresses, phone numbers, or message text at any log level.
- Do NOT add `console.log` statements that stringify API responses.

## Adding New Logging

If a new feature requires operational visibility (e.g., a scheduled job, a background worker):

1. Log structured lines: `[module] action entityType entityId status`.
2. Never include field values that contain user-submitted text (names, messages, emails, phone numbers).
3. Use `console.error` for failure paths, `console.log` for informational paths.
