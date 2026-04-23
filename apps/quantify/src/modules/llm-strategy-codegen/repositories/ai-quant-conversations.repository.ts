import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { Prisma, PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface AiQuantConversationMessageSnapshot {
  role: 'user' | 'assistant'
  content: string
}

export interface AiQuantConversationLastBacktestRefRecord {
  jobId: string
  publishedSnapshotId: string
  summary: {
    maxDrawdownPct: number
    totalReturnPct: number
    winRatePct: number
    tradeCount: number
    openTradeCount?: number
    openPnl?: number
    marketType?: 'spot' | 'perp'
  }
  completedAt: Date
}

export interface AiQuantConversationSnapshotRecord {
  id: string
  userId: string
  codegenSessionId: string
  title: string
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastBacktestRef: AiQuantConversationLastBacktestRefRecord | null
  messages: AiQuantConversationMessageSnapshot[]
}

@Injectable()
export class AiQuantConversationsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async upsertConversationSnapshot(input: {
    userId: string
    codegenSessionId: string
    title: string
    messages: AiQuantConversationMessageSnapshot[]
  }): Promise<AiQuantConversationSnapshotRecord> {
    return this.txHost.withTransaction(async () => {
      const conversation = await this.txHost.tx.aiQuantConversation.upsert({
        where: { codegenSessionId: input.codegenSessionId },
        create: {
          userId: input.userId,
          codegenSessionId: input.codegenSessionId,
          title: input.title,
        },
        update: {
          userId: input.userId,
          title: input.title,
        },
        select: { id: true },
      })

      await this.txHost.tx.aiQuantConversationMessage.deleteMany({
        where: { conversationId: conversation.id },
      })

      if (input.messages.length > 0) {
        await this.txHost.tx.aiQuantConversationMessage.createMany({
          data: input.messages.map((message, index) => ({
            conversationId: conversation.id,
            role: message.role,
            content: message.content,
            sortOrder: index,
          })),
        })
      }

      return this.getByIdOrThrow(conversation.id)
    })
  }

  async listByUser(userId: string): Promise<AiQuantConversationSnapshotRecord[]> {
    const conversations = await this.txHost.tx.aiQuantConversation.findMany({
      where: { userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        codegenSessionId: true,
        title: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        lastBacktestRef: true,
        messages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            role: true,
            content: true,
          },
        },
      },
    })

    return conversations.map(conversation => this.mapSnapshotRecord(conversation))
  }

  async listKnownSessionIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.txHost.tx.aiQuantConversation.findMany({
      where: { userId },
      select: { codegenSessionId: true },
    })

    return rows.map(row => row.codegenSessionId)
  }

  async findByCodegenSessionId(codegenSessionId: string): Promise<AiQuantConversationSnapshotRecord | null> {
    const conversation = await this.txHost.tx.aiQuantConversation.findUnique({
      where: { codegenSessionId },
      select: {
        id: true,
        userId: true,
        codegenSessionId: true,
        title: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        lastBacktestRef: true,
        messages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            role: true,
            content: true,
          },
        },
      },
    })

    if (!conversation) return null

    return this.mapSnapshotRecord(conversation)
  }

  async updateLastBacktestRef(input: {
    conversationId: string
    userId: string
    lastBacktestRef: AiQuantConversationLastBacktestRefRecord
  }): Promise<void> {
    await this.txHost.tx.aiQuantConversation.updateMany({
      where: {
        id: input.conversationId,
        userId: input.userId,
        archivedAt: null,
      },
      data: {
        lastBacktestRef: input.lastBacktestRef as unknown as Prisma.InputJsonValue,
      },
    })
  }

  async archiveByIdAndUser(id: string, userId: string): Promise<void> {
    await this.txHost.tx.aiQuantConversation.updateMany({
      where: { id, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    })
  }

  private async getByIdOrThrow(id: string): Promise<AiQuantConversationSnapshotRecord> {
    const conversation = await this.txHost.tx.aiQuantConversation.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        userId: true,
        codegenSessionId: true,
        title: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        lastBacktestRef: true,
        messages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            role: true,
            content: true,
          },
        },
      },
    })

    return this.mapSnapshotRecord(conversation)
  }

  private mapSnapshotRecord(conversation: {
    id: string
    userId: string
    codegenSessionId: string
    title: string
    archivedAt: Date | null
    createdAt: Date
    updatedAt: Date
    lastBacktestRef: Prisma.JsonValue | null
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }): AiQuantConversationSnapshotRecord {
    return {
      ...conversation,
      lastBacktestRef: this.parseLastBacktestRef(conversation.lastBacktestRef),
      messages: conversation.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    }
  }

  private parseLastBacktestRef(
    value: Prisma.JsonValue | null,
  ): AiQuantConversationLastBacktestRefRecord | null {
    if (!this.isJsonObject(value)) {
      return null
    }

    const jobId = this.readNonEmptyString(value.jobId)
    const publishedSnapshotId = this.readNonEmptyString(value.publishedSnapshotId)
    const summary = this.parseLastBacktestSummary(value.summary)
    const completedAt = this.parseDate(value.completedAt)

    if (!jobId || !publishedSnapshotId || !summary || !completedAt) {
      return null
    }

    return {
      jobId,
      publishedSnapshotId,
      summary,
      completedAt,
    }
  }

  private parseLastBacktestSummary(
    value: Prisma.JsonValue | null | undefined,
  ): AiQuantConversationLastBacktestRefRecord['summary'] | null {
    if (!this.isJsonObject(value)) {
      return null
    }

    const maxDrawdownPct = this.readFiniteNumber(value.maxDrawdownPct)
    const totalReturnPct = this.readFiniteNumber(value.totalReturnPct)
    const winRatePct = this.readFiniteNumber(value.winRatePct)
    const tradeCount = this.readFiniteNumber(value.tradeCount)

    if (
      maxDrawdownPct === null
      || totalReturnPct === null
      || winRatePct === null
      || tradeCount === null
    ) {
      return null
    }

    const openTradeCount = this.readOptionalFiniteNumber(value.openTradeCount)
    const openPnl = this.readOptionalFiniteNumber(value.openPnl)
    const marketType = this.parseMarketType(value.marketType)

    if (
      (value.openTradeCount !== undefined && value.openTradeCount !== null && openTradeCount === null)
      || (value.openPnl !== undefined && value.openPnl !== null && openPnl === null)
      || (value.marketType !== undefined && value.marketType !== null && marketType === null)
    ) {
      return null
    }

    return {
      maxDrawdownPct,
      totalReturnPct,
      winRatePct,
      tradeCount,
      ...(openTradeCount !== undefined ? { openTradeCount } : {}),
      ...(openPnl !== undefined ? { openPnl } : {}),
      ...(marketType ? { marketType } : {}),
    }
  }

  private parseMarketType(
    value: Prisma.JsonValue | null | undefined,
  ): 'spot' | 'perp' | null | undefined {
    if (value === undefined || value === null) {
      return undefined
    }
    return value === 'spot' || value === 'perp' ? value : null
  }

  private parseDate(value: Prisma.JsonValue | null | undefined): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value
    }
    if (typeof value !== 'string' || !value.trim()) {
      return null
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private readOptionalFiniteNumber(value: Prisma.JsonValue | null | undefined): number | null | undefined {
    if (value === undefined || value === null) {
      return undefined
    }
    return this.readFiniteNumber(value)
  }

  private readFiniteNumber(value: Prisma.JsonValue | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readNonEmptyString(value: Prisma.JsonValue | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null
    }
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
