**Design QA**

- Source visual truth: `/Users/matt/.codex/generated_images/019f43aa-5f88-7fa3-b0af-6deb7b94bcc7/ig_0b9e5cdae61b2924016a514aff8454819680361cf2d85418dc.png`
- Secondary icon direction: `/Users/matt/.codex/generated_images/019f43aa-5f88-7fa3-b0af-6deb7b94bcc7/ig_0b9e5cdae61b2924016a514b77028081969c937425cf7410e2.png`
- Implementation URL: `http://127.0.0.1:4174/`
- Desktop viewport: 1440 x 900
- Mobile regression viewport: 390 x 844
- State: homepage, default state; mobile menu and first FAQ also tested open

**Evidence**

- Final desktop hero: `docs/design-qa/desktop-hero-pass-02.png`
- Desktop problem section: `docs/design-qa/desktop-problem-pass-01.png`
- Desktop process section: `docs/design-qa/desktop-process-pass-01.png`
- Mobile regression: `docs/design-qa/mobile-regression-20260713.png`
- Hero comparison: `docs/design-qa/hero-comparison-final.png`
- Problem comparison: `docs/design-qa/problem-comparison-final.png`
- Process comparison: `docs/design-qa/process-comparison-final.png`

**Findings**

- No actionable P0/P1/P2 mismatch remains within the approved desktop-only scope.
- Fonts and typography: hierarchy, weight, wrapping, line height, and uppercase treatments match the selected direction. Existing approved copy remains unchanged.
- Spacing and layout rhythm: the desktop header, hero, angled transition, problem split, card rhythm, and four-step grid align with the reference structure. Mobile remains unchanged.
- Colors and visual tokens: desktop navy, sampled deep blue `#006296`, and cyan `#00a9df` now map to the reference. Mobile retains its existing colors.
- Image quality and asset fidelity: the desktop hero uses a dedicated 1536 x 1024 WebP with the visible scan beam. The angled divider is sourced from the selected visual. The three Before/After map assets were not modified.
- Icons: problem cards now use distinct library icons in navy circles. Step three uses the requested monitor/analytics icon rather than the wrench. No placeholder or text-glyph icons remain in these desktop surfaces.
- Copy and content: all existing homepage copy is preserved. Reference-only CTA/copy variants were intentionally not introduced because they were outside the requested correction list.

**Interaction And Regression Checks**

- Mobile menu opens and exposes its navigation panel.
- FAQ accordion opens and reveals its answer.
- Primary CTA links remain present and point to `/scan.html`.
- Browser console errors: none.
- Mobile hero, map crop, legend, H1 block, CTA, and problem X markers remain on their pre-change behavior.

**Comparison History**

- Pass 01 findings: desktop header used the wordmark-only asset; hero lacked the vertical beam and angled divider; problem cards used repeated X icons; desktop accent colors drifted; step three used a wrench.
- Fixes: added a cache-busted desktop logo lockup, a dedicated scan-beam hero asset, the reference-derived angled divider, sampled desktop accent tokens, four distinct problem icons, and a monitor/analytics icon for step three.
- Pass 02 evidence: `desktop-hero-pass-02.png`, `desktop-problem-pass-01.png`, `desktop-process-pass-01.png`, and the three final comparison composites listed above.

**Follow-up Polish**

- P3: The implementation keeps the site's existing hero and section copy instead of adopting every alternate line shown in the concept image. This is intentional and does not block the requested visual correction.

final result: passed
