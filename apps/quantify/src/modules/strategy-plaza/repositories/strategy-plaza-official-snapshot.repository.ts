import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, PublishedStrategySnapshot, Prisma } from '@/prisma/prisma.types'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { createHash } from 'node:crypto'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

const LLM_MODEL = 'official-strategy-plaza'
const SNAPSHOT_VERSION = 2

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => stableJsonStringify(item)).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(',')}}`
}

@Injectable()
export class StrategyPlazaOfficialSnapshotRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async resolveOfficialSnapshotForUser(input: {
    userId: string
    template: OfficialStrategyPlazaTemplate
  }): Promise<Pick<PublishedStrategySnapshot, 'id'>> {
    const client = this.txHost.tx
    const sessionId = this.buildSessionId(input.userId, input.template.id)

    const existing = await client.publishedStrategySnapshot.findFirst({
      where: {
        sessionId,
        strategyInstanceId: { not: null },
        session: { userId: input.userId },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true },
    })
    if (existing) {
      await client.strategyInstance.update({
        where: { id: existing.strategyInstanceId },
        data: {
          metadata: {
            ...this.buildOfficialMetadata(input.template),
            bindingSource: 'PUBLISHED_SNAPSHOT',
            publishedSnapshotId: existing.id,
            snapshotHash: existing.snapshotHash,
          } as Prisma.InputJsonValue,
        },
      })
      return { id: existing.id }
    }

    await client.llmStrategyCodegenSession.upsert({
      where: { id: sessionId },
      update: {
        status: 'PUBLISHED',
        latestSpecDesc: this.buildSpecSnapshot(input.template) as Prisma.InputJsonValue,
      },
      create: {
        id: sessionId,
        userId: input.userId,
        status: 'PUBLISHED',
        latestDraftCode: this.buildScriptSnapshot(input.template),
        latestSpecDesc: this.buildSpecSnapshot(input.template) as Prisma.InputJsonValue,
      },
    })

    const strategyTemplate = await client.strategyTemplate.upsert({
      where: { name: this.buildStrategyTemplateName(input.userId, input.template.id) },
      update: {
        description: input.template.description,
        script: this.buildScriptSnapshot(input.template),
        defaultParams: this.buildParamsSnapshot(input.template) as Prisma.InputJsonValue,
        rulesJson: this.buildSpecSnapshot(input.template) as Prisma.InputJsonValue,
        updatedBy: input.userId,
      },
      create: {
        name: this.buildStrategyTemplateName(input.userId, input.template.id),
        description: input.template.description,
        legs: [{
          id: 'primary',
          symbol: input.template.runConfig.symbol,
          role: 'primary',
          description: input.template.name,
        }] as Prisma.InputJsonValue,
        execution: {
          timeframe: input.template.runConfig.timeframe,
        } as Prisma.InputJsonValue,
        dataRequirements: {
          primary: [input.template.runConfig.timeframe],
        } as Prisma.InputJsonValue,
        llmModel: LLM_MODEL,
        promptTemplate: 'OFFICIAL_STRATEGY_PLAZA_TEMPLATE',
        script: this.buildScriptSnapshot(input.template),
        paramsSchema: {} as Prisma.InputJsonValue,
        defaultParams: this.buildParamsSnapshot(input.template) as Prisma.InputJsonValue,
        rulesJson: this.buildSpecSnapshot(input.template) as Prisma.InputJsonValue,
        requiredFields: [],
        status: 'live',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    const strategyInstance = await client.strategyInstance.upsert({
      where: {
        strategyTemplateId_llmModel_name: {
          strategyTemplateId: strategyTemplate.id,
          llmModel: LLM_MODEL,
          name: this.buildStrategyInstanceName(input.template),
        },
      },
      update: {
        params: this.buildParamsSnapshot(input.template) as Prisma.InputJsonValue,
        updatedBy: input.userId,
      },
      create: {
        strategyTemplateId: strategyTemplate.id,
        name: this.buildStrategyInstanceName(input.template),
        description: input.template.description,
        llmModel: LLM_MODEL,
        params: this.buildParamsSnapshot(input.template) as Prisma.InputJsonValue,
        status: 'draft',
        mode: 'PAPER',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    await client.llmStrategyCodegenSession.update({
      where: { id: sessionId },
      data: { strategyInstanceId: strategyInstance.id },
    })

    const snapshotInput = this.buildSnapshotInput(input.template, strategyTemplate.id, strategyInstance.id)
    const snapshot = await client.publishedStrategySnapshot.create({
      data: {
        session: { connect: { id: sessionId } },
        strategyTemplateId: strategyTemplate.id,
        strategyInstanceId: strategyInstance.id,
        ...snapshotInput,
      },
      select: { id: true, snapshotHash: true },
    })

    await client.strategyInstance.update({
      where: { id: strategyInstance.id },
      data: {
        metadata: {
          ...this.buildOfficialMetadata(input.template),
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: snapshot.id,
          snapshotHash: snapshot.snapshotHash,
        } as Prisma.InputJsonValue,
      },
    })

    return { id: snapshot.id }
  }

  private buildSessionId(userId: string, templateId: string): string {
    return `strategy-plaza:official:${templateId}:user:${userId}`
  }

  private buildStrategyTemplateName(userId: string, templateId: string): string {
    return `Strategy Plaza Official ${templateId} ${userId}`
  }

  private buildStrategyInstanceName(template: OfficialStrategyPlazaTemplate): string {
    return `${template.name} 官方模板`
  }

  private buildOfficialMetadata(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      source: 'strategy-plaza-official-template',
      officialTemplateId: template.id,
      officialSnapshotId: template.runConfig.publishedSnapshotId,
    }
  }

  private buildScriptSnapshot(template: OfficialStrategyPlazaTemplate): string {
    return `// Official Strategy Plaza template: ${template.id}\n`
  }

  private buildParamsSnapshot(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      exchange: template.runConfig.exchange,
      marketType: template.runConfig.marketType,
      symbol: template.runConfig.symbol,
      timeframe: template.runConfig.timeframe,
      positionPct: template.runConfig.positionPct,
      leverage: template.runConfig.leverage,
    }
  }

  private buildSpecSnapshot(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      source: 'strategy-plaza-official-template',
      templateId: template.id,
      name: template.name,
      runConfig: this.buildParamsSnapshot(template),
    }
  }

  private buildStrategyConfig(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      exchange: template.runConfig.exchange,
      marketType: template.runConfig.marketType,
      symbol: template.runConfig.symbol,
      baseTimeframe: template.runConfig.timeframe,
      timeframe: template.runConfig.timeframe,
      positionPct: template.runConfig.positionPct,
      strategyDeclaredLeverageRange: template.runConfig.marketType === 'perp'
        ? { min: 1, max: template.runConfig.leverage ?? 1 }
        : null,
    }
  }

  private buildDeploymentExecutionDefaults(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      ...template.runConfig.deploymentExecutionConfig,
      leverage: template.runConfig.deploymentExecutionConfig.leverage ?? 1,
    }
  }

  private buildDeploymentExecutionConstraints(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    const defaultLeverage = template.runConfig.leverage ?? 1
    return {
      platformRiskMaxLeverage: defaultLeverage,
      strategyDeclaredLeverageRange: template.runConfig.marketType === 'perp'
        ? { min: 1, max: defaultLeverage }
        : null,
      defaultLeverage,
      supportedPriceSources: [template.runConfig.deploymentExecutionConfig.priceSource],
      supportedOrderTypes: [template.runConfig.deploymentExecutionConfig.orderType],
      supportedTimeInForce: [template.runConfig.deploymentExecutionConfig.timeInForce],
      constraintExplanation: 'strategy plaza official template execution constraints',
    }
  }

  private buildAstSnapshot(template: OfficialStrategyPlazaTemplate): Record<string, unknown> {
    return {
      runtimeExecutionSemantics: [{
        semanticKey: `on_start.entry.${template.id}`,
        trigger: 'on_start',
        phase: 'entry',
        consumePolicy: 'once',
        requiredRuntimeContext: {
          barIndex: 1,
          requiresReferenceBar: true,
          requiresSymbol: true,
          requiresTimeframe: true,
        },
        sourceRefs: [`official-plaza-${template.id}`],
      }],
    }
  }

  private buildSnapshotInput(
    template: OfficialStrategyPlazaTemplate,
    strategyTemplateId: string,
    strategyInstanceId: string,
  ): Omit<Prisma.PublishedStrategySnapshotCreateInput, 'session' | 'strategyTemplateId' | 'strategyInstanceId'> {
    const scriptSnapshot = this.buildScriptSnapshot(template)
    const specSnapshot = this.buildSpecSnapshot(template)
    const astSnapshot = this.buildAstSnapshot(template)
    const strategyConfig = this.buildStrategyConfig(template)
    const deploymentExecutionDefaults = this.buildDeploymentExecutionDefaults(template)
    const deploymentExecutionConstraints = this.buildDeploymentExecutionConstraints(template)
    const paramsSnapshot = this.buildParamsSnapshot(template)
    const snapshotPayload = stableJsonStringify({
      astSnapshot,
      deploymentExecutionConstraints,
      deploymentExecutionDefaults,
      paramsSnapshot,
      scriptSnapshot,
      specSnapshot,
      strategyConfig,
      strategyInstanceId,
      strategyTemplateId,
    })

    return {
      snapshotHash: sha256(snapshotPayload),
      scriptHash: sha256(scriptSnapshot),
      specHash: `sha256:${sha256(stableJsonStringify(specSnapshot))}`,
      scriptSnapshot,
      specSnapshot: specSnapshot as Prisma.InputJsonValue,
      astSnapshot: astSnapshot as Prisma.InputJsonValue,
      consistencyReport: { status: 'PASSED', source: 'strategy-plaza-official-template' } as Prisma.InputJsonValue,
      userIntentSummary: { source: 'strategy-plaza-official-template', templateId: template.id } as Prisma.InputJsonValue,
      strategySummary: { name: template.name, description: template.description } as Prisma.InputJsonValue,
      scriptSummary: { source: 'strategy-plaza-official-template' } as Prisma.InputJsonValue,
      lockedParams: paramsSnapshot as Prisma.InputJsonValue,
      snapshotVersion: SNAPSHOT_VERSION,
      paramsSnapshot: paramsSnapshot as Prisma.InputJsonValue,
      strategyConfig: strategyConfig as Prisma.InputJsonValue,
      backtestConfigDefaults: {
        initialCash: 10000,
        leverage: template.runConfig.leverage ?? 1,
        priceSource: template.runConfig.deploymentExecutionConfig.priceSource,
      } as Prisma.InputJsonValue,
      deploymentExecutionDefaults: deploymentExecutionDefaults as Prisma.InputJsonValue,
      deploymentExecutionConstraints: deploymentExecutionConstraints as Prisma.InputJsonValue,
      executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' } as Prisma.InputJsonValue,
      dataRequirements: { primary: [template.runConfig.timeframe] } as Prisma.InputJsonValue,
    }
  }
}
