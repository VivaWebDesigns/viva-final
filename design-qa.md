# Desktop Homepage Design QA

- Source visual truth: `/Users/matt/.codex/generated_images/019f43aa-5f88-7fa3-b0af-6deb7b94bcc7/ig_0b9e5cdae61b2924016a514aff8454819680361cf2d85418dc.png`
- Implementation: `http://127.0.0.1:4173/index.html`
- Implementation evidence: `docs/design-qa/2026-07-13-home-desktop-comparison.jpg`
- Focused process evidence: `docs/design-qa/2026-07-13-process-icons-comparison.jpg`
- Mobile regression evidence: `docs/design-qa/2026-07-13-mobile-regression.jpg`
- Viewport: 1440 x 900 desktop; 390 x 844 mobile regression check
- State: homepage loaded, reveal animations completed, first FAQ expanded during interaction testing

**Full-View Comparison**

The desktop implementation follows option 1's cinematic blue-map hero, split problem composition, dark proof band, restrained white process section, and stronger depth hierarchy. The current site copy, header logo, straight section boundaries, and positioning statement were intentionally retained. The three Before vs After source image paths and image files were not changed.

**Focused Region Comparison**

The How It Works comparison confirms the selected option 3 treatment: four airy peer steps, pale step numbers, blue outlined icons in circular wells, and subtle connecting rules. The implementation uses Lucide-derived line icons and preserves the existing step copy.

**Findings**

- No actionable P0, P1, or P2 visual mismatches remain within the desktop-only scope.
- Fonts and typography: existing Inter stack retained; hierarchy, line lengths, wrapping, and optical weights are consistent with the target direction.
- Spacing and layout rhythm: hero, split problem section, proof cards, and process columns align cleanly at desktop width with no overlap or horizontal overflow.
- Colors and visual tokens: existing Viva navy, `#0f659e`, and cyan map palette are preserved and mapped consistently across depth, borders, icons, and interactive states.
- Image quality and asset fidelity: the existing national hero image remains sharp; all three proof-map assets retain their original paths and presentation.
- Copy and content: no requested homepage copy was removed or rewritten.

**Interaction And Browser Checks**

- Primary navigation and scan CTAs expose the expected destinations.
- FAQ accordion opens and reveals its answer correctly.
- Desktop reveal animations run once as sections enter the viewport.
- Mobile-only checks confirm the new trust row, section kickers, and process icons remain hidden below the desktop breakpoint.
- Browser console: no errors or warnings.

**Comparison History**

- Pass 1: compared the selected option 1 source against desktop hero, problem, proof, and process captures. No P0/P1/P2 issues found. The option 3 icon treatment was confirmed in a focused process comparison.

**Follow-Up Polish**

- P3: a later pass could explore the reference's angled section transitions, but they are intentionally excluded from this first desktop-only implementation.

final result: passed
