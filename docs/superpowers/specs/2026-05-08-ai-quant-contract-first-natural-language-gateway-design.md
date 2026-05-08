# AI Quant Contract-First Natural Language Gateway Design

日期：2026-05-08
Issue：#984
阶段：并行子线 - 自然语言入口与展示命名 contract 化

## 背景

Issue #984 正在把 AI Quant 从策略族模板升级为原子语义 contract 主线。当前 Phase 0/1/2 已完成，Phase 3 正在收尾，Phase 4/5 尚未开始。

阶段 0/1/2 已证明主数据流可以承载更复杂的 atom 与组合语义：`SemanticState`、contract readiness、canonical spec、IR、runtime/backtest/live signal 都在向同一条事实链收敛。现在暴露的问题不在执行主链是否能表达组合策略，而在自然语言入口和用户展示命名没有跟上 contract 能力。

典型问题来自以下输入：

```text
15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空
入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损
```

系统当前能抓到部分意图，但会把 `boll` 相关边界展示成 `generic_boundary`，并把用户可见确认文案绑定到内部 key。这说明入口链路仍在用旧 extractor / 旧 display 命名兜底，而不是直接消费 atomic contract 能力。

当前产品仍处于测试阶段，不承担旧策略、旧 display graph、旧 snapshot 的兼容包袱。本设计只面向最新 atomic contract truth。

## 判断

这次不能只补一个 `boll` alias。截图里的 `generic_boundary` 只是症状，根因是“支持能力、自然语言抽取、展示命名、澄清问题、golden case”没有被作为同一个 contract surface 管理。

因此推荐建立 contract-first 的自然语言入口层，让每个 supported atom 在进入系统时就必须具备：

- 自然语言别名与样例。
- 标准语义归一化规则。
- 用户可见展示名。
- 澄清问题渲染。
- golden utterance 覆盖。

这样后续 Phase 4/5 或更多复杂 atom 扩展时，入口不会永远滞后于执行链。

## 目标

1. 自然语言入口跟随 atomic contract 演进，而不是独立维护一套策略族 checklist。
2. 用户可见文案不得泄漏内部 key，例如 `generic_boundary`、`indicator.above`、`indicator.below`。
3. supported atom 必须声明 aliases、displayName、examples、clarification renderer 与 golden utterances。
4. 复杂策略必须先归一化为标准 `SemanticState`，再进入 readiness、canonical spec、IR、runtime。
5. 新增 supported atom 时，如果没有入口样例、展示渲染和 golden corpus，就视为未完成。

## 非目标

- 不维护旧自然语言 display graph 或旧 snapshot 兼容。
- 不把旧 checklist family name 当作事实来源。
- 不在 gateway 中新增独立运行时路径。
- 不让自然语言入口阻塞 Phase 3/4/5 的执行链开发。
- 不一次性支持 portfolio orchestration、跨标的组合风控或多策略调度语义。

## 推荐架构

### `NaturalLanguageGateway`

职责：将原始文本转换为带证据的候选语义 frame，不做部署判断，不生成 runtime truth。

首批 frame 类型：

- `ContextFrame`：交易所、标的、市场类型、周期。
- `IndicatorCompareFrame`：价格与 MA/EMA/SMA/RSI/MACD 等指标比较。
- `BoundaryTouchFrame`：BOLL 上轨、中轨、下轨等边界触发。
- `PositionLifecycleFrame`：开仓、平仓、减仓、加仓、反手等动作意图。
- `RiskFrame`：止损、止盈、移动止损、分批止盈等风控。
- `CombinationFrame`：AND、OR、同向条件组、side-specific 条件组。

frame 必须保留来源片段、置信度和归一化原因，便于澄清问题和测试定位。

### `SemanticFrameNormalizer`

职责：把候选 frame 归一化为唯一事实载体 `SemanticState`。

归一化规则：

- alias normalization：`boll`、`布林`、`布林带` 统一到 `bollinger`。
- indicator expansion：`ema20 ema60 ema144 上方` 展开为三个 compare condition。
- side binding：`只开多`、`只开空` 绑定到 long/short entry gate。
- context inheritance：同一句中的周期、交易所、标的、市场类型向相关 atom 继承。
- entry/risk/action binding：入场、止损、仓位动作分别落到 owner atom。
- open slot ownership：缺仓位大小时只由 sizing/position owner 提问，不引入无关澄清槽。

normalizer 输出必须只包含 contract 可理解的 atom、params 与 group 结构；不能把内部 extractor fallback key 带入展示或部署链路。

### `SemanticPresentationRegistry`

职责：为 contract atom 提供用户可见元数据。它可以扩展现有 `SemanticAtomRegistryService`，但不能与 contract readiness 各自维护一套 truth。

每个 supported atom 至少声明：

- `publicName`：用户可见名称。
- `aliases`：自然语言别名。
- `positiveExamples`：应识别表达。
- `negativeExamples`：不应误识别表达。
- `displayRenderer`：确认文案与摘要。
- `clarificationRenderer`：缺槽位问题。
- `contractSubstrate`：对应的 semantic atom / canonical atom / runtime requirement。

readiness 判断支持一个 atom 时，presentation metadata 也必须可用，否则测试失败。

## 主数据流

```text
raw input
  -> NaturalLanguageGateway
  -> semantic frames
  -> SemanticFrameNormalizer
  -> SemanticState
  -> SemanticContractReadinessService
  -> SemanticStateProjectionService / display graph
  -> CanonicalSpecBuilder
  -> IR
  -> runtime / backtest / live signal
```

关键约束：

- `SemanticState` 仍是入口之后的唯一事实来源。
- display graph 只读 `SemanticState` 与 presentation metadata，不读旧 extractor key。
- canonical、IR、runtime 不感知自然语言 frame。
- unsupported 或 ambiguous 表达进入澄清，不伪装成 supported。

## 首批迁移范围

首批迁移只覆盖会影响当前测试入口和 #984 近期复杂策略闭环的核心能力。

- context：exchange、symbol、marketType、timeframe。
- indicators：MA、SMA、EMA、BOLL/布林/布林带、RSI、MACD。
- 多指标 AND：例如 `价格都在 ema20 ema60 ema144 上方/下方`。
- BOLL 边界：upper、middle、lower，以及 touch、break、return。
- 双向入场：例如 `下轨开多，上轨开空`。
- 基础风控：百分比止损、固定止损、止盈。
- 仓位大小：账户百分比、USDT quote、base quantity。
- 用户展示：确认文案、缺槽位问题、策略摘要不得出现内部 key。

## P0 Golden Case

输入：

```text
15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空
入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损
```

期望归一化：

- context：
  - exchange：Binance
  - symbol：BTCUSDT
  - marketType：perpetual
  - timeframe：15m
- long entry gate：
  - `close > ema20`
  - `close > ema60`
  - `close > ema144`
  - `touch bollinger.lower`
- short entry gate：
  - `close < ema20`
  - `close < ema60`
  - `close < ema144`
  - `touch bollinger.upper`
- risk：
  - `stop_loss_pct = 5`
- open slots：
  - 只缺 position sizing。

用户可见确认文案应表达为：

```text
我理解的策略是：
15m BTCUSDT Binance 永续合约。
只在价格同时位于 EMA20、EMA60、EMA144 上方时允许开多，并在触及 BOLL 下轨时开多。
只在价格同时位于 EMA20、EMA60、EMA144 下方时允许开空，并在触及 BOLL 上轨时开空。
止损为入场后亏损 5%。
还缺少单笔仓位大小。
```

确认文案不得出现 `generic_boundary`、`indicator.above`、`indicator.below` 或其他内部 key。

## 测试门禁

新增 `semantic-gateway-golden-corpus`，覆盖从原始输入到最终展示和 canonical spec 的完整链路。

必须覆盖：

1. raw input -> frames。
2. frames -> `SemanticState`。
3. `SemanticState` -> readiness / open slots。
4. `SemanticState` -> display graph / clarification text。
5. `SemanticState` -> canonical spec。

失败门禁：

- supported atom 没有 display renderer。
- supported atom 没有 alias 或 examples。
- display graph 包含内部 key。
- `recognized_unsupported` 被展示成可部署 supported。
- 新 contract atom 没有正例、反例和澄清样例。
- P0 golden case 不能稳定通过。

## 与 #984 Phase 3/4/5 的并行关系

这个入口重构可以与 Phase 3/4/5 并行，但要保持边界清晰。

Phase 3/4/5 继续负责：

- `SemanticState` 类型与 contract 扩展。
- readiness、canonical spec、IR、AST、runtime、backtest、live signal。
- 新 atom 的执行闭环。

Natural Language Gateway 子线负责：

- raw text -> semantic frame。
- semantic frame -> 标准 `SemanticState`。
- contract metadata -> 展示与澄清。
- golden utterance -> full chain 验证。

集成协议：

- Phase 3/4/5 新增 supported atom 时，同步补齐 presentation metadata。
- Gateway 子线不直接修改 runtime 语义，只消费最新 `SemanticState` 与 contract registry。
- Phase 4/5 完成后，以 gateway corpus 作为最终收敛测试，验证复杂策略能从用户输入进入执行链。

## Issue #984 更新建议

需要更新 #984。建议不是另开大 issue，而是在 #984 中追加一个并行子线说明：

```text
补充并行子线：Contract-first Natural Language Gateway

当前 Phase 0/1/2 已完成，Phase 3 正在收尾，Phase 4/5 尚未开始。主数据流已经具备组合 atom 与复杂策略执行扩展基础，但自然语言抽取、展示命名和澄清问题还没有跟上 contract 能力，导致 BOLL 等表达在入口处退化为 generic_boundary 这类内部 key。

为避免后续复杂 atom 完成后入口仍不可用，#984 增加一个并行子线：raw input -> semantic frames -> SemanticState -> readiness/display/canonical spec。该子线不阻塞 Phase 3/4/5 的执行链开发，但 supported atom 的完成标准需要扩展为：contract + execution path + aliases/examples + display renderer + clarification renderer + golden utterance。

首批验收以 15m BTCUSDT 永续、EMA20/60/144 趋势过滤、BOLL 上下轨双向入场、5% 止损、缺仓位大小澄清为 P0 golden case。用户可见文案不得出现 generic_boundary 或其他内部 key。
```

## 风险与缓解

### 范围过大

首批只迁移截图相关路径和近期复杂策略必需的基础 atom。portfolio orchestration、跨标的组合风控、多策略调度不进入本子线。

### 与 Phase 3 类型变更冲突

Gateway 只依赖稳定的 `SemanticState` 边界与 contract metadata。Phase 3 改类型时，Gateway 通过 normalizer 和 presentation adapter 对齐，不直接写 runtime 结构。

### 抽取误识别

frame 保留 evidence 和 confidence。低置信或多义表达进入 clarification，不能为了提高命中率静默生成危险交易条件。

### 展示与执行再次分叉

display graph 只读 `SemanticState` 和 presentation metadata。测试直接断言 display 输出和 canonical spec 来自同一个 semantic truth。

## 验收标准

1. P0 golden case 从原始输入到 canonical spec 全链路通过。
2. 用户确认文案中没有内部 key 泄漏。
3. 缺仓位大小时只询问 sizing，不额外询问已可从文本确定的条件。
4. `boll`、`布林`、`布林带` 等别名统一归一化为 BOLL/Bollinger contract atom。
5. `ema20 ema60 ema144 上方/下方` 被归一化为同一 side gate 下的 AND 条件组。
6. 新增 supported atom 缺 presentation metadata 或 golden utterance 时测试失败。
7. Phase 4/5 完成后，gateway corpus 可以作为 #984 的入口级回归门禁。

