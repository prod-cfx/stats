/**
 * Issue #1279 PR3c.11 — InternalKeyLeakGuard 0 命中验证
 *
 * AC-4 收口验证：semantic-state-projection.service.ts 输出的公开文本
 * （conversation summary / trigger summary / risk summary）不泄露任何
 * 内部 atom key（由 InternalKeyLeakGuardService 扫描）。
 *
 * 覆盖：
 *   - ATOM_CONTRACT_REGISTRY 中全部 35 个 atom 对应的 trigger/risk/action states
 *   - 每个 atom 生成最小 SemanticState，调用 buildConversationView()
 *   - 对 summary / triggerSummary / riskSummary 文本执行 leak guard scan
 *   - 断言 0 命中（不泄露内部 atom key 字面量）
 *
 * 无需 DB / 外部服务：SemanticStateProjectionService + InternalKeyLeakGuardService
 * 均无 NestJS DI 外部依赖，可直接 new 实例化。
 */
import type { SemanticPositionConstraintKey, SemanticState } from '../../types/semantic-state'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { InternalKeyLeakGuardService } from '../../nl-gateway/internal-key-leak-guard/internal-key-leak-guard'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeEmptyState(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: new Date().toISOString(),
  }
}

function makeTriggerState(
  key: string,
  phase: 'entry' | 'exit' = 'entry',
  params: Record<string, unknown> = {},
): SemanticState['triggers'][number] {
  return {
    id: `t-${key}`,
    key,
    phase,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

function makeRiskState(
  key: string,
  params: Record<string, unknown> = {},
): SemanticState['risk'][number] {
  return {
    id: `r-${key}`,
    key,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

function makeActionState(
  key: string,
  params: Record<string, unknown> = {},
): SemanticState['actions'][number] {
  return {
    id: `a-${key}`,
    key,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// test setup
// ─────────────────────────────────────────────────────────────────────────────

const projection = new SemanticStateProjectionService()
const leakGuard = new InternalKeyLeakGuardService()

function extractTexts(state: SemanticState): string[] {
  const view = projection.buildConversationView(state)
  return [
    view.summary,
    view.triggerSummary,
    view.riskSummary,
    view.positionSummary,
  ].filter((t): t is string => typeof t === 'string' && t.length > 0)
}

function assertNoLeaks(texts: string[], label: string): void {
  for (const text of texts) {
    const findings = leakGuard.scan(text, { surface: label })
    expect(findings).toHaveLength(0)
    if (findings.length > 0) {
      throw new Error(
        `InternalKeyLeakGuard 命中 [${label}]: ${findings.map(f => `${f.key}@${f.path}`).join(', ')}\n文本: ${text}`,
      )
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// trigger atom params fixtures（为有 slot 要求的 atom 补足最小 params）
// ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_PARAMS: Record<string, Record<string, unknown>> = {
  'indicator.above': { indicator: 'MA', 'reference.period': 20 },
  'indicator.below': { indicator: 'MA', 'reference.period': 20 },
  'indicator.cross_over': { indicator: 'MA', fastPeriod: 5, slowPeriod: 20 },
  'indicator.cross_under': { indicator: 'MA', fastPeriod: 5, slowPeriod: 20 },
  'indicator.divergence': { indicator: 'MACD' },
  'bollinger.touch_upper': { period: 20, stdDev: 2 },
  'bollinger.touch_lower': { period: 20, stdDev: 2 },
  'bollinger.touch_middle': { period: 20, stdDev: 2 },
  'price.detect.indicator_boundary': { indicator: { name: 'bollinger', period: 20, stdDev: 2 }, boundaryRole: 'upper' },
  'price.percent_change': { valuePct: -3, basis: 'prev_close' },
  'price.range_position_lte': { lookbackBars: 20, thresholdPct: 20 },
  'price.range_position_gte': { lookbackBars: 20, thresholdPct: 80 },
  'price.breakout_up': { period: 20, bufferPct: 0.5 },
  'price.breakout_down': { period: 20, bufferPct: 0.5 },
  'price.candle_pattern': { pattern: 'hammer' },
  'price.chart_pattern': { pattern: 'head_and_shoulders' },
  'oscillator.rsi_gte': { value: 70 },
  'oscillator.rsi_lte': { value: 30 },
  'grid.range_rebalance': { lower: 90000, upper: 110000, stepPct: 1 },
  'market.regime': { regime: 'bull' },
  'trend.direction': { direction: 'up' },
  'volatility.state': { state: 'high' },
  'volatility.atr_threshold': { multiplier: 2 },
  'volume.threshold': { threshold: 1000000 },
  'liquidity.sweep': { side: 'buy' },
  'strategy.time_window': { start: '09:00', end: '17:00' },
  'external.signal': { provider: 'tradingview' },
  'position.has_position': {},
  'position.no_position': {},
  'execution.on_start': {},
  'reference.period': { period: 20 },
}

// ─────────────────────────────────────────────────────────────────────────────
// tests
// ─────────────────────────────────────────────────────────────────────────────

describe('InternalKeyLeakGuard — projection output 0 命中', () => {
  describe('trigger atom 逐 key 扫描', () => {
    const triggerKeys = Object.keys(ATOM_CONTRACT_REGISTRY)
      .filter(k => {
        const bucket = ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket
        return bucket === 'trigger'
      })

    for (const key of triggerKeys) {
      it(`trigger key=${key} 无 internal key 泄漏`, () => {
        const params = TRIGGER_PARAMS[key] ?? {}
        const state: SemanticState = {
          ...makeEmptyState(),
          triggers: [makeTriggerState(key, 'entry', params)],
          actions: [makeActionState('action.open_long')],
        }
        const texts = extractTexts(state)
        assertNoLeaks(texts, `trigger:${key}`)
      })
    }
  })

  describe('risk atom 逐 key 扫描', () => {
    const riskKeys = Object.keys(ATOM_CONTRACT_REGISTRY)
      .filter(k => {
        const bucket = ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket
        return bucket === 'risk'
      })

    for (const key of riskKeys) {
      it(`risk key=${key} 无 internal key 泄漏`, () => {
        const params = key === 'risk.partial_take_profit'
          ? { tiers: [{ trigger: { threshold: 5 }, reduceRatio: 0.5 }] }
          : { valuePct: 5 }
        const state: SemanticState = {
          ...makeEmptyState(),
          triggers: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          actions: [makeActionState('action.open_long')],
          risk: [makeRiskState(key, params)],
        }
        const texts = extractTexts(state)
        assertNoLeaks(texts, `risk:${key}`)
      })
    }
  })

  describe('action atom 逐 key 扫描', () => {
    const actionKeys = Object.keys(ATOM_CONTRACT_REGISTRY)
      .filter(k => {
        const bucket = ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket
        return bucket === 'action'
      })

    for (const key of actionKeys) {
      it(`action key=${key} 无 internal key 泄漏`, () => {
        const state: SemanticState = {
          ...makeEmptyState(),
          triggers: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          actions: [makeActionState(key)],
        }
        const texts = extractTexts(state)
        assertNoLeaks(texts, `action:${key}`)
      })
    }
  })

  describe('position atom 逐 key 扫描', () => {
    const positionKeys = Object.keys(ATOM_CONTRACT_REGISTRY)
      .filter(k => {
        const bucket = ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket
        return bucket === 'positionConstraint'
      })

    for (const key of positionKeys) {
      it(`position key=${key} 无 internal key 泄漏`, () => {
        const params = key === 'position.pyramiding_limit' ? { maxLayers: 3 }
          : key === 'position.dca_schedule' ? { maxCount: 3 }
          : {}
        const state: SemanticState = {
          ...makeEmptyState(),
          triggers: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          actions: [makeActionState('action.open_long')],
          position: {
            sizing: null,
            mode: 'flat',
            value: 0,
            positionMode: 'oneway',
            status: 'locked' as const,
            source: 'user_explicit' as const,
            constraints: [
              {
                id: `pc-${key}`,
                key: key as SemanticPositionConstraintKey,
                status: 'locked',
                source: 'user_explicit' as const,
                params,
                openSlots: [],
              },
            ],
          },
        }
        const texts = extractTexts(state)
        assertNoLeaks(texts, `position:${key}`)
      })
    }
  })

  it('空状态不泄漏', () => {
    const texts = extractTexts(makeEmptyState())
    assertNoLeaks(texts, 'empty-state')
  })

  it('多 trigger 组合状态不泄漏', () => {
    const state: SemanticState = {
      ...makeEmptyState(),
      triggers: [
        makeTriggerState('indicator.above', 'entry', { indicator: 'MA', 'reference.period': 20 }),
        makeTriggerState('price.detect.indicator_boundary', 'entry', { indicator: { name: 'bollinger', period: 20, stdDev: 2 }, boundaryRole: 'upper' }),
        makeTriggerState('execution.on_start', 'exit'),
      ],
      actions: [makeActionState('action.open_long'), makeActionState('action.close_long')],
      risk: [makeRiskState('risk.partial_take_profit', { tiers: [{ trigger: { threshold: 5 }, reduceRatio: 0.5 }] })],
    }
    const texts = extractTexts(state)
    assertNoLeaks(texts, 'multi-trigger-combo')
  })
})
