# AI Quant Semantic State Session Source Design

日期：2026-04-15

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 会话主链路仍以 `checklist` 为真相源：

- 用户消息先归并到 `ChecklistPayload`
- clarification answer 先回写到 `checklist`
- `normalizedIntent / atomicIntent / executionContext / clarificationState` 都是从最新 `checklist` 临时重算
- 对话期 summary / blocker / 下一问仍主要由 `checklist` 派生

这条链路的直接后果是：

- 已经确认过的策略语义会在后续轮次被摘要层或旧文本层回退
- 系统会把已经闭合的规则泛化成 `满足入场条件后开仓 / 满足出场条件后平仓`
- clarification 顺序仍容易被旧 `entryRules / exitRules / riskRules` 文本分类牵着走
- 细粒度 slot 能力虽然存在，但仍是运行时临时能力，不是主状态

已出现的失败模式包括：

- 已确认的 MA 周期、确认方式在后续补 exchange / marketType / timeframe / risk / position 时被冲掉
- summary 往更模糊、更模板化的描述回退
- normalization 再次把模糊文本判定为 unresolved，从而重复追问“请继续明确策略语义”

产品目标不是“少问问题”，而是：

- 继续保留细粒度 slot 拆解能力
- 只问真正还未闭合的语义
- 问过并锁定后不再回退
- 不破坏策略 -> 脚本 -> 回测 -> 部署的一致性

## 2. 目标

本次设计目标：

1. 把“会话期真相源”从 `checklist` 迁移到 `semanticState`
2. 保留并强化当前已有的细粒度语义拆槽能力
3. 适配所有量化策略，不仅限于 MA / Bollinger 示例
4. 让已锁定原子语义在后续轮次默认保持稳定，不被摘要、补槽、旧文本层重开
5. 让旧 `entryRules / exitRules / riskRules` 退出主数据流链路
6. 不改变已调通策略的最终语义产物与发布稳定性

## 3. 非目标

- 第一阶段不重写整个发布编译链
- 第一阶段不要求兼容历史 codegen session 的旧行为
- 第一阶段不保留 checklist-centric 测试基建
- 不用 prompt patch 代替状态源迁移
- 不减少必要的细粒度澄清问题

## 4. 现状主数据流

### 4.1 会话期

当前真实主链：

`用户消息 -> checklist patch -> merge checklist -> normalizedIntent / atomicIntent / executionContext 临时计算 -> clarification / summary / compileability -> CHECKLIST_GATE`

关键事实：

- `CodegenConversationService` 是会话主编排器
- `CodegenConversationStateMachine` 会话更新时落库的主体仍是 `checklist`
- `applyClarificationAnswers()` 直接修改 `checklist`
- `buildClarificationSummary(checklist)` 主导用户可见 summary
- `resolveClarificationArtifacts(checklist)` 决定 blocker、prompt、normalization blocked 与否

### 4.2 发布期

当前发布链更偏语义产物驱动：

`checklist -> canonicalSpec -> semanticView / semanticGraph / compiledIr / compiledScript -> consistency gate -> publication gate`

已存在的稳定性护栏包括：

- `canonicalDigest`
- `semanticGraph <-> IR` 一致性
- compiled publish consistency
- publication gate

问题不在于发布链缺少护栏，而在于会话链与发布链的真相源不一致：

- 会话期真相源：`checklist`
- 发布期关键产物：`semanticGraph / compiledIr / canonicalDigest`

## 5. 设计原则

### 5.1 会话期唯一真相源是 `semanticState`

所有对话期判断都应基于 `semanticState`，而不是旧文本 checklist。

包括：

- 当前理解 summary
- clarification blocker
- 下一问排序
- 已锁定 / 未锁定判断
- 用户修改后的状态演进
- compileability 前置判断

### 5.2 保留细粒度 slot 能力，并升级为主链能力

例如：

- MA trigger 的 `reference.period`、`confirmationMode`
- grid 的 `range.lower`、`range.upper`、`stepPct`、`sideMode`
- risk 的 `stopLossBasis`、`takeProfitBasis`、`earlyStop.action`
- state gate 的 `regimeDefinition`

这些 slot 不再只是临时推导结果，而是 `semanticState` 的一等公民。

### 5.3 默认精准覆盖

用户后续明确修改已锁定语义时：

- 默认只替换被修改的原子节点或 slot
- 无关已锁定语义保持不动
- 仅在存在明确依赖关系时，才触发连带失效

### 5.4 旧 checklist 退位为兼容投影层

`entryRules / exitRules / riskRules` 第一阶段不直接删除，但退出主链：

- 不再参与真相判定
- 不再参与 summary / clarification / compileability / blocker
- 仅作为历史兼容输入和少量投影输出

### 5.5 Prompt 是解释器，不是真相源

Prompt 负责帮助抽取、绑定、表达，不负责定义真实策略状态。

## 6. 核心对象

### 6.1 `semanticState`

`semanticState` 是新的会话期真相源。

推荐结构：

```ts
type SemanticNodeStatus = 'open' | 'locked' | 'superseded'
type SemanticSource = 'user_explicit' | 'inferred' | 'derived'

interface SemanticEvidence {
  text: string
  messageIndex?: number
  source: SemanticSource
}

interface SemanticSlotState {
  slotKey: string
  fieldPath: string
  value?: string | number | boolean | null
  status: SemanticNodeStatus
  priority: 'core' | 'behavior' | 'risk' | 'context'
  questionHint: string
  affectsExecution: boolean
  evidence?: SemanticEvidence
  supersedes?: string[]
}

interface SemanticContextSlotState {
  exchange: SemanticSlotState | null
  symbol: SemanticSlotState | null
  marketType: SemanticSlotState | null
  timeframe: SemanticSlotState | null
}

interface SemanticTriggerState {
  id: string
  key: string
  phase: 'entry' | 'exit' | 'risk' | 'gate'
  params: Record<string, unknown>
  sideScope?: 'long' | 'short' | 'both'
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
}

interface SemanticActionState {
  id: string
  key: string
  params?: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  supersedes?: string[]
}

interface SemanticRiskState {
  id: string
  key: string
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
}

interface SemanticPositionState {
  mode: string
  value: number
  positionMode: string
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
}

interface SemanticState {
  version: 1
  families: string[]
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  contextSlots: SemanticContextSlotState
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
}
```

### 6.2 `clarificationState`

`clarificationState` 降级为 interaction view。

它只承载：

- 当前 pending 问题列表
- 当前唯一 blocker
- 当前问题顺序与展示信息

它不再拥有语义真相。

### 6.3 `semanticGraph`

`semanticGraph` 继续作为编译与一致性视图存在，但不再承担会话期真相源角色。

第一阶段里：

- `semanticState` 是真相源
- `semanticGraph` 是从 `semanticState` 派生的编译视图

### 6.4 legacy checklist

`checklist` 继续存在于过渡期 session 结构中，但角色改为：

- 历史兼容导入
- 调试排查
- 少量 legacy 投影输出

## 7. 服务职责重划分

### 7.1 新增：`SemanticStateReducerService`

职责：

- 接收用户消息与结构化 clarification answers
- 维护 `semanticState`
- 绑定当前消息到原子节点和 slot
- 维护 `open / locked / superseded`
- 执行默认精准覆盖
- 在需要时执行依赖失效传播

它是唯一有权修改会话期语义状态的服务。

### 7.2 新增：`SemanticStateProjectionService`

职责：

- 从 `semanticState` 生成 clarification summary
- 从 `semanticState` 生成 clarification queue
- 从 `semanticState` 生成 compileability input
- 从 `semanticState` 生成 canonical build input
- 从 `semanticState` 生成 legacy checklist projection

### 7.3 保留但降级：`StrategyClarificationQuestionService`

改成纯展示服务：

- 只负责把 pending slot 和当前锁定语义投影成自然语言
- 不再自行推断“真实策略是什么”

### 7.4 保留但改输入：派生与编译服务

保留现有核心编译链，但改输入源：

- `StrategyIntentNormalizerService`
- `StrategyIntentResolutionService`
- `StrategyExecutionContextService`
- `CanonicalSpecBuilderService`
- `SpecDescBuilderService`
- `SemanticGraphBuilderService`
- publication pipeline

第一阶段不强行重写这些服务的内部核心逻辑，但它们不再直接吃会话期 checklist 主状态。

### 7.5 退位为 adapter 的旧逻辑

以下职责必须从主链中退位：

- `applyClarificationAnswers()` 作为主更新入口
- `applySemanticSlotClarification()` 直接改 rule 文本
- `mergeChecklistSnapshots()` 作为语义真相合并器
- `buildClarificationSummary(checklist)`
- `resolveClarificationArtifacts(checklist)` 中所有 checklist-first 的主判断

### 7.6 `CodegenConversationService` 的新定位

`CodegenConversationService` 改为 orchestration 层：

- 串联 reducer、projection、state machine、publication pipeline
- 不再直接拥有语义真相

## 8. 第一阶段迁移顺序

### 8.1 步骤一：引入 `semanticState` 持久化

在 session 模型中新增 `semanticState` 字段，并同步 repository 读写支持。

第一阶段 session 主字段变为：

- `semanticState`
- `clarificationState`
- `constraintPack`
- `latestSpecDesc`
- `semanticGraph`

`checklist` 保留，但不再是主链真相源。

### 8.2 步骤二：重写会话更新前半段

把 `continueSession` 的前半段从：

`answers -> checklist -> merge checklist -> derive semantics`

改成：

`message / answers -> semanticState reducer -> projection -> clarification / summary / compileability`

### 8.3 步骤三：把 clarification 与 summary 切到 `semanticState`

完成后：

- `buildClarificationSummary(checklist)` 退出主链
- summary 全部从 `semanticState` 投影
- clarification blocker 全部从 `semanticState` 中仍为 `open` 的 slot 生成

### 8.4 步骤四：增加 `semanticState -> compile bridge`

先不强行重写整个发布链，而是提供 bridge：

`semanticState -> canonical build input -> canonicalSpec -> semanticGraph -> IR`

保证发布稳定性。

### 8.5 步骤五：把 checklist 降级为兼容层

保留 legacy adapter：

- 旧 session -> semanticState migration
- semanticState -> legacy checklist projection

但主链不再读 checklist 做判断。

## 9. Prompt 同步迁移

### 9.1 Conversation planner prompt

必须从“输出 checklist patch”迁移为“输出 semantic update candidates / slot bindings”。

新的 prompt 约束：

- 不得重写整段策略摘要
- 不得泛化已锁定规则
- 不得覆盖当前消息未涉及的已锁定语义
- 只允许返回与当前消息相关的 slot 更新候选

### 9.2 Clarification 文案

文案由系统基于 `semanticState` 生成稳定 summary。

模型不再自由生成“当前理解的策略”全文，只做自然语言包装或解释增强。

### 9.3 Strategy codegen prompt

规则覆盖要求保留，但输入语义载体从 `entryRules / exitRules / riskRules` 切换到：

- canonical spec
- semanticState 派生产物
- semanticGraph / IR 相关约束

## 10. 细粒度语义拆槽必须保留

本次重构的硬约束之一：

- 不能丢掉现有“已识别但未闭合语义”继续追问的能力
- 不能把细粒度 slot 能力重新压扁回旧文本分类

例如：

`当价格突破一条长期均线时买入，跌破短期均线时卖出，过滤震荡行情`

重构后仍必须继续稳定追问：

- 长期均线是多少？
- 短期均线是多少？
- 突破 / 跌破按收盘还是盘中？
- 如何判断震荡行情？

并且要求：

- 问过并锁定后不重复
- 后续补 context / risk / position 时不重开已锁定 slot
- 用户精准修改一个 slot 时，只影响对应节点和明确依赖项

## 11. 稳定性与一致性约束

本次重构允许影响会话期行为：

- 澄清顺序
- summary 文案
- slot 锁定与修改传播

但不允许影响最终发布语义结果。

对已调通的 MA 与 Bollinger 黄金样例，必须保证最终产物等价：

- `canonicalDigest`
- `semanticGraph` 关键节点
- `compiledIr` 关键字段
- publication gate 结果

如果会话层重构导致最终编译结果非预期漂移，按回归处理。

## 12. 测试与回归策略

### 12.1 黄金样例

固化两条黄金样例：

- MA 策略
- Bollinger 策略

每条样例验证四层：

- 会话期：澄清顺序、已锁定语义不回退
- 语义层：`semanticState` 关键节点/slot 正确闭合
- 编译层：`canonicalDigest`、`semanticGraph`、`compiledIr` 等价
- 发布层：publication gate 不退化

### 12.2 细粒度 slot 回归

新增多轮 clarification 回归：

- 未闭合 trigger slot 继续追问
- state gate 定义继续追问
- 已锁定 slot 不回退
- 补 context/risk/position 不重开无关 slot
- 精准修改单 slot 时仅影响对应原子节点与明确依赖项

### 12.3 测试基建迁移

由于产品没有真实用户，本次不背历史兼容包袱：

- 旧 checklist-centric fixture 可以批量重写
- 会话期主测试基建切到 semanticState-centric
- checklist 仅保留 migration / adapter 相关测试

### 12.4 Prompt 回归

新增 prompt contract 测试，确保：

- planner prompt 不再要求输出 checklist patch 作为主结果
- planner prompt 禁止重写已锁定语义
- codegen prompt 不再以旧 `entryRules / exitRules / riskRules` 作为核心契约载体

## 13. 风险与缓解

### 风险 1：会话层切换影响已调通策略

缓解：

- 以 MA / Bollinger 黄金样例做全链路等价回归
- 以最终产物等价为验收标准，而不是只看对话文案

### 风险 2：旧 checklist 仍偷偷参与主判断

缓解：

- 明确禁止 checklist 驱动 summary / clarification / compileability
- 增加测试，验证主链在无 checklist 参与时仍可闭环

### 风险 3：prompt 改造滞后导致状态层与提示词约束不一致

缓解：

- 把 prompt 更新纳入第一阶段后半段交付范围
- 为 planner / codegen prompt 增加 contract 测试

### 风险 4：semanticState 与发布链派生产物漂移

缓解：

- 保留现有 `canonicalDigest`、`semanticGraph <-> IR`、publication gate 护栏
- 不在第一阶段直接大改发布编译链

## 14. 结论

本次设计的核心不是继续修补 clarification 文案，而是完成一次主数据流切换：

- 会话期真相源：从 `checklist` 迁到 `semanticState`
- 旧文本分类：降级为兼容投影层
- 细粒度 slot：升级为主链能力
- prompt：从真相定义者退回解释器与表达器
- 发布链：保持稳定，以现有一致性护栏承接会话层重构

第一阶段完成后，系统应具备以下关键性质：

- 已确认语义不再被后续轮次回退
- 细粒度未闭合语义会被继续稳定追问
- 所有策略族都通过统一原子语义主链处理
- 会话层与发布层第一次拥有一致的语义中心
