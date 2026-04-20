import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'

describe('canonicalSpecBuilderService', () => {
  it('bridges StrategyIR back into canonical spec v2 through the migration entry point', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromStrategyIr({
      version: 'strategy-ir.v1',
      market: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      intent: {
        kind: 'grid.range_rebalance',
        trigger: {
          range: { lower: 60000, upper: 80000 },
          stepPct: 0.5,
          sideMode: 'bidirectional',
          recycle: true,
        },
        sizing: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_short',
        },
        actions: ['open_long', 'close_long', 'open_short', 'close_short'],
        risk: [
          {
            kind: 'risk.stop_loss_pct',
            params: { valuePct: 5, basis: 'entry_avg_price' },
          },
        ],
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
    ]))
  })

  it('builds stable sma crossover rules from normalized intent through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const normalizedIntent = new StrategyIntentNormalizerService().normalize({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
      },
    } as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
      },
    } as any, normalizedIntent)

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '1h',
    })
    expect(spec.indicators).toEqual([
      { kind: 'sma', params: { period: 20 } },
    ])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.golden_cross',
          op: 'CROSS_OVER',
          params: { indicator: 'sma' },
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            source: 'normalized-intent',
            family: 'single-leg',
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'ma.death_cross',
          op: 'CROSS_UNDER',
          params: { indicator: 'sma' },
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'position_loss_pct',
          value: 0.05,
          params: { basis: 'entry_avg_price' },
        }),
      }),
    ]))
    expect(spec.metadata).toEqual(expect.objectContaining({
      normalized: expect.objectContaining({
        source: 'normalized-intent',
      }),
    }))
  })

  it('builds canonical spec directly from normalized semantic intent without compatibility checklist projection', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '15m' },
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_upper',
          phase: 'entry',
          sideScope: 'short',
          params: { period: 20, stdDev: 2, confirmationMode: 'touch' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_short' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: null,
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sideScope: 'short',
        condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
      }),
    ]))
  })

  it('builds canonical spec from generic execution triggers without falling back to compatibility placeholders', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'spot', defaultTimeframe: '1h' },
      symbols: ['ORDIUSDT'],
      timeframes: ['1h'],
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'execution.on_start',
          phase: 'entry',
          sideScope: 'long',
          params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: { valuePct: 1, basis: 'prev_close', window: '1h' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'execution.on_start',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'GTE',
          value: 0.01,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('preserves price-vs-single-ma breakout semantics for indicator.above/below normalized triggers', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '1h' },
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', referenceRole: 'long_term', 'reference.period': 50 },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'indicator.below',
          phase: 'exit',
          params: { indicator: 'ma', referenceRole: 'short_term', 'reference.period': 20 },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'indicator.above',
          op: 'GTE',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'long_term',
            'reference.period': 50,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'indicator.below',
          op: 'LTE',
          params: expect.objectContaining({
            indicator: 'ma',
            referenceRole: 'short_term',
            'reference.period': 20,
          }),
        }),
      }),
    ]))
  })

  it('normalizes single-trade sizing language into positionPct', () => {
    const conversationService = Object.create(CodegenConversationService.prototype) as CodegenConversationService

    const checklist = (conversationService as any).inferChecklistFromMessage(
      '在 OKX 现货市场交易 BTCUSDT，单笔使用 10% 资金',
    )

    expect(checklist.riskRules?.positionPct).toBe(10)
  })

  it('fills default entry-price basis for stop-loss and take-profit when checklist omits them', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['15 分钟上涨 1% 买入'],
      exitRules: ['15 分钟下跌 5% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        takeProfitPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
    ]))
  })

  it('preserves clarified stop-loss and take-profit basis on canonical risk rules', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘价突破上轨时做空'],
      exitRules: ['价格回到中轨（20日均线）时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'entry_avg_price' }),
        }),
        metadata: expect.objectContaining({ basis: 'entry_avg_price' }),
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        condition: expect.objectContaining({
          params: expect.objectContaining({ basis: 'position_pnl' }),
        }),
        metadata: expect.objectContaining({ basis: 'position_pnl' }),
      }),
    ]))
  })

  it('emits canonical default timeframe and per-rule timeframe params for multi-timeframe strategies', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      entryRuleDrafts: [{ id: 'entry-1', phase: 'entry', text: '3m 内下跌 1% 买入', timeframe: '3m' }],
      exitRuleDrafts: [{ id: 'exit-1', phase: 'exit', text: '15m 内上涨 2% 卖出', timeframe: '15m', basis: 'entry_avg_price' }],
      riskRules: { exchange: 'okx', marketType: 'spot', positionPct: 10, stopLossPct: 5 },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      defaultTimeframe: '3m',
    })
    expect(spec.dataRequirements.requiredTimeframes).toEqual(['3m', '15m'])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-price-change-1',
        condition: expect.objectContaining({
          params: expect.objectContaining({ timeframe: '3m' }),
        }),
      }),
      expect.objectContaining({
        id: 'exit-price-change-1',
        condition: expect.objectContaining({
          params: expect.objectContaining({ timeframe: '15m' }),
        }),
      }),
    ]))
  })

  it('keeps explicit position-pnl overrides on canonical risk rules', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['ETHUSDT'],
      timeframes: ['15m'],
      entryRules: ['15 分钟上涨 1% 买入'],
      exitRules: ['15 分钟下跌 5% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'spot',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'position_pnl',
        takeProfitPct: 10,
        takeProfitBasis: 'position_pnl',
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-stop-loss',
        metadata: expect.objectContaining({ basis: 'position_pnl' }),
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        metadata: expect.objectContaining({ basis: 'position_pnl' }),
      }),
    ]))
  })

  it('does not inject sma when clarified bollinger middle-band semantics use a moving-average alias', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['收盘价突破上轨时做空'],
      exitRules: ['价格回到中轨（20日均线）时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        positionPct: 10,
      },
    })

    expect(spec.indicators).toEqual([
      expect.objectContaining({ kind: 'bollingerBands' }),
    ])
    expect(spec.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
  })

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

  it('builds stable explicit-cue bollinger rules from normalized intent without injecting sma through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['触及布林带上轨后收盘确认做空', '触及布林带下轨后收盘确认做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
      },
    }
    const normalizedIntent = new StrategyIntentNormalizerService().normalize(checklist as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent(checklist, normalizedIntent)

    expect(spec.indicators).toEqual([
      { kind: 'bollingerBands', params: { period: 20, stdDev: 2 } },
    ])
    expect(spec.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'bollinger.upper_break',
          op: 'CROSS_OVER',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.lower_break',
          op: 'CROSS_UNDER',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.middle_revert',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
      expect.objectContaining({
        id: 'risk-take-profit',
        phase: 'risk',
      }),
    ]))
  })

  it('falls back to exit sideScope from normalized bollinger actions when sideScope is omitted', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          closureStatus: 'closed',
          unresolvedSlots: [],
          params: {
            band: 'middle',
            period: 20,
            stdDev: 2,
          },
        },
      ],
      actions: [{ key: 'close_long' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'bollinger.middle_revert',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            source: 'normalized-intent',
            triggerKeys: ['bollinger.touch_middle'],
            actionKeys: ['CLOSE_LONG'],
            family: 'single-leg',
          }),
        }),
      }),
    ]))
  })

  it('keeps entry sideScope unset when normalized intent omits it', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['single-leg'],
      triggers: [
        {
          key: 'bollinger.touch_upper',
          phase: 'entry',
          closureStatus: 'closed',
          unresolvedSlots: [],
          params: {
            band: 'upper',
            period: 20,
            stdDev: 2,
          },
        },
      ],
      actions: [{ key: 'open_long' }],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'bollinger.upper_break',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
    ]))
    expect(spec.rules.find(rule => rule.phase === 'entry')?.sideScope).toBeUndefined()
  })

  it('builds outside-band reduce rules when earlyStop asks to reduce exposure', () => {
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
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时提前减仓',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'bollinger.bars_outside',
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('treats direct close wording as full exit for outside-band risk', () => {
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
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时直接平仓',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'bollinger.bars_outside',
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('builds outside-band full close from exitRules without requiring riskRules.earlyStop', () => {
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
        '价格连续3根K线在轨外时直接平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'exit-middle-1',
        phase: 'exit',
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        phase: 'risk',
        metadata: { source: 'exitRules' },
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
  })

  it('prefers clarified exitRules over stale earlyStop text for outside-band action semantics', () => {
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
        '价格连续3根K线在轨外时直接平仓',
      ],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        stopLossPct: 5,
        earlyStop: '价格连续3根K线在轨外时直接减仓',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'risk-outside-band-3-bars',
        metadata: { source: 'exitRules' },
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
    ]))
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
      defaultTimeframe: null,
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

  it('uses checklist riskRules.exchange as canonical market exchange when provided', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['短均线上穿长均线时做多'],
      exitRules: ['短均线下穿长均线时平多'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.market).toEqual({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
    })
  })

  it('builds RSI threshold entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['RSI 14 高于 70 时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'rsi',
      params: { period: 14 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_lte', value: 30 }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'rsi.threshold_gte', value: 70 }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds MACD cross entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['MACD 金叉时做多'],
      exitRules: ['MACD 死叉时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'macd',
      params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.golden_cross' }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'macd.death_cross' }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入'],
      exitRules: ['价格触达上方网格卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'custom',
      params: { family: 'grid' },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 1,
            levelCount: 21,
          }),
        }),
      }),
    ]))
  })

  it('normalizes per-mille grid steps into percent while keeping grid params explicit', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按千分之5步长共 21 格执行区间网格买入'],
      exitRules: ['价格触达上方网格卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            levelCount: 21,
          }),
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            levelCount: 21,
          }),
        }),
      }),
    ]))
  })

  it('builds short-grid entry and exit rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空'],
      exitRules: ['价格回落触达下方网格买回平空'],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds bidirectional grid rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: [
        '在 60000-80000 固定区间按步长 1% 共 21 格执行区间网格买入',
        '在 60000-80000 固定区间按步长 1% 共 21 格执行上方网格做空',
      ],
      exitRules: [
        '价格触达上方网格卖出',
        '价格回落触达下方网格买回平空',
      ],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules.filter(rule => rule.phase === 'entry')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'OPEN_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'OPEN_SHORT' })] }),
    ]))
    expect(spec.rules.filter(rule => rule.phase === 'exit')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sideScope: 'long', actions: [expect.objectContaining({ type: 'CLOSE_LONG' })] }),
      expect.objectContaining({ sideScope: 'short', actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })] }),
    ]))
  })

  it('builds stable bidirectional grid rules from normalized intent through the migration path', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['在 60000-80000 的区间，每一格千分之5，不断低买高卖'],
      exitRules: ['持续网格卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
        stopLossPct: 5,
      },
    }
    const normalizedIntent = new StrategyIntentNormalizerService().normalize(checklist as any).normalizedIntent

    const spec = service.buildFromNormalizedIntent(checklist, normalizedIntent)

    expect(spec.indicators).toEqual([
      { kind: 'custom', params: { family: 'grid' } },
    ])
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
          params: expect.objectContaining({
            rangeMin: 60000,
            rangeMax: 80000,
            stepPct: 0.5,
            timeframe: '15m',
          }),
        }),
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            family: 'grid.range_rebalance',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'GTE',
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'grid.range_rebalance',
          op: 'LTE',
        }),
      }),
      expect.objectContaining({
        id: 'risk-stop-loss',
        phase: 'risk',
      }),
    ]))
  })

  it('expands bidirectional grid normalized intent into four directional rules', () => {
    const service = new CanonicalSpecBuilderService()
    const checklist = {
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    }
    const normalizedIntent = {
      families: ['grid.range_rebalance'],
      triggers: [],
      actions: [
        { key: 'open_long' },
        { key: 'close_long' },
        { key: 'open_short' },
        { key: 'close_short' },
      ],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_short',
      },
      grid: {
        family: 'grid.range_rebalance',
        range: {
          lower: 60000,
          upper: 80000,
        },
        stepPct: 0.5,
        sideMode: 'bidirectional',
        recycle: true,
      },
      unresolved: [],
      normalizationNotes: [],
    }

    const spec = service.buildFromNormalizedIntent(checklist as any, normalizedIntent as any)
    const gridRules = spec.rules.filter(rule => rule.metadata?.normalized?.family === 'grid.range_rebalance')

    expect(gridRules).toHaveLength(4)
    expect(gridRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-long',
        phase: 'entry',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
        metadata: expect.objectContaining({
          normalized: expect.objectContaining({
            triggerKeys: ['grid.range_rebalance'],
            actionKeys: ['OPEN_LONG'],
            family: 'grid.range_rebalance',
          }),
        }),
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-long',
        phase: 'exit',
        sideScope: 'long',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
      expect.objectContaining({
        id: 'entry-grid-range-rebalance-short',
        phase: 'entry',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        id: 'exit-grid-range-rebalance-short',
        phase: 'exit',
        sideScope: 'short',
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds breakout, take-profit, trailing-stop and time-stop rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破前20根K线最高价时做多，冷却 5 根K线'],
      exitRules: ['收益率达到 5% 止盈', '移动止损 10%', '持仓超过 12 根K线平仓'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        cooldownBars: 5,
        condition: expect.objectContaining({
          key: 'breakout.channel_high_break',
          params: expect.objectContaining({ period: 20 }),
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
      }),
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.trailing_stop_pct',
          value: 0.1,
        }),
      }),
      expect.objectContaining({
        phase: 'exit',
        condition: expect.objectContaining({
          key: 'risk.time_stop_bars',
          value: 12,
        }),
      }),
    ]))
  })

  it('builds Donchian breakout aliases into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['突破唐奇安上轨时做多'],
      exitRules: ['跌破唐奇安下轨时平多'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({ key: 'breakout.channel_high_break' }),
      }),
      expect.objectContaining({
        phase: 'entry',
      }),
    ]))
  })

  it('builds short breakout and short-side trade management rules into canonical spec v2', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['跌破前20根K线最低价时做空，冷却 5 根K线'],
      exitRules: ['空单止盈 5%', '移动止损 10% 平空', '持仓超过 12 根K线平空'],
      riskRules: { positionPct: 10, marketType: 'perp' as any },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'short',
        cooldownBars: 5,
        condition: expect.objectContaining({
          key: 'breakout.channel_low_break',
          params: expect.objectContaining({ period: 20 }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'both',
        condition: expect.objectContaining({
          key: 'risk.trailing_stop_pct',
          value: 0.1,
        }),
        actions: [expect.objectContaining({ type: 'FORCE_EXIT' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'short',
        condition: expect.objectContaining({
          key: 'risk.time_stop_bars',
          value: 12,
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_SHORT' })],
      }),
    ]))
  })

  it('builds partial take-profit rules into canonical spec v2 using reduce actions', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ type: 'REDUCE_LONG' }),
          expect.objectContaining({ type: 'REDUCE_SHORT' }),
        ]),
      }),
    ]))
  })

  it('builds partial take-profit rules with explicit reduce ratio', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['RSI 14 低于 30 时做多'],
      exitRules: ['收益率达到 5% 减仓 30% 止盈'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'risk',
        sideScope: 'both',
        condition: expect.objectContaining({
          key: 'risk.take_profit_pct',
          value: 0.05,
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({
            type: 'REDUCE_LONG',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
          expect.objectContaining({
            type: 'REDUCE_SHORT',
            sizing: { mode: 'RATIO', value: 0.3 },
          }),
        ]),
      }),
    ]))
  })

  it('builds price-change entry and exit rules from buy/sell wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3m 内下跌 1% 买入'],
      exitRules: ['15m 内上涨 2% 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'LTE',
          value: -0.01,
          params: expect.objectContaining({
            timeframe: '3m',
          }),
        }),
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        sideScope: 'long',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          op: 'GTE',
          value: 0.02,
          params: expect.objectContaining({
            timeframe: '15m',
          }),
        }),
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('preserves explicit Bollinger parameters from rule text', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['15m'],
      entryRules: ['K线收盘后确认突破布林带(30,2.5)上轨时做空'],
      exitRules: ['价格回到布林带中轨(MA30)时平空'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'bollingerBands',
      params: {
        period: 30,
        stdDev: 2.5,
      },
    })
  })

  it('preserves explicit moving-average periods from crossover wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['5日线上穿20日线买入'],
      exitRules: ['5日线下穿20日线卖出'],
      riskRules: { positionPct: 10 },
    })

    expect(spec.indicators).toContainEqual({
      kind: 'sma',
      params: {
        fast: 5,
        slow: 20,
      },
    })
    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
      }),
      expect.objectContaining({
        phase: 'exit',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
      }),
    ]))
  })

  it('builds price-change rules from raw Chinese minute and percent wording', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['3m', '15m'],
      entryRules: ['3分钟之内跌百分1买入'],
      exitRules: ['15分钟之内涨百分2卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
    })

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'entry-price-change-1',
        condition: expect.objectContaining({
          key: 'price.change_pct',
          params: expect.objectContaining({ timeframe: '3m' }),
          value: -0.01,
        }),
      }),
      expect.objectContaining({
        id: 'exit-price-change-1',
        actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
        condition: expect.objectContaining({
          key: 'price.change_pct',
          params: expect.objectContaining({ timeframe: '15m' }),
          value: 0.02,
        }),
      }),
    ]))
  })

  it('defaults generic sell wording to close short when the strategy only has short-side entries', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.build({
      symbols: ['BTCUSDT'],
      timeframes: ['1h'],
      entryRules: ['EMA7 下穿 EMA21 做空'],
      exitRules: ['EMA7 上穿 EMA21 卖出'],
      riskRules: {
        exchange: 'okx',
        marketType: 'perp',
        positionPct: 10,
      },
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
