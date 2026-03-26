# Account Strategy Data Validation Report

- Date: 2026-03-20
- Env: development
- Branch: codex/fix/477-ai-quant-account-strategy-api
- Commit: 4032779d

## Result Matrix

- Interface Layer: PASS
- Adapter Layer: PENDING
- Component Layer: PENDING
- API E2E Smoke: BLOCKED
- Page Manual Smoke: BLOCKED

## Interface Layer

- Command:
  - 历史验证曾使用单用户 bootstrap signal 脚本；该入口现已移除
- Cases covered:
  - 历史单用户 Binance testnet context resolve
  - spot buy signal creation
  - real execution path (`executed=true`)
- Failures:
  - none

## Adapter Layer

- Command: pending (requires quantify runtime API stable)
- Cases covered: pending
- Failures: pending

## Component Layer

- Command: pending
- Cases covered: pending
- Failures: pending

## API E2E Smoke

- Command:
  - `curl http://localhost:3010/api/v1/account/ai-quant/strategies?...`
- Seed/Cleanup summary:
  - seed executed: `pnpm -C apps/quantify run prisma:db:seed`
  - 历史单用户 Binance seed 当时已准备好；当前仓库中该入口已移除
- Failures:
  - blocked by quantify startup error in `indicator_config` initialization

## Page Manual Smoke

- Checklist file: `docs/testing/account-strategy-page-manual-smoke-checklist.md`
- Evidence links or paths:
  - blocked (depends on quantify API availability)
- Failures:
  - quantify service unavailable on 3010 due startup exception

## Findings

1. Real order execution succeeded.
2. Persisted records verified:
- `strategy_signals.id=cmmyosvx10a0xownfqmrr9fid`, `status=EXECUTED`, `signal_type=ENTRY`, `direction=BUY`.
- `user_signal_executions` has matching row with `status=EXECUTED`, `order_side=BUY`, `executed_quantity=0.00014`, `executed_price=70752.99`.
- `trades` has latest BUY trade for `BTCUSDT`.
- `positions` has OPEN LONG position for `BTCUSDT` with matching quantity/avg entry price.
3. Quantify full service start is currently blocked by an existing runtime error at indicator config initialization (`indicatorConfig.findMany`), causing account strategy API unavailability.

## Next Actions

1. Fix quantify startup blocker (`indicatorConfig` runtime error) so `/account/ai-quant/strategies` API can be queried.
2. Re-run API smoke and page manual smoke to complete list/detail field validation.
3. After API恢复, verify list/detail fields: `status`, `returnPct`, `todayPnl`, `updatedAt`, `totalPnl`, `position`, `timeline`.
