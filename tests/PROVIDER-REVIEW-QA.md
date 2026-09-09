# Provider review checkpoint — September 9, 2026

## Preview implementation

- Comparison → selected plan and requirements → dated evidence capture → optional Studio assessment → saved result.
- No supplier invitations, unsigned reply links, checkout or payments in this path.
- Data-sharing confirmation precedes Studio preparation; wallet approval is separate. The page also discloses that capture uses Recall’s server.
- Fixed first-party URLs only, no redirects, 4 MiB response bound, 64,000 extracted characters per document and 180,000 UTF-8 bytes per review.
- All six providers’ two source documents were retrieved without extracted-text truncation in the public read test. Payloads ranged from about 11 KB to 63 KB. Extraction omits scripts/navigation and cannot evaluate interactive settings. Retrieval is not a semantic review.
- Immutable review-only constructor uses GenLayer nondeterministic consensus. It stores the exact input digest, per-condition findings and literal source quotations. Conditional, missing and malformed evidence cannot authorize a purchase; there are no purchase methods.
- Catalog-based USD estimates are separate. Token estimates, opt-out configuration and stale evidence cannot become a confirmed fit because a model returned a positive finding.
- Separate local review and transaction stores; pre-request recovery persistence, exclusive submission lock, exact source/account/arguments/receipt matching, no automatic retries. Disconnect remains available while a transaction is awaiting its receipt.
- User-initiated rechecks retain the previous snapshot and show added/removed extracted text. A changed fingerprint is not automatically a changed-policy verdict.

## Checks completed

- 100 Node tests, including 10 new review-model/journal tests and all purchasing regressions.
- 325 Python tests, including local direct-VM constructor consensus with explicit LLM fixtures, negative/malformed/missing evidence, immutable changed-terms review and unsigned adapter guards. Two socket tests are run separately with loopback permission.
- Isolated mobile 390 × 844 and desktop 1360 × 1000 browser flows. Fixture-wallet sequence checks data-sharing confirmation, connection without submission, discard review, one submission, pending recovery, disconnect, matching result, no duplicate submission, new snapshot comparison, preserved old evidence and other app storage. These are not real network signatures or model judgments.
- Existing comparison’s 13 browser checks pass, including pricing caveats, modal focus, storage failures and preserved purchase data.
- Following explicit user approval, live read-only preparation passed on Studio chain 61999 for Soniox (10,919-byte evidence payload) and Speechmatics (45,796 bytes), with the public test account and requirements of 100 hours/month, $50 budget and no model training. Speechmatics also passed through the local browser API. Both prepared zero-value requests; nothing was signed or broadcast. The earlier HTTP 503 did not recur; its original cause remains unconfirmed.

## Release and live-validation gates

1. Publish only as an explicitly labelled Studio preview. The compatibility checks above are not live model validation. Verify the new route, API guards and existing payment/proof routes against the exact deployment.
2. With approval to share the test brief and public evidence, repeat unsigned preparation through the hosted endpoint. This does not authorize signing or broadcasting.
3. Before claiming live-validated assessments, obtain a separate explicit user wallet approval for one review deployment and verify the finalized state, source/arguments, literal quotations and outcome. No review contract has been deployed yet. Do not remove the preview notice based on a preparation check or fixture test.

Stable Studio chain 61999 only. The adapter rejects changed router signatures rather than treating zero EVM gas price as proof that a fee-enabled protocol is free. Studio-dev/Bradbury fee profiles are not implemented. The existing two-party changed-terms payment-blocking test remains separate and still needs its own fresh hosted validation.
