# Prototype verification

## September 7: file-based hosted endpoints

The original-route normalization change did not resolve the live 404. A direct public request to `/api/dispatch?route=/api/proof` returned the correct proof bundle, while `/api/proof` still returned the adapter's 404. This isolates the remaining issue to the rewrite-dependent dispatch path; the exact internal rewritten URL was not observed.

Replaced the wildcard rewrite with eight file-based API entrypoints. Each declares a local handler class and binds one server-owned route, inheriting the host, same-origin POST, request-size, fixed RPC and no-broadcast guards. Query parameters cannot override the bound route. The compatibility dispatcher remains available with its strict route allowlist. The exact Vercel CLI builder analyzer recognizes all nine Python functions. Local checks: **204 Python tests passed, two socket tests skipped in the sandbox; 45 JavaScript tests passed**.

Commit `09f24ab56ba589581582294e7b6135f6a85810c8` deployed successfully. Live checks at **2026-09-07 16:37:52 UTC** against `https://recall-navy-phi.vercel.app` passed: proof, configuration and archived JSON returned 200; same-origin agreement inspection and payment receipt reads returned 200; foreign-origin inspection returned 403; local replay remained unavailable (404). The fresh payment read matched the recorded parent, finalized child, recipient and exact **0.040 test GEN** value. The script was read-only: no preparation, signatures or broadcasts.

Live browser checks confirmed the homepage, both purchase outcomes, expanded replacement evidence, and wallet-free resumption of the existing agreement through `/purchase`. The resumed view correctly left transaction controls disabled without a wallet. This does not substitute for a fresh wallet-signing test on the Vercel origin. The website URL is now in the unsubmitted application draft.

## September 7: first hosted runtime check

The public URL `https://recall-navy-phi.vercel.app/` served the frontend and archived JSON without authentication, but `/api/proof` and `/api/session/config` returned the adapter's JSON 404. The function was running, yet the strict dispatcher accepted only the function destination with a rewrite query. It has been extended to recognize equivalent original-route-plus-query and `.py` destination forms, while rejecting mismatched paths, duplicate/extra parameters and unknown routes. POST origin and payload guards remain unchanged. Live verification of the corrected deployment is pending; do not treat the initial static page load as a working deployment.

## September 7: Vercel entrypoint discovery correction

The first Vercel build (CLI 59.11.7, commit `e8537ad`) failed before dependency installation: `api/dispatch.py` was reported as an unmatched function pattern. The file was present, but it only imported `handler` from another module. The exact CLI's bundled `@vercel/python-analysis` 0.14.0 returned `null` for that source. A locally declared `class handler(RecallHandler)` returns `handler` and inherits the existing guarded request implementation unchanged.

`node hosting/check-entrypoint.cjs <build-artifact>` checks the real analyzer and the exact CLI's full builder detector. The old generated artifact reproduced the exact `unused_function` error; the corrected artifact returned no errors and selected `@vercel/python` for `api/dispatch.py` plus `@vercel/static` for public assets. A Python regression test also checks the local class declaration and inherited GET/POST methods. This corrects function discovery; a successful remote build and hosted runtime checks remain to be confirmed. The earlier application tests did not exercise Vercel's static entrypoint detector.

## September 7: isolated hosting package and public wallet-run walkthrough

- Added a read-only homepage for the user's two-purchase run, distinct from the earlier experiment at `/recorded`. It displays complete pinned evidence, stored judgments, eleven known receipts and the verified parent/child transfer. Missing original-reservation receipt coverage remains explicit.
- Preserved the compact design. Browser inspection confirmed replacement selection, full-document expansion and a phone-width layout with content width equal to viewport width (375 px). This is not screen-reader or physical-device certification.
- Vercel package uses a fixed file allowlist: no private wallet directory, local VM runner, development server or test artifacts. Hosted routes reject local replay, foreign origins, foreign hosts, arbitrary file paths, oversized bodies and unsupported request fields. Per-instance concurrency is bounded; this is not global rate limiting or an audit.
- Installed `genlayer-py==0.18.0` into a clean Python 3.12 environment and loaded the actual generated package. Its rewritten proof route returned 200 with five hash-checked documents and its unsigned configuration returned Studio chain 61999.
- Automated checks: **187 Python tests passed**, with **two additional loopback socket tests passed separately**, and **45 JavaScript tests passed**. New tests cover hosted request guards, build allowlisting, receipt mismatch rejection and portal field lengths.
- No contract source change or new blockchain transaction. Vercel deployment, cold-start/routing behavior on the actual host and public logged-out access still require post-deployment verification. The hackathon application remains a draft with website and logo pending.

## September 7: user-approved browser-wallet recall and replacement payment

The user completed the four-role flow in Rabby through the local `/purchase` interface on September 6–7. The contract is **`0x69F3680Bc1A1748AC6759E7b8AAed8cDE43F818D`**, distinct from the earlier runner experiment. Independent public reads at **2026-09-07 14:50:04 UTC** matched all eleven supplied transaction hashes, the deployed source, constructor parties, exact method arguments and values, and finalized contract state.

- Original inference: challenged, resolved INVALID, and permit `p-inference-v1` CANCELLED. Its 0.030 test-GEN reservation was released without payment.
- Replacement: VALID; permit `p-inference-replacement` consumed as SCHEDULED. Its own review deadline was 2026-09-07 14:40:07 UTC; the adapter adds five seconds before payment preparation.
- Payment `0x267bbe002366e6ba74dd69606df525753f10d3a0bb19d9b5390ba65f2915210f` finalized with successful `execute_purchase` for that replacement.
- Its linked, finalized child `0xb319792697bd9dc9c53a8884a2467fdb258c2685afffb755efdf584bc1d85c7e` transferred **0.040 test GEN** from the contract to `0xc842c25cEfD0DbA135C18F29860Cd69e6218Dac2`.
- Final reserved amount: zero. Contract-accounted scheduled amount: 0.040 test GEN. The completed child transfer, not the SCHEDULED status alone, establishes delivery in the Studio ledger.

Artifacts: [public wallet-run observation](live/wallet-run-2026-09-07.json), [read-only verifier](live/verify_wallet_run.py), and [three-minute walkthrough](DEMO.md). The verifier prints a fresh observation and fails on receipt, role, source, argument, accounting or recipient-transfer mismatches. It does not load keys, read browser history or send transactions.

Coverage limits: the original reservation transaction hash was not captured, so this is an eleven-receipt set, not a complete transaction export. Its cancelled permit is verified in final state. Wallet approval provenance comes from the user's interaction and screenshots; RPC receipts alone cannot identify the signing UI. There was no before/after balance-delta measurement in this run. Storage, monitoring, replay rejection, wallet rejection/recovery and adversarial accuracy were not tested in this user run. Separate current reads are not an atomic snapshot or ongoing monitoring.

The UI now distinguishes waiting from expiry and retains the exact payment-opening time. Its paid summary requires matching receipt evidence; empty permit lists explain consumed and cancelled permits. The address-submission bug and idle-connection server stall encountered during this browser flow were corrected with regression tests. Contract source and pinned evidence were not changed. All new interface changes and this evidence package remain local; no public release is implied.

Local regression checks: 167 Python tests passed with two loopback tests skipped by sandbox permissions; those two passed separately with binding allowed. All 34 Node tests passed, including the real purchase controller rendering the saved completed-run payment and rejecting empty permit selection. These automated checks do not exercise a real wallet extension. Brave access was not approved, so visual inspection used the in-app browser with the public deployment resumed and no wallet history; that state correctly withholds a payment-verification label. Desktop and 390 × 844 phone-width inspection confirmed the revised copy wraps; at phone width the document scroll width matched its 375 px client width (15 px viewport scrollbar), with no horizontal overflow. The viewport override was reset afterward.

This is one successful hosted-Studio sandbox scenario with fictional, preselected evidence and a human-directed replacement—not proof of real service delivery, autonomous shopping, decentralized production settlement, general AI accuracy or production readiness. Earlier verification records below describe separate experiments and their status at the time.

## September 6: complete recall/recovery flow and sandbox transfers

The full-flow experiment completed on hosted Studio, chain 61999, at **`0xD8Fe7c1B58499674b32Eb35B402cB09941d17f82`**. It used the unchanged contract source, richer fictional terms pinned to `ab196d305ccc27446058b67139771ce38d42e9b6`, and the same complete buyer criterion fixed before evaluation. No owner wallet, production website, validator overrides, or time manipulation were used.

### Observed outcomes

- Hosted models approved the initial inference, storage and monitoring offers.
- An expressly applicable amendment changed inference to DISPUTED and then INVALID. Storage and monitoring remained VALID.
- Cancellation released the original inference permit's unpaid 0.030 authorization. That permit stayed CANCELLED; no refund or escrow operation occurred.
- A new 0.040 inference offer passed its own evaluation and ten-minute review period. Storage and monitoring also waited for their own review deadlines.
- All **26 submitted contract transactions finalized**: 20 successful application executions and six deliberate rejection tests. The latter rejected early payment, disputed payment, a duplicate permit, and replay of each of the three completed payments.
- All **three recipient transfers were balance-verified**. Each buyer debit matched its recipient credit; unrelated recipients were unchanged, and the contract balance returned to zero after delivery. Parent acceptance initially left value in the contract pending the finalized outbound message, demonstrating why SCHEDULED is not itself delivery.
- A separate read-only verification re-fetched `latest-final` state, confirmed the deployed source hash, re-read all balances, and followed all three parent transactions to their exact finalized child transfers. Its timestamped observation is included in the public report.

| Sandbox account | Initial balance after faucet | Final balance |
| --- | ---: | ---: |
| Buyer | 0.100 GEN | 0.020 GEN |
| Storage recipient | 0 | 0.020 GEN |
| Monitoring recipient | 0 | 0.020 GEN |
| Inference replacement recipient | 0 | 0.040 GEN |
| Contract | 0 | 0 |

Total delivered: **0.080 sandbox GEN**, with zero reserved authorization remaining. The faucet, signing identities and recipients are disposable test infrastructure. These balances are Studio ledger observations, not real-asset or Bradbury settlement claims.

### Reproduction and evidence

- [Full-flow report](live/full-flow-report.json): transaction IDs, exact judgments, state transitions, vote counts, pre/post balances and review timestamps.
- [Runner](live/full_flow.py): resumable checkpoints, predeclared assertions, bounded funding/payments, and no blind resubmission after ambiguous transport failures.
- [Independent verifier](live/verify_network.py): fresh finalized-state, deployed-source, balance and child-transfer checks without loading keys or sending transactions.
- [Demo guide](DEMO.md): a concise presentation sequence and explicit distinctions between this live experiment and the fixture-backed browser demo.
- **78 local tests passed**, also from a clean checkout of `122b1066ea908485982c3109f5ccde34d860cf22` using the existing validated environment. This is not a fresh dependency installation. The suite comprises 56 original Recall cases and 22 offline transport/payment/recovery/report checks; its count is not a count of real AI evaluations.

This is one successful predeclared experiment with five real judgment calls, not established general AI accuracy, source authenticity, production security, or decentralized-network reliability. The replacement is selected by the scripted runner, not autonomously discovered. The browser remains fixture-backed and Vercel was not redeployed. Those integration gaps are the next milestone.

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

### Follow-up identified after the first experiment (completed above)

At this first checkpoint, no positive purchase, live challenge/recovery sequence, or payment delivery had been demonstrated. The terse existing positive fixture did not fully satisfy the stronger deployed criterion. The full-flow experiment above addressed that gap using richer fictional terms without weakening the criterion after seeing model outputs. Repeated model trials and production-network verification remain open.

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
