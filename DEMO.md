# Recall demonstration guide

## Current three-minute walkthrough: the user's wallet run

Use the **September 6–7 user-approved Studio browser-wallet run** at `0x69F3680Bc1A1748AC6759E7b8AAed8cDE43F818D`. This is the two-offer cancellation/replacement scenario with **0.040 test GEN delivered**, not the earlier three-offer experiment described later in this document.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:25 | Buyer criterion, 0.100 test-GEN cap, four role addresses | “The buyer requires EU-only handling. The seller publishes offers; the agent can evaluate and reserve, but only the buyer can pay.” |
| 0:25–0:55 | Original inference document and applicable amendment | “The original order commits to EU-only handling. This precommitted amendment supersedes those terms and permits US processing and access. The evidence no longer supports the purchase.” |
| 0:55–1:25 | Original INVALID claim, CANCELLED permit, and challenge/resolution/cancellation receipts | “The challenge changed this purchase's eligibility. The buyer cancelled its unpaid 0.030 reservation. There was no escrow deposit and no refund.” |
| 1:25–1:55 | Separate replacement document, claim ID and review deadline | “EU Dedicated Inference is a new 0.040 offer. It needed a new judgment, a new permit and its own ten-minute review window. The original stayed cancelled.” |
| 1:55–2:30 | Exact payment review or saved receipt, then parent and child transfer | “The buyer approved the exact payment. Parent execution schedules the transfer; the finalized child confirms 0.040 test GEN reached the selected recipient.” |
| 2:30–3:00 | Evidence package and boundaries | “This was a human-operated, four-role Studio test using fictional pinned terms. Next are repeated and adversarial trials, authenticated sources and hosted integration—not a claim of production readiness.” |

Use earlier screenshots labelled as recorded. The finished contract cannot be reset to those stages. Mark time jumps: this three-minute edit includes actual ten-minute review windows and an overnight pause. No new wallet transactions are needed to present the completed run; do not pay again or start another agreement for screenshots.

Files: [wallet-run evidence](live/wallet-run-2026-09-07.json), [verification record](VERIFICATION.md), [original order](evidence/flow/inference-v1.txt), [amendment](evidence/flow/inference-amendment.txt), [replacement](evidence/flow/inference-replacement.txt).

- Deployment: `0x25e0fc31634f16b8c4f522a8a18faa111a2770ed30cddfcdededcc2cc7bbd4c9`.
- Payment: `0x267bbe002366e6ba74dd69606df525753f10d3a0bb19d9b5390ba65f2915210f`.
- Recipient transfer: `0xb319792697bd9dc9c53a8884a2467fdb258c2685afffb755efdf584bc1d85c7e`.

From the repository root with dependencies installed, `python live/verify_wallet_run.py` prints a fresh read-only public observation. Keep the saved JSON unchanged as a historical record. A failed fresh check means “could not verify now,” not permission to resend. Do not run `live/full_flow.py` just to inspect this wallet run; it is a different signing experiment.

The original reservation hash was not captured. Its cancelled permit is confirmed in final state; the eleven receipts are not a complete transaction archive. Wallet signing provenance is user-reported. This run has a verified recipient transfer but no before/after balance-delta measurement. Storage, monitoring, negative transaction tests and wallet recovery are not claimed for this run.

The default `/` **Recorded run** still displays the separate earlier experiment at `0xD8Fe…7f82` and its 0.080 total test GEN. Do not mix its screens or totals with this wallet run. **Scripted demo** is a third mode, using mocked web/AI fixtures. Hashes establish bytes, not supplier identity or truth; the replacement was preselected, not autonomously discovered. Studio is a hosted sandbox, not Bradbury or real-asset settlement. This guide is not a video recording, submitted entry or verification of current hackathon rules.

## Earlier three-offer runner experiment

The remainder of this guide describes the separate experiment in `live/full-flow-report.json`, not the user's wallet run above.

## One-sentence explanation

Challenge the evidence behind an agent purchase before payment; block the affected purchase, preserve unrelated purchases, and authorize a compliant replacement within the same budget.

## What to show

1. **The mandate:** a buyer caps authorization at 0.100 test GEN and specifies complete EU-only data handling. Separate seller, agent, challenger and buyer identities have different permissions.
2. **Three offers:** inference 0.030, storage 0.020, monitoring 0.020. Inspect each pinned document and actual model judgment before showing its queued permit.
3. **The contradiction:** a later, explicitly applicable inference amendment permits US processing and support access. Open the original and amendment side by side. Storage and monitoring are different orders and must remain valid.
4. **The consequence:** inference moves through DISPUTED to INVALID; attempts to pay it are rejected. Cancel its unpaid reservation. This releases authorization, not escrowed money or a refund.
5. **The repair:** a new EU Dedicated offer costs 0.040. It must pass its own evaluation, receive a new permit, and wait through its own review period. The old permit remains canceled.
6. **The accounting:** if the full run succeeds, supplier balances gain 0.020 + 0.020 + 0.040, the buyer retains 0.020, and the contract retains zero. Show balance evidence, not just SCHEDULED labels. Replay and duplicate-permit attempts must fail.

The acceptance criterion for this demonstration is the completed full-flow report in `live/`, not this narrative. If a run stops or a balance does not match, present it as unfinished rather than recording the planned outcome as if it happened.

## Recording honestly

- The contract uses real ten-minute review windows. An edited recording may skip waiting, but label the time jump and preserve transaction timestamps. Do not describe instant local time advances as network behavior.
- The browser's **Scripted demo** uses mocked evidence/judgments; **Recorded run** inspects the exported experiment. The separate `/purchase` wallet flow now connects to Studio. Label these modes distinctly.
- The terms are fictional and commit-pinned. A content hash proves which bytes were used, not supplier identity or truth.
- The runner chooses a predeclared replacement. It is not an autonomous shopping agent discovering alternatives.
- Studio runs hosted simulation and sandbox balances. Do not describe this as Bradbury deployment, production payments, escrow, or a general accuracy/security guarantee.

## Reproduce or inspect

Install the pinned dependencies using the repository README. `python live/full_flow.py` resumes the isolated experiment recorded in the ignored local journal. For an independent fresh experiment, use a fresh checkout without copying any private keys or run journals. Never delete a journal to force a retry: it protects against duplicate transactions.

After a successful run, `python live/export_flow.py` prints the public verification artifact. The report provides transaction hashes, pre/post balances, verdict explanations, review deadlines, and authorization transitions. Preserve the evidence commit and unchanged buyer criterion when comparing runs.
