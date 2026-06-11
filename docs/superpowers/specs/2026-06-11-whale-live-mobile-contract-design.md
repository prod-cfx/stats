# Mobile Whale Live Contract Design

## Context

`apps/front` 的 `/zh/whale-tracking/realtime` 页面通过 `fetchWhaleTradesRealtime` 读取 `/whale-alerts/trades`，不是 `/whale-alerts/realtime`。前者返回 Hyperliquid 鲸鱼成交实时列表，字段包括地址、币种、多空、成交数量、价格、成交价值、成交时间。后者是持仓预警列表，语义更偏仓位快照。

`apps/quantify-mobile` 的巨鲸底部 tab 中，`WhaleWatchTab` 默认进入 `WhaleLiveTab`。当前数据链路是 `WhaleLiveTabController -> WhaleFeedRepository -> ApiWhaleFeedRepository -> packages/api-contracts-dart`。实现已具备 generated SDK 接入基础，但卡片展示仍有两个需要收敛的问题：真实契约字段要按 front 实时页语义明确映射，地址展示要按 mobile 设计缩写，不能只依赖 UI 省略号。

## Goal

把 `apps/quantify-mobile` 巨鲸 tab 的“实时巨鲸”页面稳定接入 `packages/api-contracts-dart` 中的真实后端契约 `/whale-alerts/trades`，保持现有 mobile 页面承载范围，不新增后端字段，不影响 front 现有使用。

## Non-Goals

- 不修改 backend 或 OpenAPI 契约。
- 不把 mobile 实时页切到 `/whale-alerts/realtime`。
- 不合并 `/whale-alerts/trades` 和 `/whale-alerts/realtime` 两个接口。
- 不实现 SSE 流式解析；当前继续使用轮询最新记录。
- 不为了补齐 UI 伪造杠杆或保证金模式等后端未提供字段。

## Recommended Approach

保留现有 mobile 数据边界：`WhaleFeedRepository` 仍是实时页唯一数据接口，`ApiWhaleFeedRepository` 仍通过 generated `WhaleAlertsApi.whaleAlertControllerGetWhaleTrades` 拉取数据。这样改动集中在契约映射、展示降级、地址缩写和测试，不触碰后端，也不改变 front 依赖的行为。

## Data Flow

1. `WhaleLiveTabController.build()` 启动倒计时，调用 `_load()`。
2. `_load()` 调用 `repo.listRecent(limit: 30)` 获取首屏列表。
3. `ApiWhaleFeedRepository.listRecent()` 调用 generated Dart SDK：`getWhaleAlertsApi().whaleAlertControllerGetWhaleTrades(limit: limit, extra: {'unwrapData': true})`。
4. repository 将 `WhaleTradeDto` 映射为 `WhaleEvent`，controller 去重后写入 `WhaleLiveTabState.items`。
5. `watchFeed()` 继续每 3 秒轮询 `listRecent(limit: 1)`，有新 id 时插入并短暂高亮。
6. `WhaleLiveTab` 根据币种筛选和胜率排序渲染 `QzWhaleRow`。

## Field Mapping

`WhaleTradeDto.userAddress` -> `WhaleEvent.address`。保留完整地址供 profile 跳转、统计弹层和 key 生成使用。

`WhaleTradeDto.symbol` -> `WhaleEvent.symbol`，统一转大写。

`WhaleTradeDto.side` -> `WhaleEvent.side`，`Long` 映射 `long`，`Short` 映射 `short`；同时保留 `direction` 兼容旧字段，`long` 为 `in`，`short` 为 `out`。

`WhaleTradeDto.tradeSize` -> `WhaleEvent.quantity`，展示为绝对值加币种，例如 `0.2500 BTC`。

`WhaleTradeDto.price` -> `WhaleEvent.openPrice`。

`WhaleTradeDto.tradeValueUsd` -> `WhaleEvent.amountUsd` 和 `WhaleEvent.positionValue`。

`WhaleTradeDto.tradeTime` -> `WhaleEvent.timestamp`。

后端未提供 `leverage`，mobile 卡片继续显示 `--`。后端未提供保证金模式，mobile 继续显示当前默认 `全仓`，不扩展为新后端字段。后端未提供真实胜率，继续用基于 `address + symbol` 的稳定展示值，保证排序和 UI 不抖动。

## Address Display

卡片里的地址按 mobile 设计做缩写：

- 仅展示层缩写，不改变 `WhaleEvent.address` 原始值。
- `0x` 地址格式显示为 `0x` + 前 4 位 + `…` + 后 4 位。
- 示例：`0xabcdefabcdefabcdef01` 显示为 `0xabcd…ef01`。
- 非标准或过短地址原样显示，避免误截断标签或测试 fixture。

`QzWhaleRow` 点击地址进入 profile、点击统计按钮打开统计弹层时，继续使用完整地址。

## UI Behavior

首屏保持 mobile 当前三段布局：筛选 chip、关注币种推送/胜率排序/倒计时、分组卡片列表。卡片展示范围保持现有字段：地址、标签、实时标记、相对时间、币种、仓位模式、多空、杠杆占位、持仓价值、数量、开盘价、胜率。

front 桌面表格中存在但 mobile 当前没有承载的列不强行补齐。mobile 优先展示小屏可读信息，不复制 front 全量表格。

## Error And Empty States

接口失败沿用 `WhaleLiveTabController` 的 `ErrorRouter.normalize`，页面显示加载错误和错误详情。

真实接口返回空列表时展示 `whaleLiveFeedEmpty`，不回退 mock 数据，避免真实空态被假数据遮住。

轮询失败不应导致历史列表被清空；保留当前列表并让下一次轮询继续尝试。

## Compatibility

`WhaleFeedRepository` 接口不变，测试替身和页面控制器不需要跟随改签名。

`WhaleEvent` 保留旧字段含义，新增展示规则只发生在 `QzWhaleRow`。完整地址仍保存在 model 中，路由和详情页不受缩写影响。

front 使用的 `/whale-alerts/trades` 行为不变；mobile 只消费已有 Dart 契约。

## Tests

新增或更新以下测试：

- `apps/quantify-mobile/test/data/api_whale_feed_repository_generated_test.dart`：验证 generated SDK 请求 `/whale-alerts/trades`，`limit` query 正确，不发送无需求的 `min_trade_value_usd`，并正确映射 `WhaleTradeDto` 到 `WhaleEvent`。
- `apps/quantify-mobile/test/pages/whale_live_tab_test.dart` 或 widget 聚焦测试：验证卡片展示缩写地址，例如 `0xabcd…ef01`，但点击路径仍使用完整地址。
- `apps/quantify-mobile/test/pages/whale/whale_live_tab_controller_test.dart`：保持加载、去重、排序、错误态测试通过。

验证命令以实现影响范围为准：优先跑相关 Flutter tests，再跑仓库 lint 和 mobile build target。

## Risks

最大风险是字段语义误用。设计选择 `/whale-alerts/trades` 是因为 front 实时页实际也用该接口；mobile 的“持仓价值”展示会使用 `tradeValueUsd`，表示成交价值而非账户总持仓净值。UI 现有文案不新增后端语义承诺。

第二个风险是地址缩写影响交互。通过只在 `QzWhaleRow` 展示层缩写、model 保留完整地址，可以保证 profile 跳转和统计弹层不受影响。
