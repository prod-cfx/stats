# AI Quant 已发布脚本刷新恢复设计

- 日期：2026-04-27
- 状态：approved-for-plan
- 主题：点击“确认逻辑图”生成完整脚本后，刷新 AI Quant 页面仍能恢复脚本代码

## 1. 背景

用户在 AI Quant 主页面完成以下流程后：

```text
确认逻辑图 -> 生成脚本 -> 页面出现完整代码块 -> 刷新页面
```

刷新后脚本代码消失。由于刷新前已经看到完整代码块，可以排除“生成中刷新”的主路径问题。当轮前端已经拿到 `PUBLISHED + scriptCode`，问题集中在刷新后的服务端会话恢复投影。

当前恢复链路是：

```text
listAiQuantConversations
-> CodegenConversationService.toConversationResponse()
-> createConversationFromServerConversation()
-> buildServerTerminalCodegenReply()
```

前端只有在服务端 conversation 响应满足 `status === 'PUBLISHED' && scriptCode` 时，才会重新拼出包含脚本代码块的 assistant 消息。如果列表接口返回的 `scriptCode` 为空，刷新后聊天区就无法展示脚本。

## 2. 目标

- 已经完整生成并发布的脚本，刷新页面后仍显示代码块。
- 跨设备、重新登录、重新打开 AI Quant 页面时，也从服务端恢复同一份已发布脚本。
- 恢复真相源使用已发布快照 `PublishedStrategySnapshot.scriptSnapshot`。
- 前端继续消费服务端 conversation 投影，不新增本地脚本持久化分支。
- 保持现有发布快照边界：只有当前 conversation 仍绑定已发布 snapshot 时，脚本才代表当前版本。

## 3. 非目标

- 不处理“生成中刷新后继续轮询到完成”的体验优化。
- 不新增按 `publishedSnapshotId` 单独拉脚本的接口。
- 不把脚本代码写入 localStorage 作为正式恢复源。
- 不改变回测结果恢复、部署、策略广场编辑会话恢复规则。
- 不从脚本文本反推语义、逻辑图或 canonical spec。

## 4. 方案

采用“后端列表恢复以 published snapshot 为真相源”的方案。

`CodegenConversationService.toSessionSnapshotResponse()` 在会话状态为 `PUBLISHED` 时，应稳定返回 `scriptCode`：

1. 优先使用 session 的 `latestDraftCode`，兼容当前生成完成后立即返回的路径。
2. 如果 `latestDraftCode` 为空，则使用最新 published snapshot 的 `scriptSnapshot`。
3. 只有当 session 非 `PUBLISHED`，或找不到与当前 published snapshot 对应的脚本时，才返回 `scriptCode: null`。

`toConversationResponse()` 继续复用 `toSessionSnapshotResponse()` 的结果，不单独拼脚本。这样 `/llm-strategy-codegen/sessions/:id` 与 `/account/ai-quant/conversations` 的恢复语义保持一致。

## 5. 数据流

生成阶段：

```text
用户确认逻辑图
-> continueSession(confirmGenerate=true)
-> publication pipeline 持久化 PublishedStrategySnapshot.scriptSnapshot
-> session 更新为 PUBLISHED
-> 当轮响应带回 scriptCode
-> 前端展示完整代码块
```

刷新恢复阶段：

```text
页面刷新
-> listAiQuantConversations
-> conversation 绑定 codegenSessionId
-> toSessionSnapshotResponse(session)
-> findLatestBySessionId(session.id)
-> 使用 snapshot.scriptSnapshot 兜底 scriptCode
-> 前端 createConversationFromServerConversation()
-> buildServerTerminalCodegenReply() 重建代码块
```

## 6. 边界与错误处理

- `PUBLISHED` 会话存在 `latestDraftCode`：直接返回该脚本。
- `PUBLISHED` 会话缺少 `latestDraftCode`，但 latest snapshot 有 `scriptSnapshot`：返回 snapshot 脚本。
- `PUBLISHED` 会话缺少 latest snapshot 或 snapshot 脚本为空：返回 `scriptCode: null`，前端不伪造代码块。
- 非 `PUBLISHED` 状态：不从 snapshot 兜底当前脚本，避免把历史发布版本误展示为当前草稿。
- `publishedSnapshotId` 仍由服务端根据 latest snapshot 或 session spec metadata 决定，前端不自行猜测。

## 7. 测试计划

后端测试：

- `toSessionSnapshotResponse()` 或等价服务测试覆盖：`PUBLISHED + latestDraftCode` 返回 session 脚本。
- 覆盖：`PUBLISHED + latestDraftCode 为空 + latest snapshot.scriptSnapshot 存在` 返回 snapshot 脚本。
- 覆盖：`PUBLISHED + latestDraftCode 为空 + snapshot 缺失或脚本为空` 返回 `scriptCode: null`。
- 覆盖 conversation 列表恢复：`listConversations()` 返回的 conversation response 包含 `scriptCode`、`publishedSnapshotId`、`specDesc`、`semanticGraph`。

前端测试：

- `createConversationFromServerConversation()` 接收 `PUBLISHED + scriptCode` 时，恢复后的 messages 包含脚本代码块。
- 恢复后的 `publishedScriptCode` 等于服务端 `scriptCode`。
- 恢复后的 `publishedScriptGraphVersion` 等于已确认逻辑图版本。
- `scriptCode: null` 时不伪造代码块，避免把不可恢复脚本误当作当前可回测版本。

## 8. 成功标准

- 用户已看到完整脚本代码块后刷新，代码块仍然存在。
- “开始回测”继续基于同一 `publishedSnapshotId` 和已发布脚本判断可用性。
- 跨设备恢复不依赖 localStorage。
- 修复不新增脚本本地缓存、不新增独立脚本拉取接口、不破坏发布快照作为真相源的架构。
