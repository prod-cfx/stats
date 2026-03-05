# AI Quant MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付“策略库 + 自然语言对话补参 + 回测 + 一键实盘部署”的 AI 量化 MVP 主链路，支持 Binance/OKX 与多币种参数配置。

**Architecture:** 采用“模板驱动 + 参数化配置”而非自由脚本执行。后端新增 `ai-quant` 领域模块，负责模板解析、参数补全、回测任务与部署状态流转；前端新增策略广场、对话补参与回测确认页，并通过统一 API 读写策略草稿与实例状态。

**Tech Stack:** NestJS 11、Prisma 7、PostgreSQL、Next.js App Router、TypeScript、Nx/dx、Jest E2E。

---

### Task 1: 建立后端领域骨架（ai-quant module）

**Files:**
- Create: `apps/backend/src/modules/ai-quant/ai-quant.module.ts`
- Create: `apps/backend/src/modules/ai-quant/controllers/ai-quant.controller.ts`
- Create: `apps/backend/src/modules/ai-quant/services/ai-quant.service.ts`
- Modify: `apps/backend/src/modules/app.module.ts`
- Test: `apps/backend/e2e/ai-quant/ai-quant-health.e2e-spec.ts`

**Step 1: Write the failing test**

```ts
it('GET /ai-quant/health should return ok', async () => {
  await request(app.getHttpServer()).get('/ai-quant/health').expect(200)
})
```

**Step 2: Run test to verify it fails**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-health.e2e-spec.ts`
Expected: FAIL with 404/not found

**Step 3: Write minimal implementation**

```ts
@Controller('ai-quant')
export class AiQuantController {
  @Get('health')
  health() { return { ok: true } }
}
```

**Step 4: Run test to verify it passes**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-health.e2e-spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant apps/backend/src/modules/app.module.ts apps/backend/e2e/ai-quant/ai-quant-health.e2e-spec.ts
git commit -m "feat: scaffold ai-quant module"
```

### Task 2: 建立策略模板与参数 Schema（可调参数版）

**Files:**
- Create: `apps/backend/src/modules/ai-quant/constants/strategy-template.constant.ts`
- Create: `apps/backend/src/modules/ai-quant/dto/strategy-params.dto.ts`
- Create: `apps/backend/src/modules/ai-quant/services/template-resolver.service.ts`
- Test: `apps/backend/src/modules/ai-quant/services/template-resolver.service.spec.ts`

**Step 1: Write the failing test**

```ts
it('should resolve PRICE_MOMENTUM_ADJUSTABLE template with defaults', () => {
  const result = service.resolve({ exchange: 'binance', symbol: 'BTCUSDT' })
  expect(result.templateCode).toBe('PRICE_MOMENTUM_ADJUSTABLE')
  expect(result.params.positionPct).toBeDefined()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @net/backend test template-resolver.service.spec.ts`
Expected: FAIL with resolver not found

**Step 3: Write minimal implementation**

```ts
const DEFAULTS = { buyWindowMin: 3, buyDropPct: 1, sellWindowMin: 15, sellRisePct: 2, positionPct: 10 }
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @net/backend test template-resolver.service.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant/constants apps/backend/src/modules/ai-quant/dto apps/backend/src/modules/ai-quant/services
git commit -m "feat: add adjustable strategy template schema"
```

### Task 3: 实现对话补参引擎（一次追问一个缺失项）

**Files:**
- Create: `apps/backend/src/modules/ai-quant/services/slot-filling.service.ts`
- Create: `apps/backend/src/modules/ai-quant/dto/slot-filling.response.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant/services/ai-quant.service.ts`
- Test: `apps/backend/src/modules/ai-quant/services/slot-filling.service.spec.ts`

**Step 1: Write the failing test**

```ts
it('should ask one missing required field each turn', () => {
  const res = service.nextQuestion({ exchange: 'okx' })
  expect(res.nextMissingField).toBe('symbol')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @net/backend test slot-filling.service.spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
const REQUIRED_ORDER = ['exchange', 'symbol', 'buyCondition', 'sellCondition', 'positionPct']
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @net/backend test slot-filling.service.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant/services apps/backend/src/modules/ai-quant/dto
git commit -m "feat: add guided slot filling flow"
```

### Task 4: 持久化策略草稿与状态机

**Files:**
- Create: `apps/backend/prisma/schema/ai_quant.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_create_ai_quant_tables/migration.sql`
- Modify: `apps/backend/src/modules/ai-quant/services/ai-quant.service.ts`
- Create: `apps/backend/src/modules/ai-quant/repositories/ai-quant.repository.ts`
- Test: `apps/backend/e2e/ai-quant/ai-quant-draft-flow.e2e-spec.ts`

**Step 1: Write the failing e2e test**

```ts
it('should create draft and move to READY_TO_BACKTEST when required params complete', async () => {
  // create draft -> patch params -> assert status transition
})
```

**Step 2: Run test to verify it fails**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-draft-flow.e2e-spec.ts`
Expected: FAIL with table/repository missing

**Step 3: Write minimal implementation**

```sql
CREATE TABLE ai_quant_strategy_draft (...);
CREATE TYPE ai_quant_status AS ENUM ('DRAFT','READY_TO_BACKTEST','BACKTESTED','DEPLOY_PENDING','RUNNING','PAUSED','ERROR','STOPPED');
```

**Step 4: Run migration + e2e**

Run: `dx db format && dx db generate && dx db migrate --dev --name create_ai_quant_tables`
Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-draft-flow.e2e-spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/prisma/schema apps/backend/prisma/migrations apps/backend/src/modules/ai-quant apps/backend/e2e/ai-quant
git commit -m "feat: persist ai-quant drafts and status transitions"
```

### Task 5: 接入真实回测任务（历史行情）

**Files:**
- Create: `apps/backend/src/modules/ai-quant/services/backtest.service.ts`
- Create: `apps/backend/src/modules/ai-quant/dto/backtest.response.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant/controllers/ai-quant.controller.ts`
- Test: `apps/backend/e2e/ai-quant/ai-quant-backtest.e2e-spec.ts`

**Step 1: Write the failing e2e test**

```ts
it('POST /ai-quant/drafts/:id/backtest returns pnl drawdown winRate', async () => {
  expect(body.metrics.totalReturnPct).toBeDefined()
})
```

**Step 2: Run test to verify it fails**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-backtest.e2e-spec.ts`
Expected: FAIL with endpoint missing

**Step 3: Write minimal implementation**

```ts
return { metrics: { totalReturnPct, maxDrawdownPct, winRatePct, tradeCount }, equityCurve, trades }
```

**Step 4: Run test to verify it passes**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-backtest.e2e-spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant apps/backend/e2e/ai-quant
git commit -m "feat: add historical backtest API for ai-quant"
```

### Task 6: 实盘部署与交易所账号校验

**Files:**
- Create: `apps/backend/src/modules/ai-quant/services/deployment.service.ts`
- Create: `apps/backend/src/modules/ai-quant/dto/deploy.request.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant/controllers/ai-quant.controller.ts`
- Test: `apps/backend/e2e/ai-quant/ai-quant-deploy.e2e-spec.ts`

**Step 1: Write the failing e2e test**

```ts
it('POST /ai-quant/drafts/:id/deploy should validate exchange credentials first', async () => {
  await request(server).post(`/ai-quant/drafts/${id}/deploy`).expect(400)
})
```

**Step 2: Run test to verify it fails**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-deploy.e2e-spec.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
if (!credentialCheck.ok) throw new DomainException(ErrorCode.EXCHANGE_AUTH_FAILED)
```

**Step 4: Run test to verify it passes**

Run: `dx test e2e backend apps/backend/e2e/ai-quant/ai-quant-deploy.e2e-spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant apps/backend/e2e/ai-quant
git commit -m "feat: add ai-quant deployment flow with credential validation"
```

### Task 7: 前端策略广场与对话补参页

**Files:**
- Create: `apps/front/src/app/[lng]/strategy-lab/page.tsx`
- Create: `apps/front/src/app/[lng]/strategy-lab/StrategyLabClient.tsx`
- Create: `apps/front/src/components/strategy-lab/ChatPanel.tsx`
- Create: `apps/front/src/components/strategy-lab/ParamEditor.tsx`
- Modify: `apps/front/src/lib/api.ts`
- Test: `apps/front/src/components/strategy-lab/ParamEditor.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders missing-field prompt and updates param after input', async () => {
  expect(screen.getByText('单笔开多少呢')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @net/front test ParamEditor.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
{missingField === 'positionPct' && <p>单笔开多少呢？</p>}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @net/front test ParamEditor.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/strategy-lab apps/front/src/components/strategy-lab apps/front/src/lib/api.ts
git commit -m "feat: add strategy lab chat + parameter editor"
```

### Task 8: 回测结果页与一键部署交互

**Files:**
- Create: `apps/front/src/components/strategy-lab/BacktestResultCard.tsx`
- Create: `apps/front/src/components/strategy-lab/DeployConfirmModal.tsx`
- Modify: `apps/front/src/app/[lng]/strategy-lab/StrategyLabClient.tsx`
- Test: `apps/front/src/components/strategy-lab/BacktestResultCard.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows metrics and allows deploy confirm', async () => {
  expect(screen.getByText('最大回撤')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @net/front test BacktestResultCard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
<li>最大回撤: {metrics.maxDrawdownPct}%</li>
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @net/front test BacktestResultCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/strategy-lab apps/front/src/app/[lng]/strategy-lab/StrategyLabClient.tsx
git commit -m "feat: add backtest result and deploy confirmation UI"
```

### Task 9: 联调验收与契约更新

**Files:**
- Modify: `packages/api-contracts/src/generated/backend.ts` (generated)
- Modify: `packages/api-contracts/openapi/backend.json` (generated)
- Modify: `apps/front/src/lib/server-api.ts`
- Test: `apps/backend/e2e/ai-quant/*.e2e-spec.ts`

**Step 1: Run failing integration checks first**

Run: `dx build backend --dev`
Expected: PASS or reveal contract/type gaps

**Step 2: Generate contracts and fix integration**

Run: `dx build contracts --dev`
Expected: generated contracts include ai-quant endpoints

**Step 3: Verify end-to-end chain**

Run: `dx test e2e backend apps/backend/e2e/ai-quant`
Expected: PASS for draft -> backtest -> deploy path

**Step 4: Run lint/build gate**

Run: `dx lint && dx build affected --dev`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/e2e/ai-quant apps/front/src/lib/server-api.ts packages/api-contracts
git commit -m "chore: wire ai-quant contracts and complete e2e verification"
```

### Task 10: 文档与发布准备

**Files:**
- Modify: `README.md`
- Create: `docs/ai-quant-mvp-runbook.md`
- Modify: `docs/plans/2026-03-04-ai-quant-mvp-design.md`

**Step 1: Write runbook with operator checklist**

```md
- 必填参数说明
- 默认高级参数说明
- 回测指标解释
- 部署前检查项
```

**Step 2: Verify docs accuracy against implemented API**

Run: `rg -n "ai-quant|strategy-lab|backtest|deploy" README.md docs`
Expected: 文档术语与接口一致

**Step 3: Final verification (@verification-before-completion)**

Run: `dx lint && dx build backend --dev && dx build front --dev`
Expected: PASS

**Step 4: Final commit**

```bash
git add README.md docs
git commit -m "docs: add ai-quant mvp runbook and usage notes"
```

---

## Execution Notes
- 执行时必须遵循 `@test-driven-development`：先写失败测试，再最小实现，再回归。
- 执行前建议启用 `@using-git-worktrees`，避免污染当前分支。
- 执行完成前必须走 `@verification-before-completion`。
