# Phase 5 S3 Plan Critic Round 1

## 总评
**REJECT** — 5 Critical / 6 Major / 3 Minor

Plan 在 substrate 复用、决策表完整度、acceptance 颗粒度上写得不错，但有 5 处严重问题：caller 注入路径与 packages/shared `Bar` 字段事实不符，`ctx.data` 索引 key 错误（leg id vs symbol），signal-generator 走的 `buildPublishedStrategyContext` 根本不写 `ctx.data`，alignment 数学公式在 strict 边界上有 off-by-one，alignmentPolicy 默认值 `tolerant` 与 fail-closed 主张相悖。

---

## Critical（5）

### [C1] caller 注入信号源字段不存在 / 索引 key 错误
- 位置: plan §4.8 + §8 风险表第 2 条 + §9 关注点 #2
- 现状: plan 写"`bar.openTime + duration`""`ctx.data[symbol][tf]`"
- 缺陷: `Bar`（packages/shared/.../technical-indicators.ts:9）只有 `{open, high, low, close, volume, timestamp}`，无 `openTime`/`closeTime`。backtest runner 注入 `ctx.data` 时索引到字面 `'primary'` legId（backtest-runner.service.ts:959/974），不是 symbol。
- 修复建议: helper 改为 `ctx.data?.[legId]?.[tf]?.bars`，`legId` 取 `ctx.legs[0]?.id ?? 'primary'`；`lastClosedBarTs = bars.at(-1)?.timestamp`（毫秒，与 backtest-runner.service.ts:990 `ts: bar.closeTime` 一致）。

### [C2] signal-generator 路径压根不注入 `ctx.data`
- 位置: plan §4.8 / Acceptance A9
- 现状: live 与 backtest 都"派生"
- 缺陷: `signal-generation-decision.stage.ts:454-481` `buildPublishedStrategyContext` 调用 single-leg `buildStrategyContext()`，返回字段 `{bars, symbol, timeframe, indicators, currentPrice, timestamp, params}`，**没有 `data`**。Live 端用户配 scope.timeframe 后会被永久 NOOP，破 userspace。
- 修复建议: 必须在 plan 内显式做出选择并落到代码：(a) 扩 `buildPublishedStrategyContext` 透传 multi-leg snapshot；(b) live 端 readiness 加 caller capability flag 阻止 scope.timeframe 通过；(c) NL gateway 在 live 上下文不产 timeframe_scope frame。任意一条都要明确，并加 publication-time 防呆。

### [C3] alignment 数学公式 strict 语义不正确
- 位置: §4.7.3 与 §9 #1
- 现状: `maxLagMs = strict ? requiredDurationMs : 2 × requiredDurationMs`
- 缺陷: primary=15m / required=1h，primary 在 15:15 收 bar、1h 还停在 15:00（lag=15min），strict 也通过——这不符 §9 自述"strict 时只允许上一根 1h close 已发生"。tolerant 容忍 2h 延迟等价不校验。
- 修复建议: 改为 bar-bucket 比较：`bucketRequired(ts) = Math.floor(ts / requiredDurationMs)`。strict: 两边 bucket 必须相同；tolerant: bucket diff ≤ 1。这样 case 落到正确边界。

### [C4] alignmentPolicy 默认 `'tolerant'` 与 fail-closed 主张冲突
- 位置: §4.10 / §9 #3
- 缺陷: #1109 acceptance bullet #3 主旨"runtime 对数据缺失/未对齐/延迟输入 fail-closed"。tolerant 默认让大多数策略走宽松路径——违 fail-closed。
- 修复建议: 默认改 `'strict'`；utterance 出现"宽松对齐"/"tolerant alignment" 才落 tolerant。

### [C5] readiness `validateScopeNode` dispatch 改造可能破坏 S2 已 ship 行为
- 位置: §4.2 dispatch
- 缺陷: 改 dispatch 内部分支需要确保 S2 现有 readiness spec（symbols_overlap / primary_collision / 多 scope 隔离）在 timeframe sibling 共存时仍 pass。
- 修复建议: T2 commit 前列出 S2 现有 readiness spec 全名清单 + 加 1 spec：locked scope.symbol + locked scope.timeframe sibling 共存 → 互不污染 missingSlot。

---

## Major（6）

### [M1] 串联顺序 missing_binding 多 ref 上报策略未明
- 修复建议: trigger 同时缺两 ref → 上报两个 slot；golden corpus Section B 加 case。

### [M2] NL gateway 触发短语与 `strategy.multi_timeframe` HTF filter atom 撞车
- 修复建议: 去掉"高周期"/"低周期"/"周期过滤"，锁定 scope-binding 词组（"主周期"+"依赖周期"/"primary"+"required timeframes"）；golden corpus 加 negative：HTF filter utterance 不产 timeframe_scope frame。

### [M3] `requiredTimeframes` 上限 8 检查未列入 fail-closed 项
- 修复建议: §4.2 拆开 4 项；A2 / golden corpus 显式覆盖 length=9 fail-closed。

### [M4] `unbound_program` 决策表"恰好 1 个 ambient" 路径与 §9 #4 自相矛盾
- 修复建议: 与 S2 分歧：S3 任意数量 timeframe scope（≥1）都强制 program 显式 `timeframeScopeRef`（不要 ambient）；理由：timeframe alignment 是 per-program runtime 校验，必须有显式 binding。`applyTimeframeScopeBindingFailClosed` 改为 ≥1 强制（与 S2 ≥2 不同；plan §4.3 显式记录差异成因）。

### [M5] golden corpus 缺 phase0 不支持 scope key 仍 unsupported negative
- 修复建议: 加 1 case：scope.dataSource 节点 → readiness `unsupported_kind` slot。

### [M6] dataRequirements 与 scope.timeframe.requiredTimeframes 一致性未理清
- 修复建议: §4.4 spec builder 段加：scope.timeframe locked 节点存在时，`spec.dataRequirements.requiredTimeframes` 合并 union dedup primary + requiredTimeframes，让既有 backtest HTF 拉数路径自动覆盖。Acceptance 加 A_new。

---

## Minor（3）

### [m1] `parseTimeframeMs` 双 white-list drift 风险
### [m2] union 字段在 IR / AST 透传段未显式列全
### [m3] §6 T11 "no commit" 表述

---

## Summary

REJECT — 必修条目（C1-C5 + M1-M6 全数）。满足后进入 Round 2。
