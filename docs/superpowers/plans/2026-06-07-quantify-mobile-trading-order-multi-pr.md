# Quantify Mobile Trading Order Multi-PR Implementation Plan

**Goal:** `USE_MOCK=false` 时，交易下单入口不再在客户端伪造成功，先建立真实数据层，再由 sheet 消费真实 context / submit 结果。
**Track:** C
**Total PRs:** 2
**Issue:** #2307

## PR 拓扑（按硬依赖拓扑序）

| PR | PR 标题 | 涵盖层 | 依赖 PR | 是否需哨兵 |
|---|---|---|---|---|
| PR1 | feat: add mobile trading order repository | mobile data models + repository + provider + tests | - | 否 |
| PR2 | feat: wire trade order sheet to repository | mobile widget consumer + error UI + widget tests | PR1 | 否 |

## PR1 Detail: feat: add mobile trading order repository

**Files:**
- Create `apps/quantify-mobile/lib/data/models/trading_order_models.dart`
- Create `apps/quantify-mobile/lib/data/repositories/trading_order_repository.dart`
- Create `apps/quantify-mobile/lib/data/mock/mock_trading_order_repository.dart`
- Create `apps/quantify-mobile/lib/data/api/api_trading_order_repository.dart`
- Modify `apps/quantify-mobile/lib/data/repositories/repositories.dart`
- Modify `apps/quantify-mobile/lib/data/models/models.dart`
- Modify `apps/quantify-mobile/lib/data/api/api.dart`
- Modify `apps/quantify-mobile/lib/data/providers/repository_providers.dart`
- Add `apps/quantify-mobile/test/data/trading_order_repository_test.dart`

**Tasks:**
1. Add failing tests for mock context / preview / submit and API submit request body.
2. Add domain models for order side, kind, margin mode, context, preview, request, result.
3. Add repository interface with `getOrderContext(symbol)`, `previewOrder(request)`, `submitOrder(request)`.
4. Add mock repository preserving current mock behavior: balance 1248.40, taker fee 0.0005, liquidation coefficient 0.9, deterministic mock `orderId`.
5. Add API repository: context reads `AccountRepository.getInfo()` for true balance; preview returns empty/disabled estimates when backend has no preview endpoint; submit posts to `/account/trading/orders` and parses `orderId` or `requestId`.
6. Register `tradingOrderRepositoryProvider` selected by `useMockProvider`.
7. Verify from `apps/quantify-mobile`: `flutter test test/data/trading_order_repository_test.dart`, `flutter analyze`; from repo root: `dx lint`, `dx build affected --dev`, focused tests.

**Commit:** `feat: add mobile trading order repository`

## PR2 Detail: feat: wire trade order sheet to repository

**Files:**
- Modify `apps/quantify-mobile/lib/pages/market/widgets/qz_trade_order_sheet.dart`
- Modify `apps/quantify-mobile/lib/pages/market/widgets/qz_trade_order_sheet.summary.part.dart`
- Modify `apps/quantify-mobile/test/widgets/qz_trade_order_sheet_test.dart`

**Tasks:**
1. Convert sheet to `ConsumerStatefulWidget` and read `tradingOrderRepositoryProvider`.
2. Load order context on open; real mode balance comes from repository context, mock mode keeps current default behavior.
3. Replace local fee/liquidation constants with repository preview values. Missing preview fields display empty state and keep submit disabled when required risk fields are unavailable.
4. Replace `Future.delayed` submit with `repository.submitOrder`; success pops real `orderId` / `requestId`, failure keeps sheet open and shows fixed SnackBar.
5. Extend widget tests with repository override success/failure and no raw delayed success in real branch.
6. Verify from `apps/quantify-mobile`: `flutter test test/widgets/qz_trade_order_sheet_test.dart`, `flutter analyze`; from repo root: `dx lint`, `dx build affected --dev`, focused tests.

**Commit:** `feat: wire trade order sheet to repository`

## Sentinel

No async writer / runtime data population. No sentinel SQL required.
