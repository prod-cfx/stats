# AI Quant Frontend-First Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Coinflux 现有视觉体系下，落地 AI 量化前端闭环：登录拦截、大对话框、策略广场、回测结果、达标门槛、一键部署引导、个人中心入口。

**Architecture:** 采用单主页面 `/{lng}/ai-quant` 承载核心交互（对话 + 策略广场 + 结果区），并增加全屏回测详情页。前端先通过 typed mock/service 协议打通流程，再替换为后端真实接口。

**Tech Stack:** Next.js App Router、React 19、TypeScript、现有 Coinflux 组件与样式变量、前端 API 层 `apps/front/src/lib/api.ts`。

---

### Task 1: 新增导航入口与路由骨架

**Files:**
- Modify: `apps/front/src/components/layout/Navbar.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/page.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/page.test.tsx`

**Step 1: Write the failing test**
```tsx
it('shows AI量化 nav entry and page shell', () => {
  expect(screen.getByText('AI量化')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test page.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<Link href={withLng('/ai-quant')}>AI量化</Link>
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test page.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/layout/Navbar.tsx apps/front/src/app/[lng]/ai-quant
git commit -m "feat: add ai-quant nav entry and page shell"
```

### Task 2: 未登录拦截卡（不跳转）

**Files:**
- Create: `apps/front/src/components/ai-quant/AuthGateCard.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/AuthGateCard.test.tsx`

**Step 1: Write the failing test**
```tsx
it('renders auth gate card when not logged in', () => {
  expect(screen.getByText('立即登录')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AuthGateCard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
if (!isAuthenticated) return <AuthGateCard />
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AuthGateCard.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
git commit -m "feat: add ai-quant auth gate card"
```

### Task 3: 大对话框与策略广场区域

**Files:**
- Create: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Create: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`

**Step 1: Write the failing test**
```tsx
it('renders chat panel and strategy plaza on ai-quant page', () => {
  expect(screen.getByText('策略广场')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test QuantChatPanel.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<QuantChatPanel />
<StrategyPlaza />
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test QuantChatPanel.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
git commit -m "feat: add ai-quant chat and strategy plaza"
```

### Task 4: 回测结果区（页内）+ 全屏页

**Files:**
- Create: `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/BacktestSummaryCard.test.tsx`

**Step 1: Write the failing test**
```tsx
it('shows inline backtest summary and full-screen link', () => {
  expect(screen.getByText('全屏查看')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test BacktestSummaryCard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<Link href={`/${lng}/ai-quant/backtest/${id}`}>全屏查看</Link>
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test BacktestSummaryCard.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
git commit -m "feat: add inline and full-screen backtest views"
```

### Task 5: 部署门槛与“继续优化”闭环

**Files:**
- Modify: `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Create: `apps/front/src/components/ai-quant/DeployGateNotice.tsx`
- Test: `apps/front/src/components/ai-quant/DeployGateNotice.test.tsx`

**Step 1: Write the failing test**
```tsx
it('disables deploy when max drawdown is over 20% and shows optimize action', () => {
  expect(screen.getByText('返回对话继续优化')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test DeployGateNotice.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const canDeploy = maxDrawdownPct <= 20
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test DeployGateNotice.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant
git commit -m "feat: add deploy gate and optimize loop for backtest"
```

### Task 6: API Key 快捷入口与部署前校验引导

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Create: `apps/front/src/components/ai-quant/ApiKeyStatusBadge.tsx`
- Create: `apps/front/src/components/ai-quant/DeployDialog.tsx`
- Test: `apps/front/src/components/ai-quant/DeployDialog.test.tsx`

**Step 1: Write the failing test**
```tsx
it('shows go configure API entry when key is missing', () => {
  expect(screen.getByText('去配置')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test DeployDialog.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<Link href={`/${lng}/account?tab=exchange-api`}>去配置</Link>
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test DeployDialog.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant
git commit -m "feat: add api key guard rails for deploy flow"
```

### Task 7: 个人中心 AI 量化分区入口

**Files:**
- Modify: `apps/front/src/app/[lng]/account/page.tsx`
- Create: `apps/front/src/components/account/AiQuantSection.tsx`
- Test: `apps/front/src/components/account/AiQuantSection.test.tsx`

**Step 1: Write the failing test**
```tsx
it('renders ai-quant section in account page', () => {
  expect(screen.getByText('AI量化')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AiQuantSection.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<AiQuantSection />
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AiQuantSection.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/account/page.tsx apps/front/src/components/account/AiQuantSection.tsx
git commit -m "feat: add ai-quant section in account center"
```

### Task 8: 前端 API 契约与 mock 流程打通

**Files:**
- Modify: `apps/front/src/lib/api.ts`
- Create: `apps/front/src/lib/ai-quant-mock.ts`
- Test: `apps/front/src/lib/ai-quant-mock.test.ts`

**Step 1: Write the failing test**
```ts
it('returns draft/backtest/deploy mock flow with drawdown gate', async () => {
  expect(result.status).toBe('BACKTEST_FAILED_GATE')
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test ai-quant-mock.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
export async function mockBacktest() { return { maxDrawdownPct: 22, status: 'BACKTEST_FAILED_GATE' } }
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test ai-quant-mock.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/lib/api.ts apps/front/src/lib/ai-quant-mock.ts apps/front/src/lib/ai-quant-mock.test.ts
git commit -m "feat: add ai-quant frontend contract and mock flow"
```

### Task 9: UI 一致性与验收校验

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/*.tsx`
- Test: `apps/front/src/components/ai-quant/*.test.tsx`

**Step 1: Add style guard tests/snapshots**
```tsx
it('uses existing Coinflux style tokens/classes', () => {
  expect(container.querySelector('[class*="cf-"]')).toBeTruthy()
})
```

**Step 2: Run tests**
Run: `pnpm --filter @net/front test`
Expected: PASS (at least ai-quant related tests pass)

**Step 3: Run lint/typecheck/build**
Run: `dx lint`
Run: `dx build front --dev`
Expected: PASS

**Step 4: Final commit**
```bash
git add apps/front/src
git commit -m "chore: finalize ai-quant frontend flow with coinflux-consistent UI"
```

---

## Execution Notes
- 保持 UI 与 Coinflux 现有视觉一致，禁止引入独立新主题。
- 按 `@test-driven-development` 执行：先失败测试，再最小实现。
- 完成前必须执行 `@verification-before-completion`。
