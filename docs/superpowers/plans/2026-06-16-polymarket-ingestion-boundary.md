# Polymarket Ingestion Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Polymarket data-sync writes behind a Polymarket-owned ingestion service so `DataSyncModule` no longer registers `PolymarketRepository` directly.

**Architecture:** Add `PolymarketIngestionService` in the Polymarket module as the write port for data-sync jobs. Keep repository ownership inside `PolymarketModule`, export only the ingestion service, and leave job run result, cursor, and repository persistence semantics unchanged.

**Tech Stack:** NestJS 11, TypeScript, Jest, Nx/dx backend commands.

---

## Files

- Create: `apps/backend/src/modules/polymarket/polymarket-ingestion.service.ts` — Polymarket write/read port consumed by data-sync jobs.
- Modify: `apps/backend/src/modules/polymarket/polymarket.module.ts` — register and export ingestion service.
- Modify: `apps/backend/src/modules/data-sync/data-sync.module.ts` — import `PolymarketModule`; remove direct repository provider.
- Modify: `apps/backend/src/modules/data-sync/jobs/polymarket-markets.job.ts` — inject ingestion service and call write/translation methods through it.
- Modify: `apps/backend/src/modules/data-sync/jobs/polymarket-orderbook.job.ts` — inject ingestion service and call token listing / snapshot persistence through it.
- Modify: `apps/backend/src/modules/data-sync/jobs/polymarket-markets-job.spec.ts` — update mocks to ingestion service and assert behavior remains stable.
- Create: `apps/backend/src/modules/data-sync/jobs/polymarket-orderbook-job.spec.ts` — cover orderbook job ingestion service calls and run result.

## Task 1: Add Red Tests For Ingestion Boundary

- [ ] **Step 1: Update markets job spec constructor mock**

Replace `repo` mock with `ingestion` mock in `apps/backend/src/modules/data-sync/jobs/polymarket-markets-job.spec.ts`:

```ts
const ingestion = {
  upsertMarketWithOutcomes: jest.fn().mockResolvedValue(undefined),
  findMarketsForTranslation: jest.fn().mockResolvedValue([]),
}

const job = new PolymarketMarketsJob(
  gammaClient as any,
  ingestion as any,
  configService as any,
  translateClient as any,
)

return {
  job,
  gammaClient,
  ingestion,
}
```

Update assertions from `repo.upsertMarketWithOutcomes` to `ingestion.upsertMarketWithOutcomes`.

- [ ] **Step 2: Add orderbook job spec**

Create `apps/backend/src/modules/data-sync/jobs/polymarket-orderbook-job.spec.ts`:

```ts
import { PolymarketOrderbookJob } from './polymarket-orderbook.job'

describe('polymarket orderbook job', () => {
  const createJob = () => {
    const clobClient = {
      fetchOrderbook: jest.fn(),
    }
    const ingestion = {
      listOutcomeTokens: jest.fn(),
      saveOrderbookSnapshot: jest.fn().mockResolvedValue(undefined),
    }
    const configService = {
      get: jest.fn((key: string) => {
        if (key !== 'polymarket') return undefined
        return { filters: { category: 'crypto' } }
      }),
    }

    const job = new PolymarketOrderbookJob(clobClient as any, ingestion as any, configService as any)
    return { job, clobClient, ingestion }
  }

  it('reads outcome tokens and saves snapshots through ingestion service', async () => {
    const { job, clobClient, ingestion } = createJob()
    ingestion.listOutcomeTokens.mockResolvedValueOnce([
      {
        marketDbId: 11,
        marketExternalId: 'market-1',
        outcomeDbId: 22,
        outcomeTokenId: 'token-yes',
      },
    ])
    clobClient.fetchOrderbook.mockResolvedValueOnce({
      bids: [{ price: '0.40', size: '10' }],
      asks: [{ price: '0.45', size: '12' }],
      seq: '123',
      timestamp: '1766738570134',
    })

    const result = await job.run({
      taskId: 1,
      key: job.key,
      cursor: null,
      meta: { category: 'crypto' },
      now: new Date('2026-06-16T00:00:00.000Z'),
    })

    expect(ingestion.listOutcomeTokens).toHaveBeenCalledWith({
      category: 'crypto',
      limit: 25,
      offset: 0,
    })
    expect(ingestion.saveOrderbookSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        marketDbId: 11,
        outcomeDbId: 22,
        marketExternalId: 'market-1',
        outcomeTokenId: 'token-yes',
        spread: '0.050000',
        source: 'POLYMARKET',
      }),
    )
    expect(result).toEqual({
      fetchedCount: 1,
      newCursor: JSON.stringify({ offset: 0, failedTokens: undefined, skippedTokens: undefined }),
      meta: expect.objectContaining({
        tokensProcessed: 1,
        success: 1,
        failed: 0,
        skipped: 0,
        nextOffset: 0,
        category: 'crypto',
      }),
    })
  })
})
```

- [ ] **Step 3: Verify RED**

Run: `dx test unit backend apps/backend/src/modules/data-sync/jobs/polymarket-markets-job.spec.ts apps/backend/src/modules/data-sync/jobs/polymarket-orderbook-job.spec.ts`

Expected: FAIL because constructors still expect `PolymarketRepository` and imports still reference repository directly.

## Task 2: Add Polymarket Ingestion Service

- [ ] **Step 1: Create service**

Create `apps/backend/src/modules/polymarket/polymarket-ingestion.service.ts`:

```ts
import type {
  MarketTranslationSnapshot,
  OutcomeTokenRecord,
  PolymarketMarketWriteInput,
  PolymarketOrderbookSnapshotInput,
  PolymarketOutcomeWriteWithoutMarketInput,
} from './polymarket.repository'
import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketRepository } from './polymarket.repository'

@Injectable()
export class PolymarketIngestionService {
  constructor(private readonly repository: PolymarketRepository) {}

  upsertMarketWithOutcomes(
    market: PolymarketMarketWriteInput,
    outcomes: PolymarketOutcomeWriteWithoutMarketInput[],
  ): Promise<void> {
    return this.repository.upsertMarketWithOutcomes(market, outcomes)
  }

  listOutcomeTokens(params: {
    category?: string | null
    limit?: number
    offset?: number
  }): Promise<OutcomeTokenRecord[]> {
    return this.repository.listOutcomeTokens(params)
  }

  saveOrderbookSnapshot(input: PolymarketOrderbookSnapshotInput): Promise<void> {
    return this.repository.saveOrderbookSnapshot(input)
  }

  findMarketsForTranslation(ids: string[]): Promise<MarketTranslationSnapshot[]> {
    return this.repository.findMarketsForTranslation(ids)
  }
}
```

- [ ] **Step 2: Export service from PolymarketModule**

Modify `apps/backend/src/modules/polymarket/polymarket.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PolymarketController } from './polymarket.controller'
import { PolymarketIngestionService } from './polymarket-ingestion.service'
import { PolymarketRepository } from './polymarket.repository'
import { PolymarketService } from './polymarket.service'

@Module({
  imports: [AuthModule],
  controllers: [PolymarketController],
  providers: [PolymarketRepository, PolymarketService, PolymarketIngestionService],
  exports: [PolymarketIngestionService],
})
export class PolymarketModule {}
```

## Task 3: Rewire Data Sync Jobs And Module

- [ ] **Step 1: Replace repository injection in markets job**

In `apps/backend/src/modules/data-sync/jobs/polymarket-markets.job.ts`, replace repository import with:

```ts
import { PolymarketIngestionService } from '@/modules/polymarket/polymarket-ingestion.service'
```

Change constructor parameter:

```ts
private readonly ingestion: PolymarketIngestionService,
```

Replace `this.repo.` usages with `this.ingestion.`.

- [ ] **Step 2: Replace repository injection in orderbook job**

In `apps/backend/src/modules/data-sync/jobs/polymarket-orderbook.job.ts`, replace repository import with:

```ts
import { PolymarketIngestionService } from '@/modules/polymarket/polymarket-ingestion.service'
```

Change constructor parameter:

```ts
private readonly ingestion: PolymarketIngestionService,
```

Replace `this.repo.` usages with `this.ingestion.`.

- [ ] **Step 3: Import PolymarketModule from DataSyncModule**

In `apps/backend/src/modules/data-sync/data-sync.module.ts`, remove:

```ts
import { PolymarketRepository } from '@/modules/polymarket/polymarket.repository'
```

Add:

```ts
import { PolymarketModule } from '@/modules/polymarket/polymarket.module'
```

Add `PolymarketModule` to `imports`, and remove `PolymarketRepository` from `providers`.

## Task 4: Verify And Commit

- [ ] **Step 1: Verify focused unit tests**

Run: `dx test unit backend apps/backend/src/modules/data-sync`

Expected: PASS.

- [ ] **Step 2: Run full required parallel gate**

Run in parallel:

```bash
dx lint
dx build backend --dev
dx test unit backend apps/backend/src/modules/data-sync
```

Expected: all exit 0.

- [ ] **Step 3: Commit**

Use heredoc commit message:

```bash
git add -A
git commit -F - <<'MSG'
refactor: 收敛 Polymarket ingestion 边界

变更说明：
- 新增 PolymarketIngestionService 作为 data-sync 写入端口，避免跨模块直接注册 repository
- DataSyncModule 通过 PolymarketModule 获取 Polymarket 写入能力，并补充 jobs 单测覆盖

Refs: #2549
Refs: #2471
MSG
```

## Self-Review

- Spec coverage: Issue 验收标准全部映射到 Task 2-4。
- Placeholder scan: 无 TBD/TODO/占位步骤。
- Type consistency: service 方法签名直接复用 repository 导出类型，job constructor 参数一致。
