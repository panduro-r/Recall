# Prototype verification

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
