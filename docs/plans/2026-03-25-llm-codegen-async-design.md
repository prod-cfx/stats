# LLM 策略代码生成异步化设计（2026-03-25）

## 1. 背景与问题
当前 `POST /api/v1/llm-strategy-codegen/sessions/:id/messages` 为长请求（可达 90s+）。
在前端 dev 代理链路中出现 `socket hang up`，导致前端报 `LLM 策略生成请求失败 (HTTP 500)`，但后端日志显示同会话随后已 `PUBLISHED`。

目标：将“提交生成请求”和“读取生成结果”解耦，避免代理超时导致的假失败与重复触发。

## 2. 需求与成功标准

### 2.1 功能需求
- `POST /sessions/:id/messages` 不再等待脚本生成完成，改为立即返回。
- 生成结果只通过 `GET /sessions/:id` 查询。
- 同会话生成处理中重复 POST 不重复开新任务（幂等）。

### 2.2 非功能需求
- 前端不再因长请求超时显示误报 500。
- 生成状态迁移可观测、可恢复。
- 兼容现有会话与权限校验。

### 2.3 验收标准
- 长耗时场景下，前端不会因为 POST 超时直接失败；可通过轮询最终拿到 `PUBLISHED/REJECTED`。
- 同一会话多次点击确认不会产生并发多任务。
- 日志可追踪一次生成请求的状态演进。

## 3. 方案对比

### 方案 A（推荐）：完全异步提交 + 轮询查询
- POST 返回 `202 Accepted`，body 仅含会话状态。
- 后台异步执行生成流程并落状态。
- 前端统一轮询 GET。
- 优点：彻底规避长请求代理超时；职责清晰。
- 缺点：需要调整控制器与前端调用语义。

### 方案 B：保持同步 POST，仅延长代理超时
- 优点：改动小。
- 缺点：脆弱，跨环境不稳定；无法根治假失败与重复点击。

### 方案 C：双模式（sync/async 开关）
- 优点：渐进切换。
- 缺点：复杂度高，维护两套语义。

结论：采用方案 A。

## 4. 目标架构

### 4.1 接口契约
- `POST /api/v1/llm-strategy-codegen/sessions/:id/messages`
  - 行为：参数校验、会话校验、幂等判断、投递后台任务。
  - 返回：`202`，`{ id, status, missingFields }`。
  - 不返回最终 `scriptCode`。

- `GET /api/v1/llm-strategy-codegen/sessions/:id`
  - 成为唯一结果读取接口。
  - 处理中返回当前状态与可选 `latestDraftCode`。
  - 终态返回 `scriptCode/specDesc` 或 `rejectReason`。

### 4.2 后台执行
- 将现有 `continueSession` 长流程拆分为后台任务函数。
- POST 仅启动任务并返回。
- 任务内推进状态：
  - `GENERATING -> VALIDATING_STATIC -> VALIDATING_RUNTIME -> VALIDATING_OUTPUT -> (PUBLISHED | REJECTED)`

### 4.3 幂等与并发
- 会话状态在 `GENERATING/VALIDATING_*` 时，重复 POST 直接返回处理中状态。
- 禁止同 session 同时进入多条生成流水。

## 5. 前端交互设计

### 5.1 提交流程
- 点击“确认生成”后发送 POST，期望 `202`。
- 进入 GET 轮询（建议 1.5~2s）。

### 5.2 轮询退出
- `PUBLISHED`：展示代码，结束。
- `REJECTED`：展示拒绝原因，结束。
- 页面离开/会话切换：取消轮询。

### 5.3 超时策略
- 轮询上限建议 180s。
- 超时后提示“仍在生成，可稍后恢复”，保留 `sessionId`。

## 6. 错误处理
- POST 异常时，若有 `sessionId`，先 GET 会话状态再决定是否报错。
- GET 连续失败达到阈值后暂停轮询并提示网络问题。

## 7. 可观测性
- 统一记录：sessionId、requestId、状态迁移时间点、总耗时。
- 对 `REJECTED` 记录简化 `rejectReason` 与阶段。

## 8. 风险与缓解
- 风险：后台任务异常导致会话卡处理中。
  - 缓解：增加处理中超时回收（例如 10 分钟后转 REJECTED 并写 reason）。
- 风险：前端多入口触发生成。
  - 缓解：按钮禁用 + 后端幂等双保险。

## 9. 实施边界（YAGNI）
- 本次不引入外部队列系统（先同进程异步任务）。
- 本次不改策略算法逻辑，仅改任务编排与交互契约。

## 10. 发布与回滚
- 发布顺序：先后端支持 `202 + GET 轮询语义`，再前端切换。
- 回滚：后端可短期兼容旧响应字段，前端保留 `GET` 恢复兜底。
