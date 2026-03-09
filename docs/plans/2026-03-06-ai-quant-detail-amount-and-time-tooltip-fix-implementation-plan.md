# AI量化策略详情金额口径与时间提示修正 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修正策略详情总收益额展示口径（总额 + 今日收益）并让曲线 tooltip 显示真实时间点与相邻点变化百分比，兼容已有本地旧数据。

**Architecture:** 在策略 store 读取入口添加轻量迁移逻辑（补 `initialCapital`、重建旧时间序列），在详情组件按新口径计算“总额”和“今日收益”，并统一 tooltip 的时间格式。保持前端 mock 模式，不引入后端依赖。

**Tech Stack:** React 19, Next.js App Router, TypeScript, localStorage, Tailwind CSS

---

### Task 1: 扩展策略模型与迁移器

**Files:**
- Modify: `apps/front/src/components/account/ai-quant-strategy-store.ts`
- Test: `apps/front/src/components/account/ai-quant-strategy-store.test.ts`

**Step 1: Write the failing test**

```ts
test('migrates legacy T-series timestamps and fills initialCapital', () => {
  localStorage.setItem('ai_quant_strategy_store_v1', JSON.stringify([
    { id:'x', name:'n', status:'running', exchange:'binance', symbol:'BTCUSDT', timeframe:'3m', positionPct:10,
      metrics:{returnPct:1,maxDrawdownPct:1,winRatePct:1,tradeCount:1}, equitySeries:[{ts:'T1', value:100}], timeline:[], updatedAt:new Date().toISOString() }
  ]))
  const list = ensureStrategyStore()
  expect(list[0].initialCapital).toBe(10000)
  expect(list[0].equitySeries[0].ts).toMatch(/^\d{4}-\d{2}-\d{2} /)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// add initialCapital on model
// migrateIfLegacy(record): convert T-series to real timestamps, fill initialCapital=10000
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/ai-quant-strategy-store.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts
git commit -m "feat(front): migrate ai-quant strategy legacy timestamps and capital"
```

### Task 2: 修正总收益额展示口径

**Files:**
- Modify: `apps/front/src/components/account/pnl-metrics.ts`
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

**Step 1: Write the failing test**

```ts
test('computes total amount from initial capital and pnl', () => {
  const out = derivePnlMetrics([{ ts:'2026-03-06 10:00', value:100 }, { ts:'2026-03-06 11:00', value:102 }], 10000)
  expect(out.totalAmount).toBe(10002)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// derivePnlMetrics(series, initialCapital)
// returns totalAmount, todayPnlAmount, totalPnlAmount
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/pnl-metrics.ts apps/front/src/components/account/AiQuantStrategyDetail.tsx
git commit -m "fix(front): correct total amount and today pnl display in strategy detail"
```

### Task 3: 统一 tooltip 时间格式与相邻点变化展示

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Modify: `apps/front/src/components/account/pnl-metrics.ts`

**Step 1: Write the failing test**

```ts
test('formats tooltip timestamp as YYYY-MM-DD HH:mm', () => {
  // expect formatted ts for tooltip
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// ensure ts formatter output full datetime
// tooltip uses adjacent delta pct and '--' for first point
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantStrategyDetail.tsx apps/front/src/components/account/pnl-metrics.ts
git commit -m "fix(front): show full datetime and adjacent change pct in chart tooltip"
```

### Task 4: 验证与收尾

**Files:**
- Modify: `docs/plans/2026-03-06-ai-quant-detail-amount-and-time-tooltip-fix-design.md`

**Step 1: Run focused lint**

Run: `cd apps/front && npx eslint --config ../../eslint.config.js --ext .ts,.tsx src/components/account`
Expected: no error

**Step 2: Run tests**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: PASS

**Step 3: Build verify**

Run: `dx build front --dev`
Expected: PASS

**Step 4: Manual smoke checklist**

```text
1) 详情卡主值显示总额（如 10020 USDT）
2) 小字显示今日 +/− 金额
3) tooltip 显示完整时间 YYYY-MM-DD HH:mm
4) tooltip 显示相邻点变化百分比
5) 旧数据迁移后不再出现 T7
```

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-ai-quant-detail-amount-and-time-tooltip-fix-design.md
git commit -m "docs(front): finalize amount and tooltip time fix"
```
