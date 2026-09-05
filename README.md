# Recall

Evidence-dependent payment permits for agent purchases. A successful challenge blocks the affected pending purchase; unrelated purchases proceed, and corrected evidence can support a fresh permit within the original budget.

**Status: feasibility prototype. Not deployed, not audited, not a finished hackathon submission.** Real contract logic executes in the local test interface, but web responses and AI judgments are scripted fixtures. See the limitations below.

## Try it

Requires Python 3.12. From this repository's root:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Open <http://127.0.0.1:4178>, choose counter-evidence, and click **Run contract scenario**. Select the numbered steps and purchase rows to inspect dependency state, exact amounts, source hashes, and replacement lineage. The server binds only to loopback, exposes only three UI assets and a bounded scenario endpoint, and starts a fresh subprocess per run. It does not read wallets, accept arbitrary code, or call an RPC.

```sh
pytest tests -q
genvm-lint check contracts/recall.py
genvm-lint typecheck contracts/recall.py
python harness.py --scenario upheld
python harness.py --scenario rejected
python harness.py --scenario missing
```

Validated with `genlayer-test` 0.29.2, `genlayer-py` 0.18.0, and the SDK identified by the contract's dependency header. The direct VM is development tooling; local passing tests are not proof of network execution. The standalone suite contains 56 cases. The original 11 IntentLatch regression cases remain with the archived project, not in this repository's new main tree.

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

1. **Actual AI and consensus are untested.** Fixtures prove branching/accounting, not semantic accuracy, prompt-injection resistance, source authenticity, or agreement across real validators. The next decisive experiment is repeated live evaluations of positive, negative, ambiguous, and adversarial evidence with measured false blocks and missed blocks.
2. **Source authority is assumed, not discovered.** The immutable Git source root is a bounded fixture mechanism. Hashes prove bytes, not truth, supplier identity, or legal authority. All demo alternatives/counter-documents are precommitted. Real post-publication corrections need an authenticated versioned evidence registry or explicit counterparty-approved source policy. Arbitrary seller-controlled documents are not trustworthy evidence by themselves.
3. **A designated challenger can force cancellation with an inconclusive challenge.** One-challenge and fixed-deadline rules bound the process, but do not solve malicious challenger incentives or denial of service. The buyer can cancel an unpaid permit; automatic liveness is not promised.
4. **No live agent recovery loop.** The harness selects the replacement. A real purchasing agent must discover an acceptable offer, preserve the original mandate, and submit a fresh version and permit. A replacement does not bypass its new review window.
5. **Settlement needs separate verification.** On a real network, an accepted transaction is not sufficient evidence of final external transfer. Record final execution state and actual recipient balances. This contract intentionally does not reopen permits after a scheduled message fails; automated retries require a separately designed settlement/reconciliation protocol.
6. **Timing needs live measurement.** Ten/five-minute windows are experiment constants, not a validated network SLA. Transactions use network-provided transaction timestamps, which can lag execution. Test ordering and finality races before selecting production windows.
7. **Commercial value remains a hypothesis.** A single buyer could run similar checks centrally. Shared neutral adjudication is useful only when independent participants genuinely agree to rely on it. Validate that demand, rather than treating the presence of a blockchain as product differentiation.

## Next network checkpoint — not performed yet

Keep production untouched. Pin a published commit for the fictional `evidence/` text files, record its SHA-256 values, and use that immutable source root for live evaluation. Do not deploy with the synthetic demo addresses. Choose the intended current hackathon network and a compatible SDK/RPC combination; do not mix the existing stable pin with a newer release-candidate environment without validation. Deploy a **new Recall instance**, never overwrite or reuse the old IntentLatch address as if it exposed these methods.

Use isolated test identities and test tokens. Wallet signatures stay with the user. Then replay publisher acceptance → publish/evaluate/queue → challenge/resolve → unaffected execution → cancel/repair/evaluate/queue → repaired execution. Record addresses, transaction hashes, execution outcomes, validator behavior, latency, and recipient balances. Add non-scripted adversarial trials before claiming the core is proven. Only then decide whether to merge into the public hackathon app.

## References and prior art

- [GenLayer transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context): deterministic transaction time and sender/value context.
- [GenLayer web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access): independent network fetches inside nondeterministic computation. Compatibility note: the **pinned SDK here uses `Response.status`**; current documentation shows `status_code`. The implementation was checked against the installed pinned SDK and semantic validator.
- Prior art includes [Half-Life](https://github.com/OmBhandwaldar/half-life-datahub), which addresses agent-memory invalidation, and [Provenant](https://github.com/abhid1234/provenant), which addresses artifact lineage and revocation. Recall is a narrow integration experiment, not a claim to invent revocation, provenance, memory correction, or dispute resolution.

The frontend design skill informed the evidence-first layout: inspect a purchase's dependency and exact consequences, with explicit local-execution labels rather than simulated live-network status.
