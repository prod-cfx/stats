# AI-Quant Backtest Range Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AI-Quant 回测流程增加“历史回测区间（快捷 + 自定义）”能力，并在回测结果与详情页可追溯展示。

**Architecture:** 在现有 `AiQuantPageClient` 状态模型上扩展区间字段，新增独立区间工具模块负责区间计算与校验，`QuantChatPanel` 仅负责输入与展示，回测执行统一消费归一化区间，详情页通过路由参数展示本次回测上下文。整体遵循 KISS：不重做流程，不引入新状态库。

**Tech Stack:** Next.js App Router, React 19, TypeScript, i18next, Vitest

---

### Task 1: 回测区间核心工具（纯函数 + 单测）

**Files:**
- Create: `apps/front/src/components/ai-quant/backtest-range.ts`
- Test: `apps/front/src/components/ai-quant/backtest-range.test.ts`

**Step 1: Write the failing test (preset -> start/end)**

```ts
it('builds 30D range from now', () => {
  const now = new Date('2026-03-24T12:00:00.000Z')
  const range = resolveBacktestRange({ preset: '30D' }, now)
  expect(range.startAt).toBe('2026-02-22T12:00:00.000Z')
  expect(range.endAt).toBe('2026-03-24T12:00:00.000Z')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/backtest-range.test.ts`
Expected: FAIL with missing module/function

**Step 3: Write minimal implementation (preset resolver)**

```ts
export function resolveBacktestRange(input: { preset: BacktestRangePreset }, now = new Date()) {
  // map preset days and return normalized ISO start/end
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/backtest-range.test.ts`
Expected: PASS

**Step 5: Write the failing test (custom validation)**

```ts
it('rejects start >= end for custom range', () => {
  const result = validateBacktestRange({ preset: 'CUSTOM', startAt: '2026-03-24T10:00', endAt: '2026-03-24T09:00' })
  expect(result.ok).toBe(false)
  expect(result.reason).toBe('start_after_end')
})
```

**Step 6: Implement minimal validation**

```ts
export function validateBacktestRange(input: BacktestRangeInput): ValidationResult {
  // empty, order, max-span checks
}
```

**Step 7: Run full test file**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/backtest-range.test.ts`
Expected: PASS (包含空值、365/366 天边界)

**Step 8: Commit**

```bash
git add apps/front/src/components/ai-quant/backtest-range.ts apps/front/src/components/ai-quant/backtest-range.test.ts
git commit -m "feat(front): add backtest range resolver and validator"
```

### Task 2: 扩展 AI-Quant 状态模型与会话迁移

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/intent-storage.test.ts` (如需复用迁移模式)
- Test: `apps/front/src/components/ai-quant/session-loop.test.ts` (仅在类型联动受影响时补充)

**Step 1: Write the failing test (legacy conversation migration)**

```ts
it('fills default backtest range for legacy conversation payload', () => {
  const migrated = migrateConversation(legacyConversation)
  expect(migrated.params.backtestRangePreset).toBe('30D')
  expect(migrated.params.backtestStart).toBeTruthy()
  expect(migrated.params.backtestEnd).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/session-loop.test.ts`
Expected: FAIL with missing migration fields/function

**Step 3: Minimal implementation in page state model**

```ts
interface QuantParams {
  backtestRangePreset: BacktestRangePreset
  backtestStart: string
  backtestEnd: string
}
```

**Step 4: Wire migration when reading localStorage**

Run: add normalization when parsing stored conversations
Expected: legacy data auto-filled with defaults

**Step 5: Run targeted tests**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/session-loop.test.ts apps/front/src/components/ai-quant/intent-storage.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/session-loop.test.ts apps/front/src/components/ai-quant/intent-storage.test.ts
git commit -m "feat(front): extend ai-quant params with backtest range"
```

### Task 3: 参数面板 UI（快捷区间 + 自定义）

**Files:**
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Create: `apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`

**Step 1: Write failing UI test (preset buttons render and switch)**

```tsx
it('switches to custom mode and shows datetime inputs', async () => {
  render(<QuantChatPanel ... />)
  await user.click(screen.getByRole('button', { name: /自定义|custom/i }))
  expect(screen.getByLabelText(/开始时间|start time/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/结束时间|end time/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
Expected: FAIL with missing controls

**Step 3: Add range preset controls**

Run: implement `7D/30D/90D/1Y/CUSTOM` chips in settings panel
Expected: clicking preset updates `onParamsChange`

**Step 4: Add custom datetime inputs**

Run: render `datetime-local` inputs only for `CUSTOM`
Expected: values round-trip via `onParamsChange`

**Step 5: Add i18n keys**

Run: add labels/errors keys in zh/en `common.json`
Expected: no missing translation key in runtime

**Step 6: Re-run component test**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/components/ai-quant/QuantChatPanel.test.tsx apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json
git commit -m "feat(front): add backtest range controls to quant chat panel"
```

### Task 4: 回测执行校验与结果展示

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Test: `apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts` (如复用返回结构断言)
- Test: `apps/front/src/components/ai-quant/backtest-range.test.ts` (补充错误分支)

**Step 1: Write failing test (invalid range blocks run)**

```ts
it('returns validation error when custom range is invalid', () => {
  const check = validateBacktestRange({ preset: 'CUSTOM', startAt: '', endAt: '' })
  expect(check.ok).toBe(false)
})
```

**Step 2: Wire validation before onRunBacktest execute**

Run: in `onRunBacktest`, validate first; invalid -> push assistant error message and return
Expected: no backtest result created on invalid range

**Step 3: Extend BacktestResult with range context**

```ts
export interface BacktestResult {
  startAt: string
  endAt: string
  symbol: string
}
```

**Step 4: Display selected range in summary card**

Run: add compact display `symbol · YYYY-MM-DD ~ YYYY-MM-DD`
Expected: user can verify this backtest’s context

**Step 5: Run targeted tests**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/backtest-range.test.ts apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/BacktestSummaryCard.tsx apps/front/src/components/ai-quant/backtest-range.test.ts apps/front/src/components/ai-quant/QuantChatPanel.test.tsx
git commit -m "feat(front): validate backtest range and show range context"
```

### Task 5: 详情页最小可追溯改造

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`

**Step 1: Write failing test or contract check (route params)**

```ts
// pseudo-contract: open detail link carries symbol/start/end query
expect(detailHref).toContain('symbol=BTCUSDT')
expect(detailHref).toContain('startAt=')
expect(detailHref).toContain('endAt=')
```

**Step 2: Update detail navigation to include query params**

Run: build `URLSearchParams` when `onOpenFullScreen`
Expected: detail page gets real context

**Step 3: Render symbol + time range in detail page header/card**

Run: read `searchParams` and render with fallback
Expected: page no longer是纯 `id` 派生占位

**Step 4: Smoke test manually**

Run: `pnpm nx run front:dev` then verify in browser
Expected: chat -> backtest -> detail context consistent

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx
git commit -m "feat(front): pass and render backtest range context on detail page"
```

### Task 6: 总体验证与文档同步

**Files:**
- Modify: `apps/front/README.md` (如需补充回测区间说明)
- Modify: `docs/plans/2026-03-24-ai-quant-backtest-range-design.md` (仅在设计与实现偏差时更新)

**Step 1: Run full relevant tests**

Run: `pnpm --filter @ai/front exec vitest run apps/front/src/components/ai-quant/*.test.ts apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts`
Expected: PASS

**Step 2: Run type-check**

Run: `pnpm nx run front:type-check`
Expected: PASS

**Step 3: Run lint target used by project**

Run: `pnpm nx run front:lint`
Expected: PASS（若既有噪音，记录非本次引入）

**Step 4: Final commit**

```bash
git add apps/front/README.md docs/plans/2026-03-24-ai-quant-backtest-range-design.md
git commit -m "docs(front): update ai-quant backtest range notes"
```

