import { Prisma, PrismaClient } from '../../generated/prisma'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../../src/modules/strategy-plaza/constants/official-strategy-plaza-templates'
import type { OfficialStrategyPlazaTemplate } from '../../src/modules/strategy-plaza/types/official-strategy-plaza-template'
import { buildOfficialTemplateParamsSnapshot } from '../../src/modules/strategy-plaza/utils/official-strategy-plaza-snapshot-content'
import { buildOfficialStrategySnapshotContent } from '../../src/modules/strategy-plaza/utils/official-strategy-plaza-snapshot-builder'
import { getOfficialTemplateDeploymentExecutionConfig } from '../../src/modules/strategy-plaza/utils/official-strategy-plaza-runtime-contract'

const MODULE = 'StrategyPlazaOfficialTdModeBackfill'

type JsonObject = Record<string, unknown>

interface BackfillOptions {
  apply: boolean
  templateIds?: string[]
}

interface SnapshotRow {
  id: string
  snapshotHash: string
  snapshotVersion: number
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

interface SubscriptionRow {
  id: string
  customParams: unknown
}

interface RuntimeStateRow {
  id: string
  snapshotHash: string
}

interface BackfillPlanItem {
  templateId: string
  snapshotId: string
  strategyInstanceId: string | null
  oldHash: string
  newHash: string
  repairs: string[]
  reason: string
}

interface BackfillSkipItem {
  templateId: string
  input: JsonObject
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
    findUnique: (args: unknown) => Promise<SnapshotRow | null>
    findMany: (args: unknown) => Promise<SnapshotRow[]>
    update: (args: unknown) => Promise<unknown>
  }
  strategyTemplate: {
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
  strategyRuntimeExecutionState: {
    findMany: (args: unknown) => Promise<RuntimeStateRow[]>
    updateMany: (args: unknown) => Promise<{ count: number }>
  }
}

const asRecord = (value: unknown): JsonObject => {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as JsonObject) } : {}
}

function officialMetadata(template: OfficialStrategyPlazaTemplate, snapshotHash: string, snapshotVersion: number): JsonObject {
  return {
    source: 'strategy-plaza-official-template',
    officialTemplateId: template.id,
    officialSnapshotHash: snapshotHash,
    officialSnapshotId: template.runConfig.publishedSnapshotId,
    officialSnapshotVersion: snapshotVersion,
  }
}

function mergeDeploymentExecutionConfig(template: OfficialStrategyPlazaTemplate, current: unknown): JsonObject {
  const officialConfig = getOfficialTemplateDeploymentExecutionConfig(template)
  return {
    ...officialConfig,
    ...asRecord(current),
    ...('tdMode' in officialConfig ? { tdMode: officialConfig.tdMode } : {}),
  }
}

function mergeParams(template: OfficialStrategyPlazaTemplate, current: unknown): JsonObject {
  const currentParams = asRecord(current)
  return {
    ...currentParams,
    deploymentExecutionConfig: mergeDeploymentExecutionConfig(
      template,
      asRecord(currentParams).deploymentExecutionConfig,
    ),
    executionConfigVersion: 1,
  }
}

function snapshotUpdateData(template: OfficialStrategyPlazaTemplate): JsonObject {
  const content = buildOfficialStrategySnapshotContent(template)
  return {
    snapshotHash: content.snapshotHash,
    scriptHash: content.scriptHash,
    specHash: content.specHash,
    irHash: content.irHash,
    astDigest: content.astDigest,
    structuralDigest: content.structuralDigest,
    scriptSnapshot: content.scriptSnapshot,
    specSnapshot: content.specSnapshot as Prisma.InputJsonValue,
    semanticGraph: content.semanticGraph as Prisma.InputJsonValue,
    compiledIr: content.compiledIr as Prisma.InputJsonValue,
    irSnapshot: content.irSnapshot as Prisma.InputJsonValue,
    astSnapshot: content.astSnapshot as Prisma.InputJsonValue,
    compiledManifest: content.compiledManifest as Prisma.InputJsonValue,
    consistencyReport: content.consistencyReport as Prisma.InputJsonValue,
    paramsSnapshot: content.paramsSnapshot as Prisma.InputJsonValue,
    strategyConfig: content.strategyConfig as Prisma.InputJsonValue,
    backtestConfigDefaults: content.backtestConfigDefaults as Prisma.InputJsonValue,
    deploymentExecutionDefaults: content.deploymentExecutionDefaults as Prisma.InputJsonValue,
    deploymentExecutionConstraints: content.deploymentExecutionConstraints as Prisma.InputJsonValue,
    executionEnvelope: content.executionEnvelope as Prisma.InputJsonValue,
    executionPolicy: content.executionPolicy as Prisma.InputJsonValue,
    dataRequirements: content.dataRequirements as Prisma.InputJsonValue,
    userIntentSummary: content.userIntentSummary as Prisma.InputJsonValue,
    strategySummary: content.strategySummary as Prisma.InputJsonValue,
    scriptSummary: content.scriptSummary as Prisma.InputJsonValue,
    lockedParams: content.lockedParams as Prisma.InputJsonValue,
    snapshotVersion: content.snapshotVersion,
  }
}

function snapshotNeedsRepair(snapshot: SnapshotRow, expectedHash: string, expectedVersion: number): boolean {
  return snapshot.snapshotHash !== expectedHash || snapshot.snapshotVersion !== expectedVersion
}

function deploymentConfigNeedsTdModeRepair(template: OfficialStrategyPlazaTemplate, value: unknown): boolean {
  const expected = getOfficialTemplateDeploymentExecutionConfig(template)
  if (!('tdMode' in expected)) return false
  return asRecord(value).tdMode !== expected.tdMode
}

function metadataNeedsRepair(value: unknown, snapshot: SnapshotRow, expectedHash: string, expectedVersion: number): boolean {
  const metadata = asRecord(value)
  return metadata.publishedSnapshotId !== snapshot.id
    || metadata.snapshotHash !== expectedHash
    || metadata.officialSnapshotHash !== expectedHash
    || metadata.officialSnapshotVersion !== expectedVersion
}

export function selectBackfillTemplates(templateIds?: string[]): OfficialStrategyPlazaTemplate[] {
  const requested = new Set(templateIds ?? [])
  return OFFICIAL_STRATEGY_PLAZA_TEMPLATES.filter(template => {
    if (template.runConfig.marketType !== 'perp') return false
    return requested.size === 0 || requested.has(template.id)
  })
}

async function findTemplateSnapshots(prisma: BackfillPrisma, template: OfficialStrategyPlazaTemplate): Promise<SnapshotRow[]> {
  const [sourceSnapshot, copiedSnapshots] = await Promise.all([
    prisma.publishedStrategySnapshot.findUnique({
      where: { id: template.runConfig.publishedSnapshotId },
      select: {
        id: true,
        snapshotHash: true,
        snapshotVersion: true,
        strategyTemplateId: true,
        strategyInstanceId: true,
      },
    }),
    prisma.publishedStrategySnapshot.findMany({
      where: {
        strategyInstanceId: { not: null },
        executionEnvelope: { path: ['source'], equals: 'strategy-plaza-official-template' },
        userIntentSummary: { path: ['templateId'], equals: template.id },
      },
      select: {
        id: true,
        snapshotHash: true,
        snapshotVersion: true,
        strategyTemplateId: true,
        strategyInstanceId: true,
      },
    }),
  ])
  return [...(sourceSnapshot ? [sourceSnapshot] : []), ...copiedSnapshots]
}

async function synchronizeStrategyBinding(
  tx: BackfillPrisma,
  template: OfficialStrategyPlazaTemplate,
  snapshot: SnapshotRow,
  expectedHash: string,
  expectedVersion: number,
): Promise<void> {
  if (!snapshot.strategyInstanceId) return

  const instance = await tx.strategyInstance.findUnique({
    where: { id: snapshot.strategyInstanceId },
    select: {
      id: true,
      strategyTemplateId: true,
      params: true,
      deploymentExecutionConfig: true,
      metadata: true,
    },
  })
  if (!instance) {
    throw new Error(
      `[${MODULE}.synchronizeStrategyBinding] missing strategy instance; input=${JSON.stringify({ templateId: template.id, snapshotId: snapshot.id, strategyInstanceId: snapshot.strategyInstanceId })}; reason=snapshot references a strategy instance that no longer exists`,
    )
  }

  const metadata = {
    ...asRecord(instance.metadata),
    ...officialMetadata(template, expectedHash, expectedVersion),
    bindingSource: 'PUBLISHED_SNAPSHOT',
    publishedSnapshotId: snapshot.id,
    snapshotHash: expectedHash,
  }
  const deploymentExecutionConfig = mergeDeploymentExecutionConfig(template, instance.deploymentExecutionConfig)
  const params = {
    ...mergeParams(template, instance.params),
    deploymentExecutionConfig,
  }

  await tx.strategyTemplate.update({
    where: { id: instance.strategyTemplateId },
    data: {
      defaultParams: buildOfficialTemplateParamsSnapshot(template) as Prisma.InputJsonValue,
      rulesJson: buildOfficialStrategySnapshotContent(template).specSnapshot as Prisma.InputJsonValue,
      metadata: officialMetadata(template, expectedHash, expectedVersion) as Prisma.InputJsonValue,
    },
  })
  await tx.strategyInstance.update({
    where: { id: instance.id },
    data: {
      params: params as Prisma.InputJsonValue,
      deploymentExecutionConfig: deploymentExecutionConfig as Prisma.InputJsonValue,
      executionConfigVersion: 1,
      metadata: metadata as Prisma.InputJsonValue,
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
          deploymentExecutionConfig: mergeDeploymentExecutionConfig(template, customParams.deploymentExecutionConfig),
          executionConfigVersion: 1,
        } as Prisma.InputJsonValue,
      },
    })
  }

  await tx.strategyRuntimeExecutionState.updateMany({
    where: {
      strategyInstanceId: instance.id,
      publishedSnapshotId: snapshot.id,
      snapshotHash: { not: expectedHash },
    },
    data: { snapshotHash: expectedHash },
  })
}

async function buildSnapshotRepairReasons(
  prisma: BackfillPrisma,
  template: OfficialStrategyPlazaTemplate,
  snapshot: SnapshotRow,
  expectedHash: string,
  expectedVersion: number,
): Promise<{ repairs: string[]; skipped?: BackfillSkipItem }> {
  const repairs: string[] = []
  if (snapshotNeedsRepair(snapshot, expectedHash, expectedVersion)) {
    repairs.push('snapshot-content')
  }
  if (!snapshot.strategyInstanceId) return { repairs }

  const instance = await prisma.strategyInstance.findUnique({
    where: { id: snapshot.strategyInstanceId },
    select: {
      id: true,
      strategyTemplateId: true,
      params: true,
      deploymentExecutionConfig: true,
      metadata: true,
    },
  })
  if (!instance) {
    return {
      repairs,
      skipped: {
        templateId: template.id,
        input: { snapshotId: snapshot.id, strategyInstanceId: snapshot.strategyInstanceId },
        reason: 'snapshot references a missing strategy instance',
      },
    }
  }

  if (deploymentConfigNeedsTdModeRepair(template, instance.deploymentExecutionConfig)) {
    repairs.push('instance-deployment-execution-config')
  }
  if (deploymentConfigNeedsTdModeRepair(template, asRecord(instance.params).deploymentExecutionConfig)) {
    repairs.push('instance-params-deployment-execution-config')
  }
  if (metadataNeedsRepair(instance.metadata, snapshot, expectedHash, expectedVersion)) {
    repairs.push('instance-metadata-binding')
  }

  const subscriptions = await prisma.userStrategySubscription.findMany({
    where: { strategyInstanceId: instance.id },
    select: { id: true, customParams: true },
  })
  if (subscriptions.some(subscription => deploymentConfigNeedsTdModeRepair(template, asRecord(subscription.customParams).deploymentExecutionConfig))) {
    repairs.push('subscription-custom-params-deployment-execution-config')
  }

  const runtimeStates = await prisma.strategyRuntimeExecutionState.findMany({
    where: {
      strategyInstanceId: instance.id,
      publishedSnapshotId: snapshot.id,
      snapshotHash: { not: expectedHash },
    },
    select: { id: true, snapshotHash: true },
  })
  if (runtimeStates.length > 0) {
    repairs.push('runtime-state-snapshot-hash')
  }

  return { repairs }
}

export async function buildBackfillPlan(prisma: BackfillPrisma, options: Pick<BackfillOptions, 'templateIds'>): Promise<BackfillResult> {
  const plan: BackfillPlanItem[] = []
  const skipped: BackfillSkipItem[] = []
  let scanned = 0

  for (const template of selectBackfillTemplates(options.templateIds)) {
    const content = buildOfficialStrategySnapshotContent(template)
    const snapshots = await findTemplateSnapshots(prisma, template)
    if (snapshots.length === 0) {
      skipped.push({
        templateId: template.id,
        input: { publishedSnapshotId: template.runConfig.publishedSnapshotId },
        reason: 'no official source or user-copied snapshots found',
      })
      continue
    }

    scanned += snapshots.length
    for (const snapshot of snapshots) {
      const { repairs, skipped: skippedItem } = await buildSnapshotRepairReasons(
        prisma,
        template,
        snapshot,
        content.snapshotHash,
        content.snapshotVersion,
      )
      if (skippedItem) skipped.push(skippedItem)
      if (repairs.length === 0) continue
      plan.push({
        templateId: template.id,
        snapshotId: snapshot.id,
        strategyInstanceId: snapshot.strategyInstanceId,
        oldHash: snapshot.snapshotHash,
        newHash: content.snapshotHash,
        repairs,
        reason: `official perp template deployment execution contract requires explicit tdMode=cross; repairs=${repairs.join(',')}`,
      })
    }
  }

  return { scanned, updated: 0, plan, skipped }
}

export async function runBackfill(prisma: BackfillPrisma, options: BackfillOptions): Promise<BackfillResult> {
  const dryRunPlan = await buildBackfillPlan(prisma, options)
  if (!options.apply) return dryRunPlan

  await prisma.$transaction(async tx => {
    for (const template of selectBackfillTemplates(options.templateIds)) {
      const content = buildOfficialStrategySnapshotContent(template)
      const data = snapshotUpdateData(template)
      const snapshots = await findTemplateSnapshots(tx, template)
      for (const snapshot of snapshots) {
        const { repairs } = await buildSnapshotRepairReasons(tx, template, snapshot, content.snapshotHash, content.snapshotVersion)
        if (repairs.length === 0) continue
        if (repairs.includes('snapshot-content')) {
          await tx.publishedStrategySnapshot.update({
            where: { id: snapshot.id },
            data,
          })
        }
        await synchronizeStrategyBinding(tx, template, snapshot, content.snapshotHash, content.snapshotVersion)
      }
    }
  })

  return { ...dryRunPlan, updated: dryRunPlan.plan.length }
}

export function parseArgs(argv: string[]): BackfillOptions {
  const apply = argv.includes('--apply')
  const dryRun = argv.includes('--dry-run')
  if (apply && dryRun) {
    throw new Error(`[${MODULE}.parseArgs] invalid arguments; input=${JSON.stringify({ argv })}; reason=--apply and --dry-run cannot be used together`)
  }
  const templateFlag = argv.find(arg => arg.startsWith('--template='))
  const templateIds = templateFlag
    ? templateFlag.slice('--template='.length).split(',').map(item => item.trim()).filter(Boolean)
    : undefined
  return { apply, templateIds }
}

function logResult(result: BackfillResult, apply: boolean): void {
  const mode = apply ? 'apply' : 'dry-run'
  console.log(`[${MODULE}.${mode}] scanned=${result.scanned} pending=${result.plan.length} updated=${result.updated}`)
  for (const item of result.plan) {
    console.log(`[${MODULE}.${mode}] input=${JSON.stringify(item)}; reason=${item.reason}`)
  }
  for (const item of result.skipped) {
    console.warn(`[${MODULE}.${mode}] skipped; input=${JSON.stringify(item.input)}; reason=${item.reason}`)
  }
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
