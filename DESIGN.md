# Recall workbench

## Controls and record inspection — September 8

This revision uses direct first-party research, without the Impeccable workflow. The preceding visual language remains, but its expanded states are replaced: connected accounts open a compact nonmodal popover instead of expanding the page; activity is a dated event timeline with a single receipt inspector; proposal history uses “Original proposal” and “Replacement proposal.” Raw proposal IDs remain in technical details. The unsigned reply is historical material under Details, never a duplicate record below the active purchase. Before deployment, the proposed price, conditions, terms and unverified supplier are reviewed together.

Desktop utility buttons are 32–36px, with a distinct 40px primary purchase control. Touch layouts retain 44px targets. Cobalt identifies the primary action, while utilities use quiet text/icon treatments. Wallet settings support explicit closing, Escape with focus restoration, and outside/focus-away dismissal. They do not request permissions or change accounts just by opening. Background reads pause while that panel is open. Every contract write still requires the exact review and separate wallet approval.

Research precedents: [Geist buttons](https://vercel.com/geist/button), [Radix popovers](https://www.radix-ui.com/primitives/docs/components/popover), [Primer timelines](https://primer.style/product/components/timeline/), [Attio’s June 2026 activity timeline](https://attio.com/changelog/2026/new-activity-timeline), and [Stripe Workbench event inspection](https://docs.stripe.com/workbench/overview#events). These support differentiated controls and progressive inspection, not a claim that one aesthetic is universally optimal. [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies a 24px minimum subject to exceptions; 44px is not a universal AA button-height requirement.

Verification explicitly includes wallet-open, receipt-open, proposal, historical-draft, and narrow-screen states. Fake-wallet browser runs verify UI behavior only; they do not establish fresh onchain validation.

## Split purchase workspace — September 7 refinement

The active purchase supersedes the single-column detail below. One white record surface on the existing neutral canvas holds a compact wallet toolbar, title and four-stage progress. The main area separates the evidence on the left from a 320px price/decision panel on the right. At 720px and below, the action moves above the evidence. No new palette, decorative shadows, or display typeface: Cobalt remains the action/selection color.

Terms review, Offers, Activity, and Details are accessible tabs, including Left/Right/Home/End navigation. Current actions remain outside the tabs; pending results remain visible regardless of the selected tab. Signing opens a focused exact-transaction review; it never submits automatically. Canceled/expired/unsupported offers do not highlight Payment as the current step.

Typography now bundles the existing Inter family (official Inter 4.1 variable WOFF2, SIL OFL in ui/Inter-LICENSE.txt). This removes platform-dependent fallback differences. The font is served from the same origin; no third-party browser request. Desktop copy is 13–14px, the record title 24px, and price 28px. Mobile reading copy is 14–16px with 44px controls. The single decision panel uses plain consequences, not repeated assessment prose.

Applied references: Linear's March 2026 noise reduction; Attio's May 2026 record/action grouping and quieter activity; Geist's UI typography scale. Impeccable's product and bolder guidance drove hierarchy and density within the existing tokens; its polish guidance drove keyboard, responsive, state and font checks. Browser fixtures are explicitly isolated and do not establish new live contract validation.

## Decision-first purchase detail — September 7 revision

The user rejected the tall document-like purchase screen. The active purchase now uses a 960px white workspace, compact wallet/network toolbar, four-stage progress, and a title/price row. A single pale-Cobalt decision band aligns status and consequence with the primary action on desktop, stacking the action on mobile. It is not a stack of bordered cards. Conditions and the full assessment sit below in a labeled evidence section. Historical reply content comes after the live purchase, never above its action. Exact transaction reviews remain unchanged in substance.

Impeccable layout guidance informed grouping and density: 12/16/24/32px spacing, 14px desktop body, short contextual labels, and complete readable evidence. The decision action is above the evidence at desktop and 390px widths. Wallet addresses do not wrap mid-address. The existing Cobalt identity and functionality remain intact; this visual revision does not establish new onchain validation.

## New purchasing interface — September 7

The approved single-column Cobalt direction supersedes the three-pane composition below for the new `/workspace` feature only. The legacy recorded viewer and wallet-tested flow remain unchanged.

Centered 820px editor on #F7F8FA; white surface; ink #182235; muted #536074; Cobalt #2554D9; borders #DCE3EE. One compact system-sans family, 14px desktop body, 16px phone body, 24px desktop primary heading. Use a 10px surface radius, 6px buttons, no decorative shadows. A single primary action belongs at the editor's lower right (full width on phones). The budget is inline; conditions are editable rows, not a stack of large outlined fields. No fictional avatar, team account, or sidebar.

Working slice: browser-local drafts, custom conditions, immutable shared-request version, unsigned supplier reply links, exact request matching, and explicit buyer review before saving a reply. Public text only. Links confer no identity or signature. Saving a reply must never say assessed, approved, or paid.

The custom-purchase wallet integration uses the same restrained layout. Current status and next actions come before optional agreement metadata. Completed receipts collapse; pending or uncertain transactions remain visible and block new signing. Wallet settings collapse once connected. Every write gets an exact review and a separate wallet approval. The new contract's direct-VM tests use model fixtures; the previous wallet-run evidence does not validate this new contract. Keep these limitations visible at the boundary, not in every editor row. Impeccable guided mock fidelity, compact forms, semantic labels, contrast, and responsive testing.

## Legacy interface (preserved)

Usability revision: known transaction references reconcile automatically. Pending transactions disable only signing controls; connecting and switching networks remain possible. Detect authorized account changes without forcing reconnection, and discard any stale review. Show a four-stage progress indicator, the current decision/reason and one primary action. Place cancellation/amendment under secondary actions; collapse the already-saved unsigned offer, history and technical metadata. No automatic wallet permissions, signatures or resubmission. Impeccable's distill and clarify guidance informed these behavior and hierarchy changes, retaining Cobalt and the approved typography.

Approved direction: compact edge-to-edge three-pane product UI. Purchase navigation left, evidence review center, properties right. No marketing hero, oversized headings, large service illustrations, floating metric cards, gradients, or decorative grids.

## Tokens and type

Preserve the committed white/plum palette: white #FFFFFF, ink #29232A, muted #665E68, primary #692850, pane #F7F3F7, divider #E3DDE4, green #246141, red #A52E36, amber #815015. Accent means selection or action; state colors always accompany words.

Use the existing sans/system font stack without external font requests. Desktop base 14px; metadata 12–13px; primary record heading 22px. Mono and tabular figures for exact amounts/hashes. Font weight and spacing establish hierarchy, not oversized text. Corners 4–6px and no decorative shadows. Interactive targets remain at least 44px high except inline links within text.

## Composition and behavior

Desktop >=1180px: 264px purchase pane, flexible center, 264px properties pane. Tablet >=700px: two columns; properties flow below the review. Phone: horizontally scrollable purchase selector and stacked source comparison, no document-wide horizontal scroll. Phone body text 16px for reading; compact labels remain smaller.

Semantic tabs support arrow keys and Home/End. All actual sources have safe external links; synthetic fixture URLs are read inline. History exposes full hashes and separates execution success from transaction finality. Small status colors are never the only way to distinguish outcomes. Source summaries are editorial, not consensus-certified prose. Amounts use integer arithmetic.

Only 150ms action feedback and an optional loading pulse; reduced motion removes animation. Avoid hover-only controls. Preserve loading, empty, error/retry, canceled-filter-empty, missing-evidence and disputed states.

## Research informing the approved revision

- Linear, March 12 2026: quieter navigation, smaller icons/tabs and fewer separators. https://linear.app/now/behind-the-latest-design-refresh
- Vercel Geist: common 14px UI text, 12–13px supporting text. https://vercel.com/geist/typography
- Attio, May 28 2026: compact lists and less noisy activity. https://attio.com/changelog/2026/record-page-redesign

The Impeccable skill guided the responsive implementation and semantic-state checks. Browser viewport inspection is not equivalent to physical-device or screen-reader certification.

## Wallet-controlled flow

Payment labels combine finalized transfer evidence with the specific contract, buyer, permit, recipient and amount. Show "Paid · Recipient transfer verified" only with that match; retain SCHEDULED as the raw consumed-permit state underneath. Without matching browser history, explicitly say transfer verification is unavailable here and never suggest resending. Show local payment-opening time including the five-second safety margin; distinguish waiting from expiry. Empty permit lists explain why paid and cancelled permits cannot be selected again.

Preserve the same three-pane composition at /purchase: flow navigation, compact labeled forms/review, and buyer rules. No new palette, hero or visual exploration. Account connection, network switching, unsigned review and approval are separate actions. Keep exact addresses, values and arguments inspectable before signing; show unavailable-wallet guidance without pretending connection succeeded. Do not use optimistic success for contracts or payments. Pending, failed, uncertain and verified outcomes have explicit text. The in-app browser is a read-only inspection surface when no wallet provider exists; responsive layout support does not imply mobile wallet connectivity.
# Wallet identification and disconnect — September 8

Keep the approved Cobalt visual system. Installed wallets appear as compact selectable rows with a 32px brand icon and an explicit selected check. The same icon appears in the connected-account trigger and profile. Disconnect lives in the account popover, separated from connection controls, with a short explanation of its tab-local scope. It is not a destructive purchase action.

Metadata follows [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963): retain the provider object, upgrade legacy injected metadata without duplicating it, and render extension-supplied data icons only as `<img>`. Names and icons are self-reported, not identity verification. Reject remote URLs and oversized data; never insert SVG markup into the document. The image CSP allows `data:` while script, font and connection policies remain same-origin only. Session storage remembers only a disconnect boolean, separately from purchase and transaction data.
