# Rules-Only Stage 2: Main Dataflow

## 背景

Issue #1632 是 rules-only pipeline 的阶段 2。阶段 1（Issue #1630 / PR #1634）已经把入口侧推进到 typed rules：planner / dispatcher / schema gate / 对话 / 补槽 / 策略生成 / 脚本生成入口侧都应产出或消费 typed rules。

阶段 2 的任务不是删除扁平五桶兼容代码。删除 `trigger / action / risk / positionConstraint / orchestration`、旧 fixture、legacy path 属于阶段 3。

阶段 2 的任务是让生产主链路彻底 rules-only：从自然语言会话开始，到补槽、assistant 描述、展示、canonical spec、IR、脚本、回测、发布、部署 payload、runtime execution，所有执行语义都只来自 `SemanticState.rules` 及其 canonical / IR / snapshot 派生产物。flat 五桶只能作为兼容投影、测试对照或旧 fixture 支撑，不能参与主链路最终决策。

## 目标

阶段 2 完成主数据流 rules-only：

```text
用户自然语言
  -> typed SemanticState.rules
  -> readiness / clarification
  -> assistant description / display graph
  -> canonical spec
  -> IR
  -> AST / script
  -> backtest
  -> published snapshot
  -> deploy payload
  -> runtime execution state
```

目标结果：

- `SemanticState.rules` 是主链路唯一策略语义真源。
- Readiness、DisplayGraph、CanonicalSpecBuilder、Publication gate、backtest、deploy payload、runtime execution 全部从 rules / canonical spec / IR 派生。
- 主链路没有 `readFlatXxx` 或 `state.trigger/action/risk/positionConstraint/orchestration` 参与执行决策。
- 每条 canonical spec / IR / AST / script / deploy 语义都能追溯到 typed rule path。
- 60% 策略回归语料在 PM2 staging 中从新会话开始跑完整链路。
- 30 条 staging 策略不做旧数据迁移，不走兼容 adapter，不用人工修补；必须用改后代码重新从会话入口跑通。

## 非目标

阶段 2 不做以下事项：

- 不删除 `SemanticState.trigger / action / risk / positionConstraint / orchestration` 字段。
- 不删除 `CodegenSemanticPatch` 旧字段类型定义。
- 不删除 `readFlatXxx`。
- 不删除旧 fixture。
- 不做旧 session migration。
- 不做旧策略 adapter。
- 不为了旧数据兼容保留主链路 fallback。
- 不扩展 90% 新策略能力；能力扩展属于阶段 4。
- 不把 display summary、legacy specDesc、flat projection 作为执行语义来源。

## 核心原则

### 1. 主链路与兼容代码分离

阶段 2 保留兼容代码，但必须明确边界：

- 主链路：会话、补槽、readiness、display、canonical、IR、script、backtest、publish、deploy、runtime execution。
- 兼容边界：旧 fixture、测试对照、rules -> flat 派生投影、历史会话只读恢复。

主链路文件中若仍需读取 flat projection，必须只能用于非决策性的诊断、日志或测试对照，并且不能回写或补齐执行语义。

### 2. Rules Path 追溯

所有语义节点必须带 source path：

```text
rules[0].condition...
rules[0].effects.actions[0]...
rules[0].effects.risks[0]...
rules[0].effects.positions[0]...
rules[0].effects.orchestration[0]...
rules[0].effects.programs[0]...
```

补槽、display、canonical spec、IR、AST、script、deploy payload 的语义都必须能回溯到这些 path。

### 3. Fail Closed

以下情况必须阻断，不允许静默 fallback：

- planner 输出旧 patch 字段进入主链路。
- `SemanticState.rules` 缺失或为空。
- 补槽答案找不到 rule path。
- canonical spec 无法追溯到 rule path。
- IR / AST / script 出现 rules 中不存在的执行语义。
- backtest IR hash 与 deploy IR hash 不一致。
- published snapshot 缺 canonical spec / IR / AST / script binding。
- deploy payload 试图从 flat / display / legacy specDesc 补执行语义。

## 组件设计

### 1. Rules Reader / Visitor

建立主链路规则访问边界。实现时可以落在新服务或现有服务中，但必须形成一个集中入口，主链路消费者不得各自手写 rules 遍历逻辑：

- 遍历 rule condition tree。
- 遍历 typed effects：`actions / risks / positions / orchestration / programs`。
- 输出 canonical-ready 的 source path、atom key、params、evidence、phase、sideScope。
- 对缺 role、缺 evidence、缺 params、unsupported atom 返回结构化诊断。

主链路消费者必须通过 rules reader / visitor 读取语义，不能直接扫 flat 五桶做执行判断。

### 2. Readiness / Clarification

Readiness 直接检查 rules：

- entry / exit / gate / program rule 是否完整。
- condition tree 是否有可执行 predicate。
- `effects.actions` 是否有订单动作与方向。
- `effects.risks` 是否有止损、止盈、熔断、退出 policy。
- `effects.positions` 是否有 sizing、预算、DCA、加仓约束。
- `effects.orchestration` 是否有 exchange、symbol、timeframe、data-source、scope binding。
- `effects.programs` 是否有 grid / DCA / TWAP / adaptive grid / event listener 等程序参数。

缺参数时生成 rule path 级 open slot。补槽答案只写回 `rules[].condition` 或 `rules[].effects.<role>[]`，不能写 `trigger[0]`、`risk[0]`、`positionConstraint[0]` 等 flat owner。

### 3. Conversation / Assistant Description

会话入口继续只接受 typed rules。assistant 的理解说明必须从 rules 或 canonical spec 生成，并包含可审计的 rule path / evidence 关系。

禁止：

- 用 legacy checklist summary 补策略说明。
- 用 flat projection 反向补 rules。
- 用 unsupported fallback 生成默认策略。

### 4. DisplayGraph

Display graph 只从 rules 或 canonical spec 派生：

- IF / AND / OR / SEQUENCE 来自 `rule.condition`。
- action / risk / position / orchestration / program 展示来自 typed effects。
- 每个展示 item 必须带 source rule path。

旧 display fallback 可保留给旧会话只读恢复，但不允许进入新会话主链路，不允许回写执行语义。

### 5. CanonicalSpecBuilder

CanonicalSpecBuilder 是阶段 2 核心切换点。

新主路径：

```text
rules[].condition -> canonical condition
rules[].effects.actions -> canonical actions
rules[].effects.risks -> risk guards / exit policy
rules[].effects.positions -> sizing / exposure / add-position / DCA constraints
rules[].effects.orchestration -> gates / scopes / portfolio controls / data-source binding
rules[].effects.programs -> orderPrograms
```

Canonical spec 中每个 rule、condition、action、risk、sizing、program、orchestration node 都必须带 source rule path。不能从 `readFlatTriggers`、`readFlatActions`、`readFlatRisks`、`state.positionConstraint`、`state.orchestration` 做主决策。

阶段 2 可保留 flat projection 对照测试，证明新 rules visitor 输出与阶段 1 支持能力一致。

### 6. Publication Gate / Hash Chain

发布前记录并校验：

```text
rulesHash
displayGraphHash
canonicalSpecHash
irHash
astHash
scriptHash
runtimeEvaluatorVersion
```

门禁规则：

- canonical spec 必须完全来自 rules path。
- IR 必须完全来自 canonical spec。
- AST / script 必须完全来自 IR。
- display graph 不允许展示 rules 中不存在的语义。
- backtest 和 deploy 必须使用同一 IR hash。
- flat-only atom 不允许进入 canonical spec / IR / script / deploy payload。

任一门禁失败，发布进入 rejected / consistency failed，不生成可部署 snapshot。

### 7. Backtest

Backtest 只接受 canonical spec / IR / published snapshot truth：

- 不从 display graph 读取策略语义。
- 不从 flat projection 补 entry / exit / risk / sizing。
- 不在 backtest adapter 中静默补默认止损、仓位、方向。
- 缺参数必须回到 readiness 阶段追问。

回测结果记录使用的 `irHash`，用于 deploy 前比较。

### 8. Deploy Payload

部署入口只引用 published snapshot：

- `publishedSnapshotId`
- `snapshotHash`
- canonical spec
- IR / AST / script
- deploymentExecutionDefaults
- deploymentExecutionConstraints
- deploymentExecutionConfig

部署不得从 `specDesc` 文案、display graph、flat projection 或旧 session state 补执行语义。若 snapshot 缺 canonical / IR / AST / script / execution binding，抛 requires republish。

### 9. Runtime Execution

runtime execution state 初始化只从 snapshot IR / AST / execution envelope 派生：

- execution semantic keys 来自 IR / AST。
- grid runtime 来自 compiled order program snapshot。
- strategy detail 只展示 snapshot/rules-derived summary。
- runtime detail 不从 flat state 补语义。

## 错误处理

### 用户可恢复错误

- 缺参数：返回 rule path 级 clarification。
- unsupported atom：返回缺失能力分类，不生成默认策略。
- old flat-only session：提示重新描述或重新发布，不自动迁移。
- hash mismatch：阻断发布或部署，提示重新生成策略。
- snapshot 缺绑定真相：部署失败，提示重新发布。

### 工程错误

- canonical spec 不可追溯到 rules path：publication gate failed。
- IR / AST / script 语义漂移：consistency failed。
- deploy request 初始化 runtime state 失败：mark deploy request failed。
- PM2 staging 链路中任一策略出现 flat fallback：阶段 2 验收失败。

## 验收标准

对准 Issue #1632：

- [ ] 主代码路径没有 `readFlatXxx` 参与执行决策。
- [ ] `CanonicalSpecBuilder` 不依赖 `state.trigger/action/risk/positionConstraint/orchestration`。
- [ ] Readiness 追问不依赖 flat owner。
- [ ] Display 不依赖 legacy fallback。
- [ ] 语义回归集从自然语言到 IR hash 稳定。
- [ ] 60% 策略回归语料在 staging 中完成：对话 -> 回答 -> typed rules -> canonical spec -> IR -> script code -> backtest -> deploy payload。
- [ ] Backtest 和 deploy payload 使用同一 IR hash；任一策略出现 hash 漂移则阶段不通过。
- [ ] 缺参策略在 readiness 阶段追问，不能在后续 spec / IR / runtime 阶段静默补默认值。
- [ ] 文本对话、策略识别、补槽回答、策略生成、脚本代码生成同步切到 rules-only。
- [ ] PR body 列出用户最终验收所需的 PM2 staging 步骤和证据位置。

补充验收：

- [ ] 30 条 staging 策略不做旧数据迁移，不走兼容 adapter，不做人工修补。
- [ ] 30 条 staging 策略全部用改后代码从新会话入口跑通。
- [ ] 30 条 staging 策略全部完成：会话 -> 补槽 -> assistant 描述 -> display -> canonical spec -> IR -> script -> backtest -> publish snapshot -> deploy payload -> runtime execution 初始化。
- [ ] 每条 staging 证据包含 `rulesHash / canonicalSpecHash / irHash / astHash / scriptHash / runtimeEvaluatorVersion`。
- [ ] 任一 staging 策略使用 flat projection / legacy specDesc / display graph 补执行语义，则阶段 2 不通过。

## Staging 验证

PM2 staging 环境使用改后代码重新跑 30 条策略：

```text
1. 创建新会话
2. 输入自然语言策略
3. 如有缺参，按系统问题补槽
4. 确认 assistant 描述和 display graph
5. 生成脚本
6. 执行回测
7. 发布 snapshot
8. 构造 deploy payload
9. 初始化 runtime execution state
10. 收集 hash chain 和 trace evidence
```

验证只接受新会话全链路结果：

- 不读取旧 session 作为成功证据。
- 不把旧 flat fixture 迁移成成功证据。
- 不人工修补 snapshot、IR、deploy payload。
- 不手动修改数据库让 deploy 通过。

## 测试策略

最低测试集合：

- planner schema gate：旧 patch 字段不能进入主链路。
- rules reader / visitor 单测：condition 和 typed effects 输出 source path。
- readiness 单测：缺参 open slot 是 rule path。
- clarification 单测：补槽答案写回 rules path。
- display 单测：display item 全部带 rules/canonical source path。
- canonical builder 单测：canonical spec 不依赖 flat reader；每条语义可追溯到 rules path。
- publication gate 单测：rulesHash -> canonicalSpecHash -> irHash -> astHash -> scriptHash。
- backtest 单测：只使用 canonical spec / IR。
- deploy 单测：snapshot 缺 canonical / IR / AST / script 时 requires republish。
- runtime execution 单测：execution semantic keys 从 snapshot IR / AST 派生。
- staging e2e：30 条策略从新会话开始跑完整链路。

## 禁止事项

- 禁止主链路从 flat projection 补执行语义。
- 禁止主链路从 display graph 补执行语义。
- 禁止主链路从 legacy specDesc 补执行语义。
- 禁止为了阶段 2 删除五桶字段；删除属于阶段 3。
- 禁止为了通过 30 条 staging 策略做旧数据迁移或兼容 adapter。
- 禁止缺参策略在 canonical / IR / runtime 阶段静默补默认值。
- 禁止只改 canonical / IR / runtime 后宣称阶段 2 完成；入口、对话、补槽、描述、脚本、回测、部署、执行必须同步 rules-only。
