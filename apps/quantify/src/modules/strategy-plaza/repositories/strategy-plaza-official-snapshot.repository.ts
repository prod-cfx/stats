import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, PublishedStrategySnapshot, Prisma } from '@/prisma/prisma.types'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { createHash } from 'node:crypto'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { StrategyPlazaOfficialSnapshotUnavailableException } from '../exceptions'

const LLM_MODEL = 'official-strategy-plaza'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

@Injectable()
export class StrategyPlazaOfficialSnapshotRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async resolveOfficialSnapshotForUser(input: {
    userId: string
    template: OfficialStrategyPlazaTemplate
  }): Promise<Pick<PublishedStrategySnapshot, 'id'>> {
    const client = this.txHost.tx
    const sourceSnapshot = await client.publishedStrategySnapshot.findUnique({
      where: { id: input.template.runConfig.publishedSnapshotId },
    })
    if (!sourceSnapshot) {
      throw new StrategyPlazaOfficialSnapshotUnavailableException({
        templateId: input.template.id,
        officialSnapshotId: input.template.runConfig.publishedSnapshotId,
      })
    }

    const sessionId = this.buildSessionId(input.userId, input.template.id, sourceSnapshot)
    const existing = await this.findExistingUserSnapshot(input.userId, sessionId, sourceSnapshot)
    if (existing) {
      await this.bindStrategyInstanceToSnapshot(existing.strategyInstanceId, input.template, sourceSnapshot, existing)
      return { id: existing.id }
    }

    await client.llmStrategyCodegenSession.upsert({
      where: { id: sessionId },
      update: {
        status: 'PUBLISHED',
        latestDraftCode: sourceSnapshot.scriptSnapshot,
        latestSpecDesc: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
      },
      create: {
        id: sessionId,
        userId: input.userId,
        status: 'PUBLISHED',
        latestDraftCode: sourceSnapshot.scriptSnapshot,
        latestSpecDesc: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
      },
    })

    const strategyTemplate = await client.strategyTemplate.upsert({
      where: { name: this.buildStrategyTemplateName(input.userId, input.template.id, sourceSnapshot) },
      update: {
        description: input.template.description,
        script: sourceSnapshot.scriptSnapshot,
        defaultParams: this.resolveParamsSnapshot(input.template, sourceSnapshot) as Prisma.InputJsonValue,
        rulesJson: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template, sourceSnapshot) as Prisma.InputJsonValue,
      },
      create: {
        name: this.buildStrategyTemplateName(input.userId, input.template.id, sourceSnapshot),
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
        dataRequirements: this.resolveDataRequirements(input.template, sourceSnapshot) as Prisma.InputJsonValue,
        llmModel: LLM_MODEL,
        promptTemplate: 'OFFICIAL_STRATEGY_PLAZA_TEMPLATE',
        script: sourceSnapshot.scriptSnapshot,
        paramsSchema: {} as Prisma.InputJsonValue,
        defaultParams: this.resolveParamsSnapshot(input.template, sourceSnapshot) as Prisma.InputJsonValue,
        rulesJson: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
        requiredFields: [],
        status: 'live',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template, sourceSnapshot) as Prisma.InputJsonValue,
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
        params: this.resolveParamsSnapshot(input.template, sourceSnapshot) as Prisma.InputJsonValue,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template, sourceSnapshot) as Prisma.InputJsonValue,
      },
      create: {
        strategyTemplateId: strategyTemplate.id,
        name: this.buildStrategyInstanceName(input.template),
        description: input.template.description,
        llmModel: LLM_MODEL,
        params: this.resolveParamsSnapshot(input.template, sourceSnapshot) as Prisma.InputJsonValue,
        status: 'draft',
        mode: 'PAPER',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template, sourceSnapshot) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    await client.llmStrategyCodegenSession.update({
      where: { id: sessionId },
      data: { strategyInstanceId: strategyInstance.id },
    })

    const concurrentExisting = await this.findExistingUserSnapshot(input.userId, sessionId, sourceSnapshot)
    if (concurrentExisting) {
      await this.bindStrategyInstanceToSnapshot(
        concurrentExisting.strategyInstanceId,
        input.template,
        sourceSnapshot,
        concurrentExisting,
      )
      return { id: concurrentExisting.id }
    }

    const snapshot = await client.publishedStrategySnapshot.create({
      data: {
        session: { connect: { id: sessionId } },
        strategyTemplateId: strategyTemplate.id,
        strategyInstanceId: strategyInstance.id,
        ...this.copySnapshotContent(sourceSnapshot),
      },
      select: { id: true, snapshotHash: true },
    })

    await this.bindStrategyInstanceToSnapshot(strategyInstance.id, input.template, sourceSnapshot, snapshot)

    return { id: snapshot.id }
  }

  private async findExistingUserSnapshot(
    userId: string,
    sessionId: string,
    sourceSnapshot: PublishedStrategySnapshot,
  ): Promise<Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash' | 'strategyInstanceId'> | null> {
    return this.txHost.tx.publishedStrategySnapshot.findFirst({
      where: {
        sessionId,
        snapshotHash: sourceSnapshot.snapshotHash,
        snapshotVersion: sourceSnapshot.snapshotVersion,
        strategyInstanceId: { not: null },
        session: { userId },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true },
    }) as Promise<Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash' | 'strategyInstanceId'> | null>
  }

  private async bindStrategyInstanceToSnapshot(
    strategyInstanceId: string | null,
    template: OfficialStrategyPlazaTemplate,
    sourceSnapshot: PublishedStrategySnapshot,
    snapshot: Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash'>,
  ): Promise<void> {
    if (!strategyInstanceId) return
    await this.txHost.tx.strategyInstance.update({
      where: { id: strategyInstanceId },
      data: {
        metadata: {
          ...this.buildOfficialMetadata(template, sourceSnapshot),
          bindingSource: 'PUBLISHED_SNAPSHOT',
          publishedSnapshotId: snapshot.id,
          snapshotHash: snapshot.snapshotHash,
        } as Prisma.InputJsonValue,
      },
    })
  }

  private buildSessionId(
    userId: string,
    templateId: string,
    sourceSnapshot: PublishedStrategySnapshot,
  ): string {
    return `strategy-plaza:official:${templateId}:user:${sha256(userId)}:source:${this.buildSourceFingerprint(sourceSnapshot)}`
  }

  private buildSourceFingerprint(sourceSnapshot: PublishedStrategySnapshot): string {
    return sha256(`${sourceSnapshot.id}:${sourceSnapshot.snapshotHash}:${sourceSnapshot.snapshotVersion}`)
  }

  private buildStrategyTemplateName(
    userId: string,
    templateId: string,
    sourceSnapshot: PublishedStrategySnapshot,
  ): string {
    return `Strategy Plaza Official ${templateId} ${sha256(userId)} ${this.buildSourceFingerprint(sourceSnapshot)}`
  }

  private buildStrategyInstanceName(template: OfficialStrategyPlazaTemplate): string {
    return `${template.name} 官方模板`
  }

  private buildOfficialMetadata(
    template: OfficialStrategyPlazaTemplate,
    sourceSnapshot: PublishedStrategySnapshot,
  ): Record<string, unknown> {
    return {
      source: 'strategy-plaza-official-template',
      officialTemplateId: template.id,
      officialSnapshotHash: sourceSnapshot.snapshotHash,
      officialSnapshotId: sourceSnapshot.id,
      officialSnapshotVersion: sourceSnapshot.snapshotVersion,
    }
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

  private resolveParamsSnapshot(
    template: OfficialStrategyPlazaTemplate,
    sourceSnapshot: PublishedStrategySnapshot,
  ): Record<string, unknown> {
    return this.readRecord(sourceSnapshot.paramsSnapshot) ?? this.buildParamsSnapshot(template)
  }

  private resolveDataRequirements(
    template: OfficialStrategyPlazaTemplate,
    sourceSnapshot: PublishedStrategySnapshot,
  ): Record<string, unknown> {
    return this.readRecord(sourceSnapshot.dataRequirements) ?? { primary: [template.runConfig.timeframe] }
  }

  private copySnapshotContent(
    sourceSnapshot: PublishedStrategySnapshot,
  ): Omit<Prisma.PublishedStrategySnapshotCreateInput, 'session' | 'strategyTemplateId' | 'strategyInstanceId'> {
    return {
      snapshotHash: sourceSnapshot.snapshotHash,
      scriptHash: sourceSnapshot.scriptHash,
      specHash: sourceSnapshot.specHash,
      irHash: sourceSnapshot.irHash,
      astDigest: sourceSnapshot.astDigest,
      structuralDigest: sourceSnapshot.structuralDigest,
      scriptSnapshot: sourceSnapshot.scriptSnapshot,
      specSnapshot: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
      semanticGraph: sourceSnapshot.semanticGraph as Prisma.InputJsonValue | null | undefined,
      compiledIr: sourceSnapshot.compiledIr as Prisma.InputJsonValue | null | undefined,
      irSnapshot: sourceSnapshot.irSnapshot as Prisma.InputJsonValue | null | undefined,
      astSnapshot: sourceSnapshot.astSnapshot as Prisma.InputJsonValue | null | undefined,
      compiledManifest: sourceSnapshot.compiledManifest as Prisma.InputJsonValue | null | undefined,
      consistencyReport: sourceSnapshot.consistencyReport as Prisma.InputJsonValue,
      paramsSnapshot: sourceSnapshot.paramsSnapshot as Prisma.InputJsonValue | null | undefined,
      strategyConfig: sourceSnapshot.strategyConfig as Prisma.InputJsonValue | null | undefined,
      backtestConfigDefaults: sourceSnapshot.backtestConfigDefaults as Prisma.InputJsonValue | null | undefined,
      deploymentExecutionDefaults: sourceSnapshot.deploymentExecutionDefaults as Prisma.InputJsonValue | null | undefined,
      deploymentExecutionConstraints: sourceSnapshot.deploymentExecutionConstraints as Prisma.InputJsonValue | null | undefined,
      executionEnvelope: sourceSnapshot.executionEnvelope as Prisma.InputJsonValue | null | undefined,
      executionPolicy: sourceSnapshot.executionPolicy as Prisma.InputJsonValue | null | undefined,
      dataRequirements: sourceSnapshot.dataRequirements as Prisma.InputJsonValue | null | undefined,
      userIntentSummary: sourceSnapshot.userIntentSummary as Prisma.InputJsonValue,
      strategySummary: sourceSnapshot.strategySummary as Prisma.InputJsonValue,
      scriptSummary: sourceSnapshot.scriptSummary as Prisma.InputJsonValue,
      lockedParams: sourceSnapshot.lockedParams as Prisma.InputJsonValue,
      snapshotVersion: sourceSnapshot.snapshotVersion,
    }
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null
  }
}
