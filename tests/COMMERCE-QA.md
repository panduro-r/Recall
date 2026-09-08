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
