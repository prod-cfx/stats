# AI Quant 风险规则默认语义与澄清降噪设计

日期：2026-04-13

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 的澄清 gate 把大量带百分比的规则统一视为“可能缺少 basis”的候选，因此：

- `止损 5%`
- `止盈 10%`
- `买入价格亏 5% 止损`

这类对人类已经足够自然的风险规则，仍会被继续追问 `basis`，导致：

- 用户感知为重复确认同一件事
- summary 退化成“满足入场条件后开仓 / 满足出场条件后平仓”这类空话
- 规则扩展路径退化为“继续加 basis 特判”而不是稳定语义

当前实现的更深层问题不是某一条追问文案，而是：

- `basis` 被当成统一必答字段，而不是按规则家族定义的默认语义
- `%` 规则没有先做规则家族分类，就直接进入 `ambiguous_condition_basis`
- 风险规则和触发规则被混在同一套 basis gate 里处理

## 2. 目标

本次设计要解决的是“风险规则 basis 过度显式化”的系统问题，而不是只修一个止损追问 bug。

目标：

1. 让 `止损 x% / 止盈 y%` 不再要求用户显式回答 basis
2. 把 `basis` 从“统一必答项”降级为“系统默认语义的一部分”
3. 保留真正影响触发逻辑的 basis 澄清能力，例如 `15 分钟上涨 1% 买入`
4. 让新策略类型沿着“规则家族 -> 默认语义 -> 异常升级”统一扩展，而不是继续堆 `%` 特判
5. 让 summary / canonical / compiler 消费的是稳定语义，而不是自由文本二次猜测

## 3. 非目标

本次不做：

- 全面重写整个 clarification pipeline
- 所有量化规则的统一语义编译器重构
- 取消所有 basis 相关澄清
- 对所有风险规则一刀切套用相同默认 basis

## 4. 核心设计原则

### 4.1 basis 不是统一必答项

`basis` 不应再被视为所有百分比规则都必须由用户显式回答的字段。

新的原则是：

- basis 是系统默认语义的一部分
- 是否需要把 basis 显式化，取决于规则所属家族
- 只有默认语义不安全、或用户明确表达与默认语义冲突时，basis 才升级成澄清问题

### 4.2 先分规则家族，再决定是否澄清

系统不再从“这条规则里有没有 `%`”出发，而是先判断：

- 这是什么规则家族
- 这个家族是否有安全默认语义
- 当前表达是否覆盖默认或与默认冲突

### 4.3 风险规则与触发规则分开处理

以下两类规则必须拆开：

- 风险规则：止损、止盈、移动止盈、回撤止损等
- 触发规则：上涨 x% 买入、下跌 y% 卖出、N 分钟内涨跌等

前者更适合“默认语义 + 异常升级”，后者仍然经常需要 basis 澄清。

## 5. 规则家族设计

### 5.1 风险规则家族：`risk.stop_loss_pct`

样例：

- `止损 5%`
- `亏损 5% 止损`
- `价格比买入价下跌 5% 止损`

默认语义：

- 默认按价格相对入场价计算
- 默认 basis 为 `entry_avg_price`

交互策略：

- 用户未显式指定 basis 时，不追问
- 用户显式说“按持仓亏损”“按持仓收益率”“按浮盈回撤”等非默认基准时，覆盖默认
- 只有当同一字段出现冲突表达时，才升级成澄清问题

### 5.2 风险规则家族：`risk.take_profit_pct`

样例：

- `止盈 10%`
- `盈利 10% 止盈`
- `价格比买入价上涨 10% 止盈`

默认语义：

- 默认按价格相对入场价计算
- 默认 basis 为 `entry_avg_price`

交互策略与 `risk.stop_loss_pct` 相同。

### 5.3 触发规则家族：`trigger.percent_change`

样例：

- `15 分钟上涨 1% 买入`
- `3 分钟下跌 5% 卖出`

默认语义：

- 无安全默认 basis

交互策略：

- 如果用户已明确写出基准，直接采纳
- 如果未写清，继续走澄清 gate
- basis 仍属于关键执行语义，不允许偷偷臆造

### 5.4 扩展风险规则家族

样例：

- `移动止盈 3%`
- `浮盈回撤 2% 止损`
- `净值回撤 5% 停止策略`

设计原则：

- 不直接继承 `entry_avg_price` 默认 basis
- 各家族单独定义默认语义和异常升级条件
- 本次只把“纯百分比止损 / 止盈”从 basis 必答项里降级

## 6. 默认语义注册表

新增一层统一策略表，为每个规则家族声明：

- `family`
- `defaultBasis`
- `requiresUserBasis`
- `overridePolicy`
- `conflictEscalationPolicy`

示意：

```ts
[
  {
    family: 'risk.stop_loss_pct',
    defaultBasis: 'entry_avg_price',
    requiresUserBasis: false,
    overridePolicy: 'allow_explicit_override',
    conflictEscalationPolicy: 'ask_on_conflict',
  },
  {
    family: 'risk.take_profit_pct',
    defaultBasis: 'entry_avg_price',
    requiresUserBasis: false,
    overridePolicy: 'allow_explicit_override',
    conflictEscalationPolicy: 'ask_on_conflict',
  },
  {
    family: 'trigger.percent_change',
    defaultBasis: null,
    requiresUserBasis: true,
    overridePolicy: 'must_be_explicit',
    conflictEscalationPolicy: 'ask_when_missing',
  },
]
```

这层是本次设计的核心真相源。

## 7. 澄清决策层

澄清决策不再等价于“规则里有 `%` 就问 basis”，而改为：

1. 识别规则家族
2. 查该家族是否有安全默认语义
3. 提取用户显式声明的非默认基准
4. 判断是否存在冲突或默认不安全
5. 仅在需要时发出 basis 澄清

新的 `ambiguous_condition_basis` 触发条件应收缩为：

- 家族没有安全默认 basis
- 当前文本不足以决定 basis
- 或用户表达与默认语义发生冲突

不再用于：

- 单纯的 `止损 5%`
- 单纯的 `止盈 10%`

## 8. Summary 与 Canonical 投影

### 8.1 Summary

summary 不应再退化成：

- `满足入场条件后开仓`
- `满足出场条件后平仓`

而应展示系统当前采用的运行语义：

- `止损：价格相对入场价下跌 5% 强制平仓`
- `止盈：价格相对入场价上涨 10% 平仓`

这里允许使用系统默认语义，不要求用户显式说出 basis。

### 8.2 Canonical

canonical/checklist 仍应显式落地 basis，只是来源从“用户必答”改成：

- 用户明确回答
- 或规则家族默认语义自动补齐

这意味着：

- `riskRules.stopLossBasis`
- `riskRules.takeProfitBasis`

在未被用户覆盖时，可由系统自动填入 `entry_avg_price`。

### 8.3 Compiler / Consistency

后续 compiler / consistency 不需要感知“这个 basis 是用户回答的还是系统默认的”，只消费最终语义快照。

必要时可在 metadata 中保留来源，例如：

- `source: explicit`
- `source: default`

但这不是本次 gate 正确性的前提。

## 9. 异常升级条件

以下情况才把 basis 显式化为用户问题：

1. 用户明确说了非默认 basis
2. 同一字段出现互相冲突的 basis 表达
3. 规则家族本身没有安全默认值
4. 默认语义会导致明显误编译风险

典型应追问的例子：

- `15 分钟上涨 1% 买入`
- `3 分钟内下跌 5% 卖出`
- `浮盈回撤 2% 止损`
- `止损 5%，按入场价；后面又说按持仓亏损`

典型不应追问的例子：

- `止损 5%`
- `止盈 10%`
- `亏损 5% 止损`
- `盈利 10% 止盈`

## 10. 实现边界

建议拆成 4 个清晰单元：

### 10.1 Rule Family Classifier

职责：

- 识别规则属于哪个语义家族

### 10.2 Default Semantics Registry

职责：

- 为规则家族声明默认 basis 和澄清策略

### 10.3 Clarification Decision Layer

职责：

- 基于家族与默认语义决定是否发问

### 10.4 Summary / Canonical Projection

职责：

- 把最终采用的默认/显式语义稳定投影到 summary 与 canonical

## 11. 回归测试

最少需要覆盖以下场景：

1. `止损 5%` 不再触发 basis 追问
2. `止盈 10%` 不再触发 basis 追问
3. `止损 5%` canonical 自动补 `entry_avg_price`
4. `止盈 10%` summary 展示为“价格相对入场价上涨 10% 止盈”
5. `15 分钟上涨 1% 买入` 仍然触发 basis 澄清
6. `15 分钟下跌 5% 卖出` 仍然触发 basis 澄清
7. `止损按持仓亏损 5%` 能覆盖默认语义
8. `止盈按持仓收益率 10%` 能覆盖默认语义
9. 同一字段前后出现冲突基准时，会升级成 basis 澄清
10. `浮盈回撤 2% 止损` 不会错误继承 `entry_avg_price`

## 12. 验收标准

本次改造完成后，应满足：

1. 用户输入纯 `止损 x% / 止盈 y%` 时，交互不再继续追问 basis
2. 触发型百分比规则仍保持 basis 追问能力
3. summary 中能稳定体现默认风险语义，不再退化成空泛开平仓描述
4. canonical / compiler / consistency 使用的是同一套最终 basis 语义
5. 新增风险规则家族时，只需要在“规则家族 + 默认语义注册表”中扩展，而不是继续堆 scattered 特判

## 13. 推荐方案

推荐采用：

- 规则家族分类
- 默认语义注册表
- basis 异常升级机制

不推荐继续沿用“所有 `%` 都先问 basis，再靠白名单排除”的路线，因为它会持续放大规则碎片化问题。
