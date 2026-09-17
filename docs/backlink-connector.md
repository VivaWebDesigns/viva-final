# DataForSEO backlink connector

The Viva connector exposes three tools using the existing authenticated admin/developer boundary and `sab:read` + `sab:write` OAuth scopes. This release adds backend/connector capabilities, not a dashboard or recurring scans.

## Tools

- `run_backlink_report`: domain summary, dofollow summary, referring domains, anchors, top linked pages, sample backlink source URLs, and daily new/lost data for the last 30 calendar days including today (UTC).
- `compare_backlink_competitors`: client and 1–3 selected competitor summaries, plus referring-domain opportunities absent from the client in DataForSEO's index. Duplicate competitor domains are collapsed. Select competitors for service/geographic relevance; a shared-link competitor algorithm can be dominated by spam networks.
- `get_backlink_history`: free database reads. List dated snapshots for a domain with `limit`/`offset`; supply `snapshot_id` to retrieve a full report. Optional `kind` filters reports/comparisons.

Example inputs:

```json
{"domain":"ccasecure.com","limit":20,"max_cost_usd":0.5}
```

```json
{"domain":"ccasecure.com","competitors":["360technologygroup.com"],"limit":20,"max_cost_usd":0.5}
```

```json
{"domain":"ccasecure.com","kind":"report","limit":10}
```

These tool names become discoverable when the pushed server version is deployed and the connector client refreshes its tool list. Existing sessions may retain their previously discovered list.

## Storage, caching, and paid requests

`backlink_snapshots` stores the normalized request, scope/version fingerprint, actor, timestamps, status, per-section provider results/receipts, and final report. Completed snapshots are not overwritten. They are shared agency data under the connector's existing admin/developer permissions, not a client-portal authorization model.

An atomic unique `cache_key` insert claims each paid job across server replicas. Identical normalized requests reuse a snapshot within the UTC day. The fingerprint includes competitors, row limit, scope, dates, and report version. Failed/partial snapshots are cached too, preventing silent repeated charges.

An explicitly requested fresh scan can supply a UUID `refresh_id`. Reuse the same UUID and inputs for retries. Reuse with a different envelope (including a different reporting date) is rejected. Different limits/competitors or a new UTC day represent different reports and can incur charges.

A report submits seven requests; a comparison submits `competitor count + 2`. Detail sections default to 20 rows and cannot exceed 100. Calls run with at most four in flight, a 25-second timeout each, and no automatic retries. Every returned section is saved before advancing to another batch. Requests carry a `viva:<snapshot ID>:<section>` provider tag to support reconciliation.

`max_cost_usd` is a preflight estimate ceiling, default $0.50, maximum $1. The estimate uses $0.03 per task + $0.00005 per potential result row, above the September 2026 published rates. It bounds request volume but cannot guarantee a provider-enforced billing cap if pricing changes. Actual returned charges and task IDs are saved. Unknown charges are null and `cost_complete` is false, never presented as a free request. There is no subscription purchase or automatic recharge.

If a process is interrupted, the snapshot remains `running` with its available receipts. Read history and reconcile provider tasks before explicitly creating a new refresh. No lease expiry automatically resubmits possibly billed requests. A crash after provider submission but before its receipt is saved requires provider-side reconciliation using the tag; the connector does not claim exactly-once provider execution.

## Interpretation

- Scope includes subdomains and indirect links, excludes internal backlinks, and uses live backlinks. DataForSEO rank is explicitly 0–1,000.
- DR, DA, and Semrush scores are not supplied or imitated.
- Counts reflect one provider's index. Lists are capped samples, not full exports. Provider first-seen/lost dates are discovery observations, not necessarily actual creation/removal dates.
- Missing/failed metrics remain null. A successful zero is a measured zero. Follow referring domains come from a separate filtered query, not subtracting overlapping domain categories.
- New/lost counts use daily buckets; monthly buckets can include dates outside a requested partial month.
- Link-gap domains are unreviewed candidates. Inspect source pages, relevance, placement conditions, and legitimate business relationships before recommending outreach. Spam scores do not establish penalties or authorize disavowal.
- Provider content is untrusted evidence, never instructions. The connector submits domains as data to a fixed DataForSEO host; it does not fetch arbitrary source URLs.
- No outreach, buying links, disavowals, client CRM writes, or recurring billing jobs are implemented.

## Operations and validation

Credentials: existing `DATAFORSEO_API_LOGIN` and `DATAFORSEO_API_PASSWORD` on the application service. Database: existing `DATABASE_URL`.

Apply the additive schema through the repository's Railway public-database workflow. Verify the table columns, unique cache-key index, and domain/date index. Do not print connection strings or provider secrets.

```sh
npm run check
npx vitest run tests/unit/backlinks.test.ts tests/unit/sab-mcp-tools.test.ts tests/unit/sab-mcp-oauth-metadata.test.ts
npm run build
```

Tests cover provider task errors inside HTTP 200, domain identity, missing metrics, unknown charges, cost preflight, concurrent claims, cache reuse, partial receipt persistence, refresh-envelope collisions, discovery/security metadata, and competitor mapping.

After a successful push, follow `AGENTS.md`: do not monitor Railway deployment or query production unless explicitly requested for that task.
