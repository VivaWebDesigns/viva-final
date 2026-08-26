**Design QA**

- Source visual truth: `/Users/matt/.codex/generated_images/019f43aa-5f88-7fa3-b0af-6deb7b94bcc7/ig_0b9e5cdae61b2924016a514aff8454819680361cf2d85418dc.png`
- Secondary icon direction: `/Users/matt/.codex/generated_images/019f43aa-5f88-7fa3-b0af-6deb7b94bcc7/ig_0b9e5cdae61b2924016a514b77028081969c937425cf7410e2.png`
- Implementation URL: `http://127.0.0.1:4174/`
- Desktop viewport: 1440 x 900
- Mobile viewport: 390 x 844
- State: homepage, default state; mobile menu and first FAQ also tested open

**Evidence**

- Final desktop hero: `docs/design-qa/desktop-hero-pass-02.png`
- Desktop problem section: `docs/design-qa/desktop-problem-pass-01.png`
- Desktop process section: `docs/design-qa/desktop-process-pass-01.png`
- Mobile hero fidelity: `docs/design-qa/mobile-hero-fidelity-20260713.png`
- Mobile problem fidelity: `docs/design-qa/mobile-problem-fidelity-20260713.png`
- Mobile process fidelity: `docs/design-qa/mobile-process-fidelity-20260713.png`
- Hero comparison: `docs/design-qa/hero-comparison-final.png`
- Problem comparison: `docs/design-qa/problem-comparison-final.png`
- Process comparison: `docs/design-qa/process-comparison-final.png`

**Findings**

- No actionable P0/P1/P2 mismatch remains within the approved desktop and mobile scope.
- Fonts and typography: hierarchy, weight, wrapping, line height, and uppercase treatments match the selected direction. Existing approved copy remains unchanged.
- Spacing and layout rhythm: the desktop split/grid treatments and the mobile stacked treatments align with the same reference structure. The angled hero transition now works at both breakpoints.
- Colors and visual tokens: desktop and mobile now share deep blue `#006296` and cyan `#00a9df` for the updated surfaces.
- Image quality and asset fidelity: the desktop hero keeps its dedicated scan-beam WebP. Mobile keeps its original national map and crop by explicit request. The header and footer logos and the three Before/After map assets were not modified.
- Icons: problem cards use distinct library icons in navy circles at both breakpoints. Step three uses the requested monitor/analytics icon rather than the wrench. No placeholder or text-glyph icons remain in these surfaces.
- Copy and content: all existing homepage copy is preserved. Reference-only CTA/copy variants were intentionally not introduced because they were outside the requested correction list.

**Interaction And Regression Checks**

- Mobile menu opens and exposes its navigation panel.
- FAQ accordion opens and reveals its answer.
- Primary CTA links remain present and point to `/scan`.
- Browser console errors: none.
- Mobile hero image, map crop, legend, H1/subhead placement, and logo remain unchanged. The divider, accent colors, problem icons, section labels, and process icons now match the desktop treatment.

**Comparison History**

- Pass 01 findings: desktop header used the wordmark-only asset; hero lacked the vertical beam and angled divider; problem cards used repeated X icons; desktop accent colors drifted; step three used a wrench.
- Fixes: added a cache-busted desktop logo lockup, a dedicated scan-beam hero asset, the reference-derived angled divider, sampled desktop accent tokens, four distinct problem icons, and a monitor/analytics icon for step three.
- Pass 02 evidence: `desktop-hero-pass-02.png`, `desktop-problem-pass-01.png`, `desktop-process-pass-01.png`, and the three final comparison composites listed above.
- Pass 03 findings: mobile still used the pre-design X markers, hidden section labels, old accent colors, and number-only process steps; the hero also ended without the angled transition.
- Pass 03 fixes: extended the divider, shared accent tokens, distinct problem icons, cyan kickers, and process icon treatment to mobile while preserving the original mobile hero map and all logo assets.
- Pass 03 evidence: `mobile-hero-fidelity-20260713.png`, `mobile-problem-fidelity-20260713.png`, and `mobile-process-fidelity-20260713.png`.

**Follow-up Polish**

- P3: The implementation keeps the site's existing hero and section copy instead of adopting every alternate line shown in the concept image. This is intentional and does not block the requested visual correction.

final result: passed

---

## Local Visibility Snapshot — Mobile-First 9:16 Revision — 2026-07-21

**Visual truth and test state**

- Mobile problem reference: `/Users/matt/Pictures/Photos Library.photoslibrary/resources/derivatives/masters/A/A1849A1C-428A-48B2-9C5B-A53C092834D2_4_5005_c.jpeg`
- Supporting full report reference: `/Users/matt/Downloads/carolina-custom-automation-local-visibility-snapshot.png`
- Browser-rendered implementation export: `docs/design-qa/local-visibility-sms-9x16-export-pass-02.png`
- Export viewport: 1080 × 1920 (9:16)
- Mobile comparison viewport: 360 × 778, with the 9:16 export fit to phone width
- State: Carolina Custom Automation, “control access near me,” Fort Mill, SC, average position 2.5, full 7 × 7 heatmap

**Evidence**

- First implementation export: `docs/design-qa/local-visibility-sms-9x16-export-pass-01.png`
- Final implementation export: `docs/design-qa/local-visibility-sms-9x16-export-pass-02.png`
- Original-versus-final mobile comparison: `docs/design-qa/local-visibility-sms-mobile-comparison-pass-02.jpg`
- Full-view comparison evidence: the combined mobile comparison places the supplied phone screenshot and final report at the same 360 × 778 viewing size.
- Focused-region evidence: the full-resolution final export was opened separately to inspect map crop, all 49 markers, landmark legibility, supporting copy, settings, and footer.

**Findings**

- No actionable P0/P1/P2 issue remains in the requested mobile-report scope.
- Fonts and typography: the existing Plus Jakarta Sans hierarchy is preserved. Supporting explanation, settings, and footer text were increased in pass 02 for better phone readability without competing with the map.
- Spacing and layout rhythm: the canvas is now 1080 × 1920. The map occupies 960px of height and roughly half the report, while the header, cards, metric, explanation, settings, and footer retain the established spacing system.
- Colors and visual tokens: the existing Viva navy, blue, muted text, borders, and semantic map colors remain unchanged.
- Image quality and asset fidelity: the uploaded map now uses centered `cover` placement. It fills the frame edge-to-edge, crops only a small amount from the top and bottom, keeps the complete 7 × 7 grid visible, and preserves landmarks including Tega Cay, Baxter Village, Riverview, Fort Mill, I-77, and Gold Hill Road.
- Copy and content: the search, market, business, average position, center-dot explanation, scan settings, prepared-by credit, and URL remain present. Retired metrics and square-mile coverage remain absent.

**Interaction and regression checks**

- A real Local Falcon map image was loaded through the browser file input and rendered in the actual React report component.
- Browser-side PNG export completed at exactly 1080 × 1920.
- Browser console errors: none.
- Focused component and smoke tests cover the 1920px export contract, centered cover crop, form behavior, smart paste, and file-selection behavior.

**Comparison history**

- Original finding: the 4:5 report contained the square map inside a wide frame, leaving large side gutters and shrinking the ranking markers on phones.
- Pass 01 fixes: changed the report to 9:16, expanded the map to 960px, switched the map from `contain` to centered `cover`, and enlarged the principal report typography and cards.
- Pass 01 finding: the map passed, but the explanatory copy, settings, and footer could use the remaining vertical room more effectively on a phone.
- Pass 02 fixes: increased the explanatory and settings text, enlarged the footer treatment, and rebalanced the body/footer heights without reducing the map.
- Pass 02 evidence: the final export and combined mobile comparison listed above show an edge-to-edge map, materially larger markers, reduced phone letterboxing, complete supporting content, and no clipping.

**Follow-up polish**

- P3: Different Local Falcon screenshots may place the ranking grid a few pixels above or below center. The current centered crop is the safest general default and keeps the full grid visible in the supplied scans.

final result: passed

---

## Local Visibility Snapshot Generator — 2026-07-21

Status: historical 4:5 baseline, superseded by the mobile-first 9:16 revision documented above.

**Visual truth and test state**

- Approved reference: `/Users/matt/Downloads/a_clean_business_infographic_dashboard_style_scr_1.png`
- Implementation route: `/admin/tools/local-visibility-report`
- Local QA harness: `http://127.0.0.1:4178/local-visibility-qa.html`
- Export canvas: 1080 × 1350
- Fixture: Queen City Electric, “electrician near me,” Charlotte, NC, with a full Local Falcon scan

**Evidence**

- Rendered implementation: `docs/design-qa/local-visibility-snapshot-implementation-20260721.jpg`
- Side-by-side reference comparison: `docs/design-qa/local-visibility-snapshot-comparison-20260721.jpg`

**Findings and fixes**

- Composition matches the approved reference hierarchy: branded header, paired search/market cards, business summary, dominant bordered map, metric treatment, explanation/settings, and navy footer.
- The SMS-specific content contract is implemented: ATRP and SoLV are absent; one wide “Average Google Maps Position” metric remains; defaults are 7 × 7 and 2.5-mile radius; square-mile coverage is absent; the center-dot explanation is present.
- The full uploaded scan is preserved with `object-fit: contain`. QA found and fixed an initial grid-image sizing issue that clipped tall scans; the final implementation displays the entire image.
- Typography, navy/blue palette, uppercase labels, card borders, radii, spacing, and logo treatment closely track the approved design while using the existing Viva brand assets and icon libraries.
- The generator form, required-field validation, live preview, ready state, reset, responsive admin layout, and client-side export path were exercised. Type-checking, focused component/smoke tests, and the production build pass.
- Browser console errors: none.
- Intentional difference: the approved reference is 1080 × 1500 and includes retired metrics and square-mile coverage; the finalized SMS report is 1080 × 1350 and reallocates that space to the map and one wide metric.

final result: passed

Current approved Local Visibility Snapshot export: 1080 × 1920 with a centered, edge-to-edge map crop.

final result: passed

---

# Design QA — Local Visibility Snapshot v2

## Reference and implementation

- Approved reference: `/Users/matt/.codex/visualizations/2026/08/21/01a02598-cecd-7b02-b725-d525fb122115/viva-appended-google-maps-report-mockup-v2.png`
- Actual component render: `/Users/matt/.codex/visualizations/2026/08/21/01a02598-cecd-7b02-b725-d525fb122115/local-visibility-v2-implementation-static.html`
- Actual component segment captures:
  - `/Users/matt/.codex/visualizations/2026/08/21/01a02598-cecd-7b02-b725-d525fb122115/quicklook-static/local-visibility-v2-implementation-static.html.png`
  - `/Users/matt/.codex/visualizations/2026/08/21/01a02598-cecd-7b02-b725-d525fb122115/quicklook-static/local-visibility-v2-middle.html.png`
  - `/Users/matt/.codex/visualizations/2026/08/21/01a02598-cecd-7b02-b725-d525fb122115/quicklook-static/local-visibility-v2-bottom.html.png`

The implementation captures were rendered from the real React component and production CSS. Three vertical segments were used because the report is 1080 × 2880 and the local Quick Look renderer captures a square viewport.

## Comparison results

- Canvas is the approved 1080 × 2880 email-first size; legacy reports without comparison data remain 1080 × 1920.
- Existing Viva header, colors, typography hierarchy, heatmap image, grid values, and map framing are preserved.
- Header, summary cards, business card, heatmap, explanation, settings, comparison panel, and footer are all enlarged for email readability.
- Average Google Maps Position remains `20+`; the area-scan rank appears only in the neutral comparison callout.
- Comparison includes only the immediately higher business, the prospect, and the immediately lower business.
- Company rows contain no category/address subtext. Long names fit at the approved width after the final typography adjustment.
- Prospect point totals are neutral navy/gray, not red.
- Header reads `Visibility across the 3-mile radius` for the QA fixture and is driven by the report's actual radius.
- The scan image remains square at 1000 × 1000 inside the 1080-pixel canvas.
- Footer remains fully contained inside the 2880-pixel export.

## Functional verification

- TypeScript check: passed.
- Focused unit/smoke tests: 43 passed.
- Production build: passed.
- Export height and comparison copy are covered by component tests.

## Final result

`passed`

---

# Design QA — Local Visibility Comparison Option 3 — 2026-08-26

## Reference and implementation

- Selected reference: `/Users/matt/.codex/generated_images/01a03e0c-7b48-70a3-bf88-de406f53f256/exec-91bea158-b78e-4b7c-bda4-e1e2ea503189.png`
- Browser-rendered implementation: `/Users/matt/.codex/visualizations/2026/08/26/01a03e0c-7b48-70a3-bf88-de406f53f256/implementation.png`
- Side-by-side comparison: `/Users/matt/.codex/visualizations/2026/08/26/01a03e0c-7b48-70a3-bf88-de406f53f256/comparison.png`
- QA fixture: Atlantic Tree Services, LLC; rank 64 of 69; 7 × 7 grid; 3-mile radius.

## Comparison results

- The heavy rounded comparison card has been replaced with the selected open, three-column layout.
- The scan-settings divider is below `7 × 7 grid · 3-mile radius`, with no divider between the explanatory rows and scan settings.
- Headline, subtitle, and bottom takeaway match the approved copy exactly and remain driven by live comparison data.
- The immediately higher business, subject business, and immediately lower business are displayed left-to-right with ranks, reviews, scan-point totals, and visibility percentages.
- Subject emphasis uses the existing Viva blue for the badge, rank, and metric rule; neighboring businesses remain neutral.
- The comparison flows directly into the existing navy Viva footer without an enclosing border, radius, shadow, or dark callout block.
- The 1080 × 2880 email export contract and legacy 1080 × 1920 report contract remain unchanged.

## Functional verification

- Focused component tests: passed (5 tests).
- TypeScript check: passed.
- Browser DOM verification: all approved copy and all three dynamic business columns are present.
- Browser-rendered full report: no clipping or overflow; footer remains inside the export canvas.
- Browser console errors: none observed.

final result: passed
