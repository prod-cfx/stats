# AI Quant Chat Desktop Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 AI量化页重构为桌面双栏会话工作台，实现“初始小聊天框 -> 开聊自动放大 + 多会话历史 + 6个推荐策略”。

**Architecture:** 保持现有业务接口与回测逻辑，新增本地会话状态层管理多会话。通过布局改造和组件拆分完成体验升级，不引入新主题。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Coinflux 现有样式变量与组件。

---

### Task 1: 新增会话状态层（本地持久化）

**Files:**
- Create: `apps/front/src/features/ai-quant/session-store.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/features/ai-quant/session-store.test.ts`

**Step 1: Write the failing test**
```ts
it('creates and switches conversations with local persistence', () => {
  expect(store.list().length).toBeGreaterThan(0)
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test session-store.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**
```ts
const STORAGE_KEY = 'ai_quant_conversations_v1'
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test session-store.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/features/ai-quant/session-store.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/features/ai-quant/session-store.test.ts
git commit -m "feat: add ai-quant local conversation store"
```

### Task 2: 桌面双栏布局重构

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Create: `apps/front/src/components/ai-quant/ConversationSidebar.tsx`
- Test: `apps/front/src/components/ai-quant/ConversationSidebar.test.tsx`

**Step 1: Write the failing test**
```tsx
it('renders left conversation sidebar and right chat workspace', () => {
  expect(screen.getByText('新建会话')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test ConversationSidebar.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
<div className="grid grid-cols-[280px_1fr] gap-4">...</div>
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test ConversationSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/ConversationSidebar.tsx apps/front/src/components/ai-quant/ConversationSidebar.test.tsx
git commit -m "feat: refactor ai-quant page into desktop two-column workspace"
```

### Task 3: 聊天框“初始小 -> 首次发言后放大”

**Files:**
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`

**Step 1: Write the failing test**
```tsx
it('expands chat area after first user message', () => {
  expect(container).toHaveClass('chat-expanded')
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test QuantChatPanel.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const mode = hasUserMessage ? 'EXPANDED' : 'COMPACT'
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test QuantChatPanel.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/QuantChatPanel.test.tsx
git commit -m "feat: add compact-to-expanded chat transition"
```

### Task 4: 策略广场扩充到 6 个推荐策略

**Files:**
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Test: `apps/front/src/components/ai-quant/StrategyPlaza.test.tsx`

**Step 1: Write the failing test**
```tsx
it('renders at least 6 strategy cards', () => {
  expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(6)
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test StrategyPlaza.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const PRESETS = [/* 6 items */]
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test StrategyPlaza.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/components/ai-quant/StrategyPlaza.tsx apps/front/src/components/ai-quant/StrategyPlaza.test.tsx
git commit -m "feat: expand strategy plaza to six recommendations"
```

### Task 5: 会话切换与回测结果绑定当前会话

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`

**Step 1: Write the failing test**
```tsx
it('keeps per-conversation backtest state when switching', () => {
  expect(screen.getByText('会话A')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**
Run: `pnpm --filter @net/front test AiQuantPageClient.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**
```tsx
const current = conversations.find(x => x.id === activeConversationId)
```

**Step 4: Run test to verify it passes**
Run: `pnpm --filter @net/front test AiQuantPageClient.test.tsx`
Expected: PASS

**Step 5: Commit**
```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/BacktestSummaryCard.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
git commit -m "feat: bind ai-quant backtest and params to active conversation"
```

### Task 6: 风格统一回归与构建校验

**Files:**
- Modify: `apps/front/src/components/ai-quant/*.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/*.tsx`

**Step 1: Verify style token usage**
Run: `rg -n "var\(--cf-|from-primary|to-secondary" apps/front/src/components/ai-quant apps/front/src/app/[lng]/ai-quant`
Expected: consistent Coinflux style tokens

**Step 2: Build verification**
Run: `dx build front --dev`
Expected: PASS

**Step 3: Final commit**
```bash
git add apps/front/src/components/ai-quant apps/front/src/app/[lng]/ai-quant
git commit -m "chore: finalize ai-quant desktop chat redesign"
```

---

## Execution Notes
- 本次不做移动端布局专门适配。
- 保留现有回测和部署门槛逻辑。
- 遵循 Coinflux 既有视觉语言，避免主题漂移。
