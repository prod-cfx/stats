# AI Quant Open Semantic Slots Clarification Design

日期：2026-04-15

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 的 clarification 体验仍以固定 blocker / gate 为主，导致：

- 用户已经表达了某个策略语义，但因为该语义尚未完整闭合，系统没有继续围绕它追问
- 核心信号仍未说清时，系统先去追问交易所、止盈止损、仓位等固定字段
- 新策略能力容易退化成“来一个策略补一个追问模板”

典型失败例子：

- `当价格突破一条长期均线时买入，跌破短期均线时卖出，过滤震荡行情`
- 系统未稳定追问：
  - 长期均线周期
  - 短期均线周期
  - 突破 / 跌破确认方式
  - 震荡行情定义

这说明问题不在于模型完全无法理解，而在于当前主链路没有把“已识别但未闭合的策略语义”保留下来并作为一等公民参与 clarification 决策。

## 2. 目标

本次设计要实现：

1. 用户给出模糊策略时，系统能继续追问，把策略补充到可稳定生成
2. 该能力适用于所有策略，不回退成按策略家族逐个补模板
3. 已识别但未闭合的语义在归一化阶段不会丢失
4. clarification 顺序优先围绕核心未闭合语义，而不是固定必答字段
5. 已联调通过的闭合策略不因本次改造被重新打回追问

## 3. 非目标

- 不推翻现有三层主结构：`normalized intent -> resolution -> atomic intent`
- 不把所有策略改造成显式表单产品
- 不让大模型自由决定最终 blocker 顺序
- 不因为追求通用性破坏当前已跑通的黄金样例

## 4. 总体方案

主链路调整为：

`自然语言 -> normalized intent(保留 open / closed 语义对象) -> intent resolution(contract 判定 + ambiguity 产出 + 问题排序) -> clarification -> atomic intent -> compile`

关键原则：

- `normalized intent` 既保留已闭合语义，也保留未闭合语义
- 是否闭合，不看模型“觉得差不多”，只看每个语义原子的 `minimum executable contract`
- `resolution` 是唯一的 clarification 决策源
- 旧的平行 blocker / gate 体系不再决定主追问顺序

## 5. 数据层设计

### 5.1 顶层结构保持不变

`strategy-normalized-intent.ts` 继续保留：

- `triggers`
- `actions`
- `risk`
- `position`
- `grid`
- `stateHints`

### 5.2 为每个语义对象增加闭合状态

新增通用结构：

```ts
type ClosureStatus = 'closed' | 'open'

interface UnresolvedSlot {
  slotKey: string
  fieldPath: string
  reason:
    | 'missing_required_param'
    | 'missing_definition'
    | 'missing_relation'
    | 'missing_scope'
  questionHint: string
  priority: 'core' | 'behavior' | 'risk' | 'context'
  affectsExecution: boolean
  evidenceText?: string
}

interface RecognizedSemantic<TParams> {
  key: string
  params: TParams
  closureStatus: ClosureStatus
  unresolvedSlots: UnresolvedSlot[]
  evidenceText?: string
  confidence?: number
}
```

约束：

- `triggers / actions / risk / position / grid / stateHints` 中每个已识别语义对象都允许带 `closureStatus` 与 `unresolvedSlots`
- “长期均线”“明显波动”“关键位置”“震荡行情”这类概念，只要识别到了，就必须保留下来，即便尚未完整闭合
- `confidence` 仅用于抽取诊断，不参与 blocking 判定

### 5.3 示例

对于：

`当价格突破一条长期均线时买入，跌破短期均线时卖出，过滤震荡行情`

归一化后应允许得到近似结构：

```ts
triggers: [
  {
    key: 'indicator.above',
    phase: 'entry',
    params: {
      referenceKind: 'ma',
      referenceRole: 'long_term',
    },
    closureStatus: 'open',
    unresolvedSlots: [
      {
        slotKey: 'reference.period',
        fieldPath: 'triggers[0].params.reference.period',
        reason: 'missing_required_param',
        questionHint: '长期均线是多少？',
        priority: 'core',
        affectsExecution: true,
      },
      {
        slotKey: 'confirmationMode',
        fieldPath: 'triggers[0].params.confirmationMode',
        reason: 'missing_definition',
        questionHint: '突破按收盘确认还是盘中触发？',
        priority: 'core',
        affectsExecution: true,
      },
    ],
    evidenceText: '价格突破一条长期均线时买入',
  },
  {
    key: 'indicator.below',
    phase: 'exit',
    params: {
      referenceKind: 'ma',
      referenceRole: 'short_term',
    },
    closureStatus: 'open',
    unresolvedSlots: [
      {
        slotKey: 'reference.period',
        fieldPath: 'triggers[1].params.reference.period',
        reason: 'missing_required_param',
        questionHint: '短期均线是多少？',
        priority: 'core',
        affectsExecution: true,
      },
      {
        slotKey: 'confirmationMode',
        fieldPath: 'triggers[1].params.confirmationMode',
        reason: 'missing_definition',
        questionHint: '跌破按收盘确认还是盘中触发？',
        priority: 'core',
        affectsExecution: true,
      },
    ],
    evidenceText: '跌破短期均线时卖出',
  },
]

stateHints: [
  {
    type: 'regime',
    value: '震荡行情',
    mode: 'observation_only',
    closureStatus: 'open',
    unresolvedSlots: [
      {
        slotKey: 'regimeDefinition',
        fieldPath: 'stateHints[0].definition',
        reason: 'missing_definition',
        questionHint: '震荡行情怎么判断？',
        priority: 'behavior',
        affectsExecution: true,
      },
    ],
  },
]
```

## 6. Minimum Executable Contract

### 6.1 判定原则

是否闭合，不按“看起来像说清了”，而按该语义原子的最小可执行契约判定。

定义：

- `closed`：已满足该原子的最小可执行 contract，可稳定进入后续生成
- `open`：已识别到该原子，但仍缺会改变执行语义的核心字段

### 6.2 Contract 结构

推荐做成声明式表：

```ts
interface SemanticContract {
  semanticKey: string
  family: 'trigger' | 'action' | 'risk' | 'position' | 'grid' | 'relation' | 'state_hint'
  requiredParams: string[]
  optionalParams?: string[]
  defaultableParams?: string[]
  ambiguityRules?: Array<{
    whenMissing?: string[]
    whenConflicting?: string[]
    produceSlots: string[]
  }>
}
```

判定规则：

- 缺 `requiredParams`：`open`
- 命中 `ambiguityRules`：`open`
- 仅缺 `defaultableParams` 且默认安全：仍可 `closed`
- 全部满足：`closed`

### 6.3 网格与均线示例

`grid_touch` 的 contract 若要求：

- `range.lower`
- `range.upper`
- `stepPct`
- `sideMode`

则：

`在ok交易所 我想弄个网格策略 btc永续合约 在60000-80000的区间 每一格千分之5 不断低买高卖 单笔百分10资金`

在识别到：

- `exchange`
- `symbol`
- `marketType`
- `range`
- `stepPct`
- `sideMode`
- `position`

后可直接闭合。

而均线突破类 contract 若要求：

- `reference.kind`
- `reference.period`
- `confirmationMode`

则：

`当价格突破一条长期均线时买入，跌破短期均线时卖出，过滤震荡行情`

由于缺少：

- 长期均线周期
- 短期均线周期
- 突破 / 跌破确认方式
- 震荡定义

必须保持 `open` 并进入 clarification。

## 7. Resolution 设计

`strategy-intent-resolution.service.ts` 的职责收敛为：

1. 收集全部 `open` 语义对象
2. 按 contract 将 `unresolvedSlots` 升级为正式 ambiguity
3. 只选出当前唯一最高优先级问题

### 7.1 Ambiguity 结构

```ts
interface StrategyAmbiguity {
  kind:
    | 'missing_required_param'
    | 'missing_definition'
    | 'missing_relation'
    | 'missing_scope'
    | 'semantic_conflict'
  lane: 'signal' | 'action' | 'filter' | 'risk' | 'context'
  sourceKind: 'trigger' | 'action' | 'risk' | 'position' | 'grid' | 'state_hint'
  sourceKey: string
  slotKey: string
  message: string
  question: string
  choices?: string[]
  blocking: boolean
  priorityScore: number
  evidenceText?: string
}
```

### 7.2 追问优先级

固定优先级：

1. 核心信号未闭合
2. 动作 / 方向未闭合
3. 过滤器 / 市场状态未闭合
4. 出场与风险未闭合
5. 交易所 / 市场 / 仓位等执行上下文

约束：

- 只要更高层级仍有 `blocking ambiguity`，不得下沉追问低层级字段
- 每轮只问 1 个问题
- clarification 的问题顺序只能来自 `resolution`

这保证：

- 长短均线、突破定义、震荡定义未问清时，不会先问止盈止损或交易所
- 核心未闭合语义天然优先于固定字段

## 8. Clarification 设计

clarification 层不再维护平行 blocker 体系，只消费 `resolution` 产物。

允许的职责：

- 展示当前最高优先级问题
- 接收用户答案
- 回写对应语义对象参数
- 重新触发 `normalized intent -> resolution`

禁止的职责：

- 自己新增新的主 blocker
- 绕过 `resolution` 改变主追问顺序
- 在核心语义未闭合时先去追问固定上下文字段

## 9. 边界规则与兜底

### 9.1 黄金样例保护

以下已联调策略必须继续直接闭合，不得新增追问：

1. `在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金`
2. `在ok交易所 我想在btc-usdt-swap 15分钟布林带 上轨做空 下轨做多 单笔百分10资金`

约束：

- 新机制不能扩大追问面
- 不允许把现有安全默认重新升级为 blocker
- 这两条必须写成黄金回归用例

### 9.2 冲突表达

用户前后表达冲突时，不直接覆盖旧值，而产出 `semantic_conflict` ambiguity，由用户确认最终值。

### 9.3 默认值边界

仅允许保留不会改变策略本意、且现网已稳定使用的默认值。

允许继续默认的例子：

- 布林带参数 `20/2`（前提是现网已有稳定默认）

不允许默认的例子：

- 长 / 短均线周期
- 突破确认模式
- 震荡定义
- 关键位置定义

### 9.4 避免重复追问

同一 `slotKey` 一旦获得有效答案并回写成功，后续不得重复追问，除非用户显式修改。

### 9.5 识别失败兜底

如果模型没法将语义稳定映射到已知原子，但识别到了概念性证据，不允许直接丢弃，应降级为通用 open slot，例如：

- `unknown_trigger_definition`
- `unknown_filter_definition`

从而仍可继续追问。

## 10. 兼容性要求

本次改造必须满足：

1. 已联调通过的闭合策略不回退
2. 新设计不会把“已闭合”误判为“未闭合”
3. 模糊策略中的核心语义缺口会优先被追问
4. 旧的平行 clarification blocker 不再决定主追问顺序

## 11. 测试要求

至少覆盖：

### 11.1 黄金样例

- 涨跌幅买卖策略保持直接闭合
- 布林带双向策略保持直接闭合

### 11.2 新增模糊策略追问

- 模糊均线突破：必须追问长短均线周期、确认方式、震荡定义
- 成交量异动：必须追问放大倍数、对比窗口、波动定义、方向范围
- 均值回归：必须追问均值类型、偏离定义、止损、趋势适用性
- 突破回踩确认：必须追问关键位置、回踩有效区间、确认信号

### 11.3 边界行为

- 冲突表达时产出 `semantic_conflict`
- 已回答 slot 不重复追问
- 默认参数不被错误升级为 blocker
- 识别失败时降级为通用 open slot 而不是丢失

## 12. 推荐实施顺序

1. 为 `normalized intent` 增加 `closureStatus / unresolvedSlots / evidenceText`
2. 建立首批 contract 声明表
3. 重写 `resolution`，让其基于 contract 产出 ambiguity
4. 让 clarification 只消费 `resolution`
5. 用黄金样例 + 模糊样例建立回归测试

## 13. 结论

本设计不推翻现有三层架构，而是在现有结构上引入“已闭合 / 未闭合语义对象”的能力，使系统能够：

- 保留用户已经表达但尚未补全的策略语义
- 用声明式 contract 判断哪些语义已经足够生成
- 用统一的 resolution 决策主导 clarification
- 让核心未闭合语义优先于固定字段被追问
- 同时保护已联调通过的黄金样例不回退
