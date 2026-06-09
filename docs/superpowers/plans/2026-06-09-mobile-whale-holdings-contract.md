# Mobile Whale Holdings Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect mobile Whale > Holdings to the generated Dart backend contract.

**Architecture:** Keep mobile UI and domain state unchanged. Replace the repository data source with `GeneratedBackendApi` and map generated `WhaleHoldingDto` objects into existing `WhaleHoldingPosition` view models.

**Tech Stack:** Flutter, Riverpod, Dio, built_value generated `backend_api_contracts`, `flutter_test`.

---

### Task 1: Repository Contract Test

**Files:**
- Create: `apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart`
- Modify: none

- [ ] **Step 1: Write failing test**

Create a test with a local Dio adapter that returns `/whale-holdings` JSON. Assert repository sends `page=1`, `limit=200`, `minPositionValueUsd=1000000`, and maps one `LONG` DTO into `WhaleHoldingPosition` fields.

- [ ] **Step 2: Run red test**

Run: `cd apps/quantify-mobile && flutter test test/data/api_whale_holdings_repository_generated_test.dart`

Expected: fail because `ApiWhaleHoldingsRepository` still expects `WhaleHoldingsService`, not `GeneratedBackendApi`.

### Task 2: Generated Contract Repository

**Files:**
- Modify: `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Modify: `apps/quantify-mobile/lib/data/providers/service_providers.dart`
- Modify: `apps/quantify-mobile/lib/data/services/whale_services.dart`

- [ ] **Step 1: Change repository dependency**

Update constructor to accept `GeneratedBackendApi` and remove `WhaleHoldingsService` dependency.

- [ ] **Step 2: Call generated API**

Use `getDefaultApi().whaleHoldingsControllerGetWhaleHoldings(page: 1, limit: 200, minPositionValueUsd: 1000000)`.

- [ ] **Step 3: Map DTO fields**

Map generated `WhaleHoldingDto` to `WhaleHoldingPosition` with compact USD, quantity, price, PnL percent, and relative snapshot time displays.

- [ ] **Step 4: Update providers**

Inject `generatedBackendApiProvider` into `ApiWhaleHoldingsRepository` and remove unused `whaleHoldingsServiceProvider` / `WhaleHoldingsService`.

### Task 3: Verification

**Files:**
- No production file edits expected.

- [ ] **Step 1: Run focused test**

Run: `cd apps/quantify-mobile && flutter test test/data/api_whale_holdings_repository_generated_test.dart`

- [ ] **Step 2: Run existing whale holdings tests**

Run: `cd apps/quantify-mobile && flutter test test/pages/whale_holdings_tab_test.dart test/domain/use_cases/whale_holding_use_cases_test.dart`

- [ ] **Step 3: Run build gate**

Run: `dx build quantify-mobile --dev` from repo root if target exists; otherwise run `cd apps/quantify-mobile && flutter analyze` and document target absence.
