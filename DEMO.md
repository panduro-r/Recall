# Recall demonstration guide

## One-sentence explanation

Challenge the evidence behind an agent purchase before payment; block the affected purchase, preserve unrelated purchases, and authorize a compliant replacement within the same budget.

## What to show

1. **The mandate:** a buyer caps authorization at 0.100 test GEN and specifies complete EU-only data handling. Separate seller, agent, challenger and buyer identities have different permissions.
2. **Three offers:** inference 0.030, storage 0.020, monitoring 0.020. Inspect each pinned document and actual model judgment before showing its queued permit.
3. **The contradiction:** a later, explicitly applicable inference amendment permits US processing and support access. Open the original and amendment side by side. Storage and monitoring are different orders and must remain valid.
4. **The consequence:** inference moves through DISPUTED to INVALID; attempts to pay it are rejected. Cancel its unpaid reservation. This releases authorization, not escrowed money or a refund.
5. **The repair:** a new EU Dedicated offer costs 0.040. It must pass its own evaluation, receive a new permit, and wait through its own review period. The old permit remains canceled.
6. **The accounting:** if the full run succeeds, supplier balances gain 0.020 + 0.020 + 0.040, the buyer retains 0.020, and the contract retains zero. Show balance evidence, not just SCHEDULED labels. Replay and duplicate-permit attempts must fail.

The acceptance criterion for this demonstration is the completed full-flow report in `live/`, not this narrative. If a run stops or a balance does not match, present it as unfinished rather than recording the planned outcome as if it happened.

## Recording honestly

- The contract uses real ten-minute review windows. An edited recording may skip waiting, but label the time jump and preserve transaction timestamps. Do not describe instant local time advances as network behavior.
- The local browser demo still uses mocked evidence/judgments. A recorded live report and the local interactive demo are different things until the browser is integrated with Studio.
- The terms are fictional and commit-pinned. A content hash proves which bytes were used, not supplier identity or truth.
- The runner chooses a predeclared replacement. It is not an autonomous shopping agent discovering alternatives.
- Studio runs hosted simulation and sandbox balances. Do not describe this as Bradbury deployment, production payments, escrow, or a general accuracy/security guarantee.

## Reproduce or inspect

Install the pinned dependencies using the repository README. `python live/full_flow.py` resumes the isolated experiment recorded in the ignored local journal. For an independent fresh experiment, use a fresh checkout without copying any private keys or run journals. Never delete a journal to force a retry: it protects against duplicate transactions.

After a successful run, `python live/export_flow.py` prints the public verification artifact. The report provides transaction hashes, pre/post balances, verdict explanations, review deadlines, and authorization transitions. Preserve the evidence commit and unchanged buyer criterion when comparing runs.
