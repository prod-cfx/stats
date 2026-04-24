# AI Quant 回测结果跨刷新恢复连续性设计

- 日期：2026-04-23
- 状态：draft-for-review
- 主题：让 AI Quant 主页面在刷新、返回详情页、换设备重新登录后恢复最近一次可继续发布的回测摘要，同时继续以 `publishedSnapshotId` 维护回测与发布一致性

## 1. 背景

当前 AI Quant 已经具备两条不同的数据路径：

- 回测 job 与完整结果在服务端持久化；
- 回测详情页通过 `jobId` 拉取真实结果并展示；
- AI Quant 主页面的回测摘要卡仍主要依赖 `ConversationState.backtestResult`；
- 主页面会话恢复依赖 `listAiQuantConversations -> createConversationFromServerConversation(...)`。

现状问题不是“回测结果没有持久化”，而是“主页面恢复源没有回测引用”：

- 用户完成回测后，能进入详情页查看；
- 但刷新 AI Quant 页面、从详情页返回、或换设备重新登录后，主页面恢复出的 conversation 没有最近一次回测摘要；
- 用户因此无法直接继续发布流程，经常被迫重新做一次回测。

这与当前主业务链路不一致。用户的真实目标是完成一条正式链路：

`已发布快照 -> 回测 -> 查看详情 -> 返回 -> 发布`

而不是在单设备内存态里临时浏览一轮结果。

## 2. 当前代码与约束

### 2.1 已确认的主数据流边界

当前代码方向已经明确把 `publishedSnapshotId` 作为策略与回测真相边界：

- 回测请求要求携带 `publishedSnapshotId`；
- 回测执行按 `publishedSnapshotId` 加载已发布快照；
- 前端一旦检测到策略关键参数变化，会失效发布态并清除旧 `backtestResult`；
- 详情页继续通过 `jobId` 读取真实回测结果。

这条边界必须保留，不能退回到“conversation 自己代表策略真相”。

### 2.2 当前不应改变的语义

以下语义继续成立：

- conversation 可以持续演化，不是策略真相键；
- 如果当前会话已经偏离原先完成回测时绑定的快照，旧回测结果必须失效，不得继续用于发布；
- 完整回测报告仍由 backtesting job/result 体系承载，不复制进 conversation。

## 3. 目标

### 3.1 目标行为

本次方案要实现：

1. 用户回测成功后，刷新 AI Quant 页面仍可看到最近一次回测摘要。
2. 用户进入详情页再返回 AI Quant 页面，无需重新回测即可继续发布。
3. 用户换设备或重新登录后，只要会话当前仍绑定同一 `publishedSnapshotId`，仍能恢复最近一次回测摘要与详情入口。
4. 若当前会话已发生策略漂移，旧回测结果不再展示，用户必须重新发布并重新回测。

### 3.2 非目标

本次不处理：

- 保存回测历史列表；
- 在 conversation 中保存完整回测报告；
- 改变详情页仍按 `jobId` 读取真实结果的设计；
- 允许已漂移会话继续沿用旧回测结果发布；
- 把恢复能力降级为仅同设备 localStorage 可用。

## 4. 关键设计决策

### 4.1 恢复入口与真相键分离

最终设计采用以下约束：

- `conversation` 负责承载“恢复入口”；
- `publishedSnapshotId` 负责定义“最近一次回测结果是否仍然有效并可展示”。

也就是说：

- conversation 用来告诉前端“这个会话最近一次成功回测是谁”；
- 但前端是否恢复该回测摘要，只看它绑定的 `publishedSnapshotId` 是否与当前 conversation 一致。

### 4.2 不以 `conversation` 作为回测真相键

不采用“按 conversation 直接恢复最近回测并默认展示”的原因：

- 同一 conversation 会持续被修改；
- 用户继续聊天、修参数、重新生成逻辑图后，conversation 表示的内容可能已经漂移；
- 若只按 conversation 恢复，会把旧回测错误地展示为当前可继续发布的结果。

### 4.3 不以 `strategyInstanceId` 作为回测真相键

不采用“按 `strategyInstanceId` 绑定最近回测”的原因：

- 一个策略实例可能关联多次重新发布；
- `strategyInstanceId` 粒度太粗，无法表达“这次回测对应哪一个已发布快照版本”；
- 会削弱当前系统已经建立的 snapshot-bound 语义。

## 5. 数据模型设计

### 5.1 Conversation 视图新增轻量回测引用

conversation 响应新增一个轻量字段，例如：

```ts
lastBacktestRef: {
  jobId: string
  publishedSnapshotId: string
  summary: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
    openTradeCount?: number
    openPnl?: number
    marketType?: 'spot' | 'perp'
  }
  completedAt: string
} | null
```

这个字段的职责是：

- 作为 AI Quant 主页面恢复摘要卡的数据来源；
- 作为“查看详情”入口的 `jobId` 提供者；
- 不承载完整 report；
- 不替代 backtesting job/result 的真实结果存储。

### 5.2 不复制完整回测报告

conversation 仅持有“最近一次回测引用 + 轻量摘要”，不保存：

- `equityCurve`
- `trades`
- 完整 open positions 明细
- 任何足以替代详情页的完整报告字段

原因：

- 完整报告已经由 backtesting job/result 承担；
- 保持 conversation 作为视图投影，而不是再次变成结果主表；
- 避免会话对象继续膨胀和重复存储。

## 6. 写入时机与后端责任

### 6.1 由 quantify 负责写入 `lastBacktestRef`

`lastBacktestRef` 不由前端写入，也不建议由 backend proxy 在透传层临时拼装，而是由 `quantify` 在回测结果确定后负责更新 conversation 视图。

原因：

- `quantify` 同时掌握 `jobId`、回测摘要、`publishedSnapshotId`、用户身份以及回测与 conversation 的关联；
- 这里是唯一既知道“回测完成”，又知道“这次回测绑定哪份快照”的一层；
- 能避免前端 patch 会话导致的跨设备恢复失真。

### 6.2 更新条件

仅在以下条件满足时更新 `lastBacktestRef`：

- 回测任务终态成功；
- 有合法、可展示的摘要；
- 有合法 `publishedSnapshotId`；
- 能确认其归属到当前用户的 AI Quant conversation。

不满足上述条件时，不更新 `lastBacktestRef`。

### 6.3 覆盖规则

同一 conversation 下：

- 如果后续又产生新的成功回测，则覆盖旧的 `lastBacktestRef`；
- 这里只维护“最近一次成功回测引用”，不维护历史列表。

## 7. 前端恢复与展示流程

### 7.1 页面加载

AI Quant 页面加载时：

1. 前端通过 `listAiQuantConversations` 拉取服务端 conversation 视图；
2. `createConversationFromServerConversation(...)` 读取 `lastBacktestRef`；
3. 执行 snapshot 一致性判断：
   - 若 `conversation.publishedSnapshotId === lastBacktestRef.publishedSnapshotId`，恢复摘要卡与详情入口；
   - 若不一致，则不恢复 `backtestResult`。

### 7.2 恢复后的页面语义

恢复成功时，主页面仅恢复：

- 摘要卡展示数据；
- 指向详情页的 `jobId`；
- 当前回测结果可用于继续发布的前端判断前提。

主页面仍不直接承担详情页的数据职责。

### 7.3 返回详情页与刷新

由于恢复源已经在服务端 conversation 视图中：

- 用户进入详情页再返回，无需重新回测；
- 页面刷新后仍恢复；
- 换设备、重新登录后仍恢复；
- 不再依赖 localStorage 临时态作为正式产品能力。

## 8. 漂移与失效规则

### 8.1 会话未漂移

若当前 conversation 仍绑定原始回测对应的 `publishedSnapshotId`，则：

- 可以恢复最近回测摘要；
- 可以保留详情入口；
- 可以继续走发布链路。

### 8.2 会话已漂移

若当前 conversation 已不再绑定原始回测对应的 `publishedSnapshotId`，则：

- 不恢复旧回测摘要；
- 不展示旧回测作为当前可发布依据；
- 用户必须重新发布当前策略版本，并重新回测。

### 8.3 不删除真实回测审计数据

会话漂移只影响“当前 UI 是否展示回测引用”，不删除：

- backtesting job
- backtesting result
- 已存在的回测详情可追溯数据

删除与隐藏分离，避免为了 UI 失效而破坏审计链路。

## 9. 失败态与边界情况

- 回测失败：不更新 `lastBacktestRef`
- 回测超时：不更新 `lastBacktestRef`
- 回测结果缺失：不更新 `lastBacktestRef`
- 回测成功但 `publishedSnapshotId` 缺失或非法：不更新 `lastBacktestRef`
- 同一 conversation 多次成功回测同一 `publishedSnapshotId`：保留最新一次
- conversation 当前重新发布出新的 `publishedSnapshotId`：旧 `lastBacktestRef` 可以保留在服务端，但前端 hydration 时因 snapshot mismatch 不展示
- conversation 被删除：其 `lastBacktestRef` 随 conversation 视图一起不可见，但不删除真实回测 job/result

## 10. 改动范围建议

### 10.1 Quantify

主要改动方向：

- conversation DTO 增加 `lastBacktestRef`
- conversation response mapper 增加该投影字段
- 在回测终态成功后，把结果摘要写回 conversation 最近回测引用
- 增加回测与 conversation 关联所需的最小投影/查询能力

### 10.2 Backend Proxy

主要改动方向：

- proxy DTO 同步增加 `lastBacktestRef`
- conversation 列表透传该字段

### 10.3 Front

主要改动方向：

- API 类型增加 `lastBacktestRef`
- `createConversationFromServerConversation(...)` 接入恢复逻辑
- 仅在 snapshot 一致时将 `lastBacktestRef` 投影为 `ConversationState.backtestResult`
- 现有失效逻辑保持不变，不额外放宽旧回测展示

## 11. 验收标准

1. 用户完成一次成功回测后，刷新 AI Quant 页面，回测摘要仍在，且可进入详情页。
2. 用户进入回测详情页再返回 AI Quant 页面，回测摘要仍在，不需要重新回测。
3. 用户退出登录后重新登录，或换设备登录，同一 conversation 仍能恢复最近一次回测摘要。
4. 只有当 conversation 当前 `publishedSnapshotId` 与 `lastBacktestRef.publishedSnapshotId` 一致时，才展示回测摘要。
5. 用户修改策略导致当前会话失效发布态后，旧回测摘要立即隐藏，必须重新发布并重新回测。
6. 回测失败、超时、无结果等情况，不得污染 `lastBacktestRef`。
7. 详情页继续通过 `jobId` 拉取真实结果，主页面不复制完整报告。

## 12. 测试建议

### 12.1 Quantify

至少覆盖：

- 成功回测写入 `lastBacktestRef`
- 失败/超时/无结果不写入
- 多次成功回测时覆盖为最近一次
- 写入的 `publishedSnapshotId` 与回测实际绑定一致

### 12.2 Backend Proxy / 合约

至少覆盖：

- conversation DTO 新字段透传正确
- OpenAPI / contract 更新后前端类型可消费

### 12.3 Front

至少覆盖：

- `createConversationFromServerConversation(...)` 在 snapshot 一致时恢复摘要
- snapshot 不一致时不恢复摘要
- AI Quant 页面刷新恢复行为
- 详情页返回后仍可继续显示摘要

## 13. 风险与权衡

### 风险 1：conversation 与回测关联补点不清晰

如果当前回测完成链路里缺少稳定的 conversation 归属信息，需要在 quantify 中补一层最小关联，不能由前端猜测。

### 风险 2：把 conversation 误做成结果主表

若后续继续向 `lastBacktestRef` 中塞完整报告，会再次模糊“conversation 视图”和“backtest 真实结果”的边界。本设计明确禁止这样扩张。

### 风险 3：恢复逻辑与现有失效逻辑冲突

前端实现时必须保持当前失效语义不变：

- 允许恢复“同快照最近回测”
- 不允许恢复“已漂移快照的旧回测”

## 14. 最终结论

本次问题的正确修复方向不是“把旧回测结果无条件留在前端”，而是：

- 把最近一次回测恢复能力提升为服务端正式能力；
- 由 conversation 提供恢复入口；
- 由 `publishedSnapshotId` 约束恢复结果是否仍与当前会话一致；
- 在保证跨刷新、跨设备恢复体验的同时，继续守住 AI Quant 当前的 snapshot-bound 回测/发布语义。
