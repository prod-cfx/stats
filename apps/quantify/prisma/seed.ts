// Prisma 7: explicitly load environment variables.
import { createHash } from 'node:crypto'
import * as path from 'node:path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma'
import { createEnvAccessor } from '../src/common/env/env.accessor'
import { applyQuantifyEnvOverrides } from '../src/config/quantify-env'
import { resolveConfiguredBacktestCapabilityConfig } from '../src/modules/backtesting/backtest-capability-config'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../src/modules/strategy-plaza/constants/official-strategy-plaza-templates'
import {
  buildOfficialTemplateBacktestConfigDefaults,
  buildOfficialTemplateDataRequirements,
  buildOfficialTemplateDeploymentExecutionConstraints,
  buildOfficialTemplateDeploymentExecutionDefaults,
  buildOfficialTemplateParamsSnapshot,
  buildOfficialTemplateStrategyConfig,
} from '../src/modules/strategy-plaza/utils/official-strategy-plaza-snapshot-content'

// Load environment variables using the shared loader.
const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

// Access environment variables via the shared accessor.
const env = createEnvAccessor()

const dbUrl = env.str('DATABASE_URL')
if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('DATABASE_URL is not configured. Set a valid value in .env.*.local.')
  process.exit(1)
}
const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const OFFICIAL_STRATEGY_PLAZA_USER_ID = 'official-strategy-plaza'
const OFFICIAL_STRATEGY_PLAZA_LLM_MODEL = 'official-strategy-plaza'

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function buildOfficialStrategyScript(templateId: string): string {
  return [
    '// Official Strategy Plaza public beta template.',
    `export default function strategy() { return { action: 'HOLD', templateId: '${templateId}' } }`,
    '',
  ].join('\n')
}

function buildOfficialStrategySpec(template: typeof OFFICIAL_STRATEGY_PLAZA_TEMPLATES[number]) {
  return {
    version: 1,
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    name: template.name,
    logicDescription: template.logicDescription,
    runConfig: {
      exchange: template.runConfig.exchange,
      marketType: template.runConfig.marketType,
      symbol: template.runConfig.symbol,
      timeframe: template.runConfig.timeframe,
      positionPct: template.runConfig.positionPct,
      leverage: template.runConfig.leverage,
    },
  }
}

function buildOfficialStrategyAstSnapshot() {
  return {
    runtimeExecutionSemantics: [{
      semanticKey: 'on_start.entry.primary',
      trigger: 'on_start',
      phase: 'entry',
      consumePolicy: 'once',
      requiredRuntimeContext: {
        barIndex: 1,
        requiresReferenceBar: true,
        requiresSymbol: true,
        requiresTimeframe: true,
      },
      sourceRefs: ['official-template-entry'],
    }],
  }
}

function buildOfficialStrategySnapshotContent(template: typeof OFFICIAL_STRATEGY_PLAZA_TEMPLATES[number]) {
  const scriptSnapshot = buildOfficialStrategyScript(template.id)
  const specSnapshot = buildOfficialStrategySpec(template)
  const astSnapshot = buildOfficialStrategyAstSnapshot()
  const semanticGraph = {
    nodes: [{ id: 'entry-primary', type: 'decision', label: template.name }],
    edges: [],
  }
  const compiledManifest = {
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    artifactVersion: 1,
  }
  const compiledIr = {
    source: 'strategy-plaza-official-template',
    templateId: template.id,
    market: {
      venue: template.runConfig.exchange,
      symbol: template.runConfig.symbol,
      instrumentType: template.runConfig.marketType,
      timeframe: template.runConfig.timeframe,
    },
  }
  const runtimeContent = {
    paramsSnapshot: buildOfficialTemplateParamsSnapshot(template),
    strategyConfig: buildOfficialTemplateStrategyConfig(template),
    backtestConfigDefaults: buildOfficialTemplateBacktestConfigDefaults(template),
    deploymentExecutionDefaults: buildOfficialTemplateDeploymentExecutionDefaults(template),
    deploymentExecutionConstraints: buildOfficialTemplateDeploymentExecutionConstraints(template),
    dataRequirements: buildOfficialTemplateDataRequirements(template),
    lockedParams: buildOfficialTemplateParamsSnapshot(template),
  }

  return {
    snapshotHash: sha256Json({ specSnapshot, runtimeContent }),
    scriptHash: sha256Json(scriptSnapshot),
    specHash: sha256Json(specSnapshot),
    irHash: sha256Json(compiledIr),
    astDigest: sha256Json(astSnapshot),
    structuralDigest: sha256Json({ semanticGraph, astSnapshot }),
    scriptSnapshot,
    specSnapshot,
    semanticGraph,
    compiledIr,
    irSnapshot: compiledIr,
    astSnapshot,
    compiledManifest,
    consistencyReport: { status: 'PASSED', source: 'strategy-plaza-official-template' },
    ...runtimeContent,
    executionEnvelope: { runtime: 'signal-generator', source: 'strategy-plaza-official-template' },
    executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN', allowPartialFill: false },
    userIntentSummary: { templateId: template.id, name: template.name },
    strategySummary: { name: template.name, description: template.description },
    scriptSummary: { source: 'strategy-plaza-official-template', logic: template.logicDescription },
    snapshotVersion: 3,
  }
}

async function seedAiProviderKeys() {
  const rawKey = env.raw('UNIAPI_API_KEY')
  const apiKey = rawKey?.trim()

  // Skip provider seeding when the key is missing or still a placeholder.
  if (!apiKey || apiKey === '__SET_IN_env.local__') {
    console.warn(
      '[seed] UNIAPI_API_KEY is not configured. Skipping AiProviderKey seeding for uniapi/default.',
    )
    return
  }

  console.log('[seed] Seeding AI provider config for uniapi/default...')

  interface AiProviderKeyDelegate {
    upsert: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    aiProviderKey?: AiProviderKeyDelegate
  }

  if (!client.aiProviderKey || typeof client.aiProviderKey.upsert !== 'function') {
    console.warn(
      '[seed] Prisma Client does not expose aiProviderKey. Skipping AiProviderKey seeding.',
    )
    return
  }

  await client.aiProviderKey.upsert({
    where: {
      providerCode_name: {
        providerCode: 'uniapi',
        name: 'default',
      },
    },
    update: {
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
    create: {
      providerCode: 'uniapi',
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      name: 'default',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
  })

  console.log('[seed] AI provider config seeded for uniapi/default')
}

async function seedBacktestCapabilityConfig() {
  const capabilityConfig = resolveConfiguredBacktestCapabilityConfig(env)

  console.log('[seed] Ensuring backtest capability config...')

  interface BacktestCapabilityConfigDelegate {
    findFirst: (args: unknown) => Promise<{ id: string } | null>
    update: (args: unknown) => Promise<unknown>
    create: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    backtestCapabilityConfig?: BacktestCapabilityConfigDelegate
  }

  if (!client.backtestCapabilityConfig) {
    console.warn(
      '[seed] Prisma Client does not expose backtestCapabilityConfig. Skipping capability config seeding.',
    )
    return
  }

  const existing = await client.backtestCapabilityConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  if (existing) {
    await client.backtestCapabilityConfig.update({
      where: { id: existing.id },
      data: {
        allowedBaseTimeframes: capabilityConfig.allowedBaseTimeframes,
        isActive: true,
      },
    })
  } else {
    await client.backtestCapabilityConfig.create({
      data: {
        allowedBaseTimeframes: capabilityConfig.allowedBaseTimeframes,
        isActive: true,
      },
    })
  }

  console.log('[seed] Backtest capability config ensured')
}

async function seedOfficialStrategyPlazaSnapshots() {
  console.log('[seed] Ensuring official Strategy Plaza snapshots...')

  interface LlmStrategyCodegenSessionDelegate {
    upsert: (args: unknown) => Promise<unknown>
  }
  interface StrategyTemplateDelegate {
    upsert: (args: unknown) => Promise<{ id: string }>
  }
  interface StrategyInstanceDelegate {
    upsert: (args: unknown) => Promise<{ id: string }>
  }
  interface PublishedStrategySnapshotDelegate {
    upsert: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    llmStrategyCodegenSession?: LlmStrategyCodegenSessionDelegate
    strategyTemplate?: StrategyTemplateDelegate
    strategyInstance?: StrategyInstanceDelegate
    publishedStrategySnapshot?: PublishedStrategySnapshotDelegate
  }

  if (
    !client.llmStrategyCodegenSession
    || !client.strategyTemplate
    || !client.strategyInstance
    || !client.publishedStrategySnapshot
  ) {
    console.warn('[seed] Prisma Client is missing Strategy Plaza delegates. Skipping official snapshots.')
    return
  }

  for (const template of OFFICIAL_STRATEGY_PLAZA_TEMPLATES) {
    const sessionId = `official-strategy-plaza:${template.id}:seed-session`
    const templateName = `Strategy Plaza Official Source ${template.id}`
    const instanceName = `${template.name} 官方源模板`
    const content = buildOfficialStrategySnapshotContent(template)

    await client.llmStrategyCodegenSession.upsert({
      where: { id: sessionId },
      update: {
        status: 'PUBLISHED',
        latestDraftCode: content.scriptSnapshot,
        latestSpecDesc: content.specSnapshot,
        semanticGraph: content.semanticGraph,
        compiledIr: content.compiledIr,
      },
      create: {
        id: sessionId,
        userId: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        status: 'PUBLISHED',
        latestDraftCode: content.scriptSnapshot,
        latestSpecDesc: content.specSnapshot,
        semanticGraph: content.semanticGraph,
        compiledIr: content.compiledIr,
      },
    })

    const strategyTemplate = await client.strategyTemplate.upsert({
      where: { name: templateName },
      update: {
        description: template.description,
        script: content.scriptSnapshot,
        defaultParams: content.paramsSnapshot,
        rulesJson: content.specSnapshot,
        dataRequirements: content.dataRequirements,
        updatedBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        metadata: {
          source: 'strategy-plaza-official-template',
          officialTemplateId: template.id,
          officialSnapshotId: template.runConfig.publishedSnapshotId,
        },
      },
      create: {
        name: templateName,
        description: template.description,
        legs: [{
          id: 'primary',
          symbol: template.runConfig.symbol,
          role: 'primary',
          description: template.name,
        }],
        execution: { timeframe: template.runConfig.timeframe },
        dataRequirements: content.dataRequirements,
        llmModel: OFFICIAL_STRATEGY_PLAZA_LLM_MODEL,
        promptTemplate: 'OFFICIAL_STRATEGY_PLAZA_TEMPLATE',
        script: content.scriptSnapshot,
        paramsSchema: {},
        defaultParams: content.paramsSnapshot,
        rulesJson: content.specSnapshot,
        requiredFields: [],
        status: 'live',
        createdBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        updatedBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        metadata: {
          source: 'strategy-plaza-official-template',
          officialTemplateId: template.id,
          officialSnapshotId: template.runConfig.publishedSnapshotId,
        },
      },
    })

    const strategyInstance = await client.strategyInstance.upsert({
      where: {
        strategyTemplateId_llmModel_name: {
          strategyTemplateId: strategyTemplate.id,
          llmModel: OFFICIAL_STRATEGY_PLAZA_LLM_MODEL,
          name: instanceName,
        },
      },
      update: {
        description: template.description,
        params: content.paramsSnapshot,
        updatedBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        metadata: {
          source: 'strategy-plaza-official-template',
          officialTemplateId: template.id,
          officialSnapshotId: template.runConfig.publishedSnapshotId,
        },
      },
      create: {
        strategyTemplateId: strategyTemplate.id,
        name: instanceName,
        description: template.description,
        llmModel: OFFICIAL_STRATEGY_PLAZA_LLM_MODEL,
        params: content.paramsSnapshot,
        status: 'draft',
        mode: 'PAPER',
        createdBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        updatedBy: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        metadata: {
          source: 'strategy-plaza-official-template',
          officialTemplateId: template.id,
          officialSnapshotId: template.runConfig.publishedSnapshotId,
        },
      },
    })

    await client.publishedStrategySnapshot.upsert({
      where: { id: template.runConfig.publishedSnapshotId },
      update: {
        strategyTemplateId: strategyTemplate.id,
        strategyInstanceId: strategyInstance.id,
        ...content,
      },
      create: {
        id: template.runConfig.publishedSnapshotId,
        session: { connect: { id: sessionId } },
        strategyTemplateId: strategyTemplate.id,
        strategyInstanceId: strategyInstance.id,
        ...content,
      },
    })
  }

  console.log(`[seed] Official Strategy Plaza snapshots ensured: ${OFFICIAL_STRATEGY_PLAZA_TEMPLATES.length}`)
}

async function main() {
  console.log('Starting quantify seed...')

  await seedAiProviderKeys()
  await seedBacktestCapabilityConfig()
  await seedOfficialStrategyPlazaSnapshots()

  console.log('Quantify seed finished')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    // Prisma 7: close the underlying pg pool explicitly.
    await pool.end()
  })
  .catch(async (e) => {
    console.error('Quantify seed failed:', e)
    await prisma.$disconnect()
    // Prisma 7: close the underlying pg pool explicitly.
    await pool.end()
    process.exit(1)
  })
