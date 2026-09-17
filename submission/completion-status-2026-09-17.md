# Recall completion status — September 17, 2026

## Latest: v22 provider batch stopped; exact-citation correction prepared locally

The approved ten-test v22 batch stopped after five deployments. Conflicting-policy, prompt-injection and incomplete-training-scope controls, plus Mistral, passed automatic checks and assistant review. OpenAI finalized successfully and passed its automatic target checks, but assistant review found a false citation attribution: the training explanation attributed endpoint-table values to E25, which contains the header and separator, not the endpoint rows. Consensus success is not proof of accurate citations. This is not a finding against OpenAI.

The five unused slots will not be reused. DeepSeek, Speechmatics, Fish Audio, Anthropic and Google were not submitted. All five results, findings, assistant review notes and transaction identities are preserved in `submission/studio-next-v22-regression-stop-2026-09-17.json`; full receipts remain in the local test journal. Five protocol deposits total 100000000000169410 wei (about 0.10 test GEN); deposits are not final charges. No provider payments or transaction retries were made.

The local v23 correction now removes free-form model explanations rather than relying on another warning to make them reliable. Model proposals contain exactly decision, evidence IDs and setup IDs. The contract supplies a fixed decision summary and resolves quotations directly from the captured bytes. Model-written reasons are rejected, not silently removed or repaired. The independent decision check and native GenLayer evidence audit remain; the audit receives resolved selected quotations plus every captured source for scope, conflicts and absence. This prevents invented explanatory prose, but does not prove every model decision or citation selection will be correct. No decision modes, evidence boundaries, model-call count, consensus boundaries, retries or production settings were changed. Old v22 source and results remain untouched.

Candidate source: `experiments/contracts/provider_review_decisions_v23.py`, SHA-256 `9870f5aa62eea5f1cdf08c35210a233f2d76b87262afaf25c3d8907afd2b3790`; protocol SHA-256 `78b8ed959183c15144ffbb7563ee6bbb869a77c531600ec9482b7634edfaa364`. This candidate has not been uploaded to Studio Next or deployed. Local scripted inference and SDK tests check construction and rejection paths, not live semantic reliability. Live validation is required before switching the production writer. No new GEN was spent during this correction.

Verification: 230 focused Python checks and all 289 frontend checks passed. This includes rejection of model-written reasons, deterministic summaries, exact resolved-citation construction, rejection without repair or retry, unchanged historical v22 assembly, the pinned Studio Next SDK path, read-only adapters, and blocking all five unused slots when manual review fails despite successful execution. The production writer hash remains `e47a3eed7e1235689982b4b4d0b9d2e792ce662babe36210241862a12a3b6d34`.

The app and read API now disclose the exact failed OpenAI transaction as withdrawn for a confirmed citation error. It is withheld from usable findings and comparison reports; its raw snapshot and receipt remain intact, and review exports carry a separate warning. This is scoped to that transaction, evidence fingerprint and protocol, not to OpenAI generally or other successful records. New text assessments are not falsely enabled by this read-only correction.

## Read-only compatibility rollout

The read-only adapter and frontend now recognize the exact v22 source/protocol, preserve its immutable metadata, enforce its 600-character explanation limit, and render its findings in review pages, saved-review summaries and exports. Historical v20 and legacy review handling remain supported. The updated adapter retrieved all three previously finalized v22 control results from Studio Next; each passed snapshot/evidence validation and returned four findings. This was read-only: no new deployment or wallet signature.

The allowlisted citation-correction release includes these reader changes and the explicit withdrawal notice. Its artifact still contains one Python function and passes the Vercel entrypoint/routing checks. The production writer and category-enablement policy are unchanged. The hosted checker also checks the withdrawn record without making a new transaction.

The requested ten-test authorization was granted and the resulting v22 batch stopped as recorded above. The production writer remains unchanged. The next live gate must use the corrected candidate under fresh bounded authorization. After that gate passes, enable the tested writer, run end-to-end checks, and publish the integrated release.

## Earlier: specific consensus failure corrected

The v22 correction separates a generic hosted “text API” description from evidence that an API generates text. It preserves the independent decision and source-audit checks, unchanged input evidence, training rules, and failure handling. No new architecture or fallback was added.

All three separately approved Studio Next tests finalized successfully: the previously failing opt-out control, the missing-policy/streaming-tab control, and the documented-streaming control. All 12 condition checks and assistant semantic reviews passed. 209 focused local tests passed. This resolves the observed control failure; it does not establish reliability across the provider catalog.

Source: `experiments/contracts/provider_review_decisions_v22.py` (SHA-256 `b8d6a1249dd49afd88d1e64a95aa77d1c327334dba49f9f0ca95007a88e1b52d`). Results: `submission/studio-next-v22-targeted-controls-2026-09-17.json`.

The three-test allowance is complete, with no retries or provider payments. The production writer remains unchanged. Remaining rollout gate: saved provider regression tests against this exact candidate, under fresh bounded authorization. Earlier failed batches below remain preserved as history.

## Completed and checked

- Shared navigation and Recall home links shipped in commit `b67c984eb9f9a5a17f3796f53147d7917a94481b`. Mobile Purchases, local draft creation, and home navigation checked again after release.
- Studio Next remains the live assessment network (61997). Historical records remain on their original networks.
- A source-pinned, read-only adapter now retrieves historical v20 decision assessments. Exact source, evidence, account, receipt, schema, and quotations are checked; the original candidate metadata is preserved. It does not enable that contract for new reviews.
- The read-only adapter retrieved the finalized OpenAI transaction `0xe7b85b2cc4efc37bf57054f8b13aab5ecab232eed9c160f9f750ee62750b547f` from Studio Next. Four supported findings passed the structural checks. This is not proof of general assessment accuracy.
- 268 focused Python checks passed for the v21 experiment and production read integration. Deployment entrypoint validation confirms one Python function.
- Reader integration published in `d9e97f9e09455e50982b5f57fccb86284bb1be9e`; Vercel confirmed deployment success. The expanded production smoke test passed at 17:17 UTC, including frontend acceptance of the real v20 record, existing audio reviews, origin guards, wallet assets, and historical payment receipts. The smoke fixture includes the original signed intent's fee deposit; no receipt-matching guard was relaxed.
- 37 frontend checks passed for navigation, decision-record validation, and saved review indexing.

## Unfinished: reliable new text-generation assessments

The separately approved v21 validation batch stopped after its third deployment. No remaining slots will be reused. No provider payment was made.

| Control | Transaction | Result |
| --- | --- | --- |
| Missing evidence | `0xb80cc836f7991f5b2ec04e8a5b48bc72265269e1b8a3af0a0e0ab89337f5f70b` | Finalized success; automatic checks and manual semantic review passed |
| Documented streaming | `0x3d9c98b19faf23092a7c09521cb32512ee6b446742875ad52b64ef9bbcdee07e` | Finalized success; automatic checks and manual semantic review passed |
| API opt-out; unspecified default | `0x709bd822cb61f56b4f5a2459619ed25d926f6a5f113256b9fedf0a5d3aa4a9b7` | Finalized error; batch stopped |

Each deposit was 20,000,000,000,033,882 wei; three deposits total approximately 0.06 test GEN. Deposits are not final charges. The approved ceiling was 0.65 test GEN.

The failed control consistently produced `OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED` for training. Consensus instead split on whether describing a plan as a “text API” and mentioning input/output establishes text-generation capability. Source-grounded audits also rejected some explanations. Successful syntax checks and mocked model tests did not establish live reliability.

Preserved source SHA-256: `2340b56de162dce022fc20064e1ba32cd75c81e367f9b563cd287c23ba950c10`. Do not edit this tested candidate or overwrite its journal. No provider cases were run in this batch.

This control ambiguity was subsequently addressed and verified in v22 as described above. New text-generation assessments remain disabled until provider regressions pass; comparison and reading verified existing results are separate capabilities. No receipt-success shortcut or weakened validation is used.

## Security scope

The earlier security scan reported no confirmed findings in its audited coverage; coverage was partial, not a repository-wide safety guarantee. Remaining transaction-child execution semantics and deployment-wide rate limits need further review. Do not claim these are resolved.
