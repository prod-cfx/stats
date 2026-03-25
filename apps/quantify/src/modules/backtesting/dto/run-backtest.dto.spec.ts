/* eslint-disable perfectionist/sort-imports -- side-effect import must execute before decorator-dependent modules */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { RunBacktestDto } from './run-backtest.dto'
/* eslint-enable perfectionist/sort-imports */

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
  } as {
    symbols: string[]
    baseTimeframe: string
    stateTimeframes: string[]
    initialCash: number
    leverage: number
    execution: { slippageBps: number; feeBps: number; priceSource: string }
    strategy: { id: string; protocolVersion: string; scriptCode: string; params: Record<string, unknown> }
    dataRange: { fromTs: number; toTs: number }
    bars?: unknown[]
    allowPartial?: boolean
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

  it('accepts payload without bars', async () => {
    const payload = buildValidPayload()
    delete (payload as { bars?: unknown[] }).bars

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('accepts optional allowPartial boolean', async () => {
    const payload = buildValidPayload()
    payload.allowPartial = true

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })
})
