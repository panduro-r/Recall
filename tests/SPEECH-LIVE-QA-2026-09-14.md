# Speech-generation live tests — September 14, 2026

**Result: two completed v5 assessments; one finalized consensus rejection.**
This is the first live validation of the speech-generation rubric, not proof that
all three providers can be reliably assessed. Exact public references are in
[the new test record](../submission/verified-speech-reviews-2026-09-14.json).
The historical transcription record is unchanged.

## Scope and outcome

The owner authorized and funded an isolated test wallet. Exactly three zero-value
deployments were submitted, one per approved plan, on stable Studio chain 61999.
The selected requirements were one million characters/month, $50 budget,
no model training and streaming. All four sources for each plan were completely
captured before signing. Contract and catalog hashes stayed pinned for the run.

| Plan | Finalized result | Product interpretation |
| --- | --- | --- |
| ElevenLabs Flash v2.5 | SUCCESS / MAJORITY_AGREE; completed v5 review | Speech API, English and streaming supported by captured terms; training CONDITIONAL. Requires setup. |
| Fish Audio s2.1-pro | ERROR / MAJORITY_DISAGREE | No accepted assessment. Not a finding against the provider. |
| Deepgram Aura-2 | SUCCESS / MAJORITY_AGREE; completed v5 review | Speech API, English and streaming supported by captured terms; training CONDITIONAL. Requires setup, with pricing impacts to confirm. |

The wallet held `1000000000000000000` wei before and after each finalized
transaction. No provider payment, funding call, replacement attempt or automatic
resubmission occurred. The three-attempt policy is exhausted; another on-chain
test requires a separately authorized budget. Keys remain local, owner-only and
outside the runtime and publication allowlists. No Keychain access was used.

## Verification completed

- All receipts matched the exact account, zero value, source hash and evidence
  digest. Successful contract snapshots independently matched the original
  payload, account and v5 schema.
- The production frontend models accepted both successful reviews, including
  category-specific IDs, exact captured citations, conditional setup steps and
  the correct decision/next step. Fish's receipt became a terminal failed entry
  through the production transaction model; no fabricated session was accepted.
- The published `/api/provider-review` endpoint returned the same successful
  ElevenLabs and Deepgram findings and classified Fish as FINALIZED / ERROR /
  MAJORITY_DISAGREE. These were read-only inspections. A diagnostic request
  without the required Origin header was correctly rejected; using the client's
  same-origin header succeeded.
- 520 Python tests passed in the main suite; the two sandbox-skipped local HTTP
  tests passed separately with loopback binding permitted. Total: 522 Python
  tests, plus 205 JavaScript tests. The targeted wallet/category suite has 52
  passing checks, including duplicate suppression, durable pre-broadcast
  journaling, typed legacy compatibility, rejected fee states and balance-change
  blocking.
- Existing browser-local reviews, the historical v3/v4 evidence and purchase
  records were not overwritten. The isolated signer does not test a browser
  extension's approval interface. No new Vercel deployment was created for these
  tests or solely to record their completion.

## Fish Audio diagnosis and next gate

The finalized public receipt records two agreeing and three disagreeing votes.
The exposed leader/validator VM runs report successful execution with empty
VM error fields. The contract compares independent per-condition verdicts and
diagnostic codes; a rejected leader's output is **not** a stored assessment.
Independent validator findings are not exposed in this receipt, so the exact
disputed condition cannot be identified from these diagnostics alone.

One concrete concern in the rejected proposal: its English-support conclusion
relied on a pricing explanation equating UTF-8 bytes with English words and
hours of speech. A workload/pricing example is weaker evidence than an explicit
supported-language statement for the selected model. This is a candidate
source/rubric weakness, **not a proven explanation for every disagreeing vote**.

Before another attempt:

1. Find explicit first-party, model-specific English support and clarify the
   API-specific training evidence. Keep missing commitments unknown; never
   manufacture a negative or positive finding.
2. Add adversarial cases separating billing examples from capability promises
   and plan-applicable opt-outs from general privacy language. Do not loosen
   consensus or citation checks merely to obtain a successful demo.
3. Version any changed rubric/source binding, preserve this failed record, and
   obtain a separate, bounded test authorization before signing again.
4. Once this reliability issue is addressed, surface read-only verified examples
   in the product and rehearse the two-category demo. Keep the uncoached user
   test as a separate open gate; automated checks do not establish usability.

Three attempts are too few to estimate general accuracy or reliability. The
successful cases verify execution and source binding, not account settings,
legal compliance, actual provider behavior, voice quality or production readiness.
