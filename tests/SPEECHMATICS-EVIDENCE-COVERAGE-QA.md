# Speechmatics evidence coverage — 2026-09-12

Verification scope: local implementation and deployment package. Publication is
checked separately in the release report. No new Studio assessment, wallet request,
transaction or provider payment was made during this work.

## Change and rationale

The previous Speechmatics review captured pricing and service terms. Its saved
service finding was inconclusive because those sources did not explicitly establish
single-channel input. The assessment rules and that historical result are unchanged.

New captures include two additional first-party sources:

- [Batch Input](https://docs.speechmatics.com/speech-to-text/batch/input): documents
  supported formats, mono WAV, and the Standard model configuration.
- [Batch Quickstart](https://docs.speechmatics.com/speech-to-text/batch/quickstart):
  documents prerecorded transcription with English examples.

Capture uses the official `.md` variants, preserving the full extracted text and
its fingerprint rather than hand-selected quotations. Pricing and terms remain in
the evidence set, including their exceptions. No existing price, policy label or
catalog review date was renewed by adding these technical sources.

## Historical records and user-facing behavior

- `reviewSourceHistory` explicitly allowlists the old ordered two-source list for
  reading. Historical URLs, labels, text hashes and receipt matching still validate.
- New captures and server-side preparation require the current four-source list.
  Arbitrary subsets, reordered sources, foreign providers and modified URLs are
  not accepted as a historical capture.
- A historical record offers **Capture updated evidence**. The new capture receives
  a separate ID, keeps a link to its baseline, and has no assessment until separately
  authorized. Pending transactions are not resubmitted or erased.
- Added/removed documents are described as changes in evidence coverage, not as
  proof that a provider changed its policy. Incomplete captures remain explicit.
- Navigating back to a saved assessment clears the preceding capture’s transient
  notice, avoiding a contradictory “nothing submitted” message on a confirmed record.

## Verification

1. Node suite: 136 passed (`node --test tests/*.mjs`).
2. Python suite: 376 passed; two localhost-binding tests initially skipped by the
   sandbox. Those two passed separately with loopback permission. Total: 378.
3. Isolated browser regression: 18 assertions passed. A synthetic historical v3
   receipt retained its original inconclusive/service and supported/training
   findings. Capturing created a separate four-source unassessed record. The only
   mocked API operation was `capture`; no real wallet calls or Studio requests.
4. Desktop (1280 px) and mobile (390 px): wallet control visible, no horizontal
   overflow, added-source notices and actions readable. The generated deployment’s
   logo loaded correctly. No layout redesign or wallet-session changes.
5. Live public-source capture: all four documents retrieved completely in 6.69 s.
   Payload: 67,462 UTF-8 bytes, below the existing 180,000-byte limit. The new
   input document contained the mono-WAV guidance; the quickstart included the
   English language parameter. This verifies retrieval, not a model verdict.
6. Vercel CLI 59.11.7 handler/builder discovery passed. All 72 deployment-manifest
   hashes matched. Browser and server catalog copies matched local source.

The supplied historical export was no longer available at its original local path
for a new reread. Compatibility was tested with source-bound synthetic historical
records; this pass does not claim a fresh verification of that user transaction.

Live capture text fingerprints:

| Source | Complete characters | SHA-256 of extracted text |
| --- | ---: | --- |
| Pricing | 8,513 | `91cada9e6541c9f4335ede35ad55abbfda7ca4d39114827bf84903db3a9be62f` |
| Service terms | 34,872 | `033c104c6263d50997eb0c107e44784f2d9b66ee4901e4d5022593d8ff4ec0e1` |
| Batch Input | 15,060 | `c622fec6622aaa05105c14f4d979a1336522ce8958c92c29441a0c821f92d6c5` |
| Batch Quickstart | 4,969 | `3f870ffed2127df2e7d120e9754ff987c82db29cc7e4a5ef670ddaa555fc0e65` |

Local deployment artifact: `.build/recall-vercel-qsFghe`.
Contract source remains v3, SHA-256
`3b2dfc95d5cb328b1c9b154138ce17e27dbcddb18fb0582f5f94d6cd8489ab93`.
No assessment rules, thresholds, canonical-passage logic or receipt requirements
were changed. A conclusive new assessment remains unproven until a separate,
explicitly wallet-approved review is finalized.
