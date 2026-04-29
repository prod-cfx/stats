# OKX 合约策略广场 Symbol 绑定设计

## 背景

策略广场中的部分策略声明为 OKX 合约策略，例如 `OKX 合约 BTCUSDT 1m`。这类策略的发布快照必须携带 `marketType: 'perp'`，编译执行模型必须携带 `instrumentType: 'perpetual'`。

当前运行链路中存在一个关键风险：裸 symbol `BTCUSDT` 在 symbol 查询工具里会默认归一成 `BTCUSDT:SPOT`。如果策略发布或运行时只携带裸 symbol，而没有把 `marketType` 参与到 symbol 解析，合约策略会被绑定到现货 symbol metadata。后续执行器会基于 `symbol.instrumentType === 'SPOT'` 推导 `marketType: 'spot'`，最终 OKX 下单走现货 `BTC-USDT`，而不是永续合约 `BTC-USDT-SWAP`。

本设计只覆盖后续新发布或新运行的策略广场合约策略。已发布、已运行的历史实例不做迁移，不批量改数据库。

## 目标

- 策略广场的新合约策略必须按合约下单。
- 新策略中的现货与合约必须能稳定分流：
  - `spot` 策略下单到现货。
  - `perp` 策略下单到永续/合约。
- 裸 symbol 不能单独决定市场类型；`marketType` 是交易市场类型的权威输入。
- 显式 symbol 后缀与策略市场类型冲突时，必须拒绝发布或跳过执行，不能静默降级。

## 非目标

- 不迁移历史策略实例。
- 不修复已经发出的错误现货订单。
- 不改 OKX API key 权限管理。
- 不重做交易所 adapter 架构。
- 不扩大到杠杆、保证金模式、仓位模式的完整产品化配置，只保留当前链路已有默认行为。

## 现状观察

已存在的 OKX 下单客户端具备合约能力：

- `marketType: 'spot'` 时使用 `instType: 'SPOT'`、`tdMode: 'cash'`。
- `marketType: 'perp'` 时使用 `instType: 'SWAP'`、`tdMode`、`posSide`，并支持 `reduceOnly`。
- OKX 永续 symbol 应转换为 `BTC-USDT-SWAP`。

问题更靠前：策略运行时查 symbol 时，如果只传 `BTCUSDT`，当前归一规则会默认 `BTCUSDT:SPOT`。这会导致 signal symbol metadata、order params、trading service market type 全部沿着现货方向传播。

## 设计原则

市场类型必须从策略意图开始贯穿全链路：

1. 策略生成/发布阶段锁定 `marketType`。
2. symbol 查询阶段使用 `symbol + marketType` 共同定位市场。
3. signal metadata 阶段保留 `instrumentType`。
4. 执行阶段校验策略快照、signal symbol、order params、trading service 调用一致。
5. 交易所 adapter 只负责把统一订单转换成交易所原生参数。

## 方案

### 1. 新增按市场类型归一 symbol 的工具

在现有 market symbol 工具旁新增或扩展函数：

```ts
normalizeRequestedCodeForMarket(symbol, marketType)
```

规则：

- `BTCUSDT + spot` -> `BTCUSDT:SPOT`
- `BTCUSDT + perp` -> `BTCUSDT:PERP`
- `BTCUSDT:SPOT + spot` -> `BTCUSDT:SPOT`
- `BTCUSDT:PERP + perp` -> `BTCUSDT:PERP`
- `BTCUSDT:SPOT + perp` -> 冲突
- `BTCUSDT:PERP + spot` -> 冲突

没有市场类型上下文的旧调用继续使用现有默认 `SPOT` 逻辑，避免扩大影响面。

### 2. 策略广场发布/运行时使用市场类型查 symbol

策略广场相关运行链路读取发布快照参数时，同时读取：

- `symbol`
- `marketType`
- `exchange`
- `timeframe`

当 `marketType` 存在时，查 symbol 必须调用按市场类型归一的新路径。对 `marketType: 'perp'` 的 `BTCUSDT`，应查询 `BTCUSDT:PERP`，拿到 `instrumentType: 'PERPETUAL'` 或等价合约类型。

### 3. 多 leg 与 runtime 路径保持一致

单 symbol runtime、published snapshot runtime、多 leg 数据加载路径都应使用同一套解析规则。不能出现单 leg 按 `marketType`，多 leg 又默认 `SPOT` 的分叉。

如果某个 leg 显式给出 `:SPOT` 或 `:PERP`，显式后缀优先，但必须与策略上下文 `marketType` 一致。多市场策略不在本次范围内；策略广场这类单市场策略使用统一 `marketType`。

### 4. 执行前一致性校验

执行器构造订单前增加轻量一致性校验：

- 发布快照或 signal provenance 中的市场类型。
- symbol metadata 的 `instrumentType` 归一结果。
- order params 的 `marketType`。

三者不一致时，不创建真实订单。本次执行标记为 skipped 或 failed，并记录明确原因，例如 `MARKET_TYPE_MISMATCH`。这能防止后续新路径再次把合约策略悄悄打到现货。

### 5. OKX 下单保持现有 adapter 分流

OKX adapter 目前已经按 `marketType` 分流，无需重写：

- 现货：`BTC/USDT` -> `BTC-USDT`，`instType: 'SPOT'`，`tdMode: 'cash'`。
- 合约：`BTC/USDT:PERP` -> `BTC-USDT-SWAP`，`instType: 'SWAP'`，`tdMode: 'cross'` 或上游覆盖，`posSide` 按开多/开空/平仓动作推导。

本次实现应重点保证传入 adapter 的 `marketType` 与 symbol 已经正确。

## 数据流

```text
策略文本/策略广场配置
  -> canonicalSpec.market.marketType / lockedParams.marketType
  -> published snapshot runtime params
  -> normalizeRequestedCodeForMarket(symbol, marketType)
  -> Symbol metadata: SPOT or PERPETUAL
  -> TradingSignal.symbol.instrumentType
  -> SignalExecutor orderParams.marketType
  -> TradingService.placeOrder(exchangeId, marketType, input)
  -> OKX adapter: SPOT or SWAP
```

## 错误处理

- 缺少 `marketType`：策略广场发布/运行路径应视为绑定信息不足，跳过执行或阻止发布，不能默认现货。
- symbol 后缀冲突：返回明确错误，不自动改写用户显式选择。
- 查不到合约 symbol：跳过执行，并记录目标交易所不支持该合约 symbol。
- 执行前市场类型不一致：不下单，记录 `MARKET_TYPE_MISMATCH`。

## 测试计划

单元测试：

- `normalizeRequestedCodeForMarket('BTCUSDT', 'perp')` 返回 `BTCUSDT:PERP`。
- `normalizeRequestedCodeForMarket('BTCUSDT', 'spot')` 返回 `BTCUSDT:SPOT`。
- 显式后缀与市场类型冲突会返回失败或抛出领域异常。
- 旧的 `normalizeRequestedCode('BTCUSDT')` 仍默认 `BTCUSDT:SPOT`。

策略运行测试：

- published snapshot 中 `marketType: 'perp'` 且 `symbol: 'BTCUSDT'` 时，repository 查询 `BTCUSDT:PERP`。
- 策略广场合约策略生成的 signal symbol metadata 为 `PERPETUAL`。
- 执行器最终调用 `tradingService.placeOrder(..., 'perp', { marketType: 'perp', symbol: 'BTC/USDT:PERP' })`。
- `marketType: 'spot'` 的新策略仍调用现货下单路径。

回归测试：

- 无市场类型上下文的旧 symbol 查询仍默认现货，避免影响历史普通行情/现货路径。
- 跨交易所跟单重算 order params 时保留原信号的 `instrumentType`，不会把 perp 降级成 spot。

## 验收标准

- 后续策略广场合约策略不会再因裸 `BTCUSDT` 被绑定到 `BTCUSDT:SPOT`。
- OKX 合约策略的订单请求使用 `marketType: 'perp'`。
- OKX 原生订单参数中合约路径使用 `instType: 'SWAP'` 与 `BTC-USDT-SWAP`。
- 现货策略仍使用 `marketType: 'spot'` 与 `BTC-USDT`。
- 市场类型冲突时不会真实下单。

## 风险与兼容性

风险主要在 symbol 查询路径。如果直接改现有默认归一函数，会影响大量默认现货场景。因此本设计不改变旧函数默认行为，而是新增带 `marketType` 的显式路径，并只在策略广场/发布快照等已有市场类型上下文的链路使用。

对历史实例保持兼容：不迁移、不重写、不自动重跑。新发布和后续运行的策略使用新绑定规则。
