# Mobile Coin Stock Contract Design

## Context

`apps/front` 的 `/public-companies` 币股页通过 backend `/crypto-stock-quotes/latest` 读取真实数据。页面并发请求两个 source：`BBX_SCRAPER` 提供持仓、公司、资产扩展字段，`BBX` 提供较新的报价字段。front 按 `symbol` 合并两侧数据，报价字段优先 `BBX`，扩展字段保留 `BBX_SCRAPER`。

`apps/quantify-mobile` 的「数据」Tab 已有币股子屏、卡片、搜索、排序、详情 bottom sheet 和 `CoinStockRepository` 抽象。mobile 展示范围小于 front，本次只接入当前 mobile 已展示和交互所需字段，不修改后端，不扩展 front 未要求的契约。

## Goals

- mobile 币股数据入口使用 `packages/api-contracts-dart` 生成的 `CryptoStockQuotesApi`。
- mobile 与 front 保持相同取数语义：并发读取 `BBX_SCRAPER` 和 `BBX`，按 `symbol` 合并。
- 保持现有 mobile UI 信息密度：卡片展示币种、股票代码、公司名、交易所、股价、涨跌、mNAV、市值、持仓价值、持仓数量；详情展示简介、业务标签和当前指标。
- 不修改 backend，不重新定义 OpenAPI，不影响 front 现有页面。

## Non-Goals

- 不在 mobile 增加 front 表格全部列。
- 不新增 mobile 专用后端接口。
- 不改变 `packages/api-contracts-dart` 生成文件。
- 不引入新的图片展示或复杂详情布局。

## Architecture

`CoinStockRepository` 继续作为页面唯一数据边界。生产实现 `ApiCoinStockRepository` 依赖 `GeneratedBackendApi`，通过生成 SDK 调用 backend。`repository_providers.dart` 暴露 `coinStockRepositoryProvider` 和 `coinStocksProvider`，`CoinStockBody` 继续 watch provider 并使用现有 `CoinStock` model。

边界职责：

- `ApiCoinStockRepository`：负责双源拉取、合并、DTO 到 `CoinStock` 映射、失败策略。
- `CoinStock` model：保留展示用字符串字段和排序解析逻辑。
- `CoinStockBody` / widgets：保留现有 UI，处理加载、错误、空态、点击详情。
- `packages/api-contracts-dart`：只消费生成 API 和 DTO，不手改生成文件。

## Data Flow

1. `CoinStockBody` watch `coinStocksProvider`。
2. `coinStocksProvider` 调 `CoinStockRepository.listCoinStocks()`。
3. `ApiCoinStockRepository` 并发执行：
   - `cryptoStockQuotesControllerGetLatest(source_: 'BBX_SCRAPER')`
   - `cryptoStockQuotesControllerGetLatest(source_: 'BBX')`
4. 如果两个 source 都失败，抛出首个错误，页面进入错误/空态路径。
5. 如果任一 source 成功，保留成功源数据。
6. 两源都成功时，按 `symbol` 匹配并合并：
   - `price`、`openPrice`、`highPrice`、`lowPrice`、`closePrice`、`priceChange`、`priceChangePercent`、`quoteTimestamp`、`updatedAt`、`source` 优先 `BBX`。
   - `assetSymbol`、`assetLogoUrl`、`companyLogoUrl`、`holdingsValue`、`holdingsAmount`、`mNav`、`holdingValue`、`holdingQuantity`、`companyType`、`infoParagraphs` 保留 `BBX_SCRAPER`。
7. 合并后的 DTO map 为 mobile `CoinStock`。

## Field Mapping

`CryptoStockQuoteResponseDto` 到 `CoinStock` 映射：

- `coin`: `assetSymbol` trim + upper，空值回退 `OTHER`。
- `sym`: `symbol`。
- `cn`: `name ?? ''`。
- `ex`: `exchange ?? ''`。
- `mnav`: `mNav ?? ''`。
- `mcap`: `marketCap ?? ''`。
- `holdV`: `holdingsValue ?? holdingValue ?? ''`。
- `holdQ`: `holdingsAmount ?? holdingQuantity ?? ''`。
- `hold`: 与 `coin` 一致。
- `px`: `price`。
- `ch`: `priceChangePercent` 解析为 double 后格式化为 `+1.23%` / `-1.23%`；无法解析时为空串。
- `up`: `priceChangePercent >= 0`，无法解析时按非下跌处理。
- `biz`: `companyType ?? ''`。
- `hq`: 暂无契约字段，保持空串。
- `listed`: 暂无契约字段，保持空串。
- `intro`: `infoParagraphs` 用换行拼接，空值为空串。

## Error Handling

双源请求使用 settled 语义：单源失败不阻断页面，只展示另一源数据；双源失败才抛出错误。这样与 front 的容错语义一致，避免 `BBX` 短时不可用导致持仓扩展榜单完全不可见。

页面不新增登录兜底示例数据。mobile 真实接口失败时遵循现有 app provider/页面空态策略；本次只确保 repository 抛错路径可测试。

## Testing

测试集中在 `apps/quantify-mobile/test/data/api_coin_stock_repository_test.dart`：

- DTO 映射：覆盖 asset fallback、持仓字段优先级、涨跌格式、简介拼接、空值处理。
- 双源合并：报价字段来自 `BBX`，持仓和公司扩展字段来自 `BBX_SCRAPER`。
- 单源失败：成功源数据仍返回。
- 双源失败：抛出首个错误。

必要时补充 `CoinStockBody` provider 状态测试，确认 provider error 不导致 UI 崩溃。验证命令优先跑聚焦 Flutter 测试，再按影响范围跑 format/analyze。

## Rollout Risk

风险主要在 DTO 字段格式差异：后端字符串可能已经带单位或货币符号，mobile 保持原样展示，不做额外压缩，避免误解析。排序沿用 `parseStockNum`，无法解析时落到 0，符合当前 mobile 行为。

后端和 front 不改，回滚点是 `ApiCoinStockRepository` 与其测试。若真实后端 source 名变更，mobile 和 front 应同步调整，但本次不主动修改契约。
