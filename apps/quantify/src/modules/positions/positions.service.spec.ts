import { PositionSide } from '@/prisma/prisma.types'
import { PositionsService } from './positions.service'

describe('positionsService', () => {
  function createService() {
    return new PositionsService({} as any, {} as any, {} as any)
  }

  it('maps locked position rows to Prisma field names', async () => {
    const service = createService()
    const prisma = {
      $queryRaw: jest.fn(async () => [
        {
          id: 'position-1',
          userStrategyAccountId: 'account-1',
          symbol: 'BTCUSDT',
          positionSide: 'LONG',
          leverage: null,
          quantity: { toString: () => '0.00134' },
          avgEntryPrice: { toString: () => '74180.5' },
          realizedPnl: { toString: () => '0' },
          unrealizedPnl: { toString: () => '0' },
          status: 'OPEN',
          openedAt: new Date('2026-03-18T10:23:24.000Z'),
          closedAt: null,
          exchangeId: 'okx',
          marketType: 'spot',
          metadata: null,
          createdAt: new Date('2026-03-18T10:23:24.000Z'),
          updatedAt: new Date('2026-03-18T10:23:24.000Z'),
        },
      ]),
    }

    const position = await (service as any).loadAndLockPosition(
      prisma as any,
      'account-1',
      'BTCUSDT',
      PositionSide.LONG,
    )

    expect(position?.avgEntryPrice?.toString()).toBe('74180.5')
    expect(position?.realizedPnl?.toString()).toBe('0')
    expect(position?.marketType).toBe('spot')
  })
})
