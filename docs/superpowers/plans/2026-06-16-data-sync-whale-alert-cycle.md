# Data Sync Whale Alert Cycle Implementation Plan

**Goal:** Remove the `DataSyncModule <-> WhaleAlertModule` circular dependency while preserving Hyperliquid whale trade ingestion and notification orchestration.
**Track:** B
**Issue:** #2530

## Files

- Create `apps/backend/src/modules/whale-alert/whale-alert-ingestion.service.ts`
- Create `apps/backend/src/modules/whale-alert/whale-alert-ingestion.module.ts`
- Modify `apps/backend/src/modules/whale-alert/whale-alert.service.ts`
- Modify `apps/backend/src/modules/whale-alert/whale-alert.module.ts`
- Modify `apps/backend/src/modules/data-sync/data-sync.module.ts`
- Modify `apps/backend/src/modules/data-sync/services/adapters/hyperliquid/hyperliquid-trades-ws.base.ts`
- Modify `apps/backend/src/modules/data-sync/services/adapters/hyperliquid-dex-perpetual-trades-ws.adapter.ts`
- Modify `apps/backend/src/modules/data-sync/services/adapters/trades-ws-layering.spec.ts`

## Steps

1. Add failing static regression coverage to `trades-ws-layering.spec.ts`:
   - Assert `DataSyncModule` source no longer contains `forwardRef(() => WhaleAlertModule)`.
   - Assert `WhaleAlertModule` source no longer contains `forwardRef(() => DataSyncModule)`.
   - Assert Hyperliquid trades adapter source imports/injects the ingestion token, not `WhaleAlertService`.

2. Extract ingestion boundary:
   - Add `WhaleAlertIngestionService` with `getActiveWhaleAddresses()` and `recordWhaleTrade(payload)`.
   - Move repository write + notification orchestration logic from `WhaleAlertService.recordWhaleTrade()` into ingestion service.
   - Keep query behavior in `WhaleAlertService`; no controller/API change.

3. Add narrow module:
   - Add `WhaleAlertIngestionModule` importing `PrismaModule` and `WhaleNotificationModule`.
   - Provide/export `WhaleAlertRepository`, `WhaleAlertIngestionService`, and `WHALE_ALERT_INGESTION_SERVICE` token.

4. Rewire modules/adapters:
   - `DataSyncModule` imports `WhaleAlertIngestionModule` instead of `forwardRef(() => WhaleAlertModule)`.
   - `WhaleAlertModule` removes `DataSyncModule` import and `forwardRef` import.
   - Hyperliquid trades adapter base and concrete adapter inject `WHALE_ALERT_INGESTION_SERVICE`.

5. Run focused regression first, then full verification.

## Verify

- Red first: `dx test unit backend apps/backend/src/modules/data-sync/services/adapters/trades-ws-layering.spec.ts`
- Green focused: same command after implementation.
- Parallel final gate:
  - `dx lint`
  - `dx build backend --dev`
  - `dx test unit backend apps/backend/src/modules/data-sync/services/adapters/trades-ws-layering.spec.ts`

## Commit

`refactor: break data-sync whale-alert module cycle`

Refs: #2530
