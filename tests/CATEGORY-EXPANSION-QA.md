# Two-category release — September 14, 2026

Status: implemented and tested locally; owner authorized publication on September 14. The release must pass production checks separately. No v5 review was submitted to Studio. Existing verified v3/v4 records remain unchanged.

## Implemented

- Transcription: nine plans from eight providers. Adds ElevenLabs Scribe v2 and Fish Audio transcribe-1.
- Speech generation: three plans from three providers — ElevenLabs Flash v2.5, Fish Audio s2.1-pro, Deepgram Aura-2.
- Twelve plans across eight distinct providers overall. Providers appearing in both categories are counted once.
- Speech requirements are English standard-voice API generation, monthly characters, USD budget, optional no-training and streaming. No voice cloning, voice-agent orchestration, quality ranking or measured latency claim.
- Separate, validated billing units: audio time, characters, UTF-8 bytes. Unknown byte volume produces a 1–4-byte-per-character range, not a single quote. An entered byte volume is retained in requirements and exports.
- Category-aware comparison URLs, shortlist, review handoff, findings and portable reports. Older transcription requests retain their original schema.
- v5 review conditions are speech API, English speech, optional training and streaming; transcription retains the v4 atomic service checks. Only source-matched legacy versions 1–4 are accepted for read compatibility.

## New source and price checks

Read-only public source checks used the real capture and validation pipeline. Every document for each new plan was retrieved completely, under the 64,000-character per-document bound; every combined snapshot stayed below 180,000 bytes. No redirects were followed: explicit official Markdown destinations replace redirecting documentation URLs.

| Plan | Catalog billing basis | Complete sources | Captured payload bytes |
| --- | --- | --- | --- |
| ElevenLabs Scribe v2 | $0.22/audio hour | 3/3 | 36,767 |
| Fish Audio transcribe-1 | $0.36/audio hour | 4/4 | 73,316 |
| ElevenLabs Flash v2.5 | $50/million characters | 4/4 | 40,353 |
| Fish Audio s2.1-pro | $15/million UTF-8 bytes | 4/4 | 69,919 |
| Deepgram Aura-2 | $30/million characters | 4/4 | 98,635 |

Prices were checked against [ElevenLabs API pricing](https://elevenlabs.io/pricing/api), [Fish Audio API pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits), and [Deepgram pricing](https://deepgram.com/pricing). These are dated catalog inputs, not quotes for the user's account; taxes, credits, extra features and negotiated prices are excluded.

ElevenLabs documents prospective account-level model-improvement opt-out. Deepgram documents request-level opt-out with applicable pricing to confirm. Fish Audio's reviewed general privacy text does not establish an API-specific no-training commitment; the catalog therefore marks it unknown. Complete retrieval does not prove that every capability or policy can be conclusively assessed. In particular, model-specific English support and single-channel input may remain unknown if the captured text does not establish them.

## Local verification

- 202 Node tests passed, including eight new category tests.
- 432 Python tests passed; two existing opt-in checks skipped.
- New direct-VM v5 fixtures check exact speech finding IDs, selected conditions, citations, conditional setup, invalid units and cross-category rejection. These are synthetic model responses, not live consensus.
- Real browser checks on isolated localhost origins with all API routes disabled: nine transcription plans; switch to three speech plans; mixed shortlist; category-correct return from saved options; side-by-side selection; URL reload persistence; review handoff and return; exact byte-volume repricing; visible optional wallet controls.
- Inspected desktop and 390px mobile layouts. The category switch and side-by-side layout remain usable without page-level horizontal overflow.
- Synthetic v5 review display shows speech API, English, training setup and streaming, retains the UTF-8 price range and source details, and does not label setup completed.
- Generated an allowlisted deployment artifact using `hosting/build.mjs`. Local preview fixtures are not runtime assets.

## Remaining release gates

1. Publication authorized on September 14; deploy the complete matching frontend, backend, catalog and v5 source together.
2. Verify production asset hashes and v5 config after deployment. Do not overwrite historical reviews or resubmit their transactions.
3. Owner approves one new speech-generation review in Studio; inspect the finalized receipt, exact evidence digest, v5 source and category-specific findings. A failed or inconclusive result must stay visibly distinct from support.
4. Run an uncoached comparison task with an unfamiliar person. Capture actual observations before presenting usability as validated.
5. Update the hackathon draft and recording to the deployed, verified scope. Do not present the synthetic test result as provider evidence.
