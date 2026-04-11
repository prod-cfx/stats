# Issue #744 Clean Deploy Rerun + OKX Attribution

## Scope
- Branch: `codex/fix/744-ai-quant-staging-regressions`
- Clean deploy CI run: `24285741023`
- Clean rerun head: `5c0e185d3b609274e6f6d8cc92c1e69f4fa8e2a8`
- Verification date: `2026-04-11`

## Clean deploy result

### PASS
- `deploy-backend` → success
- `deploy-quantify` → success
- `deploy-front` → success
- `deploy-admin` → success

This satisfies the clean-deploy boundary required before attributing the remaining OKX bind failure.

## Fresh staging auth + bind rerun

Using the staging fixed-OTP login flow for the real verification user:
- `POST /api/v1/auth/email/send-code` → `200`
- `POST /api/v1/auth/email/verify-code` with fixed staging OTP → `200`
- authenticated user id: `cmmympw8p00018uqsmuxluzl2`

Fresh authenticated API results on the clean deploy:
- `GET /api/v1/account/exchange-accounts` before bind → `200`, payload `[]`
- first `POST /api/v1/account/exchange-accounts` for OKX testnet bind → `503`
  - `error.code = SERVICE_TEMPORARILY_UNAVAILABLE`
  - `error.args.reasonMessage = 量化服务暂时不可用，请稍后重试`
- immediate retry `POST /api/v1/account/exchange-accounts` with the same payload → `400`
  - `error.code = TRADING_INVALID_CREDENTIALS`
  - `error.args.reasonCode = INVALID_API_KEY`
- `GET /api/v1/account/exchange-accounts` after bind attempts → `200`, payload `[]`
- `GET /api/v1/backtesting/capabilities` → `200`, payload still empty arrays

Evidence:
- `tmp/issue-744-staging-evidence-live/clean-send-code.json`
- `tmp/issue-744-staging-evidence-live/clean-verify-email.json`
- `tmp/issue-744-staging-evidence-live/clean-exchange-accounts-before.json`
- `tmp/issue-744-staging-evidence-live/clean-exchange-account-upsert.json`
- `tmp/issue-744-staging-evidence-live/clean-exchange-account-upsert-retry.json`
- `tmp/issue-744-staging-evidence-live/clean-exchange-accounts-after.json`
- `tmp/issue-744-staging-evidence-live/clean-backtesting-capabilities.json`
- `tmp/issue-744-staging-evidence-live/clean-summary.json`

## Additional authenticated AI Quant probe

Using the fresh bearer token against the backend AI Quant API:
- `GET /api/v1/backtesting/capabilities` → `200`
- `POST /api/v1/llm-strategy-codegen/sessions` → `201`
- `POST /api/v1/llm-strategy-codegen/sessions/:id/messages` → `400 BAD_REQUEST`

Interpretation:
- The clean deploy restored general backend/quantify availability.
- The bind path is no longer blocked by the earlier deploy failures.

## Direct OKX attribution probe

A direct OKX REST probe was executed against `/api/v5/account/balance` using the same locally provided demo credentials:
- live mode → `401`, `code = 50113`, `msg = Invalid Sign`
- simulated-trading mode (`x-simulated-trading: 1`) → `401`, `code = 50113`, `msg = Invalid Sign`

Evidence:
- `tmp/issue-744-staging-evidence-live/direct-okx-probe-summary.json`

## Attribution

Final attribution: **key / credential-set problem**.

Why:
1. The required clean deploy boundary is now satisfied (`24285741023` green).
2. On the clean staging runtime, the bind path still reproduces `TRADING_INVALID_CREDENTIALS / INVALID_API_KEY` after an immediate retry.
3. An independent direct OKX probe with the same credential set fails with `401 50113 Invalid Sign` in both normal and simulated-trading modes.
4. Therefore the remaining blocker is no longer the deploy pipeline; it is the provided OKX credential set (API key / secret / signature validity), not a stale dirty deploy conclusion.

## Conclusion

After a green clean deploy rerun, staging still cannot bind the provided OKX demo credentials. Combined with direct OKX `Invalid Sign` responses, the evidence now supports attributing the remaining failure to the credential set itself rather than the deploy pipeline.
