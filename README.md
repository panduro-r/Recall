# Recall

## Inspect the completed wallet run

The homepage now presents the September 6–7 recorded wallet run: the original offer was invalidated and canceled, then a separately reviewed replacement transferred **0.040 test GEN**. Inspect the pinned documents, stored judgments and linked parent/child receipts without connecting a wallet. This is saved Studio sandbox evidence, not a live network result or production settlement.

The earlier multi-service experiment remains at `/recorded`; a fresh browser-wallet test is at `/purchase`. The contract source is unchanged. For Vercel import, use **Other** with root directory **`deploy`**. See [hosting instructions](hosting/README.md) for exact settings and the post-deployment checks. The public website URL is not verified until those checks pass.

The [Agent Tank application draft](submission/agent-tank.json) is prepared but not submitted. It still needs the verified website URL and logo. The [current event rules](https://portal.genlayer.foundation/agent-tank/hackathon/) permit one project per portal account; the deadline is September 17, 2026 at 15:30 UTC.

Evidence-dependent payment permits for agent purchases. A successful challenge blocks the affected pending purchase; unrelated purchases proceed, and corrected evidence can support a fresh permit within the original budget.

**Status: feasibility prototype with a completed user-approved browser-wallet recall/replacement run and verified Studio sandbox transfer; not audited or a finished hackathon submission.** On September 6–7 the user cancelled the invalid original and paid 0.040 test GEN for a separately reviewed replacement. Eleven known public receipts, finalized state and the linked recipient transfer were independently checked; see the [wallet-run evidence](live/wallet-run-2026-09-07.json) and [three-minute demo guide](DEMO.md). The original reservation hash was not captured, and the run does not establish general AI accuracy or production readiness.

The homepage opens the user's two-purchase recorded run. The **earlier, separate** three-offer experiment remains at `/recorded`; **Check Studio** requests a read-only comparison of that earlier report, and the local-only **Scripted demo** uses fixtures. **Try a new Studio run** opens the wallet-controlled flow. Do not mix the earlier experiment's 0.080 GEN total with the user's 0.040 GEN run. Hosted tests are not Bradbury deployment or real-asset settlement proof. See [verification](VERIFICATION.md), the [earlier full-flow report](live/full-flow-report.json), and [live-test instructions](live/README.md).

## Try it

Requires Python 3.12. From this repository's root:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open <http://127.0.0.1:4178>. The compact workbench shows the original and replacement with 11 known recorded receipts. Choose a purchase, read full source documents, and inspect the linked transfer. The earlier experiment's 26 receipts are separately available at `/recorded`. Exact transfer labels require a matching finalized parent and child in the exported report, not just a scheduled permit.

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

Automatic Vercel Git deployments are deliberately disabled by `vercel.json`. This local Python-backed prototype is not yet a production Vercel application. Do not re-enable deployment until the browser app, hosted backend, network configuration, and signing flow have been implemented and verified. Existing deployments are not deleted by this repository migration.

## The concrete product experiment

A buyer's purchasing agent queues inference, storage, and monitoring services. Each purchase depends on a separately versioned supplier claim satisfying a fixed buyer criterion: EU-only processing and storage of customer logs. An evidence publisher accepts the agreement. A designated challenger supplies a contradictory amendment for the inference offer. Only that purchase becomes ineligible. Unrelated purchases retain their eligibility. A corrected alternative receives a new judgment, new permit, and fresh review period within the same budget.

The seller role in this prototype is the shared offer/evidence publisher, not three separately signing service providers. Four distinct transaction identities represent buyer, publisher, purchasing agent, and designated challenger. They are hardcoded synthetic identities in the local harness, not connected accounts.

| Scenario | Affected original purchase | Unrelated purchases | End state |
| --- | --- | --- | --- |
| Applicable amendment contradicts offer | Blocked, then cancelled | Proceed after review | New offer schedules 0.045; total 0.085 test GEN |
| Counter-evidence is irrelevant | Holds during dispute, then remains valid | Proceed after review | Original schedules 0.040; total 0.080 test GEN |
| Counter-evidence unavailable | Unknown; never automatically restored | Proceed after review | Cancellation and fresh verified version; total 0.085 test GEN |

This is not an EU compliance assessment or a representation about real suppliers. Names and documents are fictional fixtures.

## What actually executes

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

## Important gaps before a hackathon-quality claim

1. **AI accuracy remains unestablished.** Initial hosted-Studio evaluations are recorded in `VERIFICATION.md`, separately from fixture tests. A few examples do not prove prompt-injection resistance, source authenticity, or decentralized validator agreement. Repeated positive, negative, ambiguous, and adversarial trials with measured false blocks and missed blocks remain necessary.
2. **Source authority is assumed, not discovered.** The immutable Git source root is a bounded fixture mechanism. Hashes prove bytes, not truth, supplier identity, or legal authority. All demo alternatives/counter-documents are precommitted. Real post-publication corrections need an authenticated versioned evidence registry or explicit counterparty-approved source policy. Arbitrary seller-controlled documents are not trustworthy evidence by themselves.
3. **A designated challenger can force cancellation with an inconclusive challenge.** One-challenge and fixed-deadline rules bound the process, but do not solve malicious challenger incentives or denial of service. The buyer can cancel an unpaid permit; automatic liveness is not promised.
4. **No autonomous discovery/recovery agent.** The harness and live runner select a predeclared replacement. A real purchasing agent must discover an acceptable offer, preserve the original mandate, and submit a fresh version and permit. A replacement does not bypass its new review window.
5. **Production settlement needs separate verification.** Three Studio sandbox transfers have verified recipient credits and matching buyer debits. On a real network, accepted execution is still not sufficient evidence of final external transfer. This contract intentionally does not reopen permits after a scheduled message fails; automated retries require a separately designed settlement/reconciliation protocol.
6. **Timing needs broader measurement.** One Studio flow observed real ten-minute windows; these experiment constants are not a validated network SLA. Transactions use network-provided transaction timestamps, which can lag execution. Test ordering and finality races before selecting production windows.
7. **Commercial value remains a hypothesis.** A single buyer could run similar checks centrally. Shared neutral adjudication is useful only when independent participants genuinely agree to rely on it. Validate that demand, rather than treating the presence of a blockchain as product differentiation.

## Next integration checkpoint

The recorded-report interface, fresh Studio checks, wallet-controlled flow and September 7 evidence package are implemented locally, not pushed or deployed. The user-approved four-role cancellation/replacement/payment scenario is complete; wallet rejection and uncertain-outcome recovery remain automated-test coverage, not demonstrated live wallet runs. Present the completed result using `DEMO.md` and refresh its evidence with `python live/verify_wallet_run.py` (read-only; no signing). Before a hosted release, verify the hackathon's target network and requirements, review the local changes, prepare the hosting architecture, and repeat appropriate checks there. New fixture versions require a new pinned commit and agreement; never mutate old evidence or retroactively weaken its criterion.

Before moving beyond Studio, verify the intended hackathon network and its SDK/RPC compatibility. Never reuse the old IntentLatch address as if it exposed Recall methods. Wallet signatures stay with the user. Add independent repeat runs and non-scripted adversarial trials before making general reliability claims; use `DEMO.md` to present what has actually been verified.

## References and prior art

- [GenLayer transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context): deterministic transaction time and sender/value context.
- [GenLayer web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access): independent network fetches inside nondeterministic computation. Compatibility note: the **pinned SDK here uses `Response.status`**; current documentation shows `status_code`. The implementation was checked against the installed pinned SDK and semantic validator.
- Prior art includes [Half-Life](https://github.com/OmBhandwaldar/half-life-datahub), which addresses agent-memory invalidation, and [Provenant](https://github.com/abhid1234/provenant), which addresses artifact lineage and revocation. Recall is a narrow integration experiment, not a claim to invent revocation, provenance, memory correction, or dispute resolution.

The frontend design skill informed the evidence-first layout: inspect a purchase's dependency and exact consequences, with explicit local-execution labels rather than simulated live-network status.
