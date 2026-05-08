import type { SemanticSupportClassification } from '../semantic-support-classifier.service'
import type { SemanticAtomContract, SemanticRiskState, SemanticState, SemanticTriggerState } from '../../types/semantic-state'
import { buildTriggerCombinationContract, normalizeSemanticStateCombinationContracts, normalizeTriggerCombinationContracts } from '../semantic-state-normalization'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { SemanticTriggerCombinationContractService } from '../semantic-trigger-combination-contract.service'

const extractor = new SemanticSeedExtractorService()
const builder = new SemanticSeedStateBuilderService()
const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
const projection = new SemanticStateProjectionService()
const combinationResolver = new SemanticTriggerCombinationContractService()

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

function expectCombinationContract(
  trigger: SemanticTriggerState,
  expected: { groupId: string, join: 'AND' | 'OR', actionKey: string },
): SemanticAtomContract {
  const contract = trigger.contracts?.find(candidate =>
    candidate.kind === 'trigger'
    && candidate.capabilities.some(capability =>
      capability.domain === 'market'
      && capability.verb === 'combine'
      && capability.object === 'predicate_group',
    ),
  )

  expect(contract).toEqual(expect.objectContaining({
    kind: 'trigger',
    params: expect.objectContaining({
      groupId: expected.groupId,
      join: expected.join,
      role: 'member',
      actionKey: expected.actionKey,
      actionBinding: 'single_action',
    }),
    capabilities: expect.arrayContaining([
      expect.objectContaining({
        domain: 'market',
        verb: 'combine',
        object: 'predicate_group',
        shape: expect.objectContaining({
          groupId: expected.groupId,
          join: expected.join,
          role: 'member',
          actionKey: expected.actionKey,
          actionBinding: 'single_action',
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? 'long',
        }),
      }),
    ]),
  }))

  if (!contract) {
    throw new Error(`semantic_combination_contract_missing:${expected.groupId}`)
  }

  return contract
}

function semanticStateWithTrigger(trigger: SemanticTriggerState): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [trigger],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-07T00:00:00.000Z',
  }
}

describe('atomic contract combination semantics', () => {
  it('builds a standard trigger combination contract helper', () => {
    const contract = buildTriggerCombinationContract({
      groupId: 'entry-ema-stack',
      join: 'AND',
      phase: 'entry',
      sideScope: 'long',
      actionKey: 'open_long',
    })

    expect(contract).toEqual(expect.objectContaining({
      kind: 'trigger',
      params: expect.objectContaining({
        groupId: 'entry-ema-stack',
        join: 'AND',
        role: 'member',
        actionKey: 'open_long',
        actionBinding: 'single_action',
      }),
      capabilities: expect.arrayContaining([
        expect.objectContaining({
          domain: 'market',
          verb: 'combine',
          object: 'predicate_group',
          shape: expect.objectContaining({
            groupId: 'entry-ema-stack',
            join: 'AND',
            role: 'member',
            actionKey: 'open_long',
            actionBinding: 'single_action',
            phase: 'entry',
            sideScope: 'long',
          }),
        }),
      ]),
    }))
  })

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
    expect(state.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ma',
          'reference.period': 20,
        }),
      }),
    ]))
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
    const summary = projection.buildClarificationView(state).summary
    expect(summary).toContain('连续 3 根 K 线收跌')
    expect(summary).toContain('成交量放大')
    expect(summary).toContain('反弹确认')
    expect(summary).not.toContain('condition.sequence')
    expect(summary).not.toContain('volume.relative_average')
    expect(summary).not.toContain('confirmation.rebound')
    expect(classification.route).toBe('open_slots')
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
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
    expect(state.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.cross_over',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'rsi',
          value: 35,
        }),
      }),
    ]))

    const rsiValues = state.triggers
      .filter(trigger => trigger.key.includes('rsi'))
      .map(trigger => trigger.params.value)
    expect(rsiValues).not.toContain(1)
    expect(projection.buildClarificationView(state).summary).not.toContain('RSI14 上穿 35')
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
    const exitTrigger = expectTrigger(state, {
      key: 'price.detect.indicator_boundary',
      phase: 'exit',
      sideScope: 'long',
      params: expect.objectContaining({
        boundaryRole: 'upper',
        indicator: expect.objectContaining({ name: 'bollinger' }),
        confirmationMode: 'touch',
      }),
    })
    expect(exitTrigger.openSlots).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: expect.stringContaining('confirmationMode') }),
    ]))
    const summary = projection.buildClarificationView(state).summary
    expect(summary).toContain('触及 BOLL 下轨（20, 2）')
    expect(summary).toContain('成交量高于过去 20 根均量的 1.5 倍')
    expect(summary).not.toMatch(/入场：触及 (?:BOLL|布林带).?下轨.*；入场：成交量/u)
    expect(JSON.stringify(state)).not.toContain('"slotKey":"contract.required"')
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
    const anyOfExit = expectTrigger(state, {
      key: 'logical.any_of',
      phase: 'exit',
      sideScope: 'long',
    })
    expectCombinationContract(anyOfExit, {
      groupId: 'exit-ma100-macd',
      join: 'OR',
      actionKey: 'close_long',
    })
    expect(state.triggers.filter(trigger => trigger.phase === 'exit')).toEqual([
      expect.objectContaining({ key: 'logical.any_of' }),
    ])
    const summary = projection.buildClarificationView(state).summary
    expect(summary).toContain('条件：价格在 MA100 上方')
    expect(summary).not.toContain('出场：价格在 MA100 上方')
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('emits standard AND contracts for EMA20/60/144 stack entry', () => {
    const { state, classification } = runPipeline('BTC 15分钟价格在 EMA20 EMA60 EMA144 上方做多。')

    const stackTriggers = [20, 60, 144].map((period) => {
      const trigger = state.triggers.find(candidate =>
        candidate.key === 'indicator.above'
        && candidate.phase === 'entry'
        && candidate.sideScope === 'long'
        && candidate.params.indicator === 'ema'
        && candidate.params['reference.period'] === period,
      )
      expect(trigger).toEqual(expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
      }))
      if (!trigger) {
        throw new Error(`semantic_trigger_missing:ema:${period}`)
      }
      return trigger
    })

    for (const trigger of stackTriggers) {
      expectCombinationContract(trigger, {
        groupId: 'entry-long-ema-above-stack-15m-20-60-144',
        join: 'AND',
        actionKey: 'open_long',
      })
    }
    expect(projection.buildConversationView(state).summary).toContain(
      '入场：15m 价格在 EMA20 / EMA60 / EMA144 上方时做多开仓',
    )
    expect(projection.buildConversationView(state).summary).not.toContain('条件：SMA60高于SMA144')
    expect(state.triggers.filter(trigger => trigger.phase === 'gate')).toEqual([])
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('emits standard AND contracts for arbitrary moving-average stack entries', () => {
    const { state, classification } = runPipeline('BTC 15分钟价格在 EMA10 EMA20 EMA50 上方做多。')
    const stackTriggers = [10, 20, 50].map((period) => {
      const trigger = state.triggers.find(candidate =>
        candidate.key === 'indicator.above'
        && candidate.phase === 'entry'
        && candidate.sideScope === 'long'
        && candidate.params.indicator === 'ema'
        && candidate.params['reference.period'] === period,
      )
      if (!trigger) {
        throw new Error(`semantic_trigger_missing:ema:${period}`)
      }
      return trigger
    })

    for (const trigger of stackTriggers) {
      expectCombinationContract(trigger, {
        groupId: 'entry-long-ema-above-stack-15m-10-20-50',
        join: 'AND',
        actionKey: 'open_long',
      })
    }
    expect(classification.route).not.toBe('unsupported_fallback')
  })

  it('normalizes legacy loose trigger group markers into standard contracts', () => {
    const [normalized] = normalizeTriggerCombinationContracts([{
      id: 'legacy-entry-volume',
      key: 'volume.relative_average',
      phase: 'entry',
      sideScope: 'long',
      params: {
        semanticGroupId: 'entry-confirmation-legacy',
        logic: 'and',
        actionKey: 'open_long',
        lookbackBars: 20,
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }])

    expect(normalized?.params).toEqual(expect.objectContaining({
      semanticGroupId: 'entry-confirmation-legacy',
      lookbackBars: 20,
    }))
    expectCombinationContract(normalized as SemanticTriggerState, {
      groupId: 'entry-confirmation-legacy',
      join: 'AND',
      actionKey: 'open_long',
    })
  })

  it('normalizes standard contracts from SemanticState loose atomic combination markers through the production flow', () => {
    const normalizedState = normalizeSemanticStateCombinationContracts(semanticStateWithTrigger({
      id: 'legacy-entry-rebound',
      key: 'confirmation.rebound',
      phase: 'entry',
      sideScope: 'long',
      params: {
        atomicCombinationId: 'entry-confirmation-atomic',
        conditionOperator: 'or',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))

    const [normalizedTrigger] = normalizedState.triggers
    expect(normalizedTrigger?.params).toEqual(expect.objectContaining({
      atomicCombinationId: 'entry-confirmation-atomic',
      conditionOperator: 'or',
    }))
    expectCombinationContract(normalizedTrigger as SemanticTriggerState, {
      groupId: 'entry-confirmation-atomic',
      join: 'OR',
      actionKey: 'open_long',
    })
  })

  it('keeps default combination action keys idempotent across repeated normalization', () => {
    const once = normalizeSemanticStateCombinationContracts(semanticStateWithTrigger({
      id: 'legacy-entry-both-fast',
      key: 'indicator.above',
      phase: 'entry',
      sideScope: 'both',
      params: {
        groupId: 'entry-both-stack',
        join: 'AND',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    const twice = normalizeSemanticStateCombinationContracts(once)
    const contract = twice.triggers[0]?.contracts?.find(candidate =>
      candidate.kind === 'trigger'
      && candidate.params.groupId === 'entry-both-stack',
    )

    expect(contract?.params).toEqual(expect.objectContaining({
      groupId: 'entry-both-stack',
      actionKey: 'open_long',
      actionKeySource: 'default',
    }))
  })

  it('preserves explicit actionKey from existing combination contracts without actionKeySource', () => {
    const normalizedState = normalizeSemanticStateCombinationContracts(semanticStateWithTrigger({
      id: 'existing-short-entry',
      key: 'indicator.below',
      phase: 'entry',
      sideScope: 'short',
      params: {
        groupId: 'entry-short-stack',
        join: 'AND',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [{
        id: 'legacy-contract-short-entry',
        kind: 'trigger',
        capabilities: [],
        requires: [],
        params: {
          groupId: 'entry-short-stack',
          join: 'AND',
          actionKey: 'open_short',
        },
        runtimeRequirements: [],
        stateRequirements: [],
        orderRequirements: [],
        openSlots: [],
      }],
    }))
    const contract = normalizedState.triggers[0]?.contracts?.find(candidate =>
      candidate.kind === 'trigger'
      && candidate.params.groupId === 'entry-short-stack',
    )

    expect(contract?.params).toEqual(expect.objectContaining({
      groupId: 'entry-short-stack',
      actionKey: 'open_short',
      actionKeySource: 'explicit',
    }))
  })

  it('upgrades existing standard-like legacy combination contracts without duplicating resolver members', () => {
    const normalizedState = normalizeSemanticStateCombinationContracts(semanticStateWithTrigger({
      id: 'legacy-entry-volume',
      key: 'volume.relative_average',
      phase: 'entry',
      sideScope: 'long',
      params: {
        groupId: 'entry-confirmation-existing',
        logic: 'and',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
      contracts: [{
        id: 'legacy-contract-entry-confirmation',
        kind: 'trigger',
        capabilities: [],
        requires: [],
        params: {
          groupId: 'entry-confirmation-existing',
          join: 'AND',
          legacyField: 'keep-me',
        },
        runtimeRequirements: [],
        stateRequirements: [],
        orderRequirements: [],
        openSlots: [],
      }],
    }))

    const [normalizedTrigger] = normalizedState.triggers
    const combinationLikeContracts = normalizedTrigger?.contracts?.filter(contract =>
      contract.kind === 'trigger'
      && typeof contract.params.groupId === 'string'
      && contract.params.groupId.length > 0,
    )
    expect(combinationLikeContracts).toHaveLength(1)
    expect(combinationLikeContracts?.[0]).toEqual(expect.objectContaining({
      id: 'legacy-contract-entry-confirmation',
      params: expect.objectContaining({
        groupId: 'entry-confirmation-existing',
        join: 'AND',
        legacyField: 'keep-me',
        role: 'member',
        actionKey: 'open_long',
        actionBinding: 'single_action',
      }),
    }))
    expectCombinationContract(normalizedTrigger as SemanticTriggerState, {
      groupId: 'entry-confirmation-existing',
      join: 'AND',
      actionKey: 'open_long',
    })

    const [group] = combinationResolver.resolveExecutableGroups([normalizedTrigger as SemanticTriggerState])
    expect(group?.members.map(member => member.id)).toEqual(['legacy-entry-volume'])
  })

  it('keeps standard group metadata out of ordinary trigger atom contract params', () => {
    const { state } = runPipeline('BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。')
    const sequenceTrigger = expectTrigger(state, {
      key: 'condition.sequence',
      phase: 'entry',
      sideScope: 'long',
    })

    const ordinaryAtomContracts = sequenceTrigger.contracts?.filter(contract =>
      contract.kind === 'trigger'
      && !contract.capabilities.some(capability =>
        capability.domain === 'market'
        && capability.verb === 'combine'
        && capability.object === 'predicate_group',
      ),
    )
    expect(sequenceTrigger.params.groupId).toBe('entry-atomic-confirmation-1')
    expect(ordinaryAtomContracts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        params: expect.not.objectContaining({
          groupId: expect.any(String),
        }),
      }),
    ]))
    expectCombinationContract(sequenceTrigger, {
      groupId: 'entry-atomic-confirmation-1',
      join: 'AND',
      actionKey: 'open_long',
    })

    const [group] = combinationResolver.resolveExecutableGroups([sequenceTrigger])
    expect(group?.members.map(member => member.id)).toEqual([sequenceTrigger.id])
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
        status: 'locked',
        openSlots: [],
      }),
    ]))
    expect(projection.buildClarificationView(state).summary).toContain('跌破记录位 breakout 止损')
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
    const summary = projection.buildClarificationView(state).summary
    expect(summary).toContain('2 倍 ATR 止损')
    expect(summary).toContain('3 倍 ATR 止盈')
    expect(classification.route).not.toBe('unsupported_fallback')
  })
})
