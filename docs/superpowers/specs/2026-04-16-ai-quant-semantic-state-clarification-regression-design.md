# AI Quant Semantic-State Clarification Regression Design

日期：2026-04-16

状态：设计已确认，待实现规划

## 1. 背景

`#794` 已经建立了 AI Quant clarification 的一个关键行为：

- 当会话里存在 open semantic slot 时，clarification 必须优先围绕该 slot 继续追问
- 只有当 semantic slot 全部闭合后，execution context 或 generic checklist blocker 才允许成为当前问题

在 `#800` 将 `semanticState` 提升为会话 authoritative state 之后，当前 clarification 主链在部分既有案例上未能继续保持 `#794` 已确立的 open-semantic-slot-first 行为。

本次确认的回归基线是：

`当价格突破一条长期均线时买入，跌破短期均线时卖出`

在 `#794` 对应版本中，该输入会继续追问均线周期；在最新代码中，不再继续追问“长期均线是多少？”，而是退化为 execution-context-first 或 generic fallback。

这说明问题不在于 `minimum executable contract` 从未支持此类语义，也不在于 `#794` 从未定义 slot-first clarification，而在于 `#800` 之后的 semantic-state session 主线没有继续保住这些既有 open semantic slots 的保留、投影和主导追问能力。

## 2. 目标

本次设计只解决一个问题：修复 `#800` 引入的 semantic-state clarification 回归。

具体目标：

1. 恢复 `#800` 前已能落成 open semantic slot 的既有案例，在最新主线中继续落成 slot。
2. 恢复这些 slot 在 session 生命周期中的保留、投影和当前问题主导权。
3. 恢复 `#794` 已定义的 slot-first clarification 行为。
4. 保证 semantic slot 未闭合时，不会被 execution context 或 generic checklist fallback 抢走当前追问。
5. 通过后端回归测试把上述行为固定下来，防止再次回退。

## 3. 非目标

- 不新增主数据流。
- 不新增独立于现有链路之外的 promotion / ranking / routing 层。
- 不重写 `#794` 已存在的 priority 规则。
- 不重新定义或扩展 `minimum executable contract` 作为本次主方向。
- 不把“顺势 + 过滤震荡 + 不要太频繁”纳入本次回归验收。
- 不把本次回归修复扩展成新的 semantic coverage 项目。

## 4. 问题定义

本次需要修复的不是“semanticState-first”这个方向本身，而是它在接管会话 authoritative state 后，对既有 open semantic slot 的承接出现了回归。

更准确地说，本次修复聚焦于：

- 既有 open semantic slot 没有继续进入 `semanticState`
- 已进入的 slot 在 merge / projection / normalization 过程中被削弱或丢失
- slot 虽然仍存在，但在 clarification composition 中没有继续主导当前问题

因此，本次修复不是能力扩展，而是状态承接回归修复。

## 5. 范围边界

### 5.1 保持不变的主链

本次不改变现有主链：

`semanticState -> normalizedIntent / unresolvedSlots -> open semantic slots -> #794 clarification priority`

也就是说：

- `minimum executable contract` 继续决定语义原子是 `closed` 还是 `open`
- `#794` 的 ambiguity / clarification priority 继续作为既有行为存在
- `semanticState` 继续作为 `#800` 之后的 session authoritative state

### 5.2 允许修改的现有环节

本次修改范围只限于现有链路中的状态承接和主导权恢复，优先检查并修复：

- [codegen-conversation.service.ts](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts) 的 `buildFallbackSemanticState`
- 同文件的 `mergeChecklistIntoSemanticState`
- 同文件的 `projectLegacyChecklistFromSemanticState`
- 同文件的 `buildNormalizationFromSemanticState`
- 同文件的 `mergeSemanticClarificationState`
- 同文件的 `buildSemanticClarificationPrompt`
- 同文件的 `findNextOpenSemanticSlot`

### 5.3 不允许采用的方案

- 不新增 “semantic slot promotion layer”
- 不新增 “semantic slot priority selection layer”
- 不在 clarification fallback 阶段临时把 legacy blocker 伪装成另一套语义层
- 不通过关键词补丁把单个案例硬编码修通

## 6. 设计方案

本次修复拆成两个窄单元，均作用于现有代码路径。

### 6.1 单元一：semanticState 构建与合并回归修复

目标：

- 恢复 `#800` 前已有案例能落成的 open slot
- 不让它们在 session authoritative state 中消失、降级或被弱化

关注点：

1. `buildFallbackSemanticState`
   确认它是否仍完整承接当时可识别的 unresolved semantics。

2. `mergeChecklistIntoSemanticState`
   确认后续轮次合并 message-derived checklist 时，是否用更弱的派生结果覆盖了已有 slot。

3. `projectLegacyChecklistFromSemanticState`
   确认 semantic truth 投回 checklist 时，是否把仍然 open 的语义线索投影掉了，导致后续判断只剩 generic fallback。

4. `buildNormalizationFromSemanticState`
   确认 semanticState 中已存在的 open slot，不会在重新归一化时被错误视为 generic blocker 或不可表达缺口。

这部分修复的是：slot 能不能活下来。

### 6.2 单元二：semanticState 到 clarification 的主导权修复

目标：

- 只要 session 里还存在 open semantic slot，就继续由 slot 驱动当前追问
- execution context / generic checklist fallback 只能在 semantic slot 清空后重新顶上来

关注点：

1. `mergeSemanticClarificationState`
   确认 semantic pending item 不会被 fallback item 顶掉。

2. `findNextOpenSemanticSlot`
   确认它继续遵守 `#794` 已定义的 slot-first 行为。

3. `buildSemanticClarificationPrompt`
   确认 prompt 与 semantic slot 的当前问题保持一致。

4. clarification composition 整体行为
   确认当 semantic slot 与 context slot 同时存在时，系统仍先问 semantic slot。

这部分修复的是：slot 活着时能不能继续主导当前问题。

## 7. 回归基线与验收

### 7.1 本次唯一硬回归基线

后端回归测试固定使用：

`当价格突破一条长期均线时买入，跌破短期均线时卖出`

之所以选它，是因为：

- 该案例在 `#794` 对应版本中已实际表现为 slot-first clarification
- 最新代码已发生回退
- 它能准确验证 slot 的生成、存活、推进与主导权

### 7.2 必须恢复的行为

该用例至少要恢复如下行为：

1. `startSession` 后进入 semantic slot clarification，而不是 execution-context-first。
2. 首问为“长期均线是多少？”而不是交易所、标的、市场类型或周期。
3. 当用户回答 `MA50` 后，系统推进到下一个未闭合 slot，而不是重复同一个问题。
4. 后续继续追问短期均线周期或相关确认方式，而不是退回 generic fallback。
5. 只有 semantic slot 全部闭合后，execution context 才允许顶上来。

## 8. 非回归样例处理

`顺势 + 过滤震荡 + 不要太频繁`

当前已确认：

- `#794` 对应版本不会继续追问
- 最新代码同样不会继续追问

因此该样例不属于本次 regression baseline。

在本次 spec 中，它只作为后续 semantic coverage 扩展样例记录，不作为本次修复通过条件，也不用于扩大当前实现范围。

## 9. 错误处理原则

本次修复后的服务层必须满足以下 fail-closed 约束：

1. 如果 `semanticState` 中仍存在 open slot，而当前返回给前端的首问却是 execution context 或 generic checklist blocker，则视为无效状态，必须在服务层重排回 semantic slot 主链。

2. 如果 `projectLegacyChecklistFromSemanticState` 的投影结果比当前 semantic truth 更弱，不允许该投影反过来抹掉已有 slot。

3. 如果 `mergeChecklistIntoSemanticState` 在合并新消息时得到更弱的派生结构，不允许覆盖已有更具体的 open slot。

4. 只有在 semantic slot 已全部闭合时，execution context / generic checklist fallback 才允许重新成为当前 blocker。

## 10. 测试计划

### 10.1 后端回归测试

新增基于 `CodegenConversationService` 的 regression test，固定验证均线案例。

测试断言至少包括：

- `startSession` 首问进入 semantic slot clarification
- assistant prompt 包含“长期均线是多少？”
- assistant prompt 不包含“请确认交易所”
- 继续回答 `MA50` 后，不会再次重复“长期均线是多少？”
- 后续问题继续推进到下一个未闭合 semantic slot

### 10.2 生命周期测试

补充覆盖以下路径：

1. slot 生成：
   `buildFallbackSemanticState` 产出预期 open slot

2. slot 持久化：
   session 保存后再次读取，slot 不丢

3. slot 合并：
   `mergeChecklistIntoSemanticState` 后 slot 仍存在且不被弱化

4. slot 投影：
   `projectLegacyChecklistFromSemanticState` 不会把语义真相投影没了

5. slot 主导 clarification：
   `mergeSemanticClarificationState` / `buildSemanticClarificationPrompt` 仍由 semantic slot 决定当前问题

### 10.3 反向保护测试

补充一个保护场景：

- 当 semantic slot 已闭合时，execution context 能正常接管追问

这样可以防止修复后变成“永远问不到上下文”。

## 11. 风险与约束

### 11.1 主要风险

- 误把回归修复扩大成 semantic coverage 扩展，导致实现范围失控
- 只修 prompt，未修 state merge / projection，回归仍会在下一轮消息中重新出现
- 只修单个函数，未固定 session 生命周期测试，后续再次回退

### 11.2 控制策略

- 以 `#794` 已有效行为作为唯一回归基线
- 先修状态承接，再修 clarification 主导权
- 先补后端回归测试，再进入实现规划

## 12. 结论

本次不是新的 semantic architecture 设计，而是一次严格受限的 regression fix：

- 修复 `#800` 之后 `semanticState` 对既有 open semantic slot 的承接回退
- 恢复 `#794` 已建立的 slot-first clarification 行为
- 用均线案例做后端回归基线锁死行为
- 不把未实现能力样例混入本次验收

## 13. Implementation Notes

- Regression baseline command:
  `dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "asks the MA semantic slot before execution context on startSession for the historical MA baseline|keeps the next semantic slot active after locking MA50 instead of falling through to execution context"`
- Observed result: `PASS`, `2 passed / 0 failed`
- Regression baseline locked by backend tests in
  `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Clarification ownership ordering locked by
  `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
