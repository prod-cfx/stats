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
    trigger: [],
    action: [
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
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
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
  const base = baseLockedAtomicState()

  if (name === 'bollinger-volume-entry') {
    return {
      ...base,
      contextSlots: {
        ...base.contextSlots,
        timeframe: lockedContextSlot('timeframe', 'contextSlots.timeframe', '15m'),
      },
      trigger: [
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
      ],
      action: [
        ...base.action,
        { id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
    }
  }

  if (name === 'breakout-retest') {
    return {
      ...base,
      trigger: [
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
      ],
      risk: [{
        id: 'risk-remembered-level-stop',
        key: 'risk.remembered_level_stop',
        params: { levelKey: 'breakout' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
    }
  }

  return {
    ...base,
    trigger: [
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
    ],
    risk: [
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
    ],
  }
}
