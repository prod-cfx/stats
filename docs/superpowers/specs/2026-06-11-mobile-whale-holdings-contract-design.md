# Mobile Whale Holdings Contract Design

## Background

`apps/front` 的 `/zh/whale-tracking/holdings` 页面已经通过 `fetchWhaleHoldings()` 消费 backend `/whale-holdings` 契约。该契约来自 `packages/api-contracts`，后端 DTO 为 `WhaleHoldingDto`，字段覆盖地址、币种、方向、仓位大小、持仓价值、入场价、清算价、未实现盈亏、ROE、杠杆和快照时间。

`apps/quantify-mobile` 的“巨鲸”底部 Tab 内“持仓”页已有页面、卡片、筛选、排序和 `ApiWhaleHoldingsRepository`。当前主要问题是 mobile 领域模型把 `address` 同时当作展示缩写和完整地址使用。真实 API 返回完整地址后，卡片展示不再符合 mobile 设计中的 `0xa5b0…1d41` 地址缩写，同时复制和详情路由应继续使用完整地址。

本次只接入并收口 mobile 所需展示范围，不修改后端契约，不影响 front。

## Goals

- “巨鲸 > 持仓”页使用 `packages/api-contracts-dart` 已生成的 `/whale-holdings` Dart 客户端读取真实 backend 数据。
- mobile 继续只展示现有卡片所需字段：地址、币种、方向、杠杆、持仓价值、数量、未实现盈亏、保证金、开盘价、清算价、时间。
- 卡片地址展示按 mobile 设计缩写为 `0xabcd…1234`，复制、详情路由和统计弹窗使用完整地址。
- 空响应保持真实空态，不回退 mock fixture。
- 不改 backend，不新增接口，不重新生成 contract。

## Non-Goals

- 不把 front 表格全部字段搬到 mobile。
- 不改变 backend `/whale-holdings` 的字段、分页、排序或鉴权行为。
- 不改 front `/zh/whale-tracking/holdings` 的接入方式。
- 不把币种筛选改为网络请求驱动；mobile 继续本地筛选排序。

## Architecture

Data source remains:

- `packages/api-contracts-dart/lib/src/api/default_api.dart`
- `DefaultApi.whaleHoldingsControllerGetWhaleHoldings()`

Mobile layers:

- `apps/quantify-mobile/lib/data/api/api_whale_holdings_repository.dart` maps generated DTOs into domain rows.
- `apps/quantify-mobile/lib/domain/models/whale_holding_models.dart` remains the UI-facing model source.
- `apps/quantify-mobile/lib/pages/whale/widgets/whale_holding_card.dart` renders card content.
- `apps/quantify-mobile/lib/pages/whale/widgets/whale_card_controls.dart` keeps reusable address link behavior.

`WhaleHoldingPosition` will hold two address fields:

- `address`: full backend address, used for copy, route, and stats.
- `displayAddress`: shortened mobile display string, used only in card/link text.

`WhaleAddressLink` will accept an optional `displayAddress`. Existing callers keep current behavior by defaulting display text to `address`.

## Request Flow

`WhaleHoldingsRepository.getHoldings()` remains parameterless. It calls:

- `page: 1`
- `limit: 200`
- `minPositionValueUsd: 1000000`
- `extra: {'unwrapData': true}`

It does not pass `symbol`. The holding tab already derives coin chips from rows and filters locally. Keeping this avoids coupling filter changes to network loading states.

## DTO Mapping

`WhaleHoldingDto` maps as follows:

- `userAddress` -> `address`
- `shortenWhaleAddress(userAddress)` -> `displayAddress`
- `symbol` -> `symbol`
- `side` -> `WhaleHoldingSide.long/short`
- `positionValueUsd` -> `value` and compact USD display
- `positionSize` -> quantity display with 4 decimals and symbol
- `pnl` -> `pnl` and signed compact USD display, defaulting to `0` if null
- `roe` -> signed percentage display, defaulting to `0` if null
- `entryPrice` -> USD price display
- `liquidationPrice` -> USD price display or `--` if null
- `leverage` -> rounded integer, defaulting to `0` if null
- `snapshotTime` -> `hoursAgo` and localized Chinese relative text currently used by the page

Margin display uses `positionValueUsd / leverage` when `leverage` is present and greater than zero. If leverage is missing or zero, it keeps the current fallback estimate of `positionValueUsd / 10`.

Backend does not expose cross/isolated margin mode in `/whale-holdings`; mobile keeps current `Cross`/`全仓` display behavior.

## Address Shortening

The display shortening rule is:

- If address is a normal `0x` address long enough to shorten, show `0x` + first 4 hex chars after `0x` + `…` + last 4 chars.
- Example: `0xabcdefabcdefabcdef01` -> `0xabcd…ef01`.
- If input is too short or malformed, display it unchanged.

This keeps visual output aligned with existing mobile fixtures while preserving full address for actions.

## UI Behavior

`WhaleHoldingCard` will:

- Show `entry.displayAddress` in Row 1.
- Copy `entry.address` through `WhaleCopyButton`.
- Navigate to `/whale/profile/<Uri.encodeComponent(entry.address)>`.
- Open `WhaleTradeStatsSheet` with full `entry.address`.

Filtering and sorting remain unchanged:

- Coin chips are derived from returned rows.
- Direction and PnL filters run locally.
- Sort keys remain value, margin, and time.
- Empty result shows existing empty state.

## Error Handling

- Network or serialization errors surface through the existing `FutureProvider` error path and show `whaleLoadError`.
- Empty `items` returns an empty list and displays the existing empty state.
- Items that cannot be decoded into `WhaleHoldingDto` are skipped, matching current tolerant repository behavior.

## Testing

Update focused tests:

- `apps/quantify-mobile/test/data/api_whale_holdings_repository_generated_test.dart`
  - Assert generated request path remains `/whale-holdings`.
  - Assert query parameters remain `page=1`, `limit=200`, `minPositionValueUsd=1000000`.
  - Assert `row.address` is full address.
  - Assert `row.displayAddress` is shortened display address.
  - Assert existing numeric/display mapping still works.
- `apps/quantify-mobile/test/pages/whale_holdings_tab_test.dart`
  - Keep fixture-driven rendering and filter/sort coverage.
  - Ensure card/link renders shortened address.
  - Ensure copy action still copies full `entry.address`.

Validation commands after implementation:

```bash
flutter test test/data/api_whale_holdings_repository_generated_test.dart test/pages/whale_holdings_tab_test.dart
dx build quantify-mobile --dev
```

If `dx build quantify-mobile --dev` is unsupported by the repo, report that explicitly and run the closest supported Flutter analyzer/test command.

## Delivery

After implementation and verification, use `/git-commit-and-pr` as requested to create the Issue/branch/commit/PR delivery. PR notes must call out:

- API/data compatibility: backend contract unchanged; front unaffected.
- Mobile display behavior: shortened address in card, full address for copy/route/stats.
- Verification commands and results.
