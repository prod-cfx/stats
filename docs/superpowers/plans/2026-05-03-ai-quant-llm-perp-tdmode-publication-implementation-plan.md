# AI Quant LLM Perp tdMode Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure ordinary LLM-generated perpetual AI Quant snapshots publish and backfill explicit OKX cross-margin `tdMode` runtime truth.

**Architecture:** Keep deployment validation strict and move the missing truth to the publication/backfill boundary. `CompiledPublicationGateService` writes `tdMode` only for perpetual snapshots; a separate LLM-only backfill script repairs existing ordinary LLM perpetual snapshots without touching Strategy Plaza official snapshots.

**Tech Stack:** NestJS/TypeScript, Jest unit tests, Prisma JSON columns, existing `dx` command system.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts`
  - Responsibility: build published snapshot `deploymentExecutionDefaults` and `deploymentExecutionConstraints`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts`
  - Responsibility: verify LLM publication runtime contract for spot and perp snapshots.
- Create: `apps/quantify/scripts/backfill-llm-perp-tdmode.ts`
  - Responsibility: dry-run/apply repair ordinary LLM perpetual snapshots and bound runtime configs.
- Create: `apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts`
  - Responsibility: verify backfill selection, skip rules, and synchronized writes.
- No changes: official Strategy Plaza direct-run code under `apps/quantify/src/modules/strategy-plaza/**`.

## Task 1: Publish tdMode For LLM Perpetual Snapshots

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts`

- [ ] **Step 1: Add the failing perpetual publication test**

Append this test in `compiled-publication-gate.service.spec.ts` after the existing "publishes canonical snapshot..." test. It should reuse existing helpers in the file.

```ts
  it('publishes perp deployment execution truth with explicit cross tdMode', async () => {
    const publishedSnapshotsRepo = {
      create: jest.fn().mockResolvedValue({ id: 'snapshot-perp-tdmode' }),
    }
    const gate = new CompiledPublicationGateService(
      publishedSnapshotsRepo as never,
      undefined,
    )
    const ir = createIrFixture({
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      instrumentType: 'perpetual',
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(ir)
    const executionEnvelope = {
      positionMode: 'long_only' as const,
      marginMode: 'cross' as const,
      tickSize: 0.1,
      pricePrecision: 1,
      quantityPrecision: 2,
      fillAssumption: 'strict' as const,
    }
    const script = new CompiledScriptEmitterService().emit({ ast, executionEnvelope })

    await gate.publish({
      sessionId: 'session-perp-tdmode',
      strategyTemplateId: 'template-perp',
      strategyInstanceId: 'instance-perp',
      canonicalSnapshot: {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m' },
        indicators: [],
        rules: [],
      },
      semanticView: { viewType: 'canonical-semantic-view.v1', canonicalDigest: 'sha256:perp', confirmation: { required: false } },
      semanticPredicateGraph: createSemanticPredicateGraphFixture(),
      graphSnapshot: { version: 3, status: 'confirmed', trigger: [], actions: [], risk: [], meta: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', timeframe: '15m', positionPct: 25, executionTags: [] } },
      ir,
      ast,
      executionEnvelope,
      script,
      semanticConsistencyReport: { status: 'PASSED', checks: [] },
      userIntentSummary: { marketScope: ['BTC-USDT-SWAP'] },
      strategySummary: { thesis: 'perp-cross' },
      scriptSummary: { indicators: [] },
      lockedParams: { positionPct: 25 },
    })

    expect(publishedSnapshotsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      strategyConfig: expect.objectContaining({ marketType: 'perp' }),
      deploymentExecutionDefaults: expect.objectContaining({
        leverage: 1,
        tdMode: 'cross',
      }),
      deploymentExecutionConstraints: expect.objectContaining({
        supportedTdModes: ['cross'],
      }),
    }))
  })
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
dx test unit quantify --dev -- apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts -t "publishes perp deployment execution truth"
```

Expected: FAIL because `deploymentExecutionDefaults` has no `tdMode` and constraints have no `supportedTdModes`. If `dx` does not pass Jest args through in this environment, use the configured underlying command through the launcher:

```bash
APP_ENV=development node scripts/dx/quantify-launcher.cjs pnpm --filter ./apps/quantify run test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts -t "publishes perp deployment execution truth"
```

- [ ] **Step 3: Implement the minimal publication change**

In `compiled-publication-gate.service.ts`, change `buildDeploymentExecutionDefaults` and `buildDeploymentExecutionConstraints` like this:

```ts
  private buildDeploymentExecutionDefaults(
    input: PublishCompiledSnapshotInput,
  ): FormalDeploymentExecutionDefaults {
    const isPerp = input.ir.market.instrumentType === 'perpetual'
    return {
      leverage: 1,
      priceSource: this.resolvePriceSource(input.ir.market.priceFeed),
      orderType: input.ir.executionPolicy.orderTypeDefault,
      timeInForce: input.ir.executionPolicy.timeInForce,
      ...(isPerp ? { tdMode: 'cross' as const } : {}),
    }
  }
```

```ts
  private buildDeploymentExecutionConstraints(
    input: PublishCompiledSnapshotInput,
    defaults: FormalDeploymentExecutionDefaults,
  ): FormalDeploymentExecutionConstraints {
    const isPerp = input.ir.market.instrumentType === 'perpetual'
    const platformRiskMaxLeverage = isPerp
      ? DEFAULT_PERP_PLATFORM_MAX_LEVERAGE
      : 1
    return {
      platformRiskMaxLeverage,
      strategyDeclaredLeverageRange: null,
      defaultLeverage: defaults.leverage,
      effectiveAllowedLeverageRange: { min: 1, max: platformRiskMaxLeverage },
      supportedPriceSources: [defaults.priceSource],
      supportedOrderTypes: [defaults.orderType],
      supportedTimeInForce: [defaults.timeInForce],
      ...(isPerp ? { supportedTdModes: ['cross'] as const } : {}),
      constraintExplanation: 'strategy/default constraints pending account-capability intersection',
    }
  }
```

If the local `FormalDeploymentExecutionDefaults` and `FormalDeploymentExecutionConstraints` interfaces do not yet include these optional fields, update them near the top of the same file:

```ts
interface FormalDeploymentExecutionDefaults {
  leverage: number
  priceSource: 'open' | 'close' | 'mid'
  orderType: string
  timeInForce: string
  tdMode?: 'cross'
}

interface FormalDeploymentExecutionConstraints {
  platformRiskMaxLeverage: number
  strategyDeclaredLeverageRange: null
  defaultLeverage: number
  effectiveAllowedLeverageRange: { min: number; max: number }
  supportedPriceSources: Array<'open' | 'close' | 'mid'>
  supportedOrderTypes: string[]
  supportedTimeInForce: string[]
  supportedTdModes?: ['cross']
  constraintExplanation: string
}
```

- [ ] **Step 4: Assert spot remains unchanged**

In the existing first spot publication test, keep the exact expected `deploymentExecutionDefaults` object without `tdMode`, and add explicit negative assertions after the existing `toHaveBeenCalledWith` block:

```ts
    const payload = publishedSnapshotsRepo.create.mock.calls[0][0]
    expect(payload.deploymentExecutionDefaults).not.toHaveProperty('tdMode')
    expect(payload.deploymentExecutionConstraints).not.toHaveProperty('supportedTdModes')
```

- [ ] **Step 5: Run the publication tests**

Run:

```bash
dx test unit quantify --dev -- apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts
```

Expected: PASS. Use the launcher fallback from Step 2 if needed, with `--runTestsByPath`.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts
git commit -F - <<'MSG'
fix: publish LLM perp tdMode truth

Refs: #952
MSG
```

## Task 2: Add LLM Perp tdMode Backfill Script

**Files:**
- Create: `apps/quantify/scripts/backfill-llm-perp-tdmode.ts`
- Create: `apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts`

- [ ] **Step 1: Write the failing backfill tests**

Create `apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts` with this structure:

```ts
import { buildBackfillPlan, parseArgs, runBackfill } from '../backfill-llm-perp-tdmode'

describe('backfill-llm-perp-tdmode', () => {
  function buildPrismaMock() {
    const snapshots = [
      {
        id: 'llm-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'], supportedOrderTypes: ['market'], supportedTimeInForce: ['gtc'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: 'instance-1',
      },
      {
        id: 'official-perp-missing-tdmode',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 2, priceSource: 'mark', orderType: 'market', timeInForce: 'ioc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['mark'], supportedOrderTypes: ['market'], supportedTimeInForce: ['ioc'] },
        executionEnvelope: { source: 'strategy-plaza-official-template' },
        strategyInstanceId: 'official-instance-1',
      },
      {
        id: 'llm-spot',
        strategyConfig: { marketType: 'spot' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
        deploymentExecutionConstraints: { supportedPriceSources: ['close'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: null,
      },
      {
        id: 'llm-perp-current',
        strategyConfig: { marketType: 'perp' },
        deploymentExecutionDefaults: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc', tdMode: 'cross' },
        deploymentExecutionConstraints: { supportedTdModes: ['cross'] },
        executionEnvelope: { source: 'llm-codegen-session' },
        strategyInstanceId: null,
      },
    ]
    const instance = {
      id: 'instance-1',
      params: { deploymentExecutionConfig: { leverage: 1, priceSource: 'close' } },
      deploymentExecutionConfig: { leverage: 1, priceSource: 'close', orderType: 'market', timeInForce: 'gtc' },
    }
    const subscription = {
      id: 'subscription-1',
      customParams: { deploymentExecutionConfig: { leverage: 1 } },
    }
    const prisma = {
      publishedStrategySnapshot: {
        findMany: jest.fn(async () => snapshots),
        update: jest.fn(async ({ where, data }: any) => {
          const row = snapshots.find(item => item.id === where.id)!
          row.deploymentExecutionDefaults = data.deploymentExecutionDefaults
          row.deploymentExecutionConstraints = data.deploymentExecutionConstraints
          return row
        }),
      },
      strategyInstance: {
        findUnique: jest.fn(async ({ where }: any) => where.id === instance.id ? instance : null),
        update: jest.fn(async ({ data }: any) => {
          instance.params = data.params
          instance.deploymentExecutionConfig = data.deploymentExecutionConfig
        }),
      },
      userStrategySubscription: {
        findMany: jest.fn(async () => [subscription]),
        update: jest.fn(async ({ data }: any) => {
          subscription.customParams = data.customParams
        }),
      },
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => callback(prisma)),
    }
    return { instance, prisma, snapshots, subscription }
  }

  it('parses dry-run and apply options', () => {
    expect(parseArgs([])).toEqual({ apply: false })
    expect(parseArgs(['--dry-run'])).toEqual({ apply: false })
    expect(parseArgs(['--apply'])).toEqual({ apply: true })
    expect(() => parseArgs(['--apply', '--dry-run'])).toThrow(/cannot be used together/u)
  })

  it('builds a dry-run plan for ordinary LLM perp snapshots only', async () => {
    const { prisma } = buildPrismaMock()
    const result = await buildBackfillPlan(prisma as never)

    expect(result.scanned).toBe(4)
    expect(result.updated).toBe(0)
    expect(result.plan).toEqual([expect.objectContaining({
      snapshotId: 'llm-perp-missing-tdmode',
      strategyInstanceId: 'instance-1',
      repairs: ['snapshot-defaults-tdMode', 'snapshot-constraints-supportedTdModes', 'instance-deployment-execution-config', 'instance-params-deployment-execution-config', 'subscription-custom-params-deployment-execution-config'],
    })])
    expect(result.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ snapshotId: 'official-perp-missing-tdmode', reason: 'official strategy plaza snapshot is out of scope' }),
      expect.objectContaining({ snapshotId: 'llm-spot', reason: 'snapshot is not perp' }),
      expect.objectContaining({ snapshotId: 'llm-perp-current', reason: 'snapshot already has tdMode contract' }),
    ]))
    expect(prisma.publishedStrategySnapshot.update).not.toHaveBeenCalled()
  })

  it('applies snapshot and bound runtime config repairs', async () => {
    const { instance, prisma, snapshots, subscription } = buildPrismaMock()
    const result = await runBackfill(prisma as never, { apply: true })

    expect(result.updated).toBe(1)
    expect(snapshots[0].deploymentExecutionDefaults).toEqual(expect.objectContaining({ tdMode: 'cross' }))
    expect(snapshots[0].deploymentExecutionConstraints).toEqual(expect.objectContaining({ supportedTdModes: ['cross'] }))
    expect(instance.deploymentExecutionConfig).toEqual(expect.objectContaining({ tdMode: 'cross' }))
    expect(instance.params).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({ tdMode: 'cross' }),
    }))
    expect(subscription.customParams).toEqual(expect.objectContaining({
      deploymentExecutionConfig: expect.objectContaining({ tdMode: 'cross' }),
    }))
  })
})
```

- [ ] **Step 2: Run the backfill tests and confirm they fail**

Run:

```bash
dx test unit quantify --dev -- apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts
```

Expected: FAIL because `../backfill-llm-perp-tdmode` does not exist.

- [ ] **Step 3: Create the backfill script**

Create `apps/quantify/scripts/backfill-llm-perp-tdmode.ts`:

```ts
import { Prisma, PrismaClient } from '../generated/prisma'

const MODULE = 'LlmPerpTdModeBackfill'

type JsonObject = Record<string, unknown>

interface BackfillOptions {
  apply: boolean
}

interface SnapshotRow {
  id: string
  strategyConfig: unknown
  deploymentExecutionDefaults: unknown
  deploymentExecutionConstraints: unknown
  executionEnvelope: unknown
  strategyInstanceId: string | null
}

interface StrategyInstanceRow {
  id: string
  params: unknown
  deploymentExecutionConfig: unknown
}

interface SubscriptionRow {
  id: string
  customParams: unknown
}

interface BackfillPlanItem {
  snapshotId: string
  strategyInstanceId: string | null
  repairs: string[]
  reason: string
}

interface BackfillSkipItem {
  snapshotId: string
  reason: string
}

export interface BackfillResult {
  scanned: number
  updated: number
  plan: BackfillPlanItem[]
  skipped: BackfillSkipItem[]
}

interface BackfillPrisma {
  $transaction: (callback: (tx: BackfillPrisma) => Promise<void>) => Promise<void>
  publishedStrategySnapshot: {
    findMany: (args: unknown) => Promise<SnapshotRow[]>
    update: (args: unknown) => Promise<unknown>
  }
  strategyInstance: {
    findUnique: (args: unknown) => Promise<StrategyInstanceRow | null>
    update: (args: unknown) => Promise<unknown>
  }
  userStrategySubscription: {
    findMany: (args: unknown) => Promise<SubscriptionRow[]>
    update: (args: unknown) => Promise<unknown>
  }
}

function asRecord(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {}
}

function hasCrossTdMode(value: unknown): boolean {
  return asRecord(value).tdMode === 'cross'
}

function hasSupportedCrossTdMode(value: unknown): boolean {
  const supported = asRecord(value).supportedTdModes
  return Array.isArray(supported) && supported.includes('cross')
}

function withCrossTdMode(value: unknown): JsonObject {
  return { ...asRecord(value), tdMode: 'cross' }
}

function withSupportedCrossTdMode(value: unknown): JsonObject {
  return { ...asRecord(value), supportedTdModes: ['cross'] }
}

function isOfficialSnapshot(snapshot: SnapshotRow): boolean {
  return asRecord(snapshot.executionEnvelope).source === 'strategy-plaza-official-template'
}

function isPerpSnapshot(snapshot: SnapshotRow): boolean {
  return asRecord(snapshot.strategyConfig).marketType === 'perp'
}

async function listCandidateSnapshots(prisma: BackfillPrisma): Promise<SnapshotRow[]> {
  return prisma.publishedStrategySnapshot.findMany({
    where: {
      strategyConfig: { path: ['marketType'], equals: 'perp' },
    },
    select: {
      id: true,
      strategyConfig: true,
      deploymentExecutionDefaults: true,
      deploymentExecutionConstraints: true,
      executionEnvelope: true,
      strategyInstanceId: true,
    },
  })
}

async function buildPlanForSnapshot(prisma: BackfillPrisma, snapshot: SnapshotRow): Promise<{ plan?: BackfillPlanItem, skip?: BackfillSkipItem }> {
  if (!isPerpSnapshot(snapshot)) return { skip: { snapshotId: snapshot.id, reason: 'snapshot is not perp' } }
  if (isOfficialSnapshot(snapshot)) return { skip: { snapshotId: snapshot.id, reason: 'official strategy plaza snapshot is out of scope' } }
  const defaults = asRecord(snapshot.deploymentExecutionDefaults)
  const constraints = asRecord(snapshot.deploymentExecutionConstraints)
  if (!Object.keys(defaults).length || !Object.keys(constraints).length) {
    return { skip: { snapshotId: snapshot.id, reason: 'snapshot lacks deployment execution objects and requires republish' } }
  }
  if (hasCrossTdMode(defaults) && hasSupportedCrossTdMode(constraints)) {
    return { skip: { snapshotId: snapshot.id, reason: 'snapshot already has tdMode contract' } }
  }

  const repairs: string[] = []
  if (!hasCrossTdMode(defaults)) repairs.push('snapshot-defaults-tdMode')
  if (!hasSupportedCrossTdMode(constraints)) repairs.push('snapshot-constraints-supportedTdModes')

  if (snapshot.strategyInstanceId) {
    const instance = await prisma.strategyInstance.findUnique({
      where: { id: snapshot.strategyInstanceId },
      select: { id: true, params: true, deploymentExecutionConfig: true },
    })
    if (!instance) return { skip: { snapshotId: snapshot.id, reason: 'snapshot references missing strategy instance' } }
    if (!hasCrossTdMode(instance.deploymentExecutionConfig)) repairs.push('instance-deployment-execution-config')
    if (!hasCrossTdMode(asRecord(instance.params).deploymentExecutionConfig)) repairs.push('instance-params-deployment-execution-config')
    const subscriptions = await prisma.userStrategySubscription.findMany({
      where: { strategyInstanceId: instance.id },
      select: { id: true, customParams: true },
    })
    if (subscriptions.some(subscription => !hasCrossTdMode(asRecord(subscription.customParams).deploymentExecutionConfig))) {
      repairs.push('subscription-custom-params-deployment-execution-config')
    }
  }

  return {
    plan: {
      snapshotId: snapshot.id,
      strategyInstanceId: snapshot.strategyInstanceId,
      repairs,
      reason: `ordinary LLM perp snapshot deployment execution contract requires tdMode=cross; repairs=${repairs.join(',')}`,
    },
  }
}

export async function buildBackfillPlan(prisma: BackfillPrisma): Promise<BackfillResult> {
  const snapshots = await listCandidateSnapshots(prisma)
  const plan: BackfillPlanItem[] = []
  const skipped: BackfillSkipItem[] = []
  for (const snapshot of snapshots) {
    const item = await buildPlanForSnapshot(prisma, snapshot)
    if (item.plan && item.plan.repairs.length > 0) plan.push(item.plan)
    if (item.skip) skipped.push(item.skip)
  }
  return { scanned: snapshots.length, updated: 0, plan, skipped }
}

async function applySnapshotRepair(tx: BackfillPrisma, snapshot: SnapshotRow): Promise<void> {
  await tx.publishedStrategySnapshot.update({
    where: { id: snapshot.id },
    data: {
      deploymentExecutionDefaults: withCrossTdMode(snapshot.deploymentExecutionDefaults) as Prisma.InputJsonValue,
      deploymentExecutionConstraints: withSupportedCrossTdMode(snapshot.deploymentExecutionConstraints) as Prisma.InputJsonValue,
    },
  })

  if (!snapshot.strategyInstanceId) return
  const instance = await tx.strategyInstance.findUnique({
    where: { id: snapshot.strategyInstanceId },
    select: { id: true, params: true, deploymentExecutionConfig: true },
  })
  if (!instance) return
  const params = asRecord(instance.params)
  await tx.strategyInstance.update({
    where: { id: instance.id },
    data: {
      deploymentExecutionConfig: withCrossTdMode(instance.deploymentExecutionConfig) as Prisma.InputJsonValue,
      params: {
        ...params,
        deploymentExecutionConfig: withCrossTdMode(params.deploymentExecutionConfig),
      } as Prisma.InputJsonValue,
    },
  })

  const subscriptions = await tx.userStrategySubscription.findMany({
    where: { strategyInstanceId: instance.id },
    select: { id: true, customParams: true },
  })
  for (const subscription of subscriptions) {
    const customParams = asRecord(subscription.customParams)
    await tx.userStrategySubscription.update({
      where: { id: subscription.id },
      data: {
        customParams: {
          ...customParams,
          deploymentExecutionConfig: withCrossTdMode(customParams.deploymentExecutionConfig),
        } as Prisma.InputJsonValue,
      },
    })
  }
}

export async function runBackfill(prisma: BackfillPrisma, options: BackfillOptions): Promise<BackfillResult> {
  const dryRunPlan = await buildBackfillPlan(prisma)
  if (!options.apply) return dryRunPlan
  let updated = 0
  await prisma.$transaction(async tx => {
    const snapshots = await listCandidateSnapshots(tx)
    for (const snapshot of snapshots) {
      const item = await buildPlanForSnapshot(tx, snapshot)
      if (!item.plan || item.plan.repairs.length === 0) continue
      await applySnapshotRepair(tx, snapshot)
      updated += 1
    }
  })
  return { ...dryRunPlan, updated }
}

export function parseArgs(argv: string[]): BackfillOptions {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run')
  if (apply && dryRun) {
    throw new Error(`[${MODULE}.parseArgs] invalid arguments; input=${JSON.stringify({ argv })}; reason=--apply and --dry-run cannot be used together`)
  }
  return { apply }
}

function logResult(result: BackfillResult, apply: boolean): void {
  const mode = apply ? 'apply' : 'dry-run'
  console.log(`[${MODULE}.${mode}] scanned=${result.scanned} pending=${result.plan.length} updated=${result.updated}`)
  for (const item of result.plan) console.log(`[${MODULE}.${mode}] input=${JSON.stringify(item)}; reason=${item.reason}`)
  for (const item of result.skipped) console.warn(`[${MODULE}.${mode}] skipped; input=${JSON.stringify({ snapshotId: item.snapshotId })}; reason=${item.reason}`)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const prisma = new PrismaClient()
  try {
    const result = await runBackfill(prisma as unknown as BackfillPrisma, options)
    logResult(result, options.apply)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[${MODULE}.main] failed; input=${JSON.stringify({ argv: process.argv.slice(2) })}; reason=${(error as Error).message}`)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run the backfill tests**

Run:

```bash
dx test unit quantify --dev -- apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts
```

Expected: PASS. Use the launcher fallback if `dx` cannot pass Jest args through.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/quantify/scripts/backfill-llm-perp-tdmode.ts apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts
git commit -F - <<'MSG'
fix: add LLM perp tdMode backfill

Refs: #952
MSG
```

## Task 3: Integration Verification And Rollout Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-ai-quant-llm-perp-tdmode-publication-design.md` only if implementation discovers a necessary correction to the accepted spec.

- [ ] **Step 1: Run focused publication and backfill tests together**

Run:

```bash
dx test unit quantify --dev -- apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-publication-gate.service.spec.ts apps/quantify/scripts/__tests__/backfill-llm-perp-tdmode.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run quantify type/build verification**

Run:

```bash
dx build quantify --dev
```

Expected: PASS. This catches script import path and interface typing errors.

- [ ] **Step 3: Inspect final git diff**

Run:

```bash
git diff --stat HEAD
git diff -- apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts apps/quantify/scripts/backfill-llm-perp-tdmode.ts
```

Expected: diff is limited to LLM publication, LLM backfill, tests, and any explicitly updated spec wording.

- [ ] **Step 4: Commit final verification note if needed**

If Task 3 required spec wording corrections, commit them:

```bash
git add docs/superpowers/specs/2026-05-03-ai-quant-llm-perp-tdmode-publication-design.md
git commit -F - <<'MSG'
docs: align tdMode rollout notes

Refs: #952
MSG
```

If no spec changes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Task 1 covers new snapshot publication for ordinary LLM paths, including Strategy Plaza edit sessions because they publish through codegen. Task 2 covers staging backfill for ordinary LLM perp snapshots and explicitly skips official snapshots and spot. Task 3 covers verification and rollout confidence.
- Placeholder scan: The plan contains no placeholder markers or unspecified "add tests" steps. Each code-changing step includes concrete code and commands.
- Type consistency: The plan uses `tdMode`, `supportedTdModes`, `deploymentExecutionDefaults`, `deploymentExecutionConstraints`, and `deploymentExecutionConfig` consistently with existing code and the accepted spec.
