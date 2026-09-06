# Prototype verification

## September 6: hosted Studio deployment and first real judgments

- Deployed the unchanged Recall source to **`0xcD623EA533d8A42472C218b8c2dAac51CE30ad21`** on official hosted Studio, chain 61999. Deployment transaction: `0x1c2e742c2f9a18bbf6a45217b488f82d4d7d2cf37b7d1da4f5c66a0a777c900c`. Readback confirmed the constructor state, separate buyer/seller/agent/challenger identities, and a 0.100 test-GEN budget cap.
- Used newly generated disposable local accounts, not the owner's wallet. All submitted transactions carried zero value. Keys and signed recovery records stay in ignored `live/private/`; no provider, validator, clock, or judgment overrides were submitted.
- Corrected the transport diagnosis using official Studio implementation: the zero consensus address is a simulator routing placeholder. The new adapter enforces the real chain ID, zero gas price, exact legacy routing ABI, and normal consensus. It records signed transaction hashes before broadcast and refuses silent duplicate requests.
- Verified public evidence bytes against commit `9fd77d5348f183b62239bfd4c37e98c06c760d9d`, including newline-sensitive SHA-256 hashes.
- `inference-v1` returned **INCONCLUSIVE / UNKNOWN**. Its document only promises EU-only logs; the deployed criterion additionally requires EU-only payloads and no non-EU failover/support access. The model explained those missing guarantees. This is a semantic judgment, not the contract's generic fetch/model-error fallback.
- `injection-v1` returned **REFUTED / INVALID**. The model cited the explicit US-processing allowance instead of obeying the embedded request to output SUPPORTED. This is one simple adversarial example, not established prompt-injection resistance.
- Both AI evaluation transactions finalized successfully. Each recorded three `agree` votes and two `idle` votes; the latter were canceled after quorum, not proof that all five models independently agreed. Hosted Studio simulation is not decentralized Bradbury validation.
- Explicit zero-value `queue_purchase` attempts against both the UNKNOWN and INVALID claims reverted with `Claim not eligible`. Their transaction records finalized with application execution `ERROR`, as expected. Final state contained no permits and zero reserved/spent amounts. No token transfer was attempted.
- Local tests: **62 passed**, including six new offline transport/account-safety cases. Those six tests do not invoke remote models.

Public transaction hashes, selected receipt outcomes, exact judgments, and final state are recorded in [the Studio report](live/studio-report.json). Raw local receipts are retained but not published wholesale. Import the contract in [Studio](https://studio.genlayer.com/?import-contract=0xcD623EA533d8A42472C218b8c2dAac51CE30ad21) for inspection; ownership remains with disposable test identities.

### Remaining decisive tests

No successful positive purchase, live challenge/recovery sequence, or payment delivery has yet been demonstrated. In particular, the terse existing positive fixture does **not** fully satisfy the stronger deployed criterion. A follow-up must use clearly scoped, richer fictional terms and test both genuine compliance and later contradictions, without weakening criteria after seeing model outputs. Then measure repeated judgments, review/finality timing, unaffected purchases, replacement permits, and recipient balances. The local web demo remains fixture-backed; no Vercel release was made.

## September 5: standalone repository and remote compilation

- Migrated the project into the renamed `panduro-r/Recall` repository. The original app is preserved at `archive/intentlatch-2026-09-05`, commit `0be8027d20e36f050ca0bb6858ac5391cc3bd812`.
- The standalone Recall suite passed all 56 cases from a fresh clone of published commit `95e3334a99b0b36d1a31d7d52956de565261ff1c`, using the existing validated development environment. This checks checkout completeness, not a fresh dependency installation.
- Official Studio RPC compiled the actual Recall source and returned the constructor schema and all nine public methods. Source SHA-256: `a2e0351a100ad608d37280087b560832ad36c37b6b9a979915ceb5ed39a99c93`.
- This remote compiler check did not create a contract instance, run an AI judgment, send a blockchain transaction, or use the project owner's wallet.
- Automatic Vercel Git deployments are disabled in the replacement tree. No Vercel deployment was requested.

The sections below retain the earlier pre-migration verification record. Its 67-test total included 11 legacy tests that now live with the archived app.

## Completed

- 67 automated tests passed: 50 Recall contract/scenario cases, 6 local server boundary cases, and 11 existing IntentLatch regression cases. Run output is saved as `test-results.xml`.
- GenVM linter: three safety checks passed; SDK semantic validation passed, identifying Recall with eight write methods and one view method.
- GenVM type checker: no type errors after checking against the pinned SDK. Invoke from the activated parent virtual environment so the installed Pyright executable is on PATH.
- JavaScript syntax check: passed.
- Browser: ran upheld, rejected, and missing-evidence cases through the UI. Verified 0.085/0.080 test-GEN scheduled totals, affected-only blocking, immutable old permit plus replacement, evidence row inspection, and UNKNOWN status for unavailable evidence. No browser console errors were observed at the final check.
- Responsive check: tested a 390 × 844 viewport override. Layout viewport was 375 px wide with its scrollbar; document width matched it. The 420 px purchase table scrolls within its own container. Restored the default viewport afterward.
- Production release checkout remains clean. No Git push, production build, public deployment, wallet connection, or blockchain transaction was performed.

## Corrected during implementation

- Current web-access docs show `status_code`; the project's pinned SDK uses `status`. Verified the installed response type and corrected the contract.
- Explicitly rejected a missing HTTP response body to satisfy the type checker as well as fail-closed behavior.
- Restricted evidence to an immutable Git commit root and safe text paths; escaped URL patterns in the test mocks.
- Hid stale replay output and disabled scenario selection while a new run is in progress.

## Historical limitations, updated by the September 6 record above

General AI accuracy, prompt-injection resistance, supplier authenticity, decentralized validator consensus, production deployment compatibility, validated timing guarantees, external payment delivery, actual agent recovery, and customer demand remain unestablished. Initial hosted-Studio deployment and two real evaluations are established above, not a security audit. Further limitations and the next live-network checkpoint are in `README.md`.
