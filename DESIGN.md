# Recall workbench

## New purchasing interface — September 7

The approved single-column Cobalt direction supersedes the three-pane composition below for the new `/workspace` feature only. The legacy recorded viewer and wallet-tested flow remain unchanged.

Centered 820px editor on #F7F8FA; white surface; ink #182235; muted #536074; Cobalt #2554D9; borders #DCE3EE. One compact system-sans family, 14px desktop body, 16px phone body, 24px desktop primary heading. Use a 10px surface radius, 6px buttons, no decorative shadows. A single primary action belongs at the editor's lower right (full width on phones). The budget is inline; conditions are editable rows, not a stack of large outlined fields. No fictional avatar, team account, or sidebar.

Working slice: browser-local drafts, custom conditions, immutable shared-request version, unsigned supplier reply links, exact request matching, and explicit buyer review before saving a reply. Public text only. Links confer no identity or signature. Saving a reply must never say assessed, approved, or paid.

The custom-purchase wallet integration uses the same restrained layout. Current status and next actions come before optional agreement metadata. Completed receipts collapse; pending or uncertain transactions remain visible and block new signing. Wallet settings collapse once connected. Every write gets an exact review and a separate wallet approval. The new contract's direct-VM tests use model fixtures; the previous wallet-run evidence does not validate this new contract. Keep these limitations visible at the boundary, not in every editor row. Impeccable guided mock fidelity, compact forms, semantic labels, contrast, and responsive testing.

## Legacy interface (preserved)

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
