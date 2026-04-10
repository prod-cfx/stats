import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

export interface AiQuantConversationMessageSnapshot {
  role: 'user' | 'assistant'
  content: string
}

export interface AiQuantConversationSnapshotRecord {
  id: string
  userId: string
  codegenSessionId: string
  title: string
  createdAt: Date
  updatedAt: Date
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
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        codegenSessionId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            role: true,
            content: true,
          },
        },
      },
    })

    return conversations.map(conversation => ({
      ...conversation,
      messages: conversation.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    }))
  }

  private async getByIdOrThrow(id: string): Promise<AiQuantConversationSnapshotRecord> {
    const conversation = await this.txHost.tx.aiQuantConversation.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        userId: true,
        codegenSessionId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            role: true,
            content: true,
          },
        },
      },
    })

    return {
      ...conversation,
      messages: conversation.messages.map(message => ({
        role: message.role,
        content: message.content,
      })),
    }
  }
}
