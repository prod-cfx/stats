# Decision: Multi-leg 派单失败语义 — Fail-fast + saga compensate

**Date:** 2026-05-12
**Status:** Accepted
**Issue:** #1186
**Refs:** #1175, Plan `docs/superpowers/plans/2026-05-11-multi-leg-downstream-multi-pr.md` (PR4), Decision `docs/decisions/2026-05-12-multi-leg-spec-shape.md`, Critic Round 1 OQ-5

## 背景

PR4 落地后，`spec.orchestration.legScopes[*].legSizing` 会在 signal-generator 处 fan-out 为每条 leg 一条 Signal（典型场景：双腿 → 两条 Signal，amount 100 / 200）。下单链路在 emit 与 execute 两个阶段都可能失败（exchange API 限流 / 余额不足 / 网络抖动 / executor 服务故障）。

**多腿派单天生缺乏跨 leg 原子性**：交易所没有 "多 symbol 一次性 ALL-OR-NOTHING" 的下单 API，必然存在 "腿 A 已成交、腿 B 未成交" 的中间态。这个中间态如果不主动收敛，对冲场景下用户会暴露在裸单方向风险中。

候选语义：

- **A — Fail-fast + saga compensate**：腿 A 已成交、腿 B emit/execute 失败 → 立即 market close 腿 A，整体 status 标记 FAILED + audit log
- **B — Partial dispatch**：腿 A 成交、腿 B 失败 → 整体 status 标记 PARTIAL，保留腿 A 持仓
- **C — Atomic ALL-OR-NOTHING**：emit 前 simulate 全部 leg、全部成功才正式提交

## 决策

**选定：A — Fail-fast + saga compensate**

### 语义细节

1. **emit 阶段失败**：第一条 leg emit 之前若任一 leg 校验失败（symbol 不可交易 / amount 低于 minNotional / 余额不足）→ 整批拒绝 emit，integration status=FAILED，**无补偿动作**（无任何持仓变化）。
2. **execute 阶段失败**：腿 A 已 EXECUTED，腿 B emit 失败 / execute 失败 / 超时 → executor 触发 saga compensate，对腿 A 提交 `market close` 反向单（reduce-only），整体 status=FAILED + audit log 记录 saga entry。
3. **compensate 失败**：market close 腿 A 自身失败（如交易所宕机）→ 整体 status=FAILED + 升级到运维告警（capability：existing alerting hook，PR4 实施时复用）；不做无限重试。

### Scope 限制（关键）

**本决策只覆盖：**

- spot 单交易所
- 同账户
- 同 strategy instance
- 同 symbol-group（双腿都属同一对冲对，例如 `BTC-spot-A` 与 `BTC-spot-B`）

**不覆盖（独立 issue）：**

- perp 对冲（涉及保证金/资金费率，saga compensate 语义不同）
- 多账户（跨账户 saga 需要分布式事务编排）
- 多交易所（跨所 latency / 余额隔离）
- 跨 symbol 套利（saga compensate 的"对冲腿"不是 reduce-only 而是反向开仓）

PR4 实施时如发现 LLM 产出的 utterance 落入 scope-out 范围，readiness 必须 hard-fail（PR3 选项 A 已落 `READINESS_PER_ORDER_BUDGET_MISSING`，PR4 在 dispatch 入口加单独的 scope guard ErrorCode，不在 PR1 引入）。

## 备选方案及拒绝理由

### 方案 B — Partial dispatch（保留腿 A）

**拒绝原因：**

1. **裸仓暴露**：双腿对冲的本意是双向锁定 PnL，单腿成交意味着用户暴露在裸单方向风险；策略 utterance 的语义意图被破坏。
2. **status 语义模糊**：PARTIAL 状态对下游 PnL / portfolio aggregator 不可定义（半 leg 是否纳入策略统计？是否扣预算？）。
3. **回滚责任错位**：用户发现裸仓时已是 N 分钟后，由用户手动平仓的体验远差于 saga 自动 market close。

### 方案 C — Atomic ALL-OR-NOTHING via simulate-then-commit

**拒绝原因：**

1. **交易所无原生支持**：所有主流 spot exchange 都不提供 multi-symbol atomic order API；自研 simulate 无法穷尽 race condition（simulate 通过 + commit 时余额已被并发挂单消耗）。
2. **延迟翻倍**：simulate + commit 等于双倍 round-trip，在波动行情下 amount 早已偏离 simulate 时报价。
3. **复杂度爆炸**：要做到真原子需要在 executor 层引入 2PC（two-phase commit）+ 余额预占机制，远超 #1186 scope。

## 实施约束（写给 PR4）

- saga compensate 的触发位：`signal-executor.service.ts:executeSignalForUser` 在 `signal.metadata.totalLegs > 1` 分支检测同 `strategyInstance + batch` 内伙伴腿 emit/execute 失败 → 触发 compensate
- compensate 单形态：`market` order，`reduce-only=true`（spot 模拟通过卖出全部持有）
- audit log entry：必须含 `legId / strategyInstanceId / triggerCause: 'sibling_leg_failed' / compensateOrderId`
- compensate 自身失败的告警 capability：复用现有 alerting hook（具体复用哪个，PR4 trace 阶段确定）
- e2e 哨兵：PR4 Task 5 case 2 必须覆盖 "腿 B emit fail → 腿 A market close 成功 + 整体 FAILED + audit log 含 saga entry"

## 后续工作（不在本 issue 范围）

- perp 对冲 saga：独立 issue，需先定义 perp 仓位的 "compensate 反向单" 语义（开 short 平 long vs 直接 reduce）
- 多账户 saga：独立 issue，需引入 distributed transaction coordinator
- 跨 symbol 套利 saga：独立 issue，compensate 路径 = 反向开仓而非 reduce-only
- compensate 失败的人工介入工单流程：独立 ops issue
