# LLM 固定协议脚本回测改造设计

## 背景
当前 LLM 代码生成已收敛到固定协议（`StrategyAdapterV1`，`protocolVersion: 'v1'`）。
但回测入口仍接受 `strategy.fn`（函数），与 LLM 产物 `scriptCode`（字符串）不一致，导致协议断层。

## 目标
- 回测 API 只接受固定协议脚本，不再接受 `strategy.fn`。
- 在回测入口完成脚本编译与适配，回测引擎核心逻辑保持不变。
- 保持 KISS/YAGNI：不重写撮合、状态、报表模块。

## 非目标
- 不新增第二套策略协议。
- 不重构 `BacktestRunnerService` 的撮合/资金曲线算法。
- 不做旧协议隐式兜底兼容。

## 方案对比与选型
1. 入口适配层（推荐）
- 在 Controller 前置把 `scriptCode` 适配为 `fn`，再复用现有 runner。
- 优点：改动最小、风险最低、可测性好。

2. Runner 直接吃脚本
- 把编译执行塞进 runner。
- 缺点：侵入核心回测逻辑，回归面扩大。

3. 新增脚本回测端点
- 与旧端点并存。
- 缺点：长期维护两套接口。

最终选型：方案 1。

## 架构设计

### 1. API 入参契约（破坏性变更）
`RunBacktestDto.strategy` 从：
- `id`
- `params`
- `fn`

变更为：
- `id: string`
- `protocolVersion: 'v1'`
- `scriptCode: string`
- `params: Record<string, unknown>`

说明：旧 `strategy.fn` 直接判为非法请求。

### 2. 适配层职责
新增 `BacktestStrategyAdapterService`（建议路径：
`apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`）：
- 输入：`{ protocolVersion, scriptCode, params }`
- 处理：
  - `compileStrategyScriptForVm(scriptCode)` 进行 TS/协议编译检查
  - 在受控执行环境中得到脚本导出对象
  - `isStrategyAdapterV1` 校验导出对象协议
  - 生成可执行 `fn(ctx)`，内部调用 `adapter.onBar(ctx)`
- 输出：`BacktestRunInput['strategy']`（含 `fn`）

### 3. 控制器调用链
`BacktestingController`：
1. 校验 DTO
2. 调用 `BacktestStrategyAdapterService.buildStrategyInput(...)`
3. 把构建后的输入传给 `runner.run(...)` 或 `jobsService.createJob(...)`

`BacktestRunnerService` 不改业务行为。

## 错误处理契约
- `400 backtest.strategy_protocol_invalid`：`protocolVersion !== 'v1'`
- `400 backtest.strategy_script_invalid`：脚本为空或类型不合法
- `400 backtest.strategy_compile_failed`：TS 编译/类型检查失败
- `400 backtest.strategy_adapter_invalid`：执行后导出对象不满足 `StrategyAdapterV1`
- 运行时 `onBar` 抛错：
  - 同步 `run` 直接失败返回
  - 异步 job 标记 `failed`

日志字段最小集：`strategyId`、`protocolVersion`、`stage(compile/eval/onBar)`、`error`。
不记录完整脚本正文。

## 测试设计（需求驱动）

### R1 只接受固定协议脚本
- 传旧 `strategy.fn` -> 400
- `protocolVersion` 非 `v1` -> 400

### R2 合法脚本可执行回测
- 最小 `NOOP` 协议脚本可返回完整回测报告结构

### R3 编译失败可诊断
- 语法错误脚本 -> 400 + 诊断摘要
- 类型错误脚本 -> 400 + 诊断摘要

### R4 运行时错误可观测
- `onBar` 抛异常：
  - `run` 失败
  - `jobs` 状态为 `failed`

### R5 核心行为稳定
- 同一 `StrategyDecisionV1` 逻辑下，交易数/权益曲线长度与现有逻辑一致

## 影响范围
- `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`
- `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`（如需输入映射）
- 新增 `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`
- 对应单元测试与控制器测试

## 风险与回滚
- 风险：外部调用方若仍按 `strategy.fn` 调用会立即失败。
- 回滚点：回退 DTO 与 controller 适配逻辑即可，不影响 runner 核心。

## 交付标准
- `/backtesting/run` 与 `/backtesting/jobs` 仅接受固定协议脚本。
- 测试覆盖 R1-R5 场景并通过。
- 不引入新的协议分叉，不修改回测核心计算口径。
