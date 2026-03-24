import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, LlmStrategyCodegenSession, LlmStrategyCodeVersion, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class CodegenSessionsRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async createSession(data: Prisma.LlmStrategyCodegenSessionCreateInput): Promise<LlmStrategyCodegenSession> {
    return this.txHost.tx.llmStrategyCodegenSession.create({ data })
  }

  async findById(id: string): Promise<LlmStrategyCodegenSession | null> {
    return this.txHost.tx.llmStrategyCodegenSession.findUnique({ where: { id } })
  }

  async updateSession(id: string, data: Prisma.LlmStrategyCodegenSessionUpdateInput): Promise<LlmStrategyCodegenSession> {
    return this.txHost.tx.llmStrategyCodegenSession.update({
      where: { id },
      data,
    })
  }

  async tryMarkGenerating(
    id: string,
    data: Prisma.LlmStrategyCodegenSessionUpdateInput,
  ): Promise<boolean> {
    const result = await this.txHost.tx.llmStrategyCodegenSession.updateMany({
      where: {
        id,
        status: { in: ['DRAFTING', 'CHECKLIST_GATE'] },
      },
      data,
    })
    return result.count === 1
  }

  async createVersion(data: Prisma.LlmStrategyCodeVersionCreateInput): Promise<LlmStrategyCodeVersion> {
    return this.txHost.tx.llmStrategyCodeVersion.create({ data })
  }
}
