# Issue #744 OKX Import Live Rerun

## Scope

- Task lane: worker-3 deploy CI + real staging verification rerun after tasks 1 and 2 completed.
- Branch/workflow target: `codex/fix/744-ai-quant-staging-regressions`
- Deploy workflow run: `CI` / `24284851854`
- Deploy head SHA: `bbdde29bbe8de1d34fd134cc2d09541cf345695e`
- Verification date: `2026-04-11`

## Deploy CI result

### PASS

- `deploy-front` → `success`
- `deploy-admin` → `success`

### FAIL

- `deploy-backend` → `failure`
- `deploy-quantify` → `failure`

Observed failure signatures from the run logs:

1. **backend deploy build dependency resolution failure**
   - `shared:build` / `api-contracts:build` / `config:build` fail while resolving the TypeScript binary path.
   - Representative error:
     - `Cannot find module '/home/runner/work/node_modules/.pnpm/typescript@5.9.2/node_modules/typescript/bin/tsc'`
2. **quantify deploy prisma/build failure**
   - `shared:build` and `config:build` hit the same TypeScript binary resolution problem.
   - `quantify:prisma:generate` additionally fails with:
     - `ENOTDIR: not a directory, mkdir '/home/runner/work/stats/stats/apps/quantify/generated'`

Interpretation:
- This required “run deploy CI once” leg was executed.
- The integrated deploy is **not green**, so any live staging verification after this point reflects the last successfully deployed staging runtime rather than the failed `bbdde29b` deploy attempt.

## Authenticated staging rerun

### PASS — fixed OTP login still works for the intended staging user

Using the staging fixed OTP flow for the real verification user:

1. `POST /api/v1/auth/email/send-code` → `200`
2. `POST /api/v1/auth/email/verify-code` with `123456` → `200`

Evidence:
- `tmp/issue-744-staging-evidence-live/live-send-code-541.json`
- `tmp/issue-744-staging-evidence-live/live-verify-email-541.json`

## OKX demo credential import/bind rerun

### FAIL — real OKX bind still rejects the provided demo credentials

Using the locally provided OKX demo credentials through the real staging backend BFF:

- `GET /api/v1/account/exchange-accounts` before bind → `200`, payload `[]`
- `POST /api/v1/account/exchange-accounts` with `exchangeId=okx`, `isTestnet=true`, `apiKey/apiSecret/passphrase` → `400`
- `GET /api/v1/account/exchange-accounts` after bind → `200`, payload `[]`

Returned error envelope:

- `error.code = TRADING_INVALID_CREDENTIALS`
- `error.args.reasonCode = INVALID_API_KEY`
- `error.args.reasonMessage = API Key无效，请检查是否正确复制`
- `error.requestId = issue-744-worker3-bind-0fb3d026bd1140428ffbbdeaf5c7cd79`

Evidence:
- `tmp/issue-744-staging-evidence-live/live-exchange-accounts-before.json`
- `tmp/issue-744-staging-evidence-live/live-exchange-account-upsert.json`
- `tmp/issue-744-staging-evidence-live/live-exchange-accounts-after.json`

Interpretation:
- The account-binding transport path is reachable.
- The remaining live blocker has moved to upstream credential validation for the provided OKX demo credentials, not an empty-account transport outage.

## Fresh staging API state

### FAIL — this user still has no bound exchange accounts

- `GET /api/v1/account/exchange-accounts` → `200`
- Payload remains `[]` for the intended verification user after the live bind attempt.

### FAIL — backtesting capabilities are still empty

- `GET /api/v1/backtesting/capabilities` → `200`
- Payload:
  - `allowedSymbols=[]`
  - `allowedBaseTimeframes=[]`

### Mixed — account conversation data and script-based codegen probes do not reach a usable pre-backtest run

- `GET /api/v1/account/ai-quant/conversations` on the older cached session showed a drafting conversation.
- The direct quantify staging checklist script rerun produced:
  - `capabilities` → `200`
  - `codegen-start` → `401 UNAUTHORIZED`

Evidence:
- `tmp/issue-744-staging-evidence-live/account_exchange-accounts.json`
- `tmp/issue-744-staging-evidence-live/backtesting_capabilities.json`
- `tmp/issue-744-staging-evidence-live/account_ai-quant_conversations.json`
- `tmp/issue-744-staging-evidence-live/ai-quant-staging-e2e-check.txt`

## Fresh staging UI state

### FAIL — account page still shows OKX as unconfigured

Authenticated account AI Quant page text shows:

- `BINANCE 未配置`
- `OKX 未配置`
- `Hyperliquid 未配置`

### FAIL — AI Quant page still does not reach a usable pre-backtest state

Authenticated AI Quant page text shows:

- conversation remains clarification-gated on `该策略运行在现货还是合约市场？`
- `回测能力加载失败，请稍后重试。`
- no evidence of a successful bound OKX account becoming available to the flow

Evidence:
- `tmp/issue-744-staging-evidence-live/account-ai-quant-page.png`
- `tmp/issue-744-staging-evidence-live/ai-quant-page-fresh.png`

## PASS / FAIL summary

- **PASS** task-3 deploy CI was executed once on the latest 744 branch head
- **PASS** staging fixed-OTP login still works for the intended verification user
- **FAIL** deploy-backend failed in CI due TypeScript binary resolution during dependent package builds
- **FAIL** deploy-quantify failed in CI due the same TypeScript binary resolution issue plus `apps/quantify/generated` `ENOTDIR` during prisma generation
- **FAIL** live OKX demo credential import still returns `TRADING_INVALID_CREDENTIALS / INVALID_API_KEY`
- **FAIL** exchange account list remains empty before and after the bind attempt
- **FAIL** backtesting capabilities remain empty on staging
- **FAIL** authenticated UI still shows OKX unconfigured and AI Quant blocked before usable backtest progression

## Conclusion

Issue #744's post-fix rerun does **not** currently pass acceptance on staging.

The required deploy CI rerun was executed, but the latest branch deploy failed for backend and quantify. On the live staging runtime, the intended verification user can still log in, yet the real OKX bind attempt fails with `TRADING_INVALID_CREDENTIALS / INVALID_API_KEY`, no exchange account is created, backtesting capabilities remain empty, and the AI Quant UI does not reach a usable pre-backtest state.
