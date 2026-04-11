# Issue #744 Staging Deploy + Live Verification Report

## Scope

- Task lane: worker-3 deploy + real staging verification
- Deployed runtime code head: `codex/fix/744-ai-quant-staging-regressions` @ `3e237307ea16f1b114695ce623f2c4f2b7f0a1a4`
- Current leader-integrated head in this worktree: `81d37fd82d37aaa0670373f0655638bd734a8def`
- Head-diff note: `git diff --name-only 3e237307..81d37fd8` only reports this markdown file, so the deployed runtime code matches the current integrated code content for issue #744.
- Deploy workflow run: `CI #745` / `24283847133`
- Verification date: `2026-04-11`

## Deploy Result

### PASS — GitHub Actions deploy run succeeded

Workflow: `CI #745` (`https://github.com/AlphaNet7ed/stats/actions/runs/24283847133`)

Jobs:
- `deploy-front` → `success`
- `deploy-admin` → `success`
- `deploy-backend` → `success`
- `deploy-quantify` → `success`

Notable post-deploy checks that passed inside CI:
- quantify artifact fingerprint check
- quantify DB migrate deploy / schema audit step

## Authenticated Staging Evidence

### PASS — staging auth is usable for real verification

Using the staging fixed email OTP flow:
1. `POST /api/v1/auth/email/send-code` → `200`
2. `POST /api/v1/auth/email/verify-code` with `123456` → `200`

This produced a real JWT and authenticated staging user session for live verification.

Local evidence files:
- `tmp/issue-744-staging-evidence/send-code.json`
- `tmp/issue-744-staging-evidence/verify-email.json`

Durability note:
- The `tmp/issue-744-staging-evidence/` files were local capture artifacts from the live verification session and are not committed into this repository/worktree.
- This report is the durable branch record for the deploy result, staging screenshots, and API observations summarized below.

## Screenshots

Local screenshot artifacts captured during authenticated staging verification:
- `tmp/issue-744-staging-evidence/ai-quant-page.png`
- `tmp/issue-744-staging-evidence/account-ai-quant-api-config.png`

What they show:
1. **AI Quant page screenshot** — authenticated user is on the real staging `/zh/ai-quant` page; the server-backed conversation is present and rendered in the chat UI.
2. **Account/API config screenshot** — authenticated user has no configured exchange accounts; the AI Quant account tab shows empty strategy/runtime state and blank exchange API config forms.

## Live API Verification

### PASS — backend runtime availability regression is fixed for codegen session transport

Observed after the fresh deploy:
- `POST /api/v1/llm-strategy-codegen/sessions` → `200`
- Response created real session `cmnuedee607pasvqsmbdreh5y`
- `GET /api/v1/llm-strategy-codegen/sessions/:id` → `200`
- The conversation is persisted and visible on the staging AI Quant page

This is the key regression fix verification: the session endpoints no longer fail with the staging runtime `503 SERVICE_TEMPORARILY_UNAVAILABLE` behavior previously seen for this issue.

Evidence files:
- `tmp/issue-744-staging-evidence/codegen-start.json`
- `tmp/issue-744-staging-evidence/codegen-session.json`
- `tmp/issue-744-staging-evidence/codegen-session-final.json`
- `tmp/issue-744-staging-evidence/ai-quant-page.png`

### FAIL — backtesting capabilities are still unavailable for real use

- `GET /api/v1/backtesting/capabilities` → `200`
- Payload: `allowedSymbols=[]`, `allowedBaseTimeframes=[]`

Interpretation:
- Transport is healthy, but staging still cannot present usable backtesting capabilities to the AI Quant flow.
- This blocks a real backtest submission from the front-end path.

Evidence file:
- `tmp/issue-744-staging-evidence/capabilities.json`

### FAIL — this authenticated staging user has no exchange accounts

- `GET /api/v1/account/exchange-accounts` → `200`
- Payload: `[]`

Impact:
- A real deploy leg cannot be completed for this user because there is no exchange account to bind.

Evidence files:
- `tmp/issue-744-staging-evidence/exchange-accounts.json`
- `tmp/issue-744-staging-evidence/account-ai-quant-api-config.png`

### FAIL — real codegen flow remains clarification-gated and did not reach publication in this live session

The live session progressed past session creation and persisted correctly, but remained in clarification mode.

Observed behavior:
- The server requested missing `exchange` / `marketType` clarification instead of failing at transport/runtime.
- After answering, the server eventually narrowed the issue to a `market.conflict.marketType` clarification item with allowed answers `perpetual futures` / `futures`.
- The session remained `DRAFTING` and did not publish script code / snapshot during this verification window.

Important nuance:
- This is **not** the original runtime-availability failure. Responses stayed structured and reachable throughout.
- The remaining issue is now a live semantic/clarification progression problem, not a `503` transport outage.

Evidence files:
- `tmp/issue-744-staging-evidence/codegen-step1.json`
- `tmp/issue-744-staging-evidence/codegen-step2.json`
- `tmp/issue-744-staging-evidence/codegen-step3-confirm.json`
- `tmp/issue-744-staging-evidence/codegen-step4-exchange.json`
- `tmp/issue-744-staging-evidence/codegen-step8-marketType-futures.json`
- `tmp/issue-744-staging-evidence/codegen-step9-resolve-market-type.json`
- `tmp/issue-744-staging-evidence/codegen-session-final3.json`

## PASS / FAIL Summary

- **PASS** deploy workflow succeeded on the integrated branch head
- **PASS** staging auth works and can create a real authenticated AI Quant session
- **PASS** codegen session start/get transport is healthy after deploy (no recurring staging `503`)
- **FAIL** backtesting capabilities are empty on staging
- **FAIL** this staging user has no exchange accounts, so deploy cannot be completed
- **FAIL** the tested live codegen conversation remained clarification-gated and did not reach publication during this run

## Conclusion

Issue #744's **runtime-availability regression appears fixed** in staging for the critical codegen session endpoints: the freshly deployed backend now creates and serves real codegen sessions instead of failing with the prior `503` outage pattern.

However, the **full real AI Quant flow still does not pass end-to-end** in staging because backtesting capabilities are empty, the verification user has no exchange accounts, and the tested live conversation remained stuck in clarification/conflict handling rather than publishing a strategy snapshot.
