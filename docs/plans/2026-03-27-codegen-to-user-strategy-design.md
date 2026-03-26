# LLM 对话生成策略到用户策略列表闭环设计

日期：2026-03-27

## 1. 背景与问题

当前 `llm-strategy-codegen` 会话在脚本生成与校验通过后，会将状态置为 `PUBLISHED`，并保存脚本与结构化描述；但不会自动创建可被用户策略列表消费的 `strategyInstance`。结果是“生成成功”与“用户策略可见/可部署”断链。

目标：在不破坏现有用户路径的前提下，完成从 `PUBLISHED` 到用户策略列表可见的闭环。

## 2. 目标与非目标

### 2.1 目标

- 会话进入 `PUBLISHED` 后，自动创建一条用户所属的 `strategyInstance`（`draft`），并可出现在用户策略列表。
- `CodegenSessionResponseDto` 返回 `strategyInstanceId`，前后端可稳定消费。
- 保障幂等：同一 `(userId, sessionId)` 只创建一个实例。
- 保持现有 API 向后兼容。

### 2.2 非目标

- 不新增异步任务系统。
- 不改造部署主流程为“必须依赖 sessionId”。
- 不引入额外跨服务编排。

## 3. 方案选型

- 方案 A（采用）：发布即自动创建并回写 `strategyInstanceId`。
- 方案 B（不采用）：部署时再创建/绑定，不能满足“发布后进列表”。
- 方案 C（不采用）：异步任务补偿，复杂度过高，当前 YAGNI。

## 4. 总体设计

### 4.1 关键流程

1. `runGenerationPipeline` 校验通过后，先生成 `specDesc` 与版本记录。
2. 调用仓储现有能力 `createDraftStrategyInstanceFromPublishedSession(...)` 创建模板与实例。
3. 将 `strategyInstanceId` 回写到会话。
4. 会话状态置为 `PUBLISHED`，响应携带 `strategyInstanceId`。

### 4.2 复用与改动边界

- 复用：`CodegenSessionsRepository.createDraftStrategyInstanceFromPublishedSession`。
- 改动：
  - `LlmStrategyCodegenSession` schema 增加 `strategyInstanceId`（nullable）。
  - `CodegenConversationService` 发布分支接入创建并回写。
  - `toSessionSnapshotResponse` 补出参字段。
  - 前端类型与消费路径确保透传 `strategyInstanceId`。

## 5. 数据模型与契约

### 5.1 Prisma

在 `LlmStrategyCodegenSession` 增加字段：

- `strategyInstanceId String? @map("strategy_instance_id")`

可选关系（如需要）：

- 关联 `strategyInstance`（`onDelete: SetNull`）

说明：可先只做字符串字段，保证最小改动和低迁移风险。

### 5.2 API

`CodegenSessionResponseDto` 已声明 `strategyInstanceId?: string | null`，需要保证服务层真实填充。

## 6. 幂等与并发设计

### 6.1 幂等规则

- 幂等键：`(userId, sessionId)`。
- 同一会话至多绑定一个 `strategyInstanceId`。

### 6.2 并发控制

- 继续沿用会话状态机与 `tryMarkGenerating`，控制主生成链路单执行。
- 创建实例前先读取会话：
  - 已有 `strategyInstanceId`：直接复用。
  - 无值：执行创建并回写。
- 回写使用条件更新（`id + strategyInstanceId is null`）避免并发双写。

## 7. 错误处理与兼容性

### 7.1 错误语义

- 生成/校验失败：保持现有 `REJECTED`。
- 生成成功但实例创建失败：
  - 会话状态保持 `PUBLISHED`；
  - `strategyInstanceId = null`；
  - `rejectReason` 写明失败原因（用于可观测与重试）。

### 7.2 兼容性

- 旧客户端不消费 `strategyInstanceId` 仍可正常工作。
- 新客户端可用 `strategyInstanceId` 直接进入部署复用分支。
- Never break userspace：不删除、不重命名现有字段/接口行为。

## 8. 测试策略（需求驱动）

### 8.1 Happy path

- 发布后自动创建实例并返回 `strategyInstanceId`。
- 该实例可在用户策略列表中可见。

### 8.2 Edge cases

- 同一会话重复查询/重复继续，不重复创建。
- 并发触发发布只创建一次。

### 8.3 Error handling

- 创建实例失败时仍可返回 `PUBLISHED`，且错误可观测。

### 8.4 State transitions

- `GENERATING -> VALIDATING_* -> PUBLISHED` 转移保持不变。
- 新增“发布后绑定实例”的内部子步骤，不引入新对外状态。

## 9. 交付清单

- `apps/quantify/prisma/schema/llm_strategies.prisma`
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`（必要时补幂等辅助方法）
- `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`（若仅实现层补齐，可不改）
- `apps/front/src/lib/api.ts`、`apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`（消费透传）
- 对应单测与 E2E 增补

## 10. 风险与回滚

- 风险：并发条件下重复创建实例。
  - 缓解：条件更新 + 幂等读取。
- 风险：历史会话无 `strategyInstanceId`。
  - 缓解：字段可空，按旧行为兼容。
- 回滚：若异常，移除发布后自动创建调用，保留会话发布主流程。

## 11. 结论

采用“发布即自动创建并回写实例 ID”的最小增量方案，复用现有仓储能力，满足业务闭环目标，同时保持向后兼容与低复杂度。
