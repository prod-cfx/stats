import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

describe('canonicalSpecBuilderService', () => {
  it('builds independent Bollinger rules for upper-short, lower-long, middle-close, and outside-band full close', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '突破布林带上轨做空',
        '突破布林带下轨做多',
      ],
      exitRules: [
        '价格回到布林带中轨平仓',
      ],
      riskRules: {
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前全平',
        positionPct: 10,
      },
    })

    expect(spec.version).toBe(2)
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'both',
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'CLOSE_LONG' }),
          expect.objectContaining({ type: 'CLOSE_SHORT' }),
        ]),
      }),
      expect.objectContaining({
        phase: 'risk',
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))

    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
    expect(entryRules).toHaveLength(2)
  })

  it('emits empty v2 rules when checklist has no recognizable trigger patterns', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['基于盘口情绪择机入场'],
      exitRules: ['根据主观判断离场'],
    })

    expect(spec).toEqual(expect.objectContaining({
      version: 2,
      rules: [],
      indicators: [],
      sizing: null,
    }))
  })

  it('does not inject implicit market/sizing/sma defaults when checklist is missing them', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      entryRules: ['价格收盘确认突破关键阻力位入场'],
      exitRules: ['价格跌破关键支撑位出场'],
    })

    expect(spec.market).toEqual({
      exchange: 'binance',
      symbol: null,
      marketType: 'spot',
      timeframe: null,
    })
    expect(spec.indicators).toEqual([])
    expect(spec.sizing).toBeNull()
    expect(spec.dataRequirements).toEqual({ requiredTimeframes: [] })
  })

  it('parses moving-average short entry and short exit without forcing golden-entry/death-exit defaults', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线下穿长均线（死叉）时做空'],
      exitRules: ['短均线上穿长均线（金叉）时平空'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: { period: 20 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })
})
