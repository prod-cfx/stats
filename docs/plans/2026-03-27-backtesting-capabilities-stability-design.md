# Backtesting Capabilities 稳定性设计

## 背景
`brav1/backtesting/capabilities` 现状链路为：`front -> backend(ai-quant-proxy) -> quantify(backtesting) -> DB(backtestCapabilityConfig)`。
当其他业务改动引发上游瞬态异常（网络抖动、超时、非 JSON、短暂依赖不可用）时，接口经常暴露为 502，影响前端能力门禁与回测体验。

## 目标
1. 在不破坏现有 API 与 userspace 的前提下，降低 `backtesting/*` 502 暴露率。
2. 先建立可观测证据链，能定位问题来源（代理层、quantify 层、DB 层）。
3. 对 `capabilities` 提供稳定降级；对 `jobs*` 提供明确可重试语义。

## 非目标
1. 本轮不引入熔断器、分布式缓存、消息补偿。
2. 不修改 API 路径与主要 DTO。
3. 不调整鉴权和限流策略。

## 方案选型
采用方案 A：先观测定位，再最小降级止血。

## 架构与数据流
1. 保持请求链路不变：`front -> backend(ai-quant-proxy) -> quantify(backtesting) -> DB`。
2. 在 backend 代理层增加统一观测与降级入口。
3. 在 quantify backtesting 层增加 DB 查询和出口观测。
4. 对外协议保持兼容：路径不变、成功响应结构不变。

## 组件改动范围
- `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
- `apps/backend/src/modules/ai-quant-proxy/clients/quantify-ai-quant.client.ts`
- `apps/backend/src/modules/ai-quant-proxy/backtesting.controller.ts`
- `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
- （必要时）对应 `*.spec.ts`

## 错误分类与语义
### 分类口径
1. `transient_upstream`：超时、连接失败、上游 502/503、非 JSON 响应。
2. `business_error`：参数非法、资源不存在、权限错误等可预期业务错误。
3. `internal_bug`：代码异常、未捕获异常、序列化异常。

### capabilities 策略
1. 上游成功：返回真实能力集。
2. `transient_upstream` / `internal_bug`：降级返回
   - `allowedSymbols: []`
   - `allowedBaseTimeframes: []`
3. `business_error`：不降级，按业务错误语义返回。
4. 每次降级记录结构化日志：`traceId`、endpoint、耗时、errorClass、upstreamStatus。

### jobs* 策略
1. 不返回伪状态，避免污染交易语义。
2. `transient_upstream`：统一映射为“可重试错误”（建议 HTTP 503 + 稳定业务错误码）。
3. `business_error`：原样透传。
4. `internal_bug`：内部错误语义 + traceId。

## 可观测性设计
1. backend 代理层记录上游调用开始/结束与错误分类。
2. quantify 层记录 capabilities 查询耗时与异常类型。
3. 所有异常日志具备可关联字段：`traceId/requestId`、`endpoint`、`errorClass`。
4. 统计指标：
   - `capabilities_fallback_count`
   - `jobs_retryable_error_count`
   - 按错误分类分桶的失败率

## 测试矩阵（需求驱动）
### Happy Path
1. `GET /backtesting/capabilities` 上游成功返回真实能力集。
2. `POST/GET /backtesting/jobs*` 上游成功返回真实任务结果。

### Edge Cases
1. capabilities 上游超时、连接失败、非 JSON、502/503，返回空能力集。
2. jobs* 上游超时、连接失败、502/503，返回可重试错误语义。

### Error Handling
1. business error 不被降级吞掉。
2. internal bug 被统一捕获并可通过 traceId 检索。

### State Transitions
1. jobs 全链路 `create -> get -> result` 在成功/可重试失败/业务失败三分支都有用例。

## 验收标准
1. `capabilities` 端点在瞬态故障下不再向前端暴露 502。
2. `jobs*` 在瞬态故障下返回稳定可重试语义。
3. 可通过日志定位错误来源到 backend/quantify/DB 层级。
4. 相关单测通过，既有行为不回归。

## 风险与回滚
1. 风险：过度降级可能掩盖真实缺陷。
2. 缓解：保留结构化日志与降级计数，设置告警阈值。
3. 回滚：降级策略可按端点开关逐步撤回。
