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
 *
 *   extractor —— 半-closure 抽取声明（Issue #1279 PR2a）。dispatcher 拥有
 *     `Record<extractor.kind, parserFn>` 与 `Record<extractor.derive, deriveFn>`
 *     两张内置表，registry 仍是纯数据。详见 `ExtractorSpec`。
 */
export interface ParamSlotSchema {
  readonly kind: 'number' | 'percent' | 'duration' | 'enum' | 'symbol'
  readonly required: boolean
  /** 数值合法区间，用于 fail-closed 校验（如 RSI 必须 0-100） */
  readonly range?: readonly [number, number]
  /**
   * 数值必须为该数的倍数（如整数 period 用 1）。Issue #1395 mute-spider S5：
   *   防止 LLM 幻觉出 14.5 / 12.3 这类荒唐 period 值。
   */
  readonly multipleOf?: number
  /** enum 类型的合法值集 */
  readonly enum?: readonly string[]
  /** 缺省值（仅 required=false 时生效） */
  readonly default?: unknown
  /** 抽取声明：dispatcher 按 extractor.kind 查内置 parser 表，按 extractor.derive 查内置 derive 表。 */
  readonly extractor?: ExtractorSpec
}

/**
 * ExtractorSpec —— 半-closure 参数抽取声明（Issue #1279 PR2a）
 *
 *   kind                解析器 ID（dispatcher 内置 generic parsers 表的 key）
 *     'number-int'        纯整数（默认 pattern: \d+）
 *     'number-decimal'    带小数（默认 pattern: \d+(\.\d+)?）
 *     'percent'           百分号数值（含正负号感知）
 *     'duration'          时长（'4h' / '15m' 等）
 *     'enum-zh-map'       中文枚举映射，搭配 enumMap 使用
 *     'time-window-list'  业务化：抽取 [{start, end}] 时间段数组
 *     'symbol-base-quote' 业务化：拆 BTCUSDT → {base, quote}
 *     其它扩展用 string 兜底（dispatcher 实现时补内置表）
 *
 *   pattern             可选 regex 字符串（含 lookahead 时由 atom 声明，覆盖 kind 默认 pattern）
 *   enumMap             enum-zh-map 的中文 → 规范化值映射
 *   default             抽取不到时的兜底值（与 ParamSlotSchema.default 等价；保留以便派生函数复用）
 *   derive              派生函数 ID（dispatcher 内置 derive 函数表的 key，例如 'period-range'）
 *   range               number-* 边界检查（覆盖 ParamSlotSchema.range）
 *   index               number-* 位置索引（Issue #1338）：clause 内同一 pattern 多次命中时，
 *                       按 matchAll 顺序取第 N 个（0-based）。用于 cross_over 等需要区分
 *                       "第 1 个数字 = fast、第 2 个数字 = slow" 的双数字场景。缺省 0。
 *                       约束（review C1/m2）：必须为非负整数；dispatcher 取整段 m[0]，
 *                       pattern 含 capture group 不会按 group 索引——若要 group 抽取，
 *                       请新增独立 extractor.kind 而非复用 index。
 */
export interface ExtractorSpec {
  readonly kind:
    | 'number-int'
    | 'number-decimal'
    | 'percent'
    | 'duration'
    | 'enum-zh-map'
    | 'time-window-list'
    | 'symbol-base-quote'
    | string
  readonly pattern?: string
  readonly enumMap?: Readonly<Record<string, string>>
  readonly default?: unknown
  readonly derive?: string
  readonly range?: readonly [number, number]
  readonly index?: number
}

/**
 * ResolveCtx —— phaseResolver / sideResolver fn 形态的运行时上下文（Issue #1279 PR2a）
 *
 * dispatcher 在派发匹配时把当前 atomKey、已抽取的 params 透传给自定义 fn，
 * 让 fn 可以根据已知信息做派生判断（如 indicator.above.referenceRole 看 period 大小）。
 */
export interface ResolveCtx {
  readonly atomKey: string
  readonly params: Readonly<Record<string, unknown>>
}

/**
 * PhaseResolver —— phase（entry / exit / gate）推断策略
 *
 *   by-clause-verb       从子句动词（开多/平多/止盈/止损）派生 phase
 *   fixed-entry          固定 entry（如 grid.range_rebalance）
 *   fixed-exit           固定 exit（如 risk.partial_take_profit）
 *   fixed-gate           固定 gate（如 portfolioRisk.drawdown_block，PR2a Issue #1279）
 *   { kind: 'fn', fn }   自定义函数（少数复杂 atom）
 *
 * PR2a 起新增 'gate' 出场：portfolioRisk.drawdown_block / position.has_position /
 *   position.no_position / market.regime / volatility.state 等条件守门 atom 没有
 *   入场/出场二元概念，而是"是否放行后续动作"，统一归为 phase='gate'。
 */
export type PhaseResolverSpec =
  | 'by-clause-verb'
  | 'fixed-entry'
  | 'fixed-exit'
  | 'fixed-gate'
  | { readonly kind: 'fn'; readonly fn: PhaseResolverFn }

export type PhaseResolverFn = (clause: string, ctx: ResolveCtx) => 'entry' | 'exit' | 'gate' | null

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
  /**
   * 命中所需的最小参数集合。
   * 用于区分同词根但语义更具体的 atom：例如 "ATR 作为止损" 应命中 risk.atr_stop，
   * 不应因含 "止损" 生成缺 valuePct 的 risk.stop_loss_pct。
   */
  readonly matchRequires?: readonly string[]
  /** phase 推断策略 */
  readonly phaseResolver: PhaseResolverSpec
  /** sideScope 推断策略 */
  readonly sideResolver: SideResolverSpec
  /**
   * 命中时 evidence.source 的来源声明（可选，按需声明，缺省视为 'user_explicit'）。
   *
   * atom 在 surface 层声明自身被命中时应填写的 evidence.source 值；dispatcher 读表赋值，
   * 无需 atom-key 字面量比较（满足 AC-13 红线）。
   *
   * 命名为 evidenceProvenance（而非 evidenceSource）以避免与
   * AtomContractEmit.evidenceSource（'segment' | 'clause'）产生命名空间冲突。
   *
   * 目前仅 external.signal 声明 'webhook'；其余 atom 省略（等价于 'user_explicit'）。
   */
  readonly evidenceProvenance?: 'webhook' | 'user_explicit'

  /**
   * 跨子句对偶继承（Issue #1383 后续：原子语义五桶真相源扩展）
   *
   * 适用场景：
   *   用户在出场子句里省略 keyword，例如 "EMA7 上穿 EMA21 时开多；下穿 时平多"——
   *   "下穿 时平多" 这条子句只有 verb（下穿）没有 indicator keyword，按 dispatcher 的
   *   kw+verb 双校验铁律永远不可能命中 `indicator.cross_under`。
   *
   * 解决方案（仍保持 atom contract = 唯一真相源）：
   *   atom 在自己 contract 上声明 `crossClauseInheritFrom: <对偶 atom key>` +
   *   `inheritParams: ['indicator', 'fastPeriod', 'slowPeriod', ...]`。dispatcher 跑一道
   *   registry-driven generic pass：对每个 clause，若只命中本 atom 的 verb 但缺
   *   keyword，回查同 message 已匹配的 sibling atom（key === crossClauseInheritFrom），
   *   按 inheritParams 列表克隆参数后 emit 本 atom，phase 由 by-clause-verb 决出。
   *
   * 新增对偶关系扩展只需在各自 atom 加一行 crossClauseInheritFrom，dispatcher 零修改、
   * 仍守 no-atom-key-literal / no-business-rule-in-dispatcher 红线。
   *
   * 'self' 表示自镜像（例如 bollinger.touch_middle 在入场和出场子句都可能省略 keyword）。
   */
  readonly crossClauseInheritFrom?: string

  /**
   * 与 crossClauseInheritFrom 搭配：声明哪些 paramSlot 在跨子句继承时从 sibling 取值。
   * 仅 inheritParams 列出的 slot 会被继承；其它 slot 走本子句正常 extractor 抽取（不抽到就空）。
   * 缺省视为空数组——即仅起到"无 keyword 时仍允许 verb 触发"的效果，不继承任何参数。
   */
  readonly inheritParams?: readonly string[]

  /**
   * Issue #1395 mute-spider — 多 slot 联动的合法预置组合白名单。
   *
   * 场景：MACD 标准参数三元组 (fast/slow/signal) 之间互相约束，单 slot range 校验
   *   无法表达 "12/26/9 合法 但 100/26/9 非法" 这种业务约束。strict-validation pass
   *   先尝试 paramPresetCombos：若 params 中包含某条 preset 的全部 key 且值全等
   *   →  直接判合法；否则回落到 per-slot enum/range/multipleOf 校验。
   *
   * 仅声明在高风险 atom 上（MACD cross_over / cross_under 等）。
   */
  readonly paramPresetCombos?: ReadonlyArray<Readonly<Record<string, string | number | boolean>>>
}
