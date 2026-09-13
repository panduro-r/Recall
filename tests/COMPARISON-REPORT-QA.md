# Decision summary and comparison report QA

## Scope

The side-by-side comparison now includes a rules-based decision summary and an Export comparison button. Export creates a self-contained, printable HTML file with both plans, applied requirements, cost qualifiers, open conditions, catalog source links/dates and matching saved assessment results. No provider capture, wallet access, GenLayer submission, order or payment is performed by summary/export.

Saved results come from the existing read-only validation index: exact requirements and plan, latest capture, receipt/evidence binding, and exact source-contained quotations. Unavailable storage, unassessed captures and technical failures never become successful assessments. Historical findings stay separate from current catalog estimates. Only an explicit allowlisted projection is exported; wallet identity, local review IDs and full journals are omitted. The report is not a signed certificate.

## Tests

- 183 Node tests passed, including nine new report tests and one report-projection test.
- 31 Python server/provider-review route tests passed.
- Isolated localhost browser: 17 comparison-report checks passed on desktop and 390×844 mobile. Tested both applied/unapplied requirements, opt-out pricing, exact citations, offline-content safety, distinct timestamps, record corruption, visible feedback, and byte-for-byte storage preservation; zero API calls.
- Existing saved-review navigation: 17 checks passed.
- Existing side-by-side comparison: 22 checks passed.
- Existing comparison UI regression: 13 groups passed.
- Existing decision handoff: 23 review checks and 15 comparison handoff checks passed.

## Export visual verification

The exact HTML blob produced by the export handler was parsed and saved as an isolated local QA file. That file was opened in Chrome at 1200×1000 and 390×844. Typography and inline stylesheet loaded; there were no remote resource requests, scripts or console errors, and no page-level horizontal overflow. Print CSS was activated at 794px width for a print-style layout check; it showed table headers, readable text and public source URL annotations without overflow. This was not a physical printer or PDF-pagination test.

Direct blob navigation inherits the app's stricter CSP and is not the supported preview workflow. The supported workflow is downloading the HTML file and opening it in a browser, then optionally using Print / Save as PDF. App CSP remains unchanged.

Only synthetic fixtures were used for the local assessment tests. Live release verification is recorded separately after deployment.
