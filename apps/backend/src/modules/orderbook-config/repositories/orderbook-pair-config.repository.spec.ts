import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@/prisma/prisma.types'
import { OrderbookPairConfigRepository } from './orderbook-pair-config.repository'

describe('OrderbookPairConfigRepository', () => {
  const source = readFileSync(join(__dirname, 'orderbook-pair-config.repository.ts'), 'utf8')

  it('uses Prisma input types instead of any for where and update data', () => {
    expect(source).not.toMatch(/const\s+where:\s*any\s*=/)
    expect(source).not.toMatch(/const\s+data:\s*any\s*=/)
  })

  it('builds findAll where filters without changing query behavior', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repository = new OrderbookPairConfigRepository({
      tx: { orderbookPairConfig: { findMany } },
    } as unknown as TransactionHost<TransactionalAdapterPrisma>)

    await repository.findAll({ venue: 'BINANCE', venueType: 'CEX', instrumentType: 'SPOT', enabledOnly: true })

    expect(findMany).toHaveBeenCalledWith({
      where: { venue: 'BINANCE', venueType: 'CEX', instrumentType: 'SPOT', enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  })

  it('builds update data without changing nullable field behavior', async () => {
    const update = jest.fn().mockResolvedValue({})
    const repository = new OrderbookPairConfigRepository({
      tx: { orderbookPairConfig: { update } },
    } as unknown as TransactionHost<TransactionalAdapterPrisma>)

    await repository.update('config-1', {
      enabled: false,
      pullIntervalSeconds: null,
      depthLevels: null,
      metadata: null,
      description: null,
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        enabled: false,
        pullIntervalSeconds: null,
        depthLevels: null,
        metadata: Prisma.DbNull,
        description: null,
      },
    })
  })
})
