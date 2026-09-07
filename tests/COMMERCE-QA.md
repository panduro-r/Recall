# Custom-purchase validation — September 7, 2026

This is a new two-party contract version. The original four-role contract and its recorded payment are unchanged. Their network evidence must not be attributed to this new version.

Completed checks:

- Direct-VM contract tests with explicit model fixtures: role separation, exact payment value, review/expiry limits, changed terms, cancellation, replacement, and replay prevention.
- Offline RPC adapter tests: unsigned deployment/calldata, recipient/amount checks, chain/router/gas drift, source matching, field/amount bounds, outsider refusal, and closed-payment states.
- Wallet/controller tests: intent matching, pre-sign persistence, cross-tab lock, rejection, unknown outcome recovery, and linked recipient-transfer evidence.
- Isolated browser, fake wallet and intercepted commerce API: acceptance → assessment → approval → changed terms → negative reassessment → cancellation → replacement → assessment → approval → payment. Ten simulated writes, no real network transaction, no console errors.
- Actual Studio read-only deployment preparation for the new source succeeded: chain 61999, gasless router, zero value, gas estimate 0x7a120. No signature or broadcast.

Still required: the buyer and supplier must complete a fresh wallet-approved Studio run against this exact contract source. Assessments check written commitments only; they do not establish real-world performance or legal compliance.

Browser fixture code is test-only and excluded from the deployment manifest. Use a fresh isolated browser context and loopback host only.
