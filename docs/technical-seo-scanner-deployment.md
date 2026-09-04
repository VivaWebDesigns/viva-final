# Technical SEO Scanner deployment

The Technical SEO scanner is an authenticated admin tool backed by the `technical_seo_scans` PostgreSQL table. The normal web process creates and reads scan records. It never imports Playwright and never claims browser work.

## Railway services

Keep the existing `VivaWebDesigns.com` service unchanged. Create a second service from the same GitHub repository for browser work:

- Service name: `Technical SEO Scanner Worker`
- Dockerfile path: `Dockerfile.scanner`
- Start command: use the image default (`node dist/scanner-worker.cjs`)
- Replicas: 1 for the MVP
- Restart policy: on failure
- Required variable: `DATABASE_URL`
- Optional variable: `SCANNER_POLL_INTERVAL_MS=2000`

The Playwright image and package versions are deliberately pinned to `1.62.1`. Update them together.

Do not set unrelated CRM, email, OpenAI, payment, Google, or storage secrets on the scanner worker. Where Railway/PostgreSQL administration permits it, use a database role restricted to selecting and updating `technical_seo_scans`.

The worker must be deployed as a separate service. Do not change the existing web service start command to `start:scanner`, and do not run the scanner worker from `server/bootstrap.ts`.

## Database

Apply the Drizzle schema before starting the worker:

```sh
~/.local/bin/railway run -s "Viva Web Designs Database" -e production sh -lc 'DATABASE_URL="$DATABASE_PUBLIC_URL" npm run db:push'
```

Verify the table and important lease columns after the push. Never print the connection URL.

## MVP limits

- Maximum 2 active scans per user
- Maximum 10 new scans per user in 10 minutes
- One scan at a time per worker replica
- 8 redirects
- 2 MB per raw response
- 4 MB rendered DOM capture
- 15-second individual HTTP timeout
- 25-second browser navigation timeout
- 150 browser requests
- 500 stored links per internal/external category
- 3 sitemap files, each capped at 1 MB; no recursive sitemap crawling
- 2 worker attempts with a 45-second renewable lease
- Normalized results retained for 90 days

Large raw page captures are not persisted in the MVP. The database stores normalized evidence and bounded text samples. R2 is therefore not required for the initial deployment.

## Security boundary

The application validates the submitted URL, every HTTP redirect, robots and sitemap URLs, Chromium navigation, and browser subrequests. It rejects non-HTTP schemes, credentials in URLs, internal hostnames, nonstandard ports, and private, loopback, link-local, carrier-grade NAT, benchmark, multicast, and reserved addresses.

These controls reduce SSRF risk but are not a substitute for infrastructure isolation. Keep the worker separate from the web process, minimize its secrets, and prevent access to unnecessary private services wherever Railway networking controls permit. The report always identifies the Googlebot profile as simulated and unverified.

## Lifecycle and recovery

The lifecycle is `queued -> validating -> fetching -> rendering -> analyzing -> completed`, with `failed` and `cancelled` exits. A claimed scan receives a renewable lease. After a worker crash, another worker may reclaim an expired lease. After two interrupted attempts, the scan is marked failed rather than remaining stuck indefinitely.
