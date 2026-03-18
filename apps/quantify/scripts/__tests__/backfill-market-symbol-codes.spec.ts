import { buildBackfillPlan, runBackfill, toSpotCode } from '../backfill-market-symbol-codes'

describe('backfill-market-symbol-codes', () => {
  it('toSpotCode appends :SPOT for unsuffixed symbol only', () => {
    expect(toSpotCode('btcusdt')).toBe('BTCUSDT:SPOT')
    expect(toSpotCode('BTCUSDT:PERP')).toBeNull()
  })

  it('buildBackfillPlan only includes rows without suffix', () => {
    const plan = buildBackfillPlan([
      { id: '1', code: 'BTCUSDT' },
      { id: '2', code: 'BTCUSDT:PERP' },
      { id: '3', code: 'ETHUSDT:SPOT' },
    ])

    expect(plan).toEqual([{ id: '1', from: 'BTCUSDT', to: 'BTCUSDT:SPOT' }])
  })

  it('runBackfill dry-run does not execute updates', async () => {
    const symbol = {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', code: 'BTCUSDT' },
        { id: '2', code: 'ETHUSDT:PERP' },
      ]),
      update: jest.fn(),
    }

    const prismaMock = {
      symbol,
      $transaction: jest.fn(),
    }

    const result = await runBackfill(prismaMock as never, { apply: false })
    expect(result.plan).toHaveLength(1)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(symbol.update).not.toHaveBeenCalled()
  })

  it('runBackfill apply updates each planned row and is idempotent on second run', async () => {
    const updates: Array<{ id: string; code: string }> = []
    const state = [{ id: '1', code: 'BTCUSDT' }]

    const symbol = {
      findMany: jest.fn().mockImplementation(async () => state.map(item => ({ ...item }))),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { code: string } }) => {
        const row = state.find(item => item.id === where.id)
        if (row) row.code = data.code
        updates.push({ id: where.id, code: data.code })
      }),
    }

    const prismaMock = {
      symbol,
      $transaction: jest.fn(async (callback: (tx: { symbol: typeof symbol }) => Promise<void>) => {
        await callback({ symbol })
      }),
    }

    const first = await runBackfill(prismaMock as never, { apply: true })
    expect(first.updated).toBe(1)
    expect(updates).toEqual([{ id: '1', code: 'BTCUSDT:SPOT' }])

    updates.length = 0
    const second = await runBackfill(prismaMock as never, { apply: true })
    expect(second.updated).toBe(0)
    expect(updates).toEqual([])
  })
})
