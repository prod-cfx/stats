import type { SemanticSlotState, SemanticState } from '../../types/semantic-state'
import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec-v2'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'
import { PlannerDispatcherMergeService } from '../planner-dispatcher-merge.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { collectAtomLeaves, listRuleEffects } from '../../types/atom-expr'

function buildBaseState(overrides: Partial<SemanticState>): SemanticState {
  return {
    version: 1,
    families: [],
    rules: [],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: {
      exchange: contextSlot('exchange', ''),
      symbol: contextSlot('symbol', ''),
      marketType: contextSlot('marketType', ''),
      timeframe: contextSlot('timeframe', ''),
    },
    normalizationNotes: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
    ...overrides,
  }
}

function contextSlot(slotKey: string, value: string): SemanticSlotState {
  return {
    slotKey,
    fieldPath: `contextSlots.${slotKey}`,
    value,
    status: 'locked',
    priority: 'context',
    questionHint: '',
    affectsExecution: true,
  }
}

describe('31-strategy rules tree main flow regressions', () => {
  it('fills missing grid rule params from same dispatcher atom without overwriting explicit planner params', () => {
    const plannerPatch: CodegenSemanticPatch = {
      rules: [{
        id: 'grid-range-stop',
        phase: 'entry',
        sideScope: 'both',
        condition: {
          kind: 'atom',
          key: 'grid.range_rebalance',
          params: { sideMode: 'both', breakoutAction: 'stop' },
        },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }
    const dispatcherPatch: CodegenSemanticPatch = {
      atoms: [
        {
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'both',
          params: {
            sideMode: 'both',
            recycle: 'true',
            breakoutAction: 'continue',
            centerOffsetPct: 0.4,
            levels: 10,
            perGridSizing: 10,
            perOrderSizing: { kind: 'quote', value: 10, asset: 'USDT' },
          },
        },
        {
          key: 'grid.range_rebalance',
          phase: 'entry',
          sideScope: 'both',
          params: { breakoutAction: 'stop' },
        },
      ],
    }

    const merged = new PlannerDispatcherMergeService().mergePlannerAndDispatcherPatches(plannerPatch, dispatcherPatch)
    const condition = merged?.rules?.[0]?.condition

    expect(condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'grid.range_rebalance',
      params: {
        sideMode: 'both',
        breakoutAction: 'stop',
        recycle: 'true',
        centerOffsetPct: 0.4,
        levels: 10,
        perGridSizing: 10,
        perOrderSizing: { kind: 'quote', value: 10, asset: 'USDT' },
      },
    }))
  })

  it('extracts recurring DCA and drawdown add sizing into structured main-flow atoms', () => {
    const patch = new GenericSeedDispatcher().dispatch('ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT')
    const effectLeaves = (patch.rules ?? []).flatMap(rule =>
      listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
    )
    const dcaAtom = effectLeaves.find(atom => atom.key === 'position.dca_schedule')
    const addAtom = effectLeaves.find(atom => atom.key === 'action.add_position')

    expect(dcaAtom?.params).toEqual(expect.objectContaining({
      triggerMode: 'time_interval',
      timeIntervalBars: 1,
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    }))
    expect(dcaAtom?.params).not.toHaveProperty('maxCount')
    expect(addAtom?.params).toEqual(expect.objectContaining({
      addMode: 'drawdown_pct',
      drawdownThreshold: 5,
      sizing: { kind: 'quote', value: 200, asset: 'USDT' },
    }))
  })

  it('preserves dispatcher DCA constraint when rebuilding rules tree fallback', () => {
    const text = 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)

    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const state = new SemanticSeedStateBuilderService().build(fallback, text)

    const dca = state?.position?.constraints?.find(item => item.key === 'position.dca_schedule')
    expect(dca?.params).toEqual(expect.objectContaining({
      triggerMode: 'time_interval',
      timeIntervalBars: 1,
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
    }))
  })

  it('compiles DCA schedule rules from rules tree into a per-order DCA entry', () => {
    const text = 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const state = new SemanticSeedStateBuilderService().build(fallback, text)
    const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected!)
    const dcaRule = spec.rules.find(rule =>
      rule.phase === 'entry'
      && rule.actions.some(action => action.type === 'ADD_LONG' && action.sizing?.mode === 'QUOTE' && action.sizing.value === 100),
    )

    expect(dcaRule).toBeDefined()
    expect(dcaRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'ADD_LONG',
        sizing: { mode: 'QUOTE', value: 100, asset: 'USDT' },
      }),
    ]))
  })

  it('binds dispatcher DCA schedule into planner on-start open rule', () => {
    const plannerPatch: CodegenSemanticPatch = {
      rules: [{
        id: 'entry-dca-daily',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'atom',
          key: 'execution.on_start',
          params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
        },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [],
          positions: [],
          orchestration: [],
          programs: [],
        },
      }],
    }
    const dispatcherPatch = new GenericSeedDispatcher().dispatch('ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT')

    const merged = new PlannerDispatcherMergeService().mergePlannerAndDispatcherPatches(plannerPatch, dispatcherPatch)
    const entryRule = merged?.rules?.find(rule =>
      listRuleEffects(rule.effects).some(effect => effect.kind === 'atom' && effect.key === 'position.dca_schedule'),
    )

    expect(listRuleEffects(entryRule?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.dca_schedule',
        params: expect.objectContaining({
          triggerMode: 'time_interval',
          perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
        }),
      }),
    ]))
  })

  it('keeps profit-triggered add-position out of take-profit exit flow in dispatcher fallback', () => {
    const text = 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const serializedRules = JSON.stringify(fallback?.rules)

    expect(serializedRules).toContain('action.add_position')
    expect(serializedRules).not.toContain('risk.take_profit_pct')
    expect(fallback?.position?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.pyramiding_limit',
        params: expect.objectContaining({ maxLayers: 3 }),
      }),
    ]))

    const addRule = fallback?.rules?.find(rule => JSON.stringify(rule.condition).includes('price.percent_change'))
    expect(listRuleEffects(addRule?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.add_position' }),
    ]))
    expect(JSON.stringify(addRule?.effects)).not.toContain('action.open_long')
  })

  it('does not duplicate fallback effects that differ only by inferred side scope', () => {
    const text = 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)

    const openRule = fallback?.rules?.find(rule => rule.condition.kind === 'atom' && rule.condition.key === 'price.breakout_up')
    const addRule = fallback?.rules?.find(rule => rule.condition.kind === 'atom' && rule.condition.key === 'price.percent_change')

    expect(listRuleEffects(openRule?.effects).filter(effect => effect.kind === 'atom' && effect.key === 'action.open_long')).toHaveLength(1)
    expect(listRuleEffects(addRule?.effects).filter(effect => effect.kind === 'atom' && effect.key === 'action.add_position')).toHaveLength(1)
  })

  it('uses dispatcher long-only verb evidence to remove planner hallucinated short reversal rules', () => {
    const text = 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出'
    const plannerPatch: CodegenSemanticPatch = {
      rules: [
        {
          id: 'entry-long-macd-cross-over',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
        {
          id: 'exit-long-and-reverse-short',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_under',
            params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
          effects: [
            { kind: 'atom', key: 'action.close_long', params: {} },
            { kind: 'atom', key: 'action.open_short', params: {} },
          ],
        },
        {
          id: 'exit-short-macd-cross-over',
          phase: 'exit',
          sideScope: 'short',
          condition: {
            kind: 'atom',
            key: 'indicator.cross_over',
            params: { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          },
          effects: [{ kind: 'atom', key: 'action.close_short', params: {} }],
        },
      ],
    }
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)

    const merged = new PlannerDispatcherMergeService().mergePlannerAndDispatcherPatches(plannerPatch, dispatcherPatch)
    const serializedRules = JSON.stringify(merged?.rules)

    expect(serializedRules).toContain('action.open_long')
    expect(serializedRules).toContain('action.close_long')
    expect(serializedRules).not.toContain('action.open_short')
    expect(serializedRules).not.toContain('action.close_short')
    expect(merged?.rules?.some(rule => rule.sideScope === 'short')).toBe(false)
  })

  it('allows lifecycle DCA open rules with state-only schedule predicates', () => {
    const spec: CanonicalStrategySpecV2 = {
      version: 2,
      market: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'spot',
        defaultTimeframe: '1d',
      },
      indicators: [],
      sizing: { mode: 'QUOTE', value: 100, asset: 'USDT' },
      executionPolicy: {
        signalTiming: 'BAR_CLOSE',
        fillTiming: 'NEXT_BAR_OPEN',
      },
      dataRequirements: {
        requiredTimeframes: ['1d'],
      },
      rules: [{
        id: 'entry-dca-daily',
        phase: 'entry',
        sideScope: 'long',
        priority: 200,
        condition: {
          kind: 'expression',
          op: 'EQ',
          left: { kind: 'series', source: 'bar', field: 'close' },
          right: { kind: 'constant', value: 1 },
        },
        actions: [{ type: 'OPEN_LONG', sizing: { mode: 'QUOTE', value: 100, asset: 'USDT' } }],
        metadata: {
          dcaSchedule: {
            maxCount: 365,
            capitalCap: 36500,
            stateKey: 'dca_order_count',
            triggerMode: 'time_interval',
            timeIntervalBars: 1,
          },
        },
      }],
    }

    expect(() => new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        baseTimeframe: '1d',
        positionPct: 10,
      },
    })).not.toThrow()
  })

  it('rebuilds a minimal legal rules tree from deterministic dispatcher when planner rules are rejected', () => {
    const text = 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带上轨时做空，触及/突破下轨时做多；单笔仓位 10%。'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)

    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)

    expect(fallback?.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      marketType: 'perp',
      timeframe: '15m',
    }))
    expect(fallback?.position?.sizing).toEqual(expect.objectContaining({
      kind: 'ratio',
      value: 0.1,
    }))
    expect(fallback).not.toHaveProperty('atoms')
    expect(fallback).not.toHaveProperty('triggers')
    expect(fallback).not.toHaveProperty('actions')
    expect(fallback).not.toHaveProperty('risk')
    expect(fallback).not.toHaveProperty('orchestration')
    expect(fallback?.rules?.length).toBeGreaterThanOrEqual(2)
    const shortEntry = fallback?.rules?.find(rule =>
      rule.phase === 'entry'
      && rule.sideScope === 'short'
      && rule.condition.kind === 'atom'
      && rule.condition.key === 'bollinger.touch_upper',
    )
    const longEntry = fallback?.rules?.find(rule =>
      rule.phase === 'entry'
      && rule.sideScope === 'long'
      && rule.condition.kind === 'atom'
      && rule.condition.key === 'bollinger.touch_lower',
    )
    expect(listRuleEffects(shortEntry?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_short' }),
    ]))
    expect(listRuleEffects(longEntry?.effects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.open_long' }),
    ]))
  })

  it('keeps volume.threshold relative-to-sma parameters from rules tree through canonical spec', () => {
    const state = buildBaseState({
      contextSlots: {
        exchange: contextSlot('exchange', 'okx'),
        symbol: contextSlot('symbol', 'ETHUSDT'),
        marketType: contextSlot('marketType', 'spot'),
        timeframe: contextSlot('timeframe', '15m'),
      },
      rules: [{
        id: 'entry-boll-volume',
        phase: 'entry',
        sideScope: 'long',
        condition: {
          kind: 'and',
          children: [
            { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
            { kind: 'atom', key: 'volume.threshold', params: { mode: 'relative_to_sma', multiplier: 1.5, refWindow: 20, timeframe: '15m' } },
          ],
        },
        effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      }],
    })
    const seeded = new SemanticRuleProjectionService().reprojectFromRules(state)

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(seeded)
    const volumeAtom = JSON.stringify(spec.rules)

    expect(volumeAtom).toContain('"mode":"relative_to_sma"')
    expect(volumeAtom).toContain('"multiplier":1.5')
    expect(volumeAtom).toContain('"refWindow":20')
  })

  it('keeps adaptive volatility grid program in canonical orchestration programs', () => {
    const state = buildBaseState({
      contextSlots: {
        exchange: contextSlot('exchange', 'okx'),
        symbol: contextSlot('symbol', 'SOLUSDT'),
        marketType: contextSlot('marketType', 'spot'),
        timeframe: contextSlot('timeframe', '30m'),
      },
      orchestration: [{
        id: 'adaptive-grid',
        kind: 'program',
        key: 'program.adaptive_volatility_grid',
        status: 'locked',
        programKind: 'adaptive_volatility_grid',
        activeWhenRef: 'range-gate',
        onDeactivate: 'close',
        rebuildPolicy: 'atr_window',
        atrPeriod: 14,
        atrMultiplier: 1,
        rangeMultiplier: 1,
        atrDriftPct: 5,
        rebuildCooldownSec: 300,
        minStepPct: 0.1,
        maxStepPct: 1,
        levelCount: 10,
        sizing: { mode: 'fixed_pct', value: 10 },
        params: {},
        source: 'user_explicit',
        evidence: { text: '启用自适应波动率网格', source: 'user_explicit' },
        openSlots: [],
        contracts: [],
      }],
    } as Partial<SemanticState>)

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(state)

    expect(spec.orchestration?.programs).toEqual([
      expect.objectContaining({
        id: 'adaptive-grid',
        programKind: 'adaptive_volatility_grid',
      }),
    ])
  })

  it('keeps compact multi-timeframe EMA confirmations through dispatcher fallback rules tree into canonical spec', () => {
    const text = '15min 1h 4h的价格都在ema20的上方买入 15min跌破ema20卖出 再币安交易所 btcusdt永续合约 单笔10%'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const state = new SemanticSeedStateBuilderService().build(fallback, text)
    const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null

    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected!)
    const entryRule = spec.rules.find(rule => rule.phase === 'entry')
    const exitRule = spec.rules.find(rule => rule.phase === 'exit')
    const entryChildren = entryRule?.condition.kind === 'AND' ? entryRule.condition.children : []
    const entryTimeframes = entryChildren
      .filter(child => child.kind === 'atom' && child.key === 'indicator.above')
      .map(child => child.kind === 'atom' ? child.params?.timeframe : undefined)
      .sort()

    expect(spec.market).toEqual(expect.objectContaining({
      exchange: 'binance',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      defaultTimeframe: '15m',
      timeframes: ['15m', '1h', '4h'],
    }))
    expect(spec.dataRequirements.requiredTimeframes).toEqual(['15m', '1h', '4h'])
    expect(entryTimeframes).toEqual(['15m', '1h', '4h'])
    expect(exitRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'indicator.below',
      params: expect.objectContaining({
        indicator: 'ema',
        'reference.period': 20,
      }),
    }))
  })

  it('keeps full OKX perp EMA cross wording through dispatcher fallback rules tree into canonical spec', () => {
    const text = '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const state = new SemanticSeedStateBuilderService().build(fallback, text)
    const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null
    const view = new SemanticStateProjectionService().buildConversationView(projected!)
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected!)

    const entryRule = spec.rules.find(rule => rule.phase === 'entry')
    const exitRule = spec.rules.find(rule => rule.phase === 'exit')

    expect(projected?.contextSlots.exchange?.value).toBe('okx')
    expect(projected?.contextSlots.symbol?.value).toBe('BTCUSDT')
    expect(projected?.contextSlots.marketType?.value).toBe('perp')
    expect(projected?.contextSlots.timeframe?.value).toBe('15m')
    expect(projected?.position?.sizing).toEqual({ kind: 'ratio', value: 0.1, unit: 'ratio' })
    expect(projected?.rules?.map(rule => rule.condition.kind === 'atom' ? rule.condition.key : '')).toEqual(expect.arrayContaining([
      'indicator.cross_over',
      'indicator.cross_under',
    ]))
    expect(entryRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'ma.golden_cross',
      op: 'CROSS_OVER',
      params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
    }))
    expect(exitRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'ma.death_cross',
      op: 'CROSS_UNDER',
      params: expect.objectContaining({ indicator: 'ema', fastPeriod: 7, slowPeriod: 21 }),
    }))
    expect(entryRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'OPEN_LONG' }),
    ]))
    expect(exitRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CLOSE_LONG' }),
    ]))
    expect(view.summary).toContain('EMA7 上穿 EMA21')
    expect(view.summary).toContain('EMA7 下穿 EMA21')
  })

  it('keeps trend filter plus MA pullback reclaim as ordinary rules without orchestration exposure cap', () => {
    const text = 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓，仓位10%'
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const fallback = new PlannerDispatcherMergeService().buildRulesTreeFallbackFromDispatcher(dispatcherPatch, text)
    const state = new SemanticSeedStateBuilderService().build(fallback, text)
    const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null
    const view = new SemanticStateProjectionService().buildConversationView(projected!)
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected!)

    const serializedRules = JSON.stringify(projected?.rules)
    const entryRule = projected?.rules?.find(rule =>
      rule.phase === 'entry'
      && JSON.stringify(rule.condition).includes('condition.sequence')
      && JSON.stringify(rule.condition).includes('indicator.above')
      && listRuleEffects(rule.effects).some(effect => JSON.stringify(effect).includes('action.open_long')),
    )
    const exitRule = spec.rules.find(rule => rule.phase === 'exit')

    expect(projected?.contextSlots.symbol?.value).toBe('ETHUSDT')
    expect(projected?.contextSlots.timeframe?.value).toBe('1d')
    expect(projected?.position?.sizing).toEqual({ kind: 'ratio', value: 0.1, unit: 'ratio' })
    expect(serializedRules).toContain('condition.sequence')
    expect(serializedRules).toContain('pullback_reclaim')
    expect(serializedRules).toContain('indicator.above')
    expect(serializedRules).toContain('indicator.below')
    expect(serializedRules).not.toContain('portfolioRisk.substrategy_exposure_cap')
    expect(projected?.orchestration).toHaveLength(0)
    expect(entryRule).toBeDefined()
    expect(exitRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'indicator.below',
      params: expect.objectContaining({
        indicator: 'ma',
        'reference.period': 120,
      }),
    }))
    expect(view.summary).toContain('MA120')
    expect(view.summary).toContain('MA20')
  })

  it('lets dispatcher composite rules override planner orchestration hallucination for long-only pullback reclaim', () => {
    const text = 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入,ETH 日线在 MA120 下方时平仓，仓位10%'
    const plannerPatch: CodegenSemanticPatch = {
      rules: [
        {
          id: 'planner-gate-long-ma120-above',
          phase: 'gate',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.above',
            params: { indicator: 'ma', 'reference.period': 120 },
            evidence: { text: 'ETH 日线在 MA120 上方时' },
          },
          effects: [{
            kind: 'atom',
            key: 'portfolioRisk.substrategy_exposure_cap',
            params: { mode: 'enforce', notionalCapPct: 100, effectWhenTriggered: 'block_new_entries' },
          }],
          evidence: { text: 'ETH 日线在 MA120 上方时' },
        },
        {
          id: 'planner-exit-ma120-below',
          phase: 'exit',
          sideScope: 'long',
          condition: {
            kind: 'atom',
            key: 'indicator.below',
            params: { indicator: 'ma', 'reference.period': 120 },
            evidence: { text: 'ETH 日线在 MA120 下方时平仓' },
          },
          effects: [{ kind: 'atom', key: 'action.close_long', params: {} }],
          evidence: { text: 'ETH 日线在 MA120 下方时平仓' },
        },
      ],
    }
    const dispatcherPatch = new GenericSeedDispatcher().dispatch(text)
    const merged = new PlannerDispatcherMergeService().mergePlannerAndDispatcherPatches(plannerPatch, dispatcherPatch)
    const state = new SemanticSeedStateBuilderService().build(merged!, text)
    const projected = new SemanticRuleProjectionService().reprojectFromRules(state)
    const view = new SemanticStateProjectionService().buildConversationView(projected)
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected)
    const serializedRules = JSON.stringify(projected.rules)

    expect(serializedRules).toContain('condition.sequence')
    expect(serializedRules).toContain('pullback_reclaim')
    expect(view.summary).toContain('MA20')
    expect(serializedRules).not.toContain('portfolioRisk.substrategy_exposure_cap')
    expect(projected.orchestration).toHaveLength(0)
    expect(spec.rules.find(rule => rule.phase === 'entry')?.condition).toEqual(expect.objectContaining({
      kind: 'AND',
    }))
    expect(spec.rules.find(rule => rule.phase === 'exit')?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CLOSE_LONG' }),
    ]))
  })

  it('renders rules-tree MA period params in pullback reclaim summaries', () => {
    const state = buildBaseState({
      rules: [
        {
          id: 'entry-ma120-ma20-pullback',
          phase: 'entry',
          sideScope: 'long',
          condition: {
            kind: 'and',
            children: [
              { kind: 'atom', key: 'indicator.above', params: { indicator: 'ma', period: 120, timeframe: '1d' } },
              {
                kind: 'sequence',
                steps: [
                  { kind: 'atom', key: 'indicator.below', params: { indicator: 'ma', period: 20, timeframe: '1d' } },
                  { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ma', period: 20, timeframe: '1d' } },
                ],
              },
            ],
          },
          effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        },
      ],
    })
    const view = new SemanticStateProjectionService().buildConversationView(state)

    expect(view.summary).toContain('价格在 MA120 上方')
    expect(view.summary).toContain('回踩 MA20 后重新站上')
    expect(view.summary).not.toContain('指标高于阈值')
    expect(view.summary).not.toContain('MA短周期')
  })

  it('normalizes planner duplicated centered-percent grid rules into one executable grid program', () => {
    const text = 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各0.4%共10格、每格10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”'
    const gridParams = {
      rangeLower: 0,
      rangeUpper: 0,
      centerOffsetPct: 0.4,
      levels: 10,
      sideMode: 'both',
      breakoutAction: 'stop',
      stepPct: 0.08,
      perGridSizing: 10,
      perOrderSizing: { kind: 'quote', value: 10, asset: 'USDT' },
    }
    const plannerPatch: CodegenSemanticPatch = {
      contextSlots: {
        exchange: 'okx',
        symbol: 'ETHUSDT',
        marketType: 'spot',
        timeframe: '1m',
      },
      position: {
        mode: 'fixed_quote',
        value: 10,
        positionMode: 'long_only',
        sizing: { kind: 'quote', value: 10, asset: 'USDT' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      rules: [
        {
          id: 'planner-grid-entry',
          phase: 'entry',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'grid.range_rebalance', params: gridParams },
          effects: [{ kind: 'atom', key: 'grid.range_rebalance', params: gridParams }],
        },
        {
          id: 'planner-grid-exit',
          phase: 'exit',
          sideScope: 'both',
          condition: { kind: 'atom', key: 'grid.range_rebalance', params: gridParams },
          effects: [{ kind: 'atom', key: 'grid.range_rebalance', params: gridParams }],
        },
      ],
    }

    const state = new SemanticSeedStateBuilderService().build(plannerPatch, text)
    const projected = state ? new SemanticRuleProjectionService().reprojectFromRules(state) : null
    const view = new SemanticStateProjectionService().buildConversationView(projected!)
    const spec = new CanonicalSpecBuilderService().buildFromSemanticState(projected!)

    expect(projected?.rules?.filter(rule => JSON.stringify(rule).includes('grid.range_rebalance'))).toHaveLength(1)
    expect(view.summary).toContain('网格区间再平衡')
    expect(view.summary).toContain('中心上下各 0.4%')
    expect(view.summary).toContain('共 10 格')
    expect(view.summary).not.toContain('区间 0-0')
    expect(view.summary).not.toContain('出场：网格区间再平衡')
    expect(spec.orderPrograms?.[0]).toEqual(expect.objectContaining({
      kind: 'contract_order_program',
      mode: 'spot',
      orderType: 'limit',
      recycleOnFill: true,
      cancelOnStop: true,
      budget: { mode: 'per_order_quote', value: 10, asset: 'USDT' },
      levelSet: expect.objectContaining({
        mode: 'centered_percent_range',
        centerTiming: 'deployment',
        centerSource: 'last_price',
        halfRangePct: 0.4,
        gridCount: 10,
        spacingPct: 0.08,
      }),
    }))
  })
})
