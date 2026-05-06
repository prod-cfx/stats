import type { SemanticSupportClassification } from '../semantic-support-classifier.service'
import type { SemanticRiskState, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const extractor = new SemanticSeedExtractorService()
const builder = new SemanticSeedStateBuilderService()
const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

interface PipelineResult {
  state: SemanticState
  classification: SemanticSupportClassification
}

function runPipeline(message: string): PipelineResult {
  const patch = extractor.extract(message)
  const state = builder.build(patch)

  expect(state).not.toBeNull()
  if (!state) {
    throw new Error('semantic_state_build_failed')
  }

  const classification = classifier.classify(state)

  return {
    state: classification.state,
    classification,
  }
}

function expectTrigger(
  state: SemanticState,
  expected: Partial<SemanticTriggerState> & Pick<SemanticTriggerState, 'key' | 'phase'>,
): SemanticTriggerState {
  const trigger = state.triggers.find(candidate => (
    candidate.key === expected.key
    && candidate.phase === expected.phase
    && (!expected.sideScope || candidate.sideScope === expected.sideScope)
  ))

  if (!trigger) {
    throw new Error(`semantic_trigger_missing:${expected.key}:${expected.phase}`)
  }
  expect(trigger).toEqual(expect.objectContaining(expected))

  return trigger
}

function expectTriggerOpenSlot(trigger: SemanticTriggerState, slotKey: string): void {
  expect(trigger.openSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({
      slotKey,
      status: 'open',
      affectsExecution: true,
    }),
  ]))
}

function expectRiskOpenSlot(risk: SemanticRiskState, slotKey: string): void {
  expect(risk.openSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({
      slotKey,
      status: 'open',
      affectsExecution: true,
    }),
  ]))
}

describe('atomic contract combination semantics', () => {
  it('extracts rolling extrema breakout entry and exit contracts', () => {
    const { state, classification } = runPipeline('BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。')

    expect(classification.route).not.toBe('unsupported_fallback')
    expectTrigger(state, {
      key: 'price.rolling_extrema_breakout',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        extrema: 'high',
        lookbackBars: 20,
        event: 'breakout_up',
      }),
    })
    expectTrigger(state, {
      key: 'price.rolling_extrema_breakout',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({
        extrema: 'low',
        lookbackBars: 10,
        event: 'breakout_down',
      }),
    })
    expect(state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(state.contextSlots.symbol).toEqual(expect.objectContaining({ value: 'BTCUSDT', status: 'locked' }))
    expect(state.contextSlots.timeframe).toEqual(expect.objectContaining({ value: '4h', status: 'locked' }))
  })

  it('extracts MA trend gate and MA20 pullback reclaim entry sequence', () => {
    const { state, classification } = runPipeline('ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。')

    expect(classification.route).not.toBe('unsupported_fallback')
    expectTrigger(state, {
      key: 'condition.expression',
      phase: 'gate',
    })
    expectTrigger(state, {
      key: 'condition.sequence',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        sequenceKind: 'pullback_reclaim',
        reference: expect.objectContaining({
          indicator: 'ma',
          period: 20,
        }),
      }),
    })
    expect(state.contextSlots.symbol).toEqual(expect.objectContaining({ value: 'ETHUSDT', status: 'locked' }))
    expect(state.contextSlots.timeframe).toEqual(expect.objectContaining({ value: '1d', status: 'locked' }))
  })

  it('routes dip-buying with falling-knife guard and rebound confirmation through open slots', () => {
    const { state, classification } = runPipeline('我想在大跌后抄底，但不要接飞刀，反弹确认后再买。')

    const percentChangeTrigger = expectTrigger(state, {
      key: 'price.percent_change',
      phase: 'gate',
      sideScope: 'long',
      params: expect.objectContaining({ direction: 'down' }),
    })
    const reboundTrigger = expectTrigger(state, {
      key: 'confirmation.rebound',
      phase: 'entry',
      sideScope: 'long',
    })
    const fallingKnifeRisk = state.risk.find(risk => risk.key === 'risk.falling_knife_guard')
    expect(fallingKnifeRisk).toEqual(expect.objectContaining({ key: 'risk.falling_knife_guard' }))
    if (!fallingKnifeRisk) {
      throw new Error('semantic_risk_missing:risk.falling_knife_guard')
    }
    expect(state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expectTriggerOpenSlot(percentChangeTrigger, 'trigger.percent_change.magnitude')
    expectTriggerOpenSlot(reboundTrigger, 'trigger.confirmation.rebound_definition')
    expectRiskOpenSlot(fallingKnifeRisk, 'risk.falling_knife_guard.definition')
    expect(classification.route).toBe('open_slots')
  })

  it('extracts consecutive down candles followed by volume rebound with sizing slot', () => {
    const { state, classification } = runPipeline('BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。')

    expectTrigger(state, {
      key: 'condition.sequence',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        sequenceKind: 'consecutive_candles',
        count: 3,
        direction: 'down',
      }),
    })
    expectTrigger(state, {
      key: 'volume.relative_average',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ event: 'spike' }),
    })
    expectTrigger(state, {
      key: 'confirmation.rebound',
      phase: 'entry',
      sideScope: 'long',
    })
    expect(state.position?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        status: 'open',
        affectsExecution: true,
      }),
    ]))
    expect(classification.route).toBe('open_slots')
  })

  it('keeps RSI reclaim semantics distinct from MA50 over MA200 gate', () => {
    const { state, classification } = runPipeline('BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。')

    expectTrigger(state, {
      key: 'condition.expression',
      phase: 'gate',
    })
    expectTrigger(state, {
      key: 'condition.sequence',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        sequenceKind: 'rsi_reclaim',
        threshold: 35,
      }),
    })
    expectTrigger(state, {
      key: 'oscillator.rsi_gte',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({ value: 65 }),
    })

    const rsiValues = state.triggers
      .filter(trigger => trigger.key.includes('rsi'))
      .map(trigger => trigger.params.value)
    expect(rsiValues).not.toContain(1)
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('combines Bollinger lower boundary entry with relative average volume confirmation', () => {
    const { state, classification } = runPipeline('ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。')

    expectTrigger(state, {
      key: 'price.detect.indicator_boundary',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        boundaryRole: 'lower',
        indicator: expect.objectContaining({ name: 'bollinger' }),
      }),
    })
    expectTrigger(state, {
      key: 'volume.relative_average',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        lookbackBars: 20,
        multiplier: 1.5,
      }),
    })
    expectTrigger(state, {
      key: 'price.detect.indicator_boundary',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({
        boundaryRole: 'upper',
        indicator: expect.objectContaining({ name: 'bollinger' }),
      }),
    })
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('extracts MA100 gate, MACD entry and logical any-of exits', () => {
    const { state, classification } = runPipeline('SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。')

    expectTrigger(state, {
      key: 'indicator.above',
      phase: 'gate',
      params: expect.objectContaining({
        indicator: 'ma',
        referenceRole: 'long_term',
        'reference.period': 100,
        reference: expect.objectContaining({
          indicator: 'ma',
          period: 100,
        }),
      }),
    })
    expectTrigger(state, {
      key: 'indicator.cross_over',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ indicator: 'macd' }),
    })
    expectTrigger(state, {
      key: 'logical.any_of',
      phase: 'exit',
      sideScope: 'long',
    })
    expect(state.triggers.filter(trigger => trigger.phase === 'exit')).toEqual([
      expect.objectContaining({ key: 'logical.any_of' }),
    ])
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('keeps breakout retest sequence and remembered breakout level stop together', () => {
    const { state, classification } = runPipeline('BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。')

    expectTrigger(state, {
      key: 'condition.sequence',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({
        sequenceKind: 'breakout_retest',
        lookbackWindow: '24h',
      }),
    })
    expect(state.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.remembered_level_stop',
        params: expect.objectContaining({ levelKey: 'breakout' }),
      }),
    ]))
    expect(classification.route).toBe('open_slots')
  })

  it('extracts ATR multiple stop and take-profit risk semantics', () => {
    const { state, classification } = runPipeline('ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈')

    expect(state.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.atr_multiple_stop',
        params: expect.objectContaining({ multiple: 2 }),
      }),
      expect.objectContaining({
        key: 'risk.atr_multiple_take_profit',
        params: expect.objectContaining({ multiple: 3 }),
      }),
    ]))
    expect(classification.route).not.toBe('unsupported_fallback')
  })
})
