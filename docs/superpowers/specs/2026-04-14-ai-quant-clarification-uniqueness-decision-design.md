# AI Quant Clarification Uniqueness Decision Design

日期：2026-04-14

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 澄清链路已经能覆盖不少策略，但“是否继续追问”仍主要由一组分散的 `missing_*` 规则驱动。这样会带来两个稳定性问题：

- 对网格、闭环再平衡等策略，系统会追问并不真正影响唯一编译的问题，例如额外出场规则、传统止盈止损、方向
- 对 MA、布林带这类已调通策略，现有关键分叉逻辑又必须保留，不能为了“少追问”而被新逻辑误吞

产品目标不是简单地“问更少”，而是：

- 只在缺口会导致脚本生成不唯一时才追问
- 允许高置信默认推断进入候选解释，但必须先回显给用户确认
- 在“无歧义 + 无默认推断参与”时，允许直接进入脚本生成
- 该规则适用于所有策略，而不是依赖维护策略族白名单
- 不能破坏已经稳定的 MA 和布林带策略行为

## 2. 目标与非目标

### 2.1 目标

- 把“是否追问”升级为统一的唯一性决策能力，而不是继续堆叠字段硬门槛
- 让网格、闭环策略、未来新策略都共享同一套判定框架
- 把默认推断与纯规范化明确分开
- 在保持当前主数据流骨架不变的前提下，引入新的三态决策层
- 为 MA、布林带建立回归护栏，保证现有关键行为不退化

### 2.2 非目标

- 不重写语义归一化主链
- 不重写 canonical spec v2 / 编译 / 回测 / 部署主链
- 不引入“按策略族注册必填项”的长期机制
- 不以减少追问为唯一优化目标

## 3. 设计原则

### 3.1 唯一编译优先

任何追问都必须回答同一个问题：

`如果不问这个，最终脚本会不会落成两个或多个不同版本？`

只有答案为“会”时，才允许追问。

### 3.2 默认推断可见、不可偷渡

- 纯规范化不算默认推断
- 真正参与候选解释的系统补全才算默认推断
- 默认推断不能直接进入脚本生成，必须先经用户确认

### 3.3 通用能力优先于策略族白名单

系统不依赖“网格 / 马丁 / 均线 / 布林”这样的策略族表来决定必填项，而是根据当前语义是否具备：

- 唯一执行上下文
- 闭环退出语义
- 必需风控
- 唯一方向约束
- 真实触发分叉

来决定后续动作。

### 3.4 兼容优先

新逻辑只能减少误追问，不能减少真实分叉追问。特别是 MA、布林带当前已经验证正确的 trigger confirmation、basis ambiguity、方向分叉，必须原样保留。

## 4. 方案比较

### 4.1 方案 A：继续补策略族特判

优点：

- 实现快
- 对单一问题见效快

缺点：

- 每新增一种策略都要继续补
- 混合策略会迅速退化
- 无法达到“适用于所有策略”的目标

### 4.2 方案 B：一次性替换旧澄清规则

优点：

- 理论上最干净

缺点：

- 风险过大
- 最容易破坏已调通的 MA / 布林带链路

### 4.3 方案 C：兼容优先的唯一性决策层

做法：

- 保留当前主链骨架
- 将旧 `missing_*` 规则降级成候选证据
- 新增统一三态决策层
- 让 `codegen-conversation` 只消费统一决策结果
- 同时用 MA / 布林带回归基线兜住稳定行为

结论：

本设计选择方案 C。

## 5. 目标流程

目标主链为：

`用户输入 -> 语义归一化 -> 唯一性判定 -> 分流`

分流只保留三种结果：

### 5.1 `DIRECT_COMPILE`

条件：

- 无真实编译歧义
- 无默认推断参与
- 已满足编译所需硬上下文

行为：

- 直接进入脚本生成
- 不再额外多一轮确认

### 5.2 `CONFIRM_INFERRED`

条件：

- 当前输入能形成唯一候选解释
- 候选解释中包含系统默认推断

行为：

- 回显当前理解的策略摘要
- 明确列出哪些部分是系统推断而非用户明确给出
- 用户确认后才进入脚本生成

### 5.3 `ASK_CLARIFY`

条件：

- 当前输入存在真实编译歧义

行为：

- 进入串行澄清模式，而不是一次性并发追问多个问题
- 每一轮只追问一个当前最影响唯一编译的问题
- 用户回答后，必须重新执行唯一性判定，再决定是继续追问、转入 `CONFIRM_INFERRED`，还是直接 `DIRECT_COMPILE`
- 只有当所有会导致脚本分叉的缺口都被消除后，才能退出 `ASK_CLARIFY`
- 每个问题都必须能解释为“若本轮不问，当前脚本仍会分叉”

## 6. 新增统一决策对象

建议引入统一结果对象 `StrategyDecision`，作为澄清层对下游的唯一输出。

```ts
type StrategyDecision =
  | {
      kind: 'DIRECT_COMPILE'
      normalizedSummary: string
      blockingReasons: []
      inferredAssumptions: []
      nextActionPayload: DirectCompilePayload
    }
  | {
      kind: 'CONFIRM_INFERRED'
      normalizedSummary: string
      blockingReasons: []
      inferredAssumptions: InferredAssumption[]
      nextActionPayload: ConfirmInferredPayload
    }
  | {
      kind: 'ASK_CLARIFY'
      normalizedSummary: string
      blockingReasons: BlockingReason[]
      inferredAssumptions: InferredAssumption[]
      nextActionPayload: AskClarifyPayload
    }
```

其中字段含义如下：

- `normalizedSummary`
  当前系统理解出的标准化策略摘要。它是对用户输入的统一表达，不等于默认推断。

- `blockingReasons`
  真正阻塞唯一编译的原因，而不是字段缺失列表。
  在 `ASK_CLARIFY` 状态下，该列表必须按“对当前唯一编译影响程度”排序，列表第一项就是本轮唯一允许对用户发出的追问来源。

- `inferredAssumptions`
  系统为形成候选解释所补入的默认推断，不包含纯规范化结果。

- `nextActionPayload`
  供下游模块直接消费的动作载荷，避免每层再自行猜测。

## 7. 证据模型

旧规则不再直接决定“问不问”，而是先产出候选证据。

首批证据类型建议包括：

- `runtime_context_missing`
- `runtime_context_conflict`
- `trigger_semantics_fork`
- `basis_ambiguity`
- `direction_ambiguity`
- `exit_semantics_missing`
- `closed_loop_exit_detected`
- `risk_rule_optional_under_current_semantics`
- `timeframe_not_required_for_uniqueness`
- `normalized_without_inference`

说明：

- `closed_loop_exit_detected` 与 `risk_rule_optional_under_current_semantics` 是本次解决网格及类似策略误追问的关键证据
- `trigger_semantics_fork` 与 `basis_ambiguity` 是保住 MA / 布林带稳定行为的关键证据

## 8. 默认推断与纯规范化边界

### 8.1 不算默认推断

以下情况只属于规范化：

- “BTC 永续”规范成 `BTCUSDT perp`
- “千分之5”规范成 `0.5%`
- 用户已显式给出且只是表达格式转换

这些情况不会进入 `CONFIRM_INFERRED`。

### 8.2 算默认推断

以下情况属于系统补充解释：

- 未声明方向，系统暂按 `long_only` 理解
- 未声明触发模式，系统暂按“收盘确认”理解
- 未声明风险动作，系统暂补某个止盈止损方案

这些情况若仍能形成唯一候选解释，应进入 `CONFIRM_INFERRED`，而不是直接生成。

## 9. 模块职责调整

### 9.1 `strategy-clarification-rules.service.ts`

从“全局缺项硬门槛”调整为“候选证据收集器”。

职责：

- 识别真实阻塞证据
- 识别闭环退出、可选风控、已显式方向等减问证据
- 不直接输出最终追问结论

### 9.2 `strategy-execution-context.service.ts`

继续负责交易所、标的、市场类型等硬上下文。

调整点：

- `timeframe` 从全局硬缺项降级为“是否影响唯一编译”的证据项

### 9.3 `strategy-compileability-decision.service.ts`

新增决策服务。

职责：

- 汇总显式证据、闭环语义、默认推断、编译诊断
- 产出统一 `StrategyDecision`

### 9.4 `codegen-conversation.service.ts`

调整为只消费 `StrategyDecision.kind` 进行分流，不再手工维护大量分支问法。

### 9.5 `strategy-clarification-question.service.ts`

只负责把 `ASK_CLARIFY` / `CONFIRM_INFERRED` 渲染成人话，不再决定该不该问。

## 10. 对网格及类似策略的影响

本设计要系统性解决的问题包括但不限于：

- 网格策略被错误追问独立出场规则
- 网格策略被错误追问传统止盈止损
- 网格策略被错误追问方向，尽管文本已内生提供方向或仍需由真实分叉决定

示例：

`在 okx 做 btc 永续 60000-80000 网格 每格千分之5 不断低买高卖 单笔10%资金`

目标行为：

- 交易所、标的、市场类型、区间、步长、仓位被识别
- “低买高卖”被识别为闭环买卖语义
- 若系统无需额外推断即可形成唯一解释，则直接生成
- 若方向仍存在真实双解，则只追问方向，不再额外追问出场/止盈止损

## 11. 对 MA / 布林带的兼容约束

本设计必须明确保护已调通行为：

### 11.1 MA

- 当前可直接生成的输入，改后仍可直接生成
- 当前会因真实歧义而追问的场景，改后仍继续追问

### 11.2 布林带

- “触碰即触发”与“收盘确认后触发”这类真正会导致脚本差异的 fork 必须继续追问
- 百分比 basis 不明确且确实影响脚本时，必须继续追问
- 新逻辑不得把这些真实分叉误判成可直接生成

原则：

`新系统只能减少假问题，不能减少真问题。`

## 12. 迁移方案

### 12.1 第一步：引入统一决策对象

- 新增 `StrategyDecision`
- 新增 `strategy-compileability-decision.service.ts`
- 并行读取现有澄清规则输出

### 12.2 第二步：主分流切换

- `codegen-conversation.service.ts` 优先消费 `StrategyDecision`
- 旧 `missing_*` 分支保留为兜底

### 12.3 第三步：旧规则降级

- 将旧的全局硬门槛逐步降级为证据项
- 删除已被三态决策完全接管的直接追问逻辑

迁移原则：

- 每一步都可独立验证
- 每一步都可回滚
- 不一次性推翻主链

## 13. 测试与验收

### 13.1 决策层单测

覆盖：

- `DIRECT_COMPILE`
- `CONFIRM_INFERRED`
- `ASK_CLARIFY`

重点负例：

- 网格低买高卖不再触发错误的 `missing_exit_rules`
- 闭环策略不因缺少传统止盈止损模板而被强制追问
- 布林带 trigger confirmation 与 basis ambiguity 仍进入 `ASK_CLARIFY`

### 13.2 对话层集成测试

覆盖：

- 网格类输入
- MA 类输入
- 布林带类输入
- 默认推断类输入

校验：

- 决策类型
- assistant prompt
- 关键 blocking reason

### 13.3 回归基线测试

将当前已调通的 MA / 布林带用例固化为回归基线。

要求：

- 新逻辑输出不得退化
- 只能减少误追问，不能减少真实分叉追问

## 14. 验收标准

只有同时满足以下条件，才算本次设计目标达成：

- 所有策略的追问都能解释为“若不问将导致脚本分叉”
- 网格及其他闭环策略不再被模板化追问独立出场、传统止盈止损、方向
- 高置信默认推断只能进入“候选解释确认”，不能直接进入脚本生成
- 无歧义且无默认推断参与时，允许直接进入脚本生成
- MA 当前稳定行为不变
- 布林带当前关键分叉追问不变

## 15. 风险与缓解

### 15.1 风险：旧证据仍然带偏新决策

缓解：

- 先把旧规则降级为候选证据
- 在决策层显式处理“闭环退出”“可选风控”等减问证据

### 15.2 风险：为减少追问误吞真实分叉

缓解：

- 将 MA / 布林带关键用例固化为强回归基线
- 将 `trigger_semantics_fork` 与 `basis_ambiguity` 视为高优先级阻塞证据

### 15.3 风险：默认推断边界不清

缓解：

- 明确区分“纯规范化”与“系统补全解释”
- 仅后者进入 `CONFIRM_INFERRED`

## 16. 结论

本设计不是继续给策略族补丁，也不是推翻现有主数据流，而是在当前主链中引入统一的唯一性决策层：

- 用三态决策替代模板化缺项追问
- 用通用语义能力替代策略族必填项
- 用 MA / 布林带回归基线保护已验证行为

最终目标是：

`所有策略都按“是否影响唯一编译”决定追问，而不是按“缺少了哪个模板字段”决定追问。`
