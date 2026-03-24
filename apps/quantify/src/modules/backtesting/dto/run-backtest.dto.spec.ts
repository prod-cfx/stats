import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { RunBacktestDto } from './run-backtest.dto'

function buildValidPayload() {
  return {
    symbols: ['BTCUSDT'],
    baseTimeframe: '5m',
    stateTimeframes: ['1h'],
    initialCash: 10000,
    leverage: 2,
    execution: { slippageBps: 5, feeBps: 4, priceSource: 'mid' },
    strategy: {
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
      params: {},
    },
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
  }
}

describe('runBacktestDto', () => {
  it('rejects legacy strategy.fn payload', async () => {
    const payload = buildValidPayload()
    payload.strategy = {
      id: 's1',
      params: {},
      // legacy input should be rejected
      fn: () => ({ type: 'NOOP' }),
    } as any

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects non-v1 protocolVersion', async () => {
    const payload = buildValidPayload()
    payload.strategy.protocolVersion = 'v2'

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('accepts minimal valid protocol-v1 strategy payload', async () => {
    const dto = plainToInstance(RunBacktestDto, buildValidPayload())
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })
})
