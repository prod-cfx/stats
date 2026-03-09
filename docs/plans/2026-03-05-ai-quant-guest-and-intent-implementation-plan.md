# AI量化未登录可浏览与登录续操作 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让未登录用户可浏览 AI 量化入口与策略广场，并在登录后自动续执行 `运行/编辑/发送` 三类操作。

**Architecture:** 在 `/ai-quant` 引入双态页面（Guest 浏览态 + Auth 工作台态），并用本地 `return intent` 做一次性续操作。意图只保存最近一条，带 TTL，登录后消费并清除。已登录工作台继续复用现有会话、回测、部署链路，仅增强策略卡与会话管理交互。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind（Coinflux `--cf-*` tokens）, Jest + React Testing Library（front existing test stack）

---

### Task 1: 建立 return-intent 存储工具

**Files:**
- Create: `apps/front/src/components/ai-quant/intent-storage.ts`
- Test: `apps/front/src/components/ai-quant/intent-storage.test.ts`

**Step 1: Write the failing test**

```ts
import { clearIntent, getIntent, setIntent } from './intent-storage'

test('set/get/clear intent with ttl', () => {
  setIntent({ type: 'run', strategyId: 's1' })
  const got = getIntent(30 * 60 * 1000)
  expect(got?.type).toBe('run')
  clearIntent()
  expect(getIntent(30 * 60 * 1000)).toBeNull()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx test front --runInBand --testPathPattern=intent-storage.test.ts`
Expected: FAIL (module/file missing)

**Step 3: Write minimal implementation**

```ts
export type ReturnIntent =
  | { type: 'run'; strategyId: string; ts?: number }
  | { type: 'edit'; strategyId: string; ts?: number }
  | { type: 'chat'; draft: string; ts?: number }

const KEY = 'ai_quant_return_intent_v1'

export function setIntent(intent: Omit<ReturnIntent, 'ts'>) {
  localStorage.setItem(KEY, JSON.stringify({ ...intent, ts: Date.now() }))
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx test front --runInBand --testPathPattern=intent-storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/intent-storage.ts apps/front/src/components/ai-quant/intent-storage.test.ts
git commit -m "feat(front): add ai-quant return intent storage"
```

### Task 2: 未登录态改为“可浏览 + 受限操作触发登录”

**Files:**
- Create: `apps/front/src/components/ai-quant/GuestAiQuantLanding.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`
- Test: `apps/front/src/components/ai-quant/GuestAiQuantLanding.test.tsx`

**Step 1: Write the failing test**

```tsx
test('guest click run triggers login gate callback', async () => {
  // render GuestAiQuantLanding with no session
  // click 运行
  // expect onRequireLogin called with { type: 'run', strategyId }
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx test front --runInBand --testPathPattern=GuestAiQuantLanding.test.tsx`
Expected: FAIL (component behavior absent)

**Step 3: Write minimal implementation**

```tsx
// GuestAiQuantLanding exposes:
// onRequireLogin(intent), onNavigateLogin()
// chat send / run / edit all call onRequireLogin(...)
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx test front --runInBand --testPathPattern=GuestAiQuantLanding.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/GuestAiQuantLanding.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/StrategyPlaza.tsx apps/front/src/components/ai-quant/GuestAiQuantLanding.test.tsx
git commit -m "feat(front): add guest ai-quant browse mode with auth gating"
```

### Task 3: 登录后自动续操作（run/edit/chat）

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`

**Step 1: Write the failing test**

```tsx
test('consumes chat intent after login and sends draft once', async () => {
  // mock logged-in session + localStorage intent {type:'chat', draft:'...'}
  // render page client
  // expect draft consumed and clearIntent called
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx test front --runInBand --testPathPattern=AiQuantPageClient.test.tsx`
Expected: FAIL (intent consumption missing)

**Step 3: Write minimal implementation**

```ts
useEffect(() => {
  if (!session) return
  const intent = getIntent(30 * 60 * 1000)
  if (!intent) return
  // switch(intent.type): run/edit/chat
  clearIntent()
}, [session])
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx test front --runInBand --testPathPattern=AiQuantPageClient.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
git commit -m "feat(front): consume ai-quant return intent after login"
```

### Task 4: 会话侧栏支持重命名与删除

**Files:**
- Modify: `apps/front/src/components/ai-quant/ConversationSidebar.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/ConversationSidebar.test.tsx`

**Step 1: Write the failing test**

```tsx
test('can rename and delete conversation item', async () => {
  // render sidebar with item
  // rename title
  // delete item
  // expect callbacks invoked
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx test front --runInBand --testPathPattern=ConversationSidebar.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// add callbacks:
// onRename(id, title), onDelete(id)
// add inline edit + delete button per item
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx test front --runInBand --testPathPattern=ConversationSidebar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/ConversationSidebar.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/ConversationSidebar.test.tsx
git commit -m "feat(front): support ai-quant conversation rename and delete"
```

### Task 5: 策略广场分离为登录子页并保留首次推荐

**Files:**
- Create: `apps/front/src/app/[lng]/ai-quant/plaza/page.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/StrategyPlaza.tsx`

**Step 1: Write the failing test**

```tsx
test('renders strategy plaza subpage for logged-in users', () => {
  // render /ai-quant/plaza page component
  // expect strategy cards visible
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm nx test front --runInBand --testPathPattern=ai-quant/plaza`
Expected: FAIL (route missing)

**Step 3: Write minimal implementation**

```tsx
// add plaza page route
// keep workspace page showing recommended strategies for first conversation
```

**Step 4: Run test to verify it passes**

Run: `pnpm nx test front --runInBand --testPathPattern=ai-quant/plaza`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/plaza/page.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/StrategyPlaza.tsx
git commit -m "feat(front): add ai-quant strategy plaza subpage"
```

### Task 6: 回归验证与文档同步

**Files:**
- Modify: `docs/plans/2026-03-05-ai-quant-frontend-implementation-plan.md`（追加状态）
- Modify: `docs/plans/2026-03-05-ai-quant-guest-and-intent-design.md`（补充“已实现”注记）

**Step 1: Run full checks**

Run: `pnpm nx test front --runInBand`
Expected: PASS

**Step 2: Run type and build checks**

Run: `pnpm nx run front:type-check-strict && dx build front --dev`
Expected: PASS

**Step 3: Manual smoke checklist**

```text
1) 未登录可见广场+聊天框
2) 未登录 run/edit/chat 均跳登录
3) 登录后三类 intent 自动续执行
4) 会话可新建/切换/重命名/删除
5) 回测不通过可继续优化
```

**Step 4: Commit**

```bash
git add docs/plans/2026-03-05-ai-quant-frontend-implementation-plan.md docs/plans/2026-03-05-ai-quant-guest-and-intent-design.md
git commit -m "docs: update ai-quant guest intent implementation status"
```
