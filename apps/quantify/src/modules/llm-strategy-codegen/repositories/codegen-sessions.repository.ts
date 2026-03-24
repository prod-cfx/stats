import type { LlmStrategyCodegenSession, LlmStrategyCodeVersion, Prisma } from '@/prisma/prisma.types'

import { Injectable } from '@nestjs/common'
import { toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时导入
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class CodegenSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client() {
    return this.prisma.getClient()
  }

  async createSession(data: Prisma.LlmStrategyCodegenSessionCreateInput): Promise<LlmStrategyCodegenSession> {
    return this.client.llmStrategyCodegenSession.create({ data })
  }

  async findById(id: string): Promise<LlmStrategyCodegenSession | null> {
    return this.client.llmStrategyCodegenSession.findUnique({ where: { id } })
  }

  async updateSession(id: string, data: Prisma.LlmStrategyCodegenSessionUpdateInput): Promise<LlmStrategyCodegenSession> {
    return this.client.llmStrategyCodegenSession.update({
      where: { id },
      data,
    })
  }

  async createVersion(data: Prisma.LlmStrategyCodeVersionCreateInput): Promise<LlmStrategyCodeVersion> {
    return this.client.llmStrategyCodeVersion.create({ data })
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
    return this.prisma.runInTransaction(async (tx) => {
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
}
