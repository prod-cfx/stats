# Repository Boundary 2590 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove direct `txHost.tx` access from backend non-Repository modules covered by issue #2590 while preserving DataPull transaction semantics.

**Architecture:** Keep `DataPullTaskRunnerService.runClaimedTask()` as the transaction/afterCommit boundary. Move persistence and auth principal reads into existing repositories: `UserAuthRepository`, `RoleAssignmentRepository`, `DataSyncMarketDataRepository`, and `OpenInterestRepository`.

**Tech Stack:** NestJS, Prisma 7, `@nestjs-cls/transactional`, Jest, dx command wrapper.

---

## Files

- Modify: `apps/backend/src/modules/auth/strategies/jwt.strategy.ts` - inject repositories instead of `TransactionHost`.
- Modify: `apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts` - cover tokenVersion and role assignment repository paths.
- Modify: `apps/backend/src/modules/auth/repositories/user-auth.repository.ts` - add tokenVersion projection method.
- Modify: `apps/backend/src/modules/auth/repositories/role-assignment.repository.ts` - add role assignment existence method.
- Modify: `apps/backend/src/modules/data-sync/repositories/data-sync-market-data.repository.ts` - add batch write/read methods used by DataPull jobs.
- Modify: `apps/backend/src/modules/data-sync/jobs/*.job.ts` listed by the boundary rg command - replace direct `txHost.tx` with repository methods.
- Modify: `apps/backend/src/modules/open-interest/jobs/oi-ohlc-aggregated.job.ts` - replace direct `txHost.tx` with `OpenInterestRepository` method.
- Modify: `apps/backend/src/modules/open-interest/open-interest.repository.ts` and module export if needed.
- Create: `apps/backend/src/modules/repository-boundary.spec.ts` - filesystem boundary test for `txHost.tx` whitelist.

## Steps

- [ ] Step 1: RED auth test. Update `jwt.strategy.spec.ts` so `JwtStrategy` receives `UserAuthRepository` and `RoleAssignmentRepository` mocks. Add tests that `validate()` calls `findUserTokenVersion()` for USER payloads with `tokenVersion`, skips it for ADMIN payloads, calls `hasAssignment()` for resolved principal type, rejects mismatched tokenVersion, rejects missing role assignment, and never exposes a `txHost` mock. Run `dx test unit backend apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts`; expected fail is constructor/signature mismatch.
- [ ] Step 2: RED boundary test. Add `apps/backend/src/modules/repository-boundary.spec.ts` that scans `apps/backend/src/modules/**/*.ts`, ignores `*.spec.ts`, allows only filenames ending in `repository.ts` plus explicit infrastructure whitelist entries, and fails on `txHost.tx` in strategy/service/job files. Run `dx test unit backend apps/backend/src/modules/repository-boundary.spec.ts`; expected fail lists current direct access files.
- [ ] Step 3: GREEN auth repositories and strategy. Add `UserAuthRepository.findUserTokenVersion(userId)` and `RoleAssignmentRepository.hasAssignment(principalId, principalType)`. Replace `JwtStrategy` constructor `TransactionHost` with those repositories and update `validate()` to call them. Re-run auth spec.
- [ ] Step 4: GREEN DataPull repository methods. Add typed methods to `DataSyncMarketDataRepository` for `createLongShortRatioMany`, `createHyperliquidWhaleAlertsMany`, `upsertHyperliquidWhalePosition`, `createHyperliquidUserFundingMany`, `createHyperliquidUserFillsMany`, `createHyperliquidUserOrdersMany`, `upsertCoinsPriceChangeBatch`, `createAggregatedLiquidationHistoryMany`, `findEarliestFuturesPriceHistory`, `createFuturesPriceHistoryMany`, and `findFuturesPriceHistoryTimestamps`. Keep `skipDuplicates` and batching behavior equivalent to existing jobs.
- [ ] Step 5: GREEN DataPull jobs. Replace each direct `txHost.tx` access in data-sync jobs with repository injection/method calls. Keep all cursor, meta, batch, and retry logic unchanged.
- [ ] Step 6: GREEN open-interest job. Add `OpenInterestRepository.createOhlcHistoryMany()` and inject it into `CoinglassOiOhlcAggregatedJob`; export repository from `OpenInterestModule` if DataSync injection requires it.
- [ ] Step 7: Run focused tests. Run `dx test unit backend apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts apps/backend/src/modules/repository-boundary.spec.ts`; both pass.
- [ ] Step 8: Run boundary command. Run `rg -n "txHost\\.tx" apps/backend/src/modules --glob '!**/*repository.ts' --glob '!**/*.spec.ts'`; output must contain only explicit whitelist entries or be empty.
- [ ] Step 9: Parallel verification. Run `dx lint`, `dx build backend --dev`, and focused backend unit tests in parallel. Fix all failures and rerun all three.
- [ ] Step 10: Commit, push, conflict check, and PR. Commit on `refactor/2590-repository-boundary` with `Refs: #2590`, push, check merge conflicts with `origin/main`, and create PR with `Closes: #2590` and `Refs: #2587`. Mark PR as non-consumer and state no sentinel SQL is required.

## Verify

- `dx test unit backend apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts apps/backend/src/modules/repository-boundary.spec.ts`
- `rg -n "txHost\\.tx" apps/backend/src/modules --glob '!**/*repository.ts' --glob '!**/*.spec.ts'`
- `dx lint`
- `dx build backend --dev`

## Commit

```bash
git add -A
git commit -F - <<'MSG'
refactor: 收敛 backend repository 边界

变更说明：
- 将 JwtStrategy 的 tokenVersion 与角色分配读取移入 auth repository
- 将 DataPull job 持久化移入 repository 方法并保留 runner 事务边界
- 增加边界测试防止非 Repository 继续访问 txHost.tx

Refs: #2590
MSG
```
