# AI量化逻辑图确认层与部署账户选择 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 AI量化链路中增加“用户确认逻辑图后才能回测”的硬闸门，并在部署时强制选择交易所与 API 账户。

**Architecture:** 在对话状态中引入 `logicGraph`（含 version/status）并将回测入口绑定到 `status=confirmed`。部署弹窗增加“交易所 + API 账户”选择器，从账户中心的 API 账户 store 读取可用账户。部署成功后把账户信息回写策略记录，供个人中心详情页展示。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, localStorage mock store, Jest

---

### Task 1: 定义逻辑图数据结构与 mock 生成器

**Files:**
- Create: `apps/front/src/components/ai-quant/logic-graph-model.ts`
- Create: `apps/front/src/components/ai-quant/logic-graph-generator.ts`
- Test: `apps/front/src/components/ai-quant/logic-graph-generator.test.ts`

**Step 1: Write the failing test**

```ts
import { buildLogicGraphFromPrompt } from './logic-graph-generator'

test('builds draft graph with version from nl prompt', () => {
  const graph = buildLogicGraphFromPrompt('3分钟跌1%买入，15分钟涨2%卖出')
  expect(graph.status).toBe('draft')
  expect(graph.version).toBeGreaterThan(0)
  expect(graph.trigger.length).toBeGreaterThan(0)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/ai-quant/logic-graph-generator.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export interface LogicGraph { version: number; status: 'draft' | 'confirmed'; trigger: ...; actions: ...; risk: ...; meta: ... }
export function buildLogicGraphFromPrompt(input: string): LogicGraph { /* simple parser + fallback */ }
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/ai-quant/logic-graph-generator.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/logic-graph-model.ts apps/front/src/components/ai-quant/logic-graph-generator.ts apps/front/src/components/ai-quant/logic-graph-generator.test.ts
git commit -m "feat(front): add ai-quant logic graph model and generator"
```

### Task 2: 增加逻辑图只读渲染组件与确认控件

**Files:**
- Create: `apps/front/src/components/ai-quant/LogicGraphPreview.tsx`
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Test: `apps/front/src/components/ai-quant/LogicGraphPreview.test.tsx`

**Step 1: Write the failing test**

```tsx
test('shows IF/THEN blocks and confirmation actions', () => {
  // render with draft graph
  // expect "确认并回测" and "返回对话修改"
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/ai-quant/LogicGraphPreview.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// render IF / THEN / EXECUTE blocks
// buttons: confirmGraph / reviseGraph
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/ai-quant/LogicGraphPreview.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/LogicGraphPreview.tsx apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/LogicGraphPreview.test.tsx
git commit -m "feat(front): add read-only logic graph confirmation gate"
```

### Task 3: 回测硬闸门（未确认逻辑图禁止）

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.logic-gate.test.tsx`

**Step 1: Write the failing test**

```tsx
test('backtest is blocked before graph confirmation', async () => {
  // draft graph exists
  // click backtest
  // expect blocked message and no result
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.logic-gate.test.tsx --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
const canRunBacktest = logicGraph?.status === 'confirmed'
// disable button and enforce guard in handler
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.logic-gate.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/BacktestSummaryCard.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.logic-gate.test.tsx
git commit -m "feat(front): enforce logic graph confirmation before backtest"
```

### Task 4: API 账户模型与部署弹窗选择器

**Files:**
- Create: `apps/front/src/components/account/exchange-account-store.ts`
- Modify: `apps/front/src/components/account/ExchangeApiSection.tsx`
- Modify: `apps/front/src/components/ai-quant/DeployDialog.tsx`
- Test: `apps/front/src/components/account/exchange-account-store.test.ts`

**Step 1: Write the failing test**

```ts
test('stores multi-accounts per exchange and lists available accounts', () => {
  // seed 2 binance + 1 okx
  // expect filter by exchange works
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/exchange-account-store.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export interface ExchangeAccount { accountId; exchange; accountName; apiKeyMask; status }
// CRUD + list by exchange
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/exchange-account-store.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/exchange-account-store.ts apps/front/src/components/account/ExchangeApiSection.tsx apps/front/src/components/ai-quant/DeployDialog.tsx apps/front/src/components/account/exchange-account-store.test.ts
git commit -m "feat(front): add exchange account selection in deploy flow"
```

### Task 5: 部署结果回写策略详情（账户信息）

**Files:**
- Modify: `apps/front/src/components/account/ai-quant-strategy-store.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Test: `apps/front/src/components/account/ai-quant-strategy-store.test.ts`

**Step 1: Write the failing test**

```ts
test('writes deploy exchange/account info into strategy record', () => {
  // deploy strategy with accountId
  // expect detail includes deploy.accountName
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
strategy.deploy = { exchange, accountId, accountName, at, status: 'running' }
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/account/ai-quant-strategy-store.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/account/AiQuantStrategyDetail.tsx apps/front/src/components/account/ai-quant-strategy-store.test.ts
git commit -m "feat(front): persist deploy account info into strategy detail"
```

### Task 6: 验证与文档同步

**Files:**
- Modify: `docs/plans/2026-03-06-ai-quant-logic-graph-and-deploy-account-design.md`
- Modify: `docs/plans/2026-03-06-ai-quant-logic-graph-and-deploy-account-implementation-plan.md`

**Step 1: Run focused lint**

Run: `cd apps/front && npx eslint --config ../../eslint.config.js --ext .ts,.tsx src/components/ai-quant src/components/account 'src/app/[lng]/ai-quant' 'src/app/[lng]/account/ai-quant/strategy/[id]'`
Expected: no error

**Step 2: Run new tests**

Run:
`pnpm exec jest -c apps/front/jest.config.ts apps/front/src/components/ai-quant/logic-graph-generator.test.ts apps/front/src/components/ai-quant/LogicGraphPreview.test.tsx apps/front/src/components/account/exchange-account-store.test.ts apps/front/src/components/account/ai-quant-strategy-store.test.ts --runInBand`
Expected: PASS

**Step 3: Build verify**

Run: `dx build front --dev`
Expected: PASS

**Step 4: Manual smoke checklist**

```text
1) 对话生成后先显示逻辑图
2) 未确认时不可回测
3) 确认后可回测
4) 部署时必须选交易所+账户
5) 部署后个人中心详情可看到账户信息
```

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-ai-quant-logic-graph-and-deploy-account-design.md docs/plans/2026-03-06-ai-quant-logic-graph-and-deploy-account-implementation-plan.md
git commit -m "docs(front): finalize logic graph gate and deploy account mvp"
```
