# Backlink pilot — September 17, 2026

## Scope and receipts

Pilot client: ccasecure.com (Carolina Custom Automation).

Comparison: 360technologygroup.com. Selected as a Charlotte commercial security/low-voltage business based on its own [website](https://360technologygroup.com/about-us/), not on shared backlink patterns. This is one relevant comparison, not a claim that it is CCA's strongest ranking competitor.

The local implementation ran against the authorized existing DataForSEO account and production snapshot database before git push. This verifies provider integration and storage, not deployment of the new connector version.

| Snapshot | ID | Status | Actual USD |
| --- | --- | --- | ---: |
| CCA report | 9db9c4b3-4cde-43b8-bd28-9c3533bb86bb | complete | 0.171636 |
| CCA competitor comparison | 6d73a53f-e625-4034-9d8b-056bd3755502 | complete | 0.072792 |
| Repeated CCA report | Same report ID | cached | 0 |

Total: $0.244428. The saved report was read back successfully. Columns, unique cache-key index, and domain/date index were verified with read-only database queries after the schema push.

## Baseline

| Metric | CCA | 360 Technology Group |
| --- | ---: | ---: |
| Backlinks | 502 | 67,108 |
| Referring domains, including subdomains | 45 | 79 |
| Referring root domains | 43 | 76 |
| DataForSEO Rank, 0–1,000 | 170 | 415 |
| DataForSEO backlink Spam Score | 39 | 27 |

CCA: 495 dofollow backlinks from 38 referring domains; 7 nofollow backlinks. The daily history for August 19–September 17 returned 10 new backlinks and zero lost. These are provider observations, not Google penalty/ranking determinations or a comprehensive web census.

## Manual opportunity review

The comparison returned 20 candidate referring domains. None was approved for outreach automatically.

- **gamersnewz.com:** DataForSEO reports 48,256 backlinks to the competitor. Its [homepage](https://gamersnewz.com/) is gaming news and visibly credits/links 360 Technology Group in the copyright footer. Exclude from the immediate CCA outreach shortlist: the visible placement is a site credit, not an obvious local-security editorial opportunity. This does not establish a Google policy violation.
- **toynewz.com:** 14,908 backlinks. Its [homepage](https://toynewz.com/) concerns toys and collectibles. Low apparent topical relevance for CCA; no justified outreach opportunity identified in this review. Together these first two domains account for approximately 94% of the competitor's reported backlinks, illustrating why raw link totals are a poor acquisition target.
- **360mobilevision.com:** 25 backlinks. Its [website](https://360mobilevision.com/) offers substantially overlapping commercial security services and lists the same Charlotte street address as 360 Technology Group. Possible affiliation deserves verification; do not assume this is an independent publisher accepting CCA placements.
- **dlmpropertygroup.com:** One reported nofollow link. Its [website](https://dlmpropertygroup.com/) describes property management, potentially a relevant business relationship category, but the competitor link was not located on the inspected homepage. Hold for exact source-page and geographic verification; no outreach recommendation yet.
- **tekroute.com:** 211 reported links; the homepage lookup timed out. Unverified. No recommendation based on score/count alone.

The remaining candidates have not received individual source-page review. All persisted candidates retain `unreviewed` status; this document records a preliminary manual triage, not automatic qualification.

CCA's own exact-match CCTV anchor concentration and repeated article titles remain review items from the earlier trial. Do not infer who arranged those placements or recommend disavowal solely from these metrics.

## Next pilot inputs

Two additional client domains were requested from the user and are pending. Queried CRM company records were marked `prospect` or had no client status; none was used as an assumed active client. Once supplied, run a baseline report and choose competitors for each client's actual service area, then repeat manual opportunity review.

No outreach, purchases, website changes, recurring scans, or disavowals were performed.
