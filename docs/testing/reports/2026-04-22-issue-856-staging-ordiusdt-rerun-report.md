# Issue 856 — staging ORDIUSDT 手工链路复跑报告

日期：2026-04-22  
环境：staging  
策略：`OKX spot ORDIUSDT / 1h / 10% long-only / on_start 市价买入 / 前收盘上涨 1% 平仓 / 入场均价下跌 5% 止损 / 入场均价上涨 10% 止盈`

---

## 1. 结论摘要

本次 staging 复跑结果如下：

- **登录**：成功
- **生成 / 确认 / 发布**：成功
- **回测**：成功
- **部署**：成功
- **signal 触发**：接口成功返回，但**未产出 signal**
- **最终阻断点**：runtime 执行阶段落成 `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`

换句话说：

> 当前 staging 已经不再卡在 2026-04-21 那次的 codegen 500；主链路已经能走到 deploy。新的首个阻断点位于 deploy 后的 runtime signal 执行阶段。

---

## 2. 安全门禁

本次按 `online-debug-guard` 要求先做门禁：

- 目标环境：`staging`
- `.env.staging`：存在
- `.env.staging.local`：存在
- 执行方式：只读排查 + 受控 API / 浏览器调用
- 未执行：写库、删键、迁移、重启、发布

---

## 3. 登录与页面入口

### 3.1 登录信息

- 登录页：`https://cfx-www-staging.devbase.cloud/zh/auth/login`
- 测试账号：`1512627988@qq.com`
- 固定验证码：`123456`

### 3.2 登录结果

- `POST /api/v1/auth/email/send-code`：`200`
- `POST /api/v1/auth/email/verify-code`：`200`
- userId：`cmn5k086200021jqsntsla6no`
- 登录后页面落点：`https://cfx-www-staging.devbase.cloud/zh/account`
- 可正常进入：`https://cfx-www-staging.devbase.cloud/zh/ai-quant`

---

## 4. 生成 / 发布阶段

### 4.1 浏览器侧手工复跑

在 AI Quant 页新建会话，输入目标自然语言策略后，页面进入 `CONFIRM_GATE`，点击“确认逻辑图”后成功生成代码并发布。

### 4.2 有效会话证据

本次有效发布链路（API 复跑证据）：

- sessionId：`cmo9ez4zc0u3anpqsp0v8ubaf`
- canonicalDigest：`sha256:e94ddc3fe3f6ea35baf3cd1225bcb6f15caf82b7c375bcf922a1ceb4a1d710ad`
- strategyInstanceId：`cmo9ez51q0u3nnpqs7wcer3kb`
- publishedSnapshotId：`cmo9ez5240u3pnpqsjls9wqoy`

后续另一次完整 deploy 链路使用的发布对象：

- sessionId：`cmo9f1etc0wpgnpqsyhb8dlfn`
- strategyInstanceId：`cmo9f1eyo0wpznpqs8h5cs4lh`
- publishedSnapshotId：`cmo9f1eze0wq1npqs7grm6flw`
- deployRequestId：`d364f249-23e6-4e71-95d9-ae9a359b83e9`

### 4.3 发布后真相字段

发布后的快照真相与目标策略一致：

- exchange：`okx`
- marketType：`spot`
- symbol：`ORDIUSDT`
- baseTimeframe：`1h`
- positionPct：`10`

### 4.4 额外观察

会话标题仍显示为：

- `在 OKX 现货 ORDIUSD`

但发布快照与 deploy/runtime 使用的真相字段仍是：

- `ORDIUSDT`

因此这是**标题展示/截断不准**，不是主链路 symbol 真相漂移。

---

## 5. 回测阶段

### 5.1 capabilities

- requestId：`codex-staging-capabilities-1776823737448-b06c4210`
- `GET /api/v1/backtesting/capabilities`：`200`

返回允许周期：

- `1m, 3m, 5m, 15m, 30m, 1h, 4h, 6h, 8h, 12h, 1d, 1w`

### 5.2 symbol support

- requestId：`codex-staging-symbol-check-1776823737460-2181c1a2`
- `POST /api/v1/backtesting/symbols/check`：`201`
- 结果：`supported`

### 5.3 backtest job 创建

- requestId：`codex-staging-create-job-1776823737534-fec54301`
- `POST /api/v1/backtesting/jobs`：`201`
- jobId：`btjob-1776823737605-9a5fb17b`

关键 inputSummary：

- symbols：`["ORDIUSDT"]`
- baseTimeframe：`1h`
- marketType：`spot`
- leverage：`null`
- snapshotId：`cmo9ez5240u3pnpqsjls9wqoy`
- specHash：`sha256:e94ddc3fe3f6ea35baf3cd1225bcb6f15caf82b7c375bcf922a1ceb4a1d710ad`

### 5.4 backtest result

- job status：`succeeded`
- `GET /api/v1/backtesting/jobs/:id/result`：`200`
- requestId：`codex-staging-result-1776823739136-d7bf9552`

summary：

- netProfit：`8.34138163026514`
- netProfitPct：`0.08341381630265139`
- maxDrawdownPct：`0.003175256337901675`
- winRate：`1`
- profitFactor：`null`
- totalTrades：`1`
- totalOpenTrades：`0`
- openPnl：`0`

结论：

- **回测链路成功**
- **spot + leverage null** 在本次链路下可正常通过
- 本次未复现 `503 SERVICE_TEMPORARILY_UNAVAILABLE`

---

## 6. 部署阶段

### 6.1 账户绑定情况

staging 用户当前存在可用 OKX 绑定账户：

- exchangeAccountId：`cmn5p51zv0r9gprqs200eaabh`
- name：`wewe`
- isTestnet：`true`

### 6.2 deploy 调用

- deployRequestId：`d364f249-23e6-4e71-95d9-ae9a359b83e9`
- `POST /api/v1/account/ai-quant/strategies/deploy`：`201`

deploy 返回中的核心结果：

- strategyId：`cmo9f1eyo0wpznpqs8h5cs4lh`
- status：`running`
- exchange：`okx`
- symbol：`ORDIUSDT`
- timeframe：`1h`
- positionPct：`10`
- publishedSnapshotId：`cmo9f1eze0wq1npqs7grm6flw`

### 6.3 deploy result 查询

- `GET /api/v1/account/ai-quant/strategies/deploy-requests/:deployRequestId/result`：`200`
- requestId：`5f9e2e17-e9a3-4cff-8b8d-ae1d5ff6123c`

返回结果表明：

- strategy status：`running`
- exchange：`okx`
- symbol：`ORDIUSDT`
- timeframe：`1h`
- positionPct：`10`

### 6.4 数据库只读核验

按 `strategy_instance_id = cmo9f1eyo0wpznpqs8h5cs4lh` 查询 quantify staging：

#### strategy_instances
- status：`running`
- mode：`TESTNET`
- started_at：`2026-04-22 02:10:53.015`

#### deploy_requests
- deploy_request_id：`d364f249-23e6-4e71-95d9-ae9a359b83e9`
- status：`SUCCEEDED`

结论：

- **deploy 链路成功**
- **snapshot → deploy 绑定真相正确保留**

---

## 7. signal / runtime 阶段

### 7.1 手动触发 signal

对刚部署实例调用：

- `POST https://cfx-quantify-staging.devbase.cloud/api/v1/ops/strategy-instances/cmo9f1eyo0wpznpqs8h5cs4lh/generate-signal`

返回：

- status：`200`
- message：`信号生成任务已触发，请稍后查看信号列表`

### 7.2 触发前详情状态

`GET /api/v1/account/ai-quant/strategies/:id?userId=...` 返回：

- runtimeExecutionStates:
  - executionSemanticKey：`on_start.entry.primary`
  - status：`ready`
  - failureFamily：`null`
  - failureReason：`null`
  - failureCode：`null`

同时：

- latestOrders：`0`
- openPositionsCount：`0`
- closedPositionsCount：`0`

### 7.3 触发后详情状态

5 秒后再次读取详情：

- runtimeExecutionStates:
  - executionSemanticKey：`on_start.entry.primary`
  - status：`failed`
  - failureFamily：`execution`
  - failureReason：`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
  - failureCode：`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
  - lastAttemptAt：`2026-04-22T02:11:35.593Z`

同时：

- latestOrders：`0`
- openPositionsCount：`0`
- closedPositionsCount：`0`

### 7.4 数据库只读核验

#### strategy_runtime_execution_states
- execution_semantic_key：`on_start.entry.primary`
- status：`terminal`
- failure_family：`terminal`
- failure_reason：`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
- failure_code：`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
- attempt_count：`1`
- last_attempt_at：`2026-04-22 02:11:35.593`

#### strategy_signals
- count：`0`

#### user_signal_executions
- count：`0`

#### strategy_signal_state
- consecutive_failures：`1`

#### user_strategy_subscriptions
- status：`active`
- exchange_account_id：`cmn5p51zv0r9gprqs200eaabh`
- subscribed_at：`2026-04-22 02:10:53.026`

### 7.5 结论

当前 deploy 后的 runtime 执行已经真实进入到了 signal generation 阶段，但结果是：

- **没有生成 `strategy_signals`**
- **没有生成 `user_signal_executions`**
- **没有生成 `positions`**
- **runtime state 从 `ready` 进入 `terminal`**
- 失败原因为：`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`

也就是说，本次 staging 的真实首个阻断点是：

> `on_start.entry.primary` 在 runtime execution 阶段执行后没有产出 signal，最终落成 no-signal terminal failure。

---

## 8. 与 2026-04-21 报告的对比

2026-04-21 的 staging 结论是：

- `POST /api/v1/llm-strategy-codegen/sessions` 会被 500 阻断
- 当时还无法走到 deploy/runtime 闭环

而 2026-04-22 本次复跑说明：

- codegen 500 已不再是当前首个阻断点
- staging 已能完成：
  - 登录
  - codegen
  - confirm
  - publish
  - backtest
  - deploy
- 当前新的首个阻断点已经后移到：
  - **runtime signal execution**

---

## 9. 当前判断

对 Issue 856 而言，当前 staging 线上状态可分层表述为：

### 已验证通过
- publish truth 保真：通过
- snapshot → backtest truth 传递：通过
- snapshot → deploy binding truth 传递：通过
- deploy 成功后实例进入 `running + TESTNET`：通过

### 当前未通过
- deploy 后 on_start runtime execution 产出 signal：**未通过**

### 当前线上最关键症状
- `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`

---

## 10. 后续建议

1. 重点排查 quantify staging 在 `2026-04-22 02:11:35 UTC` 附近的 runtime / signal 相关日志：
   - `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
   - script runtime decision
   - generated signal payload
   - signal persistence
2. 对照本次 published snapshot：
   - `publishedSnapshotId = cmo9f1eze0wq1npqs7grm6flw`
   - `strategyInstanceId = cmo9f1eyo0wpznpqs8h5cs4lh`
3. 优先确认为什么：
   - 回测已经产出 `1` 笔交易
   - 但同一 published snapshot 在 deploy 后手动 trigger 却是 `no signal`
4. 若需要继续线上复验，可复用本次 deploy 实例直接查日志与数据库，不必再重建一轮策略。

---

## 11. 根因归因（代码级）

本次继续沿 staging 数据与 runtime 代码路径做了下钻，根因已经可以明确到**signal generation 决策归一化层**，而不是 OKX testnet 集成层。

### 11.1 staging 真实市场数据与 runtime 决策并不缺失

针对本次 deploy 使用的快照：

- `publishedSnapshotId = cmo9f1eze0wq1npqs7grm6flw`
- `strategyInstanceId = cmo9f1eyo0wpznpqs8h5cs4lh`

直接读取 quantify staging 数据库可确认：

- `market_symbols` 中存在 `ORDIUSDT:SPOT`
- `market_bars` 中存在 `ORDIUSDT:SPOT / 1h` 的最新 final bars

最近 3 根 1h 收盘价为：

- `2026-04-22T00:00:00.000Z` -> `4.701`
- `2026-04-22T01:00:00.000Z` -> `4.738`
- `2026-04-22T02:00:00.000Z` -> `4.728`

将 snapshot 持久化下来的 `ast_snapshot` 与上述真实 bars 代入 compiled runtime，并注入与 staging 相同的：

- `__compiledDecisionState.barIndex = 1`
- `executionSemanticKey = on_start.entry.primary`

得到的表达式与决策结果是：

- `onStart = true`
- `exitGte1Pct = false`
- `takeProfitHit = false`
- `decision.action = OPEN_LONG`
- `decision.size = { mode: 'RATIO', value: 0.1 }`

这说明：

> runtime 并不是“脚本根本没跑”或“市场数据没拿到”，而是脚本已经算出了一个明确的 `OPEN_LONG` 入场决策。

### 11.2 真正丢失信号的层：strict published codegen signal payload 校验

在 runtime 路径中，`SignalGeneratorService.generateSignalWithAi()` 会把 compiled decision 转成 strict prompt data，然后再走一次 `buildPublishedCodegenSignalPayload()` 校验。

关键代码：

- `apps/quantify/src/modules/strategy-signals/services/signal-generator.service:1132-1159`
- `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts:192-255`
- `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts:323-366`

本次 staging 实例代入后，`buildStrictPublishedPromptDataFromDecision()` 产出的数据为：

- `direction = BUY`
- `signalType = ENTRY`
- `entryPrice = 4.728`
- `positionSizeRatio = 0.1`
- `reasoning = compiled.decision_01_entry-execution-on_start-210`

但是它**没有**填出：

- `confidence`
- `stopLoss`
- `takeProfit`

而 `buildPublishedCodegenSignalPayload()` 对 strict published codegen payload 的要求是：

- `confidence !== undefined`
- `stopLoss !== undefined`
- `takeProfit !== undefined`

否则直接返回：

- `type: 'none'`
- `reason: 'INVALID_NORMALIZED_SIGNAL'`

因此本次链路的真实行为是：

1. compiled runtime 先算出 `OPEN_LONG`
2. strict prompt data 丢失 `confidence / stopLoss / takeProfit`
3. direct-signal 校验判定为 `INVALID_NORMALIZED_SIGNAL`
4. `generateSignalWithAi()` 返回 `null`
5. `signal-generator.service` 将其统一记成：
   - `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
6. `strategy_signals` 不落库
7. `user_signal_executions / positions` 当然也不会落库

### 11.3 为什么回测能成功，但 runtime no-signal

回测路径使用的是 compiled runtime adapter，直接消费：

- `exprPool`
- `guards`
- `decisionPrograms`
- `runDecisionPrograms()`

对应代码见：

- `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts:80-120`

它直接把 compiled decision 用作 backtest 决策，不要求额外补齐 `confidence / stopLoss / takeProfit`。

而 runtime published-snapshot 路径多了一层“strict direct signal 归一化校验”，并在这层把本来有效的 `OPEN_LONG` 决策拦掉了。

所以当前 staging 出现了一个非常具体的分叉：

- **backtest**：compiled decision 可直接成交，链路通过
- **runtime**：同一 compiled decision 在 strict signal payload 校验层被拒绝，链路中断

### 11.4 为什么到不了 OKX 模拟交易所

不是因为 OKX testnet 下单失败，也不是因为执行器路由错了。

真正原因是：

> 在进入交易所执行器之前，系统根本没有生成任何 `strategy_signals` 记录。

执行链路要走到 OKX testnet，必须先满足：

1. `createSignalWithCooldownAndLock()` 成功创建 `strategy_signals`
2. 触发 `TradingSignalCreatedEvent`
3. `signal-executor.service` 消费该 signal
4. 才会继续创建 `user_signal_executions` 并尝试交易所落单

但本次 staging 数据库已经明确表明：

- `strategy_signals = 0`
- `user_signal_executions = 0`
- `positions = 0`

因此：

> 当前问题发生在**交易所执行之前**，属于“信号未生成”而不是“信号生成了但没落到 OKX 模拟交易所”。

### 11.5 现在最值得 grep 的日志

当前代码下，最关键的现有日志入口是：

1. 脚本执行成功日志  
   `apps/quantify/src/modules/strategy-signals/services/signal-generator.service:784-786`
   - grep 关键字：`Script executed successfully for strategy`

2. runtime no-signal 统一遥测  
   `apps/quantify/src/modules/strategy-signals/services/signal-telemetry.service:22-35`
   - grep 关键字：
     - `Signal generation skipped`
     - `phase=execution`
     - `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`

3. 本次策略模板 / 实例关键 ID
   - strategy template id：`cmo9f1eyh0wpynpqsyfmcuf4v`
   - strategy instance id：`cmo9f1eyo0wpznpqs8h5cs4lh`
   - snapshot id：`cmo9f1eze0wq1npqs7grm6flw`

需要注意的是：

> 当前代码并**没有**在 `INVALID_NORMALIZED_SIGNAL` 被判定时打印专门日志；它最终只会在外层被折叠成 `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`。  
> 所以如果要让线上日志直接暴露根因，后续应在 `buildPublishedCodegenSignalPayload()` 返回 `type: 'none'` 的分支补充 reason 级别日志。

---

## 12. 一句话结论

> staging 现在已经能完成 ORDIUSDT 用例的生成、发布、回测、部署闭环；当前首个线上阻断点不再是 codegen，而是 deploy 后 runtime 执行阶段返回 `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`，导致没有 signal / execution / position 落库。
