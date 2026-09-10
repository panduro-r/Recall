# Supplied Speechmatics review — read-only diagnosis

Transaction: `0x77b9f044eb9a2740ec0adeb30781fce5ce7f26431e6efaf11fb23c72857d3329`

Export: `recall-speechmatics-standard-126abb90-a0de-4241-bb55-d371e06e4acc.json`

The export's 45,796-byte payload hashes to `4f78608d2fbafda2deff2fb1778efcbb592b374f27c08e227bc1e0b43f146b17`. Both document text fingerprints match and both captures are complete. The submitted constructor argument exactly matches that exported payload. Deployed source fingerprint: `3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017` (v2). The transaction's value is zero; the public signing account matches the supplied screenshots.

## Outcome

Studio returns `FINALIZED`, but the consensus result is `MAJORITY_DISAGREE` (7). The final round has three disagree and two agree votes. A leader's `SUCCESS` execution is not a successful consensus outcome. Reading the proposed address `0x9800b6fd46d6A57d90A9679198Bd97a6c343Ac90` returns contract not found. There is no accepted snapshot or usable provider assessment to report.

These are distinct fields in the [GenLayer SDK reference](https://docs.genlayer.com/api-references/genlayer-py/api); [finalization does not imply success](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/transactions/transaction-statuses). This result is not evidence that Speechmatics meets or fails the buyer's requirements. The exact reason for the validators' differing assessments has not been established here.

## Application faults corrected locally

- The raw transaction is 1,981,487 bytes, including duplicated consensus traces. Recall's 1 MiB cap rejected it before parsing. Transaction reads now have a bounded 4 MiB limit; other reads retain the 1 MiB limit, five-second socket timeout, fixed destination and no redirects. Raw traces are not returned to the client.
- The receipt adapter previously used only leader execution. It now respects consensus rejection and does not try to inspect an uncreated contract. Unknown or inconsistent results cannot become success.
- A finalized failed review leaves the pending queue, retains its reference/evidence, explains the failure separately from provider findings, and offers export rather than immediate resubmission. Exports now include the matching transaction journal entries, including pending or failed references.
- Header wallet controls remain visible before capture or review, including disconnected and pending states. Connection itself makes no submission. Purchase headers use the existing purchase wallet, not a second signing identity.

All observations were public read-only requests. No new review, appeal, signature, payment, wallet request, or broadcast was made for this diagnosis. The immutable v2 assessment contract was not changed. Usable live v2 assessment validation is still outstanding; do not repeatedly submit this same review to work around the UI error.
