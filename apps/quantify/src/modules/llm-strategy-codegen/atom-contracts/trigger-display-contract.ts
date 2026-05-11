/**
 * TRIGGER_DISPLAY_CONTRACT_REGISTRY — trigger key 展示层能力契约（Issue #1171）
 *
 * 设计原则：
 *   - TS exhaustive：新增 NormalizedTriggerAtomKey 必须在此声明 displayRoles，
 *     否则 Record 索引缺失 → 编译失败。这是展示层唯一事实源，消费侧零字面比较。
 *   - displayRoles 用数组表达"一个 key 可同时充当 entry 与 exit predicate"（如 cross_over/cross_under）
 *   - 消费侧通过 isEntryPredicateTriggerKey / isExitPredicateTriggerKey 查询，不再写死 key 字符串
 */

import type { NormalizedTriggerAtomKey } from '../types/strategy-normalized-intent'
import { NORMALIZED_TRIGGER_ATOM_KEYS } from '../types/strategy-normalized-intent'

// =========================================================
// 展示角色类型
// =========================================================

export type TriggerDisplayRole =
  | 'entryPredicate'     // 可作为入场 IF condition 单项；天然参与同 sideScope AND 合并
  | 'exitPredicate'      // 可作为离场 IF condition 单项；天然参与同 sideScope AND 合并
  | 'timeframeGroupable' // 可按 timeframe 维度合并为"15m/30m MA20 上方"格式（需有 reference.period + timeframe params）
  | 'gate'               // 顶层 gate（strategy.time_window / position.has_position 等）
  | 'action'             // 仅产生动作（execution.on_start / grid.range_rebalance）
  | 'composite'          // 聚合体（logical.any_of / condition.sequence）

export interface TriggerDisplayContract {
  /**
   * 一个 key 可同时充当 entry 与 exit predicate（如 indicator.cross_over/cross_under）。
   * 使用数组表达多角色。
   */
  displayRoles: readonly TriggerDisplayRole[]
}

// =========================================================
// 注册表
// =========================================================

/**
 * TS exhaustive 守门：Record<NormalizedTriggerAtomKey, TriggerDisplayContract>
 * 新增 trigger key 时若未在此声明 → 编译失败。
 */
export const TRIGGER_DISPLAY_CONTRACT_REGISTRY: Record<NormalizedTriggerAtomKey, TriggerDisplayContract> = {
  'execution.on_start':               { displayRoles: ['action'] },
  'price.percent_change':             { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.range_position_lte':         { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.range_position_gte':         { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.breakout_up':                { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.breakout_down':              { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.detect.indicator_boundary':  { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.rolling_extrema_breakout':   { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'volume.relative_average':          { displayRoles: ['entryPredicate'] },
  'condition.sequence':               { displayRoles: ['composite'] },
  'logical.any_of':                   { displayRoles: ['composite'] },
  'indicator.cross_over':             { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'indicator.cross_under':            { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'indicator.above':                  { displayRoles: ['entryPredicate', 'exitPredicate', 'timeframeGroupable'] },
  'indicator.below':                  { displayRoles: ['entryPredicate', 'exitPredicate', 'timeframeGroupable'] },
  'bollinger.touch_upper':            { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'bollinger.touch_lower':            { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'bollinger.touch_middle':           { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'oscillator.rsi_gte':               { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'oscillator.rsi_lte':               { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'trend.direction':                  { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'market.regime':                    { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'volatility.state':                 { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'grid.range_rebalance':             { displayRoles: ['action'] },
  'volume.threshold':                 { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'volatility.atr_threshold':         { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'strategy.time_window':             { displayRoles: ['gate'] },
  'position.has_position':            { displayRoles: ['gate'] },
  'position.no_position':             { displayRoles: ['gate'] },
  'indicator.divergence':             { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.candle_pattern':             { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'price.chart_pattern':              { displayRoles: ['entryPredicate', 'exitPredicate'] },
  'liquidity.sweep':                  { displayRoles: ['entryPredicate', 'exitPredicate'] },
}

// TS exhaustive 编译期守门验证（无运行时开销）
// 若 TRIGGER_DISPLAY_CONTRACT_REGISTRY 缺少任一 NormalizedTriggerAtomKey → TS error
type _ExhaustiveCheck = typeof TRIGGER_DISPLAY_CONTRACT_REGISTRY extends Record<NormalizedTriggerAtomKey, TriggerDisplayContract>
  ? true
  : never
const _exhaustiveCheckPass: _ExhaustiveCheck = true
void _exhaustiveCheckPass

// =========================================================
// 查询工具函数
// =========================================================

/**
 * 查询 trigger key 的展示角色列表。
 * 调用方应确保 key 在 NormalizedTriggerAtomKey 范围内。
 */
export function getTriggerDisplayRoles(key: NormalizedTriggerAtomKey): readonly TriggerDisplayRole[] {
  return TRIGGER_DISPLAY_CONTRACT_REGISTRY[key].displayRoles
}

/**
 * 判断 key 是否可作为入场 predicate。
 * 接受 string 类型以便在运行时 trigger.key 处直接调用，内部做 registry 有效性检查。
 */
export function isEntryPredicateTriggerKey(key: string): boolean {
  if (!(key in TRIGGER_DISPLAY_CONTRACT_REGISTRY)) return false
  return TRIGGER_DISPLAY_CONTRACT_REGISTRY[key as NormalizedTriggerAtomKey].displayRoles.includes('entryPredicate')
}

/**
 * 判断 key 是否可作为离场 predicate。
 */
export function isExitPredicateTriggerKey(key: string): boolean {
  if (!(key in TRIGGER_DISPLAY_CONTRACT_REGISTRY)) return false
  return TRIGGER_DISPLAY_CONTRACT_REGISTRY[key as NormalizedTriggerAtomKey].displayRoles.includes('exitPredicate')
}

/**
 * 判断 key 是否为 predicate（entry 或 exit），用于通用合并守卫。
 */
export function isPredicateTriggerKey(key: string): boolean {
  return isEntryPredicateTriggerKey(key) || isExitPredicateTriggerKey(key)
}

/**
 * 判断 key 是否支持 timeframe 维度分组合并（如"15m/30m MA20 上方"格式）。
 * 仅 indicator.above / indicator.below 具备此能力，因为它们有 reference.period + timeframe params
 * 且有对应的 formatIndicatorCompareCondition 渲染器。
 */
export function isTimeframeGroupableTriggerKey(key: string): boolean {
  if (!(key in TRIGGER_DISPLAY_CONTRACT_REGISTRY)) return false
  return TRIGGER_DISPLAY_CONTRACT_REGISTRY[key as NormalizedTriggerAtomKey].displayRoles.includes('timeframeGroupable')
}

// =========================================================
// 运行时 exhaustive 守门（invariant spec 使用）
// =========================================================

/**
 * 返回所有未在 registry 中声明的 NORMALIZED_TRIGGER_ATOM_KEYS。
 * 正常情况应为空数组；registry 完整则 TS 编译层已保证，此函数供 spec 双重验证。
 */
export function findMissingTriggerContractKeys(): NormalizedTriggerAtomKey[] {
  return NORMALIZED_TRIGGER_ATOM_KEYS.filter(
    key => !(key in TRIGGER_DISPLAY_CONTRACT_REGISTRY),
  )
}
