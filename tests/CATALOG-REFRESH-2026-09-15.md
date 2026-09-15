# Catalog refresh — September 15, 2026

Scope: the four transcription plans last reviewed September 8. Other plan
dates and all saved review payloads, receipts and contract source remain unchanged.
This is an editorial catalog check, not a new GenLayer assessment or a test of
provider accuracy, account settings or billing. No wallet transaction was made.

## Source-backed decisions

| Plan | Published prerecorded rate | Decision |
| --- | --- | --- |
| AssemblyAI Universal-3.5 Pro | $0.21/hour; speaker labels $0.02/hour extra | Keep the base estimate and required opt-out/price confirmation. |
| Deepgram Nova-3 monolingual PAYG | $0.0043/minute; speaker labels included | Correct the speaker-label surcharge from unknown to zero for prerecorded audio only. No-training pricing remains unconfirmed. |
| Gladia Growth | From $0.20/hour; upfront commitment | Keep quote-needed status and documented automatic training exclusion. |
| Gladia Starter | $0.61/hour; speaker labels included | Keep the default-training warning; clarify that advertised paid-plan opt-out is not proof it is enabled for Starter. |

AssemblyAI's [pricing](https://www.assemblyai.com/pricing) and
[opt-out policy](https://support.assemblyai.com/articles/5930031898-how-to-opt-out-of-data-sharing-for-model-training)
still distinguish paid opt-out, confirmation before it takes effect, no
retroactive exclusion, and loss of model-improvement discounts. Batch and model
selection documentation were also retrieved; streaming rates were not substituted.

Deepgram's [pricing](https://deepgram.com/pricing) distinguishes prerecorded
speaker labels (included) from streaming (priced separately). The
[model-improvement documentation](https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program.md)
requires the opt-out parameter on relevant requests, but these sources do not
establish the account's resulting no-training rate. At 100 hours, the catalog
base estimate remains $25.80 with or without prerecorded speaker labels; selecting
no training still requires confirmation.

Gladia's [pricing guide](https://support.gladia.io/article/understanding-our-transcription-pricing-pv1atikh8y9c8sw7sudm3rcy)
and [current pricing page](https://www.gladia.io/pricing) support the rates and
Growth commitment. The [integration guide](https://www.gladia.io/blog/gladia-async-transcription-integration-guide)
explicitly permits Starter training by default and excludes Growth. The current
pricing introduction advertises paid-plan data opt-out, without explaining
Starter activation or effective timing. The catalog now exposes both sources
and asks for confirmation rather than assuming a configured exclusion.
Free-credit descriptions differ across the pages; no free credits are deducted
from recurring estimates.

## Retrieval and compatibility

Eleven unique fixed official documents were retrieved through Recall's actual
bounded text extractor on September 15, 15:16–15:30 UTC. All returned readable,
complete text within the existing per-document limit. Local capture artifacts
retain retrieval timestamps, byte counts, raw SHA-256 and extracted-text SHA-256.
Successful retrieval alone did not renew any date; the decisions above did.

The global September 8 fallback date is deliberately unchanged. Only these four
plans receive September 15 overrides. Gladia's previous two-source sets remain
allowlisted for historical reading; new captures add the current pricing page.
No historical source URL is replaced. Old snapshots keep their original dates,
prices, documents and receipts. Preparing a stale snapshot still fails before
any Studio call, requesting a separate capture rather than modifying history.

## Regression checks

- Comparison tests cover included prerecorded speaker labels, conditional
  no-training costs, Gladia's commitment/default-training caveats, freshness and
  exported report calculations.
- Historical reading tests preserve all four plans' old snapshots and matched
  receipts; preparation tests reject stale metadata without contacting Studio.
- A discovered v6 presentation omission is fixed: partial/failed technical
  assessments retain those states instead of being labeled completed. Tests
  cover v5 and v6, exact receipt validation and non-mutating presentation.
- Offline disposable-wallet tests now isolate their fixture pins from the live
  spent authorization. The live runner and its pinned policy are unchanged and
  reject the refreshed catalog before accessing a signer or network.

The unfamiliar-participant usability test in `submission/usability-check.md`
has not been performed. Automated tests do not establish user comprehension.
