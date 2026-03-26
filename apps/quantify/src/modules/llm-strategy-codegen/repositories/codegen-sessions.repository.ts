import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategyCodegenSession, LlmStrategyCodeVersion, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'

@Injectable()
export class CodegenSessionsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async createSession(data: Prisma.LlmStrategyCodegenSessionCreateInput): Promise<LlmStrategyCodegenSession> {
    return this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.create({ data }))
  }

  async findById(id: string): Promise<LlmStrategyCodegenSession | null> {
    return this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.findUnique({ where: { id } }))
  }

  async findSessionStrategyInstanceId(id: string): Promise<string | null> {
    const row = await this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.findUnique({
      where: { id },
      select: { strategyInstanceId: true },
    }))
    return row?.strategyInstanceId ?? null
  }

  async updateSession(id: string, data: Prisma.LlmStrategyCodegenSessionUpdateInput): Promise<LlmStrategyCodegenSession> {
    return this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.update({
      where: { id },
      data,
    }))
  }

  async tryMarkGenerating(
    id: string,
    data: Prisma.LlmStrategyCodegenSessionUpdateInput,
  ): Promise<boolean> {
    const result = await this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id,
        status: { in: ['DRAFTING', 'CHECKLIST_GATE'] },
      },
      data,
    }))
    return result.count === 1
  }

  async tryRequeueFromProcessing(
    id: string,
    data: Prisma.LlmStrategyCodegenSessionUpdateInput,
  ): Promise<boolean> {
    const result = await this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id,
        status: { in: ['VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT'] },
      },
      data,
    }))
    return result.count === 1
  }

  async bindStrategyInstanceIfEmpty(sessionId: string, strategyInstanceId: string): Promise<boolean> {
    const result = await this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id: sessionId,
        strategyInstanceId: null,
      },
      data: { strategyInstanceId },
    }))
    return result.count === 1
  }

  async createVersion(data: Prisma.LlmStrategyCodeVersionCreateInput): Promise<LlmStrategyCodeVersion> {
    return this.txHost.withTransaction(async () => this.txHost.tx.llmStrategyCodeVersion.create({ data }))
  }

  async createDraftStrategyInstanceFromPublishedSession(input: {
    userId: string
    sessionId: string
    name: string
    description: string
    llmModel: string
    scriptCode: string
    specDesc: Record<string, unknown>
    params: Record<string, unknown>
    metadata?: Record<string, unknown>
  }): Promise<{ strategyTemplateId: string, strategyInstanceId: string }> {
    return this.txHost.withTransaction(async () => this.createDraftStrategyInstanceFromPublishedSessionWithTx(this.txHost.tx, input))
  }

  async ensureDraftStrategyInstanceBoundForPublishedSession(input: {
    userId: string
    sessionId: string
    name: string
    description: string
    llmModel: string
    scriptCode: string
    specDesc: Record<string, unknown>
    params: Record<string, unknown>
    metadata?: Record<string, unknown>
  }): Promise<{ strategyInstanceId: string }> {
    return this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.sessionId}))`

      const existing = await tx.llmStrategyCodegenSession.findUnique({
        where: { id: input.sessionId },
        select: { strategyInstanceId: true },
      })
      if (existing?.strategyInstanceId) {
        return { strategyInstanceId: existing.strategyInstanceId }
      }

      const created = await this.createDraftStrategyInstanceFromPublishedSessionWithTx(tx, input)
      await tx.llmStrategyCodegenSession.update({
        where: { id: input.sessionId },
        data: { strategyInstanceId: created.strategyInstanceId },
      })
      return { strategyInstanceId: created.strategyInstanceId }
    })
  }

  private resolveExecutionTimeframe(params: Record<string, unknown>): string {
    const timeframe = typeof params.timeframe === 'string' ? params.timeframe.trim() : ''
    return timeframe || '5m'
  }

  private resolveExecutionSymbol(params: Record<string, unknown>): string {
    const rawSymbol = typeof params.symbol === 'string' ? params.symbol.trim().toUpperCase() : 'BTCUSDT'
    const marketType = typeof params.marketType === 'string' ? params.marketType.trim().toLowerCase() : 'spot'
    return toSymbolCode(rawSymbol, marketType === 'perp' ? 'PERP' : 'SPOT')
  }

  private async createDraftStrategyInstanceFromPublishedSessionWithTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string
      sessionId: string
      name: string
      description: string
      llmModel: string
      scriptCode: string
      specDesc: Record<string, unknown>
      params: Record<string, unknown>
      metadata?: Record<string, unknown>
    },
  ): Promise<{ strategyTemplateId: string, strategyInstanceId: string }> {
    const executionTimeframe = this.resolveExecutionTimeframe(input.params)
    const executionSymbol = this.resolveExecutionSymbol(input.params)
    const templateName = `${input.name}-${input.sessionId}`
    const strategyTemplate = await tx.strategyTemplate.create({
      data: {
        name: templateName,
        description: input.description,
        legs: [{
          id: 'primary',
          symbol: executionSymbol,
          role: 'primary',
          description: 'AI codegen primary leg',
        }] as Prisma.InputJsonValue,
        execution: {
          timeframe: executionTimeframe,
          cooldownMinutes: timeframeToMinutes(executionTimeframe as any),
        } as Prisma.InputJsonValue,
        dataRequirements: {
          primary: [executionTimeframe],
        } as Prisma.InputJsonValue,
        llmModel: input.llmModel,
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        script: input.scriptCode,
        paramsSchema: {},
        defaultParams: input.params as Prisma.InputJsonValue,
        rulesJson: input.specDesc as Prisma.InputJsonValue,
        requiredFields: [],
        status: 'live',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: {
          source: 'llm-codegen-session',
          codegenSessionId: input.sessionId,
          ...(input.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    const strategyInstance = await tx.strategyInstance.create({
      data: {
        strategyTemplateId: strategyTemplate.id,
        name: input.name,
        description: input.description,
        llmModel: input.llmModel,
        params: input.params as Prisma.InputJsonValue,
        status: 'draft',
        mode: 'PAPER',
        createdBy: input.userId,
        updatedBy: input.userId,
        metadata: {
          source: 'llm-codegen-session',
          codegenSessionId: input.sessionId,
          ...(input.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    return {
      strategyTemplateId: strategyTemplate.id,
      strategyInstanceId: strategyInstance.id,
    }
  }
}
