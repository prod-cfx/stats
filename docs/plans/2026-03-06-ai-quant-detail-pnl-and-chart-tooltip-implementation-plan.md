# AI量化策略详情收益额与曲线交互增强 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在策略详情页新增“总收益额 + 今日收益”展示，并为收益曲线增加 hover tooltip（时间点 + 相邻点变化百分比）。

**Architecture:** 基于现有 `equitySeries` 在详情组件内推导总收益额/今日收益，不引入后端接口。曲线继续使用 SVG 渲染，新增 hover 交互层（hover 索引、参考线、tooltip），并处理边界显示。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, localStorage mock 数据

---

### Task 1: 增加收益金额衍生计算工具

**Files:**
- Create: `apps/front/src/components/account/pnl-metrics.ts`
- Test: `apps/front/src/components/account/pnl-metrics.test.ts`

**Step 1: Write the failing test**

```ts
import { derivePnlMetrics } from './pnl-metrics'

test('derives total and today pnl from equity series', () => {
  const metrics = derivePnlMetrics([
    { ts: '2026-03-06 09:00', value: 100 },
    { ts: '2026-03-06 10:00', value: 108 },
  ])
  expect(metrics.totalPnlAmount).toBe(8)
  expect(metrics.todayPnlAmount).toBe(8)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export function derivePnlMetrics(series) {
  // total pnl, today pnl, guard empty series
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/pnl-metrics.ts apps/front/src/components/account/pnl-metrics.test.ts
git commit -m "feat(front): add pnl amount derivation utility"
```

### Task 2: 策略详情卡片新增“总收益额 + 今日收益”

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

**Step 1: Write the failing test**

```tsx
test('shows total pnl amount with today pnl subtext', () => {
  // render detail
  // expect text: 总收益额, 今日 +x.xx
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// add new metric card
// primary: total pnl amount
// secondary: 今日收益 +/-
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantStrategyDetail.tsx
git commit -m "feat(front): show total and today pnl amount in strategy detail"
```

### Task 3: 收益曲线增加 hover 交互层

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

**Step 1: Write the failing test**

```tsx
test('shows tooltip with time and adjacent change pct on hover', async () => {
  // hover chart point
  // expect tooltip contains 时间 and 变化 +/-x.xx%
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// state: hoverIndex
// render vertical guide + point marker
// tooltip: ts + adjacent delta pct
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantStrategyDetail.tsx
git commit -m "feat(front): add chart hover tooltip for adjacent change pct"
```

### Task 4: 边界条件与格式化统一

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Modify: `apps/front/src/components/account/pnl-metrics.ts`

**Step 1: Write the failing test**

```ts
test('returns -- for adjacent change at first point', () => {
  // first point has no previous point
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// format helpers for sign + 2 decimals
// first point => '--'
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantStrategyDetail.tsx apps/front/src/components/account/pnl-metrics.ts apps/front/src/components/account/pnl-metrics.test.ts
git commit -m "fix(front): normalize pnl tooltip edge cases and formatting"
```

### Task 5: 验证与文档同步

**Files:**
- Modify: `docs/plans/2026-03-06-ai-quant-detail-pnl-and-chart-tooltip-design.md`

**Step 1: Run focused lint**

Run: `cd apps/front && npx eslint --config ../../eslint.config.js --ext .ts,.tsx src/components/account`
Expected: no error

**Step 2: Run tests**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/pnl-metrics.test.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 3: Build verify**

Run: `dx build front --dev`
Expected: PASS

**Step 4: Manual smoke checklist**

```text
1) 详情页新增“总收益额”卡片
2) 卡片下方显示“今日收益 +/-”
3) 曲线 hover 显示“时间 + 相邻点变化%”
4) 首点显示变化为 --
```

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-ai-quant-detail-pnl-and-chart-tooltip-design.md
git commit -m "docs(front): finalize pnl amount and chart tooltip enhancement"
```
