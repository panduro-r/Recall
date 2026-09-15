# Text generation category — September 15, 2026

This expansion adds five text-generation providers, bringing the catalog to
17 plans across 13 providers: 9 transcription, 3 speech generation and 5 text
generation. Comparison, saved options, public evidence capture, review JSON
export and offline comparison reports are implemented. Commit
`20e03808c2fe7faf4c4116e576770960e43c0d02` is published and production-checked;
the final section records the hosted observations separately from local tests.

## Scope and first-party sources

Costs use monthly uncached input tokens plus all billed output tokens, including
billed reasoning/thinking. Requests are text-only, up to 128k input tokens per
request, using standard paid inference. Tools, media, caching, cache storage,
batch/priority tiers, tax and negotiated discounts are outside the estimate.
Tokenizers and quality differ; the same token allowance is not an identical
workload or performance benchmark. Prices are dated, manually checked catalog
facts, not model-generated quotes or authenticated account settings.

| Provider / selected API model | USD per million input / output | No-training boundary |
| --- | --- | --- |
| OpenAI GPT-5.4 mini | 0.75 / 4.50 | API training off unless opted in; not zero retention |
| Anthropic Claude Haiku 4.5 | 1.00 / 5.00 | Commercial API default; feedback/opt-in exceptions remain |
| Google Gemini 3.8 Flash | 0.75 / 3.75 | Paid project with active billing, not unpaid services |
| Mistral Small 4 | 0.15 / 0.60 | Separate API opt-out required; effective settings/price not verified |
| DeepSeek V4.1 Flash | 0.30 / 1.20 | API-wide no-training commitment not established |

Google's selected paid rate is documented through December 31, 2026; the
announced January 1, 2027 rate of 1.50 / 7.50 is retained in the plan's price
note. The seven-day stale-catalog rule prevents an old rate silently remaining
a fresh fit. DeepSeek uses peak/cache-miss rates and assumes no off-peak saving.
Mistral's selected model-specific streaming support is unconfirmed, so selecting
streaming keeps the plan conditional even without a no-training requirement.

Sources checked:

- OpenAI: [model and prices](https://developers.openai.com/api/docs/models/gpt-5.4-mini),
  [API data controls](https://developers.openai.com/api/docs/guides/your-data).
- Anthropic: [prices](https://platform.claude.com/docs/en/about-claude/pricing),
  [training policy](https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training),
  [streaming](https://platform.claude.com/docs/en/build-with-claude/streaming).
- Google: [prices](https://ai.google.dev/gemini-api/docs/pricing),
  [paid/unpaid terms](https://ai.google.dev/gemini-api/terms),
  [text and streaming](https://ai.google.dev/gemini-api/docs/text-generation).
- Mistral: [prices](https://docs.mistral.ai/inference/pricing),
  [API opt-out](https://help.mistral.ai/en/articles/455207-can-i-opt-out-of-my-input-or-output-data-being-used-for-training),
  [model](https://docs.mistral.ai/models/mistral-small-4-0-26-03),
  [chat API](https://docs.mistral.ai/studio/conversations/chat-completion).
- DeepSeek: [prices](https://api-docs.deepseek.com/quick_start/pricing/),
  [privacy scope](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html),
  [Responses and streaming](https://api-docs.deepseek.com/api/create-response/).

## Evidence-capture results

At 16:25 UTC, direct fixed-source reads retrieved 13 of 15 sources with complete
extracted text. Canonical payloads validated within the 180,000-byte bound:
Anthropic 93,254 bytes, Google 109,345, Mistral 20,465, DeepSeek 49,069.
These figures describe that capture, not guaranteed future availability.

OpenAI's two pages were readable through official documentation search but
returned HTTP 403 to Recall's direct reader; documented Markdown alternatives
also returned 403. No access control was bypassed. Its capture retains the
unavailable status and original source links, not invented replacement text.
The UI explicitly warns when text sources could not be captured.

## Assessment boundary

The v6 audio contract SHA-256 remains
`e52b576dbe52ea11b0be8ee6869fc68cce63893f99f4e0588a52d45461deddf3`.
No contract was deployed, no wallet was accessed, and no new Studio review was
submitted for this expansion. Both the UI and server reject text assessment;
the server guard runs before any Studio RPC. An audio v6 result cannot be
accepted as a text assessment even when receipt identity matches. Existing
audio assessments and the failed v5 Fish record remain unchanged.

## Local verification

- 217 JavaScript tests passed, including new text unit, price, policy, link,
  mixed-shortlist, export, evidence-integrity and unsupported-assessment tests.
- 592 Python tests passed in the standard sandbox. Two localhost tests skipped
  there passed separately with loopback permission: 594 Python tests total.
- Source dates and historical wallet-test artifact pins were not bulk updated.
- Isolated browser: 2,000,000 input / 500,000 output tokens gives Google 3.38 USD
  and OpenAI 3.75 USD. Side-by-side selection, both counts, no-training, streaming
  and the saved OpenAI option survive reload. No wallet connection is required.
- Google evidence capture retrieved all three sources; its only request was
  `op: capture`. The saved row has no assessment session. Returning to comparison
  preserves the pair and every requirement.
- Actual mobile emulation at 390 × 844 reports both viewport and document width
  as 390 on the evidence page. No provider account or payment was involved.

## Production verification

- Production: https://recall-navy-phi.vercel.app; immutable release:
  https://recall-4m08lxiac-pduro-s-projects.vercel.app.
- GitHub Production deployment `6464095397` reported success at
  `2026-09-15T17:00:16Z` for the exact release commit above.
- `hosting/check-live.mjs` passed 76 checks at `2026-09-15T17:03:04.829Z`:
  exact assets/catalog, routing and origin guards, unchanged v6 source and
  historical receipts. The failed v5 Fish run still has zero accepted findings;
  its successful v6 replacement still leaves training protection unknown.
- Real Vercel CLI analyzer: one Python function, eleven explicit rewrites and
  65 runtime files. No new API wrapper, runtime dependency or signing key.
- Public production capture at 17:04–17:07 UTC retrieved all 15 sources with
  complete text: OpenAI 47,374 payload bytes, Google 109,419, Anthropic 93,185,
  Mistral 20,381 and DeepSeek 49,003. All payload fingerprints and category
  requirements validated. These were `capture` operations only, with no
  preparation, wallet access, transaction or assessment session.
- OpenAI's successful Vercel capture supersedes the earlier local availability
  concern, not the observation that local requests returned 403. No bypass or
  fallback summary was used. Availability is environment- and time-dependent.
- Live isolated browser, 390 × 844: third category and all five plans visible,
  document width 390, wallet connection visible, no console warnings or errors.

Next: a separately validated text-specific assessment rubric with explicit
consent for any new live test, followed by an uncoached usability check.
No claim of broad accuracy, user adoption, load-tested scale or hackathon outcome.
