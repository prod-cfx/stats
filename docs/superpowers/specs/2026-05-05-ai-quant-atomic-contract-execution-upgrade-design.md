# AI Quant Atomic Contract Execution Upgrade Design

日期：2026-05-05

## 背景

AI Quant 主数据流已经收敛到原子语义结构：

```ts
triggers / actions / risk / position / contextSlots
```

并且每个可执行语义节点都通过 contract capability shape 参与 readiness、澄清、确认和生成。近期测试说明这个方向是对的，但覆盖仍停在较简单的单条件策略：当用户表达趋势过滤、RSI 二段确认、布林带叠加成交量、MACD 与均线方向、突破后回踩确认、ATR 动态止损止盈、连续 K 线、模糊反弹确认时，系统会出现以下问题：

- 只能识别第一句或单个指标，丢失组合条件。
- `gate/filter`、`sequence`、`confirmation` 没有稳定落到 trigger atom。
- 成交量、ATR、复杂确认过早进入推荐替代策略，而不是先补齐语义和可执行链路。
- 前端逻辑图仍可能依赖旧 condition key 白名单，无法稳定展示新版原子语义。
- 后端语义正确后，如果 canonical / AST / IR / script / backtest / deploy 没同步，会产生回测与部署语义不一致。

本次目标不是继续按策略族、指标 key 或样例打补丁，而是把通用量化表达端到端升级为同一条 atomic contract execution path。

## 范围

代码库中主站后端服务与量化服务是微服务关系。AI 量化的主要实现集中在 `apps/quantify`，因此本文里的“后端”只指 `apps/quantify`，不指主站后端服务。本设计覆盖：

- `apps/quantify`：语义抽取、contract readiness、canonical spec、AST / IR、脚本生成、回测、部署/runtime signal。
- `apps/quantify/prisma`：Prisma schema、migration、seed 或 snapshot 持久化兼容。
- `apps/front`：AI Quant 对话、openSlot 追问、逻辑图确认、回测/部署入口展示。
- `packages/api-contracts`：如 OpenAPI DTO 变化，需要重新生成合约。

不纳入主站后端服务的业务实现；仅当跨服务 API 合约或前端类型消费需要同步时，通过 `packages/api-contracts` 做兼容更新。

## 目标

1. 所有层继续使用 `triggers / actions / risk / position / contextSlots` 作为唯一语义事实来源。
2. 扩充 atom contract shape，让组合策略以 contract graph 表达，而不是策略族模板。
3. 端到端支持本次样例和同类组合策略：语义、澄清、确认、canonical、AST/IR、script、backtest、deploy/runtime signal、前端逻辑图。
4. 缺失执行信息必须成为 owner atom 的 `openSlots`，例如仓位、反弹确认定义、模糊“买一点”。
5. 这些通用能力范围内不能提前推荐替代策略；只有真正越出能力边界时才走现有“改策略/推荐策略”路径。
6. 回测和部署必须使用同一份 published snapshot / emitted decision protocol，避免语义漂移。

## 非目标

- 不引入策略族作为 readiness 或编译 authority。
- 不恢复 legacy checklist 作为主流程事实来源。
- 不让前端重新推断策略语义。
- 不支持所有高级量化能力；多时间框架、盘口/orderbook、机器学习信号、分批仓位、动态调参仍可 fallback。
- 不迁移所有历史会话；历史数据通过兼容 fallback 读取。

## 必须支持的策略表达

### 原始失败样例

- `BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。`
- `ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。`
- `我想在大跌后抄底，但不要接飞刀，反弹确认后再买。`
- `BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。`
- `BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。`

### 组合策略样例

- 趋势过滤 + RSI 入场：
  `BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。`
- 布林带 + 成交量过滤：
  `ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。`
- MACD + 均线方向：
  `SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。`
- 突破 + 回踩确认：
  `BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。`
- ATR 动态止损：
  `ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。`

## 方案比较

### 推荐方案：Atomic Contract Execution Path 升级

沿用原子语义主结构，在 `apps/quantify` 中扩充通用 contract graph、canonical predicate、IR helper 和 runtime helper。前端和 Prisma 只承载这套语义，不另建解释层。

优点：

- 一次解决组合条件、确认链、风控表达、回测/部署一致性。
- 避免按策略族补模板。
- 后续新增表达时只扩 atom shape / predicate helper。

代价：

- 改动覆盖前端、quantify、Prisma、合约和测试。
- 需要谨慎做版本化和兼容，防止旧 snapshot 读取失败。

### 备选方案：只增强前置 extractor

只让自然语言更容易落入现有 atoms，不同步 AST/IR/runtime。

优点：短期快。

缺点：会出现“理解正确但生成/回测/部署不一致”，不满足本次目标。

### 备选方案：新增策略族模板

为 RSI 趋势、布林成交量、ATR 等新增模板。

优点：单个样例实现快。

缺点：违背 atomic mainflow，后续仍然会被新表达击穿。

## 设计

### 1. 原子语义和 contract shape

继续保持顶层结构不变：

```ts
interface SemanticState {
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  contextSlots: SemanticContextSlots
}
```

扩充 trigger / risk 的通用 contract shape：

- `logical.allOf` / `logical.anyOf`
- `phase.gate` / `phase.entry` / `phase.exit`
- `sequence.ordered`
- `confirmation.retest_hold`
- `price.rolling_extrema`
- `indicator.compare`
- `indicator.cross`
- `volume.relative_average`
- `risk.atr_multiple_stop`
- `risk.atr_multiple_take_profit`
- `state.remembered_level`

这些是 contract shape，不是策略族。每个 atom 仍带 `id/key/status/source/params/contracts/openSlots`。

### 2. 语义抽取

`SemanticSeedExtractorService` 和事件解析器需要变成通用归一入口：

- 一句话内允许多个条件，并保留 AND / OR。
- `只在/上方时/过滤` 解析为 gate trigger。
- `跌破后重新上穿` 解析为 sequence trigger。
- `突破后回踩不破` 解析为 sequence + remembered level。
- `成交量高于过去 20 根均量 1.5 倍` 解析为 volume relative average trigger。
- `2 倍 ATR 止损 / 3 倍 ATR 止盈` 解析为 risk atoms。
- `反弹确认后再买` 如果缺具体确认定义，创建 confirmation openSlot。
- `买一点` 创建 position sizing openSlot。

unsupported fallback 必须在语义抽取和 openSlot 之后发生。属于本次支持范围的表达不能提前 fallback。

### 3. Readiness 和 openSlots

readiness 只来自：

- contextSlots 是否完整。
- atom openSlots 是否关闭。
- contract requirements 是否满足。
- contract shape 是否无冲突。
- projection/runtime capability 是否覆盖。

示例 openSlots：

- `position.sizing`：`请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。`
- `trigger.confirmation.rebound_definition`：`请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。`
- `trigger.confirmation.pullback_hold`：`请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。`

这些问题必须指向 owner atom，不能落回 legacy checklist reason。

### 4. Canonical spec / AST / IR

canonical builder 只读取 atom contracts，生成通用 predicate tree：

```ts
type Predicate =
  | { kind: 'allOf'; items: Predicate[] }
  | { kind: 'anyOf'; items: Predicate[] }
  | { kind: 'sequence'; steps: Predicate[]; memory?: MemorySpec }
  | { kind: 'compare'; left: SeriesExpr; op: CompareOp; right: SeriesExpr | ValueExpr }
  | { kind: 'cross'; direction: 'over' | 'under'; left: SeriesExpr; right: SeriesExpr | ValueExpr }
```

AST / IR 需要表达：

- gate predicates
- entry predicates
- exit predicates
- risk predicates
- sequence state
- remembered breakout level
- action target
- position sizing

IR 不允许使用策略族名称作为编译分支 authority。

### 5. Script emitter 和 runtime helper

新增或复用通用 helper：

- `ma(series, period)` / `ema(series, period)`
- `rsi(series, period)`
- `bollinger(series, period, stdDev)`
- `macd(series, fast, slow, signal)`
- `atr(period)`
- `sma(volume, period)`
- `rollingHigh(high, lookback)` / `rollingLow(low, lookback)`
- `crossesAbove(left, right)` / `crossesBelow(left, right)`
- `allOf(...)` / `anyOf(...)`
- `sequenceState(key, steps)`
- `rememberLevel(key, value)` / `readRememberedLevel(key)`

回测和部署运行同一份 emitted script / decision protocol。若 helper 需要持久状态，使用现有 runtime execution state 模型扩展，状态 key 必须来自 semantic contract，而不是策略族。

### 6. Backtest / Deploy parity

`apps/quantify` 的 backtest runner 和 runtime signal/deploy 路径必须共享：

- published snapshot
- canonical digest
- compiled script
- runtime helper semantics
- execution state key

测试必须证明同一 snapshot 在回测与部署信号中对 entry/exit/risk 的解释一致。

### 7. Prisma / 数据库

优先复用现有 JSON 字段：

- codegen session `semanticState`
- strategy instance / conversation `semanticState`
- published snapshot `semanticGraph`
- published snapshot `strategySummary`
- snapshot compatibility metadata

如新版 contract graph、runtime requirements 或 helper state keys 不能可靠放入现有字段，则增加最小字段或 metadata，并提供 `apps/quantify/prisma` migration。Prisma 变更后必须执行格式化、generate 和 contracts 相关构建。

版本化要求：

- 新 snapshot 标记 atomic contract execution schema version。
- 旧 snapshot 保持兼容读取。
- 新前端优先读新版 display graph，旧数据走兼容 fallback。

### 8. 前端

`apps/front` 需要同步：

- 对话页显示新版 openSlot 业务问题。
- 逻辑图确认页优先使用 `apps/quantify` 输出的 semantic display graph。
- 展示 AND / OR / gate / sequence / risk / position / context。
- 对本次支持范围内策略，不展示替代策略推荐。
- 超范围 fallback 时，仍保留现有推荐策略 UX。

前端不再从旧 condition key 白名单推断新版语义；展示语义由 `apps/quantify` 输出。

### 9. API contracts

如果响应 DTO 增加 display graph、runtime requirement、compatibility metadata 或 capability 状态字段，需要：

- 更新 `apps/quantify` DTO。
- 导出 OpenAPI。
- 重新生成 `packages/api-contracts`。
- 更新 `apps/front` 类型消费。

## 错误处理

- 缺执行参数：生成 owner openSlot。
- 支持范围内 projection 缺口：补齐 canonical/IR/script/helper，不允许推荐替代策略。
- 超范围能力：走现有 unsupported fallback 和推荐策略。
- compiler/runtime 错误：fail closed，返回可观测错误，不发布不可执行 snapshot。
- 前端 display graph 缺失：旧数据可 fallback，新数据应由 `apps/quantify` 测试兜住。

## 测试策略

### Quantify unit / integration

- semantic extraction：10 个样例全部生成完整 atoms。
- readiness：缺仓位、模糊确认正确 openSlot。
- contract：每个 executable atom 有 capability shape。
- canonical / AST / IR：AND/OR、sequence、rolling high/low、volume average、ATR multiple 全部可投影。
- emitter：生成脚本包含对应 helper，不出现策略族模板分支。
- backtest：样例 snapshot 可创建并运行。
- deploy/runtime signal：同一 snapshot 可生成 runtime signal。
- parity：回测和 runtime signal 对同一 bars 输入给出一致 decision。
- negative：支持范围内不提前推荐 MA 替代策略。

### Front unit

- openSlot 文案展示为业务语言。
- display graph 渲染 AND / OR / gate / sequence / risk。
- `apps/quantify` display graph 存在时不走旧白名单推断。
- 超范围 unsupported 仍可展示推荐策略。

### Prisma / migration

- migration 可应用。
- Prisma generate 通过。
- 旧 snapshot fixture 可读取。
- 新 snapshot fixture 可持久化并恢复 semantic state / display graph / runtime requirements。

## 验收标准

1. 10 个样例都能端到端通过语义、补槽、确认、生成、回测和部署/runtime signal 的最小验证。
2. 所有新增能力都由 atom contracts 驱动，不由策略族模板驱动。
3. 前端逻辑图能展示组合条件、确认链、风控和 context。
4. 数据库和 Prisma 能持久化并恢复新版 snapshot。
5. 回测和部署信号复用同一语义和脚本。
6. 支持范围内不提前推荐替代策略。
7. 超范围能力仍能走现有改策略/推荐策略路径。
8. 主站后端服务不参与本次业务改造；AI 量化后端实现集中在 `apps/quantify`。
