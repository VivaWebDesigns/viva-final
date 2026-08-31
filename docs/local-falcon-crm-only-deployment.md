# CRM-only schema deployment

The revised importer requires the new `public.local_falcon_crm_only_prospects` table. Apply and verify this additive schema before deploying the application changes. Do not run migrations automatically during application startup.

The prepared migration is `script/sql/local-falcon-crm-only-additive.sql`. It creates only the CRM-only table, its exact Place-ID uniqueness constraint, batch/lead foreign keys, and lookup indexes. It neither changes existing tables nor creates leads, reports, outreach, or scans. It is transactional with a five-second lock timeout. If the table already exists with a different structure, stop and investigate rather than adding a destructive cleanup step.

After authenticating Railway and checking the intended project, database service, and environment, apply the SQL through an authorized database connection. The application service's private database hostname is not reachable from a normal local shell; use the database service's public connection without printing its value. For an authenticated Railway CLI with `psql` installed:

```sh
~/.local/bin/railway run -s "Viva Web Designs Database" -e production sh -lc 'psql "$DATABASE_PUBLIC_URL" -v ON_ERROR_STOP=1 -f script/sql/local-falcon-crm-only-additive.sql'
```

Then execute the separate read-only verification:

```sh
~/.local/bin/railway run -s "Viva Web Designs Database" -e production sh -lc 'psql "$DATABASE_PUBLIC_URL" -v ON_ERROR_STOP=1 -f script/sql/local-falcon-crm-only-verify.sql'
```

Every returned check must have `passed = true`. The query reads only schema metadata: all twelve required columns/types/nullability, defaults, primary/unique keys, both foreign keys and their deletion behavior, and both valid lookup indexes. It reads no lead data or secrets. A false check blocks deployment; do not treat a successful command exit alone as verification.

Offline tests compare the migration with the checked-in schema and verify the read-only script structure. They do not establish database execution. Report schema application, schema verification, application deployment, and live behavior verification as separate results. Do not launch a paid scan to validate this change.
