# Provider-review v6 candidate — September 14, 2026 (local date)

Status: **one separately authorized v6 live review verified; release authorized**.
Publication and production verification are separate from the live test below.
The original three-attempt allowance and the separate
one-attempt allowance are exhausted. The original wallet policy and journal
are unchanged; the additional test has its own public, one-attempt record.

## Why this change

The [v5 live run](SPEECH-LIVE-QA-2026-09-14.md) completed ElevenLabs and
Deepgram reviews but rejected Fish by consensus. The rejected leader proposal
used an English billing analogy as language evidence. Independent validator
findings are unavailable, so this is a concrete weakness to address, not a
proven explanation of the disagreement.

Fresh first-party inspection found that Fish's
[models overview](https://docs.fish.audio/developer-guide/models-pricing/models-overview)
counts languages for S2.1 Pro but explicitly lists English under the older S1.
These are different models; that claim must not be silently inherited.
The [API product page](https://fish.audio/text-to-speech-api/) places an English
label beside the S2.1 Pro selector and documents API access with library voices.
That is more directly applicable than a pricing analogy, but still supplied
page evidence—not a measured voice-quality or capability test.

Fish's [general privacy policy](https://fish.audio/privacy/) describes service
improvement. That does not by itself settle hosted-API model training of input
text and generated audio. No-training remains unknown in the catalog. Private
voice visibility, advertising opt-outs and self-hosted data isolation are not
silently treated as hosted-API training exclusions.

## Changed behavior and preserved boundaries

- New reviews use format 6. The prompt distinguishes billing examples, sample
  input, website language selectors and language counts from applicable
  supported-language statements or model-linked voice/language listings.
- No automatic transfer of commitments between model versions, free/paid tiers,
  hosted APIs and self-hosted deployments. Missing applicability remains unknown.
- Generic service-improvement language alone is neither explicit permission
  for model training nor an exclusion. Documented applicable opt-outs still
  require setup; no provider-specific verdict is hardcoded.
- Both assessors receive the same clarified rubric. Exact per-condition verdict
  and diagnostic agreement is unchanged. Citation selection still resolves
  exact passages from the complete supplied text. No keyword verdicts, fuzzy
  quote repair, majority-threshold reduction or automatic retries were added.
- Fish's current four-document set replaces `fish-tts` with `fish-tts-product`.
  Pricing, privacy and streaming sources remain. The old ordered source set and
  its original URL/label are explicitly retained for read-only compatibility.
  A new preparation cannot reuse the obsolete capture as current evidence.
- The exact v5 source hash is now a read-only legacy entry. Current source/version
  mismatches still fail closed. Existing v1–v5 reviews are not rewritten.
- The spent test runner retains its original source/catalog pins and budget.
  Local candidate drift blocks further capture/signing; status and existing
  records remain readable. Offline wallet tests use separately pinned temporary
  artifacts, never the real wallet directory or a migrated live policy.

## Exact candidate and read-only source check

Contract SHA-256:
`e52b576dbe52ea11b0be8ee6869fc68cce63893f99f4e0588a52d45461deddf3`

Catalog SHA-256:
`0abb17750afeb21b754ea6a7d260f9edf6d58070bfdf5a7942f333bf45251ad7`

The real `provider_evidence.capture` and `validate_payload` path retrieved all
four documents completely at `2026-09-15T03:15:17.314756+00:00` (September 14
locally). Payload size: 67,026 bytes, below the 180,000-byte limit.
No Studio call or signature was involved. This was an ephemeral retrieval check;
the full snapshot was not saved as a new wallet-run artifact or assessment.

| Source | Extracted characters | Text SHA-256 |
| --- | ---: | --- |
| fish-price | 4,527 | `eb148be928541f894a8eba23e75a55b1febdb647bc4572c4a7e0e811e6677486` |
| fish-privacy | 48,384 | `7ded57854f96e4f332249ffbcfcbd25de1e94fe1acc0dceae7fc7d4d3035a066` |
| fish-tts-product | 5,995 | `cdff84a2ad3a7fa39e1018c9720f5af0e9e37b39782462fb960bebc76e5ed77e` |
| fish-stream | 4,004 | `02d5b706de613d0b75d88f7e7c0abc00913ea8a4c659b2840acb535a30b3eb4e` |

Capture digest: `7ed7b048684b7b8453f97f1728ae5197b6069ae4b39640cebec92e0a83434749`.
Availability and matching hashes do not establish an assessment outcome.

## Candidate validation before the additional live test

- 536 Python tests passed in the standard sandbox run; the two loopback tests
  passed separately with binding permitted: 538 total. 206 JavaScript tests passed.
- Ten new adversarial fixtures check the rubric reaching both independent
  assessors, exact citation preservation and rejection of differing verdicts.
  They use **mocked model responses**, so they test contract behavior and prompt
  wiring, not whether live models will follow the rubric or reach agreement.
- Source/version adapter tests accept exact v5 legacy results and reject v5/v6
  source-format mismatches. Historical Fish source sets remain readable but
  are rejected for new preparation. Future result formats still require an update.
- The three actual public v5 test results were re-read through the candidate
  frontend models: both successful reviews remain valid and require setup;
  Fish remains terminal failure with zero accepted findings. No records changed.
- Built the local allowlisted artifact and checked it with Vercel CLI 59.11.7's
  actual analyzer: exactly one Python function and eleven explicit API rewrites,
  no recursive routing or bundled signer. No upload or deployment was performed.

## Separately authorized live Fish review

The user authorized one additional zero-value, zero-fee Fish review, without
automatic retries. The original signer was reused without changing its original
policy, journal or three-test budget. A separate record pins the exact source,
catalog, account and nonce 3; an exclusive, durable attempt record is written
before broadcast. An uncertain response consumes the attempt too.

All four sources were captured completely again at
`2026-09-15T03:41:48.452095+00:00`. Their text hashes match the table above;
the fresh capture digest is
`7588d6add51af2ec11d62c7069886504b8238ae1ca1d5e7fb121fe81357934d4`.
It differs from the earlier ephemeral capture because capture metadata is bound
into the payload. Neither historical evidence nor the failed v5 review changed.

Transaction:
`0x930a8c532b7267f89ccbac0aa1d239fd4fee5942406ebb39f538ae4517a1cfa0`.
Finalized success with majority agreement was observed at
`2026-09-15T03:48:58.384332+00:00`. The account balance before and after was
1 test GEN; transaction value and gas price were zero.

| Check | Accepted finding |
| --- | --- |
| Speech API access | Supported |
| English | Supported |
| No model training | Unknown / INCONCLUSIVE |
| Streaming | Supported |

The frontend accepted the exact source, version, payload, receipt and citations
and presented **Some checks are still unknown**, with a next step to resolve
open questions or compare alternatives. Enterprise on-premise isolation was not
treated as a no-training guarantee for the hosted pay-as-you-go plan.

The English explanation still mentions the billing analogy, but also cites the
newly captured model-linked English label on the API product page. Its original
explanation and quotes are preserved. This is not a voice-quality test, proof
that every reasoning weakness is fixed, or a general consensus benchmark.
Independent per-validator findings remain unavailable.

The [public verification record](../submission/verified-fish-v6-2026-09-15.json)
contains identifiers, findings and limitations, not the signing key or raw signed
transaction. The new local-only runner has 13 offline safety tests, including
unchanged original journal, preflight drift rejection, single-attempt handling
and uncertain-broadcast behavior. It is excluded from deployment and publication.

Final candidate checks: **552 Python tests passed** (550 in the normal sandbox
run plus two separately permitted loopback tests) and **206 JavaScript tests
passed**. The refreshed artifact passed the actual Vercel CLI analyzer with
one Python function and eleven explicit API rewrites. Its manifest contains no
test signer, wallet key file or new test-run record. Contract and catalog hashes
still match the live-tested pins above. These were local checks, not a deployment.

## Remaining release gates

1. Publish the tested candidate, then verify production assets, current and
   historical formats, and the one-function deployment. Local verification is
   not a completed production release.
2. Broaden evaluation across providers and ambiguous cases. One accepted Fish
   review does not establish general accuracy, account settings or reliability.
   Any additional wallet submissions require new bounded authorization.
3. Run the uncoached user test and complete the demo/submission checks. No
   participant test, video upload or hackathon submission is implied here.
