import type { StrategyExecutionContextV1 } from '../../strategy-protocol'
import type { CompiledOrchestrationScope } from '../compiled-runtime'
import { buildTimeframeBarStatus } from './build-timeframe-bar-status'

const tfScope = (overrides: Partial<Extract<CompiledOrchestrationScope, { scopeKind: 'timeframe' }>> = {}): CompiledOrchestrationScope => ({
  id: 'tf-1',
  scopeKind: 'timeframe',
  primaryTimeframe: '15m',
  requiredTimeframes: ['1h'],
  alignmentPolicy: 'strict',
  ...overrides,
})

const symbolScope = (id = 's-1'): CompiledOrchestrationScope => ({
  id,
  scopeKind: 'symbol',
  symbols: ['BTCUSDT'],
})

const bar = (timestamp: number) => ({ open: 1, high: 1, low: 1, close: 1, volume: 1, timestamp })

describe('buildTimeframeBarStatus (Phase 5 S3 #1109)', () => {
  it('returns undefined when scopes contains no timeframe scope', () => {
    const status = buildTimeframeBarStatus({} as StrategyExecutionContextV1, [symbolScope()])
    expect(status).toBeUndefined()
  })

  it('returns undefined when ctx.data is missing for required tfs', () => {
    const ctx = { data: { primary: {} } } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [tfScope()])
    expect(status).toBeUndefined()
  })

  it('uses default leg id "primary" when ctx.legs is empty', () => {
    const ctx = {
      data: {
        primary: {
          '15m': { bars: [bar(1700_000_000_000)], indicators: {}, currentPrice: 1 },
          '1h':  { bars: [bar(1699_996_400_000)], indicators: {}, currentPrice: 1 },
        },
      },
    } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [tfScope()])
    expect(status).toEqual({
      '15m': { lastClosedBarTs: 1700_000_000_000, lastClosedBarIndex: 0 },
      '1h':  { lastClosedBarTs: 1699_996_400_000, lastClosedBarIndex: 0 },
    })
  })

  it('honors explicit ctx.legs[0].id when provided (multi-leg)', () => {
    const ctx = {
      legs: [{ id: 'main-leg', symbol: 'BTCUSDT', role: 'primary' as const }],
      data: {
        'main-leg': {
          '15m': { bars: [bar(100), bar(200)], indicators: {}, currentPrice: 1 },
          '1h':  { bars: [bar(50)], indicators: {}, currentPrice: 1 },
        },
        'primary': {
          '15m': { bars: [bar(999)], indicators: {}, currentPrice: 1 },
          '1h':  { bars: [bar(999)], indicators: {}, currentPrice: 1 },
        },
      },
    } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [tfScope()])
    expect(status).toEqual({
      '15m': { lastClosedBarTs: 200, lastClosedBarIndex: 1 },
      '1h':  { lastClosedBarTs: 50, lastClosedBarIndex: 0 },
    })
  })

  it('skips a tf when its bars array is empty', () => {
    const ctx = {
      data: {
        primary: {
          '15m': { bars: [bar(1700_000_000_000)], indicators: {}, currentPrice: 1 },
          '1h':  { bars: [], indicators: {}, currentPrice: 1 },
        },
      },
    } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [tfScope()])
    expect(status).toEqual({
      '15m': { lastClosedBarTs: 1700_000_000_000, lastClosedBarIndex: 0 },
    })
  })

  it('skips a tf when last bar has non-finite timestamp', () => {
    const ctx = {
      data: {
        primary: {
          '15m': { bars: [bar(Number.NaN)], indicators: {}, currentPrice: 1 },
        },
      },
    } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [tfScope({ requiredTimeframes: [] as never as readonly string[] })])
    // 用空 required — 仅 primary 缺数据 → 整体返回 undefined
    expect(status).toBeUndefined()
  })

  it('aggregates timeframes across multiple timeframe scopes (dedup)', () => {
    const ctx = {
      data: {
        primary: {
          '5m':  { bars: [bar(100)], indicators: {}, currentPrice: 1 },
          '15m': { bars: [bar(200)], indicators: {}, currentPrice: 1 },
          '1h':  { bars: [bar(50)], indicators: {}, currentPrice: 1 },
        },
      },
    } as unknown as StrategyExecutionContextV1
    const status = buildTimeframeBarStatus(ctx, [
      tfScope({ id: 'tf-a', primaryTimeframe: '5m', requiredTimeframes: ['15m'] }),
      tfScope({ id: 'tf-b', primaryTimeframe: '15m', requiredTimeframes: ['1h'] }),
    ])
    expect(status).toEqual({
      '5m':  { lastClosedBarTs: 100, lastClosedBarIndex: 0 },
      '15m': { lastClosedBarTs: 200, lastClosedBarIndex: 0 },
      '1h':  { lastClosedBarTs: 50, lastClosedBarIndex: 0 },
    })
  })
})
