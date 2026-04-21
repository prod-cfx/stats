import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable } from '@nestjs/common'

@Injectable()
export class BacktestCapabilitiesRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  findActiveConfig() {
    return this.txHost.tx.backtestCapabilityConfig.findFirst({
      select: {
        allowedBaseTimeframes: true,
      },
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    })
  }
}
