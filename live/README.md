# Live-test preparation

The preflight script sends only public metadata queries to the fixed official stable Studio RPC. It does not send contract source, create accounts, request faucet funds, sign messages, or submit transactions. It stores a local source hash only for identifying the candidate under test.

```sh
python live/preflight.py
```

The September 5 check confirmed chain ID 61999, but returned a zero address for `ConsensusMain`, no `ConsensusData`, and no `sim_getFeeConfig` method. This blocked use of the installed SDK's standard EVM deployment path. September 6 inspection of [official Studio source](https://github.com/genlayerlabs/genlayer-studio/tree/c94072951e483510329670aa427fba3fa6944f45) established that the zero address is a simulator routing placeholder, not a deployed EVM contract. The Studio-specific adapter below validates that exact ABI and chain ID before signing. It never substitutes another network ID. Hosted simulation must not be presented as decentralized Bradbury settlement.

## Remote source compilation

After the owner authorized source publication and testing, this explicit command successfully compiled the public Recall source in official Studio:

```sh
python live/compile.py
```

It sends the contract source to `https://studio.genlayer.com/api` using `gen_getContractSchemaForCode`, after verifying chain ID 61999. It returned the six-argument constructor and nine public methods on September 5. Results are written locally to `live/compile-result.json`, ignored by Git. Compilation is not deployment or live AI evaluation. See `VERIFICATION.md` for the verified source hash.

## Source publication and account boundary

The initial preflight was metadata-only. The project owner subsequently authorized publishing the Recall project and testing its contract with separate development accounts. The preflight command remains metadata-only; it does not deploy merely because source publication has been authorized.

The adapter below resolves this particular Studio transport mismatch; other networks still need their own compatibility checks. Verify pinned evidence bytes before deploying a fresh isolated test instance. Never treat an empty or zero deployment address as a usable EVM contract without understanding the target's simulator transport. User-wallet signatures remain a separate handoff; private keys should never be requested in chat. Generated development keys must be kept in `live/private/`, excluded from Git and logs, and never funded with real assets.

## Isolated Studio adapter

`studio.py` implements the official simulator's signed `addTransaction` ABI and RLP payload. It fixes the RPC to official Studio, checks chain 61999, zero gas price, and the known routing ABI, and uses normal consensus (five initial validators, no leader-only mode or simulation overrides). Its basic CLI submits zero-value transactions. The full-flow runner can additionally submit strictly bounded sandbox payments as described below.

```sh
python live/studio.py deploy
python live/studio.py status
python live/studio.py snapshot
python live/studio.py send --label accept --role seller --method accept_terms
```

Run commands sequentially. Inspect status and state before each dependent write: `ACCEPTED`/`FINALIZED` alone does not establish a successful application result. The locally ignored `live/run-result.json` retains receipts and public account addresses; `live/private/` contains disposable signing keys and signed transaction recovery records with restrictive permissions. Never upload that directory or reuse those accounts outside Studio.

Each label is reserved before broadcast, with the signed transaction hash. Repeating it does not broadcast again; changing its request is rejected. If submission times out, query the recorded hash before any recovery. This deliberately avoids automatic retries/new nonces when acceptance is uncertain.

The evidence root is pinned to published commit `9fd77d5348f183b62239bfd4c37e98c06c760d9d`. Hashes must cover exact downloaded bytes, including trailing newlines. These tiny fictional fixtures exercise plumbing and failure cases, not vendor due diligence or a representative accuracy benchmark.

## Full purchase/challenge/replacement experiment

```sh
python live/full_flow.py
```

This separate, resumable run uses richer fictional documents pinned to `ab196d305ccc27446058b67139771ce38d42e9b6`, its own fresh agreement, and keys under `live/private/full-flow-v1/`. It does not overwrite the earlier experiment. Its journal is the ignored `live/flow-result.json`. Run only one instance at a time; re-running resumes completed checkpoints without redeploying or paying twice.

The predeclared sequence is three approved offers → early-payment rejection → inference-only challenge → disputed-payment rejection → negative resolution → cancellation → fresh compliant replacement → unaffected and replacement payments → replay rejection. The unchanged ten-minute review windows use actual time, so the run takes minutes, not a fast-forwarded demo. Unexpected model verdicts, state mismatches, or uncertain submissions stop the run for inspection.

Funding is a single 0.100 GEN request to the Studio sandbox faucet, after verifying empty buyer, recipient and contract balances. No real assets or owner wallet are used. Each nonzero transaction is limited to an exact eligible buyer payment, to a recipient generated by this run, after its review period. The adapter bounds total submitted value to 0.100 and checks buyer balance before signing; expected successful payments total 0.080. It refuses implicit funding or ambiguous faucet retries.

A payment is verified only when recipient gain and buyer debit match the exact amount, unrelated recipients are unchanged, and contract balance is zero. All transaction finality is checked before marking the experiment complete. `SCHEDULED` alone is not delivery. The Studio ledger remains a simulator, not a real-token or Bradbury settlement claim.

After completion, `python live/export_flow.py` prints an allowlisted public report containing transaction IDs, judgments, state transitions and balance checks. It refuses to label an unfinished run complete and never reads signing keys. Keep raw journals and private recovery records out of Git.
