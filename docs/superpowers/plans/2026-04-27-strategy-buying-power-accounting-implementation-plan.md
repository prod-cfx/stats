# Strategy Buying Power Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Quantify deployment, detail display, and signal execution use one buying-power funding model so users can see total equity separately from funds available for new orders.

**Architecture:** Add a pure funding resolver under Quantify trading core, then reuse it from account strategy deploy/detail and signal execution. Keep the first implementation schema-compatible: `user_strategy_accounts.balance` remains the compatibility storage for buying power, while `initialBalance/equity` remain total equity and sizing baseline inputs.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma Decimal, Jest specs, dx command runner.

---

## Scope Check

The spec covers one subsystem boundary: Quantify strategy funding semantics. It touches three call sites, but all changes depend on the same resolver and produce one testable behavior: `totalEquity` and `buyingPower` no longer get confused. This is appropriate for one implementation plan.

## File Structure

- Create `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.ts`
  - Pure TypeScript funding resolver.
  - Exports `StrategyFundingSnapshot`, `resolveStrategyFundingFromExchangeBalance`, and `resolveStrategyFundingFromStrategyAccount`.
- Create `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts`
  - Unit coverage for exchange and local-account funding snapshots.
- Modify `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
  - Compute funding snapshot during deploy.
  - Compute detail overview from funding snapshot instead of raw `free/total` split.
- Modify `apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts`
  - Accept `fundingSnapshot`.
  - Persist the snapshot in `strategyInstance.params` and `userStrategySubscription.customParams`.
  - Create local strategy account with `balance = buyingPower`.
- Modify `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`
  - Add regression for `total > 0` and `free = 0`.
- Modify `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts`
  - Add regression for `equity > 0` and `balance = 0` showing available balance as zero.
- Modify `apps/quantify/src/modules/strategy-signals/repositories/signal-executor.repository.ts`
  - Lock and return `initialBalance` and `equity` in addition to `balance`.
- Modify `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
  - Build funding snapshot for locked account.
  - Use `buyingPower` for open-order checks and final budget cap.
  - Use `executionCapital` for ratio sizing and risk fraction.
- Modify `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`
  - Add regression tests for buying power threshold, ratio sizing cap, and close signal behavior.

---

### Task 1: Add Strategy Buying Power Resolver

**Files:**
- Create: `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.ts`
- Create: `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts`

- [ ] **Step 1: Write the failing resolver spec**

Create `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts`:

```ts
import { Prisma } from '@/prisma/prisma.types'
import {
  resolveStrategyFundingFromExchangeBalance,
  resolveStrategyFundingFromStrategyAccount,
} from './strategy-buying-power.resolver'

describe('strategyBuyingPowerResolver', () => {
  it('keeps total equity separate from zero exchange buying power', () => {
    const funding = resolveStrategyFundingFromExchangeBalance({
      balance: { asset: 'USDT', free: 0, locked: 4901.58222, total: 4901.58222 },
      marketType: 'perp',
      mode: 'TESTNET',
      reservedQuote: 0,
    })

    expect(funding).toMatchObject({
      asset: 'USDT',
      totalEquity: 4901.58222,
      availableCash: null,
      availableEquity: 0,
      reservedQuote: 0,
      buyingPower: 0,
      executionCapital: 4901.58222,
      fundingSource: 'exchange_testnet',
      nonTradableReason: 'exchange_available_balance_zero',
    })
  })

  it('maps spot free balance to available cash and deducts reserved quote', () => {
    const funding = resolveStrategyFundingFromExchangeBalance({
      balance: { asset: 'USDT', free: 120, locked: 30, total: 150 },
      marketType: 'spot',
      mode: 'LIVE',
      reservedQuote: 25,
    })

    expect(funding).toMatchObject({
      availableCash: 120,
      availableEquity: null,
      buyingPower: 95,
      executionCapital: 150,
      fundingSource: 'exchange_live',
      nonTradableReason: null,
    })
  })

  it('derives funding from a local strategy account for legacy accounts', () => {
    const funding = resolveStrategyFundingFromStrategyAccount({
      account: {
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal('4901.58222'),
        initialBalance: new Prisma.Decimal('4901.58222'),
      },
      mode: 'TESTNET',
      reservedQuote: 0,
    })

    expect(funding).toMatchObject({
      asset: 'USDT',
      totalEquity: 4901.58222,
      buyingPower: 0,
      executionCapital: 4901.58222,
      fundingSource: 'exchange_testnet',
      nonTradableReason: 'local_strategy_account_balance_zero',
    })
  })
})
```

- [ ] **Step 2: Run the resolver spec and confirm it fails**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts
```

Expected: FAIL because `strategy-buying-power.resolver.ts` does not exist.

- [ ] **Step 3: Implement the resolver**

Create `apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.ts`:

```ts
import type { MarketType, UnifiedBalance } from './types'

type DeployMode = 'TESTNET' | 'LIVE'

export interface StrategyFundingSnapshot {
  asset: string
  totalEquity: number
  availableCash: number | null
  availableEquity: number | null
  reservedQuote: number
  usedMargin: number | null
  buyingPower: number
  executionCapital: number
  fundingSource: 'exchange_live' | 'exchange_testnet' | 'paper'
  accountMode?: string | null
  marginMode?: string | null
  nonTradableReason?: string | null
}

interface ResolveExchangeFundingInput {
  balance: UnifiedBalance | null
  marketType: MarketType
  mode?: DeployMode | null
  reservedQuote?: number | string | null
}

interface ResolveStrategyAccountFundingInput {
  account: {
    baseCurrency: string | null
    balance: unknown
    equity?: unknown
    initialBalance?: unknown
  }
  mode?: DeployMode | null
  reservedQuote?: number | string | null
}

export function resolveStrategyFundingFromExchangeBalance(input: ResolveExchangeFundingInput): StrategyFundingSnapshot {
  const asset = normalizeAsset(input.balance?.asset)
  const totalEquity = toNonNegativeFiniteNumber(input.balance?.total)
  const available = toNonNegativeFiniteNumber(input.balance?.free)
  const reservedQuote = toNonNegativeFiniteNumber(input.reservedQuote)
  const buyingPower = Math.max(0, roundFundingNumber(available - reservedQuote))
  const isSpot = input.marketType === 'spot'

  return {
    asset,
    totalEquity,
    availableCash: isSpot ? available : null,
    availableEquity: isSpot ? null : available,
    reservedQuote,
    usedMargin: null,
    buyingPower,
    executionCapital: resolveExecutionCapital(totalEquity, buyingPower),
    fundingSource: resolveFundingSource(input.mode),
    accountMode: null,
    marginMode: null,
    nonTradableReason: resolveNonTradableReason(totalEquity, buyingPower, 'exchange_available_balance_zero'),
  }
}

export function resolveStrategyFundingFromStrategyAccount(input: ResolveStrategyAccountFundingInput): StrategyFundingSnapshot {
  const asset = normalizeAsset(input.account.baseCurrency)
  const balance = toNonNegativeFiniteNumber(input.account.balance)
  const equity = toNonNegativeFiniteNumber(input.account.equity)
  const initialBalance = toNonNegativeFiniteNumber(input.account.initialBalance)
  const reservedQuote = toNonNegativeFiniteNumber(input.reservedQuote)
  const buyingPower = Math.max(0, roundFundingNumber(balance - reservedQuote))
  const totalEquity = resolveTotalEquity(equity, initialBalance, balance)

  return {
    asset,
    totalEquity,
    availableCash: null,
    availableEquity: balance,
    reservedQuote,
    usedMargin: null,
    buyingPower,
    executionCapital: resolveExecutionCapital(totalEquity, buyingPower),
    fundingSource: resolveFundingSource(input.mode),
    accountMode: null,
    marginMode: null,
    nonTradableReason: resolveNonTradableReason(totalEquity, buyingPower, 'local_strategy_account_balance_zero'),
  }
}

function resolveFundingSource(mode: DeployMode | null | undefined): StrategyFundingSnapshot['fundingSource'] {
  return mode === 'LIVE' ? 'exchange_live' : 'exchange_testnet'
}

function resolveTotalEquity(equity: number, initialBalance: number, balance: number): number {
  if (equity > 0) return equity
  if (initialBalance > 0) return initialBalance
  return balance
}

function resolveExecutionCapital(totalEquity: number, buyingPower: number): number {
  if (totalEquity > 0) return totalEquity
  return buyingPower
}

function resolveNonTradableReason(totalEquity: number, buyingPower: number, reason: string): string | null {
  if (totalEquity > 0 && buyingPower <= 0) return reason
  return null
}

function normalizeAsset(value: unknown): string {
  if (typeof value !== 'string') return 'USDT'
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : 'USDT'
}

function toNonNegativeFiniteNumber(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return roundFundingNumber(numeric)
}

function roundFundingNumber(value: number): number {
  return Number(value.toFixed(8))
}
```

- [ ] **Step 4: Run the resolver spec and confirm it passes**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.ts apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts
git commit -F - <<'MSG'
feat: add strategy buying power resolver

变更说明：
- 新增 Quantify 策略资金解析器
- 区分 total equity、buying power 和 execution capital
- 覆盖交易所余额与本地策略账户推导场景

Refs: #915
MSG
```

Expected: commit succeeds.

---

### Task 2: Wire Funding Snapshot Into Deploy

**Files:**
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`

- [ ] **Step 1: Write the failing deploy regression**

Append this test inside `describe('accountStrategyViewService.deployStrategy', () => { ... })` in `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`:

```ts
  it('deploys with buying power zero while preserving exchange total equity', async () => {
    const repo = {
      deployStrategyForUser: jest.fn().mockResolvedValue({ strategyInstanceId: 'inst-okx-1', mode: 'TESTNET' }),
      findStrategyForUser: jest.fn().mockResolvedValue(null),
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'req-1' }),
      markDeployRequestSucceeded: jest.fn().mockResolvedValue(undefined),
      markDeployRequestFailed: jest.fn().mockResolvedValue(undefined),
      upsertRiskProfile: jest.fn().mockResolvedValue(undefined),
      activateStrategyInstanceForRuntime: jest.fn().mockResolvedValue(undefined),
      markStrategyInstanceRuntimeBindingFailed: jest.fn().mockResolvedValue(undefined),
    }
    const snapshotsRepository = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'snapshot-hash-1',
        strategyConfig: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '5m',
          marketType: 'perp',
          positionPct: 10,
        },
        deploymentExecutionDefaults: {
          leverage: 1,
          priceSource: 'close',
          orderType: 'market',
          timeInForce: 'GTC',
        },
        deploymentExecutionConstraints: {
          platformRiskMaxLeverage: 5,
          defaultLeverage: 1,
          supportedPriceSources: ['close'],
          supportedOrderTypes: ['market'],
          supportedTimeInForce: ['GTC'],
        },
        strategyInstanceId: 'inst-draft-1',
        strategyTemplateId: 'template-1',
        astSnapshot: {
          decisionPrograms: [{ phase: 'entry' }],
          runtimeExecutionSemantics: createStructuredRuntimeExecutionSemantics(),
        },
      }),
    }
    const tradingService = {
      getBalance: jest.fn().mockResolvedValue([
        { asset: 'USDT', free: 0, locked: 4901.58222, total: 4901.58222 },
      ]),
    }
    const service = new AccountStrategyViewService(
      repo as any,
      { calculateStats: jest.fn(), calculateBatchStats: jest.fn() } as any,
      { updateInstance: jest.fn() } as any,
      { ensureSymbolsSubscribed: jest.fn().mockResolvedValue(undefined) } as any,
      undefined,
      undefined,
      tradingService as any,
      snapshotsRepository as any,
      createRuntimeExecutionStateService() as any,
    )
    service.getStrategyDetail = jest.fn().mockResolvedValue({ id: 'inst-okx-1' } as any)

    await service.deployStrategy({
      userId: 'user-1',
      name: 'OKX BTC 5m',
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      deployRequestId: 'deploy-req-1',
      exchangeAccountId: 'exchange-account-1',
      mode: 'TESTNET',
    } as any)

    expect(repo.deployStrategyForUser).toHaveBeenCalledWith(expect.objectContaining({
      initialBalanceQuote: 4901.58222,
      accountBalanceQuote: 0,
      fundingSnapshot: expect.objectContaining({
        totalEquity: 4901.58222,
        buyingPower: 0,
        executionCapital: 4901.58222,
        nonTradableReason: 'exchange_available_balance_zero',
      }),
    }))
  })
```

- [ ] **Step 2: Run the deploy spec and confirm it fails**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts -t "deploys with buying power zero"
```

Expected: FAIL because `fundingSnapshot` is not passed yet.

- [ ] **Step 3: Update repository input and params persistence**

In `apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts`, add an import:

```ts
import type { StrategyFundingSnapshot } from '@/modules/trading/core/strategy-buying-power.resolver'
```

Extend `DeployStrategyInput`:

```ts
  fundingSnapshot?: StrategyFundingSnapshot | null
```

Inside `mergedParams`, after `accountBalanceQuote`, add:

```ts
          ...(input.fundingSnapshot
            ? { fundingSnapshot: input.fundingSnapshot as unknown as Record<string, unknown> }
            : {}),
```

Do not change `resolveInitialBalanceQuote` or `resolveAccountBalanceQuote` yet. Those helpers should naturally consume `initialBalanceQuote` and `accountBalanceQuote`, where `accountBalanceQuote` is now buying power.

- [ ] **Step 4: Compute funding snapshot during deploy**

In `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`, add an import:

```ts
import { resolveStrategyFundingFromExchangeBalance } from '@/modules/trading/core/strategy-buying-power.resolver'
```

Immediately after `exchangeBalance` is resolved in `deployStrategy`, add:

```ts
    const deployFundingSnapshot = exchangeBalance
      ? resolveStrategyFundingFromExchangeBalance({
          balance: exchangeBalance,
          marketType: resolvedDeploy.marketType,
          mode: dto.mode ?? null,
          reservedQuote: 0,
        })
      : null
```

Update the `repo.deployStrategyForUser` call:

```ts
        initialBalanceQuote: deployFundingSnapshot?.totalEquity ?? exchangeBalance?.total,
        accountBalanceQuote: deployFundingSnapshot?.buyingPower ?? exchangeBalance?.free,
        fundingSnapshot: deployFundingSnapshot,
```

- [ ] **Step 5: Run the targeted deploy regression**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts -t "deploys with buying power zero"
```

Expected: PASS.

- [ ] **Step 6: Run the full deploy spec**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts
git commit -F - <<'MSG'
fix: preserve buying power during strategy deploy

变更说明：
- 部署阶段通过统一资金解析器生成 funding snapshot
- 本地策略账户 balance 写入 buying power
- 保留 total equity 作为 initial balance 和执行本金来源

Refs: #915
MSG
```

Expected: commit succeeds.

---

### Task 3: Show Funding Semantics In Strategy Detail

**Files:**
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/dto/account-strategy-detail.response.dto.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts`

- [ ] **Step 1: Write the failing detail regression**

Append this test to `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts` in the detail describe block that already covers `accountOverview`:

```ts
  it('shows total equity separately from zero available buying power', async () => {
    const repo = createRepoMock()
    repo.findStrategyForUser.mockResolvedValue(createStrategyDetailRow({
      account: {
        id: 'account-1',
        baseCurrency: 'USDT',
        initialBalance: new Prisma.Decimal('4901.58222'),
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal('4901.58222'),
        totalRealizedPnl: new Prisma.Decimal(0),
        totalUnrealizedPnl: new Prisma.Decimal(0),
      },
      params: {
        symbol: 'BTCUSDT',
        exchange: 'okx',
        marketType: 'perp',
        fundingSnapshot: {
          asset: 'USDT',
          totalEquity: 4901.58222,
          availableCash: null,
          availableEquity: 0,
          reservedQuote: 0,
          usedMargin: null,
          buyingPower: 0,
          executionCapital: 4901.58222,
          fundingSource: 'exchange_testnet',
          nonTradableReason: 'exchange_available_balance_zero',
        },
      },
    }))

    const service = createService(repo)
    const detail = await service.getStrategyDetail('user-1', 'strategy-1')

    expect(detail.accountOverview).toEqual(expect.objectContaining({
      initialBalance: 4901.58222,
      totalEquity: 4901.58222,
      availableBalance: 0,
      executionCapital: 4901.58222,
      nonTradableReason: 'exchange_available_balance_zero',
      baseCurrency: 'USDT',
    }))
  })
```

If this spec file does not expose `createRepoMock`, `createStrategyDetailRow`, or `createService`, use the existing helper names in that file and keep the asserted shape exactly the same.

- [ ] **Step 2: Run the targeted detail regression and confirm it fails**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts -t "shows total equity separately"
```

Expected: FAIL because `executionCapital` and `nonTradableReason` are not in `accountOverview`.

- [ ] **Step 3: Extend account overview DTO**

In `apps/quantify/src/modules/account-strategy-view/dto/account-strategy-detail.response.dto.ts`, extend `AccountStrategyAccountOverviewDto`:

```ts
  @ApiPropertyOptional({ description: '策略执行本金，用于百分比仓位计算', example: 4901.58, nullable: true })
  executionCapital?: number | null

  @ApiPropertyOptional({ description: '总权益有值但不可开仓时的原因', example: 'exchange_available_balance_zero', nullable: true })
  nonTradableReason?: string | null
```

Keep the existing required fields unchanged.

- [ ] **Step 4: Add funding snapshot read helpers**

In `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`, import the local-account resolver if it is not already imported:

```ts
import {
  resolveStrategyFundingFromExchangeBalance,
  resolveStrategyFundingFromStrategyAccount,
  type StrategyFundingSnapshot,
} from '@/modules/trading/core/strategy-buying-power.resolver'
```

Add these private helpers near the other account overview helpers:

```ts
  private readFundingSnapshot(params: unknown): StrategyFundingSnapshot | null {
    const record = this.readRecord(params)
    const snapshot = this.readRecord(record?.fundingSnapshot)
    if (!snapshot) return null
    const totalEquity = this.toFiniteNumber(snapshot.totalEquity)
    const buyingPower = this.toFiniteNumber(snapshot.buyingPower)
    const executionCapital = this.toFiniteNumber(snapshot.executionCapital)
    if (totalEquity === null || buyingPower === null || executionCapital === null) return null
    return {
      asset: this.readString(snapshot, ['asset']) ?? 'USDT',
      totalEquity,
      availableCash: this.toFiniteNumber(snapshot.availableCash),
      availableEquity: this.toFiniteNumber(snapshot.availableEquity),
      reservedQuote: this.toFiniteNumber(snapshot.reservedQuote) ?? 0,
      usedMargin: this.toFiniteNumber(snapshot.usedMargin),
      buyingPower,
      executionCapital,
      fundingSource: this.readString(snapshot, ['fundingSource']) === 'exchange_live'
        ? 'exchange_live'
        : this.readString(snapshot, ['fundingSource']) === 'paper'
          ? 'paper'
          : 'exchange_testnet',
      accountMode: this.readString(snapshot, ['accountMode']),
      marginMode: this.readString(snapshot, ['marginMode']),
      nonTradableReason: this.readString(snapshot, ['nonTradableReason']),
    }
  }
```

- [ ] **Step 5: Use funding snapshot in `accountOverview`**

In `getStrategyDetail`, after `overviewBaseCurrency` is computed, add:

```ts
    const paramsFundingSnapshot = this.readFundingSnapshot((row as Record<string, unknown>).params)
    const localFundingSnapshot = account
      ? resolveStrategyFundingFromStrategyAccount({
          account: {
            baseCurrency: this.readAccountBaseCurrency(account),
            balance: account.balance,
            equity: account.equity,
            initialBalance: account.initialBalance,
          },
          mode: (row as Record<string, unknown>).mode === 'LIVE' ? 'LIVE' : 'TESTNET',
          reservedQuote: 0,
        })
      : null
    const overviewFundingSnapshot = shouldUseExchangeBalance && exchangeBalance
      ? resolveStrategyFundingFromExchangeBalance({
          balance: exchangeBalance,
          marketType,
          mode: (row as Record<string, unknown>).mode === 'LIVE' ? 'LIVE' : 'TESTNET',
          reservedQuote: 0,
        })
      : paramsFundingSnapshot ?? localFundingSnapshot
```

Update `accountOverview`:

```ts
      accountOverview: {
        initialBalance: overviewInitialBalance,
        totalEquity: overviewFundingSnapshot?.totalEquity ?? overviewTotalEquity,
        availableBalance: overviewFundingSnapshot?.buyingPower ?? overviewAvailableBalance,
        executionCapital: overviewFundingSnapshot?.executionCapital ?? null,
        nonTradableReason: overviewFundingSnapshot?.nonTradableReason ?? null,
        totalPnl: totalPnl ?? null,
        todayPnl: todayPnl ?? null,
        baseCurrency: overviewFundingSnapshot?.asset ?? overviewBaseCurrency,
      },
```

- [ ] **Step 6: Run the targeted detail regression**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts -t "shows total equity separately"
```

Expected: PASS.

- [ ] **Step 7: Run the full detail spec**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts apps/quantify/src/modules/account-strategy-view/dto/account-strategy-detail.response.dto.ts apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts
git commit -F - <<'MSG'
fix: expose strategy funding status in detail view

变更说明：
- 详情页区分 total equity 与 available buying power
- 返回 execution capital 和不可开仓原因
- 保持旧 accountOverview 字段兼容

Refs: #915
MSG
```

Expected: commit succeeds.

---

### Task 4: Use Buying Power In Signal Execution

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-executor.repository.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`

- [ ] **Step 1: Write failing build-order tests**

Append these tests to `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`:

```ts
  it('skips opening orders when buying power is below the minimum threshold even if equity is positive', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'SELL',
        entryPrice: '77789.4',
        positionSizeRatio: '0.1',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERP',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 6,
          lotSize: '0.000001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal('4901.58222'),
        initialBalance: new Prisma.Decimal('4901.58222'),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
    )

    expect(result).toEqual({
      ok: false,
      reason: 'Buying power below minimum threshold',
    })
  })

  it('sizes ratio orders from execution capital and caps budget by buying power', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'ENTRY',
        direction: 'BUY',
        entryPrice: '100',
        positionSizeRatio: '0.1',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERP',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(120),
        equity: new Prisma.Decimal(4901.58222),
        initialBalance: new Prisma.Decimal(4901.58222),
      },
      {
        ...DEFAULT_STRATEGY_SIGNALS_CONFIG,
        execution: {
          ...DEFAULT_STRATEGY_SIGNALS_CONFIG.execution,
          minBalanceThreshold: 50,
          maxRiskFraction: 1,
        },
      } as any,
    )

    expect(result).toMatchObject({
      ok: true,
      quoteBudget: new Prisma.Decimal(120),
      params: expect.objectContaining({
        amount: 1.2,
      }),
    })
  })

  it('does not require quote buying power for close signals', () => {
    const service = createService()

    const result = (service as any).buildOrderParamsWithLockedAccount(
      {
        signalType: 'EXIT',
        direction: 'CLOSE_LONG',
        entryPrice: '100',
        symbol: {
          exchange: 'OKX',
          instrumentType: 'PERP',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          precisionPrice: 2,
          precisionQuantity: 4,
          lotSize: '0.0001',
        },
      },
      {
        id: 'account-1',
        userId: 'user-1',
        baseCurrency: 'USDT',
        balance: new Prisma.Decimal(0),
        equity: new Prisma.Decimal(4901.58222),
        initialBalance: new Prisma.Decimal(4901.58222),
      },
      DEFAULT_STRATEGY_SIGNALS_CONFIG as any,
      new Prisma.Decimal('0.25'),
    )

    expect(result).toMatchObject({
      ok: true,
      quoteBudget: new Prisma.Decimal(0),
      params: expect.objectContaining({
        reduceOnly: true,
        amount: 0.25,
      }),
    })
  })
```

- [ ] **Step 2: Run targeted signal executor tests and confirm failures**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts -t "buying power|ratio orders|close signals"
```

Expected: at least the first two tests FAIL because execution still uses raw `balance` as both sizing base and budget.

- [ ] **Step 3: Lock full local account funding fields**

In `apps/quantify/src/modules/strategy-signals/repositories/signal-executor.repository.ts`, update `lockAccount` return type:

```ts
      Array<{
        id: string
        userId: string
        baseCurrency: string
        balance: Prisma.Decimal
        equity: Prisma.Decimal
        initialBalance: Prisma.Decimal
      }>
```

Update the SQL select:

```sql
        "balance",
        "equity",
        "initial_balance" AS "initialBalance"
```

- [ ] **Step 4: Update signal executor account type and import resolver**

In `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`, add an import:

```ts
import { resolveStrategyFundingFromStrategyAccount } from '@/modules/trading/core/strategy-buying-power.resolver'
```

Update the two `Pick<UserStrategyAccount, ...>` account types to include `equity` and `initialBalance`:

```ts
Pick<UserStrategyAccount, 'id' | 'userId' | 'baseCurrency' | 'balance' | 'equity' | 'initialBalance'>
```

- [ ] **Step 5: Replace balance-based open-order checks and sizing**

Inside `buildOrderParamsWithLockedAccount`, replace:

```ts
    const balance = account.balance
```

with:

```ts
    const funding = resolveStrategyFundingFromStrategyAccount({
      account,
      mode: null,
      reservedQuote: 0,
    })
    const buyingPower = new Decimal(funding.buyingPower)
    const executionCapital = new Decimal(funding.executionCapital)
```

Replace the minimum threshold check:

```ts
      if (buyingPower.lt(minBalance)) {
        return { ok: false, reason: 'Buying power below minimum threshold' }
      }
```

Replace risk and ratio sizing:

```ts
      const maxRiskQuote = executionCapital.mul(effectiveMaxRiskFraction)
```

For `positionSizeQuote`, cap by buying power:

```ts
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote, buyingPower)
```

For `positionSizeRatio`, calculate from execution capital and cap by buying power:

```ts
        const strategyQuote = executionCapital.mul(ratio)
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote, buyingPower)
```

For fallback default quote:

```ts
        quoteBudget = Decimal.min(maxRiskQuote, defaultQuote, buyingPower)
```

Update debug log wording from `balance` to `execution capital` or `buying power` so logs match the new semantics.

- [ ] **Step 6: Run targeted signal executor tests**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts -t "buying power|ratio orders|close signals"
```

Expected: PASS.

- [ ] **Step 7: Run the full signal executor spec**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add apps/quantify/src/modules/strategy-signals/repositories/signal-executor.repository.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
git commit -F - <<'MSG'
fix: execute signals against strategy buying power

变更说明：
- 执行器读取账户 equity 和 initial balance
- 开仓校验使用 buying power
- 百分比仓位基于 execution capital 并受 buying power 限制
- 平仓信号不因 quote buying power 为 0 被阻断

Refs: #915
MSG
```

Expected: commit succeeds.

---

### Task 5: Final Verification And Contracts

**Files:**
- Modify if generated by command: `packages/api-contracts/src/generated/quantify.ts`
- Modify if generated by command: `packages/api-contracts/openapi/quantify.json`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/trading/core/strategy-buying-power.resolver.spec.ts
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
```

Expected: all commands PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx lint
```

Expected: PASS.

- [ ] **Step 3: Build Quantify**

Run:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 4: Regenerate contracts if Swagger output changes**

Run this only if `AccountStrategyAccountOverviewDto` changes the Quantify OpenAPI output and the repository has a dx command for Quantify contracts:

```bash
PATH="/Users/zengmengdan/Library/pnpm/nodejs/20.19.0/bin:/Users/zengmengdan/Library/pnpm:$PATH" dx build contracts --dev
```

Expected: PASS. If generated files change, include them in the final commit. If no generated files change, record that in the final response.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check
```

Expected:
- `git status --short` shows only intended files.
- `git diff --check` prints no whitespace errors.

- [ ] **Step 6: Commit final contract or lint fixes if needed**

If Step 4 or lint formatting changed files, commit them:

```bash
git add packages/api-contracts/src/generated/quantify.ts packages/api-contracts/openapi/quantify.json
git commit -F - <<'MSG'
chore: refresh quantify strategy funding contracts

变更说明：
- 刷新 Quantify 账户策略详情合约
- 同步 accountOverview funding 字段

Refs: #915
MSG
```

Expected: commit succeeds when generated files changed. If no files changed, skip this commit.

---

## Self-Review

- Spec coverage: Task 1 implements unified funding semantics; Task 2 handles deploy initialization; Task 3 handles detail display; Task 4 handles executor checks, sizing, and close behavior; Task 5 handles verification and contracts.
- Placeholder scan: no placeholder sections are left for implementation. Each task has exact files, commands, expected outcomes, and concrete code snippets for new behavior.
- Type consistency: `StrategyFundingSnapshot`, `resolveStrategyFundingFromExchangeBalance`, and `resolveStrategyFundingFromStrategyAccount` are introduced in Task 1 and reused with the same names in later tasks.
- Compatibility: no Prisma schema migration is required; existing `balance`, `equity`, `initialBalance`, and `availableBalance` fields remain in use.
