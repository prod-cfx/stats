# Quantify 行情层支持合约并扩展 OKX/Hyperliquid 设计

- 日期：2026-03-18
- 状态：Draft（已与用户确认方向）
- 范围：`apps/quantify/src/modules/market-data/*` 及 `apps/quantify/prisma/schema/market_indicator.prisma` 的最小必要改造

## 1. 背景与问题判断

用户目标是：先把 Binance 行情数据层调到可支撑 AI 策略合约，再接入 OKX 与 Hyperliquid。

现状结论：当前数据层不满足“稳定支持合约策略”。

关键证据：

1. Binance market-data provider 当前只走现货端点（`/api/v3/*`），并将 `instrumentType` 固定映射为 `SPOT`。
2. `market_symbols.code` 是全局唯一，现货与合约同码（例如 `BTCUSDT`）无法并存。
3. provider 符号同步按 `code` upsert，会覆盖 `instrumentType`，导致 spot/perp 互相污染。
4. 策略执行端本身支持 `PERPETUAL/FUTURE -> perp`，瓶颈主要在数据层建模与采集侧。

## 2. 目标与非目标

### 2.1 目标

1. Binance 行情层支持 `SPOT + PERP` 并存采集（REST 历史 + WS 实时）。
2. 对策略消费侧保持统一数据结构，不破坏 `MarketDataReadGateway` 对外使用方式。
3. 为后续接入 OKX/Hyperliquid 复用同一抽象与代码结构。
4. 支持“同一交易所内现货/合约 API 同形态接入”，通过切换 URL 与参数模板实现，不分叉实现。

### 2.2 非目标

1. 本次不改交易下单客户端（`trading/exchanges/*-client.ts`）的业务逻辑。
2. 本次不做跨交易所深度聚合引擎（仅 provider 级别接入）。
3. 本次不引入新的公开 API 版本。
4. 本次不新增“现货版 provider”和“合约版 provider”两套类。

## 3. 备选方案与取舍

### 方案 A：Binance-perp-only 快速切换

- 做法：将 Binance provider 直接切成合约端点。
- 优点：实现快。
- 缺点：破坏现有现货 userspace，不符合兼容原则。

### 方案 B：Binance spot+perp 并存（推荐）

- 做法：保留 provider 外部接口不变，在内部增加 market 路由与符号编码规范，支持 spot/perp 同时采集。
- 优点：兼容现有调用，能支撑合约，且可平滑扩展到 OKX/Hyperliquid。
- 缺点：需要中等改造（符号编码、兼容查询、数据回填）。

### 方案 C：先做全面模型重构再接交易所

- 做法：先将 symbol 唯一键升级为复合键，再做 provider 扩展。
- 优点：长期最干净。
- 缺点：改动面与风险较大，交付周期长。

结论：采用方案 B。

## 4. 目标架构

### 4.1 对外接口保持不变

继续使用现有 `MarketDataProvider` 契约：

- `fetchSymbols()`
- `fetchHistoricalBars()`（语义等价于 `get_klines()`）
- `subscribe()`（语义等价于 `subscribe_kline()`）
- `disconnect()`

### 4.2 Provider 内部分层

在每个交易所 provider 内部引入统一三层：

1. `Symbol Adapter`：交易所符号/市场类型 -> 统一 Symbol 元数据
2. `REST Kline Adapter`：交易所 REST 响应 -> `MarketBarPayload`
3. `WS Kline Adapter`：交易所 WS 响应 -> `MarketBarPayload`

外部模块仍只消费统一 payload，不感知交易所差异。

### 4.3 现货/合约切换原则（同交易所）

1. 统一通过配置切换 market 目标，不复制代码：
   - `MARKET_DATA_SPOT_REST_BASE_URL`
   - `MARKET_DATA_PERP_REST_BASE_URL`
   - `MARKET_DATA_SPOT_WS_BASE_URL`
   - `MARKET_DATA_PERP_WS_BASE_URL`
2. provider 逻辑保持同一套 adapter 与解析流程，仅端点与参数模板可配置（例如 interval/channel/instType）。
3. REST 与 WS 都按“同形态 API + 差异参数模板”实现路由，不引入分叉代码路径。

## 5. 数据模型与兼容策略

### 5.1 Symbol code 规范化

为避免 spot/perp 同码冲突，采用规范：

- `BTCUSDT:SPOT`
- `BTCUSDT:PERP`

其中 `instrumentType` 与 code 后缀保持一致。

### 5.2 兼容旧码读取

`MarketDataService.getSymbolOrThrow()` 增加兼容规则：

1. 若传入已带后缀，按新规范精确匹配。
2. 若传入旧码（如 `BTCUSDT`），优先映射为 `BTCUSDT:SPOT`（过渡期兜底）。

### 5.3 存量数据迁移

通过迁移脚本将历史 `BTCUSDT` 这类 code 回填为 `BTCUSDT:SPOT`，避免与后续 `:PERP` 冲突。

## 6. 数据流设计

### 6.1 Binance（第一阶段）

1. `fetchSymbols()` 同时拉 spot/perp 元数据，产出双 market symbol。
2. `fetchHistoricalBars()` 根据 code 后缀路由到 spot/perp REST 端点。
3. `subscribe()` 建立 spot/perp 独立流并统一转为 `onKline` 回调。
4. spot/perp 共用同一 provider：仅切换 URL 与必要参数模板。

### 6.2 OKX / Hyperliquid（第二阶段）

沿用 Binance 完成后的抽象，新增 provider 模块：

1. 保持接口函数一致（`fetchHistoricalBars`/`subscribe` 对应 `get_klines`/`subscribe_kline` 语义）。
2. 输出统一 Kline 结构（timestamp/open/high/low/close/volume/symbol/interval）。
3. 默认采用“API 结构一致，靠 URL+参数切换现货/合约”的接入策略。

## 7. 异常处理与可观测性

1. 按 market 维度隔离失败：PERP 失败不阻断 SPOT。
2. WS 重连计数按 market 维度打点。
3. 解析失败（无法识别 market/symbol）抛显式错误并记录结构化日志。
4. 发现旧码与新码歧义时输出告警，禁止静默覆盖。

## 8. 测试策略

### 8.1 单测

1. Binance provider spot/perp REST 路由与映射测试。
2. Binance provider spot/perp WS 事件映射测试。
3. `MarketDataService` 旧码兼容与新码解析测试。

### 8.2 E2E/回归

1. 保留现有 `market-data.e2e` override 回归。
2. 新增至少一条 `:PERP` 读取路径。
3. 复跑 strategy-signals 关键 smoke，验证 `instrumentType -> marketType` 无回退。

## 9. 分阶段实施计划（高层）

### Phase 1：Binance 合约能力补齐

1. code 规范与兼容读取。
2. Binance provider spot+perp 并存采集。
3. 存量数据迁移与回归。

### Phase 2：OKX 接入

1. 新增 OKX market-data provider（REST+WS）。
2. 接入 spot/perp URL 与参数模板配置（不新增第二套 provider 实现）。

### Phase 3：Hyperliquid 接入

1. 新增 Hyperliquid market-data provider（REST+WS）。
2. 复用统一 symbol 编码与 Kline 映射，并按 URL/参数切换现货/合约。

## 10. 风险与回滚

主要风险：

1. code 规范切换引发旧调用找不到 symbol。
2. 双 market 并存引发数据重复或覆盖。
3. WS 双链路并发导致资源开销上升。
4. 现货/合约 URL 或参数模板配置错误导致取错市场数据。

缓解：

1. 保留旧码到 `:SPOT` 的兼容窗口。
2. 上线前运行迁移校验与双写核对脚本。
3. 每阶段都提供开关与快速回退路径（按 provider 维度禁用）。
4. 启动时打印当前 spot/perp endpoints 与参数模板摘要，避免误配。

## 11. 验收标准

1. Binance 下，`SPOT/PERP` 可分别完成历史补数与实时订阅。
2. 策略使用合约 symbol 可获得稳定 bars，且执行 marketType 判定正确。
3. 现货路径行为不回退。
4. OKX/Hyperliquid 接入时不需要改动策略消费接口。
