import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { STAGE1_TYPED_RULES_CORPUS } from './fixtures/stage1-typed-rules-corpus'

function ruleEffectKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return listRuleEffects(rule.effects)
    .flatMap(effect => collectAtomLeaves(effect))
    .map(leaf => leaf.key)
}

function ruleEffectLeaves(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]) {
  return listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect))
}

function ruleConditionKeys(rule: NonNullable<ReturnType<GenericSeedDispatcher['dispatch']>['rules']>[number]): string[] {
  return collectAtomLeaves(rule.condition).map(leaf => leaf.key)
}

function allEffectLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (patch.rules ?? []).flatMap(rule => ruleEffectLeaves(rule).map(leaf => ({ ...leaf, rulePhase: rule.phase })))
}

function allConditionLeaves(patch: ReturnType<GenericSeedDispatcher['dispatch']>) {
  return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => ({ ...leaf, rulePhase: rule.phase })))
}

function findConditionLeaf(patch: ReturnType<GenericSeedDispatcher['dispatch']>, key: string) {
  return allConditionLeaves(patch).find(leaf => leaf.key === key)
}

describe('stage1 typed rules corpus fixture', () => {
  it('contains exactly 31 required current-capability cases', () => {
    expect(STAGE1_TYPED_RULES_CORPUS).toHaveLength(31)
    expect(new Set(STAGE1_TYPED_RULES_CORPUS.map(item => item.id)).size).toBe(31)
    expect(STAGE1_TYPED_RULES_CORPUS.every(item => item.text.trim().length > 0)).toBe(true)
  })

  it.each(STAGE1_TYPED_RULES_CORPUS)(
    '$id dispatches production typed rules without legacy flat fields',
    ({ text, expectedPhases, expectedEffectRoles }) => {
      const patch = new GenericSeedDispatcher().dispatch(text)
      const legacyTopLevelFields = ['triggers', 'actions', 'risk', 'position', 'orchestration', 'atoms'] as const

      expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
      for (const field of legacyTopLevelFields) {
        expect(patch).not.toHaveProperty(field)
      }
      for (const rule of patch.rules ?? []) {
        expect(Array.isArray(rule.effects)).toBe(false)
      }

      const phases = new Set((patch.rules ?? []).map(rule => rule.phase))
      for (const phase of expectedPhases) {
        expect(phases.has(phase)).toBe(true)
      }

      for (const role of expectedEffectRoles) {
        expect((patch.rules ?? []).some(rule => !Array.isArray(rule.effects) && rule.effects[role].length > 0)).toBe(true)
      }
    },
  )

  it('scopes entry open action away from exit rules', () => {
    const patch = new GenericSeedDispatcher().dispatch('15min 布林带下轨买入 上轨卖出')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).not.toContain('action.open_long')
  })

  it('uses grid.range_rebalance as program condition without blind entry open action', () => {
    const patch = new GenericSeedDispatcher().dispatch('在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金')
    const programRule = patch.rules?.find(rule => rule.phase === 'program')

    expect(programRule).toBeDefined()
    expect(ruleConditionKeys(programRule!)).toContain('grid.range_rebalance')
    expect(ruleEffectKeys(programRule!)).not.toContain('action.open_long')
  })

  it('scopes entry position sizing away from exit and program rules', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1小时突破 MA20 买入，单笔使用 10% 资金，跌破 MA20 卖出，启用最大回撤 15% 熔断')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')
    const gateRule = patch.rules?.find(rule => rule.phase === 'gate')

    expect(exitRule).toBeDefined()
    expect(gateRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).not.toContain('position.sizing')
    expect(ruleEffectKeys(gateRule!)).not.toContain('position.sizing')
  })

  it('uses rolling extrema breakout predicates as rules-tree conditions for breakout channel strategy', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(entryRule).toBeDefined()
    expect(exitRule).toBeDefined()
    expect(ruleConditionKeys(entryRule!)).toContain('price.rolling_extrema_breakout')
    expect(ruleConditionKeys(exitRule!)).toContain('price.rolling_extrema_breakout')
    expect(entryRule!.condition).toEqual(expect.objectContaining({
      key: 'price.rolling_extrema_breakout',
      params: expect.objectContaining({ lookbackBars: 20, extrema: 'high', event: 'breakout_up' }),
    }))
    expect(exitRule!.condition).toEqual(expect.objectContaining({
      key: 'price.rolling_extrema_breakout',
      params: expect.objectContaining({ lookbackBars: 10, extrema: 'low', event: 'breakout_down' }),
    }))
  })

  it('does not fabricate default effects without explicit text evidence', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1小时 RSI 低于 30')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('action.open_long')
    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
    expect(effects.map(effect => effect.key)).not.toContain('risk.stop_loss_pct')
    expect(effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'scope.timeframe',
          evidence: expect.objectContaining({ text: expect.stringContaining('1小时') }),
        }),
      ]),
    )
  })

  it('attaches evidence text to inferred fallback effects', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。')
    const effects = allEffectLeaves(patch)

    expect(effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'action.open_long',
          evidence: expect.objectContaining({ text: expect.stringContaining('买') }),
        }),
        expect.objectContaining({
          key: 'position.sizing',
          evidence: expect.objectContaining({ text: expect.stringContaining('一点') }),
        }),
      ]),
    )
    expect(effects.map(effect => effect.key)).not.toContain('action.open_short')
  })

  it('does not infer sizing from generic use wording in stage1 candle case', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-008-candle-open-close')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
  })

  it('does not infer sizing from funding rate percentage', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h 资金费率大于 0.1% 时做多')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).not.toContain('position.sizing')
  })

  it('treats single EMA cross wording as price crossing that EMA when combined with funding rate', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。跌破 EMA20 时平多。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const leaves = entryRule ? collectAtomLeaves(entryRule.condition) : []
    const cross = leaves.find(leaf => leaf.key === 'indicator.cross_over')

    expect(entryRule).toBeDefined()
    expect(leaves.map(leaf => leaf.key)).toContain('fundingRate.condition')
    expect(cross).toEqual(expect.objectContaining({
      key: 'indicator.cross_over',
      params: expect.objectContaining({
        indicator: 'ema',
        period: 20,
        fastPeriod: 20,
        priceCross: true,
      }),
    }))
    expect(cross?.params).not.toEqual(expect.objectContaining({ slowPeriod: 14 }))
    expect(cross?.params).not.toEqual(expect.objectContaining({ period: 0 }))
    expect(ruleEffectKeys(entryRule!)).toContain('action.open_long')
  })

  it('keeps explicit relative-volume filter in BOLL lower-band entry condition', () => {
    const patch = new GenericSeedDispatcher().dispatch('ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')
    const leaves = entryRule ? collectAtomLeaves(entryRule.condition) : []

    expect(entryRule).toBeDefined()
    expect(entryRule?.condition.kind).toBe('and')
    expect(leaves.map(leaf => leaf.key)).toEqual(expect.arrayContaining([
      'bollinger.touch_lower',
      'volume.threshold',
    ]))
    expect(leaves.find(leaf => leaf.key === 'volume.threshold')).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        mode: 'relative_to_sma',
        refWindow: 20,
        multiplier: 1.5,
      }),
    }))
  })

  describe('official Strategy Plaza semantic parameter regressions', () => {
    it('keeps open-interest window and percent change in breakout confirmation entry', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建持仓量突破确认策略。规则：未平仓量 1 小时增加超过 5% 且价格突破过去 20 根 K 线高点时开多；跌破 EMA20 时平多；风控：仓位 10%，亏损 2% 止损。')
      const oi = findConditionLeaf(patch, 'openInterest.condition')

      expect(oi).toEqual(expect.objectContaining({
        params: expect.objectContaining({ direction: 'up', changePct: 5, window: '1h' }),
      }))
      expect(findConditionLeaf(patch, 'price.rolling_extrema_breakout')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ lookbackBars: 20, extrema: 'high', event: 'breakout_up' }),
      }))
    })

    it('keeps EMA20 identity for slope trend and does not infer bearish candle pattern', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 EMA 斜率趋势策略。规则：EMA20 斜率连续 3 根向上且成交量确认放大后开多；价格跌破 EMA20 平多；风控：仓位 20%，2 倍杠杆，亏损 2% 止损。')
      const keys = allConditionLeaves(patch).map(leaf => leaf.key)

      expect(findConditionLeaf(patch, 'indicator.slope')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ indicator: 'ema', period: 20, direction: 'up', consecutiveBars: 3 }),
      }))
      expect(keys).not.toContain('price.candle_pattern')
    })

    it('keeps multi-timeframe gate timeframe on 1h MA50 filter', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建多周期趋势策略。规则：15m EMA20 上穿 EMA50 开多，但 1h 价格必须在 MA50 上方才允许入场；15m 跌破 EMA20 平多；风控：仓位 20%，亏损 2% 止损。')
      const maGate = allConditionLeaves(patch).find(leaf => leaf.key === 'indicator.above' && leaf.params?.indicator === 'ma')

      expect(findConditionLeaf(patch, 'indicator.cross_over')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ indicator: 'ema', fastPeriod: 20, slowPeriod: 50, timeframe: '15m' }),
      }))
      expect(maGate).toEqual(expect.objectContaining({
        params: expect.objectContaining({ indicator: 'ma', period: 50, timeframe: '1h' }),
      }))
    })

    it('keeps funding-rate threshold percentage', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建资金费率反转策略。规则：资金费率大于 0.01% 且 RSI14 高于 70 时开空；RSI14 低于 40 时平空；风控：仓位 10%，2 倍杠杆，亏损 1.5% 止损。')

      expect(findConditionLeaf(patch, 'fundingRate.condition')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ operator: 'GT', valuePct: 0.01 }),
      }))
    })

    it('keeps orderbook imbalance percent, cooldown, and time-stop bars', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 1m，创建盘口买盘失衡确认策略。规则：价格突破最近 6 根 K 线高点且必须 OKX orderbook imbalance 大于 52% 才允许开多；每 10 根 K 线最多开仓一次；持仓 4 根 K 线后平多；跌破 EMA20 时平多；风控：仓位 70%，2 倍杠杆，亏损 0.6% 止损，止盈 0.12%。')
      const effects = allEffectLeaves(patch)

      expect(findConditionLeaf(patch, 'orderbook.imbalance')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ side: 'bid_over_ask', operator: 'gt', percent: 52 }),
      }))
      expect(effects).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'risk.cooldown', params: expect.objectContaining({ durationBars: 10 }) }),
        expect.objectContaining({ key: 'risk.time_stop_bars', params: expect.objectContaining({ maxBars: 4, effect: 'close_position' }) }),
      ]))
    })

    it('keeps liquidation side and notional threshold', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建清算瀑布开空策略。规则：多头清算超过 100 万 USDT 后开空；价格重新站上 EMA20 平空；风控：仓位 10%，亏损 2% 止损。')

      expect(findConditionLeaf(patch, 'liquidation.condition')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ side: 'long', operator: 'GT', notionalUsd: 1_000_000 }),
      }))
    })

    it('keeps explicit MACD tuple on both golden and death crosses', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 趋势策略。规则：MACD DIF 上穿 DEA 时金叉做多、死叉平多；本策略只做多，不做空；风控：仓位 35%，2 倍杠杆，亏损 2% 止损，盈利 0.5% 止盈。')
      const macdLeaves = allConditionLeaves(patch).filter(leaf => leaf.params?.indicator === 'macd')

      expect(macdLeaves).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'indicator.cross_over', params: expect.objectContaining({ fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 }) }),
        expect.objectContaining({ key: 'indicator.cross_under', params: expect.objectContaining({ fastPeriod: 16, slowPeriod: 34, signalPeriod: 12 }) }),
      ]))
    })

    it('keeps natural-language orderbook depth ratio value', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 ETH-USDT-SWAP 合约 1m，创建盘口深度比确认策略。规则：价格高于 EMA50 且买盘深度是卖盘 1.5 倍以上时开多；价格跌破 EMA50 平多；风控：仓位 10%，亏损 1.2% 止损。')

      expect(findConditionLeaf(patch, 'orderbook.depth_ratio')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ side: 'bid_over_ask', operator: 'gt', ratio: 1.5 }),
      }))
    })

    it('keeps breakout pullback-hold semantics and 2 percent risk', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破回踩策略。规则：价格突破 20 根高点后不立刻买，等回踩不破突破位再开多；跌破突破位下方止损；风控：仓位 20%，亏损 2% 止损。')
      const effects = allEffectLeaves(patch)

      expect(allConditionLeaves(patch)).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'price.previous_extrema_retest', params: expect.objectContaining({ retestKind: 'not_break' }) }),
        expect.objectContaining({ key: 'pattern.pullback' }),
      ]))
      expect(effects).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 2 }) }),
      ]))
      expect(effects.filter(effect => effect.key === 'risk.stop_loss_pct')).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ params: expect.objectContaining({ valuePct: 20 }) }),
      ]))
    })

    it('keeps breakout buffer percent', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破追踪策略。规则：价格突破最近 24 根 K 线高点且突破缓冲 0.25% 时做多开仓；价格跌回最近 12 根 K 线低点时平多；风控：仓位 25%，2 倍杠杆，亏损 3% 止损，盈利 0.6% 止盈。')

      expect(findConditionLeaf(patch, 'price.rolling_extrema_breakout')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ lookbackBars: 24, extrema: 'high', event: 'breakout_up', bufferPct: 0.25 }),
      }))
    })

    it('keeps volume relative-average lookback and multiplier', () => {
      const patch = new GenericSeedDispatcher().dispatch('基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建放量突破策略。规则：价格突破过去 20 根 K 线高点并且成交量超过 20 根均量 1.5 倍时开多；跌破 EMA20 平多；风控：仓位 20%，单笔最多亏 2%。')

      expect(findConditionLeaf(patch, 'volume.threshold')).toEqual(expect.objectContaining({
        params: expect.objectContaining({ mode: 'relative_to_sma', refWindow: 20, multiplier: 1.5 }),
      }))
    })
  })

  it('keeps explicit fixed-ratio sizing for on-start spot strategy 6', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-006-ordi-spot-on-start')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)
    const sizing = effects.find(effect => effect.key === 'position.sizing')
    const entryRule = patch.rules?.find(rule => rule.phase === 'entry')

    expect(entryRule).toBeDefined()
    expect(ruleConditionKeys(entryRule!)).toContain('execution.on_start')
    expect(ruleEffectKeys(entryRule!)).toContain('action.open_long')
    expect(sizing).toEqual(expect.objectContaining({
      key: 'position.sizing',
      params: expect.objectContaining({
        sizing: expect.objectContaining({ kind: 'ratio', value: 0.1, unit: 'ratio' }),
      }),
    }))
  })

  it('parses plain percent take-profit without ATR drift for boll scalp strategy 7', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-007-boll-scalp')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const effects = allEffectLeaves(patch)
    const keys = effects.map(effect => effect.key)
    const takeProfit = effects.find(effect => effect.key === 'risk.take_profit_pct')
    const sizing = effects.find(effect => effect.key === 'position.sizing')

    expect(keys).not.toContain('risk.atr_take_profit')
    expect(takeProfit).toEqual(expect.objectContaining({
      key: 'risk.take_profit_pct',
      params: expect.objectContaining({ valuePct: 1.5, basis: 'entry_avg_price' }),
    }))
    expect(sizing).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        sizing: expect.objectContaining({ kind: 'ratio', value: 0.1, unit: 'ratio' }),
      }),
    }))
  })

  it('parses colloquial half and remaining partial take-profit tiers without treating trigger pct as close pct', () => {
    const patch = new GenericSeedDispatcher().dispatch('OKX 永续 BTCUSDT 15m。RSI14 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。')
    const effects = allEffectLeaves(patch)
    const partialTakeProfit = effects.find(effect => effect.key === 'risk.partial_take_profit')

    expect(effects.map(effect => effect.key)).not.toContain('risk.take_profit_pct')
    expect(partialTakeProfit).toEqual(expect.objectContaining({
      key: 'risk.partial_take_profit',
      params: expect.objectContaining({
        tiers: [
          { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 },
          { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 1 },
        ],
      }),
    }))
  })

  it('does not treat half-position entry wording as partial take-profit context', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 15m 半仓买入，止盈 10%。')
    const effects = allEffectLeaves(patch)

    expect(effects.map(effect => effect.key)).toContain('risk.take_profit_pct')
    expect(effects.map(effect => effect.key)).not.toContain('risk.partial_take_profit')
  })

  it('infers webhook sizing only from explicit amount evidence', () => {
    const text = STAGE1_TYPED_RULES_CORPUS.find(item => item.id === 'stage1-025-webhook-event')!.text
    const patch = new GenericSeedDispatcher().dispatch(text)
    const positions = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')

    expect(positions.length).toBeGreaterThan(0)
    expect(positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({ text: expect.stringContaining('100') }),
        }),
      ]),
    )
    expect(positions.map(position => position.evidence?.text?.toLowerCase())).not.toContain('u')
    expect(positions.map(position => position.evidence?.text)).not.toContain('用')
  })

  it('maps legacy risk phase effects into exit risk role', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h 跌破 MA20 止损 5%')
    const riskLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'risk.stop_loss_pct')

    expect(riskLeaves.length).toBeGreaterThan(0)
    expect(riskLeaves.some(effect => effect.rulePhase === 'exit')).toBe(true)
  })

  // Issue #1691 staging30 s28: 用户描述「下穿平仓」类纯出场动作时，
  // dispatcher 必须为 exit phase 注入 action.close_long / action.close_short fallback。
  // 否则 readiness.hasExit=false，前端持续追问 rulesTree.exit，触发 assistant_prompt_loop。
  it('infers exit close_long action when text expresses close intent without explicit verb', () => {
    const patch = new GenericSeedDispatcher().dispatch('SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断。')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).toContain('action.close_long')
  })

  it('infers exit close_short action for short-side close intent', () => {
    const patch = new GenericSeedDispatcher().dispatch('BTC 1h MA20 下穿 MA60 开空，上穿平空。')
    const exitRule = patch.rules?.find(rule => rule.phase === 'exit')

    expect(exitRule).toBeDefined()
    expect(ruleEffectKeys(exitRule!)).toContain('action.close_short')
  })

  it('does not treat exit price-change percentage as position sizing', () => {
    const patch = new GenericSeedDispatcher().dispatch('价格相对入场均价下跌 5% 时平仓。')
    const sizingLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')

    expect(sizingLeaves).toEqual([])
  })

  it('does not promote DCA drawdown percentage to top-level position sizing', () => {
    const patch = new GenericSeedDispatcher().dispatch('ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。')
    const positionSizingLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'position.sizing')
    const addPositionLeaves = allEffectLeaves(patch).filter(effect => effect.key === 'action.add_position')

    expect(positionSizingLeaves).toEqual([])
    expect(addPositionLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.objectContaining({
          sizing: expect.objectContaining({ kind: 'quote', value: 200, asset: 'USDT' }),
        }),
      }),
    ]))
  })
})
