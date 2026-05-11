# Decision: Multi-leg spec shape — 复用 `CanonicalOrchestrationLegScope`，不新建 `LegSpec`

**Date:** 2026-05-12
**Status:** Accepted
**Issue:** #1186
**Refs:** #1112 (Phase 5 S11 — `CanonicalOrchestrationLegScope` ship), #1175 (per-trade sizing 证据归一与多锚模型), Plan `docs/superpowers/plans/2026-05-11-multi-leg-downstream-multi-pr.md`, Decision `docs/decisions/2026-05-11-multi-leg-budget-readiness.md`, Critic Round 1 OQ-2 / Round 2 NC1 / NC2 / NC6

## 背景

`SemanticState.isMultiLeg=true` 在 codegen 当前路径上只是一面"标记位"，下游 builder / readiness / IR / runtime / signal / summary 都没有真正消费它。多腿语义要落地需要一个统一的 spec 形态承载"每条 leg 的 sizing / 方向 / 标的 / 同步触发要求"。

落地方案有两条候选：

- **方案 A — 复用 `CanonicalOrchestrationLegScope` + `CanonicalOrchestrationLegSizing`**（已在 `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts:264-272` 与 `:258-262`，#1112 已 ship）
- **方案 B — 在 `CanonicalStrategySpecV2` 顶层新增 `legs?: LegSpec[]`** 作为 multi-leg 专属字段

Critic Round 1 已识别方案 B 与现有 `legScopes` 在 owner / asset / direction 这三个字段上 100% 重叠，属于 "同一概念两种 shape" 的典型 Garbage taste（消除特殊分支即应消除该重复）。

## 决策（共 9 条）

### 决定 1 — 复用 legScopes

**复用 `orchestration.legScopes` + `legScopes[*].legSizing`，不新增 `spec.legs` / `LegSpec`。**

理由：

1. `CanonicalOrchestrationLegScope` 字段（`id / scopeKind:'leg' / legId / direction / instrumentRef / legSizing? / syncTriggerRequired?`）已 100% 覆盖多腿 sizing 反填所需信息。
2. `CanonicalOrchestrationLegSizing`（`mode / value / pairedLegId?`）足以承载多腿"每条 leg 一个 sizing"的语义，唯一缺口（`asset`、`fixed_base` mode）由本决策决定 5 / 决定 3 补齐。
3. 重复 shape 必然引发 IR / script / runtime / signal 各层"两路读取 + 一致性兜底"的代码膨胀；消除即消除特殊分支。

### 决定 2 — 多锚 sizing 反填路径

**`PerTradeSizingResolver.resolve()` → `getExecutableLegScopes(state)` → `buildOrchestrationLegScopes` 在 `state.isMultiLeg===true` 分支补 `legSizing`。**

实施位：PR2 在 `canonical-spec-builder.service.ts:buildOrchestrationLegScopes` 注入 `PerTradeSizingResolver`，对每个 leg node 调用 `resolver.resolve(state)` 拿 anchor → 反填 `legSizing.mode/value/asset`。旧路径（LLM 直供 legSizing）保留为 fallback，`isMultiLeg===false` 时行为零变更。

### 决定 3 — `CanonicalOrchestrationLegSizingMode` 扩 `'fixed_base'`

**`CanonicalOrchestrationLegSizingMode` union 扩 `'fixed_base'`，axis 映射改为：**

| `SizingAxis`     | → `CanonicalOrchestrationLegSizingMode` |
| ---------------- | --------------------------------------- |
| `notional_quote` | `fixed_quote`                           |
| `equity_ratio`   | `fixed_pct`                             |
| `base_qty`       | `fixed_base` (本次新增)                 |
| `risk_budget`    | `null` + log.warn 跳过                  |

理由：`base_qty` axis 当前会被 silently 归入 `fixed_quote`，等同把 "0.001 BTC" 当成 "0.001 USDT"，runtime 必崩。**禁止静默归一。** PR2 case 7 设置哨兵：leg 用 `base_qty=0.001 BTC` → `legSizing.mode === 'fixed_base'`、`value === 0.001`、`asset === 'BTC'`。

### 决定 4 — Fixture 路径选 A（扩 fixture 加 `state.orchestration.nodes`）

PR2 fixture 扩展走 **路 A**：扩 `MULTI_LEG_CASE_A`/`MULTI_LEG_CASE_B` 加 `state.orchestration.nodes` 的 `scope.leg` 节点（含 `legId/direction/instrumentRef`），并显式映射到 `state.actions[*].id`。

拒绝路 B（让 builder 从 `state.actions[]` 合成 leg scopes）的理由：路 B 会改 builder 入口路径，污染现有 grid 多腿 byte-equal snapshot；路 A 只动 fixture，**最小爆炸面**。fixture 必须在 PR2 同 PR 内补完，不另起 PR。

### 决定 5 — `CanonicalOrchestrationLegSizing.asset?: string`

**扩 `CanonicalOrchestrationLegSizing` 加可选 `asset?: string` 字段**，用于多腿 quote / base 计价区分（PR2 实施）。新增字段为可选，对现有 grid 多腿 spec byte-equal 无影响（已经 NC5 由 PR2 Task 5 验证）。

### 决定 6 — `position_constraint` scope 不构成 leg

**`PerTradeSizingResolver.getExecutableLegScopes()` 仅返 `kind==='action'` 的 anchor scopeKey；`kind==='position_constraint'` scope（PR4 emit 路径用）不构成 leg。**

理由：`position_constraint` 是 "开仓后的约束"（如 `stop_loss`、`take_profit`），与 "开仓多腿" 语义正交。把它纳入 leg 集合会导致 readiness "executable_legs ≠ 实际 leg 数" 和 PR4 派单错条数。

### 决定 7 — `state.position.sizing` 互斥

**`isMultiLeg===true` 时 `spec.sizing===null`，sizing 完全经 `legScopes[*].legSizing` 承载；单腿沿用 `spec.sizing`，向后兼容。**

理由：单腿 spec 顶层 `sizing` 与多腿 `legScopes[*].legSizing` 同时填会引入 "两套 sizing 谁优先" 的歧义。多腿场景下 `spec.sizing===null` 是显式的"以 leg 为准"信号。

### 决定 8 — `spec.orderPrograms` 互斥

**`isMultiLeg===true` 与 grid `orderPrograms` 互斥**，PR2 在 spec 装配前段加 assert：`isMultiLeg && spec.orchestration?.programs?.some(p=>...grid)` → throw `MultiLegMutuallyExclusiveWithOrderProgram`。

理由：grid 路径独占 orderPrograms 编排；多腿限价独占 legScopes 派单。让两者共存会导致 PR4 派单链路同时存在 grid worker 与 multi-leg fan-out 两个 emitter，下游 signal 顺序无法定义。

### 决定 9 — leg id 命名

**沿用 LLM `legId`，`scope.id = leg-${legId}` fallback。**

理由：LLM 已稳定输出 `legId`（自然语言中"腿 A / 腿 B"映射），保持一致性可降低 PR4 e2e 调试成本；只在 LLM 漏给时由 builder 兜底拼装 `leg-${legId}`。

## 备选方案及拒绝理由

### 方案 B — 顶层 `spec.legs?: LegSpec[]`

**拒绝原因：**

1. **重复 shape**：与 `legScopes[*]` 字段 100% 重合（owner / asset / direction / sizing），属典型 "同一概念两种 shape"。
2. **下游分裂**：IR / script / runtime / signal 四层需要并存两个读取路径并加 "二者一致性" 兜底，违反 KISS。
3. **rollback 风险**：顶层新增字段 land 后回滚需要同时回 4 层消费方；复用 `legScopes` 仅扩 `asset?` / `mode` union 一处，回滚面最小。
4. **#1112 已 land**：legScopes 已是 spec 一等公民，无理由再造平行集合。

### 方案 C — 不在 spec 显式承载，全部下推 IR 推断

**拒绝原因：**

1. spec 是 LLM-codegen 与 runtime 之间的契约层，把多腿 sizing 推到 IR 推断会让 spec 失去"自包含"语义，无法做 readiness 编译期门禁（PR3 选项 A 必须依赖 spec 自身可判定）。
2. 单元测试边界塌陷：现在 builder 单测可独立验 spec 形态，IR 推断后必须跑完整 IR pipeline 才能验，回归成本暴涨。

## 实施约束（写给 PR2-5）

- PR2：实施决定 2 / 3 / 5 / 7 / 8；fixture 走决定 4 / 6
- PR3：消费决定 6 暴露的 `getExecutableLegScopes()` 共享方法
- PR4：IR / script / runtime / signal 四层透传 `legScopes[*].legSizing`，emit 多 signal
- PR5：summary 渲染 `legScopes[*].legSizing`，单腿沿用 `spec.sizing`（决定 7 互斥保证）

## 后续工作（不在本 issue 范围）

- `CanonicalOrchestrationLegSizing.pairedLegId` 在多腿对冲场景的语义（perp 对冲已 scope-out 到独立 issue，见 dispatch failure-mode decision）
- LLM 直供 legSizing 的旧路径：保留为 fallback；后续若 evidence 表明 LLM 可稳定产出多腿 sizing，可独立 issue 评估去除该 fallback
