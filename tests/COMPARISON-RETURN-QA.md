# Comparison continuity QA — September 12, 2026

## Scope

Applied requirements, both selected providers, and browse/side-by-side mode are preserved in a bounded comparison URL fragment. Matching provider reviews have a validated local “Back to your comparison” link. This change does not capture evidence, connect a wallet, submit an assessment, contact a provider, or change saved reviews and receipts.

## Automated checks

- `node --test tests/test_*.mjs`: 173 passed, including eight new comparison-context tests.
- `../.venv/bin/pytest -q tests/test_review_routes.py tests/test_server.py`: 31 passed.
- New context tests cover distinct pairs, decimal requirements, explicit false flags, browse mode, legacy links, single-plan catalogs, malformed/duplicate/oversized parameters, opaque review IDs, exact requirement matching, unknown catalog plans, and external return targets.

## Isolated local browser checks

Chrome on localhost:4200, separate QA contexts; no real wallet or new provider capture/assessment.

- `comparison-return-browser.js`: selected Soniox and AssemblyAI with 237 hours, $151.23, training restriction off and speaker labels on. An unapplied 999-hour edit was not saved. A real reload restored all applied requirements and both selections.
- Opening an unsubmitted AssemblyAI review, reloading it, using browser Back/Forward, and clicking the explicit return link all preserved the exact comparison.
- Browse mode and requirements survived a real reload. An external `back` URL was ignored, with the default local comparison link retained.
- Mobile 390×844: reload restoration passed with no horizontal overflow; visually inspected the aligned two-provider comparison and selectors.
- Existing side-by-side regression: 22 checks passed, including zero API calls and unchanged storage.
- Existing comparison regression: 13 groups passed.
- Existing review-decision regression: 23 checks and 15 handoff checks passed.
- Existing saved-review regression: 17 checks passed with zero API calls.
- A synthetic saved assessment was opened from a Speechmatics/AssemblyAI comparison and reloaded. Its return link restored the same pair; all local-storage bytes, including assessment and receipt fixtures, remained unchanged throughout.

## Boundaries

Navigation fragments contain plan IDs and the displayed non-confidential requirements, not evidence or wallet identity. They are not signed assessments or private links. No additional product storage keys were introduced. Unsubmitted form edits are deliberately discarded on reload. An invalid, nonmatching, or obsolete return context falls back to the ordinary Compare services page.

Production deployment and real public-receipt checks are recorded separately after publication; this document does not claim those checks have already completed.
