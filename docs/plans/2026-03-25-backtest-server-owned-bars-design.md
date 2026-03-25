# Backtest Server-Owned Bars 设计

日期：2026-03-25  
状态：已评审（用户确认）

## 1. 背景与问题

当前 AI 量化回测链路中，前端构造 `POST /api/v1/backtesting/jobs` payload 时将 `bars` 固定为 `[]`。后端 `BacktestRunnerService` 完全依赖 `input.bars` 驱动回测循环，因此会出现：

- 任务成功完成，但报告为默认值（`netProfit=0`、`totalTrades=0`）
- `equityCurve/trades/markers/bySymbol/openPositions` 为空

这会给用户造成“策略无效”误导，且掩盖真实数据缺失问题。

## 2. 目标与非目标

### 2.1 目标

- 将回测 K 线数据拉取职责下沉到 quantify 后端。
- 前端不再负责拼装 `bars`。
- 当市场数据缺失时返回明确失败，而不是“成功+全 0”。
- 保持现有作业轮询协议（`jobs/:id` + `jobs/:id/result`）不变。

### 2.2 非目标

- 不重写回测执行引擎（runner/ledger/reporter）。
- 不引入新的前端可视化能力（净值曲线仍按现有页面能力展示）。
- 不扩展新的回测业务指标。

## 3. 方案对比

### 方案 A：前端补 bars（快补丁）

- 前端调用行情接口后塞入 payload。
- 优点：改动快。
- 缺点：请求体大、前端环境差异导致一致性差、数据可信边界不清。

### 方案 B：后端托管 bars（推荐，已选）

- `jobs` 创建后由后端拉取并组装 bars。
- 优点：职责清晰、可观测性强、一致性最好。
- 缺点：后端实现量增加。

### 方案 C：双路兼容

- 有 bars 用前端，无 bars 后端补拉。
- 优点：兼容历史客户端。
- 缺点：双路径维护复杂、结果一致性风险高。

## 4. 最终设计（采用方案 B）

### 4.1 架构与职责

- 前端：仅提交回测参数（symbols/timeframes/range/strategy/execution）。
- quantify 后端：
  - `BacktestJobsService` 在执行任务前调用 `BacktestMarketDataService` 拉取 K 线。
  - 组装 `BacktestRunInput.bars` 后调用 `BacktestRunnerService.run`。
- runner：保持纯计算职责，不关心数据来源。

### 4.2 数据流

1. 前端调用 `POST /backtesting/jobs`（无 bars）。
2. 后端创建 job（queued）。
3. 异步执行：
   - 状态切到 running。
   - 拉取 `baseTimeframe + stateTimeframes` 的 bars。
   - 按 `symbols + fromTs/toTs` 过滤并合并。
   - bars 非空则执行 runner，成功后写入 result 并标记 succeeded。
4. 拉取失败或 bars 为空则 job 标记 failed 并记录可读错误。

### 4.3 接口契约

- `RunBacktestDto` 的 `bars` 字段从必填改为可选（或保留但后端忽略客户端值）。
- `POST /backtesting/jobs` 对外协议保持向后兼容。
- `GET /backtesting/jobs/:id/result`：
  - `succeeded`：返回报告。
  - `failed/queued/running`：返回冲突错误（保持现有语义）。

## 5. 错误处理策略

新增或规范以下错误语义：

- `backtest.market_data_empty`：参数合法但区间内无可用 K 线。
- `backtest.market_data_unavailable`：行情上游不可用或调用失败。
- `backtest.job_failed`：回测执行异常（沿用）。

原则：

- 禁止“静默回退到默认 0 报告”。
- 缺数据必须显式失败，避免误导用户。

## 6. 观测性

任务执行日志增加关键字段：

- `jobId`
- `symbols`
- `baseTimeframe`
- `stateTimeframes`
- `fromTs/toTs`
- `barCount`

当 `barCount=0` 记录 warning，便于线上快速定位。

## 7. 测试方案（需求驱动）

### 7.1 Happy Path

- 有效参数 + 可用 bars + 有交易信号：
  - job 最终 `succeeded`
  - `summary.totalTrades > 0`
  - `equityCurve` 非空

### 7.2 Edge Cases

- 最小合法区间（边界时间戳）
- 多 symbol / 多 timeframe 组合
- `stateTimeframes` 包含多个值时 bars 正确聚合

### 7.3 Error Handling

- 行情返回空集 -> `failed` + `backtest.market_data_empty`
- 行情上游报错 -> `failed` + `backtest.market_data_unavailable`
- 非 `succeeded` 状态访问 `result` -> 冲突错误

### 7.4 状态迁移

- `queued -> running -> succeeded`
- `queued -> running -> failed`

## 8. 变更清单（实现阶段）

- quantify
  - 新增：`BacktestMarketDataService`（或等价命名）
  - 修改：`BacktestJobsService`（执行前拉 bars 并装配输入）
  - 调整：`RunBacktestDto` 对 `bars` 的校验策略
- front
  - 修改：`buildBacktestPayload`（移除 `bars: []`）
  - 修改：对应单测，不再断言 `bars=[]`

## 9. 风险与缓解

- 风险：行情服务延迟上升导致回测任务变慢。  
  缓解：任务异步化已存在；增加超时与重试上限。

- 风险：历史客户端仍传 bars。  
  缓解：后端忽略客户端 bars，统一使用服务端数据。

- 风险：行情源与回测时间框映射错误。  
  缓解：增加 timeframe 映射测试与日志字段。

## 10. 验收标准

- 不再出现“接口成功但全默认 0 且无任何报错”的结果。
- 缺行情时返回可定位错误码。
- 正常行情下回测结果可产生非空交易与净值曲线。
