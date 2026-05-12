/**
 * AtomContractSurface — 自然语言识别面的声明式契约（Issue #1279 PR1a）
 *
 * 设计目标：
 *   把 semantic-seed-extractor 6595 行内散落的 push*Trigger / push*Action 方法里的同义词、
 *   参数 schema、phase/side 推断规则全部沉淀回 atom 自身。
 *
 *   下游 `GenericSeedDispatcher`（PR2）只需遍历 `ATOM_CONTRACT_REGISTRY`，对每个 atom 拿
 *   `surface` 字段去匹配文本，无需 atom-key 字面量分支。
 *
 *   PR1a 阶段：仅声明 type；registry entry 通过 `intent.keywords` + `intent.verbs` 起步，
 *   `paramSlots / phaseResolver / sideResolver` 留 PR1b 补齐。
 */

/**
 * Direction —— 触发方向 / phase 谓词集合。
 *
 * 既覆盖单边阈值（gte/lte）、十字交叉（cross_over/cross_under），
 * 也覆盖布林触碰（touch_upper/touch_lower/touch_middle）、突破（breakout_up/breakout_down），
 * 以及固定方向（fixed —— 给 dca/grid/portfolio 等无 direction 概念的 atom 使用）。
 */
export type Direction =
  | 'gte'
  | 'lte'
  | 'cross_over'
  | 'cross_under'
  | 'touch_upper'
  | 'touch_lower'
  | 'touch_middle'
  | 'breakout_up'
  | 'breakout_down'
  | 'divergence'
  | 'fixed'

/**
 * ParamSlotSchema —— 单个参数 slot 的抽取与校验声明。
 *
 *   kind=number      纯数字（如 RSI 阈值 30）
 *   kind=percent     百分比（如 stop_loss 2%）
 *   kind=duration    时长（如 strategy.time_window 的"9:00-15:00"或"4h"）
 *   kind=enum        枚举（如 sideScope 'long' | 'short' | 'both'）
 *   kind=symbol      交易对符号（如 BTCUSDT）
 */
export interface ParamSlotSchema {
  readonly kind: 'number' | 'percent' | 'duration' | 'enum' | 'symbol'
  readonly required: boolean
  /** 数值合法区间，用于 fail-closed 校验（如 RSI 必须 0-100） */
  readonly range?: readonly [number, number]
  /** enum 类型的合法值集 */
  readonly enum?: readonly string[]
  /** 缺省值（仅 required=false 时生效） */
  readonly default?: unknown
}

/**
 * PhaseResolver —— phase（entry / exit）推断策略
 *
 *   by-clause-verb       从子句动词（开多/平多/止盈/止损）派生 phase
 *   fixed-entry          固定 entry（如 grid.range_rebalance）
 *   fixed-exit           固定 exit（如 risk.partial_take_profit）
 *   { kind: 'fn', fn }   自定义函数（少数复杂 atom）
 */
export type PhaseResolverSpec =
  | 'by-clause-verb'
  | 'fixed-entry'
  | 'fixed-exit'
  | { readonly kind: 'fn'; readonly fn: PhaseResolverFn }

export type PhaseResolverFn = (clause: string) => 'entry' | 'exit' | null

/**
 * SideResolver —— sideScope（long / short / both）推断策略
 *
 *   inherit              继承 trigger 的 sideScope（默认）
 *   from-direction       由 Direction 派生（cross_over→long、cross_under→short 等）
 *   both                 永远是 both（如 grid 双向）
 *   { kind: 'fn', fn }   自定义函数
 */
export type SideResolverSpec =
  | 'inherit'
  | 'from-direction'
  | 'both'
  | { readonly kind: 'fn'; readonly fn: SideResolverFn }

export type SideResolverFn = (clause: string, direction: Direction | null) => 'long' | 'short' | 'both' | null

/**
 * AtomContractSurface —— 自然语言识别面契约
 *
 * 不变量（PR1b 编译期守护）：
 *   - intent.keywords 至少 1 项非空
 *   - intent.verbs 至少有一个 Direction key 对应非空数组
 *   - paramSlots 中至少一个 required=true 的 slot（除非 atom 完全无参数）
 */
export interface AtomContractSurface {
  /** 识别意图：indicator/atom 名称 + 按 direction 分桶的动词 */
  readonly intent: {
    readonly keywords: readonly string[]
    readonly verbs: Readonly<Partial<Record<Direction, readonly string[]>>>
  }
  /** 参数槽位 schema（key 即 slot 名） */
  readonly paramSlots: Readonly<Record<string, ParamSlotSchema>>
  /** phase 推断策略 */
  readonly phaseResolver: PhaseResolverSpec
  /** sideScope 推断策略 */
  readonly sideResolver: SideResolverSpec
}
