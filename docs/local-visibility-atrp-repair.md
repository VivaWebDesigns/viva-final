# All-point report average

Customer-facing **Average Google Maps Position** uses Local Falcon **ATRP**,
covering all scanned points, not ARP (which omits unranked points). The report
labels this explicitly. The existing display convention renders values at or
above 20 as `20+`; the database retains the exact numeric ATRP.

ARP remains a separate, unchanged field for scan comparisons and audit history.
This repair does not change SOP centering, qualification, or canonical-selection
rules and does not submit scans.

## Future imports

One `batch.json` remains sufficient. Both supported prospect schemas accept an
optional numeric `atrp`, but preview and confirmation independently retrieve the
authoritative metric from the existing report and verify its exact report key
and Place ID. Missing ATRP blocks import rather than falling back to ARP.
The imported record stores both metrics. An older client cannot confirm an
ARP-rendered preview or overwrite a corrected snapshot without reloading.

Screenshot extraction reads only explicitly labeled ATRP. If absent, it requires
review; an unlabeled number or ARP tile is not an acceptable substitute.

## Existing-report repair

`script/audit-local-visibility-metrics.ts` counts stored reports and ATRP coverage.
`script/repair-local-visibility-atrp.ts` has three explicit modes:

1. `--prepare /absolute/recovery-directory`: saves original database records,
   delivery links, and original images; reads existing Local Falcon metrics;
   renders replacement PNGs without changing production. Inspect samples before
   applying. It uses an isolated headless renderer, not an interactive browser.
2. `--apply /absolute/recovery-directory`: requires complete preparation; uploads
   new image objects, verifies their bytes, and replaces ATRP/snapshot metadata
   with optimistic concurrency checks. Existing public delivery landing pages
   point to newly hashed image URLs. No original objects are deleted and no
   emails are sent. Repeating apply skips already-corrected records.
3. `--verify /absolute/recovery-directory`: reads every repaired record and image,
   checks published images, and verifies unrelated database fields are unchanged.

Environment: public `REPORT_DATABASE_URL` (or reachable `DATABASE_URL`), app R2
credentials, `LOCAL_FALCON_API_KEY`. Prepare additionally requires an installed
Playwright entry point in `REPORT_RENDERER_MODULE` and Chrome (override using
`REPORT_CHROME_PATH`). Do not commit credentials or recovery artifacts.

Recovery data includes `recovery.json`, each report's `original.png`,
`prepared.json`, `uploaded.json`, and `applied.json`. To roll back a report, first
verify its current snapshot hash still matches the repaired hash, then restore
its original ATRP and seven snapshot metadata fields from `recovery.json` in a
transaction. Restore affected delivery URLs from the same backup. Retained old
storage objects remain usable. Do not roll back over intervening user edits.

Already-downloaded images, attachments, and cached images inside previously sent
emails cannot be recalled. Updated CRM snapshots and public landing pages use
the corrected version; old immutable image URLs remain preserved for recovery.
