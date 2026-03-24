import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient, ExchangeAccount, ExchangeId, User, Prisma } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class ExchangeAccountRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async createExchangeAccount(data: {
    userId: string
    exchangeId: ExchangeId
    name: string
    isTestnet: boolean
    encryptedConfig: string
    lastValidatedAt: Date
  }): Promise<ExchangeAccount> {
    const client = this.txHost.tx
    return client.exchangeAccount.create({ data })
  }

  async findExchangeAccountFirst(params: {
    where: Prisma.ExchangeAccountWhereInput
    orderBy?: Prisma.ExchangeAccountOrderByWithRelationInput[]
    select?: Prisma.ExchangeAccountSelect
  }): Promise<ExchangeAccount | null> {
    const client = this.txHost.tx
    return client.exchangeAccount.findFirst(params) as Promise<ExchangeAccount | null>
  }

  async updateExchangeAccount(
    id: string,
    data: Prisma.ExchangeAccountUpdateInput,
  ): Promise<ExchangeAccount> {
    const client = this.txHost.tx
    return client.exchangeAccount.update({ where: { id }, data })
  }

  async findExchangeAccountsByUser(
    userId: string,
    orderBy: Prisma.ExchangeAccountOrderByWithRelationInput[],
  ): Promise<ExchangeAccount[]> {
    const client = this.txHost.tx
    return client.exchangeAccount.findMany({ where: { userId }, orderBy })
  }

  async deleteExchangeAccount(id: string): Promise<void> {
    const client = this.txHost.tx
    await client.exchangeAccount.delete({ where: { id } })
  }

  async pauseActiveLlmSubscriptions(params: {
    userId: string
    exchangeAccountId: string
  }): Promise<{ count: number }> {
    const client = this.txHost.tx
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
    const client = this.txHost.tx
    return client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })
  }

  async findUserByEmail(email: string): Promise<Pick<User, 'id'> | null> {
    const client = this.txHost.tx
    return client.user.findUnique({
      where: { email },
      select: { id: true },
    })
  }

  async updateUserEmail(userId: string, email: string): Promise<void> {
    const client = this.txHost.tx
    await client.user.update({
      where: { id: userId },
      data: { email },
    })
  }

  async createUser(data: { id: string; email: string }): Promise<void> {
    const client = this.txHost.tx
    await client.user.create({ data })
  }
}
