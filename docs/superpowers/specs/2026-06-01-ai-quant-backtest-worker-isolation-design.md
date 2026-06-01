# AI Quant 回测 Worker 隔离设计

## 背景

2026-06-01 staging 环境中，单个用户触发 AI 量化回测后，`/zh/ai-quant` 长时间停留在 `Syncing your AI Quant conversations...`。排查证据显示问题不是前端路由，也不是单个回测结果慢，而是 Quantify 服务整体被回测执行拖住：

- `https://cfx-quantify-staging.devbase.cloud/api/v1/health` 超时。
- `https://cfx-quantify-staging.devbase.cloud/api/v1/backtesting/capabilities` 超时。
- `GET /api/v1/account/ai-quant/conversations` 超时，导致所有用户 AI 量化会话同步卡住。
- `backtest_jobs` 存在多条长期 `running`，最老从 2026-04-03 残留至今。
- PostgreSQL 出现 `idle in transaction` 与 `transactionid` 锁等待。

当前 `BacktestJobsService.createJob()` 在 Quantify API 进程内创建 job 后，通过 `queueMicrotask()` 调用 `executePersistedJob()`。回测执行、行情回填、策略运行和结果写入都运行在同一个 Nest API 进程内，共享 Node event loop、Prisma 连接池、PostgreSQL 锁和外部行情请求资源。单个回测卡住时，会扩大成 Quantify API 整体不可用。

生产环境如果使用相同代码和单进程部署形态，也存在同类故障风险。目标是生产级隔离：单个回测再慢、再卡、再失败，也不能拖垮 AI 量化在线接口。

## 目标

- 回测执行从 Quantify API 进程中剥离，改由独立 worker 消费 Bull 队列执行。
- Quantify API 只负责 HTTP 请求、校验、创建 job、入队和查询状态。
- 回测 worker 卡住、失败、重启时，不影响 AI 量化页面、会话同步、策略详情、能力接口和 API health。
- `backtest_jobs` 不再无限停留 `running`；stale job 会自动恢复到终态。
- 前端不再无限显示 `Syncing your AI Quant conversations...` 或无限轮询回测。
- staging 和 production 使用同一套隔离方案与运维诊断方式。

## 非目标

- 不重写回测策略引擎。
- 不拆出新的独立仓库或全新服务边界。
- 不把人工 SQL 修复作为长期主路径；人工操作只作为应急 SOP。
- 不在本设计中改变 AI 量化策略生成、发布、部署的业务语义。

## 方案选择

采用同一 Quantify 代码库中的双进程方案：

- `quantify-api`：对外 API 进程。
- `quantify-backtest-worker`：后台回测 worker 进程。
- Bull/Redis：回测 job 调度、worker 心跳、stalled 检测。
- PostgreSQL：`backtest_jobs` 状态和结果的唯一事实来源。

这个方案改动集中，能复用现有 Nest 模块、Prisma、环境配置和部署流水线，同时把高风险长耗时回测从在线 API 故障域移出。

## 架构

### Quantify API

Quantify API 只处理在线请求。`POST /backtesting/jobs` 做以下动作：

1. 校验调用用户、conversation、published snapshot、symbol availability。
2. 写入 `backtest_jobs`，状态为 `queued`。
3. 调用 `BacktestQueueProducer.enqueue(jobId)` 将 jobId 放入 Bull `backtest` 队列。
4. 快速返回 job view。

API 不再调用 `queueMicrotask()`，也不直接执行 `executePersistedJob()`。所有查询接口只读数据库，不依赖 worker 内存状态。

### Backtest Worker

新增独立 worker 入口，消费 Bull `backtest` 队列。worker 负责：

1. 根据 jobId 读取 `backtest_jobs`。
2. 用 compare-and-set 将 `queued` 改为 `running`。
3. 执行回测：`prepareData()`、`resolveCoverage()`、`loadBars()`、`runner.run()`。
4. 成功时写 `succeeded/result/finishedAt` 并更新 `lastBacktestRef`。
5. 失败或超时时写 `failed/errorDetails/finishedAt`。

worker 初始并发为 1，可通过 `BACKTEST_WORKER_CONCURRENCY` 调整。worker 可以独立重启和扩缩容。

### Backtest Job Repository

`backtest_jobs` 是 job 状态唯一事实来源。API 和 worker 都通过 repository 访问该表。需要将当前 `BacktestJobsService` 中直接访问 Prisma 的逻辑收敛到 repository，符合项目 Controller -> Service -> Repository 分层约定。

状态流转：

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> failed
running -> failed
```

终态必须有 `finishedAt`。

### Backtest Recovery

worker 启动时执行恢复扫描：

- `running` 且 `startedAt < now - BACKTEST_JOB_TIMEOUT_MS`：标记 `failed`，错误码 `BACKTEST_JOB_TIMEOUT`。
- `queued` 且 `createdAt` 在短期等待窗口内：重新入队。
- `queued` 且超过最大等待时间：标记 `failed`，错误码 `BACKTEST_QUEUE_TIMEOUT`。

恢复日志必须包含 `jobId`、`status`、`age`、`conversationId`、`ownerUserId`。

## 数据流

### 创建回测

1. 前端调用 `POST /api/v1/backtesting/jobs`。
2. backend proxy 转发到 Quantify API。
3. Quantify API 校验输入和权限。
4. API 写入 `backtest_jobs(status=queued)`。
5. API 入 Bull 队列。
6. API 返回 job view。

如果入队失败，API 必须把已创建 job 标记为 `failed`，错误码 `BACKTEST_QUEUE_UNAVAILABLE`，不能留下假 `queued` 或假 `running`。

### 执行回测

1. Worker 收到 Bull job。
2. Worker 加载 DB job。
3. Worker 只在 `status=queued` 时改成 `running`。
4. Worker 执行回测。
5. Worker 将 job 收敛到 `succeeded` 或 `failed`。

重复消费同一个 Bull job 时，只有第一个成功 CAS 的 worker 执行；其他 worker 跳过。

### 查询回测

1. 前端轮询 `GET /backtesting/jobs/:id`。
2. API 只查 DB。
3. `queued/running` 返回状态。
4. `succeeded` 后前端拉 `GET /backtesting/jobs/:id/result`。
5. `failed` 时前端展示结构化错误。

API 不等待 worker，也不执行回测逻辑。

## 错误处理

新增或使用结构化错误码：

- `BACKTEST_JOB_TIMEOUT`：worker 执行超过硬超时。
- `BACKTEST_JOB_STALLED`：Bull 检测到 stalled 或 worker 进程中断。
- `BACKTEST_QUEUE_UNAVAILABLE`：Redis/Bull 不可用导致无法入队。
- `BACKTEST_WORKER_UNAVAILABLE`：worker 不健康或队列长时间无人消费。
- `BACKTEST_MARKET_DATA_TIMEOUT`：行情拉取或回填超时。
- `BACKTEST_QUEUE_TIMEOUT`：queued 等待超过最大阈值。

worker 捕获所有异常并写入 `failed/errorDetails/finishedAt`。Bull job timeout 与 DB job timeout 必须一致或 DB timeout 更保守，避免队列已失败但 DB 仍显示 `running`。

外部 HTTP、行情请求、长耗时计算不能包在数据库事务里。数据库事务只覆盖最小必要写入。

## 超时与限流

- API 创建 job：8-12 秒，只覆盖校验、DB 写入和入队。
- Worker 单个 job：默认 180 秒硬超时，可通过环境变量调整。
- 行情 backfill 单批请求：10-15 秒超时。
- 用户级 active job 上限：默认每个用户 1 个 active job，可配置为 2。
- 全局 worker 并发：默认 1，staging/prod 可按容量调到 2。
- 队列等待最大时长：超过阈值后 failed，避免无限排队。

active job 指 `queued` 或 `running` 且未超时的 job。前端按钮禁用应以服务端 active job 状态为准，不能只依赖本地 state。

## 前端降级

### 会话同步

`listAiQuantConversations()` 增加请求超时。超时或失败时：

- `conversationSyncState` 从 `loading` 进入 `error`。
- 页面显示错误态和重试入口。
- 不再无限显示 `Syncing your AI Quant conversations...`。
- 不阻塞用户访问站点其他页面。

### 回测轮询

回测轮询保留当前总超时，但遇到服务端终态立即停止：

- `failed/BACKTEST_JOB_TIMEOUT`：显示“回测执行超时，任务已终止，可稍后重试”。
- API timeout 或 503：显示“服务繁忙，可重试”，不自动重复创建多个 job。
- active job 存在时禁用重复回测按钮。

## 部署

PM2 中拆成两个 app：

- `quantify-api`：运行现有 HTTP API 入口。
- `quantify-backtest-worker`：运行新的 worker 入口。

两个进程共享代码包和环境配置，但职责不同。worker 可以独立重启，不影响 API。生产和 staging 都必须部署 worker；否则 API 创建回测应返回结构化不可用错误，而不是创建无法消费的 job。

## 运维与观测

新增诊断能力：

- active job 数：按 status、ownerUserId、conversationId 聚合。
- stale running job 数。
- Bull queue waiting/active/failed/stalled 计数。
- worker 最近心跳时间。
- DB lock 快照 SQL。

日志链路必须能通过 `jobId` 串联：创建、入队、开始执行、成功、失败、恢复。

应急 SOP：

1. 查询 Quantify API health 和 worker health。
2. 查询 Bull backlog 和 worker active job。
3. 查询 `backtest_jobs` stale running。
4. 查询 DB lock blocker。
5. 优先重启 worker。
6. 必要时标记 stale job failed。
7. 只有 API 自身不健康时才重启 API。

## 测试计划

### 后端单测

- `BacktestJobsService.createJob` 创建 DB job 后入队。
- 入队成功返回 `queued`。
- 入队失败标记 `failed/BACKTEST_QUEUE_UNAVAILABLE`。
- 不再直接调用 `queueMicrotask()` 或执行回测。
- `BacktestWorkerProcessor` 只消费 `queued` job。
- worker 成功写 `succeeded/result/finishedAt`。
- worker 异常写 `failed/errorDetails/finishedAt`。
- worker timeout 写 `failed/BACKTEST_JOB_TIMEOUT/finishedAt`。
- 重复消费同一个 job 不重复执行。
- `BacktestRecoveryService` 正确处理 stale `running` 和 `queued`。

### 后端 E2E

- `POST /backtesting/jobs` 快速返回，不等待真实回测。
- worker 停止时，API health、capabilities、conversation list 仍正常。
- worker 慢任务执行中，其他用户 AI 量化接口仍正常。
- Redis 不可用时，创建回测返回结构化失败，不留下无限 active job。

### 前端测试

- 会话同步超时后显示错误态和重试入口。
- 不再无限显示 `Syncing your AI Quant conversations...`。
- 回测 job `failed/BACKTEST_JOB_TIMEOUT` 停止轮询并显示明确文案。
- API 503/timeout 不重复创建多个回测 job。
- active job 存在时禁用重复回测按钮。

## 验收标准

- 单个回测卡住时，其他用户仍能打开 AI 量化页面。
- Quantify API `/health` 不被 worker 卡住。
- `GET /account/ai-quant/conversations` 不被单个回测长期阻塞。
- `backtest_jobs` 不再出现超过超时阈值的 `running`。
- worker 重启后 stale job 自动收敛到 terminal 状态。
- staging 和 production 都有 API + worker 两个进程。
- PM2 或部署配置能单独重启 worker。
- 日志能从 `jobId` 追踪完整生命周期。
- 前端没有永久 loading 状态。

## 风险与约束

- Bull/Redis 成为回测创建路径的关键依赖；必须有结构化不可用错误和清理逻辑。
- worker 并发过高会增加 DB 和行情源压力；默认从 1 开始。
- 需要确保 API 与 worker 对 job 状态机理解一致，避免重复执行或状态倒退。
- 需要清理历史 stale `running` 数据，避免上线后旧数据干扰验收。

