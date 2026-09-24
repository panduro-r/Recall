# Recall

Recall helps developers compare API services against cost and data-use requirements, then inspect captured evidence and GenLayer assessments before choosing a provider. Start with the [builder overview](submission/BUILDER-PROJECT.md) for the current working path and release limits. The detailed experiment history below is an audit trail, not a claim that every candidate is ready for users.

## Current build status — September 24

The shipped product supports wallet-free comparison and evidence capture across transcription, speech generation and text generation. New wallet-approved GenLayer assessments are currently enabled only for transcription and speech generation. A corrected experimental decision contract, v26, passed one frozen Speechmatics assessment on Studio Next; its result explicitly reports conflicting training-policy evidence rather than assuring the user that training is excluded. The pinned read-only adapter is published and the hosted API plus browser validator accepted that saved result without enabling its writer. This **does not** validate v26 for every provider or make new text-generation assessments available. See the [one-case proof](submission/studio-next-v26-speechmatics-2026-09-24.json), [hosted read check](submission/studio-next-v26-hosted-read-2026-09-24.json) and [completion status](submission/completion-status-2026-09-17.md). No additional wallet test is queued.

## Studio Next migration

The audio-assessment baseline is deployed on **Studio Next (61997)** at `0x3E1Bb1624A2c9bF8927B453843b7BEb5ccDEb79d`. Its Fish Audio regression finalized successfully and the complete saved assessment matched the submitted evidence. See [migration proof](submission/studio-next-migration-2026-09-17.json) and [migration QA](tests/STUDIO-NEXT-MIGRATION-QA.md). The migration web release routes new audio assessments to Next; existing reviews and the separate payment archive stay on their original Stable network (61999).

Next uses test-GEN protocol fees even when EVM gas is zero. The wallet confirmation separates the bounded protocol deposit from zero provider payment. This migration does not clear the unfinished text-assessment experiments described below. Comparison, evidence capture and existing records remain available.

## Compare before committing

The published release has **17 plans across 13 providers in three categories**: nine transcription plans, three speech-generation plans and five text-generation plans. The new providers are OpenAI, Anthropic, Google, Mistral AI and DeepSeek. Text generation supports wallet-free comparison, saving, evidence capture and exports; its published GenLayer assessment is not available yet. See [text-category scope and QA](tests/TEXT-CATEGORY-QA-2026-09-15.md).

Local work includes a **v8 evidence-quality candidate whose live release gate failed; not cleared for publication**. Five separately approved tests are complete: OpenAI and Mistral saved completed assessments, Speechmatics and Fish saved partial assessments, and DeepSeek finalized without validator agreement. The additional audit still accepted unsupported Mistral API-default and streaming claims. Successful consensus and an audit marked "passed" do not establish evidence quality. Original proposals, results and receipts remain unchanged; no provider-specific verdict override or automatic retry is used. See [v8 QA and release blockers](tests/PROVIDER-REVIEW-V8-QA.md), the [actual v8 observations](submission/observed-quality-v8-2026-09-15.json), and [v7 live findings](tests/PROVIDER-REVIEW-V7-QA.md). The v8 candidate is not published. All five attempts are consumed, and the test-wallet balance is unchanged.

Production v5 was published and checked on September 14. Three authorized speech-review tests produced two completed assessments and one consensus rejection; see [live results and limits](tests/SPEECH-LIVE-QA-2026-09-14.md). The published [v6 update](tests/PROVIDER-REVIEW-V6-QA.md) clarifies model/plan applicability and includes more relevant Fish Audio evidence. One separately authorized v6 Fish assessment completed: speech capabilities supported, training exclusion unknown. This is a verified example, not proof of general accuracy. The [hosted checker](hosting/check-live.mjs) now targets the exact Studio Next migration source and independently checks historical Stable records. Experimental contracts are excluded from the deployment artifact; historical inspection is read-only.

Open `/` or `/compare`, choose Transcription, Speech generation or Text generation, and enter the matching workload and data-use conditions. No wallet, account, supplier invitation or reply link is needed. Compare two plans under the same requirements, inspect first-party evidence and any matching saved findings, save options locally and export a readable HTML decision brief.

This is a manually reviewed, dated catalog with rules-based matching, not autonomous market research or GenLayer verification of these providers. Conditional privacy settings, unknown prices and minimum commitments remain explicit. The source-check endpoint fetches only the catalog's server-owned public URLs, with bounded reads and a ten-minute per-instance cache. It reports availability and hashes, not a renewed semantic assessment. It does not receive the buyer’s requirements or audio. Each plan retains its review date; reviews older than seven days are flagged. Soniox’s token-based hourly equivalent remains approximate, Speechmatics uses the rate without training/volume discounts, and Amazon Transcribe is explicitly scoped to US East (N. Virginia). No listed provider is integrated with Recall checkout; external provider purchases are not protected by the Studio contract.

Speech generation uses characters per month, with optional streaming. Fish Audio bills UTF-8 bytes: unknown volume stays a visible price range, while a supplied byte count is preserved in the comparison. Standard voices only; no cloning, voice-agent total-cost or output-quality claim. No-training opt-outs and unknown commitments stay explicit.

Text generation adds separate monthly input and billed output tokens, including billed reasoning. It uses standard paid, uncached, text-only inference; tools, media, cache storage, batch/priority tiers and tax are excluded. Tokenizers and quality differ between models, so this is not an identical-workload benchmark. Mistral's opt-out and DeepSeek's unconfirmed no-training scope remain conditional. Google uses the paid project's dated promotional rate, not the free tier. All fifteen sources for the five new providers were captured successfully on Vercel on September 15. OpenAI's local reads returned 403 while production reads succeeded; availability can differ by environment and time, and missing evidence stays visibly unavailable.
The [evidence-first experiment](tests/PROVIDER-REVIEW-V9-LOCAL-QA.md) extracts scoped facts, retains contrary evidence, independently verifies them, and derives findings. The authorized v14 batch completed: both controls passed, six provider cases failed consensus, and Fish Audio completed with a missing required citation. No provider case cleared the quality gate. All nine receipts are preserved in the [batch record](submission/observed-v14-validation-2026-09-16.json); nineteen combined attempts were consumed with no GEN spent. See the [v14 findings](tests/PROVIDER-REVIEW-V14-REFERENCE-QA.md).

The [v15 correction](tests/PROVIDER-REVIEW-V15-DECISION-QA.md) completed its nine-test batch: both controls passed, Fish Audio passed its targeted API/existing-voice check, Google completed with three supported findings, and five providers failed consensus. All twenty-eight attempts and unchanged balances are preserved in the [v15 record](submission/observed-v15-validation-2026-09-16.json). Google\'s 4.73 MB receipt also exposed a 4 MiB reader cap; the bounded transaction-read allowance is now 16 MiB, while other RPC reads remain capped at 1 MiB.

The separately approved [v16 focused-call test](tests/PROVIDER-REVIEW-V16-FOCUSED-QA.md) stopped after its first control failed. The narrower [v17 prompt correction](tests/PROVIDER-REVIEW-V17-PROMPT-QA.md) removes conflicting endpoint/code and paid-account requirements without changing evidence auditing or decision checks. Its separately approved single control also failed with `MAJORITY_DISAGREE`: text-output interpretation still differs, some audit responses fail validation, and one reader overclaims training-policy applicability. Thirty combined attempts are consumed with no GEN spent. The one v17 slot is exhausted and the three stopped v16 slots are not reusable. No candidate is published or release-cleared; see the [preserved v17 result](submission/observed-v17-q01-diagnostics-2026-09-17.json) and [delivery checklist](submission/DELIVERY-CHECKLIST.md).

A [19-case draft quality benchmark](tests/PROVIDER-REVIEW-V9-BENCHMARK.md) separates model inputs from expected answers and checks targeted evidence-reading obligations. It preserves missing/failed attempts and tests both false assurances and unnecessary unknowns. Grader tests are local checks, not live accuracy evidence. Labels still need independent adjudication, other response conditions are unscored, and held-out generalization remains untested. Historical signed records and exhausted or stopped allowances are not rewritten.

## Guided provider review (dated v3–v6 audio results)

From a plan’s evidence panel, choose **Review this provider**, then **Capture evidence**. `/review` saves the extracted public page text, exact fingerprints, selected plan and requirements as a separate browser-local snapshot. Capturing passes the requirements to Recall’s server to assemble the snapshot and fetch the provider's public pages; it does not contact Studio or initiate supplier outreach. Export a review as JSON, revisit it from **Provider reviews**, or capture a new baseline to inspect added and removed source text. Rechecks are user initiated, not continuous monitoring.

**Review with GenLayer** first asks permission to share the snapshot, requirements and public account with Studio for preparation. A separate wallet approval then deploys the immutable, nonpayable `ProviderReview` assessment. Its only public method reads the result. It cannot create purchase approvals or payments, and it does not claim that the listed provider accepted the terms. The model judges supplied extracted text, not independently authenticated web origins, account configurations or actual service delivery. Exact literal citations are checked. Version 5 keeps the v4 transcription checks (API access, prerecorded audio, English and single-channel support) and adds a separate speech-generation rubric for API access, English output and optional streaming. Both distinguish supported commitments, required setup, conflicts, unknowns and technical failures. Conditional findings expose documented actions without asserting they have been completed. USD estimates remain catalog calculations, separate from model findings and test GEN.

The September 14 [read-only verification record](submission/verified-reviews-2026-09-14.json) confirms the existing Speechmatics v3 review (two supported findings) and AssemblyAI v4 review (four supported service findings; training conditional on setup). These are dated evidence snapshots and different formats, not a fresh performance benchmark or proof of general assessment accuracy. Older failed or inconclusive records remain unchanged. The current recovery flow keeps finalized-but-unsaved results recoverable, detects newer formats and blocks duplicate submissions without blocking wallet connection. A successful reload may recover the result automatically; the recovery button is only shown while a result is unresolved. See [recovery QA](tests/REVIEW-RECOVERY-QA.md) and [v4 QA](tests/PROVIDER-REVIEW-V4-QA.md). No new transaction is needed to present the existing examples.

For the practical use case, honest scope and category-expansion plan, read [the product pitch](submission/pitch.md). Three categories support comparison and evidence capture; only transcription and speech generation support optional GenLayer assessment in production. Storage and other categories remain proposals. Release acceptance requires production checks; broader reliability evaluation and [an uncoached user test](submission/usability-check.md) also remain necessary. All prior wallet allowances, including the separate five-test v8 allowance, are consumed; none is automatically renewed.

## Custom purchasing preview

Open `/workspace` to create a request with your own conditions and budget, exchange an unsigned offer link with a supplier, then create a two-party Studio agreement. Supplier acceptance, assessment, approval, changed terms, cancellation, replacement and payment each require an explicit reviewed wallet action. Use two distinct wallets you control for testing, or a buyer and supplier testing together. Test GEN only; no confidential terms.

This is a new contract version in `contracts/recall_purchase.py`. Local VM tests, offline adapter tests, and fake-wallet browser sequences pass. The September 7–8 user run completed a positive purchase; the parent payment and linked 0.040 test-GEN supplier transfer were independently checked. See [payment observation](live/commerce-payment-2026-09-08.json). The current version’s changed-terms, cancellation and replacement paths still need fresh Studio validation. `/proof` preserves the older recorded demonstration; `/purchase` preserves its four-role test workflow. Neither is a provider integration for the comparison catalog.

The custom workspace detects already-authorized account changes and checks known transaction references automatically while visible. Pending results block new signatures, not wallet connection. Missing references require recovery from wallet activity; transactions are never automatically resubmitted. Existing drafts, links, agreement and history survive the usability update. Each purchase shows its next action first, with terms, history and technical details available on demand.

Pending or uncertain transactions block further signing. Recover missing hashes from wallet activity; do not resubmit blindly. Approval does not move funds. Payment is shown as verified only after the finalized recipient transfer matches the reviewed offer, buyer, supplier and amount. Document assessment does not establish real-world service delivery.

## Inspect the completed wallet run

The `/proof` archive presents the September 6–7 recorded wallet run: the original offer was invalidated and canceled, then a separately reviewed replacement transferred **0.040 test GEN**. Inspect the pinned documents, stored judgments and linked parent/child receipts without connecting a wallet. This is saved Studio sandbox evidence, not a live network result or production settlement.

The earlier multi-service experiment remains at `/recorded`; a fresh browser-wallet test is at `/purchase`. The contract source is unchanged. For Vercel import, use **Other** with root directory **`deploy`**. See [hosting instructions](hosting/README.md) for exact settings and the post-deployment checks. The public website URL is not verified until those checks pass.

The September 14 [Agent Tank application draft](submission/agent-tank.json) is prepared but not submitted. It includes the verified [public website](https://recall-navy-phi.vercel.app/), labeled contract references and an upload-ready [project logo](submission/recall-logo.png). The [two-minute demo script](submission/demo-script.md) uses the saved reviews; no video has been recorded or uploaded. A September 14 check of the [public event overview](https://portal.genlayer.foundation/agent-tank/) still listed a September 3–17 build window, but the current full form could not be read. Confirm the exact deadline, track eligibility and submission requirements in the portal; the draft retains the earlier September 7 rule values without asserting a complete fresh recheck.

Evidence-dependent payment permits for agent purchases. A successful challenge blocks the affected pending purchase; unrelated purchases proceed, and corrected evidence can support a fresh permit within the original budget.

**Status: feasibility prototype with a completed user-approved browser-wallet recall/replacement run and verified Studio sandbox transfer; not audited or a finished hackathon submission.** On September 6–7 the user cancelled the invalid original and paid 0.040 test GEN for a separately reviewed replacement. Eleven known public receipts, finalized state and the linked recipient transfer were independently checked; see the [wallet-run evidence](live/wallet-run-2026-09-07.json) and [three-minute demo guide](DEMO.md). The original reservation hash was not captured, and the run does not establish general AI accuracy or production readiness.

The `/proof` archive opens the user's two-purchase recorded run. The **earlier, separate** three-offer experiment remains at `/recorded`; **Check Studio** requests a read-only comparison of that earlier report, and the local-only **Scripted demo** uses fixtures. **Try a new Studio run** opens the wallet-controlled flow. Do not mix the earlier experiment's 0.080 GEN total with the user's 0.040 GEN run. Hosted tests are not Bradbury deployment or real-asset settlement proof. See [verification](VERIFICATION.md), the [earlier full-flow report](live/full-flow-report.json), and [live-test instructions](live/README.md).

## Try it

Requires Python 3.12. From this repository's root:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open <http://127.0.0.1:4178> for the provider comparison. The separate `/proof` archive shows the original and replacement with 11 known recorded receipts. Choose a purchase there, read full source documents, and inspect the linked transfer. The earlier experiment's 26 receipts are separately available at `/recorded`. Exact transfer labels require a matching finalized parent and child in the exported report, not just a scheduled permit.

For local replay, open `/recorded`, select **Scripted demo**, choose counter-evidence, and click **Run scenario**. The **Execution step** selector and **Next step** follow actual local contract snapshots. Scheduled fixture messages are explicitly unverified; no recipient payment is claimed. This replay is disabled in the Vercel package.

Click **Check Studio** to compare the chain ID, finalized contract snapshot, deployed source hash, five current balances and three parent/child payment receipts. Loading, matched, mismatched and unavailable states are separate. Expand **Check details** for individual results. These are separate latest RPC reads, not an atomic block snapshot, proof of service delivery, or continuous monitoring. A current balance difference can reflect later activity; it does not by itself invalidate a historical payment. The recorded purchases and amounts remain unchanged.

The loopback server serves only allowlisted UI assets and bounded same-origin API routes. Evidence must match its exported hashes; large monetary integers are serialized as strings. RPC destinations are fixed to Studio, with five-second socket timeouts, a 1 MiB response cap and no redirects. The historical checker uses four read methods; wallet preparation additionally reads gas price, gas estimate, pending nonce and the simulator routing ABI. The server never signs, broadcasts, funds accounts, reads private journals, or accepts arbitrary RPC methods, source code or evidence paths. New-run public addresses and deployment hashes are validated. This is a loopback development server, not a public production API.

## Wallet-controlled purchase flow

Open `/purchase` in the same desktop browser that has your EIP-1193 wallet extension. The in-app browser may not expose a wallet; the page explains that state and disables signing controls. Keep seed phrases and private keys in your wallet, never in the app or chat.

1. Connect the buyer's test account and choose **Switch to Studio**. The adapter checks wallet chain 61999 before and after fresh preparation; wrong networks and paid transport are refused.
2. Provide three other public accounts controlled by you or your test partners: seller, agent and challenger. Four distinct roles are a contract requirement, not four people; one tester may switch among four test accounts. The agent role can also evaluate and reserve, while the buyer can perform those operations itself.
3. Choose **Review deployment**, inspect all constructor arguments, then **Approve in wallet**. This sets a 0.100 test-GEN budget limit; it deposits no funds. Wait for a finalized successful deployment and its verified source before actions become available.
4. Switch to the seller account, reconnect and accept the agreement. Publish the original inference, storage and monitoring offers with explicit test recipient addresses. Each operation has its own review and wallet approval.
5. Switch to the buyer or agent, evaluate claims, and reserve eligible purchases. The actual ten-minute review window starts at evaluation; no artificial time-skipping is used.
6. During the original inference claim's review window, switch to the challenger and submit its pinned amendment. Resolve the challenge using any agreement role. If the claim becomes invalid or unknown, the buyer can cancel its reserved permit; the seller can publish the separate replacement offer. Evaluate and reserve that replacement with a new review window.
7. Only the buyer executes payment. After review closes and while the claim remains valid, the request contains the exact permit amount. Obtain **test** GEN in Studio beforehand; funding is never automatic. The page checks finalized execution and a matching child transfer to the reviewed recipient before claiming payment verification.

The run uses fixed, fictional EU-only offers and immutable evidence; it is not an open-ended purchasing marketplace. Agreement lifetime is 24 hours. AI evaluation may be inconclusive: cancellation remains available for a reserved purchase, and there is no fabricated successful outcome.

Public request metadata and hashes persist locally for recovery. An uncertain wallet result blocks new requests until the user checks wallet activity and supplies the hash, or explicitly confirms it was never submitted. Transactions are never automatically retried. Automatic receipt checks are bounded to twelve polling cycles and pause when the page is hidden; **Check receipts** resumes manual inspection. Do not run the same wallet flow in multiple tabs. **Start another agreement** only clears the selection; it does not delete contracts or transaction history.

The adapter is deliberately scoped to the observed gasless five-argument Studio simulator router. It does not silently fall back to another ABI or chain. GenLayer's current docs distinguish stable Studio (61999) from its development preview (61997), and describe provider-backed wallet signing: [Studio environments](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio), [browser wallet writes](https://docs.genlayer.com/developers/decentralized-applications/writing-data). Do not copy this simulator adapter to Bradbury or a fee-charging deployment.

```sh
pytest tests -q
node --test tests/test_ui.mjs tests/test_wallet.mjs
node --test tests/test_purchase_ui.mjs
python live/verify_wallet_run.py
genvm-lint check contracts/recall.py
genvm-lint typecheck contracts/recall.py
python harness.py --scenario upheld
python harness.py --scenario rejected
python harness.py --scenario missing
```

Validated with `genlayer-test` 0.29.2, `genlayer-py` 0.18.0, and the SDK identified by the contract's dependency header. The direct VM is development tooling; local passing tests are not proof of network execution. Python tests cover unsigned encoding, role/amount/time guards, verified-deployment loading, receipt reconciliation, public evidence integrity and request boundaries. Node tests cover wallet identity and chain changes, rejection, uncertain outcomes, double submission, recovery persistence, form-submission ordering, payment labels, review deadlines and recipient settlement matching. Loopback connection tests need permission to bind local sockets; they skip when the environment forbids it. The original IntentLatch tests remain with the archived project.

## Repository migration and hosting

The previous IntentLatch application is preserved in `archive/intentlatch-2026-09-05` and in Git history. Recall replaces the main-branch file tree; the archive is the recovery point for the old application. No history is force-pushed or purged.

The current Vercel project deploys the allowlisted `deploy` directory from GitHub. `hosting/build.mjs` assembles runtime assets; publishing requires explicit approval and preserves unrelated repository paths. The older migration-time hosting warning no longer describes this deployed preview. Hosting success is not evidence of production readiness or live model quality.

## Historical purchase experiment (separate from provider comparison)

A buyer's purchasing agent queues inference, storage, and monitoring services. Each purchase depends on a separately versioned supplier claim satisfying a fixed buyer criterion: EU-only processing and storage of customer logs. An evidence publisher accepts the agreement. A designated challenger supplies a contradictory amendment for the inference offer. Only that purchase becomes ineligible. Unrelated purchases retain their eligibility. A corrected alternative receives a new judgment, new permit, and fresh review period within the same budget.

The seller role in this prototype is the shared offer/evidence publisher, not three separately signing service providers. Four distinct transaction identities represent buyer, publisher, purchasing agent, and designated challenger. They are hardcoded synthetic identities in the local harness, not connected accounts.

| Scenario | Affected original purchase | Unrelated purchases | End state |
| --- | --- | --- | --- |
| Applicable amendment contradicts offer | Blocked, then cancelled | Proceed after review | New offer schedules 0.045; total 0.085 test GEN |
| Counter-evidence is irrelevant | Holds during dispute, then remains valid | Proceed after review | Original schedules 0.040; total 0.080 test GEN |
| Counter-evidence unavailable | Unknown; never automatically restored | Proceed after review | Cancellation and fresh verified version; total 0.085 test GEN |

This is not an EU compliance assessment or a representation about real suppliers. Names and documents are fictional fixtures.

## What executes in the historical local harness

`contracts/recall.py` contains actual GenLayer storage, public methods, role checks, budget accounting, nondeterministic evaluation callbacks, and outbound transfer scheduling. `harness.py` loads it through GenLayer's direct VM and invokes those methods. The UI replays snapshots returned by that execution; it does not fabricate purchase states in JavaScript.

Both web responses and LLM judgments are explicitly mocked. The harness checks selected validator callbacks, including independent disagreement in tests, but it does not run a validator network. Scheduled transfer messages are intercepted; no tokens move and no recipient balance changes are established. Synthetic transaction time advances instantly to test deadlines.

### Contract constraints

- One agreement, fixed 0.100 test-GEN demo budget, one semantic criterion, one dependency per purchase, at most nine claim versions and nine lifetime permits.
- Buyer deploys, cancels, and funds execution; agent can evaluate and reserve but cannot spend the buyer's wallet. Publisher must accept before publishing. Only the designated challenger can challenge.
- Claims bind immutable statement, recipient, integer amount, evidence URL, SHA-256, and optional superseded-version ID. A replacement cannot rewrite the old permit.
- Valid claims receive a ten-minute review window from their initial evaluation. Challenge submissions close strictly before that boundary. Resolution has a fixed additional five minutes; a timeout never silently restores a disputed claim. Agreement expires after 24 hours.
- At most one challenge per version. All four parties can trigger resolution; there is no separate publisher response round, challenge bond, or appeal round in this prototype.
- Every judgment callback independently fetches commit- and hash-pinned text evidence. Missing, oversized, hash-mismatched, undecodable, or malformed results fail closed as inconclusive. Equivalence compares the discrete verdict, not the wording of the explanation. Explanations must not be treated as separately consensus-verified facts.
- A payment requires a still-valid dependency, elapsed review window, unexpired agreement, buyer sender, unconsumed permit, and exactly the reserved value. It consumes the permit before scheduling an outbound transfer.
- `reserved + spent <= cap`. `spent` conservatively counts scheduled amounts, not confirmed delivery. Cancellation releases only an unpaid reservation. **There is no deposit, locked balance, escrow, or refund path.**

## Limits of the historical purchase experiment

1. **AI accuracy remains unestablished.** Initial hosted-Studio evaluations are recorded in `VERIFICATION.md`, separately from fixture tests. A few examples do not prove prompt-injection resistance, source authenticity, or decentralized validator agreement. Repeated positive, negative, ambiguous, and adversarial trials with measured false blocks and missed blocks remain necessary.
2. **Source authority is assumed, not discovered.** The immutable Git source root is a bounded fixture mechanism. Hashes prove bytes, not truth, supplier identity, or legal authority. All demo alternatives/counter-documents are precommitted. Real post-publication corrections need an authenticated versioned evidence registry or explicit counterparty-approved source policy. Arbitrary seller-controlled documents are not trustworthy evidence by themselves.
3. **A designated challenger can force cancellation with an inconclusive challenge.** One-challenge and fixed-deadline rules bound the process, but do not solve malicious challenger incentives or denial of service. The buyer can cancel an unpaid permit; automatic liveness is not promised.
4. **No autonomous discovery/recovery agent.** The harness and live runner select a predeclared replacement. A real purchasing agent must discover an acceptable offer, preserve the original mandate, and submit a fresh version and permit. A replacement does not bypass its new review window.
5. **Production settlement needs separate verification.** Three Studio sandbox transfers have verified recipient credits and matching buyer debits. On a real network, accepted execution is still not sufficient evidence of final external transfer. This contract intentionally does not reopen permits after a scheduled message fails; automated retries require a separately designed settlement/reconciliation protocol.
6. **Timing needs broader measurement.** One Studio flow observed real ten-minute windows; these experiment constants are not a validated network SLA. Transactions use network-provided transaction timestamps, which can lag execution. Test ordering and finality races before selecting production windows.
7. **Commercial value remains a hypothesis.** A single buyer could run similar checks centrally. Shared neutral adjudication is useful only when independent participants genuinely agree to rely on it. Validate that demand, rather than treating the presence of a blockchain as product differentiation.

## Further purchase integration work

The hosted preview includes the recorded-report interface and separate wallet-controlled purchase flows. The September 7 evidence package remains a historical record, not a fresh observation. The user-approved four-role cancellation/replacement/payment scenario is complete; wallet rejection and uncertain-outcome recovery also have automated-test coverage, not proof of all live-wallet edge cases. Present the historical result using `DEMO.md` and refresh its evidence with `python live/verify_wallet_run.py` (read-only; no signing). The current catalog's providers are not integrated with this flow. New fixture versions require a new pinned commit and agreement; never mutate old evidence or retroactively weaken its criterion.

Before moving beyond Studio, verify the intended hackathon network and its SDK/RPC compatibility. Never reuse the old IntentLatch address as if it exposed Recall methods. Wallet signatures stay with the user. Add independent repeat runs and non-scripted adversarial trials before making general reliability claims; use `DEMO.md` to present what has actually been verified.

## References and prior art

- [GenLayer transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context): deterministic transaction time and sender/value context.
- [GenLayer web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access): independent network fetches inside nondeterministic computation. Compatibility note: the **pinned SDK here uses `Response.status`**; current documentation shows `status_code`. The implementation was checked against the installed pinned SDK and semantic validator.
- Prior art includes [Half-Life](https://github.com/OmBhandwaldar/half-life-datahub), which addresses agent-memory invalidation, and [Provenant](https://github.com/abhid1234/provenant), which addresses artifact lineage and revocation. Recall is a narrow integration experiment, not a claim to invent revocation, provenance, memory correction, or dispute resolution.

The frontend design skill informed the evidence-first layout: inspect a purchase's dependency and exact consequences, with explicit local-execution labels rather than simulated live-network status.
