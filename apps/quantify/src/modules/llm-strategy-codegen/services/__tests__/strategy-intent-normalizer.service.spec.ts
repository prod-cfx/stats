import { FIRST_WAVE_FAMILIES, FIRST_WAVE_STATE_TRIGGER_ATOMS, FIRST_WAVE_TRIGGER_ATOMS, GRID_STRATEGY_FAMILY } from '../../constants/canonical-strategy-capabilities'
import { StrategyIntentNormalizerService } from '../strategy-intent-normalizer.service'

describe('strategyIntentNormalizerService', () => {
  const service = new StrategyIntentNormalizerService()

  it('registers the first-wave atom and family catalog', () => {
    expect(FIRST_WAVE_TRIGGER_ATOMS).toEqual(expect.arrayContaining([
      'execution.on_start',
      'price.percent_change',
      'trend.direction',
      'market.regime',
      'volatility.state',
    ]))
    expect(FIRST_WAVE_STATE_TRIGGER_ATOMS).toEqual([
      'trend.direction',
      'market.regime',
      'volatility.state',
    ])
    expect(FIRST_WAVE_FAMILIES).toEqual([
      'single-leg',
      GRID_STRATEGY_FAMILY,
      'state-gated',
    ])
  })

  it('normalizes same-intent drop-buy variants into one percent_change atom', () => {
    const first = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '3m' },
      entryRules: ['3分钟内下跌1%买入'],
      exitRules: ['15分钟内上涨2%卖出'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    const second = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '3m' },
      entryRules: ['3分钟内回调1%做多'],
      exitRules: ['15分钟内反弹2%平多'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    // #1465：evidenceText 必填且为原文，不同表达必然不同；只比较语义结构。
    const stripEvidence = (triggers: typeof first.normalizedIntent.triggers) =>
      triggers.map(({ evidenceText: _evidenceText, ...rest }) => rest)
    expect(stripEvidence(first.normalizedIntent.triggers))
      .toEqual(stripEvidence(second.normalizedIntent.triggers))

    // entry trigger 必带 evidenceText，且为原 rule 子串（planner 闸 1 子串校验前置）
    const firstEntry = first.normalizedIntent.triggers.find(t => t.phase === 'entry')
    expect(firstEntry?.evidenceText).toBe('3分钟内下跌1%买入')
    const firstExit = first.normalizedIntent.triggers.find(t => t.phase === 'exit')
    expect(firstExit?.evidenceText).toBe('15分钟内上涨2%卖出')
  })

  it('preserves moving-average crossover periods as atom params', () => {
    const service = new StrategyIntentNormalizerService()

    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1h' },
      entryRules: ['EMA7 上穿 EMA21 做多'],
      exitRules: ['EMA7 下穿 EMA21 平多'],
      riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price' },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.families).toContain('single-leg')
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
      }),
      expect.objectContaining({
        key: 'indicator.cross_under',
        phase: 'exit',
        sideScope: 'long',
        params: { indicator: 'ema', fastPeriod: 7, slowPeriod: 21 },
      }),
    ]))
    expect(result.normalizedIntent.actions).toEqual([
      { key: 'open_long' },
      { key: 'close_long' },
    ])
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
    expect(result.normalizedIntent.unresolved).toEqual([])
  })

  it('normalizes immediate market-entry wording into a generic execution trigger', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'ORDIUSDT', marketType: 'spot', timeframe: '1h' },
      entryRules: ['立即开始时市价买入一次'],
      exitRules: ['当前K线收盘价相对于上一根K线收盘价上涨≥1%时卖出平仓'],
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        closureStatus: 'closed',
        params: expect.objectContaining({
          timing: 'on_start',
          orderType: 'market',
          occurrence: 'once',
        }),
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          valuePct: 1,
          basis: 'prev_close',
        }),
      }),
    ]))
    expect(result.normalizedIntent.actions).toEqual([
      { key: 'open_long' },
      { key: 'close_long' },
    ])
  })

  it('preserves explicit touch-plus-close bollinger semantics during normalization', () => {
    const service = new StrategyIntentNormalizerService()

    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['触及布林带上轨后收盘确认做空', '触及布林带下轨后收盘确认做多'],
      exitRules: ['价格回到布林带中轨(MA20)时平仓'],
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.families).toContain('single-leg')
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_upper',
        phase: 'entry',
        closureStatus: 'closed',
        sideScope: 'short',
        params: expect.objectContaining({ band: 'upper' }),
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
        unresolvedSlots: [],
      }),
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        phase: 'entry',
        closureStatus: 'closed',
        sideScope: 'long',
        params: expect.objectContaining({ band: 'lower' }),
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
        unresolvedSlots: [],
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        closureStatus: 'closed',
        sideScope: 'long',
        params: expect.objectContaining({ band: 'middle' }),
        resolutionHints: { confirmation: 'ambiguous_touch_or_close_confirm' },
        unresolvedSlots: [],
      }),
    ]))
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_short',
    })
    expect(result.normalizedIntent.unresolved).toEqual([])
  })

  it('preserves official optimized Bollinger period and stdDev during normalization', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'ETHUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['价格触及布林带 30 周期 0.9 倍标准差下轨时做多开仓'],
      exitRules: ['价格回归布林带中轨时平多'],
      riskRules: { positionPct: 35, stopLossPct: 3, takeProfitPct: 0.5 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_lower',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({ band: 'lower', period: 30, stdDev: 0.9 }),
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({ band: 'middle', period: 30, stdDev: 0.9 }),
      }),
    ]))
  })

  it('maps 多单 and 空单 Bollinger middle exits to their explicit sides', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['触及布林带上轨做空', '触及布林带下轨做多'],
      exitRules: [
        '多单在价格回到布林带中轨(MA20)时平仓',
        '空单在价格跌破布林带中轨(MA20)时平仓',
      ],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'long',
      }),
      expect.objectContaining({
        key: 'bollinger.touch_middle',
        phase: 'exit',
        sideScope: 'short',
      }),
    ]))
  })

  it('normalizes a fixed-range grid into the grid.range_rebalance family', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['在 60000-80000 的区间，每一格千分之5，不断低买高卖'],
      exitRules: ['持续网格卖出'],
      riskRules: { positionPct: 10, stopLossPct: 5, takeProfitPct: 8 },
    } as any)

    expect(result.normalizedIntent.families).toContain(GRID_STRATEGY_FAMILY)
    expect(result.normalizedIntent.grid).toEqual(expect.objectContaining({
      family: GRID_STRATEGY_FAMILY,
      range: { lower: 60000, upper: 80000 },
      stepPct: 0.5,
      sideMode: 'bidirectional',
    }))
    expect(result.normalizedIntent.actions).toEqual([
      { key: 'open_long' },
      { key: 'close_long' },
      { key: 'open_short' },
      { key: 'close_short' },
    ])
    expect(result.normalizedIntent.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_short',
    })
    expect(result.normalizedIntent.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({ valuePct: 5, basis: 'entry_avg_price' }),
      }),
      expect.objectContaining({
        key: 'risk.take_profit_pct',
        params: expect.objectContaining({ valuePct: 8, basis: 'entry_avg_price' }),
      }),
    ]))
  })

  it('normalizes legacy riskRules into structured percent risk params', () => {
    const result = service.normalize({
      riskRules: {
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        takeProfitPct: 10,
        takeProfitBasis: 'position_pnl',
      },
    } as never)

    expect(result.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'user_explicit',
        effect: 'close_position',
        scope: 'current_position',
      }),
    }))
    expect(result.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({
        valuePct: 10,
        direction: 'profit',
        basis: 'position_pnl',
        basisSource: 'user_explicit',
        effect: 'close_position',
        scope: 'current_position',
      }),
    }))
  })

  it('normalizes legacy drawdown riskRules into structured risk expressions', () => {
    const result = service.normalize({
      riskRules: {
        maxDrawdownPct: 12,
        maxSingleLossPct: 4,
      },
    })

    expect(result.normalizedIntent.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.condition_expression',
        params: expect.objectContaining({
          scope: 'account',
          condition: expect.objectContaining({
            op: 'GTE',
            left: { kind: 'account', field: 'drawdown_pct' },
            right: { kind: 'constant', value: 12, unit: 'percent' },
          }),
          effect: { type: 'pause_strategy' },
          capabilityStatus: 'recognized_unsupported',
        }),
      }),
      expect.objectContaining({
        key: 'risk.condition_expression',
        params: expect.objectContaining({
          scope: 'current_position',
          effect: { type: 'close_position' },
          capabilityStatus: 'supported',
        }),
      }),
    ]))
  })

  it('marks absent legacy stop loss basis defaults as system generated', () => {
    const result = service.normalize({
      riskRules: {
        stopLossPct: 5,
      },
    } as never)

    expect(result.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })

  it('keeps inferred legacy stop loss basis provenance as system generated', () => {
    const result = service.normalize({
      riskRules: {
        stopLossPct: 5,
        stopLossBasis: 'entry_avg_price',
        _inferredAssumptions: ['risk.stopLossBasis'],
      },
    } as never)

    expect(result.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({
        valuePct: 5,
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })

  it('keeps inferred legacy take profit basis provenance as system generated', () => {
    const result = service.normalize({
      riskRules: {
        takeProfitPct: 10,
        takeProfitBasis: 'entry_avg_price',
        _inferredAssumptions: ['risk.takeProfitBasis'],
      },
    } as never)

    expect(result.normalizedIntent.risk).toContainEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({
        valuePct: 10,
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })

  it('emits a closed grid trigger atom from checklist.grid even without explicit grid wording in rules', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      grid: {
        lower: 60000,
        upper: 80000,
        stepPct: 0.5,
        sideMode: 'bidirectional',
        breakoutAction: 'pause',
      },
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.grid).toEqual(expect.objectContaining({
      family: GRID_STRATEGY_FAMILY,
      range: { lower: 60000, upper: 80000 },
      stepPct: 0.5,
      sideMode: 'bidirectional',
      breakoutAction: 'pause',
    }))
    // #1465 PR review (Major)：explicitGrid 完整但 entryRules/exitRules 为空时，
    // closed trigger 拿不到 user message 子串作 evidence；降级为 open trigger，
    // 由 clarification 路径要求用户用自然语言补 evidence。
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        closureStatus: 'open',
        sideScope: 'both',
        params: expect.objectContaining({
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
          breakoutAction: 'pause',
        }),
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'grid.evidenceText' }),
        ]),
      }),
    ]))
  })

  it('recognizes short-only grid wording and 每一格 percent syntax', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      entryRules: ['做空网格，区间 60000-80000，每一格 1%，行情突破区间就停掉'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.grid).toEqual(expect.objectContaining({
      range: { lower: 60000, upper: 80000 },
      stepPct: 1,
      sideMode: 'short_only',
      breakoutAction: 'pause',
    }))
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'short',
        closureStatus: 'closed',
        params: expect.objectContaining({
          stepPct: 1,
          sideMode: 'short_only',
          breakoutAction: 'pause',
        }),
      }),
    ]))
  })

  it('keeps vague grid semantics as an open grid atom instead of dropping them into unresolved fallback', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp' },
      entryRules: ['帮我做一个网格策略，在一个区间内自动买卖，行情突破区间就停掉'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'grid.range.lower' }),
          expect.objectContaining({ slotKey: 'grid.range.upper' }),
          expect.objectContaining({ slotKey: 'grid.stepPct' }),
        ]),
      }),
    ]))
    expect(result.normalizedIntent.unresolved).toEqual([])
  })

  it('emits an open grid trigger atom from partial checklist.grid without explicit grid wording in rules', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      grid: {
        lower: 60000,
        sideMode: 'long_only',
      },
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.grid).toBeNull()
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        closureStatus: 'open',
        sideScope: 'long',
        params: expect.objectContaining({
          rangeLower: 60000,
          sideMode: 'long_only',
          breakoutAction: 'continue',
        }),
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'grid.range.upper' }),
          expect.objectContaining({ slotKey: 'grid.stepPct' }),
        ]),
      }),
    ]))
    expect(result.normalizedIntent.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'grid.range.lower' }),
        ]),
      }),
    ]))
  })

  it('keeps the live price-change strategy closed', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '3m' },
      entryRules: ['3分钟之内跌百分1买入'],
      exitRules: ['15分钟之内涨百分2卖出'],
      entryRuleBases: { 'entry-1': 'prev_close' },
      exitRuleBases: { 'exit-1': 'prev_close' },
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers.every(item => item.closureStatus === 'closed')).toBe(true)
  })

  it('keeps the live bollinger strategy closed', () => {
    const result = service.normalize({
      market: { exchange: 'okx', symbol: 'BTC-USDT-SWAP', marketType: 'perp', timeframe: '15m' },
      entryRules: ['上轨做空', '下轨做多'],
      exitRules: ['回到中轨平仓'],
      riskRules: { positionPct: 10 },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers.every(item => item.closureStatus === 'closed')).toBe(true)
  })

  it('keeps moving-average breakout semantics open instead of dropping them', () => {
    const result = service.normalize({
      entryRules: ['价格突破一条长期均线时买入'],
      exitRules: ['跌破短期均线时卖出'],
      stateGates: { marketRegime: '震荡行情' },
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'reference.period.entry' }),
          expect.objectContaining({ slotKey: 'confirmationMode.entry' }),
        ]),
      }),
      expect.objectContaining({
        key: 'indicator.below',
        phase: 'exit',
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'reference.period.exit' }),
          expect.objectContaining({ slotKey: 'confirmationMode.exit' }),
        ]),
      }),
    ]))
    expect(result.normalizedIntent.stateHints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: '震荡行情',
        closureStatus: 'closed',
      }),
    ]))
  })

  /**
   * #1465 回归：每个 createClosedTrigger 分支都必须填 evidenceText（原文子串），
   * 否则 planner 闸 1（#1450）evidence_text_missing 校验会让 seed 兜底也失效，
   * 导致 entry 或 exit atom 整段丢失。
   */
  describe('#1465 — closed trigger evidenceText 必填回归', () => {
    const expectEvidence = (
      input: { entryRules?: string[], exitRules?: string[] },
      expected: { phase: 'entry' | 'exit', evidenceText: string },
    ) => {
      const result = service.normalize(input as any)
      const trigger = result.normalizedIntent.triggers.find(
        t => t.phase === expected.phase && t.closureStatus === 'closed',
      )
      expect(trigger).toBeDefined()
      expect(trigger?.evidenceText).toBe(expected.evidenceText)
      // 子串校验对齐 planner 闸 1（#1450）：逐条 rule 判定，避免 join(' ') 跨边界假阳性。
      const allRules = [...(input.entryRules ?? []), ...(input.exitRules ?? [])]
      expect(allRules.some(rule => rule.includes(trigger!.evidenceText as string))).toBe(true)
    }

    it('percent_change entry — N 分钟跌 X% 买入', () => {
      expectEvidence({
        entryRules: ['3分钟内下跌1%买入'],
      }, { phase: 'entry', evidenceText: '3分钟内下跌1%买入' })
    })

    it('percent_change exit — N 分钟涨 X% 卖出', () => {
      expectEvidence({
        entryRules: ['3分钟内下跌1%买入'],
        exitRules: ['15分钟内上涨2%卖出'],
      }, { phase: 'exit', evidenceText: '15分钟内上涨2%卖出' })
    })

    it('execution_intent — 立即市价买入', () => {
      expectEvidence({
        entryRules: ['启动时立即市价买入一次'],
      }, { phase: 'entry', evidenceText: '启动时立即市价买入一次' })
    })

    it('bollinger.touch_lower — 布林下轨开多', () => {
      expectEvidence({
        entryRules: ['布林带下轨开多'],
      }, { phase: 'entry', evidenceText: '布林带下轨开多' })
    })

    it('indicator.cross_over — 金叉做多', () => {
      expectEvidence({
        entryRules: ['EMA7 上穿 EMA21 做多'],
      }, { phase: 'entry', evidenceText: 'EMA7 上穿 EMA21 做多' })
    })

    it('indicator.cross_under — 死叉平多', () => {
      expectEvidence({
        entryRules: ['EMA7 上穿 EMA21 做多'],
        exitRules: ['EMA7 下穿 EMA21 平多'],
      }, { phase: 'exit', evidenceText: 'EMA7 下穿 EMA21 平多' })
    })

    it('price.breakout_up — 突破阻力做多', () => {
      expectEvidence({
        entryRules: ['突破阻力位做多'],
      }, { phase: 'entry', evidenceText: '突破阻力位做多' })
    })

    it('price.breakout_down — 跌破支撑做空', () => {
      expectEvidence({
        entryRules: ['跌破支撑位做空'],
      }, { phase: 'entry', evidenceText: '跌破支撑位做空' })
    })

    it('position_pnl exit — 收益率达 10% 平仓', () => {
      expectEvidence({
        entryRules: ['3分钟内下跌1%买入'],
        exitRules: ['收益率达到10%平仓'],
      }, { phase: 'exit', evidenceText: '收益率达到10%平仓' })
    })

    it('rsi_lte — RSI 超卖买入', () => {
      expectEvidence({
        entryRules: ['RSI 低于 30 超卖买入'],
      }, { phase: 'entry', evidenceText: 'RSI 低于 30 超卖买入' })
    })

    it('rsi_gte — RSI 超买卖出', () => {
      expectEvidence({
        entryRules: ['3分钟内下跌1%买入'],
        exitRules: ['RSI 高于 70 超买卖出'],
      }, { phase: 'exit', evidenceText: 'RSI 高于 70 超买卖出' })
    })

    it('grid 纯结构化输入（无 rules 文本）必须降级为 open trigger + evidence_text slot', () => {
      const result = service.normalize({
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
        grid: {
          lower: 60000,
          upper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
          breakoutAction: 'pause',
        },
        riskRules: { positionPct: 10 },
      } as any)
      const gridTrigger = result.normalizedIntent.triggers.find(t => t.key === 'grid.range_rebalance')
      expect(gridTrigger?.closureStatus).toBe('open')
      expect(gridTrigger?.unresolvedSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'grid.evidenceText' }),
      ]))
      expect(gridTrigger?.evidenceText).toBeUndefined()
    })

    it('grid 带 rules 文本时 closed trigger 的 evidenceText 必为 rules 文本子串', () => {
      const result = service.normalize({
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
        entryRules: ['网格区间 60000-80000，步长 0.5%'],
        grid: {
          lower: 60000,
          upper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
          breakoutAction: 'continue',
        },
        riskRules: { positionPct: 10 },
      } as any)
      const gridTrigger = result.normalizedIntent.triggers.find(t => t.key === 'grid.range_rebalance')
      expect(gridTrigger?.closureStatus).toBe('closed')
      expect(gridTrigger?.evidenceText).toBe('网格区间 60000-80000，步长 0.5%')
    })

    it('grid 部分字段缺失且无 rules 文本 — open trigger 不带 evidence，slot 也不带 evidence', () => {
      // 防止 612172b58 同处清理 createOpenTrigger 的 JSON.stringify 兜底后悄悄回退
      const result = service.normalize({
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
        grid: { lower: 60000 },
        riskRules: { positionPct: 10 },
      } as any)
      const gridTrigger = result.normalizedIntent.triggers.find(t => t.key === 'grid.range_rebalance')
      expect(gridTrigger?.closureStatus).toBe('open')
      expect(gridTrigger?.evidenceText).toBeUndefined()
      // structuredGrid 缺 upper / stepPct → 应有对应 unresolvedSlots
      expect(gridTrigger?.unresolvedSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'grid.range.upper' }),
        expect.objectContaining({ slotKey: 'grid.stepPct' }),
      ]))
      // combinedText 为空时，slot 也不应携带 JSON 兜底的假 evidence
      for (const slot of gridTrigger?.unresolvedSlots ?? []) {
        expect(slot.evidenceText).toBeUndefined()
      }
    })

    it('regression of cmpaluxcc1kjjqnqs03tddxsd — 完整 OKX BTC 现货策略 entry+exit 双侧必须有 evidence', () => {
      const result = service.normalize({
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '3m' },
        entryRules: ['3分钟之内跌1%买入'],
        exitRules: ['15分钟之内涨2%卖出'],
        entryRuleBases: { 'entry-1': 'prev_close' },
        exitRuleBases: { 'exit-1': 'prev_close' },
        riskRules: { positionPct: 10, stopLossPct: 5, stopLossBasis: 'entry_avg_price', takeProfitPct: 10 },
      } as any)

      const entry = result.normalizedIntent.triggers.find(t => t.phase === 'entry')
      const exit = result.normalizedIntent.triggers.find(t => t.phase === 'exit')
      expect(entry).toBeDefined()
      expect(exit).toBeDefined()
      expect(entry?.evidenceText).toBe('3分钟之内跌1%买入')
      expect(exit?.evidenceText).toBe('15分钟之内涨2%卖出')
    })
  })

  it('falls back to an open trigger slot instead of dropping unsupported breakout concepts', () => {
    const result = service.normalize({
      entryRules: ['价格突破关键位置后回踩确认支撑有效再进场'],
    } as any)

    expect(result.blocked).toBe(false)
    expect(result.normalizedIntent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        closureStatus: 'open',
        unresolvedSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'unknown_trigger_definition' }),
          expect.objectContaining({ slotKey: 'pullback.confirmation' }),
        ]),
      }),
    ]))
  })
})
