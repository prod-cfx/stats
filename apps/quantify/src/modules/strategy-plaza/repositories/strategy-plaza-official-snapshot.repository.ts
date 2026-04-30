import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, PublishedStrategySnapshot, Prisma } from '@/prisma/prisma.types'
import type { OfficialStrategyPlazaTemplate } from '../types/official-strategy-plaza-template'
import { createHash } from 'node:crypto'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger } from '@nestjs/common'
import {
  buildOfficialTemplateBacktestConfigDefaults,
  buildOfficialTemplateDataRequirements,
  buildOfficialTemplateDeploymentExecutionConstraints,
  buildOfficialTemplateDeploymentExecutionDefaults,
  buildOfficialTemplateParamsSnapshot,
  buildOfficialTemplateStrategyConfig,
} from '../utils/official-strategy-plaza-snapshot-content'
import {
  buildOfficialStrategySnapshotContent,
  OFFICIAL_STRATEGY_PLAZA_USER_ID,
} from '../utils/official-strategy-plaza-snapshot-builder'

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
  private readonly logger = new Logger(StrategyPlazaOfficialSnapshotRepository.name)

  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async resolveOfficialSnapshotForUser(input: {
    userId: string
    template: OfficialStrategyPlazaTemplate
  }): Promise<Pick<PublishedStrategySnapshot, 'id'>> {
    const client = this.txHost.tx
    const sourceSnapshot = await this.resolveOrCreateOfficialSourceSnapshot(input.template)
    const sessionId = this.buildSessionId(input.userId, input.template.id, sourceSnapshot)
    const existing = await this.findCurrentUserSnapshot(input.userId, sessionId, sourceSnapshot)
    if (existing) {
      await this.synchronizeOfficialRuntimeBindings(existing.strategyInstanceId, input.template, sourceSnapshot, existing)
      return { id: existing.id }
    }
    const legacy = await this.findLegacyUserSnapshot(input.userId, input.template)
    if (legacy) {
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
          strategyInstanceId: legacy.strategyInstanceId,
        },
      })
      const copiedSnapshotId = this.buildCopiedSnapshotId(sessionId, sourceSnapshot)
      const snapshot = await client.publishedStrategySnapshot.upsert({
        where: { id: copiedSnapshotId },
        update: {
          strategyInstanceId: legacy.strategyInstanceId,
          strategyTemplateId: legacy.strategyTemplateId,
          ...this.copySnapshotContent(sourceSnapshot, input.template),
        },
        create: {
          id: copiedSnapshotId,
          session: { connect: { id: sessionId } },
          strategyTemplateId: legacy.strategyTemplateId,
          strategyInstanceId: legacy.strategyInstanceId,
          ...this.copySnapshotContent(sourceSnapshot, input.template),
        },
        select: { id: true, snapshotHash: true },
      })
      await this.synchronizeOfficialRuntimeBindings(legacy.strategyInstanceId, input.template, sourceSnapshot, snapshot)
      return { id: snapshot.id }
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

    await this.synchronizeOfficialRuntimeBindings(strategyInstance.id, input.template, sourceSnapshot, snapshot)

    return { id: snapshot.id }
  }

  private async resolveOrCreateOfficialSourceSnapshot(
    template: OfficialStrategyPlazaTemplate,
  ): Promise<PublishedStrategySnapshot> {
    const client = this.txHost.tx
    const content = this.buildOfficialSourceSnapshotContent(template)
    const existingSourceSnapshot = await client.publishedStrategySnapshot.findUnique({
      where: { id: template.runConfig.publishedSnapshotId },
    })
    if (existingSourceSnapshot && this.isCurrentOfficialSourceSnapshot(existingSourceSnapshot, content)) {
      return existingSourceSnapshot
    }

    const sessionId = `official-strategy-plaza:${template.id}:seed-session`
    await client.llmStrategyCodegenSession.upsert({
      where: { id: sessionId },
      update: {
        status: 'PUBLISHED',
        latestDraftCode: content.scriptSnapshot,
        latestSpecDesc: content.specSnapshot as Prisma.InputJsonValue,
        semanticGraph: content.semanticGraph as Prisma.InputJsonValue,
        compiledIr: content.compiledIr as Prisma.InputJsonValue,
      },
      create: {
        id: sessionId,
        userId: OFFICIAL_STRATEGY_PLAZA_USER_ID,
        status: 'PUBLISHED',
        latestDraftCode: content.scriptSnapshot,
        latestSpecDesc: content.specSnapshot as Prisma.InputJsonValue,
        semanticGraph: content.semanticGraph as Prisma.InputJsonValue,
        compiledIr: content.compiledIr as Prisma.InputJsonValue,
      },
    })

    return client.publishedStrategySnapshot.upsert({
      where: { id: template.runConfig.publishedSnapshotId },
      update: content,
      create: {
        id: template.runConfig.publishedSnapshotId,
        session: { connect: { id: sessionId } },
        ...content,
      },
    })
  }

  private isCurrentOfficialSourceSnapshot(
    snapshot: Pick<PublishedStrategySnapshot, 'scriptHash' | 'scriptSnapshot' | 'snapshotHash' | 'snapshotVersion'>,
    expected: Pick<Prisma.PublishedStrategySnapshotCreateInput, 'scriptHash' | 'snapshotHash' | 'snapshotVersion'>,
  ): boolean {
    return snapshot.snapshotVersion === expected.snapshotVersion
      && snapshot.snapshotHash === expected.snapshotHash
      && snapshot.scriptHash === expected.scriptHash
      && typeof snapshot.scriptSnapshot === 'string'
      && snapshot.scriptSnapshot.includes('protocolVersion: "v1"')
      && !snapshot.scriptSnapshot.includes('action: "HOLD"')
      && !snapshot.scriptSnapshot.includes("action: 'HOLD'")
  }

  private async findCurrentUserSnapshot(
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

  private async findLegacyUserSnapshot(
    userId: string,
    template: OfficialStrategyPlazaTemplate,
  ): Promise<Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash' | 'strategyInstanceId' | 'strategyTemplateId'> | null> {
    return this.txHost.tx.publishedStrategySnapshot.findFirst({
      where: {
        executionEnvelope: { path: ['source'], equals: 'strategy-plaza-official-template' },
        userIntentSummary: { path: ['templateId'], equals: template.id },
        strategyInstanceId: { not: null },
        strategyTemplateId: { not: null },
        session: { userId },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, snapshotHash: true, strategyInstanceId: true, strategyTemplateId: true },
    }) as Promise<Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash' | 'strategyInstanceId' | 'strategyTemplateId'> | null>
  }

  private async synchronizeOfficialRuntimeBindings(
    strategyInstanceId: string | null,
    template: OfficialStrategyPlazaTemplate,
    sourceSnapshot: PublishedStrategySnapshot,
    snapshot: Pick<PublishedStrategySnapshot, 'id' | 'snapshotHash'>,
  ): Promise<void> {
    if (!strategyInstanceId) return
    const client = this.txHost.tx
    const instance = await client.strategyInstance.findUnique({
      where: { id: strategyInstanceId },
      select: {
        id: true,
        strategyTemplateId: true,
        params: true,
        deploymentExecutionConfig: true,
        executionConfigVersion: true,
        metadata: true,
      },
    })

    if (!instance) {
      this.logger.error(
        `[StrategyPlazaOfficialSnapshotRepository.synchronizeOfficialRuntimeBindings] missing strategy instance; input=${JSON.stringify({ strategyInstanceId, templateId: template.id, snapshotId: snapshot.id })}; reason=strategy instance referenced by official snapshot does not exist`,
      )
      throw new Error(
        `[StrategyPlazaOfficialSnapshotRepository.synchronizeOfficialRuntimeBindings] missing strategy instance; input=${JSON.stringify({ strategyInstanceId, templateId: template.id, snapshotId: snapshot.id })}; reason=strategy instance referenced by official snapshot does not exist`,
      )
    }

    const deploymentExecutionConfig = this.mergeDeploymentExecutionConfig(
      instance.deploymentExecutionConfig,
      template.runConfig.deploymentExecutionConfig,
    )
    const executionConfigVersion = this.resolveExecutionConfigVersion(instance.executionConfigVersion)
    const params = {
      ...this.asRecord(instance.params),
      deploymentExecutionConfig,
      executionConfigVersion,
    }
    const metadata = {
      ...this.asRecord(instance.metadata),
      ...this.buildOfficialMetadata(template, sourceSnapshot),
      bindingSource: 'PUBLISHED_SNAPSHOT',
      publishedSnapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
    }

    await client.strategyTemplate.update({
      where: { id: instance.strategyTemplateId },
      data: {
        defaultParams: buildOfficialTemplateParamsSnapshot(template) as Prisma.InputJsonValue,
        rulesJson: sourceSnapshot.specSnapshot as Prisma.InputJsonValue,
        metadata: this.buildOfficialMetadata(template, sourceSnapshot) as Prisma.InputJsonValue,
      },
    })

    await client.strategyInstance.update({
      where: { id: strategyInstanceId },
      data: {
        params: params as Prisma.InputJsonValue,
        deploymentExecutionConfig: deploymentExecutionConfig as Prisma.InputJsonValue,
        executionConfigVersion,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })

    const subscriptions = await client.userStrategySubscription.findMany({
      where: { strategyInstanceId },
      select: { id: true, customParams: true },
    })
    for (const subscription of subscriptions) {
      const customParams = this.asRecord(subscription.customParams)
      await client.userStrategySubscription.update({
        where: { id: subscription.id },
        data: {
          customParams: {
            ...customParams,
            deploymentExecutionConfig: this.mergeDeploymentExecutionConfig(
              customParams.deploymentExecutionConfig,
              template.runConfig.deploymentExecutionConfig,
            ),
            executionConfigVersion,
          } as Prisma.InputJsonValue,
        },
      })
    }

    await client.strategyRuntimeExecutionState.updateMany({
      where: {
        strategyInstanceId,
        publishedSnapshotId: snapshot.id,
        snapshotHash: { not: snapshot.snapshotHash },
      },
      data: { snapshotHash: snapshot.snapshotHash },
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
    return sha256(`${sourceSnapshot.id}:${sourceSnapshot.snapshotHash}:${sourceSnapshot.scriptHash}:${sourceSnapshot.snapshotVersion}`)
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

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {}
  }

  private resolveExecutionConfigVersion(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1
  }

  private mergeDeploymentExecutionConfig(
    current: unknown,
    officialConfig: OfficialStrategyPlazaTemplate['runConfig']['deploymentExecutionConfig'],
  ): Record<string, unknown> {
    return {
      ...officialConfig,
      ...this.asRecord(current),
      ...('tdMode' in officialConfig ? { tdMode: officialConfig.tdMode } : {}),
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

  private buildOfficialSourceSnapshotContent(
    template: OfficialStrategyPlazaTemplate,
  ): Omit<Prisma.PublishedStrategySnapshotCreateInput, 'id' | 'session'> {
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
