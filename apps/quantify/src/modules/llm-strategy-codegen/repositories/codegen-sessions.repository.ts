import type { LlmStrategyCodegenSession, LlmStrategyCodeVersion, Prisma } from '@/prisma/prisma.types'

import { Injectable } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂瀵煎叆
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
}
