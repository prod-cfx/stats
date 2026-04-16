# AI Quant Spot Backtest Conditional Leverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Quant backtests require leverage only for confirmed/published perp strategies, while spot strategies hide leverage and run without it.

**Architecture:** Keep the backtest truth boundary anchored on confirmed/published strategy market type, then thread that truth through both front-end entry points and quantify backtesting validation. Front-end UI and payload builders branch on `marketType`, while quantify DTO/business logic accepts missing leverage only for `spot` and rejects unresolved or `perp`-without-leverage requests.

**Tech Stack:** Next.js/React/TypeScript, Jest, NestJS, class-validator, Swagger/OpenAPI generation, pnpm, dx

---

## File Structure

### Front-end truth + chat backtest entry
- Modify: `apps/front/src/lib/api.ts`
  - Add `marketType` to `AccountAiQuantPublishedStrategyConfig` so front-end truth objects can tell `spot` from `perp`.
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
  - Normalize `publishedSnapshotStrategyConfig.marketType`; add a helper that resolves a strict published backtest market type.
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
  - Hide/show the leverage field based on resolved market type and stop treating leverage as universally required.
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
  - Allow spot payloads to omit leverage and fail closed when market type is unresolved.
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
  - Gate backtest on resolved market type and use the new payload semantics.
- Test: `apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`

### Strategy detail page backtest entry
- Modify: `apps/front/src/components/account/ai-quant-strategy-store.ts`
  - Store snapshot `marketType` so the detail page can enforce the same rule set.
- Modify: `apps/front/src/components/account/ai-quant-strategy-api-adapter.ts`
  - Map `marketType` into `publishedSnapshotParamValues` and allow spot snapshot defaults without leverage.
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
  - Reuse conditional leverage payload construction and unresolved-market guard.
- Modify: `apps/front/src/lib/backtesting-api.ts`
  - Make `CreateBacktestJobPayload.leverage` optional/nullable in the front-end API surface.
- Test: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx`
- Test: `apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts`

### Quantify backtesting validation + runtime
- Modify: `apps/quantify/src/modules/backtesting/types/backtesting.types.ts`
  - Encode `marketType` in the request shape and make leverage conditional.
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`
  - Add DTO-level market-type validation and conditional leverage rules.
- Modify: `apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts`
  - Make job input summary leverage optional/nullable and include `marketType`.
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
  - Persist `marketType`; stop assuming every job summary has a numeric leverage.
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
  - Apply leverage caps only for `perp`; treat `spot` as unlevered runtime.
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
  - Accept spot snapshot defaults that omit leverage, while still rejecting missing market type.
- Test: `apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts`

### Contract regeneration + verification
- Regenerate: `packages/api-contracts/src/generated/backend.ts`
- Regenerate: `packages/api-contracts/src/generated/quantify.ts`
- Verify: lint, targeted tests, type-check/build for touched apps, regenerated contracts diff sanity

---

### Task 1: Surface published market type truth to the front-end backtest flow

**Files:**
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
- Test: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts`

- [ ] **Step 1: Write the failing truth-normalization tests**

```ts
it('keeps published snapshot marketType when hydrating a conversation', () => {
  const conversation = hydrateConversation({
    publishedSnapshotStrategyConfig: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '15m',
      positionPct: 25,
    },
  })

  expect(conversation.publishedSnapshotStrategyConfig).toEqual(expect.objectContaining({
    marketType: 'spot',
  }))
})

it('returns null backtest market type when published truth is missing it', () => {
  expect(resolvePublishedBacktestMarketType({
    publishedSnapshotId: 'snapshot-1',
    publishedSnapshotStrategyConfig: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
      positionPct: 25,
      marketType: null,
    },
  })).toBeNull()
})
```

- [ ] **Step 2: Run the front conversation test file and verify failure**

Run: `pnpm --dir apps/front exec jest src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts --runInBand`

Expected: FAIL with missing `marketType` on `AccountAiQuantPublishedStrategyConfig` and/or missing `resolvePublishedBacktestMarketType` helper.

- [ ] **Step 3: Add published market-type support to the front-end truth model**

```ts
// apps/front/src/lib/api.ts
export interface AccountAiQuantPublishedStrategyConfig {
  exchange: string | null
  symbol: string | null
  marketType: 'spot' | 'perp' | null
  baseTimeframe: string | null
  positionPct: number | null
  strategyDeclaredLeverageRange?: AccountAiQuantLeverageRange | null
}

// apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts
function normalizePublishedStrategyConfig(value: unknown): AccountAiQuantPublishedStrategyConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const candidate = value as Record<string, unknown>
  const marketType = typeof candidate.marketType === 'string' ? candidate.marketType.trim().toLowerCase() : ''
  return {
    exchange: typeof candidate.exchange === 'string' ? candidate.exchange : null,
    symbol: typeof candidate.symbol === 'string' ? candidate.symbol : null,
    marketType: marketType === 'spot' || marketType === 'perp' ? marketType : null,
    baseTimeframe: typeof candidate.baseTimeframe === 'string'
      ? candidate.baseTimeframe
      : typeof candidate.timeframe === 'string'
        ? candidate.timeframe
        : null,
    positionPct: typeof candidate.positionPct === 'number'
      ? candidate.positionPct
      : typeof candidate.positionPct === 'string'
        ? Number(candidate.positionPct)
        : null,
    strategyDeclaredLeverageRange: normalizeLeverageRange(candidate.strategyDeclaredLeverageRange),
  }
}

export function resolvePublishedBacktestMarketType(input: {
  publishedSnapshotId: string | null
  publishedSnapshotStrategyConfig: AccountAiQuantPublishedStrategyConfig | null
}): 'spot' | 'perp' | null {
  if (!input.publishedSnapshotId || !input.publishedSnapshotStrategyConfig) return null
  return input.publishedSnapshotStrategyConfig.marketType ?? null
}
```

- [ ] **Step 4: Re-run the conversation test file and verify pass**

Run: `pnpm --dir apps/front exec jest src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts --runInBand`

Expected: PASS, including the new market-type hydration assertions.

- [ ] **Step 5: Commit the truth-model slice**

```bash
git add apps/front/src/lib/api.ts \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts
git commit -m "Align published backtest truth with market type"
```

### Task 2: Make the AI Quant chat page enforce conditional leverage

**Files:**
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts`
- Test: `apps/front/src/components/ai-quant/QuantChatPanel.test.tsx`
- Test: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`

- [ ] **Step 1: Add failing UI and payload tests for spot + unresolved market type**

```ts
it('hides leverage in backtest settings when published market type is spot', async () => {
  renderPanel({
    publishedMarketType: 'spot',
    paramValues: {
      backtestInitialCash: 10000,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    },
  })

  await openBacktestSettings()
  expect(screen.queryByText('aiQuant.backtestLeverage')).toBeNull()
})

it('blocks backtest when published market type is unresolved', async () => {
  await runAiQuantBacktest(makeArgs({
    publishedSnapshotStrategyConfig: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: null,
      baseTimeframe: '15m',
      positionPct: 25,
    },
  }))

  expect(mockCreateBacktestJob).not.toHaveBeenCalled()
  expect(lastAssistantMessage()).toContain('请先确认策略交易的是现货还是合约，然后再开始回测。')
})

it('builds a spot payload without leverage', () => {
  const payload = buildBacktestPayload({
    marketType: 'spot',
    symbol: 'BTCUSDT',
    baseTimeframe: '15m',
    capabilities: { allowedSymbols: ['BTCUSDT'], allowedBaseTimeframes: ['15m'] },
    stateTimeframes: ['15m'],
    initialCash: 10000,
    leverage: null,
    execution: { slippageBps: 10, feeBps: 5, priceSource: 'close' },
    strategy: { id: 'strategy-1', publishedSnapshotId: 'snapshot-1' },
    range: { preset: '30D' },
  })

  expect(payload).not.toHaveProperty('leverage')
})
```

- [ ] **Step 2: Run targeted front chat backtest tests and verify failure**

Run: `pnpm --dir apps/front exec jest src/components/ai-quant/QuantChatPanel.test.tsx src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx --runInBand`

Expected: FAIL because leverage is still rendered/required for spot and unresolved market type is not yet blocked.

- [ ] **Step 3: Implement conditional leverage UI + payload branching**

```ts
// apps/front/src/components/ai-quant/QuantChatPanel.tsx
function shouldRequireBacktestLeverage(marketType: 'spot' | 'perp' | null): boolean {
  return marketType === 'perp'
}

const visibleBacktestFields = BACKTEST_SETTING_FIELDS.filter((field) => {
  if (field.key !== 'backtestLeverage') return true
  return shouldRequireBacktestLeverage(resolvedPublishedMarketType)
})

if (shouldRequireBacktestLeverage(resolvedPublishedMarketType)) {
  const leverage = parseFiniteNumber(paramValues.backtestLeverage)
  if (leverage === null || leverage <= 0 || !Number.isInteger(leverage)) {
    fieldErrors.backtestLeverage = 'aiQuant.messages.positiveNumber'
  }
}

// apps/front/src/components/ai-quant/backtest-payload-builder.ts
export interface BuildBacktestPayloadInput {
  marketType: 'spot' | 'perp'
  leverage: number | null
  // ...existing fields...
}

if (input.marketType === 'perp' && (!Number.isFinite(leverage) || leverage <= 0)) {
  throw new BacktestPayloadBuilderError('invalid_execution_config')
}

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
  dataRange: {
    fromTs: resolvedFromTs,
    toTs: resolvedToTs,
  },
}

if (input.marketType === 'perp') {
  payload.leverage = leverage as number
}

// apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts
const publishedMarketType = resolvePublishedBacktestMarketType({
  publishedSnapshotId: activeConversation.publishedSnapshotId,
  publishedSnapshotStrategyConfig: activeConversation.publishedSnapshotStrategyConfig,
})
if (!publishedMarketType) {
  throw new ApiError('请先确认策略交易的是现货还是合约，然后再开始回测。', 'MARKET_TYPE_UNCONFIRMED')
}
```

- [ ] **Step 4: Re-run the targeted front chat tests and verify pass**

Run: `pnpm --dir apps/front exec jest src/components/ai-quant/QuantChatPanel.test.tsx src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx --runInBand`

Expected: PASS; spot hides leverage, unresolved truth blocks backtest, and spot payloads omit leverage.

- [ ] **Step 5: Commit the chat-entry slice**

```bash
git add apps/front/src/components/ai-quant/QuantChatPanel.tsx \
  apps/front/src/components/ai-quant/backtest-payload-builder.ts \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-backtest.ts \
  apps/front/src/components/ai-quant/QuantChatPanel.test.tsx \
  apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx
git commit -m "Gate chat backtests on published market type"
```

### Task 3: Apply the same conditional leverage semantics to strategy detail backtests

**Files:**
- Modify: `apps/front/src/components/account/ai-quant-strategy-store.ts`
- Modify: `apps/front/src/components/account/ai-quant-strategy-api-adapter.ts`
- Modify: `apps/front/src/lib/backtesting-api.ts`
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
- Test: `apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts`
- Test: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx`

- [ ] **Step 1: Write the failing detail-page tests**

```ts
it('maps snapshot marketType into strategy records', () => {
  const record = mapAccountStrategyDetailToRecord(makeDetail({
    snapshot: {
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'spot',
        baseTimeframe: '15m',
        positionPct: 25,
      },
    },
  }))

  expect(record.publishedSnapshotParamValues).toEqual(expect.objectContaining({
    marketType: 'spot',
  }))
})

it('does not send leverage when detail-page backtest strategy is spot', async () => {
  renderDetailPage(makeStrategyRecord({
    publishedSnapshotParamValues: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      baseTimeframe: '15m',
      positionPct: 25,
    },
    paramValues: {
      backtestInitialCash: 10000,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    },
  }))

  await clickRunBacktest()
  expect(mockCreateBacktestJob).toHaveBeenCalledWith(expect.not.objectContaining({ leverage: expect.anything() }))
})
```

- [ ] **Step 2: Run the strategy detail tests and verify failure**

Run: `pnpm --dir apps/front exec jest src/components/account/ai-quant-strategy-api-adapter.test.ts src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx --runInBand`

Expected: FAIL because the record adapter drops `marketType` and the detail page still always sends leverage.

- [ ] **Step 3: Implement shared detail-page semantics**

```ts
// apps/front/src/components/account/ai-quant-strategy-store.ts
publishedSnapshotParamValues?: {
  exchange?: string
  symbol?: string
  marketType?: 'spot' | 'perp'
  baseTimeframe?: string
  positionPct?: number
} | null

// apps/front/src/components/account/ai-quant-strategy-api-adapter.ts
function buildStrategyBoundPublishedSnapshotParamValues(input: {
  exchange: AiQuantStrategyRecord['exchange']
  strategyConfig: AccountAiQuantPublishedStrategyConfig | null | undefined
  fallbackSymbol: string
  fallbackTimeframe: string
  fallbackPositionPct: number
}): Record<string, unknown> | null {
  if (!input.strategyConfig) return null
  return {
    exchange: input.strategyConfig.exchange ?? input.exchange,
    symbol: input.strategyConfig.symbol ?? input.fallbackSymbol,
    marketType: input.strategyConfig.marketType ?? null,
    baseTimeframe: input.strategyConfig.baseTimeframe ?? input.fallbackTimeframe,
    positionPct: normalizeNumber(input.strategyConfig.positionPct ?? input.fallbackPositionPct),
  }
}

// apps/front/src/lib/backtesting-api.ts
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
  dataRange: { fromTs: number; toTs: number }
  allowPartial?: boolean
  bars?: unknown[]
}
```

- [ ] **Step 4: Re-run the strategy detail tests and verify pass**

Run: `pnpm --dir apps/front exec jest src/components/account/ai-quant-strategy-api-adapter.test.ts src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx --runInBand`

Expected: PASS; the detail page uses the same spot/perp semantics as the chat page.

- [ ] **Step 5: Commit the detail-entry slice**

```bash
git add apps/front/src/components/account/ai-quant-strategy-store.ts \
  apps/front/src/components/account/ai-quant-strategy-api-adapter.ts \
  apps/front/src/lib/backtesting-api.ts \
  apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx \
  apps/front/src/components/account/ai-quant-strategy-api-adapter.test.ts \
  apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx
git commit -m "Unify strategy detail backtests with chat leverage rules"
```

### Task 4: Make quantify accept spot backtests without leverage and reject ambiguous market type

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/types/backtesting.types.ts`
- Modify: `apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts`
- Modify: `apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts`
- Modify: `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
- Test: `apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts`

- [ ] **Step 1: Write the failing quantify tests**

```ts
it('accepts spot run-backtest payload without leverage', async () => {
  const payload = buildValidPayload()
  delete (payload as { leverage?: number }).leverage
  payload.strategy.params = { marketType: 'spot' }

  const dto = plainToInstance(RunBacktestDto, payload)
  const errors = await validate(dto)

  expect(errors).toHaveLength(0)
})

it('rejects perp run-backtest payload without leverage', async () => {
  const payload = buildValidPayload()
  delete (payload as { leverage?: number }).leverage
  payload.strategy.params = { marketType: 'perp' }

  const dto = plainToInstance(RunBacktestDto, payload)
  const errors = await validate(dto)

  expect(errors.length).toBeGreaterThan(0)
})

it('treats spot backtests as unlevered in the runner', async () => {
  const report = await service.run({
    ...buildInput(),
    leverage: undefined,
    strategy: {
      ...buildInput().strategy,
      params: { marketType: 'spot' },
    },
  })

  expect(report.summary.totalTrades).toBeGreaterThanOrEqual(0)
})
```

- [ ] **Step 2: Run the quantify test slice and verify failure**

Run: `pnpm --dir apps/quantify exec jest src/modules/backtesting/dto/run-backtest-dto.spec.ts src/modules/backtesting/core/backtest-runner.service.spec.ts src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts --runInBand`

Expected: FAIL because DTO/backtest types still require numeric leverage everywhere.

- [ ] **Step 3: Implement conditional leverage semantics in quantify**

```ts
// apps/quantify/src/modules/backtesting/types/backtesting.types.ts
export interface BacktestRunInput {
  symbols: string[]
  baseTimeframe: Timeframe
  stateTimeframes: Timeframe[]
  allowPartial?: boolean
  initialCash: number
  leverage?: number | null
  execution: ExecutionConfig
  strategy: {
    id: string
    params: Record<string, unknown>
    // ...existing fields...
  }
  dataRange: { fromTs: number; toTs: number }
  bars: Bar[]
}

// apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts
@ValidatorConstraint({ name: 'backtestLeverageConstraint', async: false })
class BacktestLeverageConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    const objectValue = args?.object as { leverage?: unknown; strategy?: { params?: Record<string, unknown> } } | undefined
    const marketType = typeof objectValue?.strategy?.params?.marketType === 'string'
      ? objectValue.strategy.params.marketType.trim().toLowerCase()
      : ''
    const leverage = typeof objectValue?.leverage === 'number' ? objectValue.leverage : null

    if (marketType === 'spot') return leverage === null || leverage === undefined || leverage > 0
    if (marketType === 'perp') return leverage !== null && leverage !== undefined && Number.isFinite(leverage) && leverage > 0
    return false
  }

  defaultMessage(): string {
    return 'backtest requires confirmed strategy marketType; perp requires leverage and spot must not rely on inferred leverage'
  }
}

@ApiPropertyOptional()
@IsOptional()
@IsNumber()
@IsPositive()
@Validate(BacktestLeverageConstraint)
leverage?: number

// apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts
private resolveEffectiveLeverage(input: BacktestRunInput): number {
  const marketType = typeof input.strategy?.params?.marketType === 'string'
    ? input.strategy.params.marketType.trim().toLowerCase()
    : ''
  if (marketType === 'spot') return 1
  const leverage = input.leverage
  return Number.isFinite(leverage) && leverage! > 0 ? leverage! : 1
}
```

- [ ] **Step 4: Re-run the quantify test slice and verify pass**

Run: `pnpm --dir apps/quantify exec jest src/modules/backtesting/dto/run-backtest-dto.spec.ts src/modules/backtesting/core/backtest-runner.service.spec.ts src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts --runInBand`

Expected: PASS; spot requests can omit leverage, `perp` still requires it, and unresolved market type is rejected.

- [ ] **Step 5: Commit the quantify slice**

```bash
git add apps/quantify/src/modules/backtesting/types/backtesting.types.ts \
  apps/quantify/src/modules/backtesting/dto/run-backtest.dto.ts \
  apps/quantify/src/modules/backtesting/dto/backtest.response.dto.ts \
  apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts \
  apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts \
  apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts \
  apps/quantify/src/modules/backtesting/dto/run-backtest-dto.spec.ts \
  apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts \
  apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts \
  apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts
git commit -m "Allow spot backtests to omit leverage"
```

### Task 5: Regenerate contracts and run the full verification set

**Files:**
- Regenerate: `packages/api-contracts/src/generated/backend.ts`
- Regenerate: `packages/api-contracts/src/generated/quantify.ts`
- Verify: affected front/quantify sources and tests listed below

- [ ] **Step 1: Rebuild swagger sources and regenerate contracts**

```bash
dx build quantify --dev
node scripts/generate-quantify-contracts.mjs
dx build backend --dev
node scripts/generate-backend-contracts.mjs
```

Expected generated diff includes conditional `leverage`/`marketType` contract changes and no unrelated endpoint churn.

- [ ] **Step 2: Run the focused front-end regression suite**

Run:

```bash
pnpm --dir apps/front exec jest \
  src/components/ai-quant/QuantChatPanel.test.tsx \
  src/app/[lng]/ai-quant/ai-quant-page-conversation.test.ts \
  src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx \
  src/components/account/ai-quant-strategy-api-adapter.test.ts \
  src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.test.tsx \
  --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run the focused quantify regression suite**

Run:

```bash
pnpm --dir apps/quantify exec jest \
  src/modules/backtesting/dto/run-backtest-dto.spec.ts \
  src/modules/backtesting/backtesting.controller.spec.ts \
  src/modules/backtesting/core/backtest-runner.service.spec.ts \
  src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 4: Run lint/type/build verification on touched apps**

Run:

```bash
dx lint
pnpm --dir apps/front type-check
dx build affected --dev
```

Expected: PASS with no new errors; only pre-existing unrelated warnings are acceptable if unchanged.

- [ ] **Step 5: Commit regenerated contracts and verification-safe diffs**

```bash
git add packages/api-contracts/src/generated/backend.ts \
  packages/api-contracts/src/generated/quantify.ts
git commit -m "Refresh contracts for spot backtest leverage semantics"
```

---

## Self-Review

### Spec coverage
- Conditional `spot` vs `perp` leverage rule: covered by Tasks 2, 3, and 4.
- Truth boundary uses confirmed/published `marketType`: covered by Tasks 1, 2, and 3.
- Unresolved market type blocks backtest with approved copy: covered by Task 2 and Task 3.
- Old test data gets no fallback guessing: covered by Task 2 (front fail-closed) and Task 4 (quantify rejects unresolved market type).
- All entry points stay aligned: covered by Tasks 2 and 3.
- End-to-end verification and generated contracts: covered by Task 5.

### Placeholder scan
- No `TODO`, `TBD`, or “similar to above” instructions remain.
- Every code-changing task includes concrete file paths, code snippets, commands, and expected outcomes.

### Type consistency
- `marketType` is consistently `'spot' | 'perp' | null` on front-end truth objects.
- Backtest request `leverage` is treated as optional only when `marketType === 'spot'`.
- The same market-type source is used in chat and detail entry points.
