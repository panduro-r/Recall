# Recall on Vercel

This is a separate static frontend and bounded Python API, not the local development server. No server wallet, private-key configuration, faucet, signing, broadcasting or local VM replay is included.

## GitHub import

The generated `deploy/` directory is the self-contained Vercel project. Select:

- Repository: `panduro-r/Recall`, branch `main`.
- Project name: `recall` (or another available name).
- Application/Framework Preset: **Other**, not the generic Python framework preset.
- Root Directory: **deploy**.
- Build/Output overrides: leave off; `deploy/vercel.json` specifies an empty build command and `public` output.
- Environment variables: none for the default Vercel URL. Keep Vercel's automatically exposed system environment variables enabled. Never add wallet keys.
- Do not include files outside the root directory in the build.

The root repository's automatic-deployment opt-out is preserved for the old project. The isolated `deploy/` configuration does not opt out; importing it creates a new Vercel project and future pushes may trigger builds there.

For a custom domain only, set `RECALL_PUBLIC_ORIGIN` to its exact HTTPS origin (no path). The API checks Vercel's deployment/production host variables and that optional origin. It rejects foreign origins and forwarded-host overrides. These checks are not user authentication or distributed abuse protection. Configure Vercel firewall/rate limits and usage alerts before wider distribution; per-instance concurrency limits do not cap global spend.

## What is hosted

- `/`: archived user-approved wallet run with exact public receipts and pinned evidence.
- `/recorded`: earlier, separately labeled multi-service experiment.
- `/purchase`: new wallet-controlled Studio test or public deployment inspection. Every write remains in the browser wallet.
- `/api/session/*`: bounded inspection, receipt verification and unsigned request preparation against the fixed Studio RPC.
- `/api/run`: deliberately unavailable. Scripted VM replay remains local.

`node hosting/build.mjs` generates a fresh allowlisted `.build/recall-vercel-*` artifact plus a hash manifest. It never uploads the workspace. `deploy/` is generated from that artifact when preparing the repository release; do not hand-edit its duplicate source files.

## Post-deploy checks (required before submission)

1. Open the actual deployment URL logged out: both recorded purchases, evidence expansion and JSON download must work.
2. Check `/api/session/config` responds with Studio chain `61999` and `/api/run` returns 404.
3. At `/purchase`, resume the recorded public deployment hash. This is read-only; do not repeat the completed payment.
4. Inspect the returned state and test the page at phone width. Check same-origin POST routing and cold-start behavior on Vercel, not only locally.
5. Optionally start a fresh four-role Studio run; the user must approve any wallet writes. No real assets.
6. Add the tested deployment URL to the submission draft. A successful local build alone is not a verified hosted deployment.

Runtime: Python 3.12 and `genlayer-py==0.18.0`. Python API-directory handlers and static output are documented at https://vercel.com/docs/functions/runtimes/python/api-directory and https://vercel.com/docs/project-configuration/vercel-json . The function budget is 60 seconds; network failures return an unavailable state and never trigger a server-side transaction retry.
