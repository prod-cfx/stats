# AI Quant Backtest Recovery Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AI Quant 主页面在刷新、详情页返回、换设备重新登录后恢复“同一 `publishedSnapshotId` 的最近一次回测摘要 + 详情入口”，并继续要求会话漂移后重新回测。

**Architecture:** 在回测请求中贯通 `conversationId`，把 `BacktestJob` 与 `AiQuantConversation` 稳定关联起来；回测成功后由 `quantify` 把轻量 `lastBacktestRef` 写回 conversation 视图，再通过 quantify conversation DTO、backend proxy、front hydration 恢复摘要。前端恢复时严格比较 `conversation.publishedSnapshotId` 与 `lastBacktestRef.publishedSnapshotId`，一致才展示，不一致直接隐藏。

**Tech Stack:** NestJS 11、Prisma、PostgreSQL、TypeScript 5.9、Jest、Next.js、i18next、Nx/dx

---

## Scope Guard

本计划实现 Issue `#865`，对应 spec：

- `docs/superpowers/specs/2026-04-23-ai-quant-backtest-recovery-continuity-design.md`

绝对不要改变：

- `publishedSnapshotId` 作为回测/发布真相键的语义
- 详情页继续按 `jobId` 读取真实回测结果的设计
- 现有“策略关键参数变化即失效发布态并清空旧回测结果”的前端语义
- 主页面只恢复轻量摘要，不复制完整 report

如果遇到“恢复方便”和“snapshot 语义严格”冲突，始终保留后者。

## File Structure

- Modify: `apps/front/src/lib/backtesting-api.ts`
  - 回测创建请求增加 `conversationId`。
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
  - payload builder 支持把 `conversationId` 一并写入回测请求。
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`
  - 保护 payload 中的 `conversationId` 透传。
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
  - 发起回测时把当前 `conversation.id` 传给后端。
- Modify: `apps/front/src/lib/api.ts`
  - `AiQuantConversationResponse` 增加 `lastBacktestRef` 类型。
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
  - 新增 `lastBacktestRef` 标准化与 snapshot-match 恢复逻辑。
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`
  - 覆盖 match / mismatch 两种恢复行为。
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`
  - 覆盖 server-owned conversations 刷新恢复。
- Modify: `apps/quantify/prisma/schema/backtesting_jobs.prisma`
  - `BacktestJob` 增加 `conversationId`。
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
  - `AiQuantConversation` 增加 `lastBacktestRef` JSON 字段，并与 `BacktestJob` 建立可选关系。
- Modify: `apps/quantify/prisma/schema/migrations/`
  - 运行 `dx db migrate --dev --name add_ai_quant_last_backtest_ref_and_job_conversation_link` 后提交生成的 migration 目录与 `migration.sql`。
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`
  - DTO 接受可选 `conversationId`。
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts`
  - 保护 `conversationId` 请求形态。
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
  - 创建 job 时落 `conversationId`，成功后写回 `lastBacktestRef`。
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts`
  - 保护成功写入、失败不写入、仅写轻量摘要。
- Modify: `apps/quantify/src/modules/backtesting/backtesting.module.ts`
  - 注入 conversation repository 到 jobs service。
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository.ts`
  - conversation record 增加 `lastBacktestRef`；新增更新方法。
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto.ts`
  - conversation DTO 暴露 `lastBacktestRef`。
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - `toConversationResponse(...)` 映射 `lastBacktestRef`。
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts`
  - controller contract 更新。
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  - 保护 conversation response 带回 `lastBacktestRef`。
- Modify: `apps/backend/src/modules/ai-quant-proxy/dto/ai-quant-conversation.response.dto.ts`
  - proxy DTO 暴露 `lastBacktestRef`。
- Modify: `apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`
  - 保护 proxy controller 透传新字段。
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`
  - 保护 proxy service conversation list 透传新字段。
- Modify: `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`
  - 保护生成 contract 包含 `lastBacktestRef`。
- Modify: `packages/api-contracts/src/generated/quantify.ts`
  - regenerate quantify contracts。

## Task 1: Plumb `conversationId` Through The Backtest Request

**Files:**
- Modify: `apps/front/src/lib/backtesting-api.ts`
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts`

- [ ] **Step 1: Add a failing front payload-builder test for `conversationId`**

Append this case to `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`:

```ts
it('includes conversationId when creating a snapshot-bound backtest payload', () => {
  const payload = buildBacktestPayload({
    marketType: 'spot',
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    capabilities: { allowedBaseTimeframes: ['15m'] },
    stateTimeframes: ['15m'],
    initialCash: 10000,
    leverage: null,
    execution: { slippageBps: 5, feeBps: 2, priceSource: 'close' },
    strategy: {
      id: 'snapshot-1',
      publishedSnapshotId: 'snapshot-1',
    },
    conversationId: 'conv-1',
    range: { preset: '30D' },
  }, new Date('2026-04-23T00:00:00.000Z'))

  expect(payload).toEqual(expect.objectContaining({
    conversationId: 'conv-1',
  }))
})
```

- [ ] **Step 2: Add a failing quantify DTO test for optional `conversationId`**

Append this case to `apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts`:

```ts
it('accepts optional conversationId in run-backtest payloads', async () => {
  const payload = {
    symbols: ['BTCUSDT'],
    baseTimeframe: '15m',
    stateTimeframes: ['15m'],
    initialCash: 10000,
    execution: { slippageBps: 5, feeBps: 2, priceSource: 'close' },
    strategy: {
      id: 'snapshot-1',
      protocolVersion: 'v1',
      publishedSnapshotId: 'snapshot-1',
      params: { marketType: 'spot' },
    },
    conversationId: 'conv-1',
    dataRange: { fromTs: 1, toTs: 2 },
  }

  const dto = plainToInstance(RunBacktestDto, payload)
  const errors = await validate(dto)

  expect(errors).toHaveLength(0)
})
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/backtest-payload-builder.test.ts
dx test unit quantify apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts
```

Expected:
- front test FAIL because `CreateBacktestJobPayload` / builder does not expose `conversationId`
- quantify test FAIL because `RunBacktestDto` does not declare `conversationId`

- [ ] **Step 4: Implement the request plumb-through**

Update `apps/front/src/lib/backtesting-api.ts`:

```ts
export interface CreateBacktestJobPayload {
  symbols: string[]
  baseTimeframe: string
  stateTimeframes: string[]
  initialCash: number
  leverage?: number
  execution: {
    slippageBps: number
    feeBps: number
    priceSource: 'open' | 'close' | 'mid'
  }
  strategy: {
    id: string
    protocolVersion?: 'v1'
    publishedSnapshotId?: string
    params?: Record<string, unknown>
  }
  conversationId?: string
  dataRange: {
    fromTs: number
    toTs: number
  }
  allowPartial?: boolean
  bars?: unknown[]
}
```

Update `apps/front/src/components/ai-quant/backtest-payload-builder.ts`:

```ts
export interface BuildBacktestPayloadInput {
  marketType: 'spot' | 'perp'
  symbol: string
  baseTimeframe: string
  capabilities: {
    allowedBaseTimeframes: string[]
  }
  stateTimeframes: string[]
  initialCash: number
  leverage: number | null
  execution: CreateBacktestJobPayload['execution']
  strategy: {
    id: string
    publishedSnapshotId: string
  }
  conversationId?: string
  range: BacktestRangeInput
  allowPartial?: boolean
}
```

Inside `buildBacktestPayload(...)`:

```ts
  const payload: CreateBacktestJobPayload = {
    symbols: [symbol],
    baseTimeframe,
    stateTimeframes: input.stateTimeframes,
    initialCash,
    execution: input.execution,
    strategy: {
      id: input.strategy.id,
      protocolVersion: 'v1',
      publishedSnapshotId,
      params: { marketType: input.marketType },
    },
    ...(input.conversationId?.trim() ? { conversationId: input.conversationId.trim() } : {}),
    dataRange: {
      fromTs: resolvedFromTs,
      toTs: resolvedToTs,
    },
  }
```

Update `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts` call site:

```ts
      payload = buildBacktestPayload({
        marketType: backtestMarketType,
        symbol: payloadSymbol,
        baseTimeframe: payloadTimeframe,
        capabilities: backtestCapabilities,
        stateTimeframes,
        initialCash: executionConfig.initialCash,
        leverage: executionConfig.leverage,
        execution: {
          slippageBps: executionConfig.slippageBps,
          feeBps: executionConfig.feeBps,
          priceSource: executionConfig.priceSource as 'open' | 'close' | 'mid',
        },
        strategy: {
          id: activeConversation.publishedSnapshotId ?? activeConversation.id,
          publishedSnapshotId: activeConversation.publishedSnapshotId ?? '',
        },
        conversationId,
        range: resolveBacktestRangeInput(activeConversation.paramValues),
        allowPartial: executionConfig.allowPartial,
      })
```

Update `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`:

```ts
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  conversationId?: string
```

- [ ] **Step 5: Re-run the focused tests**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/backtest-payload-builder.test.ts
dx test unit quantify apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/front/src/lib/backtesting-api.ts apps/front/src/components/ai-quant/backtest-payload-builder.ts apps/front/src/components/ai-quant/backtest-payload-builder.test.ts apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts
git commit -F - <<'MSG'
fix: preserve conversation identity across snapshot-bound backtest requests

The recovery design needs a stable link from each created backtest job back to
the owning AI Quant conversation. This change threads conversationId through
the request boundary without weakening publishedSnapshotId authority.

Constraint: publishedSnapshotId remains the runtime truth for backtest semantics
Rejected: Infer owning conversation from job timing alone | too fragile
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: conversationId is only a recovery link; never use it as strategy truth
Tested: dx test unit front apps/front/src/components/ai-quant/backtest-payload-builder.test.ts
Tested: dx test unit quantify apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts
Related: #865
MSG
```

## Task 2: Persist `conversationId` And Snapshot-Bound `lastBacktestRef`

**Files:**
- Modify: `apps/quantify/prisma/schema/backtesting_jobs.prisma`
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
- Modify: `apps/quantify/prisma/schema/migrations/`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository.ts`
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtesting.module.ts`

- [ ] **Step 1: Add a failing jobs-service test for successful backtest recovery writes**

Append to `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts`:

```ts
it('writes a lightweight lastBacktestRef to the owning conversation after a successful snapshot-bound backtest', async () => {
  const runner = {
    run: jest.fn().mockResolvedValue({
      summary: {
        netProfit: 120,
        netProfitPct: 12,
        maxDrawdownPct: 8,
        winRate: 0.6,
        profitFactor: 1.8,
        totalTrades: 5,
      },
      equityCurve: [],
      trades: [],
      markers: [],
      bySymbol: [],
    }),
  }
  const conversations = {
    updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
  }
  const { service } = createService({ runner, conversations })
  const input = createInput()
  Object.assign(input.strategy as Record<string, unknown>, {
    bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
    snapshotId: 'snapshot-1',
  })
  ;(input as BacktestRunInput & { conversationId?: string }).conversationId = 'conv-1'

  const created = await service.createJob(input, OWNER_USER_ID)
  await flushMicrotasks()

  expect(conversations.updateLastBacktestRef).toHaveBeenCalledWith({
    conversationId: 'conv-1',
    userId: OWNER_USER_ID,
    lastBacktestRef: {
      jobId: created.id,
      publishedSnapshotId: 'snapshot-1',
      summary: expect.objectContaining({
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
      }),
      completedAt: expect.any(Date),
    },
  })
})
```

- [ ] **Step 2: Add a failing jobs-service test proving failed runs do not overwrite the ref**

Append:

```ts
it('does not write lastBacktestRef when the backtest fails', async () => {
  const runner = {
    run: jest.fn().mockRejectedValue(new Error('boom')),
  }
  const conversations = {
    updateLastBacktestRef: jest.fn().mockResolvedValue(undefined),
  }
  const { service } = createService({ runner, conversations })
  const input = createInput()
  Object.assign(input.strategy as Record<string, unknown>, {
    bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
    snapshotId: 'snapshot-1',
  })
  ;(input as BacktestRunInput & { conversationId?: string }).conversationId = 'conv-1'

  await service.createJob(input, OWNER_USER_ID)
  await flushMicrotasks()

  expect(conversations.updateLastBacktestRef).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run the jobs-service test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts
```

Expected:
- FAIL because `BacktestJobsService` has no conversation repository dependency or writeback logic

- [ ] **Step 4: Implement schema and repository support**

Update `apps/quantify/prisma/schema/backtesting_jobs.prisma`:

```prisma
model BacktestJob {
  id             String    @id
  ownerUserId    String    @map("owner_user_id")
  conversationId String?   @map("conversation_id")
  status         String
  snapshotId     String?   @map("snapshot_id")
  snapshotHash   String?   @map("snapshot_hash")
  scriptHash     String?   @map("script_hash")
  specHash       String?   @map("spec_hash")
  inputSummary   Json      @map("input_summary")
  result         Json?     @map("result")
  error          String?
  createdAt      DateTime  @default(now()) @map("created_at")
  startedAt      DateTime? @map("started_at")
  finishedAt     DateTime? @map("finished_at")

  conversation AiQuantConversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)

  @@index([ownerUserId, createdAt], map: "idx_backtest_jobs_owner_created_at")
  @@index([ownerUserId, status], map: "idx_backtest_jobs_owner_status")
  @@index([snapshotId], map: "idx_backtest_jobs_snapshot_id")
  @@index([conversationId, createdAt], map: "idx_backtest_jobs_conversation_created_at")
  @@map("backtest_jobs")
}
```

Update `apps/quantify/prisma/schema/llm_strategies.prisma`:

```prisma
model AiQuantConversation {
  id               String    @id @default(cuid())
  userId           String    @map("user_id")
  codegenSessionId String    @unique @map("codegen_session_id")
  title            String
  lastBacktestRef  Json?     @map("last_backtest_ref")
  archivedAt       DateTime? @map("archived_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")

  codegenSession LlmStrategyCodegenSession    @relation(fields: [codegenSessionId], references: [id], onDelete: Cascade)
  messages       AiQuantConversationMessage[]
  backtestJobs   BacktestJob[]

  @@index([userId, updatedAt], map: "idx_ai_quant_conversations_user_updated_at")
  @@index([userId, archivedAt, updatedAt], map: "idx_ai_quant_conversations_user_archived_updated_at")
  @@map("ai_quant_conversations")
}
```

Run:

```bash
dx db migrate --dev --name add_ai_quant_last_backtest_ref_and_job_conversation_link
```

Expected generated SQL shape:

```sql
ALTER TABLE "ai_quant_conversations" ADD COLUMN "last_backtest_ref" JSONB;
ALTER TABLE "backtest_jobs" ADD COLUMN "conversation_id" TEXT;
CREATE INDEX "idx_backtest_jobs_conversation_created_at" ON "backtest_jobs" ("conversation_id", "created_at");
ALTER TABLE "backtest_jobs"
  ADD CONSTRAINT "backtest_jobs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_quant_conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

Update `apps/quantify/src/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository.ts`:

```ts
export interface AiQuantConversationLastBacktestRefRecord {
  jobId: string
  publishedSnapshotId: string
  summary: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
    openTradeCount?: number
    openPnl?: number
    marketType?: 'spot' | 'perp'
  }
  completedAt: Date
}

export interface AiQuantConversationSnapshotRecord {
  id: string
  userId: string
  codegenSessionId: string
  title: string
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastBacktestRef: AiQuantConversationLastBacktestRefRecord | null
  messages: AiQuantConversationMessageSnapshot[]
}
```

Add repository method:

```ts
  async updateLastBacktestRef(input: {
    conversationId: string
    userId: string
    lastBacktestRef: AiQuantConversationLastBacktestRefRecord
  }): Promise<void> {
    await this.txHost.tx.aiQuantConversation.updateMany({
      where: {
        id: input.conversationId,
        userId: input.userId,
        archivedAt: null,
      },
      data: {
        lastBacktestRef: input.lastBacktestRef as unknown as Prisma.InputJsonValue,
      },
    })
  }
```

- [ ] **Step 5: Implement job persistence and writeback**

Update `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts` constructor:

```ts
  constructor(
    private readonly runner: BacktestRunnerService,
    private readonly marketDataService: BacktestMarketDataService,
    private readonly symbolAvailabilityService: BacktestSymbolAvailabilityService,
    private readonly conversationsRepo: AiQuantConversationsRepository,
    private readonly prisma: PrismaService,
  ) {}
```

Persist `conversationId` in `createJob(...)`:

```ts
      const conversationId = this.readConversationId(input)
      const job = await this.prisma.backtestJob.create({
        data: {
          id,
          ownerUserId,
          conversationId,
          status: 'queued',
          snapshotId: inputSummary.snapshotId ?? null,
          snapshotHash: inputSummary.snapshotHash ?? null,
          scriptHash: inputSummary.scriptHash ?? null,
          specHash: inputSummary.specHash ?? null,
          inputSummary: inputSummary as Prisma.InputJsonValue,
        },
      })
```

After a successful persisted run:

```ts
      await this.prisma.backtestJob.update({
        where: { id },
        data: {
          status: 'succeeded',
          inputSummary: resolvedSummary as Prisma.InputJsonValue,
          result: result as unknown as Prisma.InputJsonValue,
          error: null,
          finishedAt: new Date(),
        },
      })

      if (job.conversationId && resolvedSummary.snapshotId) {
        await this.conversationsRepo.updateLastBacktestRef({
          conversationId: job.conversationId,
          userId: job.ownerUserId,
          lastBacktestRef: {
            jobId: id,
            publishedSnapshotId: resolvedSummary.snapshotId,
            summary: {
              maxDrawdownPct: Number(result.summary.maxDrawdownPct.toFixed(2)),
              totalReturnPct: Number(result.summary.netProfitPct.toFixed(2)),
              winRatePct: Number(((result.summary.winRate <= 1 ? result.summary.winRate * 100 : result.summary.winRate)).toFixed(2)),
              tradeCount: result.summary.totalTrades,
              ...(typeof result.summary.totalOpenTrades === 'number'
                ? { openTradeCount: result.summary.totalOpenTrades }
                : {}),
              ...(typeof result.summary.openPnl === 'number'
                ? { openPnl: Number(result.summary.openPnl.toFixed(2)) }
                : {}),
              marketType: resolvedSummary.marketType,
            },
            completedAt: new Date(),
          },
        })
      }
```

Add helper:

```ts
  private readConversationId(input: BacktestRunInput): string | null {
    const candidate = (input as BacktestRunInput & { conversationId?: unknown }).conversationId
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
  }
```

Register dependency in `apps/quantify/src/modules/backtesting/backtesting.module.ts`:

```ts
import { AiQuantConversationsRepository } from '@/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository'
```

and include it in providers.

- [ ] **Step 6: Re-run the jobs-service test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts
```

Expected:
- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/prisma/schema/backtesting_jobs.prisma apps/quantify/prisma/schema/llm_strategies.prisma apps/quantify/prisma/schema/migrations apps/quantify/src/modules/llm-strategy-codegen/repositories/ai-quant-conversations.repository.ts apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts apps/quantify/src/modules/backtesting/backtesting.module.ts
git commit -F - <<'MSG'
fix: persist snapshot-bound backtest recovery refs per conversation

The front end can only recover a previous backtest after reload if quantify
stores a stable link from a successful backtest job back to the owning
conversation. This change adds that persistence without duplicating full
reports or weakening snapshot authority.

Constraint: only snapshot-matched successful backtests may update recovery state
Rejected: Store full backtest reports on conversation | bloats view state and duplicates source of truth
Confidence: high
Scope-risk: moderate
Reversibility: clean
Directive: lastBacktestRef is a lightweight projection only; keep full report ownership in backtest_jobs.result
Tested: dx test unit quantify apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts
Related: #865
MSG
```

## Task 3: Expose `lastBacktestRef` Through Quantify Conversations And Backend Proxy

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/dto/ai-quant-conversation.response.dto.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`
- Modify: `packages/api-contracts/src/generated/quantify.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`

- [ ] **Step 1: Add a failing quantify conversation-service test**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`:

```ts
it('includes lastBacktestRef when listing AI Quant conversations', async () => {
  mockConversationsRepo.listByUser.mockResolvedValue([
    {
      id: 'conv-1',
      userId: 'user-1',
      codegenSessionId: 'session-1',
      title: 'conv',
      archivedAt: null,
      createdAt: new Date('2026-04-23T00:00:00.000Z'),
      updatedAt: new Date('2026-04-23T00:05:00.000Z'),
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
          marketType: 'spot',
        },
        completedAt: new Date('2026-04-23T00:04:00.000Z'),
      },
      messages: [],
    },
  ])
  mockRepo.findById.mockResolvedValue(null)

  const result = await service.listConversations('user-1')

  expect(result[0]).toMatchObject({
    id: 'conv-1',
    lastBacktestRef: {
      jobId: 'btjob-1',
      publishedSnapshotId: 'snapshot-1',
      summary: expect.objectContaining({
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
      }),
      completedAt: '2026-04-23T00:04:00.000Z',
    },
  })
})
```

- [ ] **Step 2: Add failing proxy/contract assertions**

Append to `apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts`:

```ts
expect(result).toEqual([{
  id: 'conv-1',
  activeCodegenSessionId: 'session-1',
  lastBacktestRef: {
    jobId: 'btjob-1',
    publishedSnapshotId: 'snapshot-1',
    summary: { maxDrawdownPct: 8, totalReturnPct: 12, winRatePct: 60, tradeCount: 5 },
    completedAt: '2026-04-23T00:04:00.000Z',
  },
}])
```

Append to `apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts`:

```ts
const start = source.indexOf('const AiQuantConversationResponseDto = z')
expect(start).toBeGreaterThanOrEqual(0)
const snippet = source.slice(start, start + 2000)
expect(snippet).toContain('lastBacktestRef')
expect(snippet).toContain('publishedSnapshotId: z.string()')
expect(snippet).toContain('completedAt: z.string()')
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
```

Expected:
- FAIL because DTO/service/proxy/contracts do not expose `lastBacktestRef`

- [ ] **Step 4: Implement DTO and mapper changes**

Update `apps/quantify/src/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto.ts`:

```ts
class AiQuantConversationLastBacktestSummaryDto {
  @ApiProperty()
  maxDrawdownPct!: number

  @ApiProperty()
  totalReturnPct!: number

  @ApiProperty()
  winRatePct!: number

  @ApiProperty()
  tradeCount!: number

  @ApiPropertyOptional()
  openTradeCount?: number

  @ApiPropertyOptional()
  openPnl?: number

  @ApiPropertyOptional({ enum: ['spot', 'perp'] })
  marketType?: 'spot' | 'perp'
}

class AiQuantConversationLastBacktestRefDto {
  @ApiProperty()
  jobId!: string

  @ApiProperty()
  publishedSnapshotId!: string

  @ApiProperty({ type: AiQuantConversationLastBacktestSummaryDto })
  summary!: AiQuantConversationLastBacktestSummaryDto

  @ApiProperty()
  completedAt!: string
}
```

and on response:

```ts
  @ApiPropertyOptional({ description: '最近一次可恢复的回测引用', type: AiQuantConversationLastBacktestRefDto, nullable: true })
  lastBacktestRef?: AiQuantConversationLastBacktestRefDto | null
```

Update `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts` inside `toConversationResponse(...)`:

```ts
      lastBacktestRef: conversation.lastBacktestRef
        ? {
            jobId: conversation.lastBacktestRef.jobId,
            publishedSnapshotId: conversation.lastBacktestRef.publishedSnapshotId,
            summary: conversation.lastBacktestRef.summary,
            completedAt: conversation.lastBacktestRef.completedAt.toISOString(),
          }
        : null,
```

Update backend proxy DTO with the same shape and nullable field.

- [ ] **Step 5: Regenerate quantify contracts and re-run tests**

Run:

```bash
dx build contracts --dev
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/dto/ai-quant-conversation.response.dto.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/account-ai-quant-conversations.controller.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/backend/src/modules/ai-quant-proxy/dto/ai-quant-conversation.response.dto.ts apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts packages/api-contracts/src/generated/quantify.ts
git commit -F - <<'MSG'
fix: expose snapshot-bound backtest recovery refs in conversation APIs

The front-end cannot hydrate a recoverable backtest summary unless the
conversation API carries a lightweight backtest reference. This change exposes
that projection end-to-end without moving full reports into conversation views.

Constraint: keep conversation payloads lightweight and job-detail payloads authoritative
Rejected: Fetch latest backtest in a second round trip for every conversation | adds unnecessary restore complexity
Confidence: high
Scope-risk: moderate
Reversibility: clean
Directive: API payloads may carry backtest refs, but complete report ownership remains on backtest job/result endpoints
Tested: dx build contracts --dev
Tested: dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
Tested: dx test unit backend apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
Related: #865
MSG
```

## Task 4: Hydrate Front Conversations Only When Snapshot Truth Matches

**Files:**
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`

- [ ] **Step 1: Add failing front hydration tests**

Append to `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`:

```ts
it('restores backtest summary from lastBacktestRef when publishedSnapshotId matches', () => {
  const conversation = createConversationFromServerConversation({
    id: 'conv-1',
    conversationTitle: 'remote',
    status: 'PUBLISHED',
    conversationMessages: [],
    publishedSnapshotId: 'snapshot-1',
    publishedSnapshotParamValues: null,
    publishedSnapshotStrategyConfig: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '15m',
      positionPct: 10,
    },
    lastBacktestRef: {
      jobId: 'btjob-1',
      publishedSnapshotId: 'snapshot-1',
      summary: {
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
        marketType: 'spot',
      },
      completedAt: '2026-04-23T00:04:00.000Z',
    },
  } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

  expect(conversation.backtestResult).toEqual(expect.objectContaining({
    id: 'btjob-1',
    maxDrawdownPct: 8,
    totalReturnPct: 12,
    winRatePct: 60,
    tradeCount: 5,
    marketType: 'spot',
  }))
})

it('does not restore lastBacktestRef when publishedSnapshotId has drifted', () => {
  const conversation = createConversationFromServerConversation({
    id: 'conv-1',
    conversationTitle: 'remote',
    status: 'PUBLISHED',
    conversationMessages: [],
    publishedSnapshotId: 'snapshot-2',
    publishedSnapshotParamValues: null,
    publishedSnapshotStrategyConfig: {
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '15m',
      positionPct: 10,
    },
    lastBacktestRef: {
      jobId: 'btjob-1',
      publishedSnapshotId: 'snapshot-1',
      summary: {
        maxDrawdownPct: 8,
        totalReturnPct: 12,
        winRatePct: 60,
        tradeCount: 5,
      },
      completedAt: '2026-04-23T00:04:00.000Z',
    },
  } as Parameters<typeof createConversationFromServerConversation>[0], (key: string) => key)

  expect(conversation.backtestResult).toBeNull()
})
```

- [ ] **Step 2: Run the hydration test and verify failure**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
```

Expected:
- FAIL because front API types and hydration logic do not know `lastBacktestRef`

- [ ] **Step 3: Implement API types and hydrate-on-match logic**

Update `apps/front/src/lib/api.ts`:

```ts
export interface AiQuantConversationLastBacktestRef {
  jobId: string
  publishedSnapshotId: string
  summary: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
    openTradeCount?: number
    openPnl?: number
    marketType?: 'spot' | 'perp'
  }
  completedAt: string
}
```

and on `AiQuantConversationResponse`:

```ts
  lastBacktestRef?: AiQuantConversationLastBacktestRef | null
```

Update `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts` with helpers:

```ts
function normalizeLastBacktestRef(
  value: unknown,
): AiQuantConversationLastBacktestRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.jobId !== 'string' ||
    !candidate.jobId.trim() ||
    typeof candidate.publishedSnapshotId !== 'string' ||
    !candidate.publishedSnapshotId.trim() ||
    typeof candidate.completedAt !== 'string' ||
    !candidate.completedAt.trim() ||
    !candidate.summary ||
    typeof candidate.summary !== 'object' ||
    Array.isArray(candidate.summary)
  ) {
    return null
  }

  const summary = candidate.summary as Record<string, unknown>
  if (
    typeof summary.maxDrawdownPct !== 'number' ||
    typeof summary.totalReturnPct !== 'number' ||
    typeof summary.winRatePct !== 'number' ||
    typeof summary.tradeCount !== 'number'
  ) {
    return null
  }

  return {
    jobId: candidate.jobId.trim(),
    publishedSnapshotId: candidate.publishedSnapshotId.trim(),
    summary: {
      maxDrawdownPct: summary.maxDrawdownPct,
      totalReturnPct: summary.totalReturnPct,
      winRatePct: summary.winRatePct,
      tradeCount: summary.tradeCount,
      ...(typeof summary.openTradeCount === 'number' ? { openTradeCount: summary.openTradeCount } : {}),
      ...(typeof summary.openPnl === 'number' ? { openPnl: summary.openPnl } : {}),
      ...(summary.marketType === 'spot' || summary.marketType === 'perp' ? { marketType: summary.marketType } : {}),
    },
    completedAt: candidate.completedAt.trim(),
  }
}

function restoreBacktestResultFromLastBacktestRef(input: {
  conversationPublishedSnapshotId: string | null
  lastBacktestRef: AiQuantConversationLastBacktestRef | null
  symbol: string
}): BacktestResult | null {
  const { conversationPublishedSnapshotId, lastBacktestRef, symbol } = input
  if (!lastBacktestRef || !conversationPublishedSnapshotId) {
    return null
  }
  if (conversationPublishedSnapshotId !== lastBacktestRef.publishedSnapshotId) {
    return null
  }

  return {
    id: lastBacktestRef.jobId,
    symbol,
    maxDrawdownPct: lastBacktestRef.summary.maxDrawdownPct,
    totalReturnPct: lastBacktestRef.summary.totalReturnPct,
    winRatePct: lastBacktestRef.summary.winRatePct,
    tradeCount: lastBacktestRef.summary.tradeCount,
    ...(typeof lastBacktestRef.summary.openTradeCount === 'number'
      ? { openTradeCount: lastBacktestRef.summary.openTradeCount }
      : {}),
    ...(typeof lastBacktestRef.summary.openPnl === 'number'
      ? { openPnl: lastBacktestRef.summary.openPnl }
      : {}),
    ...(lastBacktestRef.summary.marketType ? { marketType: lastBacktestRef.summary.marketType } : {}),
  }
}
```

In `createConversationFromServerConversation(...)`:

```ts
  const lastBacktestRef = normalizeLastBacktestRef(response.lastBacktestRef)
  const restoredBacktestResult = restoreBacktestResultFromLastBacktestRef({
    conversationPublishedSnapshotId: response.publishedSnapshotId ?? null,
    lastBacktestRef,
    symbol: nextParams.symbol,
  })
```

and return:

```ts
    backtestResult: restoredBacktestResult,
```

- [ ] **Step 4: Re-run the hydration test**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add apps/front/src/lib/api.ts apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
git commit -F - <<'MSG'
fix: restore matching snapshot backtest summaries during conversation hydration

The saved conversation payload now includes a lightweight backtest reference,
but the UI must still enforce snapshot authority when restoring it. This
change hydrates backtest summaries only when the current conversation is still
bound to the same published snapshot.

Constraint: drifted conversations must hide old backtests instead of carrying them forward
Rejected: Always restore the latest conversation backtest regardless of snapshot drift | pollutes publish semantics
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: any future restore path must compare publishedSnapshotId before reviving backtest UI state
Tested: dx test unit front apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
Related: #865
MSG
```

## Task 5: Add AI Quant Page Recovery Coverage And Run Final Verification

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`
- Modify: `apps/front/src/lib/api-ai-quant-domain.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`
- Modify if needed: `apps/front/src/lib/api-account-ai-quant-detail.test.ts` / `apps/front/src/lib/api-account-ai-quant-detail-action.test.ts`

- [ ] **Step 1: Add a failing page-level recovery test for server-owned conversations**

Append to `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`:

```tsx
it('restores the latest backtest summary from server-owned conversations after reload when snapshot ids still match', async () => {
  const listAiQuantConversations = jest.requireMock('@/lib/api').listAiQuantConversations as jest.Mock
  listAiQuantConversations.mockResolvedValue([
    {
      id: 'conv-1',
      conversationTitle: 'server conv',
      conversationMessages: [],
      status: 'PUBLISHED',
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotParamValues: null,
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        summary: {
          maxDrawdownPct: 8,
          totalReturnPct: 12,
          winRatePct: 60,
          tradeCount: 5,
          marketType: 'spot',
        },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    },
  ])

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  await act(async () => {
    root.render(<AiQuantPageClient serverOwnedConversations />)
  })

  expect(container.querySelector('[data-testid=\"backtest-summary\"]')?.textContent).toContain('btjob-1')
  expect(container.querySelector('[data-testid=\"backtest-summary\"]')?.textContent).toContain('deployable')
})
```

- [ ] **Step 2: Run the page test and verify failure**

Run:

```bash
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx
```

Expected:
- FAIL until server-owned conversations and mocks carry `lastBacktestRef` correctly

- [ ] **Step 3: Adjust API mocks/types and make the test pass**

Ensure `apps/front/src/lib/api-ai-quant-domain.ts` and any mock fixtures accept the new field:

```ts
type ConversationFixture = AiQuantConversationResponse & {
  lastBacktestRef?: {
    jobId: string
    publishedSnapshotId: string
    summary: {
      maxDrawdownPct: number
      totalReturnPct: number
      winRatePct: number
      tradeCount: number
      marketType?: 'spot' | 'perp'
    }
    completedAt: string
  } | null
}
```

If the backtest summary card depends on deployability gates, keep the fixture under drawdown <= 20 and `tradeCount > 0`.

- [ ] **Step 4: Run final focused verification**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/account-ai-quant-conversations.controller.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
dx test unit backend apps/backend/src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
dx test unit front apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx
dx build contracts --dev
dx build quantify --dev
dx build front --dev
```

Expected:
- all focused unit tests PASS
- contracts regenerate cleanly
- `quantify` and `front` build PASS

- [ ] **Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx apps/front/src/lib/api-ai-quant-domain.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
git commit -F - <<'MSG'
test: lock cross-device ai quant backtest recovery behavior

The critical user-facing regression here is not job persistence but the loss of
recoverable backtest state after page reload or device switch. This test pass
locks the main recovery path and keeps future refactors from breaking it again.

Constraint: recovery must remain server-backed, not browser-local
Rejected: Rely on manual smoke only | too easy to regress
Confidence: high
Scope-risk: narrow
Reversibility: clean
Directive: if recovery UX changes, preserve the snapshot-match guard and page-level restore coverage
Tested: dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx
Tested: dx build quantify --dev
Tested: dx build front --dev
Related: #865
MSG
```
