# Local Falcon prospect import

The canonical handoff is a single JSON manifest. The CRM derives the official
Local Falcon image URL from each prospect's `report_key`, retrieves the original
image server-side, validates it, shows the exact report framing for approval,
and stores the confirmed bytes in R2.

No heatmap screenshot or ZIP is required during the normal import flow.

## Canonical manifest

```json
{
  "batch": {
    "batch_id": "MONROE-NC-PLUMBING-20260722-01",
    "market": {
      "city": "Monroe",
      "state": "NC"
    },
    "trade": "plumbing",
    "keyword": "plumber near me",
    "export_date": "2026-07-22",
    "scan_spec": {
      "grid_size": "7x7",
      "radius_miles": 2.5
    }
  },
  "prospects": [
    {
      "place_id": "ChIJBVJ_i_OJgWkRT9fe4f3IpK0",
      "company_name": "Example Plumbing",
      "address": "2614 W Roosevelt Blvd",
      "city": "Monroe",
      "state": "NC",
      "zip": "28110",
      "phone": "+19805550123",
      "owner_name": null,
      "google_maps_url": "https://www.google.com/maps/place/?q=place_id:ChIJBVJ_i_OJgWkRT9fe4f3IpK0",
      "has_website": false,
      "website_url": null,
      "service_page_count": 0,
      "report_key": "d7a24d34777a24d",
      "report_url": "https://www.localfalcon.com/reports/view/d7a24d34777a24d",
      "scan_date": "2026-07-14",
      "scan_keyword": "plumber near me",
      "arp": 4.87,
      "rating": 4.7,
      "review_count": 13,
      "qualification_status": "qualified"
    }
  ]
}
```

## Contract rules

- Only `qualification_status: "qualified"` may enter the CRM.
- `scan_keyword` must match the batch keyword.
- Every Place ID must be unique inside the manifest.
- `report_key` must be the hexadecimal Local Falcon report key. It is the only
  input used to derive the official image URL.
- The importer accepts only a successful PNG, JPG, or WebP response from the
  fixed Local Falcon image host. Redirects, oversized files, invalid images, and
  incomplete map dimensions are rejected.
- The original retrieved bytes are checksummed and stored unchanged. The report
  generator owns presentation framing; the importer never crops, resizes, or
  reconstructs the stored evidence asset.
- `website_url` is required when `has_website` is true and must be `null` when false.
- Phone and owner may be `null` when unavailable.
- Setter assignment is CRM operational data and is selected during confirmation; it does not belong in the manifest.

## CRM workflow

1. Open **CRM → Leads → Import → Local Falcon**.
2. Click the import box and paste the JSON with **Ctrl+V** or **⌘V**. Dropping or
   choosing the JSON file also works.
3. Click **Review import**. The CRM retrieves the official maps automatically.
4. Review duplicate checks and the exact final report framing for every included prospect.
5. Explicitly approve any flagged possible duplicate.
6. Confirm the company/image pairing and full-grid visibility.
7. Select the appointment setter.
8. Confirm the import.

The CRM stores the original heatmap in R2, creates the assigned lead and opportunity in **New Lead**, and creates the assigned **Contact lead** task. Sales reps can then load their assigned evidence directly in the Local Visibility Snapshot generator without OCR or re-entry.

## Image fallback

If Local Falcon cannot supply an official map, the import stays on the same
screen and identifies the affected prospect. Only then does the CRM show a
fallback image uploader. Name each original PNG, JPG, or WebP with the
prospect's Place ID and review the import again.

Example:

```text
ChIJBVJ_i_OJgWkRT9fe4f3IpK0.png
```

The fallback is not displayed during a healthy JSON import.

## ZIP fallback

ZIP remains supported for an outage or a fully self-contained archive. In that
mode, every prospect must include `heatmap_file`, and matching is validated in
both directions.

```text
monroe-nc-plumbing-20260722.zip
├── batch.json
└── heatmaps/
    └── ChIJBVJ_i_OJgWkRT9fe4f3IpK0.png
```

```json
{
  "place_id": "ChIJBVJ_i_OJgWkRT9fe4f3IpK0",
  "heatmap_file": "heatmaps/ChIJBVJ_i_OJgWkRT9fe4f3IpK0.png"
}
```

Every referenced file must exist, no file may be unreferenced, and each path
may be used only once.
