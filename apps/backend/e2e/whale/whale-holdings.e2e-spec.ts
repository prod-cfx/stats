import type { INestApplication } from '@nestjs/common'
import type { WhaleHoldingsService } from '@/modules/whale-holdings/whale-holdings.service'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleHoldingsService as WhaleHoldingsServiceToken } from '@/modules/whale-holdings/whale-holdings.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

jest.setTimeout(180_000)

describe('WhaleHoldingsService (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleHoldingsService: WhaleHoldingsService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    whaleHoldingsService = app.get(WhaleHoldingsServiceToken)

    // 清理历史测试数据，避免断言被污染
    const client = prisma.getClient()
    await client.hyperliquidWhalePosition.deleteMany({})
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should aggregate latest open whale positions per (user, symbol)', async () => {
    const client = prisma.getClient()

    const now = new Date()
    const minutes = (n: number) => new Date(now.getTime() - n * 60 * 1000)

    // 准备测试数据（HyperliquidWhalePosition 使用 (userAddress, symbol) 唯一约束）：
    // - user1/BTC: 持仓价值 500k（低于 1M 阈值）
    // - user2/BTC: 持仓价值 1.2M（高于 1M 阈值）
    // - user3/ETH: 持仓价值 200k（低于 1M 但高于 100k 阈值）
    await client.hyperliquidWhalePosition.createMany({
      data: [
        {
          userAddress: '0xWhaleAddress1',
          symbol: 'BTC',
          positionSize: '10',
          entryPrice: '50000',
          liquidationPrice: '45000',
          positionValueUsd: '500000', // 50w - below 1M threshold
          pnl: '5000',
          roe: '0.01',
          snapshotTime: minutes(30),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress2',
          symbol: 'BTC',
          positionSize: '20',
          entryPrice: '60000',
          liquidationPrice: '55000',
          positionValueUsd: '1200000', // 120w - above 1M threshold
          pnl: '50000',
          roe: '0.04',
          snapshotTime: minutes(5),
          source: 'TEST',
        },
        {
          userAddress: '0xWhaleAddress3',
          symbol: 'ETH',
          positionSize: '5',
          entryPrice: '3000',
          liquidationPrice: '2500',
          positionValueUsd: '200000', // 20w - below 1M but above 100k
          pnl: '-1000',
          roe: '-0.005',
          snapshotTime: minutes(3),
          source: 'TEST',
        },
      ],
    })

    // 1）仅筛选 BTC，且设置较高的 minPositionValueUsd，只应命中 user2/BTC
    const btcHoldings = await whaleHoldingsService.getCurrentHoldings({
      symbol: 'BTC',
      minPositionValueUsd: 1_000_000,
      limit: 10,
    })

    expect(btcHoldings.length).toBe(1)
    const btc = btcHoldings[0]
    expect(btc.userAddress).toBe('0xWhaleAddress2')
    expect(btc.symbol).toBe('BTC')
    expect(btc.positionValueUsd).toBe(1_200_000)
    expect(btc.side).toBe('LONG')

    // 2）不传 symbol，minPositionValueUsd=100k 时应包含三条记录
    const allHoldings = await whaleHoldingsService.getCurrentHoldings({
      minPositionValueUsd: 100_000,
      limit: 10,
    })

    const addresses = allHoldings.map(h => `${h.userAddress}-${h.symbol}`).sort()
    expect(addresses).toEqual([
      '0xWhaleAddress1-BTC',
      '0xWhaleAddress2-BTC',
      '0xWhaleAddress3-ETH',
    ])
  })
})
