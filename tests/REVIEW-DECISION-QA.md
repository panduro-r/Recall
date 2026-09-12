# Review-to-decision handoff

Checked September 12, 2026.

## Scope

A completed, fresh, supported and fully priced review now offers an external provider visit, a browser-local saved option, and a comparison carrying the exact reviewed requirements. Recapturing evidence remains a secondary action. Uncertain or conflicting findings lead with comparison; old evidence or changed source coverage lead with a separate capture. Technical failures retain their recovery/export presentation and can also lead to comparison.

Provider URLs come from the validated current catalog, not the historical snapshot. A changed catalog configuration does not inherit a recommendation from old evidence. Saving records a plan and requirements, not an order, a price guarantee or an assessment of alternatives. Provider signup, settings and purchases remain outside Recall.

## Verification

- 154 Node tests passed, including strict comparison-link parsing, false flags and decimal budgets, safe/idempotent shortlist updates, and completed/uncertain/refuted/stale/incomplete next-step selection.
- 31 targeted Python route/server tests passed.
- `review-decision-browser.js`: 22 review-side and 9 comparison-side assertions passed in a fresh isolated localhost context. Non-default 237 hours, $151.23 and both selected conditions survived navigation; explicit false flags also survived later fragment navigation.
- Browser checks covered fresh save, visible saved state, explicit requirement replacement, corrupt storage, a missed cross-tab event, unrelated shortlist entries, keyboard focus, and byte-for-byte review/transaction preservation. No API or wallet calls occurred in the decision fixture.
- Existing comparison regression passed all 13 check groups, including clipboard denial, source failure, estimate caveats and unrelated-storage preservation.
- Existing review diagnostics passed 30 checks with zero API calls. Failed, partial, ambiguous, incomplete and legacy records remain distinct.
- Existing source-history regression passed 18 checks. Old evidence and receipts stay intact, new sources require a separate capture, and there was only one mocked capture operation, with no real wallet calls.
- Desktop (1280px) and mobile (390px) visually inspected. No horizontal overflow; the comparison retained its wallet/header controls. No warning/error console messages on the handoff comparison page.
- Vercel CLI 59.11.7 detected the Python entrypoint and static assets in the exact build artifact without errors.

All browser assessment receipts in these local checks were clearly synthetic fixtures. They are not new provider findings or live network validations. No contract changes or wallet transactions were made for this UI handoff.
