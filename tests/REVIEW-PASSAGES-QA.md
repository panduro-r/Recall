# Readable cited passages

Verified September 12, 2026. Display-only change; assessment rules, captured evidence, contract source and wallet actions are unchanged.

## Behavior

- Findings remain visible; named source rows open the cited passages on demand.
- Citations from the same source are grouped within each finding. Every quotation is retained.
- A reading passage can extend to nearby line boundaries in the saved source (up to 240 characters on either side). Long lines use a bounded word-boundary fallback and ellipses. Added context is disclosed, never presented as a new assessment.
- Markdown headings, bullet lists, emphasis and link labels get a plain-text reading view. Unsupported syntax stays literal. No quote HTML is executed, no images are loaded, and only the catalog-validated source page is linked.
- Exact saved quotes remain available verbatim, including formatting and cut-off boundaries. Exports, fingerprints, receipts and original source text do not change.

## Checks before publication

- All 146 Node tests passed, including nine passage-formatting tests and the build-manifest test.
- Five local review asset-route checks cover exact content and JavaScript/CSS MIME types, including the new reading-view module.
- Sixteen isolated browser checks passed using the supplied Speechmatics passages and a synthetic local receipt.
- The same sixteen checks passed on the final artifact with adversarial HTML and link fixtures. No real wallet or Studio calls were made.
- Desktop (1280px) and mobile (390px) inspected. Named source disclosures, paragraph/list layout and exact-quote expansion work; no horizontal overflow. Wallet control remains visible.
- Exact Vercel CLI 59.11.7 builder discovery passed for the final artifact.

These checks do not reassess a provider or endorse additional context as a validator finding. Live publication verification is recorded separately after deployment.
