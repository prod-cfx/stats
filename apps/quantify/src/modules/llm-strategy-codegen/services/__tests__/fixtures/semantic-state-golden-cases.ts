import type { SemanticState, SemanticTriggerState } from '../../../types/semantic-state'

export const maGoldenCase = {
  message: 'OKX 现货 BTCUSDT 15m；入场：15m 收盘确认当价格突破 MA50 时买入；出场：15m 收盘确认当价格跌破 MA10 时卖出；风控：亏损 5% 止损，盈利 10% 止盈；仓位：单笔 10%。',
  expectedDigestPattern: /^sha256:/,
}

export const bollingerGoldenCase = {
  message: 'OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(30,2.5)上轨时做空；价格回到布林带中轨(MA30)时平空；单笔 10%。',
  expectedDigestPattern: /^sha256:/,
}

export type LockedAtomicStateName = 'bollinger-volume-entry' | 'breakout-retest' | 'atr-risk'

function lockedContextSlot(slotKey: string, fieldPath: string, value: string) {
  return {
    slotKey,
    fieldPath,
    value,
    status: 'locked' as const,
    priority: 'context' as const,
    questionHint: '',
    affectsExecution: true,
  }
}

function lockedTrigger(
  input: Pick<SemanticTriggerState, 'id' | 'key' | 'phase' | 'params'> & {
    sideScope?: SemanticTriggerState['sideScope']
  },
): SemanticTriggerState {
  return {
    ...input,
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
  }
}

function baseLockedAtomicState(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    triggers: [],
    actions: [
      { id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
    ],
    risk: [],
    position: {
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    contextSlots: {
      exchange: lockedContextSlot('exchange', 'contextSlots.exchange', 'okx'),
      symbol: lockedContextSlot('symbol', 'contextSlots.symbol', 'BTCUSDT'),
      marketType: lockedContextSlot('marketType', 'contextSlots.marketType', 'perp'),
      timeframe: lockedContextSlot('timeframe', 'contextSlots.timeframe', '1h'),
    },
    normalizationNotes: [],
    updatedAt: '2026-05-06T00:00:00.000Z',
  }
}

export function buildLockedAtomicState(name: LockedAtomicStateName): SemanticState {
  const state = baseLockedAtomicState()

  if (name === 'bollinger-volume-entry') {
    state.contextSlots.timeframe = lockedContextSlot('timeframe', 'contextSlots.timeframe', '15m')
    state.triggers = [
      lockedTrigger({
        id: 'entry-bollinger-lower-touch',
        key: 'price.detect.indicator_boundary',
        phase: 'entry',
        sideScope: 'long',
        params: {
          groupId: 'entry-bollinger-volume-confirmation',
          boundaryRole: 'lower',
          confirmationMode: 'touch',
          indicator: { name: 'bollinger', period: 20, stdDev: 2 },
        },
      }),
      lockedTrigger({
        id: 'entry-volume-relative-average',
        key: 'volume.relative_average',
        phase: 'entry',
        sideScope: 'long',
        params: {
          groupId: 'entry-bollinger-volume-confirmation',
          lookbackBars: 20,
          multiplier: 1.5,
          comparator: 'gt',
        },
      }),
      lockedTrigger({
        id: 'exit-bollinger-upper-touch',
        key: 'price.detect.indicator_boundary',
        phase: 'exit',
        sideScope: 'long',
        params: {
          boundaryRole: 'upper',
          confirmationMode: 'touch',
          indicator: { name: 'bollinger', period: 20, stdDev: 2 },
        },
      }),
    ]
    state.actions.push({ id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] })
    return state
  }

  if (name === 'breakout-retest') {
    state.triggers = [
      lockedTrigger({
        id: 'entry-breakout-retest',
        key: 'condition.sequence',
        phase: 'entry',
        sideScope: 'long',
        params: {
          sequenceKind: 'breakout_retest',
          lookbackWindow: '24h',
          memoryKey: 'breakout',
        },
      }),
    ]
    state.risk = [{
      id: 'risk-remembered-level-stop',
      key: 'risk.remembered_level_stop',
      params: { levelKey: 'breakout' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }]
    return state
  }

  state.triggers = [
    lockedTrigger({
      id: 'entry-ma-above',
      key: 'indicator.above',
      phase: 'entry',
      sideScope: 'long',
      params: {
        indicator: 'ma',
        referenceRole: 'trend',
        'reference.period': 20,
        reference: { indicator: 'ma', period: 20 },
      },
    }),
  ]
  state.risk = [
    {
      id: 'risk-atr-stop',
      key: 'risk.atr_multiple_stop',
      params: { multiple: 2 },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    {
      id: 'risk-atr-take-profit',
      key: 'risk.atr_multiple_take_profit',
      params: { multiple: 3 },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
  ]
  return state
}
