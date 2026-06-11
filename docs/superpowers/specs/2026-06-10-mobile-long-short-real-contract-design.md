# Mobile Long Short Real Contract Design

## Context

`apps/front` 的交易所多空比页面使用 backend 现有接口 `/markets/long-short-ratio/exchanges`。请求参数为基础资产 `symbol`（如 `BTC`）和 `timeRange`，周期集合为 `5m / 15m / 30m / 1h / 4h / 12h / 24h`，默认 `4h`。切换币种或周期都会重新请求。

`apps/quantify-mobile` 的「数据」Tab 多空比页已有真实接入骨架：`ApiLongShortRepository` 通过 `packages/api-contracts-dart` generated SDK 调用同一接口，并把交易所行汇总成 mobile hero 卡和交易所列表。但当前 mobile 快照请求固定 `4h`，周期选择只改展示态，且周期集合少于 front。

## Goal

在不修改后端、不影响 front 的前提下，让 mobile 多空比页按当前页面承载范围消费真实后端契约，并让周期行为对齐 front。

## Decision

采用最小真实接入方案：保留 mobile 现有信息架构和展示范围，只把周期选择接入真实请求。

- 周期集合对齐 front：`5m / 15m / 30m / 1h / 4h / 12h / 24h`。
- 默认周期保持 `4h`。
- 切换币种或周期都重新请求 `/markets/long-short-ratio/exchanges`。
- 不新增历史图表、不接 `/markets/long-short-ratio` 时间序列、不修改 backend DTO 或 service。

## Architecture

`LongShortRepository.getSnapshot` 增加 `timeRange` 入参。`ApiLongShortRepository` 继续使用 `GeneratedBackendApi.client.getMarketsApi().marketsControllerGetExchangeLongShortRatio`，并传入基础资产 `symbol` 与选中的 `timeRange`。

Generated Dart 合约中的响应包装字段仍按现有模式处理：`data/items` 生成成 `JsonObject` 时，通过 `json_codec` 防御式解包。实现不修改 `packages/api-contracts-dart` generated 文件。

## State Model

把页面周期从纯中文展示字符串收敛为稳定的 mobile 周期模型，至少包含：

- `apiValue`：`5m / 15m / 30m / 1h / 4h / 12h / 24h`
- `label`：`5分钟 / 15分钟 / 30分钟 / 1小时 / 4小时 / 12小时 / 24小时`

`LongShortState` 默认周期为 `4h`。`LongShortController.changePeriod` 在周期变化时更新 state 并调用 `_load()`；已有 `_requestId` 竞态保护继续保留，防止快速切币种或周期时旧响应覆盖新状态。

## UI

`LongShortBody` 保持现有结构：币种 chips、搜索 overlay、周期 sheet、hero 汇总卡、交易所分布列表。

周期 sheet 增加到 7 个 front 周期。周期按钮展示中文 label，repository 使用对应 `apiValue`。页面不展示 front 桌面表格的全部列，也不增加历史区域；mobile 继续只展示当前页面已有的 hero 汇总和交易所多空分布。

## Data Mapping

接口返回的每个交易所项映射到 `ExchangeLongShort`：

- `name` -> `exchange`
- `longPercent` / `shortPercent` -> 比例条百分比
- `longAmountUsd` / `shortAmountUsd` -> compact USD 金额
- `logoUrl` 当前不展示，保留 future，不阻塞本次接入

hero 汇总由所有有效交易所行的 `longAmountUsd` 与 `shortAmountUsd` 求和后计算：

- `longNotional` / `shortNotional`
- `totalNotional`
- `longPct = longUsd / (longUsd + shortUsd) * 100`
- `shortPct = 100 - longPct`

## Error Handling

请求失败继续走 `ErrorRouter.normalize`，页面显示现有加载失败空态。接口返回空数组时返回空快照，展示 `$0` 与空交易所列表。单条脏数据不让页面崩溃：缺失交易所名的行丢弃，金额或百分比缺失按 0 处理。

## Scope

In scope:

- `apps/quantify-mobile` 多空比 repository、state、controller、page 和相关测试。
- 使用已有 `packages/api-contracts-dart` generated backend SDK。

Out of scope:

- backend 接口、DTO、数据同步任务或 OpenAPI 变更。
- front 变更。
- generated Dart 合约再生成。
- mobile 历史图表、完整 front 表格、交易所 logo 展示。

## Testing

- Repository 测试覆盖默认与非默认 `timeRange` 请求参数，以及空响应映射。
- Controller 测试覆盖初始 `4h`、切周期触发重载、切周期竞态保护。
- Page/widget 测试覆盖周期 sheet 显示 7 个 front 周期，并保持现有骨架断言。
- 运行 Flutter 相关测试；实现完成后按影响面至少执行多空比相关 widget/controller/repository 测试与 mobile analyzer。
