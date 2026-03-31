# AI 量化整链路（Staging）稳定性设计

## 背景
当前 `https://cfx-www-staging.devbase.cloud/zh/ai-quant` 在策略对话过程中仍出现：
- `LLM 策略生成请求失败 (HTTP 502)`
- `aiQuant.messages.backtestCapabilityLoadFailed`

已确认前置事实：
- staging 已部署到分支 `codex/fix/594-ai-quant-shared-resolve-fallback` 最新提交。
- 本次目标为“双验收”：前端手工可跑通 + API 脚本可跑通。
- 约束：仅改 `front + quantify` 代码，不改 CI/部署脚本；如需 staging 配置变更需明确列出。

## 目标
在不修改部署脚本的前提下，打通并稳定以下完整链路：

1. 会话创建
2. 策略生成
3. 回测能力加载
4. 回测执行
5. 部署执行

并保证失败时提供可定位错误（code/stage/trace），避免只暴露泛化 `HTTP 502`。

## 非目标
- 不重构整体部署架构。
- 不引入与当前问题无关的大规模重构。
- 不修改 `main/master` 流程外的研发规范。

## 设计总览
采用“分段稳态化”方案：将 AI 量化链路拆成 5 段，每段实现三件事：
- 可降级：依赖异常不直接炸穿链路。
- 可观测：日志含最小定位字段。
- 可判定：前端可按阶段显示明确错误。

### 分段边界
- `capability`：`GET /backtesting/capabilities`
- `codegen`：`POST /llm-strategy-codegen/sessions`、`POST /llm-strategy-codegen/sessions/:id/messages`
- `backtest`：回测任务提交与状态轮询
- `deploy`：部署触发与结果
- `frontend-orchestrator`：前端状态机与错误提示编排

## 架构与组件职责

### 1) quantify: capability gate
职责：确保回测能力接口对前端返回“可判断”的状态，而不是模糊失败。

约束：
- `allowedSymbols` 和 `allowedBaseTimeframes` 必须为非空字符串数组。
- 不满足约束时返回业务错误码（例如 `CAPABILITY_UNAVAILABLE`），附 `stage=capability`。

### 2) quantify: codegen pipeline
职责：会话/生成阶段返回明确阶段状态与错误。

约束：
- 会话状态严格受控：`DRAFTING -> CHECKLIST_GATE -> GENERATING -> VALIDATING_* -> PUBLISHED/REJECTED`
- provider 或脚本空结果等异常统一映射为结构化业务错误（示例：`AI_PROVIDER_ERROR`、`codegen.script_generation_empty_result`），附 `stage=codegen`。

### 3) quantify: backtest job
职责：生成后回测必须具备确定状态机与失败原因。

约束：
- 状态：`queued/running/succeeded/failed`
- `failed` 必须包含 `reasonCode`（可用于前端映射）。

### 4) quantify: deploy action
职责：部署失败可重试且不污染会话终态。

约束：
- 部署失败输出业务码，附 `stage=deploy`。
- 不把一次部署失败传播为会话不可恢复错误。

### 5) front: orchestrator
职责：统一消费 `code/stage/retryable`，将提示分段化。

约束：
- 优先读取后端错误体（`message/error.message/code/stage`），避免仅显示 `HTTP 502`。
- 提示语义区分：能力失败、生成失败、回测失败、部署失败。

## 错误模型设计

## 返回结构（后端 -> 前端）
统一返回以下最小字段：
- `code: string`
- `message: string`
- `stage: 'capability' | 'codegen' | 'backtest' | 'deploy'`
- `retryable: boolean`
- `traceId: string`

说明：
- 后端发生上游异常时可以保留 HTTP 502/503，但响应体必须带业务字段，前端据此精确渲染。
- 前端 fallback 文案禁止使用单一“请求失败”，必须带 stage 语义。

## 数据流（核心路径）
1. Front 打开 AI Quant 页面 -> 拉 `capabilities`
2. 能力通过 -> 创建 codegen session
3. 用户确认生成 -> 进入 codegen pipeline
4. 生成成功 -> 发起 backtest job
5. 回测成功且满足阈值 -> 发起 deploy
6. 任一失败 -> 前端依据 `stage+code` 给出可定位提示，并提供重试路径

## 观测与日志最小规范
对于失败日志，至少记录：
- `stage`
- `code`
- `sessionId`（若有）
- `userId`
- `traceId`

目标：staging 排障时可在 1 次检索中定位具体阶段与原因。

## 双验收方案

### A. API 验收（脚本）
按顺序执行并断言每一步：
1. `GET /backtesting/capabilities`
2. `POST /llm-strategy-codegen/sessions`
3. `POST /llm-strategy-codegen/sessions/:id/messages`
4. 回测任务创建 + 轮询
5. 部署触发 + 状态查询

每步断言：
- HTTP 状态
- `code/stage`
- 关键业务字段完整性

### B. 前端手工验收
在 `https://cfx-www-staging.devbase.cloud/zh/ai-quant` 完成一次完整流程：
- 会话创建 -> 策略生成 -> 回测执行 -> 发起部署

通过标准：
- 无裸 `HTTP 502` 泛化提示。
- 失败可定位到明确 stage/code。

## staging 可能需要的配置清单（仅在缺失时）
若代码改造后仍出现上游异常，需核对以下配置是否在 staging 存在并有效：
- codegen provider 可用性相关环境变量（provider code/model/key）。
- backtesting 能力数据源配置（symbol/timeframe 来源与鉴权）。
- 统一 trace id 注入（网关/应用层）。

注：本设计不要求新增部署脚本逻辑；仅在现有环境变量缺失时补齐配置。

## 风险与缓解
- 风险：分段改造后前后端错误码不一致。
  - 缓解：先定义错误码映射表，再补单测与集成验证。
- 风险：修复 codegen 后暴露 backtest/deploy 既有问题。
  - 缓解：以双验收脚本按顺序跑，逐段闭环。

## 里程碑
1. 错误模型统一（code/stage/retryable/traceId）
2. capability + codegen 稳态化
3. backtest + deploy 稳态化
4. 双验收通过（API + 前端）

## 结论
采用“分段稳态化 + 双验收闭环”可在当前约束（仅改应用代码）下，以最小破坏实现 AI 量化整链路可观测、可恢复、可验证。
