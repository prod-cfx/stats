# Backtest Data Range Partial 策略设计

日期：2026-03-25  
状态：已确认

## 1. 目标与原则

### 1.1 目标
- 解决前端 `from/to` 自由选择导致的“回测成功但结果全 0”误导。
- 默认保持严格校验，避免静默回退。
- 在用户显式允许时支持“部分区间回测”，提升可用性。

### 1.2 设计原则
- KISS：不重写回测引擎，仅在 jobs/数据装配层处理范围逻辑。
- YAGNI：先支持单一 `allowPartial` 开关，不引入复杂策略矩阵。
- Never break userspace：默认行为对现有调用方安全，只有显式开启才自动裁剪。

## 2. 接口契约

### 2.1 请求
`POST /api/v1/backtesting/jobs` 新增可选字段：
- `allowPartial?: boolean`（默认 `false`）

### 2.2 预检与决策
后端在执行前进行覆盖预检（按 symbol + timeframe 计算 `availableRange`）。

- 当请求区间超出覆盖且 `allowPartial=false`：
  - 拒绝执行并返回 `backtest.data_range_out_of_coverage`
  - 返回 `availableRange` 与 `suggestedRange`

- 当请求区间超出覆盖且 `allowPartial=true`：
  - 自动裁剪到交集区间执行
  - 在作业与结果中回传 `requestedRange`、`appliedRange`

- 当交集为空：
  - 统一失败 `backtest.market_data_empty`
  - 禁止返回“默认 0 成功报告”

### 2.3 结果语义
- `GET /api/v1/backtesting/jobs/:id/result`：
  - `succeeded` 返回报告
  - `failed` 返回结构化错误
- 报告中新增（或 job 元数据新增）：
  - `requestedRange`
  - `appliedRange`
  - `isPartial`
  - `coverage`（可选）

## 3. 前端交互

- 在时间选择后做覆盖预检，展示可用区间。
- 提交前若越界，给出两种路径：
  - 调整到可用范围并继续（`allowPartial=true`）
  - 返回修改时间（保持严格模式）
- 结果页展示：
  - Requested Range
  - Applied Range（若裁剪）
  - Coverage（可选）
- 失败文案映射：
  - `backtest.data_range_out_of_coverage` -> 所选时间不在历史覆盖内
  - `backtest.market_data_empty` -> 所选标的/周期无可用K线

## 4. 后端实现拆分

- `BacktestCoverageService`：
  - 计算 `availableRange`
  - 计算 `requested ∩ available`
  - 输出决策所需结构（全覆盖/部分覆盖/无覆盖）

- `BacktestJobsService`：
  - 读取 `allowPartial`
  - 决定失败或裁剪
  - 记录 `requestedRange` 与 `appliedRange`

- `BacktestMarketDataService`：
  - 严格按 `appliedRange` 拉取 bars
  - 空集合直接抛 `backtest.market_data_empty`

## 5. 错误码

- `backtest.data_range_out_of_coverage`：请求区间超出覆盖且未允许 partial
- `backtest.market_data_empty`：交集为空或拉取后无 bars
- `backtest.market_data_unavailable`：行情查询链路异常
- `backtest.job_failed`：执行过程其他异常

## 6. 测试矩阵（需求驱动）

### 6.1 Happy Path
- 全覆盖 + `allowPartial=false` -> `succeeded`，`appliedRange=requestedRange`
- 部分覆盖 + `allowPartial=true` -> `succeeded`，`isPartial=true`

### 6.2 Edge Cases
- `from==to` 的边界时间戳
- 多 symbol 情况（首版按主 symbol 或既定策略，保持简单）

### 6.3 Error Handling
- 部分覆盖 + `allowPartial=false` -> `backtest.data_range_out_of_coverage`
- 无交集 -> `backtest.market_data_empty`
- 预检失败/上游异常 -> `backtest.market_data_unavailable`

### 6.4 状态迁移
- `queued -> running -> succeeded`
- `queued -> running -> failed`
- 禁止 `succeeded + 默认空报告`

## 7. 风险与缓解

- 风险：用户误用 partial 造成样本偏差。  
  缓解：结果页显著展示 `appliedRange` 与 `isPartial`。

- 风险：多 symbol 覆盖策略复杂。  
  缓解：首版采用最小策略（主 symbol 或统一交集），文档化约束。

- 风险：覆盖预检增加延迟。  
  缓解：预检只读聚合查询，必要时缓存 symbol/timeframe 覆盖元数据。

## 8. 验收标准

- 默认模式下，不再出现“成功但全 0 且无错误”。
- 用户显式开启 partial 时，能在有交集的场景稳定出结果。
- 所有失败场景都提供可定位错误码与可读信息。
