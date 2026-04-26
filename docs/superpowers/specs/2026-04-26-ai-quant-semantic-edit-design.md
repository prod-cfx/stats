# AI 量化语义级对话修改设计

Issue: #904

## 背景

AI 量化对话当前已经以语义状态为主线：`trigger`、`action`、`risk`、`position`、`context` 组成 active semantic graph，再投影到 canonical spec、逻辑图、脚本生成和发布流程。

现有问题是，对话入口仍容易把用户后续输入当成“回答当前槽位”或“普通策略补充”，而不是识别为“修改已有语义”。用户说“我要把交易标的改为 BTCUSDT”“把触发改成 RSI 小于 30”“行动改成只提醒”“脚本生成后把止损改成 3%”时，系统可能继续重复旧阻塞信息，或者无法在已确认/已发布上下文里派生修改后的策略版本。

本设计目标是新增统一的 semantic edit 层，适用于 AI 量化普通对话和策略广场点击“编辑”的对话。不按策略族、atom 或旧 checklist 设计，不改主数据流。

## 目标

- 识别用户自然语言中的语义修改意图，包括 `context`、`trigger`、`action`、`risk`、`position`。
- 在脚本生成前，修改 active semantic graph 并重新进入确认门。
- 在脚本生成后，基于最新 spec/script/snapshot 派生修改版，重新生成、校验并发布修改后的脚本。
- 对缺槽位的新语义使用 pending edit，两阶段补齐后再原子替换 active graph。
- 用户明确否定当前策略并要求重做时，识别为 strategy replacement，创建新策略版本而不是局部 semantic edit。
- 策略广场编辑和 AI 量化对话复用同一套 semantic edit 逻辑。
- 保持现有主数据流：`SemanticState -> CanonicalSpec -> compile/publish`。

## 非目标

- 不恢复 checklist 数据流。
- 不在前端实现语义判断。
- 不直接字符串编辑 `latestDraftCode`。
- 不为 MA、RSI、布林带、网格等策略族写专用分支。
- 不绕过现有 canonical spec、静态校验、运行时校验和发布一致性校验。

## 核心架构

在 `CodegenConversationService.continueSession()` 主流程前增加 `ConversationSemanticEditService`。它只负责判断本轮消息是否是语义修改，并把自然语言转换成 semantic edit decision。

输入：

- 当前 session status。
- 当前 active `SemanticState`。
- 当前 `clarificationState`。
- 当前 `latestSpecDesc`。
- 当前 `latestDraftCode` 或最新 published snapshot。
- 用户本轮 message。

输出：

```ts
type SemanticEditDecision =
  | { kind: 'NO_EDIT' }
  | { kind: 'APPLY_TO_SEMANTIC_STATE', patch: SemanticEditPatch }
  | { kind: 'ASK_EDIT_CLARIFICATION', question: string, pendingEdit: PendingSemanticEdit }
  | { kind: 'REGENERATE_SCRIPT_VERSION', patch: SemanticEditPatch }
  | { kind: 'REPLACE_STRATEGY_DRAFT', seedText: string }
  | { kind: 'REJECT_WHILE_PROCESSING', message: string }
```

`NO_EDIT` 时继续走现有对话规划、澄清、确认和生成流程。其他分支由 service 先处理，再回到现有 semantic/canonical/codegen 主流。

## Semantic Edit Patch

Patch 按语义节点表达，不以策略族或旧入场/出场模型表达。

```ts
type SemanticEditPatch = {
  operations: Array<
    | { op: 'replace_context'; field: 'symbol' | 'timeframe' | 'exchange' | 'marketType'; value: string }
    | { op: 'replace_position'; targetRef?: string; text: string }
    | { op: 'replace_trigger'; targetRef?: string; text: string }
    | { op: 'add_trigger'; text: string }
    | { op: 'remove_trigger'; targetRef?: string }
    | { op: 'replace_action'; targetRef?: string; text: string }
    | { op: 'add_action'; text: string }
    | { op: 'remove_action'; targetRef?: string }
    | { op: 'replace_risk'; targetRef?: string; text: string }
    | { op: 'add_risk'; text: string }
    | { op: 'remove_risk'; targetRef?: string }
  >
}
```

示例：

- “我要把交易标的改为 BTCUSDT” -> `replace_context(symbol, BTCUSDT)`。
- “把触发改成 RSI 小于 30” -> `replace_trigger(text: "RSI 小于 30")`。
- “行动改成只提醒，不下单” -> `replace_action(text: "只提醒，不下单")`。
- “去掉止盈，只保留止损” -> `remove_risk(targetRef: takeProfitRisk)`。
- “止损改成跌破 MA20” -> `replace_risk(text: "跌破 MA20 止损")`。

## Pending Edit

替换语义节点时，如果新语义缺槽位，不能马上污染 active graph。系统创建 pending edit，保留旧语义继续作为 active。

```ts
type PendingSemanticEdit = {
  id: string
  op: 'replace_trigger' | 'replace_action' | 'replace_risk' | 'replace_position'
  targetRef?: string
  candidate:
    | SemanticTriggerState
    | SemanticActionState
    | SemanticRiskState
    | SemanticPositionState
  status: 'needs_clarification' | 'ready_to_apply'
  createdFromMessage: string
}
```

流程：

1. 用户提出替换，例如“把触发改成 RSI”。
2. 系统解析 candidate semantic node。
3. candidate 缺槽位时进入 `pendingEdit`，active graph 不变。
4. 系统只追问 candidate 的最高优先级 open slot。
5. 用户补齐后更新 candidate。
6. candidate 完整后原子应用：旧节点标记 `superseded`，新节点进入 active graph。
7. 回到现有 semantic clarification、canonical spec、确认门或脚本生成流程。

用户中途说“算了保持原来”时，丢弃 pending edit，active graph 不变。用户中途改口“不是 RSI，是 MACD 金叉”时，更新 pending candidate，不写入 active graph。

## Strategy Replacement

当用户明确否定当前策略并要求重新做一个新策略时，不能当作局部 semantic edit。它是 strategy replacement intent。

典型表达：

- “之前这个策略不对，重新做一个。”
- “不要这个了，改成网格策略。”
- “刚才方向错了，重新发布一个全新的策略。”
- “这套废掉，做一个 RSI 策略。”

处理规则：

1. 保留旧 session history、旧 active graph、旧 `latestDraftCode` 和旧 published snapshot。
2. 丢弃当前 pending edit。
3. 将旧 active graph 记录为 previous version/reference，不做局部合并。
4. 用用户的新描述作为 `seedText` 创建新的 strategy draft。
5. 新 draft 从空 semantic graph 开始解析 `trigger`、`action`、`risk`、`position`、`context`。
6. 新 draft 按现有 semantic clarification、confirm gate、codegen、publish 流程推进。
7. 新脚本发布成功后，作为同一对话中的新策略版本返回。

如果用户只说“之前不对”“重新来”，但没有提供新策略描述，不能清空当前 active graph。系统应返回澄清：

> 你想重新做一个新策略。请描述新的触发、行动、风控、仓位和运行 context。

如果用户说“不要这个，改成 RSI 策略”，有新 seedText，则进入新 draft；缺少的语义槽位继续按 semantic clarification 补齐。

strategy replacement 与 semantic edit 的边界：

- semantic edit：当前策略大体保留，只修改部分 `context`、`trigger`、`action`、`risk` 或 `position`。
- pending semantic edit：局部修改的新语义缺槽位，先挂起补齐。
- strategy replacement：当前策略整体作废，基于新 seedText 创建新策略版本。

## 状态行为

`DRAFTING` 和 `CONFIRM_GATE`：

- 识别 semantic edit 后，直接作用于 active graph 或 pending edit。
- 识别 strategy replacement 后，创建新 strategy draft，不复用旧 active graph 做合并。
- 完整修改会重新计算 semantic clarification、canonical spec 和确认门。
- 不触发脚本发布。

`GENERATING` 和 `VALIDATING_*`：

- 拒绝并发修改，返回“当前正在生成/校验，请等待完成后再修改”。
- 不创建 pending edit，避免两个版本交叉。

`PUBLISHED`、`REJECTED`、`CONSISTENCY_FAILED`：

- 允许继续发送修改指令。
- 从最新 `specDesc`、`latestDraftCode` 和 published snapshot 中恢复可编辑语义上下文。
- 应用 semantic edit 或 pending edit。
- 如果识别为 strategy replacement，则基于新 seedText 派生全新策略版本，旧 snapshot 保留。
- 补齐后派生新版本，重新走生成、校验和发布流程。
- 原已发布 snapshot 不直接覆盖；只有新版本通过发布门后，才作为修改后的脚本结果返回。

策略广场“编辑”：

- `StrategyPlazaEditSessionService` 继续通过 codegen session 作为入口。
- 模板 seed 需要能还原完整语义上下文。
- 后续自然语言修改复用 `ConversationSemanticEditService`，不在策略广场单独写策略族分支。

## 合并与澄清规则

- `context` 字段修改为明确值时直接覆盖对应 locked slot，并更新 evidence。
- `trigger`、`action`、`risk`、`position` 修改先定位目标节点。
- 如果只有一个同类节点，且用户未指定目标，则默认该节点为替换目标。
- 如果存在多个同类节点，且用户文本无法匹配目标，返回一次目标澄清。
- 新语义缺槽位时进入 pending edit，只追问 candidate 缺失项。
- 新语义完整后再原子替换 active graph。
- 删除语义节点后重新跑 semantic completeness、semantic clarification 和 canonical compileability。
- 阻塞文案必须用语义维度表达，例如：
  - “当前语义图没有可执行触发，请补充至少一个触发语义。”
  - “触发语义已存在，但缺少对应行动，请说明触发后开仓、平仓、减仓还是仅提醒。”
  - “已删除保护退出语义，当前策略缺少必需风控，请补充止损或其他保护条件。”
  - “context 中标的已改为 BTCUSDT，但市场类型仍不明确，请确认现货或永续。”

## 错误处理

- 无法识别为修改意图：返回 `NO_EDIT`，交给现有 planner。
- 修改目标模糊：返回 `ASK_EDIT_CLARIFICATION`，只问目标选择。
- candidate 缺槽位：返回 `ASK_EDIT_CLARIFICATION`，只问 candidate slot。
- pending edit 被取消：丢弃 pending，返回当前 active graph 的确认或澄清状态。
- 用户明确要求重做但没有新策略描述：不清空 active graph，返回 strategy replacement seed 澄清。
- 处理中状态收到修改：返回 `REJECT_WHILE_PROCESSING`。
- 脚本后修改失败：不改变旧 snapshot，返回新版本生成/校验失败原因。

## 测试计划

后端单测覆盖：

- `DRAFTING` 时“我要把交易标的改为 BTCUSDT”覆盖 `context.symbol`。
- `CONFIRM_GATE` 时“周期改成 1h”更新语义图并停留在确认门。
- “把触发改成 RSI 低于 30”在 candidate 完整时原子替换 trigger。
- “把触发改成 RSI”缺槽位时创建 pending edit，active trigger 不变。
- pending edit 补齐后替换 active trigger。
- pending edit 中用户取消时 active graph 不变。
- 多个 trigger/action/risk 时，模糊替换只问目标选择。
- `PUBLISHED` 后“把止损改成 3%”派生新版本并重新走生成/发布路径。
- “之前策略不对，重新做一个 RSI 策略”创建新 strategy draft，不局部合并旧 active graph。
- “之前策略不对，重新来”缺少新描述时只追问新策略 seed，active graph 不变。
- strategy replacement 会丢弃当前 pending edit，但保留旧 snapshot 和历史记录。
- 策略广场 edit session 复用同一 semantic edit 服务。
- 回归用户案例：`ETHUSDT -> BTCUSDT` 不再重复旧 blocker，而是更新 `context.symbol` 或进入语义确认。

前端轻量覆盖：

- 发送自然语言修改后展示后端返回的新确认、澄清或 published 状态。
- 前端不新增语义判断，只透传用户 message 和展示后端状态。

## 成功标准

- 用户可以在确认逻辑图前修改 context、trigger、action、risk、position。
- 用户可以在脚本生成后继续自然语言修改，并得到重新发布的修改版脚本。
- 用户可以明确作废当前策略并在同一对话中发布一个新策略版本。
- 缺槽位的新语义不会污染 active graph。
- 策略广场编辑与 AI 量化对话复用同一语义修改入口。
- 代码中不新增 checklist 主路径，不新增策略族专用修改分支。
