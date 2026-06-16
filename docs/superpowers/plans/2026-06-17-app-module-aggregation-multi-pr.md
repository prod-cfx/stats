# AppModule Business Aggregation Multi-PR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor backend `AppModule` so it imports infrastructure and domain aggregation modules instead of directly importing business leaf modules.

**Architecture:** Keep all existing controllers, providers, routes, and feature modules in place. Add thin NestJS aggregation modules under `apps/backend/src/modules/app-aggregation/` that group existing leaf modules by domain, then replace direct business imports in `AppModule` with those aggregation modules. Lock the boundary with a TypeScript AST unit test that reads `AppModule` metadata and fails if leaf modules are imported directly again.

**Tech Stack:** NestJS modules, TypeScript AST, Jest via `dx test unit backend`, Nx backend build via `dx build backend --dev`.

---

**Track:** C
**Total PRs:** 1
**Issue:** #2592

## PR Topology

| PR | Title | Scope | Depends On | Sentinel Required |
| --- | --- | --- | --- | --- |
| PR1 | refactor: aggregate backend app modules | backend NestJS module topology + boundary unit test | - | No |

This is a single train segment because there is no schema change, no writer/consumer runtime data dependency, and no API contract change.

## Files

- Create: `apps/backend/src/modules/app-aggregation/admin-api.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/market-data.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/notification-data-sync.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/ai-quant-bridge.module.ts`
- Create: `apps/backend/src/modules/app-module-boundary.spec.ts`
- Modify: `apps/backend/src/modules/app.module.ts`

## PR1 Detail

### Task 1: Add AppModule boundary RED test

**Files:**
- Create: `apps/backend/src/modules/app-module-boundary.spec.ts`

- [ ] Step 1: Create a Jest spec that parses `AppModule` with the TypeScript compiler API, extracts the `@Module({ imports: [...] })` identifiers, and asserts that leaf business modules such as `MarketsModule`, `KlineModule`, `WhaleAlertModule`, and `DataSyncModule` are absent while domain aggregators are present.
- [ ] Step 2: Run `dx test unit backend apps/backend/src/modules/app-module-boundary.spec.ts` and verify it fails because `AppModule` still imports leaf modules directly.

### Task 2: Add thin aggregation modules

**Files:**
- Create: `apps/backend/src/modules/app-aggregation/admin-api.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/market-data.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/notification-data-sync.module.ts`
- Create: `apps/backend/src/modules/app-aggregation/ai-quant-bridge.module.ts`

- [ ] Step 1: Create `AdminApiModule` importing `SettingsModule`, `UserModule`, `AuthModule`, `BetaCodeModule`, and `AdminModule`.
- [ ] Step 2: Create `MarketDataModule` importing market and config leaf modules: markets, liquidation heatmap, aggregated liquidation, orderbook config, aggregated orderbook, kline, trades config, exchange config, open interest, polymarket, and crypto stock quotes.
- [ ] Step 3: Create `NotificationDataSyncModule` importing `DataSyncModule` plus whale alert/notification/tracking/holdings modules.
- [ ] Step 4: Create `AiQuantBridgeModule` importing `AccountExchangeAccountsModule` and `AiQuantProxyModule`.
- [ ] Step 5: Do not add `forwardRef()` anywhere.

### Task 3: Replace AppModule business imports

**Files:**
- Modify: `apps/backend/src/modules/app.module.ts`

- [ ] Step 1: Remove direct imports for business leaf modules now covered by aggregators.
- [ ] Step 2: Import `AdminApiModule`, `MarketDataModule`, `NotificationDataSyncModule`, and `AiQuantBridgeModule` from `./app-aggregation/*`.
- [ ] Step 3: Keep infrastructure imports in `AppModule`: config, environment, CLS, event emitter, logger, cache, rate limit, Prisma, schedule, and `HealthModule`.
- [ ] Step 4: Replace the stale business-trimming comment with a short accurate aggregation comment.

### Task 4: Verify route surface and build

**Files:**
- Test: `apps/backend/src/modules/app-module-boundary.spec.ts`

- [ ] Step 1: Run three verification commands in parallel: `dx lint`, `dx build backend --dev`, and `dx test unit backend apps/backend/src/modules/app-module-boundary.spec.ts`.
- [ ] Step 2: If any command fails, fix the issue and rerun all three commands in parallel until all pass.

## Commit

Commit title: `refactor: aggregate backend app modules`

Commit trailer: `Closes: #2592`

## PR Body Notes

- Include `Closes: #2592` and `Refs: #2587`.
- State this is not a consumer-side PR; sentinel SQL is not applicable because no writer/consumer data flow or schema change exists.
