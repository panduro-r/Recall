# IntentLatch

IntentLatch is a decentralized payment firewall for AI agents. Users define a mandate in plain language, an agent submits a structured payment, and GenLayer validators reach consensus on whether it should be approved, rejected, or escalated for manual review. An approval becomes an exact, requester-bound, single-use permit that releases test GEN only after the execution transaction finalizes.

Built for the **Autonomous Protocols** track of GenLayer Agent Tank.

## Live deployment

- Studionet contract: [`0x692cb9D71acC57C07a72D173aa8a0CDaEc41b6b7`](https://studio.genlayer.com/?import-contract=0x692cb9D71acC57C07a72D173aa8a0CDaEc41b6b7)
- Deployment transaction: `0x574ac07c40b6ad010de114b47af5f892ffe51c91ad7cdc0e471bc2f6942136fb`

The hosted app is already bound to this contract. Wallet approval is required for every write transaction, and only small amounts of test GEN should be used for the demo.

## Why GenLayer

Traditional smart contracts can compare exact values but cannot reliably interpret a mandate such as “renew existing software subscriptions, but never accept an annual plan.” IntentLatch combines deterministic input validation with GenLayer's nondeterministic LLM execution and validator consensus. Only the normalized verdict and reason code must agree; explanatory text may vary.

## Repository structure

- `contracts/intent_latch.py` — GenLayer Intelligent Contract
- `tests/direct/test_intent_latch.py` — direct-mode contract tests
- `deploy/deployScript.ts` — GenLayer CLI deployment script
- `app/` — responsive Next.js application
- `lib/genlayer.ts` — GenLayerJS wallet and contract integration

## Contract API

- `register_mandate(mandate_id, mandate)` creates or updates an owner-controlled mandate.
- `authorize_payment(mandate_id, request_id, action_json)` reaches consensus and issues a single-use permit when approved.
- `execute_payment(request_id)` is payable and transfers the exact approved amount to the locked recipient after finalization.
- `get_mandate(mandate_id)` returns the mandate and owner.
- `get_decision(request_id)` returns the action, requester, and consensus decision.

## Local development

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/genvm-lint check contracts/intent_latch.py
.venv/bin/pytest tests/direct -v
npm install
npm run dev
```

The checked-in app defaults to the live Studionet deployment above. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` to override it; an invalid or missing override never causes the interface to present a local preview as an on-chain result.

## Deploy to GenLayer Studio

Deploy `contracts/intent_latch.py` through Studio or install the GenLayer CLI and run `npm run deploy:contract`. To point the app at a different deployment, create `.env.local` from `.env.example` and set:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT
```

Restart the web app. The interface will switch from **Contract preview** to **Studionet live**, request a wallet connection, save the mandate, issue an authorization decision, and enable the exact-value execution transaction only when the permit is ready.

## Deploy the app to Vercel

Import this repository into Vercel, keep the framework preset on **Next.js**, and deploy from the repository root. No environment variable is required for the checked-in Studionet contract. Set `NEXT_PUBLIC_CONTRACT_ADDRESS` only when targeting a different deployment. Vercel supplies the production origin automatically; for a custom domain, set `NEXT_PUBLIC_SITE_URL` to its full `https://` URL.

## Security model

- Mandates and action descriptions are explicitly delimited as untrusted data.
- Unknown or ambiguous permissions default to `MANUAL_REVIEW`.
- Contract inputs are length-limited and action payloads must be JSON objects.
- Only a mandate's original owner can update it.
- Request IDs and approved permits are single-use, preventing overwrite or replay.
- Only the original requester can execute a permit.
- The recipient and native GEN amount are committed during authorization and checked again during execution.
- Transfers are emitted only after the execution transaction finalizes.
- Validators compare normalized `verdict` and `reason_code` fields rather than variable prose.

## License

MIT
