# AI量化个人中心策略详情优先 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在个人中心 AI量化 Tab 增加“我的策略列表”并支持进入策略详情页，使用前端 mock 数据完整展示关键策略表现。

**Architecture:** 以 `localStorage` 作为前端 mock store，新增策略模型与 seed 数据，个人中心列表和详情页共用同一读取逻辑。列表作为入口，详情页聚合指标、收益曲线、参数快照、时间线；异常时自动回退 seed，保证页面可用。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS（Coinflux design tokens）, Jest（front）

---

### Task 1: 建立 AI 量化策略 Mock Store

**Files:**
- Create: `apps/front/src/components/account/ai-quant-strategy-store.ts`
- Test: `apps/front/src/components/account/ai-quant-strategy-store.test.ts`

**Step 1: Write the failing test**

```ts
import { ensureStrategyStore, getStrategyById } from './ai-quant-strategy-store'

test('seeds store on first load and can get strategy by id', () => {
  localStorage.clear()
  const list = ensureStrategyStore()
  expect(list.length).toBeGreaterThanOrEqual(3)
  expect(getStrategyById(list[0].id)?.id).toBe(list[0].id)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

```ts
export interface AiQuantStrategyRecord {
  id: string
  name: string
  status: 'running' | 'stopped' | 'draft'
  exchange: 'binance' | 'okx'
  symbol: string
  timeframe: string
  positionPct: number
  metrics: { returnPct: number; maxDrawdownPct: number; winRatePct: number; tradeCount: number }
  equitySeries: Array<{ ts: string; value: number }>
  timeline: Array<{ at: string; event: string; note?: string }>
  updatedAt: string
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/ai-quant-strategy-store.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts
git commit -m "feat(front): add ai-quant strategy mock store for account"
```

### Task 2: 在个人中心 AI量化 Tab 展示“我的策略”列表

**Files:**
- Create: `apps/front/src/components/account/AiQuantStrategyList.tsx`
- Modify: `apps/front/src/components/account/AiQuantSection.tsx`
- Modify: `apps/front/src/app/[lng]/account/page.tsx`
- Test: `apps/front/src/components/account/AiQuantStrategyList.test.tsx`

**Step 1: Write the failing test**

```tsx
test('renders strategy rows and view detail button', () => {
  // render list with seeded data
  // expect status badge and 查看详情 buttons
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyList.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// 展示策略名、状态、更新时间、交易所/交易对/周期/仓位
// 操作按钮：查看详情 -> /[lng]/account/ai-quant/strategy/[id]
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyList.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantStrategyList.tsx apps/front/src/components/account/AiQuantSection.tsx apps/front/src/app/[lng]/account/page.tsx apps/front/src/components/account/AiQuantStrategyList.test.tsx
git commit -m "feat(front): show ai-quant strategy list in account tab"
```

### Task 3: 新增策略详情路由与详情页面

**Files:**
- Create: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/page.tsx`
- Create: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
- Create: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Test: `apps/front/src/components/account/AiQuantStrategyDetail.test.tsx`

**Step 1: Write the failing test**

```tsx
test('renders four key metrics and timeline in strategy detail', () => {
  // render detail with mock record
  // expect 收益率/最大回撤/胜率/交易次数 and timeline events
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// 指标卡 + 折线图容器（先用 SVG/polyline 或简化 div chart）
// 参数快照 + 运行时间线
// 顶部返回按钮
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/page.tsx apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx apps/front/src/components/account/AiQuantStrategyDetail.tsx apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
git commit -m "feat(front): add ai-quant strategy detail page in account center"
```

### Task 4: 空态与异常态处理

**Files:**
- Modify: `apps/front/src/components/account/ai-quant-strategy-store.ts`
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx`
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Test: `apps/front/src/components/account/ai-quant-strategy-store.test.ts`

**Step 1: Write the failing test**

```ts
test('fallbacks to seed when storage payload is invalid json', () => {
  localStorage.setItem('ai_quant_strategy_store_v1', '{bad-json')
  const list = ensureStrategyStore()
  expect(list.length).toBeGreaterThanOrEqual(3)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
// try/catch parse
// invalid => rewrite seed and return
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/ai-quant-strategy-store.ts apps/front/src/components/account/AiQuantStrategyList.tsx apps/front/src/components/account/AiQuantStrategyDetail.tsx apps/front/src/components/account/ai-quant-strategy-store.test.ts
git commit -m "feat(front): add empty and fallback states for ai-quant strategy views"
```

### Task 5: 样式一致性与回归验证

**Files:**
- Modify: `apps/front/src/components/account/AiQuantSection.tsx`
- Modify: `apps/front/src/components/account/AiQuantStrategyList.tsx`
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Modify: `docs/plans/2026-03-06-ai-quant-strategy-detail-design.md`

**Step 1: Run targeted lint for changed files**

Run:
`cd apps/front && npx eslint --config ../../eslint.config.js --ext .ts,.tsx src/components/account 'src/app/[lng]/account'`
Expected: no error

**Step 2: Run tests for new modules**

Run:
`pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts apps/front/src/components/account/AiQuantStrategyList.test.tsx apps/front/src/components/account/AiQuantStrategyDetail.test.tsx --runInBand`
Expected: PASS

**Step 3: Build verify**

Run: `dx build front --dev`
Expected: PASS，路由包含 `/<lng>/account/ai-quant/strategy/[id]`

**Step 4: Manual smoke checklist**

```text
1) /zh/account?tab=ai-quant 可见列表
2) 点击“查看详情”进入详情路由
3) 详情指标与时间线展示完整
4) 非法 id 显示友好空态并可返回
5) 刷新后数据仍可读
```

**Step 5: Commit**

```bash
git add apps/front/src/components/account/AiQuantSection.tsx apps/front/src/components/account/AiQuantStrategyList.tsx apps/front/src/components/account/AiQuantStrategyDetail.tsx docs/plans/2026-03-06-ai-quant-strategy-detail-design.md
git commit -m "docs(front): finalize ai-quant account strategy detail mvp"
```
