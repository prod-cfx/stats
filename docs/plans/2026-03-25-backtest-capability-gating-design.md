# 2026-03-25 Backtest Capability Gating Design

## 背景

当前 AI 量化回测已接入后端异步 jobs，但“可选标的/周期”仍可能由前端自由参数导致后端拒绝。目标是把约束前置到前端，减少无效请求。

本次用户确认：

- 目标：前置约束，避免提交后端才失败
- 数据源：后端下发能力配置（单一真相）
- 能力加载失败策略：禁止回测，不做 fallback 输入

## 方案总览

采用严格门禁（recommended）：

1. 页面初始化拉取回测能力配置（symbols/timeframes）。
2. 仅允许选择后端允许值；提交前再次本地校验。
3. 能力加载失败时，回测按钮禁用并显示错误态。

## 架构与数据流

### 能力模型

后端返回（示例）：

- `allowedSymbols: string[]`
- `allowedBaseTimeframes: Array<'5m' | '15m' | '1h' | '4h' | '1d'>`
- `allowedStateTimeframes?: string[]`

### 前端状态

新增页面并行状态：

- `capabilityState: 'loading' | 'ready' | 'failed'`
- `capability: { allowedSymbols: string[]; allowedBaseTimeframes: string[]; ... } | null`

### 回测可执行条件

`canRunBacktest = graph条件 && jobs状态非running/submitting && capabilityState === 'ready'`

### 提交流程

1. 使用受控下拉得到 `symbol` 与 `baseTimeframe`。
2. 提交前本地校验是否属于允许集合。
3. 校验通过后进入 payload builder 与 jobs 提交流程。
4. 校验失败则直接阻断并提示，不发请求。

## UI 交互设计

### 参数区

新增/调整：

- `回测标的`：下拉（数据源 `allowedSymbols`）
- `基础周期`：下拉（数据源 `allowedBaseTimeframes`）

### 默认值与自动修正

- 能力加载成功后，如果当前参数不在允许集合：
  - 自动修正到第一个可用项
  - 追加一条 assistant 提示，避免静默改值

### 异常态

- `capabilityState = loading`：下拉 loading，回测按钮禁用
- `capabilityState = failed`：显示固定错误提示 + 按钮禁用
  - 文案 key（建议）：`aiQuant.messages.backtestCapabilityLoadFailed`

### 提示策略

- 本地门禁失败：
  - `symbol_not_allowed`
  - `timeframe_not_allowed`
- 后端仍返回能力相关错误时：展示后端 message 并建议刷新能力

## 错误与边界处理

1. 能力接口成功但集合为空：视为 `failed`（不可回测）
2. 能力接口超时/网络失败：`failed`
3. 能力与本地参数漂移：自动修正 + 提示
4. 能力加载期间用户操作回测：直接阻断（按钮禁用）

## 测试策略（需求驱动）

### Happy path

- 能力加载成功
- 下拉选择合法参数
- 回测请求正常发起

### Edge cases

- 能力返回空集合
- 旧参数不在允许集合（自动修正）

### Error handling

- 能力接口失败 -> 按钮禁用 + 错误提示 + 不发起回测
- 本地门禁失败 -> 不调用 `createBacktestJob`

### State transitions

- `loading -> ready`
- `loading -> failed`
- `ready + jobs: submitting/running/succeeded/failed/timeout`

## 非目标（YAGNI）

- 不引入自由输入 fallback
- 不做 websocket 能力推送
- 不实现离线缓存能力兜底

## 验收标准

1. 未拿到能力配置时，前端无法发起回测。
2. 回测请求中的 `symbol/baseTimeframe` 都来自后端允许集合。
3. 能力失败有明确可见提示。
4. 中英文 i18n key 完整。
5. 相关测试场景覆盖并通过。
