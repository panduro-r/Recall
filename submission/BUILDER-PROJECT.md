# Recall — builder overview

Recall helps developers choose an API service using both cost and documented constraints. A cheaper service may require a training opt-out, an enterprise agreement, or features not covered by the quoted plan. Recall makes those tradeoffs visible before the user commits.

## Working product

The catalog covers transcription, speech generation and text generation: 17 plans from 13 providers. Set a workload, budget and data-use requirements; compare plans, inspect public sources, save a shortlist and export a decision brief. This path needs no wallet and does not require contacting each supplier.

Provider reviews save an immutable evidence snapshot with fingerprints. The deployed audio-assessment baseline uses GenLayer Studio Next (61997). Users separately approve any public submission in their own wallet. Results distinguish documented support, required setup, conflicting evidence and missing evidence. Receipt confirmation establishes transaction execution, not service quality or provider delivery.

## Why GenLayer

The core judgment is semantic: do these provider documents satisfy this user's requirement, including exceptions and setup conditions? Catalog arithmetic alone cannot answer that. GenLayer executes the assessment in an intelligent contract. In the new candidate, validators independently reproduce each condition's decision and audit its selected evidence. The app does not replace that judgment with an off-chain score.

## Current release boundary

Text-generation comparison and evidence capture work. New text-generation assessments are not yet enabled in the production writer. The unpublished Studio Next candidate removes model-written explanations: it stores a fixed decision summary plus exact source quotations. This eliminates invented explanation text, not the possibility of an incorrect semantic decision; live validation is still required.

One historical OpenAI test had a successful transaction but an incorrect citation attribution. The app now withdraws that exact result from usable findings while preserving its original record and disclosing the defect. Other records are not rewritten.

## Demo path

1. Open [Recall](https://recall-navy-phi.vercel.app/compare).
2. Select a category and enter the workload and budget.
3. Compare two plans under the same requirements. Show pricing caveats and data-use conditions.
4. Open a provider's evidence and capture a snapshot without a wallet.
5. For the deployed audio review flow, connect a wallet only if a new public Studio Next assessment is wanted. Show the deposit and zero provider payment before approval.
6. Inspect the findings and their actual source quotations. Export the saved review or a comparison brief.

No provider checkout, automated supplier negotiation, legal-compliance guarantee or real-world delivery verification is claimed. The separate purchase pages are test-token experiments, not purchases from catalog providers.

## Remaining release gate

Validate the corrected contract on Studio Next before enabling it for all categories, then verify the integrated flow. Earlier stopped test allowances remain stopped. Local tests and successful transactions are not substitutes for that gate. See [completion status](completion-status-2026-09-17.md) for exact source pins and preserved results.
