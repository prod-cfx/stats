import { createHash } from 'node:crypto'

const MODULE = 'LlmPerpTdModeBackfill'
const DEFAULT_TD_MODE = 'cross'
const LLM_CODEGEN_SESSION_SOURCE = 'llm-codegen-session'
const OFFICIAL_STRATEGY_PLAZA_SOURCE = 'strategy-plaza-official-template'

type JsonObject = Record<string, unknown>

export interface BackfillOptions {
  apply: boolean
}

interface SnapshotRow {
  id: string
  snapshotHash: string
  scriptHash: string
  specHash: string
  irHash: string | null
  astDigest: string | null
  structuralDigest: string | null
  semanticGraph: unknown
  compiledIr: unknown
  astSnapshot: unknown
  compiledManifest: unknown
  consistencyReport: unknown
  userIntentSummary: unknown
  strategySummary: unknown
  scriptSummary: unknown
  lockedParams: unknown
  snapshotVersion: number
  paramsSnapshot: unknown
  strategyConfig: unknown
  backtestConfigDefaults: unknown
  deploymentExecutionDefaults: unknown
  deploymentExecutionConstraints: unknown
  executionEnvelope: unknown
  executionPolicy: unknown
  dataRequirements: unknown
  strategyTemplateId: string | null
  strategyInstanceId: string | null
}

interface StrategyInstanceRow {
  id: string
  strategyTemplateId: string
  params: unknown
  deploymentExecutionConfig: unknown
  metadata: unknown
}

interface StrategyTemplateRow {
  id: string
  metadata: unknown
}

interface SubscriptionRow {
  id: string
  customParams: unknown
}

interface RuntimeStateUpdateResult {
  count: number
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
  strategyTemplate: {
    findUnique: (args: unknown) => Promise<StrategyTemplateRow | null>
  }
  userStrategySubscription: {
    findMany: (args: unknown) => Promise<SubscriptionRow[]>
    update: (args: unknown) => Promise<unknown>
  }
  strategyRuntimeExecutionState: {
    updateMany: (args: unknown) => Promise<RuntimeStateUpdateResult>
  }
}

const asRecord = (value: unknown): JsonObject => {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {}
}

const isRecord = (value: unknown): value is JsonObject => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as JsonObject)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeOptionalJson(value: unknown): string | null {
  return value ? stableJsonStringify(value) : null
}

function resolveBoundRecord(
  snapshotId: string,
  field: string,
  value: unknown,
): { record: JsonObject; skipped?: undefined } | { record?: undefined; skipped: BackfillSkipItem } {
  if (value == null) return { record: {} }
  if (isRecord(value)) return { record: { ...value } }
  return { skipped: { snapshotId, reason: `${field} is malformed and requires manual repair` } }
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

function computeSnapshotHash(
  snapshot: SnapshotRow,
  deploymentExecutionDefaults: JsonObject,
  deploymentExecutionConstraints: JsonObject,
): string {
  const normalizedSemanticGraph = normalizeOptionalJson(snapshot.semanticGraph)
  const normalizedCompiledIr = normalizeOptionalJson(snapshot.compiledIr)
  const normalizedAst = normalizeOptionalJson(snapshot.astSnapshot)
  const normalizedManifest = normalizeOptionalJson(snapshot.compiledManifest)
  const normalizedExecutionEnvelope = normalizeOptionalJson(snapshot.executionEnvelope)
  const normalizedConsistency = stableJsonStringify(snapshot.consistencyReport)
  const normalizedUserIntentSummary = stableJsonStringify(snapshot.userIntentSummary)
  const normalizedStrategySummary = stableJsonStringify(snapshot.strategySummary)
  const normalizedScriptSummary = stableJsonStringify(snapshot.scriptSummary)
  const normalizedLockedParams = stableJsonStringify(snapshot.lockedParams)
  const normalizedParams = normalizeOptionalJson(snapshot.paramsSnapshot)
  const normalizedStrategyConfig = normalizeOptionalJson(snapshot.strategyConfig)
  const normalizedBacktestConfigDefaults = normalizeOptionalJson(snapshot.backtestConfigDefaults)
  const normalizedDeploymentExecutionDefaults = normalizeOptionalJson(deploymentExecutionDefaults)
  const normalizedDeploymentExecutionConstraints = normalizeOptionalJson(deploymentExecutionConstraints)
  const normalizedExecutionPolicy = normalizeOptionalJson(snapshot.executionPolicy)
  const normalizedDataRequirements = normalizeOptionalJson(snapshot.dataRequirements)

  return sha256([
    snapshot.scriptHash,
    snapshot.specHash,
    normalizedSemanticGraph ? sha256(normalizedSemanticGraph) : '',
    normalizedCompiledIr ? sha256(normalizedCompiledIr) : '',
    snapshot.irHash ?? '',
    snapshot.astDigest ?? '',
    normalizedAst ? sha256(normalizedAst) : '',
    snapshot.structuralDigest ?? '',
    normalizedManifest ? sha256(normalizedManifest) : '',
    normalizedExecutionEnvelope ? sha256(normalizedExecutionEnvelope) : '',
    sha256(normalizedConsistency),
    sha256(normalizedUserIntentSummary),
    sha256(normalizedStrategySummary),
    sha256(normalizedScriptSummary),
    sha256(normalizedLockedParams),
    sha256(String(snapshot.snapshotVersion)),
    normalizedParams ? sha256(normalizedParams) : '',
    normalizedStrategyConfig ? sha256(normalizedStrategyConfig) : '',
    normalizedBacktestConfigDefaults ? sha256(normalizedBacktestConfigDefaults) : '',
    normalizedDeploymentExecutionDefaults ? sha256(normalizedDeploymentExecutionDefaults) : '',
    normalizedDeploymentExecutionConstraints ? sha256(normalizedDeploymentExecutionConstraints) : '',
    normalizedExecutionPolicy ? sha256(normalizedExecutionPolicy) : '',
    normalizedDataRequirements ? sha256(normalizedDataRequirements) : '',
  ].join(':'))
}

function buildSnapshotRepair(snapshot: SnapshotRow): {
  deploymentExecutionDefaults: JsonObject
  deploymentExecutionConstraints: JsonObject
  snapshotHash: string
} {
  const deploymentExecutionDefaults = withCrossTdMode(snapshot.deploymentExecutionDefaults)
  const deploymentExecutionConstraints = withSupportedCrossTdModes(snapshot.deploymentExecutionConstraints)
  return {
    deploymentExecutionDefaults,
    deploymentExecutionConstraints,
    snapshotHash: computeSnapshotHash(snapshot, deploymentExecutionDefaults, deploymentExecutionConstraints),
  }
}

function hasLlmCodegenSource(value: unknown): boolean {
  return asRecord(value).source === LLM_CODEGEN_SESSION_SOURCE
}

async function findCandidateSnapshots(prisma: BackfillPrisma): Promise<SnapshotRow[]> {
  return prisma.publishedStrategySnapshot.findMany({
    where: {
      strategyConfig: { path: ['marketType'], equals: 'perp' },
    },
    select: {
      id: true,
      snapshotHash: true,
      scriptHash: true,
      specHash: true,
      irHash: true,
      astDigest: true,
      structuralDigest: true,
      semanticGraph: true,
      compiledIr: true,
      astSnapshot: true,
      compiledManifest: true,
      consistencyReport: true,
      userIntentSummary: true,
      strategySummary: true,
      scriptSummary: true,
      lockedParams: true,
      snapshotVersion: true,
      paramsSnapshot: true,
      strategyConfig: true,
      backtestConfigDefaults: true,
      deploymentExecutionDefaults: true,
      deploymentExecutionConstraints: true,
      executionEnvelope: true,
      executionPolicy: true,
      dataRequirements: true,
      strategyTemplateId: true,
      strategyInstanceId: true,
    },
  })
}

async function findBoundStrategyInstance(
  prisma: BackfillPrisma,
  strategyInstanceId: string | null,
): Promise<StrategyInstanceRow | null> {
  if (!strategyInstanceId) return null
  return prisma.strategyInstance.findUnique({
    where: { id: strategyInstanceId },
    select: { id: true, strategyTemplateId: true, params: true, deploymentExecutionConfig: true, metadata: true },
  })
}

async function findBoundStrategyTemplate(
  prisma: BackfillPrisma,
  snapshot: SnapshotRow,
  instance: StrategyInstanceRow | null,
): Promise<StrategyTemplateRow | null> {
  const strategyTemplateId = snapshot.strategyTemplateId ?? instance?.strategyTemplateId ?? null
  if (!strategyTemplateId) return null
  return prisma.strategyTemplate.findUnique({
    where: { id: strategyTemplateId },
    select: { id: true, metadata: true },
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

  const instance = await findBoundStrategyInstance(prisma, snapshot.strategyInstanceId)
  const template = await findBoundStrategyTemplate(prisma, snapshot, instance)
  if (!hasLlmCodegenSource(instance?.metadata) && !hasLlmCodegenSource(template?.metadata)) {
    return { skipped: { snapshotId, reason: 'snapshot is not an ordinary LLM publication snapshot' } }
  }
  if (!isRecord(snapshot.deploymentExecutionDefaults) || !isRecord(snapshot.deploymentExecutionConstraints)) {
    return { skipped: { snapshotId, reason: 'snapshot lacks deployment execution objects and requires republish' } }
  }

  const repairs: string[] = []
  if (!hasCrossTdMode(snapshot.deploymentExecutionDefaults)) {
    repairs.push('snapshot-defaults-tdMode')
  }
  if (!hasSupportedCrossTdMode(snapshot.deploymentExecutionConstraints)) {
    repairs.push('snapshot-constraints-supportedTdModes')
  }

  if (snapshot.strategyInstanceId) {
    if (instance) {
      const instanceDeploymentExecutionConfig = resolveBoundRecord(
        snapshotId,
        'strategyInstance.deploymentExecutionConfig',
        instance.deploymentExecutionConfig,
      )
      if (instanceDeploymentExecutionConfig.skipped) return { skipped: instanceDeploymentExecutionConfig.skipped }

      const params = resolveBoundRecord(snapshotId, 'strategyInstance.params', instance.params)
      if (params.skipped) return { skipped: params.skipped }

      const paramsDeploymentExecutionConfig = resolveBoundRecord(
        snapshotId,
        'strategyInstance.params.deploymentExecutionConfig',
        params.record.deploymentExecutionConfig,
      )
      if (paramsDeploymentExecutionConfig.skipped) return { skipped: paramsDeploymentExecutionConfig.skipped }

      if (!hasCrossTdMode(instanceDeploymentExecutionConfig.record)) {
        repairs.push('instance-deployment-execution-config')
      }
      if (!hasCrossTdMode(paramsDeploymentExecutionConfig.record)) {
        repairs.push('instance-params-deployment-execution-config')
      }

      const subscriptions = await prisma.userStrategySubscription.findMany({
        where: { strategyInstanceId: instance.id },
        select: { id: true, customParams: true },
      })
      let needsSubscriptionRepair = false
      for (const subscription of subscriptions) {
        const customParams = resolveBoundRecord(snapshotId, 'userStrategySubscription.customParams', subscription.customParams)
        if (customParams.skipped) return { skipped: customParams.skipped }

        const customDeploymentExecutionConfig = resolveBoundRecord(
          snapshotId,
          'userStrategySubscription.customParams.deploymentExecutionConfig',
          customParams.record.deploymentExecutionConfig,
        )
        if (customDeploymentExecutionConfig.skipped) return { skipped: customDeploymentExecutionConfig.skipped }

        needsSubscriptionRepair ||= !hasCrossTdMode(customDeploymentExecutionConfig.record)
      }
      if (needsSubscriptionRepair) {
        repairs.push('subscription-custom-params-deployment-execution-config')
      }
    }
  }
  if (repairs.length === 0) {
    return { skipped: { snapshotId, reason: 'snapshot already has tdMode contract' } }
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

async function applySnapshotRepair(
  tx: BackfillPrisma,
  snapshot: SnapshotRow,
  repair: ReturnType<typeof buildSnapshotRepair>,
): Promise<void> {
  await tx.publishedStrategySnapshot.update({
    where: { id: snapshot.id },
    data: {
      snapshotHash: repair.snapshotHash,
      deploymentExecutionDefaults: repair.deploymentExecutionDefaults,
      deploymentExecutionConstraints: repair.deploymentExecutionConstraints,
    },
  })
}

async function applyStrategyInstanceRepair(
  tx: BackfillPrisma,
  snapshotId: string,
  strategyInstanceId: string,
  snapshotHash: string,
): Promise<boolean> {
  const instance = await tx.strategyInstance.findUnique({
    where: { id: strategyInstanceId },
    select: { id: true, strategyTemplateId: true, params: true, deploymentExecutionConfig: true, metadata: true },
  })
  if (!instance) return true

  const instanceDeploymentExecutionConfig = resolveBoundRecord(
    snapshotId,
    'strategyInstance.deploymentExecutionConfig',
    instance.deploymentExecutionConfig,
  )
  if (instanceDeploymentExecutionConfig.skipped) return false

  const params = resolveBoundRecord(snapshotId, 'strategyInstance.params', instance.params)
  if (params.skipped) return false

  const paramsDeploymentExecutionConfig = resolveBoundRecord(
    snapshotId,
    'strategyInstance.params.deploymentExecutionConfig',
    params.record.deploymentExecutionConfig,
  )
  if (paramsDeploymentExecutionConfig.skipped) return false

  const subscriptions = await tx.userStrategySubscription.findMany({
    where: { strategyInstanceId: instance.id },
    select: { id: true, customParams: true },
  })
  const subscriptionRepairs: Array<{ id: string; customParams: JsonObject; deploymentExecutionConfig: JsonObject }> = []
  for (const subscription of subscriptions) {
    const customParams = resolveBoundRecord(snapshotId, 'userStrategySubscription.customParams', subscription.customParams)
    if (customParams.skipped) return false

    const customDeploymentExecutionConfig = resolveBoundRecord(
      snapshotId,
      'userStrategySubscription.customParams.deploymentExecutionConfig',
      customParams.record.deploymentExecutionConfig,
    )
    if (customDeploymentExecutionConfig.skipped) return false

    subscriptionRepairs.push({
      id: subscription.id,
      customParams: customParams.record,
      deploymentExecutionConfig: customDeploymentExecutionConfig.record,
    })
  }

  await tx.strategyInstance.update({
    where: { id: instance.id },
    data: {
      deploymentExecutionConfig: withCrossTdMode(instanceDeploymentExecutionConfig.record),
      params: {
        ...params.record,
        deploymentExecutionConfig: withCrossTdMode(paramsDeploymentExecutionConfig.record),
      },
      metadata: {
        ...asRecord(instance.metadata),
        bindingSource: 'PUBLISHED_SNAPSHOT',
        publishedSnapshotId: snapshotId,
        snapshotHash,
      },
    },
  })

  for (const subscription of subscriptionRepairs) {
    await tx.userStrategySubscription.update({
      where: { id: subscription.id },
      data: {
        customParams: {
          ...subscription.customParams,
          deploymentExecutionConfig: withCrossTdMode(subscription.deploymentExecutionConfig),
        },
      },
    })
  }
  await tx.strategyRuntimeExecutionState.updateMany({
    where: {
      strategyInstanceId: instance.id,
      publishedSnapshotId: snapshotId,
      snapshotHash: { not: snapshotHash },
    },
    data: { snapshotHash },
  })
  return true
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

      const snapshotRepair = buildSnapshotRepair(snapshot)
      if (snapshot.strategyInstanceId) {
        const runtimeRepairApplied = await applyStrategyInstanceRepair(tx, snapshot.id, snapshot.strategyInstanceId, snapshotRepair.snapshotHash)
        if (!runtimeRepairApplied) continue
      }
      await applySnapshotRepair(tx, snapshot, snapshotRepair)
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
    console.log(`[${MODULE}.${mode}] ${apply ? 'applied' : 'planned'}; input=${JSON.stringify(item)}`)
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
