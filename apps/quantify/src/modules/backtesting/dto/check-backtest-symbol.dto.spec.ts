import { validate } from 'class-validator'
import { CheckBacktestSymbolDto } from './check-backtest-symbol.dto'

describe('CheckBacktestSymbolDto', () => {
  it('rejects unsupported baseTimeframe values before the controller maps them to service-unavailable errors', async () => {
    const dto = Object.assign(new CheckBacktestSymbolDto(), {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'BTCUSDT',
      baseTimeframe: '13m',
    })

    const errors = await validate(dto)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.property).toBe('baseTimeframe')
    expect(errors[0]?.constraints).toEqual(expect.objectContaining({
      isIn: expect.any(String),
    }))
  })
})
