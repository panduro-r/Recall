# Recall — builder overview

Recall helps developers choose an API service using both cost and documented constraints. A cheaper service may require a training opt-out, an enterprise agreement, or features not covered by the quoted plan. Recall makes those tradeoffs visible before the user commits.

## Working product

The catalog covers transcription, speech generation and text generation: 17 plans from 13 providers. Set a workload, budget and data-use requirements; compare plans, inspect public sources, save a shortlist and export a decision brief. This path needs no wallet and does not require contacting each supplier.

Provider reviews save an immutable evidence snapshot with fingerprints. The deployed audio-assessment baseline uses GenLayer Studio Next (61997). Users separately approve any public submission in their own wallet. Results distinguish documented support, required setup, conflicting evidence and missing evidence. Receipt confirmation establishes transaction execution, not service quality or provider delivery.

## Why GenLayer

The core judgment is semantic: do these provider documents satisfy this user's requirement, including exceptions and setup conditions? Catalog arithmetic alone cannot answer that. GenLayer executes the assessment in an intelligent contract. In the new candidate, validators independently reproduce each condition's decision and audit its selected evidence. The app does not replace that judgment with an off-chain score.

## Current release boundary

Text-generation comparison and evidence capture work for all five catalog plans. An optional, explicitly experimental Studio Next v25 assessment is enabled for OpenAI, Mistral AI, DeepSeek, Anthropic and Google. The candidate stores a fixed decision summary plus exact source quotations rather than model-written explanations. This removes invented explanation text, not the possibility of an incorrect semantic decision. The [Anthropic Haiku test](studio-next-v25-anthropic-explicit-policy-2026-09-25.json) and [Google paid-service test](studio-next-v25-google-paid-2026-09-25.json) finalized with manually checked citations. Google's documented paid-service protection requires active Cloud Billing that Recall cannot verify. Historical v26 results remain read-only; its [Speechmatics case](studio-next-v26-speechmatics-2026-09-24.json) exposed conflicting policy evidence. These cases do not establish general provider accuracy or production release clearance.

One historical OpenAI test had a successful transaction but an incorrect citation attribution. The app now withdraws that exact result from usable findings while preserving its original record and disclosing the defect. Other records are not rewritten.

## Demo path

1. Open [Recall](https://recall-navy-phi.vercel.app/compare).
2. Select a category and enter the workload and budget.
3. Compare two plans under the same requirements. Show pricing caveats and data-use conditions.
4. Open a provider's evidence and capture a snapshot without a wallet.
5. For an audio plan or one of the five enabled text plans, connect a wallet only if a new public Studio Next assessment is wanted. Show the deposit, zero provider payment and experimental label before approval. For Google, confirm active Cloud Billing separately.
6. Inspect the findings and their actual source quotations. Export the saved review or a comparison brief.

No provider checkout, automated supplier negotiation, legal-compliance guarantee or real-world delivery verification is claimed. The separate purchase pages are test-token experiments, not purchases from catalog providers.

## Remaining release gate

Keep the existing audio-assessment writer while the v26 candidate is evaluated across the still-unrun provider cases and the integrated flow is verified. The Speechmatics failure is fixed for its frozen evidence only; earlier stopped test allowances remain stopped. Do not treat local tests or one successful transaction as clearance for all categories. See [completion status](completion-status-2026-09-17.md) for exact source pins and preserved results.
