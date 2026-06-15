import type { TransactionHost } from '@nestjs-cls/transactional'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@/prisma/prisma.types'
import { TradesPairConfigRepository } from './trades-pair-config.repository'

describe('TradesPairConfigRepository', () => {
  const source = readFileSync(join(__dirname, 'trades-pair-config.repository.ts'), 'utf8')

  it('uses Prisma input types instead of any for where and update data', () => {
    expect(source).not.toMatch(/const\s+where:\s*any\s*=/)
    expect(source).not.toMatch(/const\s+data:\s*any\s*=/)
  })

  it('builds findAll where filters without changing query behavior', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const repository = new TradesPairConfigRepository({
      tx: { tradesPairConfig: { findMany } },
    } as unknown as TransactionHost<TransactionalAdapterPrisma>)

    await repository.findAll({ exchange: 'OKX', instrumentType: 'SPOT', enabledOnly: true })

    expect(findMany).toHaveBeenCalledWith({
      where: { exchange: 'OKX', instrumentType: 'SPOT', enabled: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    })
  })

  it('builds update data without changing nullable field behavior', async () => {
    const update = jest.fn().mockResolvedValue({})
    const repository = new TradesPairConfigRepository({
      tx: { tradesPairConfig: { update } },
    } as unknown as TransactionHost<TransactionalAdapterPrisma>)

    await repository.update('config-1', {
      enabled: false,
      metadata: null,
      description: null,
    }, { canonicalInstId: null })

    expect(update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        enabled: false,
        metadata: Prisma.DbNull,
        description: null,
        canonicalInstId: null,
      },
    })
  })
})
