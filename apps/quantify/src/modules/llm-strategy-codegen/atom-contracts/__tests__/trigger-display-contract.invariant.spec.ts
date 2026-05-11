/**
 * INVARIANT：trigger-display-contract registry 完整性守门（Issue #1171）
 *
 * 确保：
 * 1. NORMALIZED_TRIGGER_ATOM_KEYS 中每个 key 都在 TRIGGER_DISPLAY_CONTRACT_REGISTRY 有合法声明
 * 2. 至少有 N 个 key 标了 entryPredicate（防止全部退化成 gate / action）
 * 3. isEntryPredicateTriggerKey / isExitPredicateTriggerKey 行为与 registry 一致
 * 4. 未知 key 不被误判为 predicate
 */

import { NORMALIZED_TRIGGER_ATOM_KEYS } from '../../types/strategy-normalized-intent'
import {
  TRIGGER_DISPLAY_CONTRACT_REGISTRY,
  findMissingTriggerContractKeys,
  isEntryPredicateTriggerKey,
  isExitPredicateTriggerKey,
  isTimeframeGroupableTriggerKey,
} from '../trigger-display-contract'

describe('TRIGGER_DISPLAY_CONTRACT_REGISTRY invariants', () => {
  it('每个 NORMALIZED_TRIGGER_ATOM_KEY 都必须在 registry 中声明', () => {
    const missing = findMissingTriggerContractKeys()
    expect(missing).toEqual([])
  })

  it('每个 registry entry 的 displayRoles 必须非空且包含合法角色', () => {
    const validRoles = new Set(['entryPredicate', 'exitPredicate', 'timeframeGroupable', 'gate', 'action', 'composite'])
    for (const key of NORMALIZED_TRIGGER_ATOM_KEYS) {
      const contract = TRIGGER_DISPLAY_CONTRACT_REGISTRY[key]
      expect(contract.displayRoles.length).toBeGreaterThan(0)
      for (const role of contract.displayRoles) {
        expect(validRoles.has(role)).toBe(true)
      }
    }
  })

  it('entryPredicate keys 精确匹配快照（防止全部退化成 gate/action，也防止误加）', () => {
    const entryPredicateKeys = NORMALIZED_TRIGGER_ATOM_KEYS.filter(key =>
      TRIGGER_DISPLAY_CONTRACT_REGISTRY[key].displayRoles.includes('entryPredicate'),
    ).sort()
    expect(entryPredicateKeys).toMatchInlineSnapshot(`
      [
        "bollinger.touch_lower",
        "bollinger.touch_middle",
        "bollinger.touch_upper",
        "indicator.above",
        "indicator.below",
        "indicator.cross_over",
        "indicator.cross_under",
        "indicator.divergence",
        "liquidity.sweep",
        "market.regime",
        "oscillator.rsi_gte",
        "oscillator.rsi_lte",
        "price.breakout_down",
        "price.breakout_up",
        "price.candle_pattern",
        "price.chart_pattern",
        "price.detect.indicator_boundary",
        "price.percent_change",
        "price.range_position_gte",
        "price.range_position_lte",
        "price.rolling_extrema_breakout",
        "trend.direction",
        "volatility.atr_threshold",
        "volatility.state",
        "volume.relative_average",
        "volume.threshold",
      ]
    `)
  })

  it('已知 entry predicate keys 的 isEntryPredicateTriggerKey 返回 true', () => {
    const knownEntryKeys = [
      'indicator.above',
      'indicator.below',
      'indicator.cross_over',
      'indicator.cross_under',
      'trend.direction',
      'oscillator.rsi_gte',
      'oscillator.rsi_lte',
      'volume.threshold',
      'volatility.atr_threshold',
    ]
    for (const key of knownEntryKeys) {
      expect(isEntryPredicateTriggerKey(key)).toBe(true)
    }
  })

  it('gate / action / composite keys 的 isEntryPredicateTriggerKey 返回 false', () => {
    const nonEntryKeys = [
      'execution.on_start',
      'grid.range_rebalance',
      'strategy.time_window',
      'position.has_position',
      'position.no_position',
      'logical.any_of',
      'condition.sequence',
    ]
    for (const key of nonEntryKeys) {
      expect(isEntryPredicateTriggerKey(key)).toBe(false)
    }
  })

  it('未知 key 的 isEntryPredicateTriggerKey 返回 false（不抛异常）', () => {
    expect(isEntryPredicateTriggerKey('unknown.key')).toBe(false)
    expect(isEntryPredicateTriggerKey('')).toBe(false)
    expect(isEntryPredicateTriggerKey('indicator')).toBe(false)
  })

  it('已知 exit predicate keys 的 isExitPredicateTriggerKey 返回 true', () => {
    const knownExitKeys = [
      'indicator.above',
      'indicator.below',
      'indicator.cross_over',
      'indicator.cross_under',
    ]
    for (const key of knownExitKeys) {
      expect(isExitPredicateTriggerKey(key)).toBe(true)
    }
  })

  it('gate / action keys 的 isExitPredicateTriggerKey 返回 false', () => {
    const nonExitKeys = [
      'execution.on_start',
      'grid.range_rebalance',
      'position.has_position',
      'position.no_position',
    ]
    for (const key of nonExitKeys) {
      expect(isExitPredicateTriggerKey(key)).toBe(false)
    }
  })

  it('indicator.above / indicator.below 标记了 timeframeGroupable', () => {
    expect(isTimeframeGroupableTriggerKey('indicator.above')).toBe(true)
    expect(isTimeframeGroupableTriggerKey('indicator.below')).toBe(true)
  })

  it('indicator.cross_over / trend.direction 等未标 timeframeGroupable', () => {
    expect(isTimeframeGroupableTriggerKey('indicator.cross_over')).toBe(false)
    expect(isTimeframeGroupableTriggerKey('indicator.cross_under')).toBe(false)
    expect(isTimeframeGroupableTriggerKey('trend.direction')).toBe(false)
    expect(isTimeframeGroupableTriggerKey('bollinger.touch_lower')).toBe(false)
  })

  it('M4: timeframeGroupable 角色仅 indicator.above / indicator.below 可声明', () => {
    const tgKeys = NORMALIZED_TRIGGER_ATOM_KEYS.filter(k =>
      TRIGGER_DISPLAY_CONTRACT_REGISTRY[k].displayRoles.includes('timeframeGroupable'),
    )
    expect(tgKeys.sort()).toEqual(['indicator.above', 'indicator.below'])
  })
})
