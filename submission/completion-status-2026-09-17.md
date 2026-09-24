# Recall completion status — September 17, 2026

## September 24 local read integration — no additional transaction

The server and browser readers now recognize the **exact** v26 source and protocol hashes. They reconstruct its paragraph-aware passages, verify fixed summaries and exact saved quotations, and keep receipt/evidence identity checks. The actual saved Speechmatics v26 state passed the server adapter unchanged. This is read-only compatibility: the production writer, text-category enablement, historical records and the stopped test allowances are unchanged. Focused release checks passed (151 Python, 292 frontend), as did the one-function Vercel packaging check. The all-version Python suite cannot be run in one local SDK environment: the Studio Next environment lacks the older GenVM bundle cache, and the legacy environment cannot load the newer GenVM runtime. Those setup failures are not counted as product regressions or as a full-suite pass. No new GEN was spent.

The targeted read-only update was fast-forwarded to GitHub main as `b95559f3532b4a943b035addeada2d75d31e0811`. Vercel served the exact new browser reader, and the hosted API plus browser validator accepted the actual saved v26 Speechmatics state. Writer categories remain transcription and speech, not text. The [hosted read result](studio-next-v26-hosted-read-2026-09-24.json) records this check. A broader historical smoke separately stopped when Studio returned “response unavailable” for an older archived receipt; that check is incomplete, not a v26 failure and not a full production pass.

## September 24 targeted validation completed — Speechmatics v26

After explicit approval for the new source and **one** deployment, Studio Next accepted the v26 schema. The frozen Speechmatics case was submitted once at nonce 38. Transaction `0xb341e33ab51c5530d045d27d2b9fdf8594765f1c26d7491c4716c7df2ad9e89f` finalized with successful execution and `MAJORITY_AGREE` after one leader rotation (three agree, two idle). No earlier passing case was rerun; no provider payment or retry occurred. The protocol deposit was `20000000000033882` wei, distinct from the observed wallet balance decrease of `160066000005290` wei (about 0.000160066 test GEN).

The accepted result marks API access, prerecorded batch use, English transcription and mono WAV support as documented. It marks the no-model-training requirement **inconclusive because of conflicting captured terms**: the pricing FAQ says non-opted-in data is never used to improve models, while terms clause 10.3 grants an unconditional machine-learning license for transcripts. Manual review found the five decisions supported by the selected passages. This is an assessment of captured written evidence, not a finding about actual provider conduct.

The original saved target grade says `assessment_passed=false` because its author-drafted rule demanded the additional literal phrase “programme is off by default”; the cited FAQ directly supplied the protective side without that phrase. The corrected local grade requires the FAQ promise **and** the opposing license and passes on the immutable on-chain assessment; removing either citation fails. Both grades are disclosed in `submission/studio-next-v26-speechmatics-2026-09-24.json`; the original journal was not overwritten. The one-case runner is disabled against further signing. **This resolves the observed frozen Speechmatics failure only.** The v26 contract remains an experimental candidate with `release_cleared=false`; production writer and new text assessments are unchanged. Unrun provider cases remain unvalidated on v26.

## September 24 local correction — one failed case only

The user objected to rerunning already passed cases and further spending. The saved Speechmatics failure was examined directly. The v25 proposer selected up to four passages, including a different model's example for some technical findings; several native audits rejected citations, one independent response supplied five citations and failed format validation, and the training readers disagreed between default exclusion and conflict. The original evidence is split into 480-character passages, often in the middle of a plan row or legal clause.

An isolated v26 candidate keeps longer, paragraph-aware passages, asks for the minimum decisive citations (maximum three), excludes a different model's example as evidence for the selected plan, and explicitly keeps an unconditional transcript machine-learning license alongside a default-off statement as conflicting written terms. It preserves independent validator agreement, the native source audit, full captured source text, exact citation bytes, and failure on malformed responses. No prior passing case has been submitted again. The v25 source, journal and production writer are unchanged.

The frozen Speechmatics capture passes seven focused offline checks, including execution through the pinned GenLayer SDK with scripted answers, exact reconstruction of all captured document bytes, the three-citation failure path, rejection of disagreement or a negative native audit vote, and the corrected target grader's requirement for both conflict sides. These checks demonstrate contract wiring and input integrity; live consensus is documented separately above. The candidate is `experiments/contracts/provider_review_decisions_v26.py`, SHA-256 `0eed90e7116b1065da4b41d4fafc647fb936fefc6da64f6f04082f523572ecd4`; protocol SHA-256 `032433ba72892de57b0f55a675f2f9cd79101479ec60a0fa76fe31df558fda6c`.

One Speechmatics-only Studio Next check was prepared with nonce 38, zero provider value, one deployment maximum, a 0.05 test GEN protocol fee ceiling and no retry. The first remote schema check was rejected by automatic approval review because the earlier external source approval covered v25, not the new v26 bytes. The user then explicitly approved the v26 upload and single deployment. Its completed result is documented above; no earlier passed case was rerun.

## Latest update — September 24: regression batch stopped at Speechmatics

The separately approved ten-test batch used the unchanged v25 contract. Four policy controls (opt-out, conflicting policies, prompt injection and incomplete training scope), Mistral and DeepSeek finalized successfully and passed automatic checks plus manual review of every finding. DeepSeek needed three protocol leader rotations; do not describe this as first-round reliability.

The seventh transaction, Speechmatics `0x4ba6ff2bf419f9ac17c2986d3c6221f2f705dbb06384f9c5b82c4974ee9812a5`, finalized with `MAJORITY_DISAGREE` after three rotations. No assessment was accepted. The batch is stopped and signing authorization disabled. Fish Audio, Anthropic and Google were not submitted; the three unused slots are closed. No automatic retry or provider payment occurred. Production writer and text-assessment enablement are unchanged.

The saved diagnostics record source-grounded audit rejections for all four technical conditions and training, a disagreement between `EXCLUDED_BY_DEFAULT` and `CONFLICTING_EVIDENCE`, and a correctly rejected five-citation response (limit four). The captured pricing FAQ says training is off without opt-in, while the captured terms grant a machine-learning license for transcripts. Some technical proposals cite an Enhanced-model code example while assessing Standard; others avoid that example and are still rejected. These are distinct recorded issues, not proof of one underlying cause. Native audit rejection contains no rationale. Do not solve this by removing the contrary terms, silently dropping citations, weakening agreement, or treating execution failure as a provider verdict.

Seven deposits total **0.140000000000237174 test GEN**. Observed wallet balance decrease was **0.001037523250033173 test GEN**, recorded separately from deposits. Public findings, manual notes, all distinct proposed answers for the failed case, exact source quotations and rejected-round diagnostics are preserved in `submission/studio-next-v25-regression-stop-2026-09-24.json`. The original full receipts remain in the local journal. `experiments/export_v25_regression.py` reproduces the public report without network access or wallet credentials.

Remaining blocker: reproducible provider-level consensus and citation selection on the frozen Speechmatics case, then the unrun provider coverage. The earlier OpenAI pass remains valid for its exact frozen case; it was not a claim that every provider was fixed. The v25 reader edits remain local and are not a production rollout.

After closure, **97 focused Python tests and 35 focused frontend tests passed**. New saved-record regressions verify all six successful findings against exact captured bytes, preserve both sides of the failed policy conflict, reject the actual five-citation response without truncation/retry, and block all three unused signing slots. These checks protect evidence integrity and failure handling; they do not establish that the live semantic failure is fixed. Earlier in this run all 291 frontend tests also passed.

## Local follow-up — v25 reader integration and remaining batch prepared

The server and browser readers now recognize the exact v25 source/protocol and require its fixed decision summaries, exact captured quotations, metadata and receipt identity. This is read-only compatibility, not a writer rollout. v20/v22 readers and the narrowly scoped withdrawn-record warning remain intact. Both readers accepted all three saved v25 live snapshots unchanged. No new network assessment or wallet signature was made for this work.

**281 focused Python checks and all 290 frontend checks pass.** Coverage includes the new source/version binding, rejection of invented summaries or altered quotes, legacy compatibility, and signing guards. The immutable v25 contract has not changed. The production writer and text-assessment enablement remain unchanged; these reader edits are local, not yet published.

The allowlisted `.build/recall-vercel-z6V6oo` artifact also passes the Vercel entrypoint checker: one Python function and eleven explicit API rewrites. This is a local packaging check, not a hosted deployment check.

`live/decisions_v25_regression_next.py` prepared a separate, initially disabled ten-test batch: opt-out, conflicting-policy, injection and incomplete-training-scope controls, then frozen Mistral, DeepSeek, Speechmatics, Fish Audio, Anthropic and Google cases. All input hashes and the completed targeted results were checked locally. Nonces 31–40, maximum 0.05 test GEN each / 0.50 total, no provider payments or retries, and automatic plus manual review before proceeding. Approval was subsequently granted and the September 24 batch stopped as recorded above; no prior unused allowance was reused.

## Latest update — September 18: audit interface corrected; all three v25 targeted tests passed

The source-grounded audit previously received an envelope (`assessment`, `evidence_passages`, `setup_passages`) as its proposed output, while its task required exactly `decision`, `evidence`, `setup`. A regression now reproduces that structural inconsistency against v24. The v25 correction passes the exact three-key leader answer as output and supplies resolved citations alongside the full captured source in input. It never replaces the leader's selection with the independent reader's citations or adds neighboring text.

Unknown findings now receive absence-specific audit criteria rather than the positive-finding demand for affirmative citation proof. The full source must still leave the requirement unsettled; a native rejection still rejects. Streaming rules distinguish a description of what a captured guide covers from an explicit exclusion of the service's capability. Positive, negative, conditional and conflicting findings retain exact-citation grounding. Independent decision agreement, native boolean audit, one consensus boundary per condition, fixed summaries, fee limits and no-retry behavior remain unchanged.

**273 focused Python checks and all 289 frontend checks passed.** The new regressions cover the old task/output mismatch, missing-policy proposals with and without optional context citations, actual pinned SDK template payloads, table-header misattribution, failure propagation, signing guards and consistency of the preserved live results. Local/scripted checks are not live semantic accuracy measurements. Native audit failures from v24 expose no rationale; the interface mismatch is a proven code defect, not proof of the sole cause of every rejection.

The initial new-source export was blocked by environment review; nothing was uploaded by that attempt. The user then explicitly approved v25 upload and three tests, in order: failed control q01, positive control q02, frozen OpenAI q15. Maximum 0.05 test GEN each / 0.15 total, no provider payments or transaction resubmissions, stop at first failed check. Studio Next accepted the schema. **All three tests finalized successfully and passed all 12 condition checks plus manual source review.** q01 required three protocol leader rotations and finalized 3 agree / 2 disagree; q02 and q15 required no rotations (each 3 agree / 2 idle). Preserve those disagreements: this is not unanimous or broad reliability evidence. All three deployment slots are used. Production and historical sources remain unchanged.

OpenAI's API and text-output findings have decisive endpoint/modality passages. Its training finding cites the default-off policy plus both the table header and actual endpoint rows; streaming cites the supported-features entry and its support context. Redundant clipped regional-table passages remain auxiliary context, not independent training proof, and no model-written explanation attributes policy values to them. The exact findings, votes, rejected-round diagnostics, assistant notes and costs are preserved in `submission/studio-next-v25-targeted-validation-2026-09-18.json`.

Observed wallet balance decrease across the three tests: **0.000477647000014469 test GEN**. Protocol deposits total approximately 0.06 test GEN and are recorded separately from that decrease. No provider payment or additional transaction occurred. Remaining release work is broader provider/adversarial validation of this exact source, then production integration and end-to-end deployment checks; new text assessments are not enabled by this experiment. No stopped prior-batch slots have been reused.

Candidate: `experiments/contracts/provider_review_decisions_v25.py`; source SHA-256 `c03e43531297394f470d81cc0453a8a0a3abb9ea7150c94334f3c4c1c8278be9`; protocol SHA-256 `161175f602e241f1fd87bb2455132c6d7faf0e1e3487fc0e1d728823aecc8b7b`. No production rollout is claimed. The task/output relationship follows the official [GenVM template interface](https://sdk.genlayer.com/main/impl-spec/03-greyboxing/index.html).

## Earlier — September 18: OpenAI passed v24; missing-evidence control failed

The separately authorized three-test v24 validation stopped after two deployments. The unchanged saved OpenAI case finalized successfully by validator majority, and all four automatic condition checks plus assistant source review passed. Training now cites both the table header and actual endpoint rows; streaming cites model identity and its affirmative supported-features entry. This is a pass for that frozen case, not general accuracy or unanimous agreement.

The navigation-only/missing-policy control finalized with `MAJORITY_DISAGREE`. The source documents a hosted text-generation API, a captured non-streaming body and navigation tabs, but no training policy. Logs record independent streaming `EXPLICITLY_UNAVAILABLE` versus leader `INSUFFICIENT_EVIDENCE`, plus native source-audit rejection of API, training and streaming proposals. The native audit gives no rationale, so those rejections are not attributed to a proven sole cause. The third deployment was not submitted; the batch stays stopped, without retries or changes to its pinned source.

Full outcomes, source quotations, votes, diagnostics, manual notes and cost fields are in `submission/studio-next-v24-validation-stop-2026-09-18.json`. Observed wallet balance decrease: **0.000398039000012352 test GEN** across both tests. Deposits total approximately 0.04 test GEN and are recorded separately. No provider payment or production change occurred. The full release gate has not passed; no new text-assessment rollout is claimed. **164 focused local checks pass**, including replay of the actual stopped-batch signing guard; these are not live-model accuracy tests.

## Earlier on September 18: streaming evidence rules aligned locally

The preserved v23 failure exposed a contradiction between the general acceptance of an affirmative supported-feature list and the streaming-specific demand for a body description or example. The v24 candidate now supplies one shared streaming rule to the proposer, independent reader and native audit. Three alternative routes are explicit: a body statement, a working configuration/example, or an affirmative supported-feature entry with cited support context. The audit must not add a stricter route. Navigation-only labels, completed-response chunks, input-only streaming, other-product scope, explicit denials and unresolved contradictions remain distinct.

This is a narrow instruction correction, not a change to GenLayer consensus, citation resolution, training decisions, source capture, retries or account checks. The failed v23 source, stopped journal and production writer are unchanged. The native audit can still reject; no provider is allowlisted and no finding is hardcoded.

Verification at the local-correction stage: **155 focused local checks passed**, including 34 new v24 checks for shared instructions, negative examples, exact patch scope, preserved hashes, and execution through the pinned Next SDK with scripted model/template responses. These are not live accuracy tests. No schema upload, wallet signature, deployment or GEN expenditure occurred during the local correction. The separately authorized validation is recorded above; the 12 unused v23 slots stay closed.

Candidate: `experiments/contracts/provider_review_decisions_v24.py`. Source SHA-256: `0407e71179be5a39408321a2f978bba572c196097aecb588c21c7a8a88ffc295`. Protocol SHA-256: `087c79f33d6a14f1b7fa19fdb84870d892ebfa780dfc2651b02eef7956258a08`. The saved OpenAI case plus navigation-only and explicitly documented streaming controls are the immediate live regression checks before broader provider validation. Other recorded v23 audit rejections are not assumed fixed by this change.

## Earlier: v23 validation stopped after the first deployment

The newly authorized 13-case v23 validation stopped on its first case, the frozen OpenAI snapshot. Studio Next accepted the schema, but transaction `0xe11b1c133af31a4ffd086c130b8bca0a1064c56f9895dcc07b9f6528c55298b8` finalized with `MAJORITY_DISAGREE`; no accepted assessment exists. The remaining 12 cases were not submitted and will not be reused. No automatic retry or provider payment was made, and the production writer was not changed.

The recorded failures are native source-grounded audit rejections for API access, training and streaming. The streaming citation E6 contains `Supported features` followed by `streaming`. A concrete rule inconsistency remains: the base instructions accept affirmative feature-list entries, while the streaming-specific instructions demand an explicit incremental-delivery body statement or example. Native audit diagnostics provide a boolean, not a rationale, so this inconsistency is a correction target, not proof of the sole cause of every rejection. No audit was bypassed or rejection converted into a provider finding.

The exact source and evidence, leader proposals (not accepted findings), selected passages, diagnostics, fees and stopped policy are preserved in `submission/studio-next-v23-validation-stop-2026-09-17.json`. The protocol deposit was approximately 0.02 test GEN; the observed wallet balance decrease was **0.000318339500009529 test GEN**, recorded separately from the network's fee fields. Before submission, 120 focused local tests passed; those tests do not prove live semantic agreement. The v23 source remains unchanged for reproducibility. A corrected assessment contract still needs validation before release.

## Earlier: v22 provider batch stopped; exact-citation correction prepared

The approved ten-test v22 batch stopped after five deployments. Conflicting-policy, prompt-injection and incomplete-training-scope controls, plus Mistral, passed automatic checks and assistant review. OpenAI finalized successfully and passed its automatic target checks, but assistant review found a false citation attribution: the training explanation attributed endpoint-table values to E25, which contains the header and separator, not the endpoint rows. Consensus success is not proof of accurate citations. This is not a finding against OpenAI.

The five unused slots will not be reused. DeepSeek, Speechmatics, Fish Audio, Anthropic and Google were not submitted. All five results, findings, assistant review notes and transaction identities are preserved in `submission/studio-next-v22-regression-stop-2026-09-17.json`; full receipts remain in the local test journal. Five protocol deposits total 100000000000169410 wei (about 0.10 test GEN); deposits are not final charges. No provider payments or transaction retries were made.

The local v23 correction now removes free-form model explanations rather than relying on another warning to make them reliable. Model proposals contain exactly decision, evidence IDs and setup IDs. The contract supplies a fixed decision summary and resolves quotations directly from the captured bytes. Model-written reasons are rejected, not silently removed or repaired. The independent decision check and native GenLayer evidence audit remain; the audit receives resolved selected quotations plus every captured source for scope, conflicts and absence. This prevents invented explanatory prose, but does not prove every model decision or citation selection will be correct. No decision modes, evidence boundaries, model-call count, consensus boundaries, retries or production settings were changed. Old v22 source and results remain untouched.

Candidate source: `experiments/contracts/provider_review_decisions_v23.py`, SHA-256 `9870f5aa62eea5f1cdf08c35210a233f2d76b87262afaf25c3d8907afd2b3790`; protocol SHA-256 `78b8ed959183c15144ffbb7563ee6bbb869a77c531600ec9482b7634edfaa364`. Its subsequent live validation failed as recorded above. Local scripted inference and SDK tests check construction and rejection paths, not live semantic reliability. No GEN was spent during the earlier local correction itself.

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
