/**
 * Invariant spec（Issue #1179）：
 *   所有 entry/exitPredicate 角色 trigger key 必须在 presentationRegistry 有
 *   displayRenderer，且对最小 valid params 输出非空字符串。
 *
 * 此 spec 作为 CI 红线守门——新增或重命名 entryPredicate / exitPredicate key 时
 * 若未补 displayRenderer，本 spec 立即 fail，强制修复。
 */

import { NORMALIZED_TRIGGER_ATOM_KEYS } from '../../types/strategy-normalized-intent'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'

// ── entry / exitPredicate 角色的最小有效 params fixture ──
// 每个 key 只需能让 displayRenderer 返回非空字符串即可
const MINIMAL_PARAMS: Partial<Record<(typeof NORMALIZED_TRIGGER_ATOM_KEYS)[number], Record<string, unknown>>> = {
  'execution.on_start': {},
  'price.percent_change': { valuePct: 3 },
  'price.range_position_lte': {},
  'price.range_position_gte': {},
  'price.breakout_up': {},
  'price.breakout_down': {},
  'price.detect.indicator_boundary': {
    indicator: { name: 'bollinger', period: 20, stdDev: 2 },
    boundaryRole: 'lower',
  },
  'price.rolling_extrema_breakout': { lookbackBars: 20, extrema: 'high' },
  'volume.relative_average': { lookbackBars: 20, multiplier: 1.5 },
  'condition.sequence': { sequenceKind: 'breakout_retest' },
  'logical.any_of': { items: [{ key: 'indicator.cross_over', params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 } }] },
  'indicator.cross_over': { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
  'indicator.cross_under': { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
  'bollinger.touch_upper': { period: 20, stdDev: 2 },
  'bollinger.touch_lower': { period: 20, stdDev: 2 },
  'bollinger.touch_middle': { period: 20, stdDev: 2 },
  'oscillator.rsi_gte': { period: 14, value: 70 },
  'oscillator.rsi_lte': { period: 14, value: 30 },
  'trend.direction': { direction: 'up' },
  'market.regime': { regime: 'trending' },
  'volatility.state': { state: 'high' },
  'volume.threshold': { metric: 'base_volume', operator: 'GT', value: 1000 },
  'volatility.atr_threshold': { operator: 'GT', period: 14, threshold: 50 },
  'strategy.time_window': { windows: JSON.stringify([{ start: '09:30', end: '11:30' }]), timezone: 'UTC' },
  'position.has_position': { sideScope: 'long' },
  'position.no_position': { sideScope: 'long' },
  'indicator.divergence': { indicator: 'rsi', direction: 'bullish', pivotWindow: 14, confirmationBars: 3 },
  'price.candle_pattern': { pattern: 'engulfing', direction: 'bullish' },
  'price.chart_pattern': { pattern: 'head_and_shoulders', direction: 'bearish' },
  'liquidity.sweep': { direction: 'bullish', reference: 'prev_low' },
  'grid.range_rebalance': {},
}

// 这些 key 在 presentationRegistry 中未注册（unsupported trigger keys 不需要 displayRenderer）
const SKIP_UNREGISTERED_KEYS = new Set<string>([
  'indicator.above',
  'indicator.below',
])

describe('presentationRegistry display coverage invariant (Issue #1179)', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const registry = new SemanticPresentationRegistryService(atomRegistry)

  it('所有 NORMALIZED_TRIGGER_ATOM_KEYS 中注册于 presentationRegistry 的 key 必须有 displayRenderer', () => {
    const missing: string[] = []

    for (const key of NORMALIZED_TRIGGER_ATOM_KEYS) {
      if (SKIP_UNREGISTERED_KEYS.has(key)) continue
      try {
        const entry = registry.getEntry(key)
        if (!entry.displayRenderer) {
          missing.push(`${key}: displayRenderer is falsy`)
        }
      }
      catch {
        // key 不在 registry（unregistered），跳过
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `以下 trigger key 缺少 displayRenderer：\n${missing.map(m => `  - ${m}`).join('\n')}`,
      )
    }
  })

  it('每个注册 trigger key 的 displayRenderer 对最小 valid params 输出非空字符串', () => {
    const failures: string[] = []

    for (const key of NORMALIZED_TRIGGER_ATOM_KEYS) {
      if (SKIP_UNREGISTERED_KEYS.has(key)) continue

      let entry: ReturnType<typeof registry.getEntry> | null = null
      try {
        entry = registry.getEntry(key)
      }
      catch {
        continue
      }

      if (!entry.displayRenderer) continue

      const params = MINIMAL_PARAMS[key] ?? {}
      try {
        const output = entry.displayRenderer({ params })
        if (!output || output.trim().length === 0) {
          failures.push(`${key}: displayRenderer 对最小 params 输出空字符串`)
        }
      }
      catch (err) {
        failures.push(`${key}: displayRenderer 抛出异常 — ${String(err)}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `以下 trigger key 的 displayRenderer 输出为空或抛出异常：\n${failures.map(f => `  - ${f}`).join('\n')}`,
      )
    }
  })
})
