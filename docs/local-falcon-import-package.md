# Local Falcon prospect package

The canonical handoff is JSON. For a complete CRM import, `batch.json` and its original Local Falcon heatmaps travel together inside one ZIP file.

```text
monroe-nc-plumbing-20260722.zip
├── batch.json
└── heatmaps/
    └── ChIJBVJ_i_OJgWkRT9fe4f3IpK0.png
```

The CRM also accepts `batch.json` directly when the referenced heatmap files are added separately in the import screen.

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
      "heatmap_file": "heatmaps/ChIJBVJ_i_OJgWkRT9fe4f3IpK0.png",
      "qualification_status": "qualified"
    }
  ]
}
```

## Contract rules

- Only `qualification_status: "qualified"` may enter the CRM.
- `scan_keyword` must match the batch keyword.
- Every Place ID and every `heatmap_file` reference must be unique inside the manifest.
- Every referenced heatmap must exist, and every heatmap in the package must be referenced exactly once.
- Heatmaps must be original PNG, JPG, or WebP files. The importer never crops, resizes, or reconstructs the stored evidence asset.
- `website_url` is required when `has_website` is true and must be `null` when false.
- Phone and owner may be `null` when unavailable.
- Setter assignment is CRM operational data and is selected during confirmation; it does not belong in the manifest.

## CRM workflow

1. Drag the ZIP into **CRM → Leads → Import → Local Falcon**.
2. Review duplicate checks and the exact final report framing for every included prospect.
3. Explicitly approve any flagged possible duplicate.
4. Confirm the company/image pairing and full-grid visibility.
5. Select the appointment setter.
6. Confirm the import.

The CRM stores the original heatmap in R2, creates the assigned lead and opportunity in **New Lead**, and creates the assigned **Contact lead** task. Sales reps can then load their assigned evidence directly in the Local Visibility Snapshot generator without OCR or re-entry.
