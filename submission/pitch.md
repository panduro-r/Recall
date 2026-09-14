# Recall — choose services with evidence

Updated September 14, 2026. The two-category expansion is implemented and publication is owner-authorized. Production checks and the first explicitly approved v5 live review remain separate validation gates. Product positioning is not a claim of adoption, revenue or production readiness. See [the release checklist](../tests/CATEGORY-EXPANSION-QA.md).

## The practical application

Recall is a buying-decision tool for teams choosing digital services. Its first useful job is: **compare the cost of our workload, check the documented conditions we care about, and show what we still need to confirm before committing money or customer data.** It does not transcribe audio itself.

The initial target user is a developer, technical founder or small team selecting a transcription or speech-generation API. An agency choosing an API for a client faces the same decision. These are target users, not verified customers.

A concrete example: a team needs 100 hours of English prerecorded transcription per month, has a $50 budget and does not want its customer recordings used for model training. Recall compares the same brief across providers, distinguishes qualified estimates from incomplete base prices, shows dated public evidence and optional saved GenLayer findings, and exports a brief for a teammate. The existing AssemblyAI result makes training exclusion a setup requirement, not an already-enabled guarantee. The team can identify the specific outstanding question instead of sending an invitation to every supplier.

Practical output: a shortlist, visible caveats, source-backed next steps and a portable comparison report. The intended benefit is less repeated research and fewer surprises from omitted configuration requirements. Time saved and purchase outcomes have not been measured yet.

## Thirty-second pitch

“Picking an AI service means comparing more than its headline price. Recall turns your workload, budget and data rules into a side-by-side comparison. An optional GenLayer assessment checks captured terms and shows what is supported, what requires setup and what remains unknown—with evidence. Share the decision brief with your team before committing. This release covers transcription and speech generation with separate pricing and requirements; the new speech-assessment contract still needs live validation.”

## What GenLayer adds, and what it does not

The catalog comparison is deterministic application logic. GenLayer's optional Intelligent Contract evaluates supplied text using validator agreement and stores findings tied to an exact evidence snapshot. Citation checks bind the displayed passages to that text, and receipt checks bind the result to the reviewed request. The historical payment experiment demonstrates a separate way evidence can affect authorization.

A normal application could also compare prices or generate an LLM summary. Recall's proposed differentiator is a consistent decision record: requirements, price qualifications, source dates, conditional actions and inspectable assessment provenance. That is a product thesis, not a verified competitive advantage. Consensus and an immutable record do not guarantee correct interpretation, authenticate the source origin or prove the provider's behavior. The current provider review does not authorize payments.

## Can it expand to other services?

**Yes in architecture; not by adding names to today's catalog.** Reuse the comparison journey, snapshots, citation display, saved decisions, exports and transaction recovery. Add a tested category-specific requirements schema, cost calculator, allowed sources and assessment rubric.

| Proposed category | Workload model | Examples of conditions to assess |
| --- | --- | --- |
| Speech generation — implemented; v5 live validation pending | Text characters or UTF-8 bytes, optional streaming | Standard-voice API, English output, model-training conditions, streaming availability |
| LLM APIs — future category | Input/output tokens, model, cache usage, batch share | Data-use commitments, retention, supported modality, plan/region applicability |
| Object storage | GB-months, request mix, retrieval and transfer | Required region, storage class, retrieval conditions, deletion commitments |
| Email APIs — later exploration | Send volume, plan limits, overages | API availability, retention, required features; actual deliverability needs separate testing |

The pricing differences are concrete: Anthropic documents separate input/output and cache pricing plus batch adjustments; Cloudflare R2 documents storage, operation and retrieval dimensions. Those facts support separate calculators, not a single universal hourly rate. These are examples of model complexity, **not newly supported integrations or refreshed Recall prices**. Sources checked September 14: [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

The selected second category is speech generation: it serves adjacent developer needs and demonstrates that the architecture handles genuinely different billing units. The local catalog adds ElevenLabs and Fish Audio transcription, plus ElevenLabs Flash v2.5, Fish Audio s2.1-pro and Deepgram Aura-2 speech generation. This is implementation evidence, not demand validation. LLM APIs are deferred. Demonstrate the new category only with an honest publication and validation status.

## What scaling actually requires

Today `ui/service-categories.js` defines separate transcription and speech-generation requirements. `ui/compare-model.js` handles time, character and UTF-8 byte billing without converting speech minutes into text volume. `provider_evidence.py` enforces category boundaries, and `contracts/provider_review.py` uses separate v5 assessment conditions. Historical versions remain readable without rewriting their findings. The prototype also limits the catalog to 50 plans, each review to four documents and 180 KB, and local storage to 20 reviews. These are protective implementation limits, not measured capacity targets. The source-fetch concurrency guard and cache are per process, not a distributed queue. No 100-provider or production-load claim has been established.

1. **Reusable category definitions.** Versioned requirements, units, deterministic price calculators and category-specific assessment checks; preserve readers for old evidence and contracts. Never silently reinterpret saved reviews.
2. **Reliable evidence operations.** Curated provider sources, visible ownership/review dates, change tracking, caching, bounded job queues, rate limits and retries for reads. Reuse identical public captures where appropriate, but do not reuse a verdict across different requirements, source bytes, plan versions or review formats. New assessments still require consent.
3. **Team use.** Authenticated workspace storage, access control and portable saved records; existing local exports are not a hosted collaboration system. Decide data classification and retention before accepting confidential documents. Public on-chain review is not a private contract repository.
4. **Account-aware decisions.** Optional, explicitly authorized read-only integrations to verify effective settings and applicable quotes. Keep documented availability separate from confirmed configuration. Unknown negotiated prices stay unknown.
5. **Operational validation.** Measure capture reliability, model/consensus failure rate, evidence-to-verdict correctness, p95 completion time and cost per usable review. Add per-category adversarial fixtures and expert-reviewed reference cases. The two successful examples are evidence of execution, not general accuracy.
6. **Agent integration later.** A scoped decision API and explicit human/agent spending policy could consume the records. Merchant acceptance, checkout and revocation require separate integrations and tests; neither an autonomous purchasing agent nor an automatic policy monitor is implemented.

## What to validate next

Use [the uncoached task](usability-check.md) with an unfamiliar person before recording. Can they explain why a lower base estimate may not satisfy the brief, find the remaining setup requirement, and share the comparison? Afterward interview several target users about their most recent service-selection decision and whether this output would have changed it. No participant test or demand validation has been completed by preparing this document.

Current verified examples and boundaries are in [the review record](verified-reviews-2026-09-14.json); [the two-minute script](demo-script.md) shows the buyer workflow. Retain the historical payment demo only as a separately labeled appendix.
