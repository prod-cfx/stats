import type { ExchangeAccount, ExchangeId, User, Prisma  } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'
 
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class ExchangeAccountRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async createExchangeAccount(data: {
    userId: string
    exchangeId: ExchangeId
    name: string
    isTestnet: boolean
    encryptedConfig: string
    lastValidatedAt: Date
  }): Promise<ExchangeAccount> {
    const client = this.getClient()
    return client.exchangeAccount.create({ data })
  }

  async findExchangeAccountFirst(params: {
    where: Prisma.ExchangeAccountWhereInput
    orderBy?: Prisma.ExchangeAccountOrderByWithRelationInput[]
    select?: Prisma.ExchangeAccountSelect
  }): Promise<ExchangeAccount | null> {
    const client = this.getClient()
    return client.exchangeAccount.findFirst(params) as Promise<ExchangeAccount | null>
  }

  async updateExchangeAccount(
    id: string,
    data: Prisma.ExchangeAccountUpdateInput,
  ): Promise<ExchangeAccount> {
    const client = this.getClient()
    return client.exchangeAccount.update({ where: { id }, data })
  }

  async findExchangeAccountsByUser(
    userId: string,
    orderBy: Prisma.ExchangeAccountOrderByWithRelationInput[],
  ): Promise<ExchangeAccount[]> {
    const client = this.getClient()
    return client.exchangeAccount.findMany({ where: { userId }, orderBy })
  }

  async deleteExchangeAccount(id: string): Promise<void> {
    const client = this.getClient()
    await client.exchangeAccount.delete({ where: { id } })
  }

  async pauseActiveLlmSubscriptions(params: {
    userId: string
    exchangeAccountId: string
  }): Promise<{ count: number }> {
    const client = this.getClient()
    return client.userLlmStrategySubscription.updateMany({
      where: {
        userId: params.userId,
        exchangeAccountId: params.exchangeAccountId,
        status: 'active',
      },
      data: { status: 'paused' },
    })
  }

  async findUserById(userId: string): Promise<Pick<User, 'id' | 'email'> | null> {
    const client = this.getClient()
    return client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })
  }

  async findUserByEmail(email: string): Promise<Pick<User, 'id'> | null> {
    const client = this.getClient()
    return client.user.findUnique({
      where: { email },
      select: { id: true },
    })
  }

  async updateUserEmail(userId: string, email: string): Promise<void> {
    const client = this.getClient()
    await client.user.update({
      where: { id: userId },
      data: { email },
    })
  }

  async createUser(data: { id: string; email: string }): Promise<void> {
    const client = this.getClient()
    await client.user.create({ data })
  }
}
