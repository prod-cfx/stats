# Backtesting 异步任务化设计（仅后端）

## 目标

在 `backtesting` 模块内新增异步任务能力，支持：

- 提交回测任务
- 查询任务状态
- 查询任务结果

保持现有 `POST /backtesting/run` 同步接口不变。

## 方案选择

本阶段采用**进程内任务存储（in-memory）**，不引入数据库迁移：

- 优点：改动小、上线快、风险低
- 缺点：服务重启后任务丢失，不适合作为长期持久化方案

后续可在第三阶段替换为 Prisma 持久化表结构。

## API 设计

- `POST /backtesting/jobs`
  - 入参：`RunBacktestDto`
  - 返回：`{ id, status, createdAt, startedAt?, finishedAt?, error?, inputSummary }`
- `GET /backtesting/jobs/:id`
  - 返回同上（不含详细结果）
- `GET /backtesting/jobs/:id/result`
  - 若成功：返回 `BacktestReport`
  - 若任务未完成：返回 409
  - 若任务失败：返回 409（附错误信息）
  - 若任务不存在：返回 404

## 状态机

- `queued` -> `running` -> `succeeded`
- `queued` -> `running` -> `failed`

## 数据结构

任务记录字段：

- `id`
- `status`
- `createdAt` / `startedAt` / `finishedAt`
- `error`
- `inputSummary`（脱敏简要输入，避免暴露函数体）
- `result`（仅成功后可取）

## 测试策略

- `BacktestJobsService` 单测：
  - 提交后状态迁移为成功
  - 提交后状态迁移为失败
  - 未完成时读取结果返回冲突
- `BacktestingController` 单测：
  - 暴露 `run / createJob / getJob / getJobResult` 方法

