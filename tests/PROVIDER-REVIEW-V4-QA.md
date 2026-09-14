# Structured provider review v4 — September 13, 2026

## Scope

The supplied AssemblyAI v3 result finalized successfully but said single-channel evidence was missing despite an explicit passage in its captured batch guide. Its training condition assessed default exclusion only. A required opt-out was therefore a contradiction of that older condition, not proof that the provider could never satisfy a no-training requirement.

Version 4 makes API access, prerecorded audio, English, and single-channel support four separate findings. Each finding retains its own explanation and exact source citations. A lexical navigation index points to relevant passages, including negative language and exceptions; the full source text remains available, unfiltered. Keywords never produce verdicts. This improves structure and evidence discoverability; it does not guarantee that an LLM will reason correctly.

Training or speaker requirements may return `CONDITIONAL` only for an explicitly documented path on the selected plan. This requires verified source references and one to four bounded setup steps. It cannot become `SUPPORTED` merely because an opt-out exists. Missing or ambiguous applicability remains `INCONCLUSIVE`; explicit incompatibility remains `REFUTED`. Technical failures remain `NOT_ASSESSED`. Independent validators must agree on every individual verdict and diagnostic code, not just an overall service outcome.

The interface uses Supported / Requires setup / Unsupported / Unknown, with a separate Not assessed state for failures. Required setup is shown with an explicit warning that Recall has not completed or verified it. Its primary button moves keyboard focus to the setup instructions, without submitting or changing the saved record. Catalog pricing uncertainty and provider-account confirmation remain separate. Saved comparison reports retain the individual checks, citations and setup steps.

## Compatibility and safety

- New preparation uses v4 only. Source-hash/version pairs for v1–v3 remain allowlisted for read-only inspection.
- Old evidence, findings and receipts are not upgraded or rewritten. An explanatory note identifies the earlier default-configuration semantics.
- No wallet connection code, signing policy, payment contract, provider source set, price or commercial classification changed.
- All transactions still require explicit user review and wallet approval. Nothing is retried or submitted automatically.

## Verification

- 121 Python tests passed (direct VM, evidence preparation, source/version compatibility, routes and server).
- 189 Node tests passed, including malformed conditional results, independent technical checks, legacy compatibility, saved-index projection, and safe comparison-report rendering.
- 25 isolated browser checks passed across setup, unknown, unsupported, partial, supported and legacy states. Saved records and journals remained byte-for-byte unchanged. No API or wallet calls occurred.
- At 390px, no horizontal overflow; the wallet control remained available; the setup button focused and scrolled to the two-step test instruction block. Desktop and mobile screenshots were inspected. No console errors or warnings.
- The actual public AssemblyAI v3 evidence was read and exercised locally with deliberately inconclusive scripted model output. The new prompt retained all four sources and indexed the previously missed batch passage `p10` under single-channel support. Prompt size was 75,779 UTF-8 bytes. The original v3 record was unchanged. This was not a new model assessment or a Studio transaction.
- Vercel CLI 59.11.7 entrypoint/static discovery passed for the allowlisted release artifact.

## Still outstanding

A wallet-approved live v4 run is required to observe consensus and assessment quality with real model responses. Unit tests use explicit fixtures; browser tests use synthetic receipts. Neither establishes a live verdict, a completed opt-out, service quality, provider consent or payment.
