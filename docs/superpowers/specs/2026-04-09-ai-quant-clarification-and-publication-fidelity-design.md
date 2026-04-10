# AI Quant Clarification And Publication Fidelity Design

日期：2026-04-09

状态：设计已确认，待实现规划

## 1. 背景与目标

当前 AI Quant 主链路已经收敛为：

`natural language -> clarification gate -> canonical spec v2 -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish -> publishedSnapshotId -> backtest(using publishedSnapshotId) -> report -> deploy(using publishedSnapshotId, gated by report)`

这条链路的方向是对的，但当前实现仍存在几类会直接影响用户信任的问题：

- 对话阶段没有把关键歧义阻断在 `clarification gate`
- 用户确认后的语义，在 `IR -> AST -> compiled script` 过程中仍可能漂移
- 发布前一致性校验覆盖不完整，导致错误脚本有机会通过
- 运行时宣称 `bar_close`，但实时执行链路没有真正强约束 finalized bar

本设计的目标是，在**不改变主链路形状、不修改 staging CI** 的前提下，补齐两类能力：

- Phase 1：补齐 `clarification gate` 与 `publish gate`，让“该问的先问清楚、用户确认后不得漂移、错误产物不得发布”
- Phase 2：补齐运行时 `isFinal` 约束，让 `bar_close` 在实时执行中真正成立

## 2. 设计边界

### 2.1 保持不变

- 主链路顺序保持不变
- `canonical spec v2 -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish` 的形状不变
- `publishedSnapshotId` 仍然是 backtest 和 deploy 的唯一运行时真源
- `staging` CI 代码不修改

### 2.2 本次设计包含

- 后端 `clarification gate` 的阻断式澄清规则
- 前端澄清交互和发布错误展示
- `confirm canonical snapshot` 到发布阶段的逐项保真校验
- “连续 3 根 K 线在轨外时提前止损或减仓”这类规则的完整闭环
- `isFinal / bar_close` 的 Phase 2 方案与接口预留

### 2.3 非目标

- 不重构主数据流
- 不改 backtest / deploy 的核心数据源边界
- 不引入新的 DSL 编辑器
- 不在本次 Phase 1 内落地 `isFinal` 运行时修复

## 3. 当前问题定义

### 3.1 关键语义没有在对话阶段问清楚

以下信息属于会改变执行语义的关键字段，一旦缺失或冲突，不应继续下游流程：

- `exchange`
- `symbol`
- `timeframe`
- `marketType`
- `positionMode`
- 风险规则中的歧义动作，例如“连续 3 根轨外时提前止损或减仓”

示例：

- 用户表达了做空语义，但没有明确 `marketType`
- 用户写了 `OKX`，但没有说明是现货还是合约
- 用户写了“提前止损或减仓”，但没有说明是 `CLOSE_*` 还是 `REDUCE_*`

这类输入如果继续进入 `semantic view` 或 `confirm canonical snapshot`，后续就只能靠隐式推断，最终容易产生产物漂移。

### 3.2 确认态与产物态没有建立硬绑定

用户确认的是 `confirm canonical snapshot`，因此后续 `IR / AST / compiled script` 都只能是确认态的派生产物，不能再次推断或改写关键字段。

当前问题不是主链路顺序错了，而是“确认过的语义”没有被当成唯一真源严格保护。

### 3.3 发布前一致性校验覆盖不完整

当前发布校验更偏向“语义大致相符”，不足以拦住以下错误：

- 已确认 `OKX`，产物却变成 `binance`
- 已确认必须做空，但产物落成不合理的 `spot + long_short`
- 已确认存在“3 根轨外规则”，产物却缺失对应条件或动作

### 3.4 运行时 `bar_close` 与 finalized bar 不一致

运行时实时链路当前没有保证只对 finalized bar 触发策略，因此即便脚本声明 `signalEvaluation=bar_close`，执行时也可能提前看到未收盘 bar。

这会造成“确认语义正确、编译产物正确、实时行为仍偏离”的问题，因此需要作为独立 Phase 2 处理。

## 4. Phase 1：Clarification Gate 阻断式澄清

### 4.1 设计原则

- 不能静默推断的字段，必须在对话阶段问清楚
- 只要仍有 blocking clarifications，流程就停在 `clarification gate`
- 未清空 blocking clarifications 前，不生成 `semantic view`
- 未清空 blocking clarifications 前，不允许 `confirm canonical snapshot`

### 4.2 阻断字段

首批纳入 blocking clarification 的字段如下：

- `exchange`
- `symbol`
- `timeframe`
- `marketType`
- `positionMode`
- `riskRules.earlyStop.action`

同时纳入以下冲突检测：

- 存在做空语义，但 `marketType` 未明确
- `marketType=spot` 且策略包含做空动作
- `positionMode` 与动作方向不兼容
- 同一会话内前后两次表达的 `exchange / symbol / timeframe / marketType` 冲突
- 存在“提前止损或减仓”一类歧义动作，但未选定具体行为

### 4.3 后端契约

后端在会话响应中新增 `clarificationGate` 结构：

```ts
interface ClarificationGate {
  blocked: boolean
  items: Array<{
    field:
      | 'exchange'
      | 'symbol'
      | 'timeframe'
      | 'marketType'
      | 'positionMode'
      | 'riskRules.earlyStop.action'
    reason: string
    question: string
    allowedAnswers?: string[]
    blocking: true
  }>
}
```

要求：

- `blocked=true` 时，不返回可确认的 `semantic view`
- 提交澄清答案时使用结构化 payload，而不是要求前端重新拼接自然语言
- 澄清答案进入会话状态后，重新评估 `clarificationGate`

### 4.4 前端交互

前端新增“阻断式澄清卡片”：

- 逐题展示，不并发堆叠多个问题
- 优先展示固定选项，支持补充输入
- 提交时发送结构化字段值
- 有 blocking 项时，不显示或禁用确认入口
- UI 上区分“普通对话回复”和“必须回答后才能继续”的卡片

### 4.5 状态机约束

会话状态补充为以下语义：

- `drafting`：仍在收集语义
- `awaiting_clarification`：存在 blocking clarification
- `ready_for_semantic_view`：已具备完整语义，可生成 `semantic view`
- `ready_for_confirmation`：`semantic view` 已生成且可进入 `confirm canonical snapshot`
- `confirmed`：用户已确认 canonical snapshot

核心规则：

- `awaiting_clarification` 不能进入 `ready_for_semantic_view`
- `ready_for_confirmation` 只能由完整 canonical spec 投影而来
- `confirmed` 之后，关键语义字段被冻结

## 5. Phase 1：Confirm Canonical Snapshot 到 Publish 的逐项保真

### 5.1 真源约束

一旦进入 `confirm canonical snapshot` 并被用户确认，后续语义真源就是“已确认的 canonical snapshot”。

下游模块角色必须清晰：

- `IR`：从 confirmed canonical snapshot 确定性编译
- `AST`：从 IR 确定性编译
- `compiled script`：从 AST 确定性产出
- `publish`：只负责校验和落库，不再补推断

禁止行为：

- 重新回读自然语言来修正关键字段
- 使用默认值覆盖已确认字段
- 在发布前根据脚本内容反推语义并篡改确认态

### 5.2 Publication Gate 报告

后端发布阶段新增结构化 `publicationGate`：

```ts
interface PublicationGate {
  passed: boolean
  confirmedSnapshotSummary: {
    exchange: string
    symbol: string
    timeframe: string
    marketType: string
    positionMode: string
  }
  artifactSummary: {
    venue: string
    symbol: string
    primaryTimeframe: string
    instrumentType: string
    positionMode: string
  }
  blockingMismatches: Array<{
    field: string
    expected: string
    actual: string
    reason: string
  }>
}
```

规则：

- `passed=false` 时，`publish` 直接失败
- 不产生 `publishedSnapshotId`
- 前端必须展示结构化 mismatch，而不是仅显示黑盒错误

### 5.3 硬校验项

Phase 1 的发布 hard gate 至少校验以下内容：

- `exchange`
- `symbol`
- `timeframe`
- `marketType`
- `positionMode`
- 布林带参数：`period=20`、`stdDev=2`
- 入场方向：上轨突破做空、下轨突破做多
- 出场条件：回到中轨平仓
- 风险条件：`positionSize=10%`
- 风险条件：`stopLoss=5%`
- 是否存在“连续 3 根 K 线在轨外”规则
- “连续 3 根 K 线在轨外”对应动作是否与澄清结果一致

### 5.4 前端发布体验

前端在发布阶段补两类展示：

- 发布前摘要：在确认页显示关键字段，降低误确认概率
- 发布失败卡片：明确展示 `expected` 与 `actual`

示例：

- 已确认：`exchange=okx`
- 产物：`venue=binance`
- 结论：`blocking mismatch`

这样可以区分：

- 是前面没问清楚
- 还是确认态已经正确，但编译产物漂移

## 6. “连续 3 根 K 线在轨外”规则的闭环要求

这条规则是本次设计必须修复的重点，不允许再出现“用户表达了，但脚本丢了”的情况。

### 6.1 澄清阶段

如果用户表达为“连续 3 根 K 线在轨外时提前止损或减仓”，系统必须追问动作类型：

- `reduce`
- `close`

未明确前，停留在 `clarification gate`。

### 6.2 确认阶段

一旦用户完成澄清，confirmed canonical snapshot 中必须有明确字段，例如：

- `riskRules.earlyStop.type = bollinger_outside_bars`
- `riskRules.earlyStop.bars = 3`
- `riskRules.earlyStop.action = reduce | close`

### 6.3 编译阶段

`IR -> AST -> compiled script` 必须显式保留这条规则：

- 条件层：存在 `BOLLINGER_BARS_OUTSIDE`
- 动作层：根据澄清结果编译为 `REDUCE_*` 或 `CLOSE_* / FORCE_EXIT`

### 6.4 发布阶段

发布 hard gate 必须同时检查：

- 规则存在
- 参数正确：`bars=3`
- 动作正确：与用户澄清结果一致

因此，这次方案不只是“发现脚本缺项”，而是从对话、确认、编译、发布四层一起保证该规则不会丢失。

## 7. Phase 2：Runtime `isFinal / bar_close` 约束

### 7.1 目标

当策略声明 `signalEvaluation=bar_close` 时，实时执行必须只使用 finalized bar。

### 7.2 最小改法

Phase 2 不改主链路形状，只做窄改动：

- `market-data-read.gateway` 保持 `isFinal`
- `market-data-bar.mapper` 不再丢弃 `isFinal`
- `signal-generator` 在 `bar_close` 策略下，只允许 `isFinal=true` 的 bar 触发信号
- 当前 bar 未 finalized 时，本轮不触发新信号，或显式回退到上一根 finalized bar

### 7.3 接口与前端预留

为减少未来改动范围，Phase 1 即可预留只读执行语义字段：

- `signalEvaluation=bar_close`
- `requiresFinalBar=true`

前端展示建议：

- 在策略预览、确认页、已发布详情中显示“仅收盘确认后触发”
- 实时执行若因 `isFinal=false` 暂不出信号，可返回 `waiting_for_final_bar`

### 7.4 为什么拆成 Phase 2

- 它解决的是运行时执行语义
- 不影响本次 Phase 1 对“脚本与策略不相符”的主修复闭环
- 可以在不改主链路形状的前提下独立实施

## 8. 前后端接口改动汇总

### 8.1 后端

- 会话响应新增 `clarificationGate`
- 澄清答案提交支持结构化字段
- 发布响应新增 `publicationGate`
- 策略只读详情补充：
  - `signalEvaluation`
  - `requiresFinalBar`

### 8.2 前端

- 聊天区支持 blocking clarification 卡片
- blocking 状态下禁止确认
- 确认页展示关键市场与风控摘要
- 发布失败时展示 `publicationGate.blockingMismatches`
- 策略详情页预留 finalized-bar 语义展示

## 9. 测试策略

### 9.1 后端单测

- blocking clarification 命中规则
- 冲突检测规则
- `publicationGate` 字段级 mismatch 检测
- “3 根轨外”规则存在性和动作一致性校验

### 9.2 后端集成测试

- 自然语言 -> clarification gate -> semantic view 的阻断行为
- 未完成澄清时，不能进入 `confirm canonical snapshot`
- 已确认后，`publish` 对错误产物进行硬拦截

### 9.3 前端测试

- clarification 卡片渲染与结构化提交
- 有 blocking 项时禁用确认
- mismatch 卡片展示 `expected / actual / reason`

### 9.4 Phase 2 预留测试

- `bar_close` 策略遇到未 finalized bar 时不产生新 signal
- finalized bar 到达后才能触发对应 signal

## 10. 回归样例

至少固化以下四组回归样例：

1. 真实策略样例

- 输入：`OKX / BTCUSDT / 15m / 收盘确认 / 上轨做空 / 下轨做多 / 中轨平仓 / 5%止损 / 10%仓位 / 连续3根轨外提前止损或减仓`
- 预期：
  - 因 `marketType` 未明确而进入 blocking clarification
  - 因 early stop 动作歧义而进入 blocking clarification
  - 澄清完成前，不生成 `semantic view`
  - 澄清完成后，最终产物必须包含正确 `exchange` 与“3 根轨外”规则

2. 做空但未说明市场类型

- 输入包含做空语义，但未说明 `marketType`
- 预期：
  - 强制进入 `clarification gate`
  - 不允许默认推断为 `spot`

3. 已确认 `OKX`，产物却编译成 `binance`

- 预期：
  - `publicationGate` 硬拦截
  - 前端展示 `expected=okx`、`actual=binance`

4. 已确认“减仓”，脚本缺少对应规则

- 预期：
  - `publicationGate` 硬拦截
  - 不产生 `publishedSnapshotId`

## 11. 验收标准

- 关键语义字段未说清时，流程必须停在 `clarification gate`
- 有 blocking clarification 时，不生成 `semantic view`，不允许 `confirm canonical snapshot`
- 用户确认后，`exchange / symbol / timeframe / marketType / positionMode / 风控规则` 不得在编译过程中漂移
- 缺少“连续 3 根 K 线在轨外”规则或动作不一致的脚本，发布前必须被拦住
- 前端能够明确区分“未完成澄清”和“编译产物不一致”
- Phase 2 方案与接口预留明确，但不影响 Phase 1 独立交付

## 12. 交付顺序

建议按以下顺序实施：

1. 后端 `clarification gate` 阻断规则
2. 前端 clarification 卡片与确认禁用
3. 后端 `publicationGate` 硬校验
4. 前端 mismatch 展示
5. 回归样例与测试补齐
6. 独立进入 Phase 2，实现 finalized-bar 运行时约束

这样可以先稳定修复“脚本与策略不相符”的问题，再独立补强运行时 `bar_close` 语义。
