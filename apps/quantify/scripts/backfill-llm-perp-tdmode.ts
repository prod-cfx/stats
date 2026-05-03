const MODULE = 'LlmPerpTdModeBackfill'
const DEFAULT_TD_MODE = 'cross'
const OFFICIAL_STRATEGY_PLAZA_SOURCE = 'strategy-plaza-official-template'

type JsonObject = Record<string, unknown>

export interface BackfillOptions {
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

export interface BackfillPlanItem {
  snapshotId: string
  strategyInstanceId: string | null
  repairs: string[]
}

export interface BackfillSkipItem {
  snapshotId: string
  reason: string
}

export interface BackfillResult {
  scanned: number
  updated: number
  plan: BackfillPlanItem[]
  skipped: BackfillSkipItem[]
}

export interface BackfillPrisma {
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

const asRecord = (value: unknown): JsonObject => {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {}
}

const isRecord = (value: unknown): value is JsonObject => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasCrossTdMode(value: unknown): boolean {
  return asRecord(value).tdMode === DEFAULT_TD_MODE
}

function hasSupportedCrossTdMode(value: unknown): boolean {
  const supportedTdModes = asRecord(value).supportedTdModes
  return Array.isArray(supportedTdModes) && supportedTdModes.includes(DEFAULT_TD_MODE)
}

function withCrossTdMode(value: unknown): JsonObject {
  return {
    ...asRecord(value),
    tdMode: DEFAULT_TD_MODE,
  }
}

function withSupportedCrossTdModes(value: unknown): JsonObject {
  return {
    ...asRecord(value),
    supportedTdModes: [DEFAULT_TD_MODE],
  }
}

async function findCandidateSnapshots(prisma: BackfillPrisma): Promise<SnapshotRow[]> {
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

async function buildSnapshotPlanItem(
  prisma: BackfillPrisma,
  snapshot: SnapshotRow,
): Promise<{ plan?: BackfillPlanItem; skipped?: BackfillSkipItem }> {
  const snapshotId = snapshot.id
  if (asRecord(snapshot.executionEnvelope).source === OFFICIAL_STRATEGY_PLAZA_SOURCE) {
    return { skipped: { snapshotId, reason: 'official strategy plaza snapshot is out of scope' } }
  }
  if (asRecord(snapshot.strategyConfig).marketType !== 'perp') {
    return { skipped: { snapshotId, reason: 'snapshot is not perp' } }
  }
  if (!isRecord(snapshot.deploymentExecutionDefaults) || !isRecord(snapshot.deploymentExecutionConstraints)) {
    return { skipped: { snapshotId, reason: 'snapshot lacks deployment execution objects and requires republish' } }
  }
  if (hasCrossTdMode(snapshot.deploymentExecutionDefaults) && hasSupportedCrossTdMode(snapshot.deploymentExecutionConstraints)) {
    return { skipped: { snapshotId, reason: 'snapshot already has tdMode contract' } }
  }

  const repairs: string[] = []
  if (!hasCrossTdMode(snapshot.deploymentExecutionDefaults)) {
    repairs.push('snapshot-defaults-tdMode')
  }
  if (!hasSupportedCrossTdMode(snapshot.deploymentExecutionConstraints)) {
    repairs.push('snapshot-constraints-supportedTdModes')
  }

  if (snapshot.strategyInstanceId) {
    const instance = await prisma.strategyInstance.findUnique({
      where: { id: snapshot.strategyInstanceId },
      select: { id: true, params: true, deploymentExecutionConfig: true },
    })
    if (instance) {
      if (!hasCrossTdMode(instance.deploymentExecutionConfig)) {
        repairs.push('instance-deployment-execution-config')
      }
      if (!hasCrossTdMode(asRecord(instance.params).deploymentExecutionConfig)) {
        repairs.push('instance-params-deployment-execution-config')
      }

      const subscriptions = await prisma.userStrategySubscription.findMany({
        where: { strategyInstanceId: instance.id },
        select: { id: true, customParams: true },
      })
      if (subscriptions.some(subscription => !hasCrossTdMode(asRecord(subscription.customParams).deploymentExecutionConfig))) {
        repairs.push('subscription-custom-params-deployment-execution-config')
      }
    }
  }

  return {
    plan: {
      snapshotId,
      strategyInstanceId: snapshot.strategyInstanceId,
      repairs,
    },
  }
}

export async function buildBackfillPlan(prisma: BackfillPrisma): Promise<BackfillResult> {
  const snapshots = await findCandidateSnapshots(prisma)
  const plan: BackfillPlanItem[] = []
  const skipped: BackfillSkipItem[] = []

  for (const snapshot of snapshots) {
    const item = await buildSnapshotPlanItem(prisma, snapshot)
    if (item.skipped) {
      skipped.push(item.skipped)
    }
    if (item.plan) {
      plan.push(item.plan)
    }
  }

  return { scanned: snapshots.length, updated: 0, plan, skipped }
}

async function applySnapshotRepair(tx: BackfillPrisma, snapshot: SnapshotRow): Promise<void> {
  await tx.publishedStrategySnapshot.update({
    where: { id: snapshot.id },
    data: {
      deploymentExecutionDefaults: withCrossTdMode(snapshot.deploymentExecutionDefaults),
      deploymentExecutionConstraints: withSupportedCrossTdModes(snapshot.deploymentExecutionConstraints),
    },
  })
}

async function applyStrategyInstanceRepair(tx: BackfillPrisma, strategyInstanceId: string): Promise<void> {
  const instance = await tx.strategyInstance.findUnique({
    where: { id: strategyInstanceId },
    select: { id: true, params: true, deploymentExecutionConfig: true },
  })
  if (!instance) return

  const params = asRecord(instance.params)
  await tx.strategyInstance.update({
    where: { id: instance.id },
    data: {
      deploymentExecutionConfig: withCrossTdMode(instance.deploymentExecutionConfig),
      params: {
        ...params,
        deploymentExecutionConfig: withCrossTdMode(params.deploymentExecutionConfig),
      },
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
        },
      },
    })
  }
}

export async function runBackfill(prisma: BackfillPrisma, options: BackfillOptions): Promise<BackfillResult> {
  const dryRunPlan = await buildBackfillPlan(prisma)
  if (!options.apply) return dryRunPlan

  let updated = 0
  await prisma.$transaction(async tx => {
    const snapshots = await findCandidateSnapshots(tx)
    for (const snapshot of snapshots) {
      const item = await buildSnapshotPlanItem(tx, snapshot)
      if (!item.plan) continue

      await applySnapshotRepair(tx, snapshot)
      if (snapshot.strategyInstanceId) {
        await applyStrategyInstanceRepair(tx, snapshot.strategyInstanceId)
      }
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
  for (const item of result.plan) {
    console.log(`[${MODULE}.${mode}] pending; input=${JSON.stringify(item)}`)
  }
  for (const item of result.skipped) {
    console.warn(`[${MODULE}.${mode}] skipped; input=${JSON.stringify({ snapshotId: item.snapshotId })}; reason=${item.reason}`)
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const { PrismaClient } = require('../generated/prisma') as { PrismaClient: new () => { $disconnect: () => Promise<void> } }
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
