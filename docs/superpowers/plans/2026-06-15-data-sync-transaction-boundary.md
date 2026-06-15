# Data Sync Transaction Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move data-sync non-HTTP transaction/afterCommit wrapping to the orchestrator so each data pull job runs through one consistent boundary.

**Architecture:** `DataSyncOrchestrator` owns the `TransactionEventsService.withAfterCommit()` boundary around `DataPullJob.run(ctx)`. Jobs no longer inject or call `TransactionEventsService`; they keep their existing internal `execute(ctx)` logic and expose `run(ctx)` as direct execution. The independent markets cleanup cron gets its own explicit `withAfterCommit()` wrapper because it does not run through the data-sync orchestrator.

**Tech Stack:** NestJS, Jest, TypeScript, repository pattern with `TransactionHost` participation.

---

## Files

- Modify: `apps/backend/src/modules/data-sync/data-sync-orchestrator.service.ts`
- Create: `apps/backend/src/modules/data-sync/data-sync-orchestrator.service.spec.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/binance-kline-history.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-aggregated-liquidation.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-coins-price-change.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-futures-price-history.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-futures-price-history-job.spec.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-long-short-ratio.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-pairs-markets.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-whale-alert.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/coinglass-whale-position.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/hyperliquid-user-fills-sync.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/hyperliquid-user-funding-sync.job.ts`
- Modify: `apps/backend/src/modules/data-sync/jobs/hyperliquid-user-orders-sync.job.ts`
- Modify: `apps/backend/src/modules/markets/jobs/cleanup-old-trades.job.ts`
- Create: `apps/backend/src/modules/markets/jobs/cleanup-old-trades.job.spec.ts`

## Steps

- [ ] Write failing orchestrator unit tests proving `runDueTasks()` invokes a due job through `txEvents.withAfterCommit()` and preserves success/failure updates.
- [ ] Run `dx test unit backend apps/backend/src/modules/data-sync/data-sync-orchestrator.service.spec.ts` and confirm RED because `DataSyncOrchestrator` does not inject or call `TransactionEventsService` yet.
- [ ] Inject `TransactionEventsService` into `DataSyncOrchestrator` and wrap only `job.run(ctx)` in `this.txEvents.withAfterCommit(() => job.run(ctx))`.
- [ ] Run the orchestrator spec and confirm GREEN.
- [ ] Write failing static regression in the orchestrator spec that scans `apps/backend/src/modules/data-sync/jobs/*.job.ts` and rejects production job files containing `withAfterCommit(`.
- [ ] Run the orchestrator spec and confirm RED from current job-level wrappers.
- [ ] Remove `TransactionEventsService` imports, constructor params, and `this.txEvents.withAfterCommit(() => this.execute(ctx))` wrappers from all data-sync jobs; keep `run(ctx)` returning `this.execute(ctx)`.
- [ ] Update job unit tests that constructed `txEvents` mocks so constructors match the new signatures.
- [ ] Run the orchestrator spec and focused affected job specs until GREEN.
- [ ] Write failing markets cleanup cron spec proving `CleanupOldTradesJob.handleCron()` runs repository cleanup inside `txEvents.withAfterCommit()`.
- [ ] Run `dx test unit backend apps/backend/src/modules/markets/jobs/cleanup-old-trades.job.spec.ts` and confirm RED because cleanup cron lacks the wrapper.
- [ ] Inject `TransactionEventsService` into `CleanupOldTradesJob` and move existing cleanup body into `this.txEvents.withAfterCommit(async () => { ... })`.
- [ ] Run cleanup cron spec and confirm GREEN.

## Verify

- `rg -n "withAfterCommit\(" apps/backend/src/modules/data-sync/jobs -g '*.job.ts'` returns no production job matches.
- `dx test unit backend apps/backend/src/modules/data-sync/data-sync-orchestrator.service.spec.ts`
- `dx test unit backend apps/backend/src/modules/data-sync/jobs/coinglass-futures-price-history-job.spec.ts`
- `dx test unit backend apps/backend/src/modules/markets/jobs/cleanup-old-trades.job.spec.ts`
- Parallel final gate: `dx lint`, `dx build backend --dev`, affected unit tests above.

## Commit

Use branch `codex/refactor/2474-data-sync-transaction-boundary` and commit:

```bash
git commit -F - <<'MSG'
refactor: centralize data-sync transaction boundary

变更说明：
- DataSyncOrchestrator 统一包裹 DataPullJob.run，避免 job 自行选择非 HTTP 事务模式
- 移除 data-sync job 内部重复 withAfterCommit 包装，并补充回归测试
- 为独立 markets cleanup cron 增加显式 afterCommit 边界

Closes: #2474
MSG
```
