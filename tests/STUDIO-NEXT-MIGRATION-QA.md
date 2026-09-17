# Studio Next migration — September 17, 2026

## Live contract proof

The production v6 assessment logic was ported to GenVM v0.3.0 on **Studio Next, chain 61997**, not Stable Studio 61999. The runner, SDK import paths and nondeterministic-call API changed; assessment rules and immutable evidence did not.

- RPC: `https://studio-dev.genlayer.com/api` (the Studio Next alias resolves to this network).
- Contract: `0x3E1Bb1624A2c9bF8927B453843b7BEb5ccDEb79d`.
- Deployment: `0xff51f2b224ba28a960e439df01438386633c9cfc713f77162d4f7bd16c3f0b36`.
- Source SHA-256: `e47a3eed7e1235689982b4b4d0b9d2e792ce662babe36210241862a12a3b6d34`.
- Finality: FINALIZED; consensus: MAJORITY_AGREE; execution: FINISHED_WITH_RETURN.
- Saved snapshot: completed, version 6; original Fish Audio evidence digest, sender and exact constructor payload matched.
- Findings: speech API, English speech and streaming supported; training exclusion inconclusive. This is one migration regression, not a general accuracy evaluation.

See the machine-readable [migration proof](../submission/studio-next-migration-2026-09-17.json). One of three approved corrected tests was used. The earlier runtime-header failure remains preserved separately; it must not be described as a successful deployment.

## Fees and safety

This network charges protocol fees despite zero outer EVM gas price. The test deposited 0.020000000000033882 test GEN; observed wallet debit was 0.000099939750002823 test GEN. Provider/contract user value was zero. Receipt consumption fields are retained verbatim; storage must not be double-counted by assuming every field is additive.

The app explicitly shows its conservative fee deposit, not a fabricated price estimate. Each preparation is capped at 0.05 test GEN, uses the pinned fee-aware router, and has no child-payment allocations. Wallet approval refreshes the exact intent, account and network; changed fees require another review. An uncertain result is preserved, never automatically retried.

Historical receipts with no chain identifier remain on Stable Studio 61999. Next receipt verification requires an explicit 61997 identity and matching protocol deposit. Finality plus an agreed runtime error is a failure, not success. New source hashes are not silently accepted as old versions.

## Local verification

- Schema-only verification on Studio Next accepted the exact pinned source before signing.
- Native mocked-host tests used the official rc3 SDK and serializer: constructor, snapshot, independent disagreement and rejection of nonzero contract value. These tests are not WASM consensus tests. The rc2 local host's JSON response envelope needed a fixture-only compatibility adapter to match the actual rc3 SDK.
- Transport and wallet tests cover ABI field tampering, wrong chains/routers, protocol fee caps, hidden payment attempts, uncertain broadcasts, nonce drift, exact-source schema pins and historical isolation.
- Isolated localhost browser: connection requested a switch from 61999 to 61997, the approval dialog showed Studio Next and the separate fee deposit, and cancellation made **zero** transaction submissions. Browser evidence and provider were explicit fixtures.
- Vercel entrypoint check: one Python function and eleven explicit API rewrites. No local wallet, private journal or test signer enters the deployment artifact.

## Remaining scope

This migrates the verified audio-assessment baseline. It does **not** clear the unfinished text-assessment candidates, rewrite historical Stable deployments, or claim the separate historical payment experiment ran on Next. The release must still pass hosted checks after publishing. Text comparison and evidence capture remain available while assessment-quality work continues.
