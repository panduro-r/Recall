# Live-test preparation

The preflight script sends only public metadata queries to the fixed official stable Studio RPC. It does not send contract source, create accounts, request faucet funds, sign messages, or submit transactions. It stores a local source hash only for identifying the candidate under test.

```sh
python live/preflight.py
```

The September 5 check confirmed chain ID 61999. However, this endpoint returned a zero address for `ConsensusMain`, no `ConsensusData`, and no `sim_getFeeConfig` method. These are compatibility flags, not grounds to substitute network IDs, send to the zero address, or assume the endpoint supports the installed SDK's full deployment/settlement path. Check the recorded metadata in `preflight-result.json` before proceeding. The public Studio UI also describes a sandbox with limitations; hosted model execution must not be presented as proof of decentralized Bradbury settlement.

## Source publication and account boundary

The initial preflight was metadata-only. The project owner subsequently authorized publishing the Recall project and testing its contract with separate development accounts. The preflight command remains metadata-only; it does not deploy merely because source publication has been authorized.

Resolve the current endpoint/tooling compatibility, verify pinned evidence bytes, then deploy a new isolated test instance. Never treat an empty or zero deployment address as a usable EVM contract without understanding the target's simulator transport. User-wallet signatures remain a separate handoff; private keys should never be requested in chat. Generated development keys must be kept in `live/private/`, excluded from Git and logs, and never funded with real assets.
