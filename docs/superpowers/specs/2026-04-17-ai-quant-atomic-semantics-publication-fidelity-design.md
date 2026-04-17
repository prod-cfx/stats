# AI Quant Atomic Semantics Publication Fidelity Design

日期：2026-04-17

状态：设计已确认，待评审

## 1. 背景

当前 AI Quant 已经形成一条较完整的策略生成与发布链路：

`用户消息 -> checklist patch / planner logic patch -> semanticState -> normalizedIntent (+ compatibility checklist projection) -> canonicalSpec -> digest -> confirmGenerate -> publication -> IR -> AST -> compiled script -> consistency -> published snapshot`

但在复杂策略下，仍然会出现“策略语义已确认，最终脚本却不一致”的问题。用户提供的两个测试案例虽然表面分别属于网格和布林带，但暴露出的并不是“策略族支持不足”，而是同一类更底层的问题：

- 已确认的原子语义在发布链路中被二次解释、降维或反推漂移
- 复杂策略越依赖方向、basis、sideScope、positionMode 这类显式语义，越容易在后链路失真

本设计的目标不是按策略族补洞，而是以原子语义为中心，定义一条最小且稳定的保真发布路径。

## 2. 代码核对后的当前真实链路

本次设计基于当前代码重新核对，结论如下：

### 2.1 会话主链路

- 用户消息进入后，会先形成 checklist patch / planner logic patch
- 系统构造或更新 `semanticState`
- 由 `semanticState` 推导 `normalizedIntent`
- 在兼容路径下，`semanticState` 会被投影回 compatibility checklist projection
- 基于 checklist 与 normalization 构造 `canonicalSpec`
- `specDescBuilder.buildFromCanonicalSpec(...)` 生成 `specDesc`，其中携带 `canonicalDigest`
- 会话进入 `CHECKLIST_GATE`
- 用户 `confirmGenerate` 时，系统校验 `confirmedCanonicalDigest === canonicalDigest`
- 校验通过后，会话进入 `GENERATING`
- 后续交给 publication pipeline 执行发布链

### 2.2 publication pipeline 内部链路

- `canonicalSpec -> IR`
- `IR -> AST`
- `AST -> compiled script`
- compiled script 结构校验
- persist validated version
- semantic consistency 校验
- compiled publication gate / publish
- 生成 published snapshot
- 再根据 published consistency status 决定最终会话是 `PUBLISHED` 还是 `CONSISTENCY_FAILED`

### 2.3 关键实现现状

- `digest` 不是独立节点，而是 `specDesc` 的一部分
- `compatibility checklist projection` 目前不只用于展示，也仍参与确认前与发布前的真实链路
- `AST` 不是可忽略中转层，它是执行结构的最后一层规范边界；`IR` 正确但 `AST` 或 emitter 改义，脚本依然会错

## 3. 问题定义

这次要修的不是“网格策略错了”或“布林带策略错了”，而是：

`已确认的原子语义，在 semanticState / normalizedIntent -> canonicalSpec -> IR -> AST -> compiled script 的链路里发生了改义、降维、或反推漂移。`

统一来看，当前问题集中在以下三类失真：

### 3.1 方向失真

例子：

- `bollinger.touch_middle + sideScope=short` 最终被编成双向平仓

### 3.2 执行语义失真

例子：

- `bollinger.middle_revert` 被编成过宽的 `CROSS_OVER OR CROSS_UNDER`
- 本应与持仓方向绑定的原子条件被压成无方向条件

### 3.3 发布路径失真

例子：

- 已有 `semanticState`，但发布时仍走 compatibility checklist projection 再重建 canonicalSpec
- `grid.range_rebalance` 已存在，但在发布路径里没有稳定落成最终开平仓 rule

## 4. 两个测试案例暴露出的统一根因

### 4.1 网格案例

用户语义已包含：

- `grid.range_rebalance`
- `rangeLower = 60000`
- `rangeUpper = 80000`
- `stepPct = 0.5`
- `sideMode = bidirectional`
- `positionPct = 10`
- `stopLossPct = 5`
- `takeProfitPct = 10`

但最终脚本只剩 risk guard，没有网格开平仓逻辑。说明问题不在“没有识别原子语义”，而在“发布路径没有稳定使用已确认的原子语义直达最终编译产物”。

### 4.2 布林带案例

用户语义应对应：

- `bollinger.touch_upper + sideScope=short`
- `bollinger.touch_lower + sideScope=long`
- `bollinger.touch_middle + sideScope=short/long`
- `positionPct = 10`

但当前实现中存在以下失真风险：

- `touch_middle` 默认容易被压成 `sideScope = both`
- `bollinger.middle_revert` 在 IR 编译中被实现为 `CROSS_OVER OR CROSS_UNDER`
- execution envelope 从 action 集合反推 `positionMode`，会把错误动作进一步放大为 `long_short`

这说明问题同样不是“布林带模板没写好”，而是“方向敏感原子语义没有被单向保真编译”。

## 5. 目标与非目标

### 5.1 目标

- 保持当前主数据流的节点与顺序不变，不改写会话主链与发布主链形状
- 明确原子语义在发布主链路中的单向保真边界
- 让复杂策略的一致性依赖于原子语义组合，而不是策略模板特判
- 让 `canonicalSpec -> IR -> AST -> compiled script` 的每一层都成为保真投影或编译层，而不是再次理解层
- 让 future regression 能定位到具体是哪一层先改义

### 5.2 非目标

- 不重写整套语义系统
- 不改动主数据流的核心节点与顺序，不把当前链路改造成另一套流程
- 不删除所有 compatibility checklist projection 相关能力
- 不按网格、布林带、均线等策略族逐个加模板特判
- 不在本轮设计中一次性切到“原子语义直接输出脚本、完全取消 canonicalSpec/IR/AST”

## 6. 方案比较

### 6.1 方案 A：按案例特判修补

优点：

- 改动最小
- 见效快

缺点：

- 继续按策略表象补洞
- 无法覆盖新的复杂原子组合
- 与当前原子语义架构方向相悖

### 6.2 方案 B：保留主链，但把发布路径改成原子语义保真编译

做法：

- 保留 `semanticState / normalizedIntent -> canonicalSpec -> IR -> AST -> script`
- 保留 `digest -> confirmGenerate -> publication -> consistency -> published snapshot` 的主顺序
- 切断会改义的 compatibility 回投路径
- 让后层只能编译前层，不能回填改写前层语义

优点：

- 是最小修复
- 与现有架构最兼容
- 保留 digest / confirm / consistency / published snapshot 这些已有能力

缺点：

- 仍需保留多层编译契约
- 需要补一批 contract 级测试

### 6.3 方案 C：完全改成原子语义直出脚本

优点：

- 链路最短
- 理论上最少中间失真

缺点：

- 不属于最小修复
- 会冲击当前 canonicalSpec、digest、consistency、published snapshot 等机制
- 如果 compiler 本身仍有二次推断，仍然可能不一致

### 6.4 结论

本设计选择方案 B。

核心判断：

一致性取决于“有没有无损投影 + 单向编译”，不取决于“中间层数量最少”。

## 7. 最小修复设计

### 7.1 发布主链统一改成语义直编 canonical

当前最危险的一段，是在已有 `semanticState` 的情况下，发布阶段仍先做 compatibility checklist projection，再用 checklist 构造 canonicalSpec。

最小修复要求：

- 只要存在可用 `semanticState`，发布主链优先走：
  - `semanticState -> normalizedIntent -> canonicalSpecBuilder.buildFromNormalizedIntent(...)`
- compatibility checklist projection 只用于：
  - 展示
  - 向后兼容接口
  - 调试快照
- compatibility checklist projection 不再作为发布真链路的 canonicalSpec 输入来源

### 7.2 canonicalSpec 改成原子语义的无损编译产物

`canonicalSpec` 这一层继续保留，但角色改变：

- 它不再负责从文本二次猜语义
- 它只负责把已确认的原子语义编译成稳定、可展示、可 digest、可确认、可继续下游编译的规范结构

必须禁止：

- fallback 规则覆盖已确认的 `sideScope / basis / confirmation / action semantics`
- 把方向敏感原子压成宽泛 canonical rule

### 7.3 IR compiler 必须消费方向敏感原子 contract

对方向敏感原子，compiler contract 需要显式化：

- 某些 atom 是 `direction-sensitive`
- `IR` 生成 predicate / action 时必须消费 `sideScope`
- 不允许把方向敏感 atom 编成 side-agnostic predicate

以布林带为例：

- `bollinger.middle_revert` 不能统一编成 `CROSS_OVER OR CROSS_UNDER`
- 应按 rule 的 `sideScope` 拆成 long exit 与 short exit 的不同编译语义

### 7.4 AST 层纳入保真边界

`AST` 必须成为显式的一致性边界，而不是默认“IR 正确就代表 AST 正确”。

最小修复要求：

- `IR -> AST` 不得压扁方向、guard scope、predicate 组合
- 对关键方向敏感原子，AST 层需保留可回溯到 rule / predicate 的结构证据
- emitter 只能序列化 AST，不能在脚本层继续做新的语义推断

### 7.5 execution envelope 停止从 exit 动作反推持仓模式

当前 `positionMode` 的风险在于：

- 它从 action 集合反推
- 且把 exit 动作也纳入 exposure 推断

最小修复要求：

- `positionMode` 优先来自语义层显式信息
  - `semanticState.position.positionMode`
  - 或 normalizedIntent / compiled IR 中的显式方向集合
- 只有在完全缺少语义来源时才允许 fallback
- fallback 也只能看开仓/增仓类动作，不能从平仓动作反推 exposure

## 8. 验证设计

### 8.1 分层保真校验

一致性校验从“最终结果像不像”升级为“分层保真校验”：

- `semanticState -> normalizedIntent`
- `normalizedIntent -> canonicalSpec`
- `canonicalSpec -> IR`
- `IR -> AST`
- `AST -> compiled script`

未来错误应能定位为：

- `atomic_semantics_lost_at_canonical`
- `direction_sensitive_atom_flattened_at_ir`
- `ast_projection_mismatch`
- `position_mode_inferred_from_exit_actions`

而不是只有笼统的“脚本不一致”。

### 8.2 回归测试按失真类型组织

测试不按策略族写，而按原子语义失真类型组织：

- 方向保真
  - `bollinger.touch_middle + sideScope=short -> CLOSE_SHORT only`
  - `bollinger.touch_middle + sideScope=long -> CLOSE_LONG only`
- 网格保真
  - `grid.range_rebalance + bidirectional -> long/short 四条 rule`
  - `grid.range_rebalance + short_only -> short entry/exit only`
- basis 保真
  - `risk.stop_loss_pct / take_profit_pct + entry_avg_price`
  - basis 不得在后链路被改成 `position_pnl`
- 持仓模式保真
  - `short-only strategy` 不得因 exit 动作被抬成 `long_short`

### 8.3 保留两条真实黄金用例

虽然修复不按策略族进行，但仍建议保留两条端到端黄金用例作为验收样本：

- 网格真实案例
- 布林带真实案例

目的不是做分类治理，而是用真实复杂输入覆盖：

- 结构化参数型原子组合
- 方向敏感型条件原子组合

### 8.4 失败时阻断，不静默 fallback

当系统发现：

- 已闭合语义无法被 canonicalSpec 无损表达
- 方向敏感 atom 被编译成 side-agnostic 结果
- `positionMode` 只能从 exit 动作才能推导

则应显式标记为一致性失败或编译阻断，而不是静默降级到 compatibility 路径继续产出一个可能漂移的脚本。

## 9. 实施范围建议

本轮最小修复建议只覆盖以下模块：

- `codegen-publication-generation.stage.ts`
- `canonical-spec-builder.service.ts`
- `canonical-spec-v2-ir-compiler.service.ts`
- `canonical-strategy-ast-compiler.service.ts`
- `compiled-script-execution-envelope.service.ts`
- `strategy-consistency.service.ts`
- 相关 contract tests 与 golden cases

其中：

- `semanticState / normalizedIntent` 只做必要的 contract 补强
- compatibility checklist projection 保留，但退出发布真链路

## 10. 风险与控制

### 10.1 风险

- 现有 compatibility 路径与发布路径耦合较深
- 某些旧测试依赖 compatibility checklist projection 参与 canonicalSpec 构建
- 修复后可能暴露更多历史“静默近似编译”问题

### 10.2 控制

- 先收紧发布链，不先删除 compatibility 能力
- 先补 contract tests，再替换主路径
- 对已无法无损表达的情况，优先阻断并给出清晰失败原因

## 11. 结论

这次最小修复的核心，不是减少层数，而是收紧语义边界：

- 不改主数据流节点与顺序
- 保留 `semanticState / normalizedIntent -> canonicalSpec -> IR -> AST -> script`
- 切断会改义的 compatibility 回投
- 让后层只能单向编译前层
- 用分层 contract 校验守住复杂原子语义的保真

这样既能修复当前网格与布林带案例暴露出的不一致，也能为未来更多复杂原子组合提供稳定的发布基础。
