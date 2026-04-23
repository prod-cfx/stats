/* eslint-disable perfectionist/sort-imports -- side-effect import must execute before decorator-dependent modules */
import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
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
      publishedSnapshotId: 'snapshot-1',
      params: { marketType: 'perp' },
    },
    dataRange: { fromTs: 1, toTs: 2 },
    bars: [],
  } as {
    symbols: string[]
    baseTimeframe: string
    stateTimeframes: string[]
    initialCash: number
    leverage?: number
    execution: { slippageBps: number; feeBps: number; priceSource: string }
    strategy: {
      id?: string
      protocolVersion: string
      publishedSnapshotId?: string
      params?: Record<string, unknown>
    }
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

  it('accepts snapshot-backed payload', async () => {
    const payload = buildValidPayload()
    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('accepts snapshot-backed payload with 3m timeframe', async () => {
    const payload = buildValidPayload()
    payload.baseTimeframe = '3m'
    payload.stateTimeframes = ['3m', '15m']

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('rejects strategy payload when publishedSnapshotId is missing', async () => {
    const payload = buildValidPayload()
    delete payload.strategy.publishedSnapshotId

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('accepts payload without bars', async () => {
    const payload = buildValidPayload()
    delete (payload as { bars?: unknown[] }).bars

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('accepts snapshot-backed payload without strategy params', async () => {
    const payload = buildValidPayload()
    delete payload.strategy.params

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })

  it('accepts snapshot-backed payload without strategy id', async () => {
    const payload = buildValidPayload()
    delete payload.strategy.id

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

  it('accepts optional conversationId in run-backtest payloads', async () => {
    const payload = {
      symbols: ['BTCUSDT'],
      baseTimeframe: '15m',
      stateTimeframes: ['15m'],
      initialCash: 10000,
      execution: { slippageBps: 5, feeBps: 2, priceSource: 'close' },
      strategy: {
        id: 'snapshot-1',
        protocolVersion: 'v1',
        publishedSnapshotId: 'snapshot-1',
        params: { marketType: 'spot' },
      },
      conversationId: 'conv-1',
      dataRange: { fromTs: 1, toTs: 2 },
    }

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)
    const apiMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      RunBacktestDto.prototype,
      'conversationId',
    )

    expect(errors).toHaveLength(0)
    expect(dto.conversationId).toBe('conv-1')
    expect(apiMetadata).toEqual(expect.objectContaining({
      required: false,
    }))
  })

  it('accepts spot payload without leverage', async () => {
    const payload = buildValidPayload()
    delete payload.leverage
    payload.strategy.params = { marketType: 'spot' }

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors).toHaveLength(0)
  })

  it('rejects perp payload without leverage', async () => {
    const payload = buildValidPayload()
    delete payload.leverage
    payload.strategy.params = { marketType: 'perp' }

    const dto = plainToInstance(RunBacktestDto, payload)
    const errors = await validate(dto)

    expect(errors.length).toBeGreaterThan(0)
  })
})
