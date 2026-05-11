# Decision: Multi-leg per_order_budget readiness 判定语义

**Date:** 2026-05-11
**Status:** Accepted
**Issue:** #1186
**Refs:** #1175 (前置 sizing 证据归一与多锚模型已 ship), Decision `docs/decisions/2026-05-11-per-trade-sizing-evidence-capability.md`

## 背景

`SemanticState.isMultiLeg=true` 表示 `PerTradeSizingResolver.resolve()` 返回的 `Map<string, SizingAnchor>` 含 ≥2 个 `executionAnchored` anchor（典型场景：两条 leg 各自的 action 上挂 `capital.allocate.per_order_budget` capability）。

当前 `semantic-contract-readiness.service.ts:hasCapability` 在判断 `capital.allocate.per_order_budget` requirement 时：

- 通过 `CapabilityEvidenceIndex.byKey('capital','allocate','per_order_budget')`
- `filter(e => e.ownerStatus === 'locked')`
- `evidences.some(e => hasRequiredCapabilityShape(...))`

**`some` 语义对单仓 sizing 正确**（任一 owner anchored 即满足），但对多腿场景隐式过宽：

- 多腿用例下，假设 leg-A action anchored / leg-B action 未 anchored，`some` 仍判 satisfied
- 后果：`canCompileOrderProgram` 通过，进入 builder 后 leg-B 因缺 anchor 被静默丢弃 → 与 #1175 起点同模式（对话不报错但下游崩）

## 决策

**选定：选项 A — Per-leg anchored**

多腿场景下，`per_order_budget` requirement 的满足判定改为：**每条 leg 各自 capability 都 anchored 才 satisfied**。

判定规则（伪码）：

```
if (state.isMultiLeg === true):
  resolved = PerTradeSizingResolver.resolve(state)
  per_order_budget satisfied
    iff (resolved.size === number_of_executable_legs)
        && every anchor in resolved is executionAnchored
else:
  // 单仓路径：保留现有 some 语义，零行为变更
  hasCapability(...) as today
```

`number_of_executable_legs` 由 builder/resolver 共同口径定义（见 PR2 实现：state.actions.filter(a => a.status==='locked').length 或 resolver scope key 集合大小，二者必须一致）。

## 备选方案及拒绝理由

### 选项 B — 全局 budget cap

聚合所有 leg 的 budget value，总额 ≤ 全局 `riskRules.totalCap` 才 satisfied。

**拒绝原因：**

1. **引入新概念**：当前 `SemanticState` 无"全局 cap"字段；要么新增 contract，要么外挂 checklist，违反 KISS
2. **跨多腿 axis 计算困难**：leg-A 用 `notional_quote=100`、leg-B 用 `equity_ratio=0.1` 时无法相加（需 runtime 价格 + 账户净值），把 readiness 这一**编译期门禁**强行下沉成 runtime 决策
3. **风控边界错位**：账户级总额风控本应由独立的 portfolio-level risk module 承担（如 `risk.portfolio.drawdown`、`risk.portfolio.cap`），与 per-trade sizing 解耦更清晰
4. **当前 issue 未要求**：#1186 验收标准只要求"双 leg 各自金额匹配"，未要求总额受控

### 选项 C — 沿用 `some` 不动

完全沿用 #1175 单仓 readiness 路径。

**拒绝原因：**

1. **直接破坏 #1186 验收标准**：会导致单 leg 缺 anchor 仍判 satisfied，下游静默丢 leg
2. 与 PR3 contract-readiness spec 新增"单 leg 缺 anchored 不满足" case 直接冲突

## 实施约束（写给后续 PR）

- 该判定语义只触发于 `state.isMultiLeg === true`；单仓路径 `hasCapability` 行为零变更（向后兼容）
- 实施位置：`semantic-contract-readiness.service.ts:hasCapability` 内的 per_order_budget 分支，新增 `if (state.isMultiLeg) {...}` 早返
- 错误码：单 leg 缺 anchor 时复用现有 `READINESS_PER_ORDER_BUDGET_MISSING`（如已存在），否则按 #1175 同模式新增 ErrorCode 并落 `packages/shared/src/constants/error-codes.ts`

## 后续工作（不在本 issue 范围）

- 全局账户总额风控：独立 issue 单独走 `risk.portfolio.*` capability 路径
- 多腿 budget 跨 axis 归一（quote/ratio 混合预估）：等 portfolio module 落地后再议
