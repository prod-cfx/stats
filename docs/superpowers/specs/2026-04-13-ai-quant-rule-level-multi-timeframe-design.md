# AI Quant 规则级多周期语义设计

日期：2026-04-13

状态：设计已确认，待用户审阅

## 1. 背景

当前 AI Quant 已经开始在部分链路支持规则级周期：

- 文本抽取阶段可以从单条 entry / exit 规则中识别周期
- semantic graph builder 会优先从规则文本提取各自的 timeframe
- IR 层允许 predicate / series 绑定具体 timeframe

但系统的真相源仍未完全收敛，仍然存在以下问题：

- checklist 仍以 `timeframes: string[]` 作为弱结构字段，而不是规则级字段
- clarification summary 仍按单个全局 `timeframe` 展示策略
- canonical spec 的 `market.timeframe` 仍承担了超出“默认周期”的职责
- spec / summary / backtest / deploy 的投影链路仍可能把多周期策略重新压成单周期

这导致真实用户输入：

`OKX BTCUSDT；3 分钟内下跌 1% 买入；15 分钟内上涨 2% 卖出；单笔 10% 资金`

被错误识别成：

- 入场：`3m 内下跌 1% 买入`
- 出场：`3m 内上涨 2% 卖出`

表面上这是一个文本抽取 bug，但根因不是单点正则，而是系统仍处于“局部支持多周期、整体仍按单周期建模”的半升级状态。

## 2. 目标

本次设计目标：

1. 让规则级多周期成为一等语义，而不是临时从文本中猜出来的附属信息
2. 让 `entry / exit / risk` 规则都可以独立携带自己的 `timeframe`
3. 让 clarification、canonical spec、semantic graph、IR、summary、backtest、deploy 全链路消费同一份规则级周期语义
4. 一次性解决未来多周期策略的表达一致性，而不是只修复“3m 入场 + 15m 出场”这一例

## 3. 非目标

本次不做：

- 重写整个策略编译器
- 推翻或重排现有主数据流
- 允许任意跨周期布尔表达式混用并自动对齐
- 改变现有单周期策略的用户体验
- 在本设计中扩展新的策略家族

## 4. 主数据流边界

本次会动主数据流的核心语义结构，但不会推翻主数据流本身。

必须保持的主链路形状为：

`natural language -> clarification gate -> canonical spec v2 -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish -> publishedSnapshotId -> backtest(using publishedSnapshotId) -> report -> deploy(using publishedSnapshotId, gated by report)`

本次允许修改的是：

- 每一阶段之间传递的周期语义载荷
- clarification gate 内部如何保存和展示规则级 timeframe
- canonical spec v2 如何表达 `defaultTimeframe + rule timeframe`
- semantic view、IR、publish snapshot、backtest、deploy 如何只消费确认后的规则级周期语义

本次不允许修改的是：

- 主链路阶段顺序
- `confirm canonical snapshot` 作为确认闸口的角色
- `publishedSnapshotId` 作为回测与部署真相源句柄的边界
- `backtest(using publishedSnapshotId) -> report -> deploy(using publishedSnapshotId, gated by report)` 这条发布后链路
## 5. 核心原则

### 5.1 规则周期是一等语义

规则自己的 `timeframe` 属于执行语义，不得由全局 `market.timeframe` 隐式替代。

### 5.2 market 周期降级为默认周期

`market.timeframe` 不再被视为“所有规则共用的唯一周期”，而应重命名或重解释为：

- `defaultTimeframe`
- `primaryDisplayTimeframe`

它只负责：

- 当某条规则未显式声明周期时提供默认值
- 为 UI / 摘要提供一个可展示的主周期

它不负责覆盖已经明确写在规则里的 timeframe。

### 5.3 真相源只允许一个方向流动

周期语义必须沿着：

`clarified checklist -> canonical spec -> semantic graph / IR -> summary / backtest / deploy`

单向投影。

后续任何层都不得再回头从原始 message 文本重新猜测周期。

### 5.4 单周期兼容必须是自然降级

如果用户只表达了一个周期，则该周期可作为默认周期自动继承到未显式声明的规则。

## 6. 设计方案

### 6.1 Checklist 升级为规则级结构

当前 checklist 中：

- `entryRules?: string[]`
- `exitRules?: string[]`
- `timeframes?: string[]`

无法表达“规则 A 是 3m、规则 B 是 15m”的稳定结构。

升级后，checklist 应至少支持：

```ts
interface ChecklistRuleDraft {
  id: string
  text: string
  phase: 'entry' | 'exit' | 'risk'
  timeframe?: string | null
  basis?: string | null
  metadata?: Record<string, unknown>
}

interface ChecklistPayloadVNext {
  symbols?: string[]
  market?: {
    exchange?: string
    marketType?: 'spot' | 'perp'
    defaultTimeframe?: string | null
  }
  entryRules?: ChecklistRuleDraft[]
  exitRules?: ChecklistRuleDraft[]
  riskRules?: ChecklistRuleDraft[]
  sizing?: {
    positionPct?: number
  }
}
```

兼容策略：

- 保留旧字段读取能力
- 一旦进入内部计算，统一归一化为规则级草案结构

### 6.2 Clarification 以规则级周期展示

clarification 不再只展示：

`OKX BTCUSDT 3m；入场……；出场……`

而应按规则展示：

- `入场（3m）：下跌 1% 买入`
- `出场（15m）：上涨 2% 卖出`

当仍缺失 basis / side / risk 语义时，追问必须保留各自规则周期，避免误把 exit 的追问绑定到 entry 的 timeframe 上。

### 6.3 Canonical Spec 升级

当前 canonical spec 中：

- `market.timeframe: string | null`

不足以表达规则级多周期。

建议升级为：

```ts
market: {
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string | null
  marketType: 'spot' | 'perp'
  defaultTimeframe: string | null
}
```

并要求每条 rule 的 condition params 在需要时显式带 `timeframe`：

```ts
{
  id: 'entry-price-change-1',
  phase: 'entry',
  condition: {
    kind: 'atom',
    key: 'price.change_pct',
    semanticScope: 'market',
    op: 'LTE',
    value: -0.01,
    params: {
      timeframe: '3m',
      lookbackBars: 1,
      basis: 'prev_close',
    },
  },
  actions: [{ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } }],
}
```

```ts
{
  id: 'exit-position-gain-1',
  phase: 'exit',
  condition: {
    kind: 'atom',
    key: 'position_gain_pct',
    semanticScope: 'position',
    op: 'GTE',
    value: 0.02,
    params: {
      timeframe: '15m',
      basis: 'entry_avg_price',
    },
  },
  actions: [{ type: 'CLOSE_LONG' }],
}
```

### 6.4 Required Timeframes 从 rules 汇总

`requiredTimeframes` 不再来自：

- checklist 的第一项 timeframe
- 或 market.defaultTimeframe

而必须从所有 rule condition 中的显式 timeframe 汇总得到。

规则：

- 有显式 timeframe 的 rule 使用自身 timeframe
- 无显式 timeframe 的 rule 继承 `market.defaultTimeframe`
- 汇总结果去重并保序

### 6.5 Summary / Backtest / Deploy 只投影 canonical

用户可见摘要、回测请求、部署配置都必须从 canonical spec 派生，不再从原始 entryRules / exitRules 文本拼接。

这样可保证：

- summary 显示 `entry=3m, exit=15m`
- backtest 知道自己需要 `3m` 与 `15m` 数据
- deploy 使用与 backtest 同一份 `requiredTimeframes`

## 7. 行为定义

### 6.1 单周期策略

示例：

`15m 金叉买入，死叉卖出，10% 仓位`

行为：

- `market.defaultTimeframe = 15m`
- 未显式声明 timeframe 的 entry / exit rule 继承 `15m`
- 用户无需补填额外字段

### 6.2 双周期策略

示例：

`3 分钟内下跌 1% 买入；15 分钟内上涨 2% 卖出；10% 仓位`

行为：

- entry rule 显式 `timeframe = 3m`
- exit rule 显式 `timeframe = 15m`
- `requiredTimeframes = ['3m', '15m']`
- 若 basis 缺失，只追问 basis，不得丢失各自 timeframe

### 6.3 风险规则

风险规则默认不强制要求 timeframe。

例如：

- `止损 5%`
- `止盈 10%`

属于 position / risk 维度规则，应主要依赖 basis，而不是误继承 entry 的 timeframe。

只有当用户明确表达时间窗风险条件时，风险规则才带显式 timeframe，例如：

- `15 分钟内回撤 3% 强制平仓`

## 8. 兼容与迁移

### 7.1 输入兼容

旧输入结构继续接受：

- `timeframes?: string[]`
- `entryRules?: string[]`
- `exitRules?: string[]`

但在进入 clarification / canonical 之前，必须统一归一化为规则级结构。

### 7.2 输出兼容

旧单周期策略产物保持行为不变。

新多周期策略新增的主要变化是：

- summary 更精确
- `requiredTimeframes` 可能包含多个值
- backtest / deploy 将显式声明多周期数据依赖

### 7.3 渐进替换

建议按以下顺序替换：

1. 抽取层先生成规则级 timeframe
2. clarification summary 改读规则级结构
3. canonical spec 改为 `defaultTimeframe + rule timeframe`
4. downstream projection 全部改读 canonical

## 9. 验收标准

以下场景必须通过：

1. `3 分钟内下跌 1% 买入；15 分钟内上涨 2% 卖出；10% 仓位`
   结果必须稳定保留 `entry=3m`、`exit=15m`
2. `5m 入场 + 1h 出场`
   必须生成 `requiredTimeframes = ['5m', '1h']`
3. `15m 入场 + 4h 风控`
   风控规则必须保留自己的 timeframe
4. 单周期策略
   不得因为新结构而增加额外澄清成本
5. clarification、summary、canonical、semantic graph、IR、backtest、deploy
   看到的 timeframe 必须一致

## 10. 风险与约束

### 9.1 风险：局部链路先升级，整体仍漂移

如果只修抽取层或只修 summary，问题会在 canonical 或 backtest 投影处再次出现。

缓解：

- 把 canonical spec 明确设为唯一真相源
- downstream 一律只读 canonical

### 9.2 风险：旧单周期假设散落在多个模块

当前已有多处代码直接读取 `timeframes[0]` 或 `market.timeframe`。

缓解：

- 逐层替换为 `defaultTimeframe` 或 rule-level timeframe
- 为单周期策略保留默认继承逻辑

### 9.3 约束：首版不处理任意跨周期布尔组合

本次支持的是“规则级多周期”，不是“一个布尔表达式内部任意混合多个周期并自动对齐”。

## 11. 结论

本次应采用“规则级多周期是一等语义”的方案，而不是继续修补单个正则或沿用单周期 canonical 模型。

这既能修复当前 `3m entry + 15m exit` 被错误压平的问题，也能为未来更多多周期策略提供稳定、一致、可验证的语义基础。
