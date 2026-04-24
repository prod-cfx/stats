import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, PublishedStrategySnapshot, Prisma } from '@/prisma/prisma.types'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { createHash } from 'node:crypto'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { StrategyPlazaOfficialSnapshotUnavailableException } from '../exceptions'
import {
  buildOfficialTemplateBacktestConfigDefaults,
  buildOfficialTemplateDataRequirements,
  buildOfficialTemplateDeploymentExecutionConstraints,
  buildOfficialTemplateDeploymentExecutionDefaults,
  buildOfficialTemplateParamsSnapshot,
  buildOfficialTemplateStrategyConfig,
} from '../utils/official-strategy-plaza-snapshot-content'

const LLM_MODEL = 'official-strategy-plaza'

type TemplateRuntimeContent = Pick<
  Prisma.PublishedStrategySnapshotCreateInput,
  | 'paramsSnapshot'
  | 'strategyConfig'
  | 'backtestConfigDefaults'
  | 'deploymentExecutionDefaults'
  | 'deploymentExecutionConstraints'
  | 'dataRequirements'
  | 'lockedParams'
>

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
      await this.updateSnapshotTemplateRuntimeContent(existing.id, input.template)
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
        defaultParams: buildOfficialTemplateParamsSnapshot(input.template) as Prisma.InputJsonValue,
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
        dataRequirements: buildOfficialTemplateDataRequirements(input.template) as Prisma.InputJsonValue,
        llmModel: LLM_MODEL,
        promptTemplate: 'OFFICIAL_STRATEGY_PLAZA_TEMPLATE',
        script: sourceSnapshot.scriptSnapshot,
        paramsSchema: {} as Prisma.InputJsonValue,
        defaultParams: buildOfficialTemplateParamsSnapshot(input.template) as Prisma.InputJsonValue,
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
        params: buildOfficialTemplateParamsSnapshot(input.template) as Prisma.InputJsonValue,
        updatedBy: input.userId,
        metadata: this.buildOfficialMetadata(input.template, sourceSnapshot) as Prisma.InputJsonValue,
      },
      create: {
        strategyTemplateId: strategyTemplate.id,
        name: this.buildStrategyInstanceName(input.template),
        description: input.template.description,
        llmModel: LLM_MODEL,
        params: buildOfficialTemplateParamsSnapshot(input.template) as Prisma.InputJsonValue,
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

    const copiedSnapshotId = this.buildCopiedSnapshotId(sessionId, sourceSnapshot)
    const snapshot = await client.publishedStrategySnapshot.upsert({
      where: { id: copiedSnapshotId },
      update: {
        strategyInstanceId: strategyInstance.id,
        strategyTemplateId: strategyTemplate.id,
        ...this.copySnapshotContent(sourceSnapshot, input.template),
      },
      create: {
        id: copiedSnapshotId,
        session: { connect: { id: sessionId } },
        strategyTemplateId: strategyTemplate.id,
        strategyInstanceId: strategyInstance.id,
        ...this.copySnapshotContent(sourceSnapshot, input.template),
      },
      select: { id: true, snapshotHash: true },
    })

    await this.bindStrategyInstanceToSnapshot(strategyInstance.id, input.template, sourceSnapshot, snapshot)

    return { id: snapshot.id }
  }

  private async updateSnapshotTemplateRuntimeContent(
    snapshotId: string,
    template: OfficialStrategyPlazaTemplate,
  ): Promise<void> {
    await this.txHost.tx.publishedStrategySnapshot.update({
      where: { id: snapshotId },
      data: this.buildTemplateRuntimeContent(template),
    })
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

  private buildCopiedSnapshotId(sessionId: string, sourceSnapshot: PublishedStrategySnapshot): string {
    return `plaza_${sha256(`${sessionId}:${this.buildSourceFingerprint(sourceSnapshot)}`).slice(0, 32)}`
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

  private buildTemplateRuntimeContent(template: OfficialStrategyPlazaTemplate): TemplateRuntimeContent {
    return {
      paramsSnapshot: buildOfficialTemplateParamsSnapshot(template) as Prisma.InputJsonValue,
      strategyConfig: buildOfficialTemplateStrategyConfig(template) as Prisma.InputJsonValue,
      backtestConfigDefaults: buildOfficialTemplateBacktestConfigDefaults(template) as Prisma.InputJsonValue,
      deploymentExecutionDefaults: buildOfficialTemplateDeploymentExecutionDefaults(template) as Prisma.InputJsonValue,
      deploymentExecutionConstraints: buildOfficialTemplateDeploymentExecutionConstraints(template) as Prisma.InputJsonValue,
      dataRequirements: buildOfficialTemplateDataRequirements(template) as Prisma.InputJsonValue,
      lockedParams: buildOfficialTemplateParamsSnapshot(template) as Prisma.InputJsonValue,
    }
  }

  private copySnapshotContent(
    sourceSnapshot: PublishedStrategySnapshot,
    template: OfficialStrategyPlazaTemplate,
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
      ...this.buildTemplateRuntimeContent(template),
      executionEnvelope: sourceSnapshot.executionEnvelope as Prisma.InputJsonValue | null | undefined,
      executionPolicy: sourceSnapshot.executionPolicy as Prisma.InputJsonValue | null | undefined,
      userIntentSummary: sourceSnapshot.userIntentSummary as Prisma.InputJsonValue,
      strategySummary: sourceSnapshot.strategySummary as Prisma.InputJsonValue,
      scriptSummary: sourceSnapshot.scriptSummary as Prisma.InputJsonValue,
      snapshotVersion: sourceSnapshot.snapshotVersion,
    }
  }
}
