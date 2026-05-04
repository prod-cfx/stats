import { PositionSide } from '@ai/shared'
import { PositionsRepository } from './positions.repository'

describe('positionsRepository', () => {
  it('locks legacy open positions by market type when exchange ownership is missing', async () => {
    let sql = ''
    const txHost = {
      tx: {
        $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
          sql = strings.join('?')
          return []
        }),
      },
    }
    const repository = new PositionsRepository(txHost as any)

    await repository.lockOpenPosition(
      'account-1',
      'BTCUSDT:PERP',
      PositionSide.LONG,
      { exchangeId: 'okx', marketType: 'perp', market: 'okx:perp' },
    )

    expect(sql).toContain('OR ("exchange_id" IS NULL AND "market_type" = ?)')
    expect(sql).toContain('WHEN "exchange_id" IS NULL AND "market_type" = ? THEN 2')
  })
})
