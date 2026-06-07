# Quantify Mobile Real Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `USE_MOCK=false` 时移动端行情详情与聚合数据不再展示 mock fixture 或 widget 派生业务真值。

**Architecture:** 保持 mobile 现有 Repository -> Provider -> Widget 数据流。真实 repository 只映射 generated backend SDK 已返回字段；后端契约缺字段时返回空集合或 nullable 值，让 widget 显示 `--` / 空态。

**Tech Stack:** Flutter, Riverpod, generated Dart OpenAPI SDK, flutter_test.

---

## Files

- Modify: `apps/quantify-mobile/lib/data/models/ticker_models.dart` - 给 `Ticker` 增加真实可选统计字段。
- Modify: `apps/quantify-mobile/lib/data/api/api_ticker_repository.dart` - 映射 `TickerResponseDto.high24h/low24h`，其它缺字段保持 null。
- Modify: `apps/quantify-mobile/lib/data/api/api_agg_orderbook_repository.dart` - 移除 mock fixture import；盘口映射真实响应；OI/volume 缺契约时返回空数据。
- Modify: `apps/quantify-mobile/lib/data/providers/repository_providers.dart` - 更新 provider 注释，不再声明真实模式复用 mock。
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/market_detail_stats.dart` - 只读 `Ticker` 字段；缺字段显示 `--`。
- Modify: `apps/quantify-mobile/lib/pages/market/market_detail_page.actions.part.dart` - 累计统计行使用真实 `Ticker` 字段；净流入缺字段显示 `--`。
- Modify: `apps/quantify-mobile/lib/pages/market/widgets/agg_orderbook_card.dart` - 错误态和加载态显示空 bundle，不回退 mock。
- Test: `apps/quantify-mobile/test/data/api_agg_orderbook_repository_test.dart` - 断言真实 repository 不再填 mock OI/volume。
- Test: `apps/quantify-mobile/test/pages/market_detail_panels_test.dart` - 断言真实字段显示与缺字段 `--`。
- Test: `apps/quantify-mobile/test/pages/data_hub_page_test.dart` - 断言聚合挂单真实空数据不崩溃、不出现 mock OI/volume。

## Steps

### Task 1: Red tests for real agg repository

- [ ] Step 1: Replace `OI/volume reuse mock fixture constants` test with `real mode keeps oi and volume empty when backend contract has no fields`.

Expected assertions:

```dart
expect(d.oiCoins, isEmpty);
expect(d.oiData, isEmpty);
expect(d.volCoins, isEmpty);
expect(d.volData, isEmpty);
expect(d.precisions, <int>[1, 10, 100]);
```

- [ ] Step 2: Run `cd apps/quantify-mobile && flutter test test/data/api_agg_orderbook_repository_test.dart`.
Expected: fail because repository still imports mock fixture and fills OI/volume.

### Task 2: Green agg repository mapping

- [ ] Step 1: Remove `../mock/fixtures/agg_orders.dart` import from `api_agg_orderbook_repository.dart`.
- [ ] Step 2: Add local `const List<int> _defaultPrecisions = <int>[1, 10, 100];`.
- [ ] Step 3: In `buildMarketData`, keep asks/bids/exchanges from response, set OI/volume maps and coin lists to empty constants, and keep `coinColor` empty.
- [ ] Step 4: Update comments in `api_agg_orderbook_repository.dart` and `repository_providers.dart` to say missing backend fields render empty state.
- [ ] Step 5: Run `cd apps/quantify-mobile && flutter test test/data/api_agg_orderbook_repository_test.dart`.
Expected: pass.

### Task 3: Red tests for detail stats and more sheet

- [ ] Step 1: Add a direct `MarketDetailStats` widget test using a `Ticker` with `high24h`, `low24h`, `openInterest`, `indexPrice`, `markPrice`, `fundingRate` and assert those exact values render.
- [ ] Step 2: Add a direct `MarketDetailStats` widget test using a `Ticker` without optional fields and assert four `--` placeholders render for index/mark/funding/OI plus high/low.
- [ ] Step 3: Extend existing `MarketDetailPage` pump ticker fixture with real high/low/turnover and assert cumulative row does not show derived net inflow.
- [ ] Step 4: Run `cd apps/quantify-mobile && flutter test test/pages/market_detail_panels_test.dart`.
Expected: fail because widget still derives high/low/OI/index/mark/funding and more sheet derives net inflow.

### Task 4: Green ticker model and detail widgets

- [ ] Step 1: Add nullable fields to `Ticker`: `high24h`, `low24h`, `openInterest`, `indexPrice`, `markPrice`, `fundingRate`, `turnover24h`, `netInflow24h`.
- [ ] Step 2: Include new fields in `toMap`, `fromMap`, constructor, and `fromBackendFields`; map `TickerResponseDto.high24h/low24h`, set `turnover24h` from backend `volumeUsd`, leave unavailable fields null.
- [ ] Step 3: Update `ApiTickerRepository._map` to pass `high24h` and `low24h`.
- [ ] Step 4: Replace all widget-side price/volume mock math in `MarketDetailStats` with nullable formatters returning `--`.
- [ ] Step 5: Replace `_CumulativeStatsRow` derived turnover/netInflow/high/low with nullable field reads; `netInflow24h == null` renders `--` and neutral color.
- [ ] Step 6: Run `cd apps/quantify-mobile && flutter test test/pages/market_detail_panels_test.dart`.
Expected: pass.

### Task 5: Data hub empty-state coverage

- [ ] Step 1: Add data hub test override for `aggOrderbookRepositoryProvider` returning an `AggMarketData` with real asks/bids but empty OI/volume.
- [ ] Step 2: Switch to agg orders tab and assert orderbook title renders, then switch inner OI/volume tabs if accessible and assert `暂无数据` / no exception.
- [ ] Step 3: Run `cd apps/quantify-mobile && flutter test test/pages/data_hub_page_test.dart`.
Expected: pass after Tasks 2 and 4.

### Task 6: Full verification

- [ ] Step 1: Run in parallel from repo root: `dx lint`, `dx build affected --dev`, and from `apps/quantify-mobile`: `flutter test test/data/api_agg_orderbook_repository_test.dart test/pages/market_detail_panels_test.dart test/pages/data_hub_page_test.dart` plus `flutter analyze`.
- [ ] Step 2: Fix failures and rerun all verification commands until green.
- [ ] Step 3: Commit with `Refs: #2306`, push branch, create PR.

## Verify

- `dx lint`
- `dx build affected --dev`
- `cd apps/quantify-mobile && flutter test test/data/api_agg_orderbook_repository_test.dart test/pages/market_detail_panels_test.dart test/pages/data_hub_page_test.dart`
- `cd apps/quantify-mobile && flutter analyze`

## Commit

Use one commit:

```bash
git commit -F - <<'MSG'
feat(quantify-mobile): 接入行情真实统计空态

变更说明：
- 移除真实聚合盘口仓库对 mock OI/volume fixture 的依赖，缺契约字段时展示空态
- 详情页统计改读 Ticker 真实字段，缺字段显示 --，不再用价格和成交额派生业务真值

Refs: #2306
MSG
```
