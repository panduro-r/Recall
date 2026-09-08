# Custom-purchase validation — September 7, 2026

This is a new two-party contract version. The original four-role contract and its recorded payment are unchanged. Their network evidence must not be attributed to this new version.

Completed checks:

- Direct-VM contract tests with explicit model fixtures: role separation, exact payment value, review/expiry limits, changed terms, cancellation, replacement, and replay prevention.
- Offline RPC adapter tests: unsigned deployment/calldata, recipient/amount checks, chain/router/gas drift, source matching, field/amount bounds, outsider refusal, and closed-payment states.
- Wallet/controller tests: intent matching, pre-sign persistence, cross-tab lock, rejection, unknown outcome recovery, and linked recipient-transfer evidence.
- Isolated browser, fake wallet and intercepted commerce API: acceptance → assessment → approval → changed terms → negative reassessment → cancellation → replacement → assessment → approval → payment. Ten simulated writes, no real network transaction, no console errors.
- Actual Studio read-only deployment preparation for the new source succeeded: chain 61999, gasless router, zero value, gas estimate 0x7a120. No signature or broadcast.

Still required: the buyer and supplier must complete a fresh wallet-approved Studio run against this exact contract source. Assessments check written commitments only; they do not establish real-world performance or legal compliance.

Browser fixture code is test-only and excluded from the deployment manifest. Use a fresh isolated browser context and loopback host only.

## Wallet recovery and usability revision

The user's public `accept_terms` receipt `0x1b8aa94b9721b68ed37072c40604f3a2f9e4999822ddf8665f651099af8f9f3b` was read as FINALIZED / SUCCESS, zero value, supplier `0xc842c25cEfD0DbA135C18F29860Cd69e6218Dac2`, contract `0x850fDa9CEF8199282B42457ce14da822CD141b13`. This confirms acceptance, not a completed purchase or payment.

`commerce-usability-browser.js` exercises the actual UI with isolated fake wallet/API data: delayed acceptance receipt, disconnect, reconnect while pending, automatic account switching display, automatic receipt confirmation, assessment and budget approval, review-period payment availability, and linked recipient transfer. Four explicit simulated writes, no duplicates or network writes. Desktop 1280px and mobile-emulated 390px inspected; no horizontal overflow at 390px. This is not physical mobile wallet certification.

Unit tests cover polling pause/disposal/backoff, no concurrent update loops, and stale receipt results arriving after another tab completes verification. Missing hashes remain recovery-only; no automatic submission exists. The contract source and legacy flow are unchanged.

## Split purchase workspace

The same isolated usability path passed at 390px and 1280px after the record redesign. Added assertions cover all four tabs, keyboard Home/End selection and focus, hidden inactive panels, no tab-triggered signatures, and the responsive relationship between evidence and primary action. The fake-provider flow still signs exactly four explicit simulated actions. Inter is bundled with its OFL license and has a same-origin-only font policy. Build tests verify its WOFF2 signature, manifest inclusion and content hash. These checks do not authorize or validate a real user payment.

## Expanded components — September 8

Run `commerce-browser-fixture.js`, then `commerce-usability-browser.js`, then `commerce-components-browser.js`, in that order, only in an isolated localhost browser context. The new component checks cover wallet popover bounds/no layout shift, initial focus, Escape restoration, pointer/focus-away dismissal, one event per transaction, readable stored timestamps, a single receipt inspection level, descriptive proposal names, missing-hash recovery, and both pre-deployment and live-agreement draft displays. The unsigned reply is retained under Details, not duplicated beneath the current purchase.

The full usability and component paths passed at 1280px desktop and 390px mobile emulation. Component inspection adds zero signatures to the four simulated flow actions. Open wallet settings and open receipt surfaces were visually inspected in both layouts. A 320px long-title/all-expanded-panels check found no horizontal overflow and confirmed invalid, unknown and disputed states have no approval/payment action. Node tests: 69 passed. Python suite: 258 passed, plus two socket tests passed when separately rerun outside the restricted sandbox. No contract, wallet adapter, financial controller, storage schema, or real user transaction was changed by this UI revision.
# Wallet picker and local disconnect — September 8

Phantom icon follow-up: its installed extension's published EIP-6963 icon is a PNG data URI wrapped in leading/trailing newlines. Normalize only outer whitespace before validating; keep the image MIME allowlist and pre-normalization size bound. Regression coverage includes wrapped PNG/SVG data and rejection of wrapped remote/executable URLs. The actual extension icon was checked in an isolated browser without running extension code or making wallet requests.

Run `commerce-browser-fixture.js`, `commerce-wallet-browser.js`, `commerce-usability-browser.js`, then `commerce-components-browser.js` only in isolated localhost contexts. The wallet-specific fixture covers multiple provider icons, injected-provider deduplication, invalid/broken/remote icon fallback, SVG-script isolation, provider selection without permission requests, disconnect while an outcome is unknown, untouched draft/journal data, late identity reads, no reconnect on provider events/remount, declined reconnect, and successful explicit reconnect. Wallet interaction tests add zero transaction submissions. The normal purchase fixture still submits exactly four simulated actions, not real transactions.

Desktop 1280px and mobile-emulated 390px paths passed. Icons, wallet popover, selected rows, disconnection and keyboard focus were inspected in the browser. A separate actual page-reload check preserved the tab's disconnect flag and left the account detached despite an authorized fake provider; no wallet writes occurred. Node suite: 75 passed. Python suite: 258 passed, with the two loopback socket tests run separately. These tests are not certification of every third-party wallet extension. Contract source, wallet signing adapter, journal schema and financial checks are unchanged.

## Recorded example consistency — September 8

The `/proof` page (also served at `/`) now uses the shared Cobalt workspace stylesheet and scoped archive components. The original and replacement are explicitly named; terms, complete source documents, receipt activity and technical details are separate views. Primary navigation returns to `/workspace`, not the legacy four-role signing UI. The earlier experiment remains a secondary archival link under Details. The page explicitly distinguishes its September 6–7 historical run from the user's current two-party purchase.

`proof-browser-check.js` is a local-only, read-only browser check against the actual saved public bundle. It passed at 1280px desktop and 390px/320px mobile emulation: both selections, keyboard Arrow/Home/End tabs, focus retention, exact document contents, eleven unchanged receipt objects in order, parent/child/recipient transfer references, and no horizontal overflow with expanded receipts. The original never receives the replacement's transfer panel. Original, replacement, activity and mobile layouts were visually inspected; no console errors were found in the normal path.

An isolated page-load fetch override tested a 503 on the first `/api/proof` read, followed by an explicit retry: the unavailable state hid all outcomes and the second read recovered. A separate override changed the replacement child receipt to PENDING and inserted HTML-looking judgment text. The payment stayed unverified, transfer controls stayed hidden, and evidence rendered as text with no injected elements or execution. These overrides ran only on loopback; no wallet calls, contract changes, or new payments were made. The existing nine receipt-mutation regressions remain in place. Historical report/evidence bytes and current wallet/purchase logic were not changed.
