# AI Quant Context Symbol Contract Design

日期：2026-05-06
Issue：#968

## 背景

AI Quant 策略对话中，用户首轮已经描述交易标的时，系统仍可能在后续追问交易标的。例如：

```text
ETH usdt，在 2500 到 3200 之间做多空网格，2倍杠杆，突破区间就停止。
15格
100usdt
okx
```

正确行为是第一轮锁定 `contextSlots.symbol = ETHUSDT`，后续回答 `okx` 后不再追问交易标的。当前失败的直接原因是 `SemanticSeedExtractorService.extractSymbol()` 只识别紧凑交易对，如 `ETHUSDT`、`ETH/USDT`、`ETH-USDT`，不能稳定覆盖 `ETH usdt`、`ETH`、`ETH 永续合约`、`比特币合约` 等自然语言表达。

这不是网格策略的特殊问题，而是 `contextSlots.symbol` 的写入口缺少统一的 market instrument contract 化识别。`exchange`、`marketType`、`timeframe` 现有规则可以保持不变；本设计只升级 `contextSlots.symbol`。

## 目标

- 保留现有 `contextSlots = { exchange, symbol, marketType, timeframe }` 主结构。
- 将 `contextSlots.symbol` 的所有写入口统一到一个 market instrument resolver。
- 支持显式交易对、base-only、中文币种别名、显式 quote、默认 USDT quote、venue symbol 后缀等表达。
- 默认把 `ETH` / `BTC` 等可信 base-only 表达补成 `ETHUSDT` / `BTCUSDT`，并标记为 `inferred`。
- 显式 quote 永远优先，例如 `ETH USDC` 归一为 `ETHUSDC`。
- 让 canonical spec、IR、publication、backtest snapshot 继续读取 `contextSlots.symbol`，但读到的是统一归一化后的 symbol。
- 防止 seed extractor 之外的入口继续用旧正则或原始字符串绕过新逻辑。

## 非目标

- 不重构 `contextSlots` 整体结构。
- 不升级 `exchange`、`marketType`、`timeframe` 的识别规则。
- 不新增策略族模板，不把 symbol 识别绑定到网格、均线、布林、RSI 等策略族。
- 不让 LLM planner 成为 symbol 归一化权威。
- 不改变 canonical spec / IR / publication 的市场字段 shape。
- 不在本设计中做交易所真实可交易 symbol 的远程校验；交易所可用性仍由后续 market data / backtest / deployment preflight 负责。

## 核心判断

值得做：这是一个真实主数据流问题。用户已经表达交易标的却被再次追问，会打断所有策略族的脚本生成流程。

关键洞察：

- 数据结构：`symbol` 仍属于 context 原子语义，但它需要 instrument contract 级别的 evidence、source 和 quote inference。
- 复杂度：把所有 symbol 写入口收敛到一个 resolver，比在 extractor、edit、clarification、legacy bridge 里各写一套正则更简单。
- 风险点：只修首轮 extractor 会漏掉 open slot 回答、语义编辑、planner patch 和 legacy bridge，最后仍可能落回旧方案。

## 方案比较

### 推荐方案：Context Symbol Contract Resolver

新增 `MarketInstrumentSymbolResolver`，所有写入 `contextSlots.symbol` 的入口都必须调用它。resolver 输出规范化 symbol 和 contract metadata，再由现有 semantic state builder 投影成 `SemanticSlotState`。

优点：

- 保留当前主数据流结构，改动面可控。
- 适用于所有量化策略，不按策略族打补丁。
- 支持回归测试精确覆盖每个入口。
- 后续 canonical、IR、publication 继续读 `contextSlots.symbol`，不需要大迁移。

代价：

- 需要审计所有 symbol 写入口。
- `SemanticSlotState` 需要承载或伴随少量 metadata，用来保留 source、evidence、contract shape。

### 备选方案：只增强 `extractSymbol()` 正则

优点：短期最小改动。

缺点：只能修首轮 seed 文本，无法覆盖用户回答 symbol open slot、后续编辑、planner patch、legacy bridge。这个方案会继续产生“某个入口识别，另一个入口漏识别”的旧问题。

### 备选方案：把整个 execution context 重构成新 atom

优点：理论上最统一。

缺点：当前问题只集中在 `symbol`，`exchange`、`marketType`、`timeframe` 已有稳定路径。重构整个 context 会扩大风险，并扰动 canonical、IR、publication、测试 fixture。

## 设计

### 1. Resolver 输出

新增一个纯解析服务或纯函数：

```ts
interface MarketInstrumentSymbolResolution {
  value: string
  source: 'user_explicit' | 'inferred'
  evidenceText: string
  base: string
  quote: 'USDT' | 'USDC' | 'USD'
  quoteSource: 'explicit' | 'default_usdt'
  venueSymbolHint?: string
  marketTypeHint?: 'perp' | 'spot'
}
```

resolver 不负责交易所可用性校验，只负责从用户文本中识别和归一化 market instrument identity。

### 2. 支持表达

必须支持：

- `ETHUSDT` -> `ETHUSDT`，`source=user_explicit`
- `ETH/USDT` -> `ETHUSDT`，`source=user_explicit`
- `ETH-USDT` -> `ETHUSDT`，`source=user_explicit`
- `ETH usdt` -> `ETHUSDT`，`source=user_explicit`
- `ETH USDC` -> `ETHUSDC`，显式 quote 覆盖默认 quote
- `ETHUSDT-SWAP` -> `ETHUSDT`，保留 `venueSymbolHint=ETHUSDT-SWAP`，给出 `marketTypeHint=perp`
- `ETHUSDT:PERP` -> `ETHUSDT`，给出 `marketTypeHint=perp`
- `ETH` -> `ETHUSDT`，`source=inferred`，`quoteSource=default_usdt`
- `BTC` -> `BTCUSDT`，`source=inferred`
- `ETH 永续合约` -> `ETHUSDT`，`source=inferred`，并可给 `marketTypeHint=perp`
- `BTC 永续合约` -> `BTCUSDT`，`source=inferred`
- `以太坊` -> `ETHUSDT`，`source=inferred`
- `比特币合约` -> `BTCUSDT`，`source=inferred`，并可给 `marketTypeHint=perp`

base-only 默认补 `USDT` 只对可信资产生效。可信资产来源可以先用本地 allowlist 覆盖主流币种，后续再接市场数据 symbol catalog。resolver 不能把普通英文单词识别为币种。

### 3. Slot Contract Metadata

`contextSlots.symbol` 的 `value` 仍为规范化后的字符串，保持兼容：

```ts
{
  slotKey: 'symbol',
  fieldPath: 'contextSlots.symbol',
  value: 'ETHUSDT',
  status: 'locked',
  priority: 'context',
  questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
  affectsExecution: true,
  evidence: {
    text: 'ETH',
    source: 'inferred'
  }
}
```

contract metadata 应在 slot 附近保留，供调试、后续验证和回归断言使用：

```ts
{
  kind: 'context',
  capabilities: [{
    domain: 'market',
    verb: 'identify',
    object: 'instrument',
    shape: {
      base: 'ETH',
      quote: 'USDT',
      symbol: 'ETHUSDT',
      quoteSource: 'default_usdt'
    }
  }],
  requires: [],
  params: {}
}
```

扩展 `SemanticSlotState`，增加可选 `contracts?: SemanticAtomContract[]`。这保持旧 slot 消费方兼容，同时让 symbol slot 可以携带 context contract。主链路的最终兼容输出仍必须是 `contextSlots.symbol.value = ETHUSDT`。

### 4. 必须升级的写入口

所有写入或改写 `contextSlots.symbol` 的入口都必须经过 resolver：

1. **Seed extractor**：首轮策略文本解析，例如 `ETH usdt...`。
2. **Semantic seed state builder**：接收 planner/seed patch 中的 symbol，结构化或字符串都要归一化。
3. **Open slot answer resolver / clarification answer path**：上一轮问交易标的时，用户回答 `ETH`、`ETH usdt`、`比特币合约` 也要锁定。
4. **Conversation semantic edit**：`把交易标的改成 ETH`、`换成 BTC 永续` 要 supersede 旧 symbol slot。
5. **Legacy checklist bridge**：旧 `symbols[0]` 或 `market.symbol` 进入 semantic state 前要归一化。
6. **Planner patch ingestion**：LLM planner 返回 `context.symbol` 或 `contextSlots.symbol` 时不能原样透传。

这些 authority 写入口在实现完成前必须全部接入 resolver，并由测试覆盖；只有无法影响主流程的旧 fixture 或显式 legacy session 才能分类为 compatibility-only。

### 5. 保持不变的读路径

以下路径可以继续读取 `contextSlots.symbol`：

- `StrategyExecutionContextService.resolveFromSemanticState()`
- `CanonicalSpecBuilderService`
- `CanonicalSpecV2IrCompilerService`
- `CodegenPublicationGenerationStage`
- `CompiledPublicationGate`
- backtest snapshot loader
- strategy summary / display projection

这些路径不需要成为 resolver 的调用方。它们的责任是消费已经归一化的 `contextSlots.symbol`，并在 publication gate 中继续做一致性检查。

### 6. 防止旧方案回流

新增 Symbol Authority Audit，按以下分类审计所有 symbol 相关读写：

- `Authority Write`：必须调用 resolver 后写入 semantic state。
- `Projection`：从 resolver/semantic state 输出兼容字段。
- `Compatibility Input`：legacy 或旧 fixture 输入，进入 semantic state 前必须归一化。
- `Validation`：只做一致性检查，不能反向决定用户还缺什么。
- `Display`：只展示，不参与 readiness。

未分类的 symbol 写入口视为未完成。

## 数据流

```text
user text / answer / edit / planner patch / legacy checklist
 -> MarketInstrumentSymbolResolver
 -> normalized symbol resolution
 -> contextSlots.symbol locked slot + instrument contract metadata
 -> semantic state merge/reducer
 -> existing execution context / canonical spec / IR / publication / backtest paths
```

当 resolver 成功锁定 symbol 后，`findNextOpenSemanticSlot()` 不应再返回 `contextSlots.symbol` open slot。后续如果用户只补 `okx`，系统应只更新 `exchange`，不再问交易标的。

## 错误处理

- 没有可信 base 或显式交易对：保持 `contextSlots.symbol` open，继续追问交易标的。
- base-only 是可信资产：默认补 `USDT`，source 标记为 `inferred`。
- 显式 quote 与默认 quote 冲突：显式 quote 优先。
- 同一句出现多个不同 symbol：生成冲突 open slot，要求用户确认唯一交易标的。
- venue symbol 后缀只作为 hint，不直接改变 canonical symbol value。
- resolver 识别到 `marketTypeHint` 时，可以辅助现有 marketType 识别，但不能覆盖用户显式 marketType。

## 测试

### Resolver Unit

覆盖：

- `ETHUSDT`
- `ETH/USDT`
- `ETH-USDT`
- `ETH usdt`
- `ETH USDC`
- `ETHUSDT-SWAP`
- `ETHUSDT:PERP`
- `ETH`
- `BTC`
- `ETH 永续合约`
- `BTC 永续合约`
- `以太坊`
- `比特币合约`
- 普通英文文本不误识别为 symbol

### Seed Extractor

- `ETH usdt，在 2500 到 3200 之间做多空网格...` 产出 `contextSlots.symbol = ETHUSDT`。
- `ETH永续合约，突破 3200 做多...` 产出 `ETHUSDT`，并保留 inferred evidence。

### Open Slot Answer

- 之前缺 symbol，用户回答 `ETH`，锁定 `ETHUSDT`。
- 用户回答 `ETH usdc`，锁定 `ETHUSDC`。

### Semantic Edit

- 已有 `BTCUSDT`，用户说 `把交易标的改成 ETH`，新状态为 `ETHUSDT`，旧 slot 被覆盖或 supersede。

### Mainflow Conversation Regression

对用户样例执行完整对话：

```text
ETH usdt，在 2500 到 3200 之间做多空网格，2倍杠杆，突破区间就停止。
15格
100usdt
okx
```

期望：

- 第一轮已锁定 `contextSlots.symbol.value = ETHUSDT`。
- 回答 `okx` 后不再追问交易标的。
- 后续 canonical spec / IR / publication snapshot 中 symbol 均为 `ETHUSDT`。

### Publication Consistency

发布路径断言：

- `canonicalSpec.market.symbol = ETHUSDT`
- `compiledIr.market.symbol = ETHUSDT`
- `strategyConfig.symbol = ETHUSDT`
- backtest snapshot / params snapshot 不出现 `UNKNOWN`、空值或默认 `BTCUSDT` fallback

## 验收标准

- 用户已经表达交易标的时，不再重复追问交易标的。
- 所有 symbol 写入口都经过 resolver 或被明确标记为 compatibility-only。
- `exchange`、`marketType`、`timeframe` 行为保持现状。
- canonical、IR、publication、backtest 消费到归一化 symbol。
- 不新增策略族专用 symbol 识别逻辑。
- 不让 LLM planner 输出成为未经校验的 symbol 权威。
