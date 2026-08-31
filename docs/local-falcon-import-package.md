# Local Falcon prospect import

The current Scale-First handoff is exactly one `batch.json` with `workflow: "scale_first_v2"`. Export every eligible qualified lead in the run, including Workflow Sheet rows at both `complete` and `qa_ready`, across all execution batches. Never send a competitor sidecar. The current parser contract is version 2.2 and permits up to 2,000 prospects; older Audit-First payloads remain a separate compatibility path.

## Authoritative export

Use `build_sab_run_manifest` after the structured eligibility, contact, scan decision, and canonical-specification records are complete. The tool fails closed on missing or conflicting evidence and returns one manifest, its checksum, and complete/qa-ready/CRM-only counts. It does not import anything. Notes and prior-run rulings never establish eligibility or a validated center.

- Identity and deduplication use exact Google Place-ID equality. Every Place ID appears once in the manifest; every non-null canonical report key is unique. A later authorized report variation reuses the existing CRM lead.
- `address` must be exactly `Service Area Business`. Never export a hidden operating address. Owner and phone may be null when unavailable; `Email Ready` requires verified email, while `Needs Email` requires verified phone and null email.
- `scan_keyword` must match the batch keyword. Each deliverable carries its verified effective 7×7/3-mile or 7×7/5-mile specification; do not infer radius from the batch default.
- `has_website` must be known. `website_url` is required when true and null when false.
- `report_url` must be the observed, verified Local Falcon `public_url`. A public link may contain an additional identifier that cannot be derived from `report_key`; never construct a replacement public URL.
- Raw `arp` remains separate from all-point `atrp`. Prospect-facing **Average Google Maps Position** uses authoritative ATRP only. Missing ATRP is retrieved from the exact canonical report during preview and confirmation; there is no ARP fallback.

## Two permitted outcomes

A **deliverable** includes the verified canonical report key, public URL, date, raw ARP, SoLV, effective scan specification, and validated scan center. The CRM retrieves the official map from its fixed image host, validates the returned image, and displays the final report for review. The original image bytes remain unchanged; report framing is presentation only.

A **`no_visibility_core_found`** lead is CRM-only. Its structured decision must establish zero exact top-20 pins in a completed valid auxiliary. Its required `market_reference` has kind `market_reference_only`, source `auxiliary_scan_reverse_geocode`, coordinates, city/state/ZIP, and the observed auxiliary report key and public URL. These identify operational market evidence, not a validated business location or prospect-facing report. Root city/state/ZIP must match that labelled reference.

CRM-only report keys/URLs, scan date/specification, raw ARP, ATRP, SoLV, validated scan center, and heatmap path must be omitted or null. The importer stores market provenance separately, leaves CRM business location blank, generates no report or snapshot, and does not trigger automatic scan outreach—even when the contact tag is `Email Ready`.

## Review and final confirmation

1. Open **CRM → Leads → Import → Local Falcon**, then paste, select, or drop the single `batch.json`.
2. Click **Review import**. Review each exact-Place-ID duplicate result and explicitly approve any flagged possible match that should be imported.
3. For each deliverable, confirm the company/image pairing, actual scan specification, and full-grid visibility. For each CRM-only lead, confirm that the displayed location is market-reference information only and that no report is promised.
4. Select the lead type and active appointment setter, then confirm all included rows and click **Confirm import**. Reviewing or exporting a manifest alone never performs the import.
5. Check the final imported, skipped, and error counts. Reconcile any conflict before reporting the run imported.

The CRM rechecks duplicate identities and confirmed image checksums during import. It persists the original deliverable image and reviewed snapshot, or the separate CRM-only provenance record. Contact tags and assignment are retained. CRM-only leads remain available for manual follow-up; a later authorized deliverable attaches to the same lead.

## Optional image fallback

If an official deliverable map cannot be retrieved, provide an original PNG, JPG, or WebP named with the exact Place ID and review it again. The interface also allows explicit image overrides before retrieval. No image is required or accepted for a CRM-only lead.

A ZIP fallback may contain only `batch.json` and its referenced images directly inside `heatmaps/`. When a ZIP contains images, each deliverable must specify `heatmap_file`; every referenced file must exist, each path must be unique, and no unreferenced image is allowed. CRM-only rows have no image path. A JSON-only ZIP uses normal official-image retrieval. Existing package and image size limits still apply; a competitor sidecar is rejected.

This file documents the implementation contract. Deployment and live verification must be reported separately; a documentation or code change does not establish that production is running it.
