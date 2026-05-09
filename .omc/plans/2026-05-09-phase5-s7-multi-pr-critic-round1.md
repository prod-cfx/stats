# S7 Plan Critic — Round 1

**审稿对象：** `docs/superpowers/plans/2026-05-09-ai-quant-phase-5-s7-portfolio-drawdown.md`
**Issue：** #984 Phase 5 验收 bullet #10(portfolio)
**Verdict：** **REVISE**

## 决策矩阵

| 类别 | 数量 |
|---|---|
| Critical | 1 |
| Major | 3 |
| Minor | 4 |
| What's Missing | 6 |

## Critical

### C1: drawdownPct 数据源在生产代码中不存在

`StrategyExecutionContextV1` 当前没有 drawdownPct 字段。plan Task 13.3/14.3 把"加 ctx 字段"塞在一行里，未列入 Files/Acceptance/测试。

**Fix：**
1. Files.Modify 加 `packages/shared/src/strategy-protocol.ts` （`accountDrawdownPct?: number`）
2. Files.Modify 加 `apps/quantify/src/modules/strategy-runtime/strategy-script-compiler.util.ts:95` interface 字符串模板
3. Files.Modify 加 `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts:31`
4. 新增 Task 12.5 backtest engine 维护 peakEquity + 注入 ctx.accountDrawdownPct
5. 新增 Task 12.6 live signal drawdown 来源（如生产侧暂无 → live enforce 留 follow-up issue，本 PR live 仅 ship observe）
6. golden corpus 新增 case：enforce + ctx.accountDrawdownPct undefined → fail-closed double block

## Major

### M1: portfolioRiskState 类型签名

plan Step 12.2 写 `OrchestrationGateState`，但 Step 11.2 定义 `OrchestrationPortfolioRiskState extends OrchestrationGateState`。observedBreaches 会丢。**Fix：** 改为 `portfolioRiskState?: OrchestrationPortfolioRiskState`。

### M2: observe + drawdownPct undefined 语义自相矛盾

plan 头部"observe undefined no-op 不记录"vs Step 11.2 实现"breached=true → 记录 observedBreaches"vs case 列表"observe 无效"。三处不一致。

**Fix：** 收敛为：
- `enforce + undefined drawdownPct` → fail-closed double block
- `observe + undefined drawdownPct` → 完全 no-op（不阻挡、不记录，无 evidence）
- 重写 evaluator 实现：

```ts
const dd = ctx.drawdownPct
if (!Number.isFinite(dd)) {
  if (risk.mode === 'enforce') { blockLong = true; blockShort = true }
  continue
}
if ((dd as number) < risk.thresholdPct) continue
if (risk.mode === 'enforce') { blockLong = true; blockShort = true }
else observedBreaches.push(risk.id)
```

### M3: parity 测试范围过窄

Task 15.1 仅 3 cases。**Fix：** 至少 5 cases，加：
- observe 触发 → 两路 observedBreaches toEqual
- portfolioRisk enforce + gate.regime 同时触发 → 两路 reason 一致

## Minor

- m1: Task 6 fail-closed 数对不上（标 5 实列 7）— 改"7 重 fail-closed"或合并归类
- m2: presentation registry 内部 key 检查列表加 `drawdown_block` / `enforce` / `observe`
- m3: Task 17.1 改 `dx test` 而非 `pnpm exec jest`
- m4: drawdownPct 单位约定 — 显式注释 0..100 浮点

## What's Missing

1. drawdownPct 单位/符号约定（参考 account-strategy-view.service.ts:1970 `(peak-current)/peak * 100` 输出正数）
2. 边界场景：peak=0 / 第一个 bar / equity 增长 (dd<0) → evaluator 必须保证不触发 breach
3. canonical fingerprint 是否随 portfolioRisks 增删变化的回归断言
4. API contracts 漏到 backend 的回滚预案
5. observe → enforce 切换灰度路径（编辑 prompt？UI toggle？）
6. 老策略 deployedAtSemanticVersion=null 升级路径

## 升级到 ACCEPT 的最低条件

1. C1 数据源补全
2. Task 12 类型签名修
3. Step 11.2 evaluator 重写
4. Task 15 parity ≥5 cases
5. Task 12.5/12.6 显式 ctx feeding 路径
