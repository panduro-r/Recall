# Saved options and existing reviews

Checked September 12, 2026.

## User journey

Saved options shows each plan's saved requirements, current catalog estimate, and a direct link to the latest matching local review. The catalog detail dialog also offers that existing review instead of starting over. Different hours, budget, training requirements, speaker-label requirements or plan IDs cannot inherit a previous assessment.

The latest capture wins even if it is unassessed, pending or failed; the index never selects the most favorable historical result. Old source coverage, stale evidence, partial results and changed catalog data remain cautionary or unassessed. Current catalog costs are separate from a review's dated estimate.

## Data boundaries

The new navigation index reads only provider-review snapshots and their separate transaction journal. It validates capture fingerprints, literal citations, request/receipt matching and supported historic source sets before displaying an assessment summary. This is a check of local records, not a fresh network check or a guarantee of assessment quality.

No storage migration, wallet operation, assessment request or new capture occurs. Invalid records are unavailable, not silently discarded or labeled successful. Removing an option affects the shortlist only and re-reads it first to preserve other tabs' unrelated entries.

## Verification

- 163 Node tests passed, including nine new index tests for exact matching, chronology, pending/rejected/failed records, partial and inconclusive results, old evidence, changed prices, invalid quotes/digests/receipts, duplicate records, denied storage and encoded local links.
- 31 targeted Python route/server tests passed.
- `saved-reviews-browser.js`: 17 checks passed in an isolated localhost context with clearly synthetic evidence and receipt fixtures. Three saved options exercised matching review, no review and different-requirement review states. A newer unassessed capture superseded the old positive summary; corrupt records did not block catalog details or alter stored bytes. Zero API calls.
- Existing comparison regression passed 13 check groups, including source/clipboard failure, prices, storage failure, modal focus and unrelated-data preservation.
- Desktop 1280px and mobile 390px inspected. The mobile modal measured 358px with no horizontal overflow. Its primary action reopened the exact saved review with its receipt available, unchanged snapshot/journal bytes, and the wallet still disconnected. No console errors or warnings on that local review navigation.
- Vercel CLI 59.11.7 analyzed the 74-file runtime artifact successfully. Production checks include exact new index and comparison assets.

No new live provider finding, contract deployment or wallet transaction was produced by these checks.
