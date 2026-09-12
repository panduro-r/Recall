# Deepgram evidence coverage — 2026-09-12

Verification scope: local implementation and deployment package. Publication is
checked separately. No wallet signature, new Studio assessment or payment was made.

## Sources

The Nova-3 catalog plan now captures its existing pricing and model-improvement
policy plus two first-party technical documents:

- [Prerecorded API getting started](https://developers.deepgram.com/docs/pre-recorded-audio):
  Nova-3 file-transcription requests and a one-channel response example.
- [Models and languages](https://developers.deepgram.com/docs/models-languages-overview):
  Nova-3 model selection and English language support.

The full extracted `.md` sources are captured, not rewritten into favorable claims.
The separate Channels parameter page was not used as mono-file evidence: that
parameter is read for raw streaming input, not the prerecorded file flow.

No price, privacy classification, feature surcharge, plan name or pricing/policy
review date changed. The dated catalog estimate and unresolved no-training pricing
remain distinct from any technical finding. Technical documentation cannot prove
that a user's requests actually use the opt-out setting.

## Compatibility and checks

- The old ordered `deepgram-price`, `deepgram-training` source set is allowlisted
  for reading historical records. New captures/preparations require all four.
- Old payloads, receipts and findings are not rewritten; they cannot endorse the
  new evidence. Existing UI offers a separate updated capture and explains source
  additions as evidence coverage, not an automatic policy change.
- 137 Node tests passed. Python: 378 passed, with two sandbox-blocked loopback tests
  passing separately (380 total). No network tests used wallet credentials.
- An isolated browser ran 18 synthetic Deepgram history/capture assertions. Only
  the fixture's mocked capture operation occurred. No real wallet calls. The
  historical result stayed visible and the new capture stayed unassessed.
- Mobile width 390 px: document width 390, wallet visible, updated-capture action
  visible, logo loaded, no stale notice. No CSS or wallet code changed.
- Vercel CLI 59.11.7 handler and static-builder discovery passed.
- Live public-source capture took 7.77 seconds. All four documents were complete;
  the payload was 96,797 UTF-8 bytes, below the unchanged 180,000-byte limit.

| Source | Extracted characters | Text SHA-256 |
| --- | ---: | --- |
| Pricing | 13,440 | `571b56537e2aa73b8b58d04e552e181f2165a23ee8f052ede448fabf5e98bcd2` |
| Model-improvement policy | 45,541 | `117601d4a24b1abefe0a07d417e47d9d152ea299b8273ef26c0a90a6e7d50271` |
| Prerecorded API | 17,668 | `c725268af44b61b8039bac7255c8eba4f7bf61b3b843a484d198be99a27eddb6` |
| Models and languages | 14,044 | `7121cccc79ea6d6c61aec9778edc14d7c60dc9d706202aeb1239f0dd35e48d01` |

Artifact: `.build/recall-vercel-AzXnVd`.
Contract remains v3 with source SHA-256
`3b2dfc95d5cb328b1c9b154138ce17e27dbcddb18fb0582f5f94d6cd8489ab93`.
A conclusive provider finding remains unproven until a separately wallet-approved
assessment is finalized. Retrieval success is not a compliance or service guarantee.
