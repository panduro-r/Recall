# Prototype verification — September 4, 2026

## Completed

- 67 automated tests passed: 50 Recall contract/scenario cases, 6 local server boundary cases, and 11 existing IntentLatch regression cases. Run output is saved as `test-results.xml`.
- GenVM linter: three safety checks passed; SDK semantic validation passed, identifying Recall with eight write methods and one view method.
- GenVM type checker: no type errors after checking against the pinned SDK. Invoke from the activated parent virtual environment so the installed Pyright executable is on PATH.
- JavaScript syntax check: passed.
- Browser: ran upheld, rejected, and missing-evidence cases through the UI. Verified 0.085/0.080 test-GEN scheduled totals, affected-only blocking, immutable old permit plus replacement, evidence row inspection, and UNKNOWN status for unavailable evidence. No browser console errors were observed at the final check.
- Responsive check: tested a 390 × 844 viewport override. Layout viewport was 375 px wide with its scrollbar; document width matched it. The 420 px purchase table scrolls within its own container. Restored the default viewport afterward.
- Production release checkout remains clean. No Git push, production build, public deployment, wallet connection, or blockchain transaction was performed.

## Corrected during implementation

- Current web-access docs show `status_code`; the project's pinned SDK uses `status`. Verified the installed response type and corrected the contract.
- Explicitly rejected a missing HTTP response body to satisfy the type checker as well as fail-closed behavior.
- Restricted evidence to an immutable Git commit root and safe text paths; escaped URL patterns in the test mocks.
- Hid stale replay output and disabled scenario selection while a new run is in progress.

## Not established

No live AI accuracy, prompt-injection resistance, supplier authenticity, real validator consensus, network deployment compatibility, transaction/finality timing, external payment delivery, actual agent recovery, or customer demand has been established. This is not a security audit. The detailed limitations and next live-network checkpoint are in `README.md`.
