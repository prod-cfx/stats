import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategyCodegenSession, LlmStrategyCodeVersion, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'
import { toSymbolCode } from '@/modules/market-data/utils/market-symbol-code.util'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'
import {
  CODEGEN_CONFIRMABLE_SESSION_STATUSES,
  CODEGEN_REQUEUEABLE_SESSION_STATUSES,
} from '../types/codegen-session-status'

const SESSION_SELECT_BASE = {
  id: true,
  userId: true,
  status: true,
  checklist: true,
  semanticState: true,
  clarificationState: true,
  constraintPack: true,
  latestDraftCode: true,
  latestSpecDesc: true,
  graphSnapshot: true,
  semanticGraph: true,
  validationReport: true,
  compiledIr: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
} as const

const SESSION_SELECT_BASE_WITHOUT_CLARIFICATION = {
  id: true,
  userId: true,
  status: true,
  checklist: true,
  semanticState: true,
  constraintPack: true,
  latestDraftCode: true,
  latestSpecDesc: true,
  graphSnapshot: true,
  semanticGraph: true,
  validationReport: true,
  compiledIr: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
} as const

const SESSION_SELECT_WITH_STRATEGY = {
  ...SESSION_SELECT_BASE,
  strategyInstanceId: true,
} as const

const SESSION_SELECT_WITH_STRATEGY_WITHOUT_CLARIFICATION = {
  ...SESSION_SELECT_BASE_WITHOUT_CLARIFICATION,
  strategyInstanceId: true,
} as const

const MAX_TRANSACTION_START_RETRIES = 3

@Injectable()
export class CodegenSessionsRepository {
  private strategyInstanceColumnMissing = false
  private clarificationStateColumnMissing = false

  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async createSession(data: Prisma.LlmStrategyCodegenSessionCreateInput): Promise<LlmStrategyCodegenSession> {
    try {
      const row = await this.txHost.tx.llmStrategyCodegenSession.create({
        data: this.omitUnavailableSessionFields(data),
        select: this.resolveSessionSelect(),
      })
      return this.toSessionWithNullableOptionalColumns(row)
    } catch (error) {
      if (!this.markMissingOptionalSessionColumn(error)) throw error
      return this.createSession(data)
    }
  }

  async findById(id: string): Promise<LlmStrategyCodegenSession | null> {
    try {
      const row = await this.txHost.tx.llmStrategyCodegenSession.findUnique({
        where: { id },
        select: this.resolveSessionSelect(),
      })
      return row ? this.toSessionWithNullableOptionalColumns(row) : null
    } catch (error) {
      if (!this.markMissingOptionalSessionColumn(error)) throw error
      return this.findById(id)
    }
  }

  async listByUser(userId: string): Promise<LlmStrategyCodegenSession[]> {
    try {
      const rows = await this.txHost.tx.llmStrategyCodegenSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: this.resolveSessionSelect(),
      })
      return rows.map(row => this.toSessionWithNullableOptionalColumns(row))
    } catch (error) {
      if (!this.markMissingOptionalSessionColumn(error)) throw error
      return this.listByUser(userId)
    }
  }

  async findSessionStrategyInstanceId(id: string): Promise<string | null> {
    if (this.strategyInstanceColumnMissing) return null
    const row = await this.txHost.tx.llmStrategyCodegenSession.findUnique({
      where: { id },
      select: { strategyInstanceId: true },
    }).catch(error => {
      if (this.isMissingStrategyInstanceColumnError(error)) {
        this.strategyInstanceColumnMissing = true
        return null
      }
      throw error
    })
    return row?.strategyInstanceId ?? null
  }

  async updateSession(id: string, data: Prisma.LlmStrategyCodegenSessionUpdateInput): Promise<LlmStrategyCodegenSession> {
    try {
      const row = await this.txHost.tx.llmStrategyCodegenSession.update({
        where: { id },
        data: this.omitUnavailableSessionFields(data),
        select: this.resolveSessionSelect(),
      })
      return this.toSessionWithNullableOptionalColumns(row)
    } catch (error) {
      if (!this.markMissingOptionalSessionColumn(error)) throw error
      return this.updateSession(id, data)
    }
  }

  async tryMarkGenerating(
    id: string,
    data: Prisma.LlmStrategyCodegenSessionUpdateInput,
  ): Promise<boolean> {
    const result = await this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id,
        status: { in: [...CODEGEN_CONFIRMABLE_SESSION_STATUSES] },
      },
      data,
    })
    return result.count === 1
  }

  async tryRequeueFromProcessing(
    id: string,
    data: Prisma.LlmStrategyCodegenSessionUpdateInput,
  ): Promise<boolean> {
    const result = await this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id,
        status: { in: [...CODEGEN_REQUEUEABLE_SESSION_STATUSES] },
      },
      data,
    })
    return result.count === 1
  }

  async bindStrategyInstanceIfEmpty(sessionId: string, strategyInstanceId: string): Promise<boolean> {
    if (this.strategyInstanceColumnMissing) return false
    const result = await this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id: sessionId,
        strategyInstanceId: null,
      },
      data: { strategyInstanceId },
    }).catch(error => {
      if (this.isMissingStrategyInstanceColumnError(error)) {
        this.strategyInstanceColumnMissing = true
        return { count: 0 }
      }
      throw error
    })
    return result.count === 1
  }

  async createVersion(data: Prisma.LlmStrategyCodeVersionCreateInput): Promise<LlmStrategyCodeVersion> {
    return this.txHost.tx.llmStrategyCodeVersion.create({ data })
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
    return this.runWithTransactionStartRetry(
      async () => this.txHost.withTransaction(async () => this.createDraftStrategyInstanceFromPublishedSessionWithTx(this.txHost.tx, input)),
    )
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
  }): Promise<{ strategyTemplateId: string, strategyInstanceId: string }> {
    if (this.strategyInstanceColumnMissing) {
      return this.createDraftStrategyInstanceFromPublishedSession(input)
    }

    return this.runWithTransactionStartRetry(async () => {
      return this.txHost.withTransaction(async () => {
        const tx = this.txHost.tx
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.sessionId}))`

        const existing = await tx.llmStrategyCodegenSession.findUnique({
          where: { id: input.sessionId },
          select: { strategyInstanceId: true },
        })
        if (existing?.strategyInstanceId) {
          return {
            strategyTemplateId: '',
            strategyInstanceId: existing.strategyInstanceId,
          }
        }

        const created = await this.createDraftStrategyInstanceFromPublishedSessionWithTx(tx, input)
        await tx.llmStrategyCodegenSession.update({
          where: { id: input.sessionId },
          data: { strategyInstanceId: created.strategyInstanceId },
        })
        return created
      }).catch(async error => {
        if (!this.isMissingStrategyInstanceColumnError(error)) throw error
        this.strategyInstanceColumnMissing = true
        return this.createDraftStrategyInstanceFromPublishedSession(input)
      })
    })
  }

  private async runWithTransactionStartRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_TRANSACTION_START_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (!this.isTransactionStartTimeoutError(error) || attempt >= MAX_TRANSACTION_START_RETRIES) {
          throw error
        }
      }
    }

    throw lastError
  }

  private resolveSessionSelect() {
    if (this.strategyInstanceColumnMissing) {
      return this.clarificationStateColumnMissing
        ? SESSION_SELECT_BASE_WITHOUT_CLARIFICATION
        : SESSION_SELECT_BASE
    }
    return this.clarificationStateColumnMissing
      ? SESSION_SELECT_WITH_STRATEGY_WITHOUT_CLARIFICATION
      : SESSION_SELECT_WITH_STRATEGY
  }

  private omitUnavailableSessionFields<T extends Record<string, unknown>>(input: T): T {
    let output: Record<string, unknown> = input
    if (this.strategyInstanceColumnMissing) {
      output = this.omitField(output, 'strategyInstanceId')
    }
    if (this.clarificationStateColumnMissing) {
      output = this.omitField(output, 'clarificationState')
    }
    return output as T
  }

  private omitField<T extends Record<string, unknown>>(input: T, field: string): T {
    if (!(field in input)) return input
    const { [field]: _ignored, ...rest } = input
    return rest as T
  }

  private toSessionWithNullableOptionalColumns(
    session: Omit<LlmStrategyCodegenSession, 'strategyInstanceId' | 'semanticState' | 'clarificationState'> & {
      strategyInstanceId?: string | null
      semanticState?: Prisma.JsonValue | null
      clarificationState?: Prisma.JsonValue | null
    },
  ): LlmStrategyCodegenSession {
    return {
      ...session,
      strategyInstanceId: session.strategyInstanceId ?? null,
      semanticState: session.semanticState ?? null,
      clarificationState: session.clarificationState ?? null,
    } as LlmStrategyCodegenSession
  }

  private isMissingStrategyInstanceColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined
    const meta = 'meta' in error ? (error as { meta?: unknown }).meta : undefined

    if (code !== 'P2022') return false

    if (typeof message === 'string' && message.includes('strategy_instance_id')) {
      return true
    }

    if (meta && typeof meta === 'object') {
      const column = (meta as { column?: unknown }).column
      if (typeof column === 'string' && column.includes('strategy_instance_id')) {
        return true
      }
    }

    return false
  }

  private isMissingClarificationStateColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined
    const message = 'message' in error ? (error as { message?: unknown }).message : undefined
    const meta = 'meta' in error ? (error as { meta?: unknown }).meta : undefined

    if (code !== 'P2022') return false

    if (typeof message === 'string' && message.includes('clarification_state')) {
      return true
    }

    if (meta && typeof meta === 'object') {
      const column = (meta as { column?: unknown }).column
      if (typeof column === 'string' && column.includes('clarification_state')) {
        return true
      }
    }

    return false
  }

  private markMissingOptionalSessionColumn(error: unknown): boolean {
    let changed = false
    if (this.isMissingStrategyInstanceColumnError(error) && !this.strategyInstanceColumnMissing) {
      this.strategyInstanceColumnMissing = true
      changed = true
    }
    if (this.isMissingClarificationStateColumnError(error) && !this.clarificationStateColumnMissing) {
      this.clarificationStateColumnMissing = true
      changed = true
    }
    return changed
  }

  private isTransactionStartTimeoutError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false

    const code = 'code' in error ? (error as { code?: unknown }).code : undefined
    if (code === 'P2034') {
      return true
    }

    const message = 'message' in error ? (error as { message?: unknown }).message : undefined
    return typeof message === 'string' && message.includes('Unable to start a transaction in the given time')
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

  private buildParamsSchema(params: Record<string, unknown>): Prisma.InputJsonValue {
    const properties = Object.fromEntries(
      Object.entries(params).map(([key, value]) => {
        const schemaType = Array.isArray(value)
          ? 'array'
          : typeof value === 'number'
            ? 'number'
            : typeof value === 'boolean'
              ? 'boolean'
              : 'string'
        return [key, { type: schemaType, title: key }]
      }),
    )

    return {
      type: 'object',
      properties,
      required: Object.keys(params),
      additionalProperties: true,
    } as Prisma.InputJsonValue
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
        paramsSchema: this.buildParamsSchema(input.params),
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
