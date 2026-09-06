# Fictional evidence corpus

These documents are synthetic development inputs, not statements about real vendors, real contracts, compliance, or legal rights. Use them to test a model's reading of the buyer's explicit criterion. Do not mistake a file hash for proof that a claim is true.

- `inference.txt`, `storage.txt`, `monitoring.txt`: supporting offers.
- `correction.txt`: an applicable contradictory amendment.
- `irrelevant.txt`: a different vendor, not an applicable amendment.
- `replacement.txt`: a fresh supporting alternative.
- `ambiguous.txt`: insufficient evidence of the required guarantee.
- `injection.txt`: adversarial document text, intended to test whether embedded instructions are ignored.
- `flow/`: richer, separately pinned terms and predeclared expectations for the full purchase/challenge/replacement experiment. The one-line supporting offers above do not fully cover that experiment's stronger payload/failover/support criterion.

For live tests, fetch these files from an immutable commit URL and record SHA-256 over the actual bytes, including the final newline. The local harness independently uses inline fixture strings and mocked responses; it does not fetch these files from GitHub.
