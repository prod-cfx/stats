# 2026-03-25 LLM Backtest Jobs Design

## 背景与目标

当前 AI 量化页的“开始回测”按钮仍走前端本地 mock 计算，未对接 quantify 后端真实回测能力。目标是改为异步任务回测链路，保证回测结果来自后端，并保持现有交互尽量稳定。

本设计的已确认约束：

- 仅接入异步任务链路（`POST /backtesting/jobs` + 查询状态 + 拉取结果）
- `bars` 数据由后端按参数自行拉取
- `strategy` 使用当前会话已确认并可用的 `scriptCode + params`

## 现状问题

1. 回测按钮触发本地 `getMockBacktest`，没有后端请求。
2. 前端回测参数模型与后端 `RunBacktestDto` 不匹配。
3. 回测详情页仍是 seed/mock 展示，不是服务端回测报告。
4. 错误处理只覆盖前端分支，没有任务态失败与超时语义。

## 方案概览（推荐方案）

采用前端直连异步 jobs 的最小改造：

1. 点击回测时组装 `RunBacktestDto` 请求体。
2. 调用 `POST /backtesting/jobs` 创建任务。
3. 轮询 `GET /backtesting/jobs/:id` 直到 `succeeded` 或 `failed`。
4. `succeeded` 后调用 `GET /backtesting/jobs/:id/result` 获取 `BacktestReport`。
5. 将 `BacktestReport.summary` 映射为现有前端 `BacktestResult`，并保留 `symbol/startAt/endAt` 以兼容详情页跳转参数。

## 参数契约与映射

### 前端输入来源

- `symbol`：当前会话参数
- `range`：现有 `BacktestRangeInput` 的 `preset/custom` 解析结果
- `strategy.scriptCode`：来自当前会话 codegen 结果
- `strategy.params`：当前参数快照（动态参数优先）

### RunBacktestDto 映射规则

- `symbols`: `[symbol]`
- `baseTimeframe`: 新增回测周期参数（默认 `15m`）
- `stateTimeframes`: `[baseTimeframe]`（MVP）
- `initialCash`: `10000`
- `leverage`: `1`
- `execution`: 使用既有安全默认值
- `strategy`: `{ id, protocolVersion: 'v1', scriptCode, params }`
- `dataRange`: `{ fromTs, toTs }`（ISO 转毫秒时间戳）
- `bars`: `[]`（后端负责拉取）

## 异步状态机

前端引入单任务状态机：

- `idle`
- `submitting`
- `running`
- `succeeded`
- `failed`
- `timeout`

行为约束：

- `submitting/running` 期间禁用回测按钮
- 新回测会取消旧轮询（仅取消前端轮询，不取消后端任务）
- 超时后给出可重试提示，不伪造成功结果

## 错误处理

- 创建任务失败：直接反馈错误，保留会话上下文
- 任务失败：展示后端返回错误并结束流程
- 查询结果冲突（未完成/404/409）：按可恢复错误处理并提示用户
- 脚本缺失：前置校验失败，禁止提交任务

## 测试策略（需求驱动）

### Happy Path

- 创建任务成功 -> 状态完成 -> 获取结果 -> UI 正确展示

### Edge Cases

- 自定义时段缺失
- 起止时间倒置
- 区间超 365 天
- symbol 为空

### Error Handling

- `createJob` 失败
- job `failed`
- `result` 拉取失败
- 轮询超时

### State Transitions

- `idle -> submitting -> running -> succeeded`
- `idle -> submitting -> failed`
- `idle -> submitting -> running -> timeout`

## 文件变更边界（设计阶段）

- 新增：`apps/front/src/components/ai-quant/backtest-job-client.ts`
- 修改：`apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- 可选修改：`apps/front/src/components/ai-quant/QuantChatPanel.tsx`（loading/disable）
- 新增测试：`backtest-job-client.test.ts`、`AiQuantPageClient.backtest-jobs.test.tsx`

## 风险与缓解

1. 后端对 `bars` 空数组处理不一致
- 缓解：先与后端契约确认；若未支持，补后端“空 bars 自动拉取”兼容。

2. 会话状态下 `scriptCode` 丢失
- 缓解：前置校验 + 明确提示；不回退 mock。

3. 轮询负载与等待体验
- 缓解：指数退避 + 超时 + 明确状态文案。

## 非目标（YAGNI）

- 不引入 SSE/WebSocket 推送
- 不做多任务历史管理
- 不改造后端 backtesting 模块核心算法

## 验收标准

1. 点击回测后不再走本地 mock。
2. 回测结果来自后端 `jobs` 流程并映射展示。
3. symbol/周期/时段参数被正确传递与验证。
4. 失败、超时、未完成等状态有明确用户反馈。
5. 需求场景测试覆盖并通过。
