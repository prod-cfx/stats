# Mobile Whale Holdings Contract Design

## Goal

`apps/quantify-mobile` 的巨鲸底部 Tab 中「持仓」页面改为消费 `packages/api-contracts-dart` 生成的真实后端契约，行为对齐 `apps/front` 的鲸鱼持仓页。

## Context

- front 页面 `apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.tsx` 通过 `fetchWhaleHoldings` 调用 `WhaleHoldingsController_getWhaleHoldings`。
- Dart 契约已包含 `DefaultApi.whaleHoldingsControllerGetWhaleHoldings`、`WhaleHoldingDto`、`WhaleHoldingsControllerGetWhaleHoldings200Response`。
- mobile 当前持仓 Tab UI 已有筛选、排序、空态、错误态，repository 仍通过手写 `WhaleHoldingsService` 读取裸 `/whale-holdings` JSON。

## Architecture

- 保持 UI、domain model、筛选排序 use case 不变。
- 将 `ApiWhaleHoldingsRepository` 改为注入 `GeneratedBackendApi`。
- repository 调用 `client.getDefaultApi().whaleHoldingsControllerGetWhaleHoldings(page: 1, limit: 200, minPositionValueUsd: 1000000)`。
- 使用 `WhaleHoldingDto` 映射现有 `WhaleHoldingPosition`，避免 UI 感知生成 DTO。

## Mapping

- `userAddress` -> `address`
- `symbol` -> `symbol`
- `side` LONG/SHORT -> `WhaleHoldingSide.long/short`
- `positionValueUsd` -> `value` 和 USD compact display
- `positionSize` -> `qtyDisplay`
- `entryPrice` -> `openDisplay`
- `liquidationPrice` -> `liqDisplay`
- `pnl` -> `pnl` 和 signed USD compact display
- `roe` -> signed percent display
- `leverage` -> `leverage`
- `snapshotTime` -> `hoursAgo` 和相对时间 display

## Error Handling

- 真实接口返回空列表时，mobile 保持空态，不回退 mock。
- 网络或反序列化失败继续由 `FutureProvider` 暴露 `AsyncValue.error`，UI 展示现有 `whaleLoadError`。

## Tests

- 新增 repository contract test，覆盖请求参数和 DTO 到 domain model 映射。
- 运行聚焦 Flutter test 和受影响构建。
