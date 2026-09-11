# Provider review v3 — local correction, live validation outstanding

## Recorded evidence

Read-only inspection of transaction `0x77b9f044eb9a2740ec0adeb30781fce5ce7f26431e6efaf11fb23c72857d3329` on GenLayer Studio. The submitted v2 source fingerprint is `3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017`; the evidence fingerprint is `4f78608d2fbafda2deff2fb1778efcbb592b374f27c08e227bc1e0b43f146b17`.

The saved `consensus_history.consensus_results[*].leader_result` entries contain base64-encoded `eq_outputs["0"]`. After decoding the successful-return prefix and calldata, the proposed decisions are:

| Round | Leader model | Service finding | Training finding |
| --- | --- | --- | --- |
| 0 | anthropic/claude-sonnet-4.6 | SUPPORTED | SUPPORTED |
| 1 | policy:prd-sonnet | SUPPORTED | SUPPORTED |
| 2 | policy:prd-qwen | NOT_ASSESSED / INVALID_CITATION | SUPPORTED |
| 3 | policy:prd-mistral | NOT_ASSESSED / INVALID_CITATION | SUPPORTED |

The final round has two agree and three disagree votes, with `FINALIZED / MAJORITY_DISAGREE`. These proposals are not accepted provider findings. No usable deployed review snapshot exists.

Two demonstrated defects in the application design:

1. Models had to reproduce exact quotations, source IDs and quote-length bounds. Two proposed service findings failed that validation. The original malformed citations were discarded by normalization, so the trace does not reveal whether each failure was a copied-text mismatch, unknown source, missing quote or malformed citation. Comparing the per-condition failure code with successful independent findings necessarily rejects agreement.
2. The service rule combines API access, pre-recorded audio, English and single-channel support. Round 0's reasoning explicitly inferred single-channel support from the absence of a restriction, despite the prompt requiring explicit evidence. A clearer rubric must distinguish missing evidence from support or contradiction.

The public trace does not contain every validator's independent answer. It cannot prove which individual disagreement was semantic versus technical. Do not claim citation handling was the sole cause, or that rerunning this transaction would succeed.

## Local v3 correction

Source fingerprint: `3b2dfc95d5cb328b1c9b154138ce17e27dbcddb18fb0582f5f94d6cd8489ab93`.

- Full captured documents are deterministically divided into overlapping passages of at most 480 characters. No source filtering, paraphrasing, whitespace rewriting, truncation or fresh web fetch occurs in the contract.
- Models select document and passage IDs. The contract resolves those IDs to exact source text. Unknown or malformed IDs fail closed. A validator also rejects leader quotations that are not canonical passages.
- The decision rubric explicitly requires all four service aspects for a supported result. Missing details remain inconclusive, not refuted. Documented default training behavior is distinguished from unverified customer account settings.
- Validators still independently perform the assessment and must match the per-condition verdict and diagnostic code. Different valid citations or explanation wording can agree. Technical failures cannot agree with successful or inconclusive findings; uncertainty cannot agree with support.
- Existing v1 and v2 source/version pairs remain read-only compatible. New preparation uses v3 only. Old evidence and failed transactions are not rewritten or resubmitted.
- Browser validation supports v3 and Unicode quote bounds. Failure messaging is consistent across the main panel, sidebar and review history; the duplicate capture action is removed.

The independent-answer/decision-field comparison remains consistent with [GenLayer's documented equivalence patterns](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle). This is not a relaxation of consensus to obtain a positive provider result.

## Verification

- 377 Python tests, including local socket checks, passed.
- 115 Node tests passed.
- Local browser checks: 16 wallet/recovery checks; 30 display checks each for v2 and v3; 14 full-flow checks with a fake wallet and fake RPC. No real approval or transaction occurred.
- Passage tests cover all source characters up to the 64,000-character document bound, punctuation/markdown/Unicode, unknown IDs, different valid references, forged leader quotations, and genuine independent decision disagreements.
- Vercel's bundled analyzer recognizes the generated Python handlers and static assets.

These are deterministic regression tests with explicit model fixtures, not live multi-model consensus. v3 has not been published or wallet-approved on Studio. The prior failed review cannot be repaired in place. After separate release approval, one explicitly consented new review is needed to validate live behavior; success is not presumed. No automatic retry, appeal, signer or payment is introduced.
