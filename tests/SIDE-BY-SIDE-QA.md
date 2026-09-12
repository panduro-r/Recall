# Side-by-side alternatives comparison

Checked September 12, 2026.

## Behavior

“Compare options” now opens and focuses a distinct two-plan comparison instead of silently redrawing the same cards. Each column has a plan selector. Costs, budget and condition caveats, model-training policy, speaker-label pricing, dated saved assessments and catalog review dates align by row. The original card list remains available through “Browse all plans.”

“Compare alternatives” from a provider review carries the original plan and all four exact requirements. Existing requirement-only links remain supported. The same action is available inside Saved options; it preserves the saved requirements, identifies the source as a shortlist (not an assessment), closes the dialog and reveals the comparison even when its URL is already current.

Repeated submissions with unchanged requirements say so. Edited but unapplied requirements are distinguished from the displayed comparison. Unknown or malformed handoffs fail visibly and can be recovered by explicitly comparing the form values. Neither source selection nor the two-plan display implies a recommendation or a new assessment.

## Boundaries

The existing catalog calculations and validated local-review index are reused. Approximate, from-rate, opt-out and unknown-addon prices remain conditional. Original dated reviews, evidence and receipts are not rewritten. Comparing does not fetch provider sources, submit a GenLayer assessment, sign, pay, or change wallet state. Only the separate explicit Save option control writes to the shortlist.

## Verification

- 165 Node tests passed; new tests cover source-plan handoff, legacy links, strict parameter validation, exact requirements and distinct bounded plan selection.
- 31 targeted Python route/server tests passed.
- New isolated browser fixture: 22 checks passed on desktop and mobile, including visible view changes, focus/scroll, unchanged input feedback, alternate selection, price caveats, applied requirements, unknown-plan recovery, no horizontal overflow, unchanged storage and zero API calls.
- Updated provider-review decision fixture: 23 checks passed; 15 handoff checks passed, including the review-to-comparison link, matching saved review, shortlist-to-comparison link and repeated same-link navigation. Synthetic local receipts only.
- Existing comparison regression: all 13 groups passed, including saving, unavailable storage, source-check failures, clipboard fallback and modal focus.
- Desktop 1280px and mobile 390px visually inspected. Mobile comparison uses two aligned value columns with full-width row labels; full plan names remain visible below the selectors. Price explanations are expandable; uncertainty labels remain visible.
- Vercel CLI 59.11.7 analyzer accepted the exact 74-file runtime artifact.

Production publication and exact-asset verification are recorded separately after deployment. No live provider finding or new transaction was generated during these checks.
