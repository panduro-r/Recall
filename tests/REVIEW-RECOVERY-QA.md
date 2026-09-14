# Review page update and recovery — September 14, 2026

## Observed failure

The successful v4 AssemblyAI receipt was rejected by the previous v3 frontend and accepted by the currently deployed frontend. This reproduced an older open tab reading a newer format. The browser's own saved record was not inspected, so stale code remains the likely explanation for the user's screenshot, not proof about their local storage.

A second problem was confirmed in code: after a transaction receipt became complete, a failed result inspection removed the pending-state recovery controls and could expose a new-review action. Receipt completion and accepted assessment are separate states.

## Fix

- New and refreshed preparation require the current known review format. Newer formats offer an explicit Reload Recall action before preparation proceeds. Unknown or malformed configuration cannot prepare a transaction.
- Unknown result versions are distinguished from genuine verification failures only after exact receipt, evidence, source and account identity checks pass. Unknown formats are never accepted as assessments.
- Pending, finalized-but-retrieving, retrieval interrupted, page update needed, and verification failed have different labels and recovery actions. Unsupported provider findings remain separate.
- A finalized transaction without an accepted saved assessment stays unresolved. Another submission is blocked while its result needs recovery, including across tabs at preparation time. Original journal phases are retained.
- Reload is user-triggered, preserves the URL and local records, and is disabled while a wallet operation is busy. No automatic reload or transaction retry was introduced.
- Retrieval errors keep read-only polling with the existing backoff. Version and verification issues stop automatic inspection until reload or an explicit recheck. Evidence export and wallet connection/disconnection remain available.
- No contract, backend policy, provider source, price, storage schema or visual design changes.

## Verification

- 194 Node tests passed, including five new model regressions for version configuration, identity-first update detection, malformed known results, unresolved completed records, and recovery-state wording.
- 121 Python tests passed for contract logic, evidence, routes and server compatibility.
- 61 isolated browser assertions passed across newer-result format, genuine mismatch, temporary retrieval failure, newer server configuration, a version change between configuration reads, and ordinary supported preparation.
- A real click of Reload Recall preserved the synthetic evidence, finalized journal and URL. A subsequent read-only inspection recovered the same transaction and all five findings without changing the journal.
- All browser receipts, configurations and model results were synthetic. The local QA server disabled every API route, including after reload, so lost browser mocks could not contact Studio. Mock preparation and account reads were used only to exercise the normal UI; no real wallet or live review was submitted.
- Desktop and 390px layouts were inspected. No horizontal overflow; persistent wallet control, explicit recovery action, readable result state, existing keyboard focus styles and polite status announcements retained.
- Vercel CLI 59.11.7 detected the Python API and static assets in the exact allowlisted artifact.

## Limits

Already-open tabs running code from before this fix need one refresh to load it. Configuration checks cover review-format compatibility, not every possible frontend release. Version detection does not waive evidence validation or repair an actually mismatched local record. No real provider-account opt-out or service behavior has been verified.
