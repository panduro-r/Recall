# Wallet restoration — September 11, 2026

Scope: wallet-restoration release approved for publication on September 11, 2026. The checks below were completed locally before publication.

## Behavior

- A successful explicit connection remembers only the selected provider hint in session storage for this tab. Refresh and navigation silently query that same provider's currently authorized account. No account, private key, signer or permission is cached.
- Explicit Disconnect removes the preference and blocks restoration across refresh and navigation. Saved reviews, purchases and transaction journals are unchanged.
- A first visit, missing provider, ambiguous provider identity, locked/revoked account or inaccessible storage stays disconnected. There is no automatic fallback to another installed wallet.
- Restoration uses `eth_accounts` only. Purchase controls separately check the account and chain, as before. Restoration does not request permissions, switch networks, prepare an assessment or sign/submit a transaction.
- All main routes participate: Compare (`/` and `/compare`), Provider reviews (`/review`), Purchases (`/workspace`), Recorded example (`/proof`) and the legacy Studio page (`/purchase`). The purchase detail and global header share the same current wallet.
- Existing users must connect once after this update because the previous version did not save a provider choice. Closing the tab ends the session; this is not persistent login across browser sessions.

## Design basis

[EIP-6963](https://eips.ethereum.org/EIPS/eip-6963) specifies page-lifetime UUIDs and provider discovery. Selection uses the announced reverse-domain hint, not the ephemeral UUID or whichever extension occupies `window.ethereum`. Metadata is self-attested, not proof of wallet identity. A bounded recognized-provider flag is the legacy fallback; ambiguous matches are not restored. [EIP-1102](https://eips.ethereum.org/EIPS/eip-1102) distinguishes exposed accounts from requesting account access.

## Verification

- Full JavaScript suite: 132 passing, including 17 new preference/restoration tests. Covers fresh visits, late discovery, changing UUIDs, multiple wallets, ambiguity, locked/invalid/rejected reads, explicit Disconnect, account/chain races, manual-selection races, busy flows, denied/corrupt storage, page suspension and listener cleanup failures.
- Python suite: 375 passing plus 2 loopback server tests passing separately (377 total).
- Vercel artifact: `.build/recall-vercel-DCWopt`; CLI 59.11.7 builder discovery passes and contains the new public `wallet-session.js` module. No contract or assessment-source changes.
- Isolated Chromium at localhost, using `tests/wallet-resume-init.js` before page scripts: connect fake Rabby once, with a different fake wallet occupying `window.ethereum`. Its announcement is delayed and its UUID changes every page. Refresh and navigation across all routes restore Rabby using silent account reads. Only the explicit initial connect and explicit reconnect call `eth_requestAccounts`; no requests go to the other provider.
- Explicit Disconnect from Provider reviews remains disconnected across `/review`, `/compare` and `/workspace` navigation, with zero additional wallet calls. Explicit reconnect works. A locked provider stays disconnected without a prompt; unlock followed by refresh restores it.
- Simulated persisted `pagehide`/`pageshow` events discard the old controller and re-read authorization without requesting access. This checks the lifecycle handler, not a real browser back-forward cache activation.
- `testCommerceHeader`, `testRecallWallets` and an additional detail-to-list-and-back check pass: header/controller synchronization, wallet icons, account switching, declined connection, pending receipt preservation, late identity reads and explicit Disconnect. Connection-only checks submit zero transactions.
- `testReviewHeaderRecovery` passes: connection stays visible; pending/failure recovery and export preserve evidence and receipts; recovery makes only the fake receipt read.
- `testRecallUsability` passes through the synthetic purchase flow, including automatic receipt checks and verified-payment presentation. Its four simulated writes are handled entirely by the local fake provider and intercepted API, not a network or extension.
- Mobile at 390 px: connected wallet dialog is 358 px wide, has no horizontal overflow, and preserves the same selected wallet after refresh. Empty-wallet state also fits. No console errors or warnings observed on the inspected mobile page.

No user wallet, private key or production transaction was used. The user's completed Speechmatics review was not rerun or modified. A real-extension production refresh check remains for after publication.
