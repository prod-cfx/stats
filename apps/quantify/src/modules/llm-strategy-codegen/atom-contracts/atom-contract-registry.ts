/**
 * ATOM_CONTRACT_REGISTRY — per-atom 全链路强契约注册表（Issue #1162）
 *
 * 每个 SupportedAtomKey（含 orchestration/scope/gate/program 共 47+ key）必须声明 4 个 hook：
 *   summaryContribution / readinessCheck / clarificationQuestion / mutex
 *
 * TS exhaustive：新增 atom → Record 索引缺失 → 编译失败（守门）
 * 产品决策：risk.partial_take_profit 保持 unsupported 标签（公测），本 registry 仅声明现有 hooks
 */

import type { SupportedAtomKey } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import type {
  AtomClassifier,
  AtomContract,
  AtomContractBucket,
  AtomContractDisplay,
  AtomContractEmit,
  AtomContractKey,
  SizingEvidence,
} from './atom-contract-types'
import { ATOM_MUTEX } from '../nl-gateway/utterance-corpus/corpus-invariants'
import type { ConditionEmitOverride } from './atom-contract-condition-emits'
import { CONDITION_ATOM_EMITS } from './atom-contract-condition-emits'
import type { RiskGuardEmitOverride } from './atom-contract-risk-guard-emits'
import { RISK_GUARD_ATOM_EMITS } from './atom-contract-risk-guard-emits'
import type { LifecycleEmitOverride } from './atom-contract-lifecycle-emits'
import { LIFECYCLE_ATOM_EMITS } from './atom-contract-lifecycle-emits'
import type { RuleBlockEmitOverride } from './atom-contract-rule-block-emits'
import { RULE_BLOCK_ATOM_EMITS } from './atom-contract-rule-block-emits'
import type { OrchestrationEmitOverride } from './atom-contract-orchestration-emits'
import { ORCHESTRATION_ATOM_EMITS } from './atom-contract-orchestration-emits'
import type { ActionEmitOverride } from './atom-contract-action-emits'
import { ACTION_ATOM_EMITS } from './atom-contract-action-emits'
import {
  COMMON_PIPELINE,
  NO_SUMMARY,
  UNSUPPORTED_SKIP,
  VIA_PRESENTATION_DISPLAY,
} from './atom-contract-types'
import { SHARED_ENUM_DISPLAY } from './shared-display-tokens'
import { ATOM_PRIVATE_DISPLAY } from './atom-private-display-tokens'
import { renderDisplayToken, renderEnumDisplayToken } from '../nl-gateway/display-registry'
import { getGoldenUtterancesForAtom } from '../nl-gateway/utterance-corpus'

type AtomContractSeed = Omit<AtomContract, 'key' | 'bucket' | 'roles' | 'display' | 'emit' | 'corpus' | 'temporality'> & {
  readonly display?: AtomContractDisplay
  readonly emit?: AtomContractEmit
  // #1329 PR3c Round 1 M5：corpus 改为 required。所有 seed 必须显式提供 corpus；
  // stub atom 需明确提供空字段（配合 STUB_CORPUS_WHITELIST 允许通过 invariant）。
  readonly corpus: AtomContract['corpus']
}

// Issue #1279 PR3a：保留给历史 condition atom 未兑现状态使用；当前所有 condition atom
//   均已迁移为 'pr3a-condition'（CONDITION_ATOM_EMITS 全量覆盖），Pr1bStubIrShapeBuilder
//   不再被默认构造，但保留 brand 型以兼容 counter-example 测试（invariant-counter-examples.spec.ts）。
export type Pr1bStubIrShapeBuilder = AtomContractEmit['irShape'] & {
  readonly __pr1bStub: true
}

// Issue #1279 PR3e：non-condition bucket atom（action / risk / orchestration /
//   positionConstraint 中除 grid.range_rebalance 外的 atom）走 rule-level / spec-level
//   IR 编译路径，不通过 compileAtom 的 emit.irShape 调度。
//   `__notApplicable: true` brand 与 `Pr1bStubIrShapeBuilder` 严格分离：
//     - `pr1b-stub` 表达"未兑现，等待 PR3a/PR3d/PR3e 迁移"
//     - `irshape-not-applicable` 表达"已审计并显式声明：emit.irShape 接口不适用"
//   两者的 stub function 都会在被错误调用时抛错（fail-loud），但出现路径与契约语义不同。
export type NotApplicableIrShapeBuilder = AtomContractEmit['irShape'] & {
  readonly __notApplicable: true
}

type NotApplicableEmit = Omit<AtomContractEmit, 'irShape'> & {
  readonly capabilityStatus: 'irshape-not-applicable'
  readonly irShape: NotApplicableIrShapeBuilder
}

// Issue #1279 PR3a Phase 2 + PR3e：seed 的 `emit` 字段若被显式指定（已兑现为 real
// 'pr3a-condition'），编译期保留其原始字面量类型；未指定时由 `completePr1bRegistry`
// 注入 `NotApplicableEmit`（PR3e 起非 condition bucket atom 默认状态）。
// 条件 atom（在 CONDITION_ATOM_EMITS 内）由 completePr1bRegistry 运行时合并把
// capabilityStatus 改为 'pr3a-condition'；类型推断仍以 fallback NotApplicableEmit
// 守门 invariant —— 见 atom-contract-invariants.ts 内 `_NonConditionIrShapeNotApplicable`。
type CompletedPr1bRegistry<T extends Record<AtomContractKey, AtomContractSeed>> = {
  readonly [K in keyof T]: Omit<T[K], 'display' | 'emit' | 'corpus'> & {
    readonly key: K
    readonly bucket: AtomContractBucket
    readonly canonicalWave: 'canonicalWave' extends keyof T[K] ? T[K]['canonicalWave'] : undefined
    readonly display: AtomContractDisplay
    readonly corpus: AtomContract['corpus']
    readonly emit: T[K] extends { readonly emit: infer E extends AtomContractEmit } ? E : NotApplicableEmit
    // Issue #1383 Lane A：fulfillsStrategyPhase 由 ATOM_FULFILLS_STRATEGY_PHASE 单一真相源注入
    readonly fulfillsStrategyPhase: ReadonlyArray<'entry' | 'exit' | 'risk' | 'sizing' | 'context'>
    // Issue #1395：roles 由 ATOM_ROLES 单一真相源注入
    readonly roles: ReadonlyArray<'predicate' | 'effect'>
    // Issue #1457 闸 2：temporality 由 ATOM_TEMPORALITY 单一真相源注入
    readonly temporality: 'state' | 'event' | 'structural'
  }
}

// Per-order budget capability triple — shared by DCA / pyramiding emit paths.
// Issue #1191：常量名保留 DCA 前缀以维持向后兼容；pyramiding 复用同一三元组，
//   通过 emit shape 顶层 `triggerSource` 字段（'position.dca_schedule' /
//   'position.pyramiding_limit'）区分来源。后续若再有第三个消费者（grid 等），
//   可在 cleanup PR 把常量改名为 PER_ORDER_BUDGET_CAPABILITY。
export const DCA_PER_ORDER_BUDGET_CAPABILITY = {
  domain: 'capital' as const,
  verb: 'allocate' as const,
  object: 'per_order_budget' as const,
}

// DCA per-order sizing evidence (reused by SIZING_BEARING_ATOMS in corpus-invariants)
const DCA_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'perOrderSizing',
}

// Pyramiding layer sizing evidence (Issue #1191) —— capability 三元组与 DCA 一致，
//   paramSource 区分为 `layerSizing`（pyramiding 由 seed-extractor 从"每次加仓 N%"
//   提取的 layerSizing 字段）。
const PYRAMIDING_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'layerSizing',
}

// Grid per-order sizing evidence (Issue #1198) —— capability 三元组与 DCA 一致，
//   paramSource 区分为 `perGridSizing`（grid 由 seed-extractor `buildGridOrderProgramActionContracts`
//   从"每格 N USDT"提取的 perOrderBudget 字段；PR #1197 已恢复顶层 kind/value/asset emit）。
const GRID_SIZING_EVIDENCE: SizingEvidence = {
  capability: DCA_PER_ORDER_BUDGET_CAPABILITY,
  paramSource: 'perGridSizing',
}

// Issue #1334 PR1：所有 atom 默认 classifier 元数据；PR2 迁移 legacy ATOMS 非默认值条目时覆盖。
// freeze 防御消费方误写常量本体（53 个 atom 仍各自 `{ ...DEFAULT_CLASSIFIER_META, ... }` 浅拷贝注入）。
export const DEFAULT_CLASSIFIER_META: AtomClassifier = Object.freeze({
  supportStatus: 'supported_executable',
}) as AtomClassifier

// Issue #1364 PR1：bucket 真相源唯一性。
//
// `ATOM_BUCKETS` 表退化为模块 private const（**不再 export**），仅供
// `completePr1bRegistry` 内部把 bucket 字段注入到每个 contract entry 上。
// 所有模块外消费方必须读 `ATOM_CONTRACT_REGISTRY[key].bucket`（即 `contract.bucket`，
// 必填字段，atom-contract-types.ts:140）；不可再读 `ATOM_BUCKETS`。
//
// AC-1 例外条款允许此形态：「`ATOM_BUCKETS` 表已删除（**或退化为派生 view**）；
//   所有引用点改为读 `ATOM_CONTRACT_REGISTRY[key].bucket`」。
//
// 守门：本模块仅在 `completePr1bRegistry` 函数内读 `ATOM_BUCKETS[key]`；
//   `atom-bucket-derivation.spec.ts` 反向不变量保证 `contract.bucket` 与 `ATOM_BUCKETS`
//   始终一致。
const ATOM_BUCKETS = {
  'volume.threshold': 'trigger',
  'volatility.atr_threshold': 'trigger',
  'strategy.time_window': 'trigger',
  'oscillator.rsi_lte': 'trigger',
  'oscillator.rsi_gte': 'trigger',
  'indicator.divergence': 'trigger',
  'price.candle_pattern': 'trigger',
  'price.chart_pattern': 'trigger',
  'liquidity.sweep': 'trigger',
  'external.signal': 'trigger',
  'position.has_position': 'trigger',
  'position.no_position': 'trigger',
  'bollinger.touch_upper': 'trigger',
  'bollinger.touch_lower': 'trigger',
  'bollinger.touch_middle': 'trigger',
  'price.percent_change': 'trigger',
  'price.breakout_up': 'trigger',
  'price.breakout_down': 'trigger',
  'price.detect.indicator_boundary': 'trigger',
  'indicator.cross_over': 'trigger',
  'indicator.cross_under': 'trigger',
  'indicator.above': 'trigger',
  'indicator.below': 'trigger',
  'execution.on_start': 'trigger',
  'trend.direction': 'trigger',
  'market.regime': 'trigger',
  'volatility.state': 'trigger',
  'price.range_position_lte': 'trigger',
  'price.range_position_gte': 'trigger',
  'action.add_position': 'action',
  'action.reverse_position': 'action',
  'action.open_long': 'action',
  'action.close_long': 'action',
  'action.open_short': 'action',
  'action.close_short': 'action',
  'risk.stop_loss_pct': 'risk',
  'risk.take_profit_pct': 'risk',
  'risk.atr_stop': 'risk',
  'risk.partial_take_profit': 'risk',
  'portfolioRisk.drawdown_block': 'orchestration',
  'position.dca_schedule': 'positionConstraint',
  'position.pyramiding_limit': 'positionConstraint',
  'grid.range_rebalance': 'positionConstraint',
  // ── orchestration / scope（#1329 follow-up：从 legacy-presentation-data.ts PRESENTATIONS 迁入）──
  'gate.regime': 'orchestration',
  'portfolioRisk.symbol_exposure_cap': 'orchestration',
  'portfolioRisk.substrategy_exposure_cap': 'orchestration',
  'program.dynamic_grid': 'orchestration',
  'program.fixed_grid_gated': 'orchestration',
  'program.adaptive_volatility_grid': 'orchestration',
  'program.event_listener': 'orchestration',
  'scope.symbol': 'orchestration',
  'scope.leg': 'orchestration',
  'scope.timeframe': 'orchestration',
  'scope.dataSource': 'orchestration',
  'scope.subStrategy': 'orchestration',
  'gate.subStrategy': 'orchestration',
  // Issue #1395：新 atom
  'condition.sequence': 'trigger',
  'price.previous_extrema_retest': 'trigger',
  'risk.atr_take_profit': 'risk',
} as const satisfies Record<AtomContractKey, AtomContractBucket>

// =========================================================
// ATOM_FULFILLS_STRATEGY_PHASE — Issue #1383 Lane A
// =========================================================
//
// "atom 自声明该 atom 满足 strategy 哪几个阶段" 的单一真相源。
// 历史上 codegen-conversation.service.ts 内 hasExecutableEntry/ExitSemantics
// 通过硬编码 capability.domain === 'order_program' / verb === 'maintain' 等串判定，
// 新增策略类型需要修改 conversation service 才能扩展。本表把判定挪到 atom 自声明，
// SemanticExecutableSemanticsService 仅做注册表驱动的 generic 判定。
const ATOM_FULFILLS_STRATEGY_PHASE = {
  // ── triggers（默认 by-clause-verb 双向 → 两个 phase 都能满足；phase 最终取 atom.phase 字段）──
  'volume.threshold': ['entry', 'exit'],
  'volatility.atr_threshold': ['entry', 'exit'],
  'strategy.time_window': ['entry', 'exit'],
  'oscillator.rsi_lte': ['entry', 'exit'],
  'oscillator.rsi_gte': ['entry', 'exit'],
  'indicator.divergence': ['entry', 'exit'],
  'price.candle_pattern': ['entry', 'exit'],
  'price.chart_pattern': ['entry', 'exit'],
  'liquidity.sweep': ['entry', 'exit'],
  'external.signal': ['entry', 'exit'],
  'position.has_position': ['entry', 'exit'],
  'position.no_position': ['entry', 'exit'],
  'bollinger.touch_upper': ['entry', 'exit'],
  'bollinger.touch_lower': ['entry', 'exit'],
  'bollinger.touch_middle': ['entry', 'exit'],
  'price.percent_change': ['entry', 'exit'],
  'price.breakout_up': ['entry', 'exit'],
  'price.breakout_down': ['entry', 'exit'],
  'price.detect.indicator_boundary': ['entry', 'exit'],
  'indicator.cross_over': ['entry', 'exit'],
  'indicator.cross_under': ['entry', 'exit'],
  'indicator.above': ['entry', 'exit'],
  'indicator.below': ['entry', 'exit'],
  // Issue #1383 Round 1 M5：调度类原子自身已满足 entry+exit 语义（程序自洽，
  //   无需额外出场触发），与 legacy hasLockedScheduleSemantics 行为对齐。
  'execution.on_start': ['entry', 'exit'],
  'trend.direction': ['entry', 'exit'],
  'market.regime': ['entry', 'exit'],
  'volatility.state': ['entry', 'exit'],
  'price.range_position_lte': ['entry', 'exit'],
  'price.range_position_gte': ['entry', 'exit'],
  // ── actions ──
  'action.add_position': ['entry'],
  'action.reverse_position': ['entry', 'exit'],
  'action.open_long': ['entry'],
  'action.close_long': ['exit'],
  'action.open_short': ['entry'],
  'action.close_short': ['exit'],
  // ── risk ──
  'risk.stop_loss_pct': ['risk', 'exit'],
  'risk.take_profit_pct': ['risk', 'exit'],
  'risk.atr_stop': ['risk', 'exit'],
  'risk.partial_take_profit': ['risk'],
  // ── portfolio / drawdown 护栏：不直接满足 entry/exit/risk 任一阶段（只是阻断） ──
  'portfolioRisk.drawdown_block': [],
  // ── positionConstraint ──
  // Issue #1383 Round 1 M5：DCA 调度自身已满足 entry+exit 语义（自洽程序，
  //   不需要额外出场触发即可生成可运行策略）。
  'position.dca_schedule': ['entry', 'exit', 'sizing'],
  'position.pyramiding_limit': ['entry', 'sizing'],
  'grid.range_rebalance': ['entry', 'exit', 'sizing'],
  // ── orchestration ──
  'gate.regime': [],
  'portfolioRisk.symbol_exposure_cap': [],
  'portfolioRisk.substrategy_exposure_cap': [],
  // grid program 内部自带每格仓位/区间/density 等 sizing 配置，自声明 'sizing' →
  //   clarification 不必再追问独立 single-trade position size（与 grid.range_rebalance
  //   等"持续 sizing 源"同质）。后续新策略只要 atom 自声明 'sizing' 即可享受同一旁路。
  'program.dynamic_grid': ['entry', 'exit', 'sizing'],
  'program.fixed_grid_gated': ['entry', 'exit', 'sizing'],
  'program.adaptive_volatility_grid': ['entry', 'exit', 'sizing'],
  // Issue #1383 Round 1 M5：事件监听类程序自洽，含 exit。
  'program.event_listener': ['entry', 'exit'],
  'scope.symbol': ['context'],
  'scope.leg': ['context'],
  'scope.timeframe': ['context'],
  'scope.dataSource': ['context'],
  'scope.subStrategy': ['context'],
  'gate.subStrategy': [],
  // Issue #1395：新 atom
  'condition.sequence': ['entry', 'exit'],
  'price.previous_extrema_retest': ['entry'],
  'risk.atr_take_profit': ['risk', 'exit'],
} as const satisfies Record<AtomContractKey, ReadonlyArray<'entry' | 'exit' | 'risk' | 'sizing' | 'context'>>

export function getAtomFulfillsStrategyPhase(
  key: AtomContractKey,
): ReadonlyArray<'entry' | 'exit' | 'risk' | 'sizing' | 'context'> {
  return ATOM_FULFILLS_STRATEGY_PHASE[key]
}

// =========================================================
// ATOM_ROLES — Issue #1395
// =========================================================
//
// atom 在 AtomExpr 谓词树 / SemanticRule.effects 中可担任的角色单一真相源。
//   bucket=trigger                          → ['predicate']
//   bucket=action                           → ['effect']
//   bucket=positionConstraint               → ['effect']
//   bucket=orchestration                    → gate.* 用 ['predicate']；其余 ['effect']
//   bucket=risk                             → 默认 ['effect']；
//                                              risk.atr_stop / stop_loss_pct / stop_loss_price /
//                                              trailing_stop / partial_take_profit 同时含
//                                              ['predicate', 'effect']（"被触及"是谓词、
//                                              "设置止损线"是副作用）
//
// 反向不变量：__tests__/atom-roles.invariant.spec.ts。
const ATOM_ROLES = {
  // ── trigger（predicate）──
  'volume.threshold': ['predicate'],
  'volatility.atr_threshold': ['predicate'],
  'strategy.time_window': ['predicate'],
  'oscillator.rsi_lte': ['predicate'],
  'oscillator.rsi_gte': ['predicate'],
  'indicator.divergence': ['predicate'],
  'price.candle_pattern': ['predicate'],
  'price.chart_pattern': ['predicate'],
  'liquidity.sweep': ['predicate'],
  'external.signal': ['predicate'],
  'position.has_position': ['predicate'],
  'position.no_position': ['predicate'],
  'bollinger.touch_upper': ['predicate'],
  'bollinger.touch_lower': ['predicate'],
  'bollinger.touch_middle': ['predicate'],
  'price.percent_change': ['predicate'],
  'price.breakout_up': ['predicate'],
  'price.breakout_down': ['predicate'],
  'price.detect.indicator_boundary': ['predicate'],
  'indicator.cross_over': ['predicate'],
  'indicator.cross_under': ['predicate'],
  'indicator.above': ['predicate'],
  'indicator.below': ['predicate'],
  'execution.on_start': ['predicate'],
  'trend.direction': ['predicate'],
  'market.regime': ['predicate'],
  'volatility.state': ['predicate'],
  'price.range_position_lte': ['predicate'],
  'price.range_position_gte': ['predicate'],
  // ── action（effect）──
  'action.add_position': ['effect'],
  'action.reverse_position': ['effect'],
  'action.open_long': ['effect'],
  'action.close_long': ['effect'],
  'action.open_short': ['effect'],
  'action.close_short': ['effect'],
  // ── risk（默认 effect；被触及语义的 5 个 atom 同时含 predicate + effect）──
  'risk.stop_loss_pct': ['predicate', 'effect'],
  'risk.take_profit_pct': ['effect'],
  'risk.atr_stop': ['predicate', 'effect'],
  'risk.partial_take_profit': ['predicate', 'effect'],
  // ── orchestration（drawdown_block：副作用护栏）──
  'portfolioRisk.drawdown_block': ['effect'],
  // ── positionConstraint（effect）──
  'position.dca_schedule': ['effect'],
  'position.pyramiding_limit': ['effect'],
  'grid.range_rebalance': ['effect'],
  // ── orchestration / scope ──
  'gate.regime': ['predicate'],
  'portfolioRisk.symbol_exposure_cap': ['effect'],
  'portfolioRisk.substrategy_exposure_cap': ['effect'],
  'program.dynamic_grid': ['effect'],
  'program.fixed_grid_gated': ['effect'],
  'program.adaptive_volatility_grid': ['effect'],
  'program.event_listener': ['effect'],
  'scope.symbol': ['effect'],
  'scope.leg': ['effect'],
  'scope.timeframe': ['effect'],
  'scope.dataSource': ['effect'],
  'scope.subStrategy': ['effect'],
  'gate.subStrategy': ['predicate'],
  // Issue #1395：新 atom
  'condition.sequence': ['predicate'],
  'price.previous_extrema_retest': ['predicate'],
  'risk.atr_take_profit': ['effect'],
} as const satisfies Record<AtomContractKey, ReadonlyArray<'predicate' | 'effect'>>

export function getAtomRoles(key: AtomContractKey): ReadonlyArray<'predicate' | 'effect'> {
  return ATOM_ROLES[key]
}

// =========================================================
// ATOM_TEMPORALITY — Issue #1457 闸 2（review round 1 M1 / M2 / M4）
// =========================================================
//
// **重要：本表是 atom 层语义真相源；与 IR compiler 层的 PREDICATE_KIND_TEMPORALITY
// （predicate-kind-temporality.ts）是两个独立概念，没有映射关系**。compiler 层判断
// entry rule 是否含 event leaf 不读本表，只读 PREDICATE_KIND_TEMPORALITY。本表用于：
//   - Issue #1458 directional gate 对称配对（state 类 atom 的方向反义对）
//   - corpus-invariants / atom directional 表的反向不变量锚点
//   - 文档/checklist：新 atom 强制按"是否带持续状态"显式选边
//
// **当前消费状态（review round 1 M2）**：生产 0 消费，仅 invariant spec 与文档锚点。
//   为 #1458 directional gate 对称配对预埋；后续 PR 接通真实消费。
//
// 取值（review round 1 M4：引入 'structural'）：
//
//   'state'      —— 持续真值类 trigger atom（above/below/has_position/market.regime/
//                   volatility.state/trend.direction/range_position_* 等）
//   'event'      —— rising-edge trigger atom（cross_over/cross_under/touch_*/
//                   breakout_*/sequence/candle_pattern/chart_pattern/liquidity.sweep/
//                   divergence/external.signal/percent_change/detect.indicator_boundary 等）
//   'structural' —— 非 predicate-class atom：scope.* / action.* / risk.* /
//                   orchestration program.* / portfolioRisk.* / positionConstraint.* /
//                   gate.* / strategy.time_window / execution.on_start。这些 atom
//                   不进入 SemanticRule.condition 谓词树，不会作为 IR PredicateDef
//                   leaf 出现。旧版被硬贴 'event' 的条目（action.* / risk.* /
//                   scope.* / orchestration.* 等）统一收敛到此值。
//
// 反向不变量：__tests__/atom-temporality.invariant.spec.ts。
const ATOM_TEMPORALITY = {
  // ── 状态类：持续真值 ──
  'indicator.above': 'state',
  'indicator.below': 'state',
  'oscillator.rsi_lte': 'state',
  'oscillator.rsi_gte': 'state',
  'price.range_position_lte': 'state',
  'price.range_position_gte': 'state',
  'volume.threshold': 'state',
  'volatility.atr_threshold': 'state',
  'position.has_position': 'state',
  'position.no_position': 'state',
  'trend.direction': 'state',
  'market.regime': 'state',
  'volatility.state': 'state',
  // 时间窗与启动事件 / gate / portfolioRisk → review round 1 M4 收敛为 'structural'。
  //   这些 atom 不进入 SemanticRule.condition 谓词树，不会作为 entry rule 的 IR
  //   leaf 谓词出现，按 atom 层语义属 structural（非 predicate-class）。
  //   compiler 层 entry-rule event-leaf invariant 不读本表，由 PREDICATE_KIND_TEMPORALITY
  //   独立判定，故 'structural' 标注不影响 #1457 闸逻辑。
  'strategy.time_window': 'structural',
  'gate.regime': 'structural',
  'gate.subStrategy': 'structural',
  'portfolioRisk.drawdown_block': 'structural',
  'portfolioRisk.symbol_exposure_cap': 'structural',
  'portfolioRisk.substrategy_exposure_cap': 'structural',

  // ── 事件类：rising-edge / 一次性触发 ──
  'indicator.cross_over': 'event',
  'indicator.cross_under': 'event',
  'indicator.divergence': 'event',
  'bollinger.touch_upper': 'event',
  'bollinger.touch_lower': 'event',
  'bollinger.touch_middle': 'event',
  'price.breakout_up': 'event',
  'price.breakout_down': 'event',
  'price.percent_change': 'event',
  'price.candle_pattern': 'event',
  'price.chart_pattern': 'event',
  'price.detect.indicator_boundary': 'event',
  'price.previous_extrema_retest': 'event',
  'liquidity.sweep': 'event',
  'external.signal': 'event',
  'condition.sequence': 'event',
  // 启动事件 → review round 1 M4：非 predicate-class，归 structural
  'execution.on_start': 'structural',

  // ── action / risk / positionConstraint / orchestration program / scope ──
  // review round 1 M4：旧版硬贴 'event' 在语义上错乱（action 副作用不是触发谓词，
  //   risk atom 既能作为触发谓词又能作为副作用，scope 完全是执行上下文）。统一
  //   归为 'structural' 表达"非 predicate-class atom，已审计"。
  'action.add_position': 'structural',
  'action.reverse_position': 'structural',
  'action.open_long': 'structural',
  'action.close_long': 'structural',
  'action.open_short': 'structural',
  'action.close_short': 'structural',

  'risk.stop_loss_pct': 'structural',
  'risk.take_profit_pct': 'structural',
  'risk.atr_stop': 'structural',
  'risk.atr_take_profit': 'structural',
  'risk.partial_take_profit': 'structural',

  'position.dca_schedule': 'structural',
  'position.pyramiding_limit': 'structural',
  'grid.range_rebalance': 'structural',

  'program.dynamic_grid': 'structural',
  'program.fixed_grid_gated': 'structural',
  'program.adaptive_volatility_grid': 'structural',
  'program.event_listener': 'structural',

  'scope.symbol': 'structural',
  'scope.leg': 'structural',
  'scope.timeframe': 'structural',
  'scope.dataSource': 'structural',
  'scope.subStrategy': 'structural',
} as const satisfies Record<AtomContractKey, 'state' | 'event' | 'structural'>

export function getAtomTemporality(key: AtomContractKey): 'state' | 'event' | 'structural' {
  return ATOM_TEMPORALITY[key]
}

// Public bucket helpers — 单一对外 API，模块外消费方禁止再读 ATOM_BUCKETS（已 private）
export function getAllRegisteredAtomKeys(): readonly AtomContractKey[] {
  return Object.keys(ATOM_CONTRACT_REGISTRY) as AtomContractKey[]
}

export function getAtomBucket(key: AtomContractKey): AtomContractBucket {
  return ATOM_CONTRACT_REGISTRY[key].bucket
}

export function getAtomKeysByBucket(bucket: AtomContractBucket): readonly AtomContractKey[] {
  return getAllRegisteredAtomKeys().filter(k => ATOM_CONTRACT_REGISTRY[k].bucket === bucket)
}

// Issue #1279 PR1c: 36 atom 的 display.publicName 单一 Record<key, {zh, en}> 真相源
// （review M1：消除 zh / en 双表漂移；review H1：zh 端"卫语句"统一为"护栏"）。
//
// 翻译来源优先级：
//   1. apps/front/public/locales/{zh,en}/common.json 已有 ai-quant 术语（"Max Drawdown" / "Breakout" / "Grid" 等）
//   2. 通用金融术语对照表（"上穿"→"cross above" / "突破"→"breakout" / "区间"→"range" /
//      "网格"→"grid" / "止盈"→"take profit" / "止损"→"stop loss" / "护栏"→"guard"）
//   3. atom semantics 上下文（护栏 = guard、补仓 = DCA schedule、反手 = position reversal）
//
// 不变量（display-publicname-en-coverage.spec.ts 运行时断言）：
//   (1) zh 与 en 均非空  (2) en !== zh  (3) en 不含 CJK 字符
//
// renderer / paramRenderers / summaryTemplate 完整迁移在 PR3c 与 display-token-table 删除原子完成。
const ATOM_PUBLIC_NAMES = {
  'volume.threshold': { zh: '成交量阈值', en: 'Volume threshold' },
  'volatility.atr_threshold': { zh: 'ATR 波动率阈值', en: 'ATR volatility threshold' },
  'strategy.time_window': { zh: '交易时间窗口', en: 'Trading time window' },
  'oscillator.rsi_lte': { zh: 'RSI 低于阈值', en: 'RSI below threshold' },
  'oscillator.rsi_gte': { zh: 'RSI 高于阈值', en: 'RSI above threshold' },
  'indicator.divergence': { zh: '指标背离', en: 'Indicator divergence' },
  'price.candle_pattern': { zh: 'K 线形态', en: 'Candlestick pattern' },
  'price.chart_pattern': { zh: '图形形态', en: 'Chart pattern' },
  'liquidity.sweep': { zh: '流动性扫荡', en: 'Liquidity sweep' },
  'external.signal': { zh: '外部喊单 / Webhook 信号', en: 'Third-party call / Webhook signal' },
  'position.has_position': { zh: '已有仓位护栏', en: 'Has position guard' },
  'position.no_position': { zh: '无仓位护栏', en: 'No position guard' },
  'bollinger.touch_upper': { zh: '触及布林上轨', en: 'Touch Bollinger upper band' },
  'bollinger.touch_lower': { zh: '触及布林下轨', en: 'Touch Bollinger lower band' },
  'bollinger.touch_middle': { zh: '触及布林中轨', en: 'Touch Bollinger middle band' },
  'price.percent_change': { zh: '价格百分比变化', en: 'Price percent change' },
  'price.breakout_up': { zh: '向上突破', en: 'Upside breakout' },
  'price.breakout_down': { zh: '向下跌破', en: 'Downside breakdown' },
  'price.detect.indicator_boundary': { zh: '价格触及指标边界', en: 'Price touch on indicator boundary' },
  'indicator.cross_over': { zh: '指标上穿', en: 'Indicator cross above' },
  'indicator.cross_under': { zh: '指标下穿', en: 'Indicator cross below' },
  'indicator.above': { zh: '指标高于阈值', en: 'Indicator above threshold' },
  'indicator.below': { zh: '指标低于阈值', en: 'Indicator below threshold' },
  'execution.on_start': { zh: '启动后执行', en: 'Run on strategy start' },
  'trend.direction': { zh: '趋势方向', en: 'Trend direction' },
  'market.regime': { zh: '市场状态', en: 'Market regime' },
  'volatility.state': { zh: '波动率状态', en: 'Volatility state' },
  'price.range_position_lte': { zh: '区间低位', en: 'Below range low' },
  'price.range_position_gte': { zh: '区间高位', en: 'Above range high' },
  'action.add_position': { zh: '加仓', en: 'Add to position' },
  'action.reverse_position': { zh: '反手', en: 'Reverse position' },
  'action.open_long': { zh: '开多', en: 'Open long' },
  'action.close_long': { zh: '平多', en: 'Close long' },
  'action.open_short': { zh: '开空', en: 'Open short' },
  'action.close_short': { zh: '平空', en: 'Close short' },
  'risk.stop_loss_pct': { zh: '百分比止损', en: 'Percent stop loss' },
  'risk.take_profit_pct': { zh: '百分比止盈', en: 'Percent take profit' },
  'risk.atr_stop': { zh: 'ATR 动态止损', en: 'ATR stop' },
  'risk.partial_take_profit': { zh: '分批止盈', en: 'Partial take profit' },
  'portfolioRisk.drawdown_block': { zh: '组合回撤护栏', en: 'Portfolio drawdown guard' },
  'position.dca_schedule': { zh: 'DCA 补仓计划', en: 'DCA schedule' },
  'position.pyramiding_limit': { zh: '金字塔加仓限制', en: 'Pyramiding limit' },
  'grid.range_rebalance': { zh: '网格区间再平衡', en: 'Grid range rebalance' },
  // ── orchestration / scope（#1329 follow-up：stub publicName，Phase 2 完整实现 paramRenderers / summaryTemplate）──
  'gate.regime': { zh: '趋势/状态过滤', en: 'Regime/Trend gate' },
  'portfolioRisk.symbol_exposure_cap': { zh: '标的敞口护栏', en: 'Symbol exposure cap' },
  'portfolioRisk.substrategy_exposure_cap': { zh: '子策略敞口护栏', en: 'Substrategy exposure cap' },
  'program.dynamic_grid': { zh: '动态网格', en: 'Dynamic grid program' },
  'program.fixed_grid_gated': { zh: '门控固定网格', en: 'Fixed grid (gated)' },
  'program.adaptive_volatility_grid': { zh: 'ATR 自适应网格', en: 'Adaptive volatility grid' },
  'program.event_listener': { zh: '事件监听', en: 'Event listener program' },
  'scope.symbol': { zh: '标的范围', en: 'Symbol scope' },
  'scope.leg': { zh: '策略腿', en: 'Leg scope' },
  'scope.timeframe': { zh: '周期范围', en: 'Timeframe scope' },
  'scope.dataSource': { zh: '数据源', en: 'Data source scope' },
  'scope.subStrategy': { zh: '子策略范围', en: 'Sub-strategy scope' },
  'gate.subStrategy': { zh: '子策略 gate', en: 'Sub-strategy gate' },
  // Issue #1395：新 atom
  'condition.sequence': { zh: '条件序列', en: 'Condition sequence' },
  'price.previous_extrema_retest': { zh: '突破后回踩', en: 'Previous extrema retest' },
  'risk.atr_take_profit': { zh: 'ATR 动态止盈', en: 'ATR take profit' },
} as const satisfies Record<AtomContractKey, { zh: string; en: string }>

export { ATOM_PUBLIC_NAMES }

// Issue #1279 PR3e：non-condition bucket atom 的 sentinel irShape。
//   被错误调用时 fail-loud 抛 PR3e 错误，指引到 followup issue 的 emit.* 多接口设计。
//   实际上 dispatcher `compileAtom`（canonical-spec-v2-ir-compiler.service.ts L1331）
//   先按 `capabilityStatus === 'pr3a-condition'` 分流，'irshape-not-applicable' 永远
//   走不到 `emit.irShape(atom, ctx)` 路径，本 sentinel 仅作为 fail-closed 兜底。
function createNotApplicableIrShape(key: AtomContractKey): NotApplicableIrShapeBuilder {
  const sentinel = ((): string => {
    throw new Error(
      `[#1279 PR3e] emit.irShape not applicable for ${key} — atom routes via rule-level / spec-level IR compile paths; see followup issue for emit.* multi-shape design`,
    )
  }) as AtomContractEmit['irShape']
  return Object.assign(sentinel, { __notApplicable: true as const })
}

// Issue #1279 PR1c: createPr1bDisplay 接受 {zh, en} 对象解构（review M2：消除位置参数顺序错陷阱）。
// paramRenderers / summaryTemplate 仍保留 PR1b stub 结构（{} / () => zh）—— renderer 迁移见 PR3c。
function createPr1bDisplay({ zh, en }: { zh: string; en: string }): AtomContractDisplay {
  return {
    publicName: { zh, en },
    paramRenderers: {},
    summaryTemplate: () => zh,
  }
}

// Issue #1279 PR3e：默认 emit 状态 = `irshape-not-applicable`。
//   condition predicate 类 atom 由 `completePr1bRegistry` 用 `CONDITION_ATOM_EMITS[key]`
//   覆盖（capabilityStatus → 'pr3a-condition'，irShape → 真实实现），其余 atom 保持
//   `irshape-not-applicable`，显式声明 emit.irShape 接口不适用（参见
//   atom-contract-emit.types.ts `capabilityStatus` 字段注释）。
//   函数名保留 `createPr1bEmit` 以维持上游调用点稳定；未来在 emit.* 多接口设计落地后
//   可改名为 `createBaseEmit`。
function createPr1bEmit(key: AtomContractKey, bucket: AtomContractBucket): NotApplicableEmit {
  const [domain, ...objectParts] = key.split('.')
  return {
    capability: {
      domain: bucket,
      verb: 'emit',
      object: objectParts.length > 0 ? objectParts.join('.') : domain,
    },
    capabilityStatus: 'irshape-not-applicable',
    irShape: createNotApplicableIrShape(key),
    evidenceSource: bucket === 'positionConstraint' || bucket === 'orchestration' ? 'segment' : 'clause',
  }
}

function completePr1bRegistry<const T extends Record<AtomContractKey, AtomContractSeed>>(
  registry: T,
): CompletedPr1bRegistry<T> {
  const completed: Partial<Record<AtomContractKey, AtomContract>> = {}
  for (const key of Object.keys(registry) as Array<keyof T & AtomContractKey>) {
    const bucket = ATOM_BUCKETS[key]
    // Issue #1279 PR3a Phase 2：emit 兑现优先级：
    //   1. seed 显式 `emit`（PR3d/PR3e 的 action/risk 类 atom 走此路）
    //   2. `createPr1bEmit` 基底 + `CONDITION_ATOM_EMITS[key]` 覆盖 capabilityStatus/irShape
    //      （本 PR 兑现的 23 个 condition predicate 类 atom；capability 三元组与
    //      evidenceSource 由 base 继承，与 dispatcher self-baseline snapshot 一致）
    //   3. 纯 `createPr1bEmit` 生成的 stub emit（仍未兑现 atom 兜底，调用即抛 PR1b stub 错误）
    const baseEmit = createPr1bEmit(key, bucket)
    const conditionOverride = (CONDITION_ATOM_EMITS as Partial<Record<AtomContractKey, ConditionEmitOverride>>)[key]
    // Issue #1313 PR2：rule-level RiskGuard 类 atom 注入 `riskGuardShape` override，
    //   capabilityStatus 改写为 'pr3e-risk-guard'；irShape 仍保留 NotApplicable sentinel
    //   （compileAtom dispatcher 内 'pr3e-*' 状态不会走 emit.irShape 路径）。
    // Issue #1313 PR3：rule-level RuleBlock 类 atom 注入 `ruleBlockShape` override，
    //   capabilityStatus 改写为 'pr3e-rule-block'。三类 override（condition / risk-guard /
    //   rule-block）在 ATOM_CONTRACT_REGISTRY 层面互斥，spread 顺序不会出现字段冲突。
    const riskGuardOverride = (RISK_GUARD_ATOM_EMITS as Partial<Record<AtomContractKey, RiskGuardEmitOverride>>)[key]
    // Issue #1313 PR4：lifecycle-level atom（`position.pyramiding_limit`）通过独立 override
    //   注入 `emit.lifecyclePyramidingShape` + `capabilityStatus = 'pr3e-lifecycle'`。
    // Issue #1313 PR3：rule-block atom（`risk.partial_take_profit`）通过 RULE_BLOCK_ATOM_EMITS
    //   注入 `emit.ruleBlockShape` + `capabilityStatus = 'pr3e-rule-block'`。
    //   condition / riskGuard / lifecycle / ruleBlock 四组互斥（不同 atom），同一 atom
    //   只会命中其中一组,spread 合并顺序不会冲突。
    const lifecycleOverride = (LIFECYCLE_ATOM_EMITS as Partial<Record<AtomContractKey, LifecycleEmitOverride>>)[key]
    const ruleBlockOverride = (RULE_BLOCK_ATOM_EMITS as Partial<Record<AtomContractKey, RuleBlockEmitOverride>>)[key]
    const orchestrationOverride = (ORCHESTRATION_ATOM_EMITS as Partial<Record<AtomContractKey, OrchestrationEmitOverride>>)[key]
    // Issue #1313 PR5c：6 个 action atom（`action.open_long` / `action.close_long` /
    //   `action.open_short` / `action.close_short` / `action.add_position` /
    //   `action.reverse_position`）通过 ACTION_ATOM_EMITS 注入 `emit.actionShape` +
    //   `capabilityStatus = 'pr3e-action'`。与其余四组 override 互斥（atom 不重叠），
    //   spread 合并顺序不会冲突。
    const actionOverride = (ACTION_ATOM_EMITS as Partial<Record<AtomContractKey, ActionEmitOverride>>)[key]
    const mergedEmit: AtomContractEmit = {
      ...baseEmit,
      ...(conditionOverride ?? {}),
      ...(riskGuardOverride ?? {}),
      ...(lifecycleOverride ?? {}),
      ...(ruleBlockOverride ?? {}),
      ...(orchestrationOverride ?? {}),
      ...(actionOverride ?? {}),
    }
    completed[key] = {
      ...registry[key],
      key,
      bucket,
      // Issue #1395：从 ATOM_ROLES 单一真相源注入。
      roles: ATOM_ROLES[key],
      display: registry[key].display ?? createPr1bDisplay(ATOM_PUBLIC_NAMES[key]),
      corpus: registry[key].corpus,
      emit: registry[key].emit ?? mergedEmit,
      // Issue #1383 Lane A：从 ATOM_FULFILLS_STRATEGY_PHASE 单一真相源注入。
      fulfillsStrategyPhase: ATOM_FULFILLS_STRATEGY_PHASE[key],
      // Issue #1457 闸 2：从 ATOM_TEMPORALITY 单一真相源注入。
      temporality: ATOM_TEMPORALITY[key],
    } as AtomContract
  }
  return completed as CompletedPr1bRegistry<T>
}

// =========================================================
// 注册表定义
// =========================================================

export const ATOM_CONTRACT_REGISTRY = completePr1bRegistry({
  // ── 触发信号（triggers）── 通用流水线 + presentationRegistry 文案
  'volume.threshold': {
    corpus: {
      aliases: [
        '成交量过滤',
        '成交量条件',
        '量能阈值',
      ],
      positiveExamples: [
        '成交量大于 1000 时允许入场',
        '成交额超过 500 万时开多',
      ],
      negativeExamples: [
        '只用均量倍数过滤',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('volume.threshold'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'volume.threshold.value') return '请给出成交量阈值，例如 1000（成交量单位：张/枚）或 500000（成交额单位：USDT）。'
      if (slotKey === 'volume.threshold.operator') return '请指明比较方向：GT（大于）/ GTE（不低于）/ LT（小于）/ LTE（不高于）。'
      if (slotKey === 'volume.threshold.metric') return '请指明量的类型：base_volume（成交量）或 quote_volume（成交额）。'
      return '请补充成交量阈值条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['volume.threshold'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        operator: (v, locale) => SHARED_ENUM_DISPLAY.operator[v as keyof typeof SHARED_ENUM_DISPLAY.operator]?.[locale] ?? String(v),
        metric: (v, locale) => ATOM_PRIVATE_DISPLAY.volumeMetric[v as keyof typeof ATOM_PRIVATE_DISPLAY.volumeMetric]?.[locale] ?? String(v),
        value: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['volume.threshold'].en
        // Issue #1395：均量倍数模式优先渲染
        if (params.mode === 'relative_to_sma' && typeof params.multiplier === 'number') {
          const refWindow = typeof params.refWindow === 'number' ? params.refWindow : 20
          return `成交量 > ${params.multiplier} × ${refWindow} 根均量`
        }
        const metric = typeof params.metric === 'string' ? params.metric : 'base_volume'
        const op = typeof params.operator === 'string' ? params.operator : 'GT'
        const value = typeof params.value === 'number' ? params.value : 0
        const metricLabel = ATOM_PRIVATE_DISPLAY.volumeMetric[metric as keyof typeof ATOM_PRIVATE_DISPLAY.volumeMetric]?.zh ?? metric
        const opLabel = SHARED_ENUM_DISPLAY.operator[op as keyof typeof SHARED_ENUM_DISPLAY.operator]?.zh ?? op
        return `${metricLabel}${opLabel}${value}`
      },
    },
    surface: {
      intent: {
        // Issue #1395 W7.4：补 '倍均量' / '倍量' / '×' / 'times' / 'multiplier' 覆盖均量倍数表达
        keywords: ['成交量', '量能', '放量', 'volume', '倍均量', '倍量', '×', 'times', 'multiplier'] as const,
        verbs: {
          gte: ['大于', '超过', 'gte', 'greater than', 'exceeds'] as const,
        },
      },
      paramSlots: {
        operator: { kind: 'enum', required: false, enum: ['GT', 'GTE', 'LT', 'LTE'], default: 'GT', extractor: { kind: 'enum-zh-map', enumMap: { '大于': 'GT', '超过': 'GT', '大于等于': 'GTE', '小于': 'LT', '低于': 'LT', '小于等于': 'LTE' } } },
        metric: { kind: 'enum', required: false, enum: ['base_volume', 'quote_volume'], default: 'base_volume', extractor: { kind: 'enum-zh-map', enumMap: { '成交量': 'base_volume', '量能': 'base_volume', '成交额': 'quote_volume' } } },
        value: { kind: 'number', required: false, range: [0, 1e12], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        // Issue #1395 W7.4：均量倍数模式（absolute / relative_to_sma）
        //   mode=relative_to_sma 时 multiplier 必填；refWindow 推荐 20 根 SMA。
        //   slot default 不在此处注入（避免污染 dispatcher self-baseline），由下游 IR compile
        //   兜底（mode 缺省视为 absolute、refWindow 缺省视为 20）。
        mode: { kind: 'enum', required: false, enum: ['absolute', 'relative_to_sma'], extractor: { kind: 'enum-zh-map', enumMap: { '倍均量': 'relative_to_sma', '倍量': 'relative_to_sma', '均量倍数': 'relative_to_sma' } } },
        // Issue #1395 mute-spider：multiplier 实际业务区间 0.1-100 倍；> 100 几乎一定是幻觉
        multiplier: { kind: 'number', required: false, range: [0.1, 100], extractor: { kind: 'number-decimal', pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:倍|×|x|times)' } },
        // refWindow 扩展专用：只在出现 "均量N" / "SMA N" / "N 根均量" 等带均线上下文的表达里抽取，
        //   避免与 value（裸数字）抢匹配（违反 dispatcher self-baseline 1 案例）。
        refWindow: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '(?:均量|均线|SMA|sma)\\s*(\\d+)', range: [1, 500] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [{
          keywords: ['放量', 'N 倍均量', 'X 倍成交量', '倍量', 'volume spike'],
          mustOutput: 'volume.threshold + mode="relative_to_sma" + multiplier=N + refWindow=20（或用户给出的窗口）；不能用 mode=absolute 的 GT 比较。',
        }],
        antiPatterns: [{
          mistake: 'dispatcher 可能只 lift 出 volume.relative_average 或漏抽 multiplier',
          fix: 'planner 必须按用户原话写 multiplier 与 refWindow 完整参数。',
        }],
      },
    },
  },

  'volatility.atr_threshold': {
    corpus: {
      aliases: [
        'ATR 过滤',
        'ATR 条件',
        'ATR 大于阈值',
        '平均真实波幅阈值',
      ],
      positiveExamples: [
        'ATR14 大于 50 才允许入场',
        'ATR 小于 100 时禁止开仓',
      ],
      negativeExamples: [
        '只用固定止损',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('volatility.atr_threshold'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'volatility.atr_threshold.period') return '请指定 ATR 计算周期，例如 14（常用默认值）。'
      if (slotKey === 'volatility.atr_threshold.threshold') return '请给出 ATR 阈值数值，例如 50。'
      if (slotKey === 'volatility.atr_threshold.thresholdUnit') return '请指定阈值单位：quote_currency（价格单位，如 USDT）或 pct（百分比）。'
      if (slotKey === 'volatility.atr_threshold.operator') return '请指明比较方向：GT（大于）/ GTE（不低于）/ LT（小于）/ LTE（不高于）。'
      return '请补充 ATR 波动率阈值条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['volatility.atr_threshold'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        operator: (v, locale) => SHARED_ENUM_DISPLAY.operator[v as keyof typeof SHARED_ENUM_DISPLAY.operator]?.[locale] ?? String(v),
        period: (v) => String(v),
        threshold: (v) => String(v),
        thresholdUnit: (v, locale) => locale === 'zh' ? (v === 'percent' ? '%' : '报价币') : (v === 'percent' ? '%' : 'quote currency'),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['volatility.atr_threshold'].en
        const op = typeof params.operator === 'string' ? params.operator : 'GT'
        const period = typeof params.period === 'number' ? params.period : 0
        const threshold = typeof params.threshold === 'number' ? params.threshold : 0
        const periodStr = period > 0 ? `ATR${period}` : 'ATR'
        const opLabel = SHARED_ENUM_DISPLAY.operator[op as keyof typeof SHARED_ENUM_DISPLAY.operator]?.zh ?? op
        return `${periodStr}${opLabel}${threshold}`
      },
    },
    surface: {
      intent: {
        keywords: ['ATR', 'atr', '波动率'] as const,
        verbs: {
          gte: ['大于', '超过', 'greater than'] as const,
          lte: ['小于', '低于', 'less than'] as const,
        },
      },
      paramSlots: {
        operator: { kind: 'enum', required: false, enum: ['GT', 'GTE', 'LT', 'LTE'], default: 'GT', extractor: { kind: 'enum-zh-map', enumMap: { '大于': 'GT', '超过': 'GT', '大于等于': 'GTE', '小于': 'LT', '低于': 'LT', '小于等于': 'LTE' } } },
        // #1497: ATR period 收紧到 [1, 100]（业务常用 14；> 100 几乎一定是幻觉）+ multipleOf:1
        period: { kind: 'number', required: false, range: [1, 100], multipleOf: 1, default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 100] } },
        threshold: { kind: 'number', required: false, range: [0, 1e6], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        thresholdUnit: { kind: 'enum', required: false, enum: ['quote_currency', 'percent'], default: 'quote_currency', extractor: { kind: 'enum-zh-map', enumMap: { 'USDT': 'quote_currency', 'USD': 'quote_currency', '%': 'percent' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'strategy.time_window': {
    corpus: {
      aliases: [
        '时间段过滤',
        '交易时段',
        '开仓时间',
        '允许开仓时间',
      ],
      positiveExamples: [
        '北京时间 9:30-11:30 内允许开仓',
        'allow entries between 09:30-11:30 UTC',
      ],
      negativeExamples: [
        '不限制开仓时间',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('strategy.time_window'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'strategy.time_window.timezone') return '请指定时区，例如 Asia/Shanghai（北京时间）或 UTC。'
      if (slotKey === 'strategy.time_window.windows') return '请指定允许开仓的时间段，例如 09:30-11:30（24小时制，可有多段）。'
      return '请补充交易时间窗口条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['strategy.time_window'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        timezone: (v) => String(v),
        windows: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['strategy.time_window'].en
        const timezone = typeof params.timezone === 'string' ? params.timezone : 'UTC'
        const windowsRaw = typeof params.windows === 'string' ? params.windows : null
        let windowsStr = ''
        if (windowsRaw) {
          try {
            const arr = JSON.parse(windowsRaw) as Array<{ start: string; end: string }>
            windowsStr = arr.map(w => `${w.start}-${w.end}`).join(', ')
          }
          catch {
            windowsStr = windowsRaw
          }
        }
        return windowsStr ? `交易时间窗口（${timezone}）：${windowsStr}` : `交易时间窗口（${timezone}）`
      },
    },
    surface: {
      intent: {
        keywords: ['时间窗口', '北京时间', 'time window', 'allow entries', 'trade during'] as const,
        verbs: {
          fixed: ['内允许', '内开仓', 'between', 'during'] as const,
        },
      },
      paramSlots: {
        timezone: { kind: 'enum', required: false, enum: ['Asia/Shanghai', 'UTC'], extractor: { kind: 'enum-zh-map', enumMap: { '北京时间': 'Asia/Shanghai', '北京': 'Asia/Shanghai', 'UTC': 'UTC' } } },
        windows: { kind: 'duration', required: false, extractor: { kind: 'time-window-list' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'oscillator.rsi_lte': {
    corpus: {
      aliases: [
        'RSI 超卖',
        'RSI 不高于',
      ],
      positiveExamples: [
        'RSI 小于 30',
      ],
      negativeExamples: [
        'RSI 大于 70',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('oscillator.rsi_lte'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充 RSI 阈值（0-100，常用：超卖 30 / 超买 70）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['oscillator.rsi_lte'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        period: (v) => String(v),
        value: (v) => String(v),
        thresholdRole: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['oscillator.rsi_lte'].en
        const period = typeof params.period === 'number' ? params.period : 14
        const value = typeof params.value === 'number' ? params.value : null
        return value !== null ? `RSI${period} 低于或等于 ${value}` : `RSI${period} 低于或等于阈值`
      },
    },
    surface: {
      intent: {
        keywords: ['RSI', 'rsi'] as const,
        verbs: {
          lte: ['≤', '<=', '低于或等于', '小于等于', '不高于', '低于', '小于', '下方', '跌破', 'below', 'under', 'less than or equal', 'less than', 'falls below', 'drops below'] as const,
        },
      },
      paramSlots: {
        // Issue #1395 mute-spider：period/value 必为整数；value 严格 0-100。
        period: { kind: 'number', required: false, range: [1, 200], multipleOf: 1, default: 14, extractor: { kind: 'number-int', pattern: 'RSI\\s*\\(?\\s*(\\d+)', range: [1, 200] } },
        value: { kind: 'number', required: true, range: [0, 100], multipleOf: 1, extractor: { kind: 'number-int', pattern: '(?:≤|<=|低于或等于|小于等于|不高于|低于|小于|下方|跌破|below|under|less than or equal|less than|falls below|drops below)\\s*(\\d+)', range: [0, 100] } },
        thresholdRole: { kind: 'enum', required: false, enum: ['lower_threshold'], default: 'lower_threshold' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        paramDefaultsHint: 'RSI：{ period: 14 } —— 默认周期；用户给出阈值时填 value，未给阈值不要硬塞。',
      },
    },
  },

  'oscillator.rsi_gte': {
    corpus: {
      aliases: [
        'RSI 超买',
        'RSI 不低于',
      ],
      positiveExamples: [
        'RSI 大于 70',
      ],
      negativeExamples: [
        'RSI 小于 30',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('oscillator.rsi_gte'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充 RSI 阈值（0-100，常用：超卖 30 / 超买 70）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['oscillator.rsi_gte'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        period: (v) => String(v),
        value: (v) => String(v),
        thresholdRole: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['oscillator.rsi_gte'].en
        const period = typeof params.period === 'number' ? params.period : 14
        const value = typeof params.value === 'number' ? params.value : null
        return value !== null ? `RSI${period} 高于或等于 ${value}` : `RSI${period} 高于或等于阈值`
      },
    },
    surface: {
      intent: {
        keywords: ['RSI', 'rsi', '超买'] as const,
        verbs: {
          gte: ['≥', '>=', '高于或等于', '大于等于', '不低于', '高于', '大于', '超过', '上方', 'above', 'over', 'greater than or equal', 'greater than'] as const,
        },
      },
      paramSlots: {
        // Issue #1395 mute-spider：period/value 必为整数；value 严格 0-100。
        period: { kind: 'number', required: false, range: [1, 200], multipleOf: 1, default: 14, extractor: { kind: 'number-int', pattern: 'RSI\\s*\\(?\\s*(\\d+)', range: [1, 200] } },
        value: { kind: 'number', required: true, range: [0, 100], multipleOf: 1, extractor: { kind: 'number-int', pattern: '(?:≥|>=|高于或等于|大于等于|不低于|高于|大于|超过|上方|above|over|greater than or equal|greater than)\\s*(\\d+)', range: [0, 100] } },
        thresholdRole: { kind: 'enum', required: false, enum: ['upper_threshold'], default: 'upper_threshold' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        paramDefaultsHint: 'RSI：{ period: 14 } —— 默认周期；用户给出阈值时填 value，未给阈值不要硬塞。',
      },
    },
  },

  'bollinger.touch_upper': {
    corpus: {
      aliases: [
        '碰到上轨',
        '布林上轨触发',
      ],
      positiveExamples: [
        '触及 BOLL 上轨',
      ],
      negativeExamples: [
        '触及布林下轨',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('bollinger.touch_upper'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充布林带触及条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['bollinger.touch_upper'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        band: (v, locale) => SHARED_ENUM_DISPLAY.boundaryRole[v as keyof typeof SHARED_ENUM_DISPLAY.boundaryRole]?.[locale] ?? String(v),
        period: (v) => String(v),
        stdDev: (v) => String(v),
        confirmationMode: (v, locale) => locale === 'zh' ? (v === 'touch' ? '触及' : v === 'breakout' ? '突破' : v === 'close' ? '收盘确认' : String(v)) : (v === 'touch' ? 'touch' : v === 'breakout' ? 'breakout' : v === 'close' ? 'close confirmation' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['bollinger.touch_upper'].en
        const period = typeof params.period === 'number' ? params.period : 20
        const stdDev = typeof params.stdDev === 'number' ? params.stdDev : 2
        // Issue #1391 review M7：summaryTemplate 显式渲染 confirmationMode 区分字段，
        //   避免 touch（触及）vs breakout（突破）vs close（收盘确认）渲染相同被误折叠。
        const mode = typeof params.confirmationMode === 'string' ? params.confirmationMode : ''
        const modeSuffix = mode === 'breakout' ? '突破' : mode === 'close' ? '收盘确认' : '触及'
        return `BOLL（${period}, ${stdDev}）上轨${modeSuffix}`
      },
    },
    surface: {
      intent: {
        // 'boll' 短形式 alias 接住用户简写（如 "boll 上轨开空"）
        keywords: ['布林带', '布林线', 'bollinger', 'boll', '上轨'] as const,
        verbs: {
          // touch verb 兼收 "做空/开空"——"上轨开空"等价"触及上轨开空"
          //   action verb 自带方向；sideResolver:inherit + explicitActionSide 会派生正确 side
          touch_upper: ['触及', '碰到', '到达', 'touch', 'reaches', '做空', '开空'] as const,
          breakout_up: ['突破', '上破', 'breakout'] as const,
        },
      },
      // 跨子句对偶：与 touch_lower 互为镜像，inherit period/stdDev
      crossClauseInheritFrom: 'bollinger.touch_lower',
      inheritParams: ['period', 'stdDev'],
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['upper'], default: 'upper' },
        // Issue #1391：BOLL period / stdDev 必须只在 BOLL / 布林带 / 布林线 词根紧跟的
        //   句法上下文里抽取，否则"15min"/"BOLL(20,2)" 中其它数字会被误抢。
        //   pattern 兼容三种合法写法（按宽容度递增）：
        //     1) "BOLL(20,2)" / "布林带(20,2)"——括号 + 逗号
        //     2) "BOLL 20 周期、2 倍标准差"——空格 + 数字（period）/ "标准差" 关键字（stdDev）
        //     3) "布林上轨" / "boll 上轨"——无数字，回落 default
        // #1497: BOLL period 收紧到 [2, 200]（业务标准 SMA 窗口下限 2，上限 200）；stdDev 收紧到 [0.5, 5] + multipleOf 0.1
        period: { kind: 'number', required: false, range: [2, 200], multipleOf: 1, default: 20, extractor: { kind: 'number-int', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*(?:[（(]\\s*(\\d+)|(\\d+)\\s*(?:周期|天|根)?)', range: [2, 200] } },
        stdDev: { kind: 'number', required: false, range: [0.5, 5], multipleOf: 0.1, default: 2, extractor: { kind: 'number-decimal', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*[（(]\\s*\\d+\\s*[,，]\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:倍\\s*)?标准差', range: [0.5, 5] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [{
          keywords: ['布林', 'BOLL', 'Bollinger', '上轨触及'],
          mustOutput: 'bollinger.touch_upper；assistantPrompt 必须保留「布林」字样，禁止抹平为「价格突破」。',
        }],
        paramDefaultsHint: 'Bollinger：{ period: 20, stdDev: 2 } —— 默认参数。',
      },
    },
  },

  'bollinger.touch_lower': {
    corpus: {
      aliases: [
        '碰到下轨',
        '布林下轨触发',
      ],
      positiveExamples: [
        '触及 BOLL 下轨',
      ],
      negativeExamples: [
        '触及布林上轨',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('bollinger.touch_lower'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充布林带触及条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['bollinger.touch_lower'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        band: (v, locale) => SHARED_ENUM_DISPLAY.boundaryRole[v as keyof typeof SHARED_ENUM_DISPLAY.boundaryRole]?.[locale] ?? String(v),
        period: (v) => String(v),
        stdDev: (v) => String(v),
        confirmationMode: (v, locale) => locale === 'zh' ? (v === 'touch' ? '触及' : v === 'breakout' ? '突破' : v === 'close' ? '收盘确认' : String(v)) : (v === 'touch' ? 'touch' : v === 'breakout' ? 'breakout' : v === 'close' ? 'close confirmation' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['bollinger.touch_lower'].en
        const period = typeof params.period === 'number' ? params.period : 20
        const stdDev = typeof params.stdDev === 'number' ? params.stdDev : 2
        const mode = typeof params.confirmationMode === 'string' ? params.confirmationMode : ''
        const modeSuffix = mode === 'breakout' ? '突破' : mode === 'close' ? '收盘确认' : '触及'
        return `BOLL（${period}, ${stdDev}）下轨${modeSuffix}`
      },
    },
    surface: {
      intent: {
        keywords: ['布林带', '布林线', 'bollinger', 'boll', '下轨'] as const,
        verbs: {
          // touch verb 兼收 "做多/开多"——"下轨开多"等价"触及下轨开多"
          touch_lower: ['触及', '碰到', '到达', 'touch', 'reaches', '做多', '开多'] as const,
          breakout_down: ['跌破', '下破', 'breakdown'] as const,
        },
      },
      crossClauseInheritFrom: 'bollinger.touch_upper',
      inheritParams: ['period', 'stdDev'],
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['lower'], default: 'lower' },
        // Issue #1391：BOLL period / stdDev 必须只在 BOLL / 布林带 / 布林线 词根紧跟的
        //   句法上下文里抽取，否则"15min"/"BOLL(20,2)" 中其它数字会被误抢。
        //   pattern 兼容三种合法写法（按宽容度递增）：
        //     1) "BOLL(20,2)" / "布林带(20,2)"——括号 + 逗号
        //     2) "BOLL 20 周期、2 倍标准差"——空格 + 数字（period）/ "标准差" 关键字（stdDev）
        //     3) "布林上轨" / "boll 上轨"——无数字，回落 default
        // #1497: BOLL period 收紧到 [2, 200]（业务标准 SMA 窗口下限 2，上限 200）；stdDev 收紧到 [0.5, 5] + multipleOf 0.1
        period: { kind: 'number', required: false, range: [2, 200], multipleOf: 1, default: 20, extractor: { kind: 'number-int', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*(?:[（(]\\s*(\\d+)|(\\d+)\\s*(?:周期|天|根)?)', range: [2, 200] } },
        stdDev: { kind: 'number', required: false, range: [0.5, 5], multipleOf: 0.1, default: 2, extractor: { kind: 'number-decimal', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*[（(]\\s*\\d+\\s*[,，]\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:倍\\s*)?标准差', range: [0.5, 5] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [{
          keywords: ['布林', 'BOLL', 'Bollinger', '下轨触及'],
          mustOutput: 'bollinger.touch_lower；assistantPrompt 必须保留「布林」字样，禁止抹平为「价格突破」。',
        }],
      },
    },
  },

  'bollinger.touch_middle': {
    corpus: {
      aliases: [
        '碰到中轨',
        '布林中轨触发',
      ],
      positiveExamples: [
        '触及 BOLL 中轨',
      ],
      negativeExamples: [
        '突破布林上轨',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('bollinger.touch_middle'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充布林带触及条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['bollinger.touch_middle'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        band: (v, locale) => SHARED_ENUM_DISPLAY.boundaryRole[v as keyof typeof SHARED_ENUM_DISPLAY.boundaryRole]?.[locale] ?? String(v),
        period: (v) => String(v),
        stdDev: (v) => String(v),
        confirmationMode: (v, locale) => locale === 'zh' ? (v === 'touch' ? '触及' : v === 'breakout' ? '突破' : v === 'close' ? '收盘确认' : String(v)) : (v === 'touch' ? 'touch' : v === 'breakout' ? 'breakout' : v === 'close' ? 'close confirmation' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['bollinger.touch_middle'].en
        const period = typeof params.period === 'number' ? params.period : 20
        const stdDev = typeof params.stdDev === 'number' ? params.stdDev : 2
        const mode = typeof params.confirmationMode === 'string' ? params.confirmationMode : ''
        const modeSuffix = mode === 'breakout' ? '突破' : mode === 'close' ? '收盘确认' : '触及'
        return `BOLL（${period}, ${stdDev}）中轨${modeSuffix}`
      },
    },
    surface: {
      intent: {
        // 收紧 keyword 到"中轨/中线"独占：避免跟 touch_upper/lower 共享 '布林带' 词根
        //   被其他子句（"跌破下轨"含布林带 kw）误命中。
        // Issue #1391 review m6：补英文 keyword 'middle' / 'bollinger middle'
        //   覆盖英文表达；不引入 'bollinger' 单 token（仍会触发上面词根误命中问题）。
        keywords: ['中轨', '中线', 'middle', 'bollinger middle'] as const,
        verbs: {
          // 多/空单平仓回到中轨表达："价格回到布林带中轨时平仓" / "跌破中轨平仓"
          touch_middle: ['触及', '回踩', '碰到', '回到', '回归', 'touch', 'retest'] as const,
          breakout_down: ['跌破', '下破'] as const,
        },
      },
      // 中轨入场/出场两个场景对偶 → 自镜像：同 atom 不同 phase 共享 period/stdDev
      crossClauseInheritFrom: 'self',
      inheritParams: ['period', 'stdDev'],
      paramSlots: {
        band: { kind: 'enum', required: false, enum: ['middle'], default: 'middle' },
        // Issue #1391：BOLL period / stdDev 必须只在 BOLL / 布林带 / 布林线 词根紧跟的
        //   句法上下文里抽取，否则"15min"/"BOLL(20,2)" 中其它数字会被误抢。
        //   pattern 兼容三种合法写法（按宽容度递增）：
        //     1) "BOLL(20,2)" / "布林带(20,2)"——括号 + 逗号
        //     2) "BOLL 20 周期、2 倍标准差"——空格 + 数字（period）/ "标准差" 关键字（stdDev）
        //     3) "布林上轨" / "boll 上轨"——无数字，回落 default
        // #1497: BOLL period 收紧到 [2, 200]（业务标准 SMA 窗口下限 2，上限 200）；stdDev 收紧到 [0.5, 5] + multipleOf 0.1
        period: { kind: 'number', required: false, range: [2, 200], multipleOf: 1, default: 20, extractor: { kind: 'number-int', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*(?:[（(]\\s*(\\d+)|(\\d+)\\s*(?:周期|天|根)?)', range: [2, 200] } },
        stdDev: { kind: 'number', required: false, range: [0.5, 5], multipleOf: 0.1, default: 2, extractor: { kind: 'number-decimal', pattern: '(?:BOLL|bollinger|布林带?|布林线)\\s*[（(]\\s*\\d+\\s*[,，]\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:倍\\s*)?标准差', range: [0.5, 5] } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '触碰': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘确认': 'close', '收盘': 'close' } } },
      },
      // 中轨触及/回归常作为趋势策略的"获利平仓"信号——保留 fixed-exit。
      //   入场子句若需用中轨做入场，dispatcher 仍能命中 trigger（只是 phase 固定 exit），
      //   下游可通过 dual phase 行为或显式 atom 扩展（如未来引入 touch_middle_entry）支持。
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  'price.percent_change': {
    corpus: {
      aliases: [
        '涨跌幅条件',
        '价格变化比例',
      ],
      positiveExamples: [
        '价格上涨 3% 后开多',
      ],
      negativeExamples: [
        '价格接近均线',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.percent_change'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充价格百分比变化条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.percent_change'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        direction: (v, locale) => SHARED_ENUM_DISPLAY.directionBias[v as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.[locale] ?? String(v),
        valuePct: (v) => `${v}%`,
        basis: (v, locale) => locale === 'zh' ? (v === 'prev_close' ? '上一根收盘价' : v === 'entry_avg_price' ? '入场均价' : v === 'current_price' ? '当前价' : String(v)) : (v === 'prev_close' ? 'prev close' : v === 'entry_avg_price' ? 'avg entry price' : v === 'current_price' ? 'current price' : String(v)),
        window: (v) => String(v),
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['price.percent_change'][locale],
    },
    surface: {
      intent: {
        keywords: ['价格', '收盘价', '涨跌幅', '百分比', '百分', '%', 'price', 'percent change'] as const,
        verbs: {
          gte: ['上涨', '涨', 'rise', 'up'] as const,
          lte: ['下跌', '跌', 'drop', 'down'] as const,
        },
      },
      // 必须抽到百分比数值才视为 percent_change；否则放手让 indicator.below / bollinger.touch_middle 等承接
      matchRequires: ['valuePct'],
      paramSlots: {
        direction: { kind: 'enum', required: true, enum: ['up', 'down'], extractor: { kind: 'enum-zh-map', enumMap: { '上涨': 'up', '涨': 'up', 'rise': 'up', 'up': 'up', '下跌': 'down', '跌': 'down', 'drop': 'down', 'down': 'down' } } },
        valuePct: { kind: 'percent', required: true, range: [-100, 100], extractor: { kind: 'percent', pattern: '-?\\d+(\\.\\d+)?%', range: [-100, 100] } },
        basis: { kind: 'enum', required: false, enum: ['prev_close', 'entry_avg_price', 'current_price'], extractor: { kind: 'enum-zh-map', enumMap: { '相对上一根 K 线收盘价': 'prev_close', '相对上一根收盘': 'prev_close', '上一根收盘价': 'prev_close', '入场均价': 'entry_avg_price', '开仓均价': 'entry_avg_price', '当前价': 'current_price', '现价': 'current_price' } } },
        window: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.breakout_up': {
    corpus: {
      aliases: [
        '突破上方',
        '上破关键位',
      ],
      positiveExamples: [
        '突破前高后开多',
      ],
      negativeExamples: [
        '回踩前低但未突破',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.breakout_up'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充向上突破条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.breakout_up'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        period: (v) => String(v),
        reference: (v, locale) => locale === 'zh' ? (v === 'channel_high' ? '通道高点' : String(v)) : (v === 'channel_high' ? 'channel high' : String(v)),
        bufferPct: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['price.breakout_up'][locale],
    },
    surface: {
      intent: {
        // Issue #1391 follow-up：移除通用 '突破'/'breakout' keyword（仍保留在 verbs）。
        //   原因：'突破' 在 S6 类网格策略中常出现于"突破上下边界则停止"这种停止/护栏从句，
        //   不是入场触发；而 dispatcher kw+verb 双重命中下，单个 '突破' 同时覆盖两半 AND 导致
        //   误匹 entry。改为必须出现 '前高/高点/channel high' 等明确 reference token 才匹。
        keywords: ['前高', '高点', 'channel high'] as const,
        verbs: {
          breakout_up: ['突破', '升破', '上破', 'breakout'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
        reference: { kind: 'enum', required: true, enum: ['channel_high', 'unknown'], default: 'channel_high' },
        bufferPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.breakout_down': {
    corpus: {
      aliases: [
        '跌破下方',
        '下破关键位',
      ],
      positiveExamples: [
        '跌破前低后开空',
      ],
      negativeExamples: [
        '价格仍在区间中间',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.breakout_down'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充向下跌破条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.breakout_down'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        period: (v) => String(v),
        reference: (v, locale) => locale === 'zh' ? (v === 'channel_low' ? '通道低点' : String(v)) : (v === 'channel_low' ? 'channel low' : String(v)),
        bufferPct: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['price.breakout_down'][locale],
    },
    surface: {
      intent: {
        // Issue #1391 follow-up：移除通用 '跌破'/'breakdown' keyword（仍保留在 verbs）。
        //   与 breakout_up 对偶——'跌破' 单词在网格/护栏从句普遍出现，需明确 reference token 才匹。
        keywords: ['前低', '低点', 'channel low'] as const,
        verbs: {
          breakout_down: ['跌破', '跌回', '下破', '跌穿', 'breakdown'] as const,
        },
      },
      paramSlots: {
        period: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
        reference: { kind: 'enum', required: true, enum: ['channel_low', 'unknown'], default: 'channel_low' },
        bufferPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.detect.indicator_boundary': {
    corpus: {
      aliases: [
        '价格碰线',
        '触及指标边界',
      ],
      positiveExamples: [
        '触及 BOLL 下轨（20, 2）',
      ],
      negativeExamples: [
        '只描述价格上涨，没有指标边界',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.detect.indicator_boundary'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充价格触及指标边界条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.detect.indicator_boundary'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        boundaryRole: (v, locale) => SHARED_ENUM_DISPLAY.boundaryRole[v as keyof typeof SHARED_ENUM_DISPLAY.boundaryRole]?.[locale] ?? String(v),
        confirmationMode: (v, locale) => locale === 'zh' ? (v === 'touch' ? '触及' : v === 'breakout' ? '突破' : v === 'close' ? '收盘确认' : String(v)) : (v === 'touch' ? 'touch' : v === 'breakout' ? 'breakout' : v === 'close' ? 'close confirmation' : String(v)),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['price.detect.indicator_boundary'].en
        // params.indicator is runtime IR-projected nested object (see service renderIndicatorBoundaryTouch)
        const indicator = params.indicator !== null && typeof params.indicator === 'object' ? params.indicator as Record<string, unknown> : null
        const indicatorName = indicator !== null && typeof indicator.name === 'string' ? indicator.name : ''
        const boundaryRole = typeof params.boundaryRole === 'string' ? params.boundaryRole : 'boundary'
        const boundaryLabel = SHARED_ENUM_DISPLAY.boundaryRole[boundaryRole as keyof typeof SHARED_ENUM_DISPLAY.boundaryRole]?.zh ?? boundaryRole
        if (indicatorName === 'bollinger') {
          const period = indicator !== null && typeof indicator.period === 'number' ? indicator.period : 20
          const stdDev = indicator !== null && typeof indicator.stdDev === 'number' ? indicator.stdDev : 2
          return `触及 BOLL（${period}, ${stdDev}）${boundaryLabel}`
        }
        const displayName = indicatorName ? indicatorName.toUpperCase() : '指标'
        return `触及 ${displayName} ${boundaryLabel}`
      },
    },
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '上边界'/'下边界'/'中线' 与英文 'channel' 关键词，覆盖
        //   "突破上边界开空"、"price touch channel lower" 这类真实 utterance（baseline 修复）
        keywords: ['指标边界', '布林带', '通道', '上轨', '下轨', '中轨', '上边界', '下边界', '中线', 'boundary', 'channel'] as const,
        verbs: {
          touch_upper: ['触及上轨', '触及上边界', 'touch upper'] as const,
          touch_lower: ['触及下轨', '触及下边界', 'touch lower'] as const,
          touch_middle: ['触及中轨', '触及中线', 'touch middle'] as const,
          breakout_up: ['突破上轨', '上破边界', 'breakout upper'] as const,
          breakout_down: ['跌破下轨', '下破边界', 'breakdown lower'] as const,
        },
      },
      paramSlots: {
        boundaryRole: { kind: 'enum', required: true, enum: ['upper', 'lower', 'middle'], extractor: { kind: 'enum-zh-map', enumMap: { '上轨': 'upper', '上边界': 'upper', '下轨': 'lower', '下边界': 'lower', '中轨': 'middle', '中线': 'middle' } } },
        confirmationMode: { kind: 'enum', required: false, enum: ['touch', 'breakout', 'close'], extractor: { kind: 'enum-zh-map', enumMap: { '触及': 'touch', '碰到': 'touch', '突破': 'breakout', '上破': 'breakout', '跌破': 'breakout', '收盘': 'close' } } },
        sourceText: { kind: 'enum', required: false, enum: ['boundary'] },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'indicator.cross_over': {
    corpus: {
      aliases: [
        '金叉',
        '向上交叉',
      ],
      positiveExamples: [
        'MA20 上穿 MA60',
      ],
      negativeExamples: [
        'MA20 一直在 MA60 上方',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('indicator.cross_over'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充指标上穿条件的缺失信息（指标类型、周期）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['indicator.cross_over'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        indicator: (v, locale) => SHARED_ENUM_DISPLAY.indicatorAlgo[v as keyof typeof SHARED_ENUM_DISPLAY.indicatorAlgo]?.[locale] ?? String(v).toUpperCase(),
        semantic: (v) => String(v),
        value: (v) => String(v),
        period: (v) => String(v),
        fastPeriod: (v) => String(v),
        slowPeriod: (v) => String(v),
        signalPeriod: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['indicator.cross_over'].en
        const indicator = typeof params.indicator === 'string' ? params.indicator.trim().toLowerCase() : ''
        if (indicator === 'macd') {
          const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : 12
          const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : 26
          const signal = typeof params.signalPeriod === 'number' ? params.signalPeriod : 9
          return `MACD ${fast}/${slow}/${signal} 金叉`
        }
        if (indicator === 'rsi') {
          const period = typeof params.period === 'number' ? params.period : 14
          const value = typeof params.value === 'number' ? params.value : null
          return value === null ? `RSI${period} 上穿阈值` : `RSI${period} 上穿 ${value}`
        }
        const label = indicator === 'ema' ? 'EMA' : 'MA'
        const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : null
        const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : null
        const fastLabel = fast === null ? `${label}短周期` : `${label}${fast}`
        const slowLabel = slow === null ? `${label}长周期` : `${label}${slow}`
        return `${fastLabel} 上穿 ${slowLabel}`
      },
    },
    surface: {
      intent: {
        keywords: ['均线', 'MA', 'EMA', 'RSI', 'MACD', 'DIF', 'DEA', 'indicator'] as const,
        verbs: {
          cross_over: ['上穿', '金叉', '穿回', '向上穿回', 'cross over', 'crosses above'] as const,
        },
      },
      // 跨子句对偶：与 cross_under 互为镜像；用户在前句写过 indicator 后，后句省略 keyword
      //   仍可命中（如 "下穿 时平多" 自动继承 cross_over 的 indicator/period 参数）
      crossClauseInheritFrom: 'indicator.cross_under',
      inheritParams: ['indicator', 'fastPeriod', 'slowPeriod', 'period', 'signalPeriod', 'value'],
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema', 'RSI': 'rsi', 'MACD': 'macd', 'DIF': 'macd', 'DEA': 'macd' } } },
        semantic: { kind: 'enum', required: false, enum: ['cross_up'] },
        // Issue #1338：value/slowPeriod 取第 2 个数字，period/fastPeriod 取第 1 个；
        // signalPeriod 取第 3 个。'EMA20 上穿 EMA50' → fastPeriod=20, slowPeriod=50。
        // 'RSI14 上穿 70' → period=14, value=70。
        // Issue #1395 mute-spider：multipleOf:1 强制整数；range 已是 [0,100]/[1,500]。
        value: { kind: 'number', required: false, range: [0, 100], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100], index: 1 } },
        period: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        fastPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        slowPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500], index: 1 } },
        signalPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500], index: 2 } },
      },
      // Issue #1395 mute-spider S5：MACD 三元组合法白名单（业界标准 + 快速线变体）
      paramPresetCombos: [
        { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        { indicator: 'macd', fastPeriod: 5, slowPeriod: 13, signalPeriod: 9 },
      ] as const,
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
      phraseHints: {
        paramDefaultsHint: 'MACD：{ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } —— 行业标准组合，禁止写 100/26/9 等非标值。',
      },
    },
  },

  'indicator.cross_under': {
    corpus: {
      aliases: [
        '死叉',
        '向下交叉',
      ],
      positiveExamples: [
        'MA20 下穿 MA60',
      ],
      negativeExamples: [
        'MA20 一直在 MA60 下方',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('indicator.cross_under'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充指标下穿条件的缺失信息（指标类型、周期）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['indicator.cross_under'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        indicator: (v, locale) => SHARED_ENUM_DISPLAY.indicatorAlgo[v as keyof typeof SHARED_ENUM_DISPLAY.indicatorAlgo]?.[locale] ?? String(v).toUpperCase(),
        semantic: (v) => String(v),
        value: (v) => String(v),
        period: (v) => String(v),
        fastPeriod: (v) => String(v),
        slowPeriod: (v) => String(v),
        signalPeriod: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['indicator.cross_under'].en
        const indicator = typeof params.indicator === 'string' ? params.indicator.trim().toLowerCase() : ''
        if (indicator === 'macd') {
          const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : 12
          const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : 26
          const signal = typeof params.signalPeriod === 'number' ? params.signalPeriod : 9
          return `MACD ${fast}/${slow}/${signal} 死叉`
        }
        if (indicator === 'rsi') {
          const period = typeof params.period === 'number' ? params.period : 14
          const value = typeof params.value === 'number' ? params.value : null
          return value === null ? `RSI${period} 下穿阈值` : `RSI${period} 下穿 ${value}`
        }
        const label = indicator === 'ema' ? 'EMA' : 'MA'
        const fast = typeof params.fastPeriod === 'number' ? params.fastPeriod : null
        const slow = typeof params.slowPeriod === 'number' ? params.slowPeriod : null
        const fastLabel = fast === null ? `${label}短周期` : `${label}${fast}`
        const slowLabel = slow === null ? `${label}长周期` : `${label}${slow}`
        return `${fastLabel} 下穿 ${slowLabel}`
      },
    },
    surface: {
      intent: {
        keywords: ['均线', 'MA', 'EMA', 'RSI', 'MACD', 'DIF', 'DEA', 'indicator'] as const,
        verbs: {
          cross_under: ['下穿', '死叉', '跌破', '向下穿过', 'cross under', 'crosses below'] as const,
        },
      },
      // 跨子句对偶：与 cross_over 互为镜像；"EMA7 上穿 EMA21 时开多；下穿 时平多"
      //   中第二条子句无 keyword，从 cross_over 继承 indicator/fast/slow period 后命中
      crossClauseInheritFrom: 'indicator.cross_over',
      inheritParams: ['indicator', 'fastPeriod', 'slowPeriod', 'period', 'signalPeriod', 'value'],
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'ema', 'rsi', 'macd'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema', 'RSI': 'rsi', 'MACD': 'macd', 'DIF': 'macd', 'DEA': 'macd' } } },
        semantic: { kind: 'enum', required: false, enum: ['cross_down'] },
        // Issue #1338：与 cross_over 对称——双数字按位置 disambiguate。
        // Issue #1395 mute-spider：multipleOf:1 强制整数。
        value: { kind: 'number', required: false, range: [0, 100], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [0, 100], index: 1 } },
        period: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        fastPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        slowPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500], index: 1 } },
        signalPeriod: { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500], index: 2 } },
      },
      // Issue #1395 mute-spider S5：MACD 三元组合法白名单（业界标准 + 快速线变体）。
      // 与 cross_over 对称。
      paramPresetCombos: [
        { indicator: 'macd', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        { indicator: 'macd', fastPeriod: 5, slowPeriod: 13, signalPeriod: 9 },
      ] as const,
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'indicator.above': {
    corpus: {
      aliases: ['指标高于', '突破均线', '站上 MA', '价格高于均线', 'indicator above', 'price above MA'],
      positiveExamples: [
        '收盘价站上 EMA20',
        '价格突破 50 日均线',
        '指标高于 MA(100) 时入场',
      ],
      negativeExamples: ['感觉行情不错', '随便入场', '价格在均线附近'],
      goldenUtterances: getGoldenUtterancesForAtom('indicator.above'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充指标高于阈值条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: {
      supportStatus: `unsupported_indicator_static_compare_public_beta_unsupported` as const,
      unsupportedMeta: { reasonCode: 'indicator_static_compare_public_beta_unsupported', publicReasonZh: '指标静态高于条件当前公测暂未支持生成和回测。' },
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['indicator.above'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        indicator: (v, locale) => SHARED_ENUM_DISPLAY.indicatorAlgo[v as keyof typeof SHARED_ENUM_DISPLAY.indicatorAlgo]?.[locale] ?? String(v).toUpperCase(),
        referenceRole: (v, locale) => locale === 'zh' ? (v === 'short_term' ? '短期' : v === 'mid_term' ? '中期' : v === 'long_term' ? '长期' : String(v)) : (v === 'short_term' ? 'short term' : v === 'mid_term' ? 'mid term' : v === 'long_term' ? 'long term' : String(v)),
        'reference.period': (v) => String(v),
        timeframeOverride: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['indicator.above'].en
        const indicator = typeof params.indicator === 'string' ? params.indicator.toUpperCase() : 'MA'
        const period = typeof params['reference.period'] === 'number' ? params['reference.period'] : null
        return period !== null ? `价格在 ${indicator}${period} 上方` : ATOM_PUBLIC_NAMES['indicator.above'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['价格', '收盘价', 'MA', 'EMA', '均线', 'indicator'] as const,
        verbs: {
          gte: ['站上', '突破', '高于', '上方', 'above', 'over'] as const,
        },
      },
      // 必须抽出指标名称（MA/EMA/SMA/均线）才视为静态 indicator 比较，否则放手让
      // price.candle_pattern / grid 等更具体的 atom 接住"收盘高于开盘"/"突破上下边界"。
      matchRequires: ['indicator'],
      // 注：Issue #1391 实测，indicator.above ↔ below 跨子句继承在用户表达"都位于下方只开空"
      //   等 meta-condition 子句上会 over-fire 出 phantom EMA short entry。这两个 atom 的
      //   场景下用户通常会显式重复指标名（"价格在 EMA20 上方做多；EMA20 下方做空"），
      //   不需要继承。移除 dual 声明，避免误伤。crossClauseInheritFrom 机制仍保留给真正
      //   省略指标名的对偶场景（cross_over/under、touch_lower/upper、touch_middle 自镜像）。
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'sma', 'ema'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', 'SMA': 'sma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema' } } },
        referenceRole: { kind: 'enum', required: false, enum: ['short_term', 'mid_term', 'long_term'], extractor: { kind: 'enum-zh-map', derive: 'period-range' } },
        // #1497: period 必须为整数（multipleOf:1），range [1, 500] 保持
        'reference.period': { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '(?:EMA|SMA|MA)\\s*[（(]?\\s*(\\d{1,4})|(\\d{1,4})\\s*(?:日|周期)?均线', range: [1, 500] } },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'], default: 'true' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
      phraseHints: {
        paramDefaultsHint: 'MA / EMA / SMA：period 常用 [5, 10, 20, 50, 100, 200]；除此之外的周期必须来自用户原话。',
      },
    },
  },

  'indicator.below': {
    corpus: {
      aliases: ['指标低于', '跌破均线', '跌穿 MA', '价格低于均线', 'indicator below', 'price below MA'],
      positiveExamples: [
        '收盘价跌破 EMA20',
        '价格跌破 50 日均线',
        '指标低于 MA(100) 时止损',
      ],
      negativeExamples: ['感觉要跌', '随便止损', '价格在均线附近'],
      goldenUtterances: getGoldenUtterancesForAtom('indicator.below'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充指标低于阈值条件的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: {
      supportStatus: `unsupported_indicator_static_compare_public_beta_unsupported` as const,
      unsupportedMeta: { reasonCode: 'indicator_static_compare_public_beta_unsupported', publicReasonZh: '指标静态低于条件当前公测暂未支持生成和回测。' },
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['indicator.below'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        indicator: (v, locale) => SHARED_ENUM_DISPLAY.indicatorAlgo[v as keyof typeof SHARED_ENUM_DISPLAY.indicatorAlgo]?.[locale] ?? String(v).toUpperCase(),
        referenceRole: (v, locale) => locale === 'zh' ? (v === 'short_term' ? '短期' : v === 'mid_term' ? '中期' : v === 'long_term' ? '长期' : String(v)) : (v === 'short_term' ? 'short term' : v === 'mid_term' ? 'mid term' : v === 'long_term' ? 'long term' : String(v)),
        'reference.period': (v) => String(v),
        timeframeOverride: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['indicator.below'].en
        const indicator = typeof params.indicator === 'string' ? params.indicator.toUpperCase() : 'MA'
        const period = typeof params['reference.period'] === 'number' ? params['reference.period'] : null
        return period !== null ? `价格低于 ${indicator}${period}` : ATOM_PUBLIC_NAMES['indicator.below'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['价格', '收盘价', 'MA', 'EMA', '均线', 'indicator'] as const,
        verbs: {
          // Issue #1338：移除 '下穿'——其语义属 indicator.cross_under（瞬时穿越事件），
          // 不应与静态 below（'低于/下方'）并行命中。同从句 'EMA20 下穿 EMA50' 不再误触此原子。
          lte: ['跌破', '低于', '下方', 'below', 'under'] as const,
        },
      },
      // 与 indicator.above 对称：必须抽出指标名才视为静态比较，否则让 candle_pattern 等接住
      // Issue #1391：移除跨子句继承（见 indicator.above 侧注释）。
      matchRequires: ['indicator'],
      paramSlots: {
        indicator: { kind: 'enum', required: true, enum: ['ma', 'sma', 'ema'], extractor: { kind: 'enum-zh-map', enumMap: { 'MA': 'ma', 'SMA': 'sma', '均线': 'ma', 'EMA': 'ema', '指数均线': 'ema' } } },
        referenceRole: { kind: 'enum', required: false, enum: ['short_term', 'mid_term', 'long_term'], extractor: { kind: 'enum-zh-map', derive: 'period-range' } },
        // #1497: period 必须为整数（multipleOf:1），range [1, 500] 保持
        'reference.period': { kind: 'number', required: false, range: [1, 500], multipleOf: 1, extractor: { kind: 'number-int', pattern: '(?:EMA|SMA|MA)\\s*[（(]?\\s*(\\d{1,4})|(\\d{1,4})\\s*(?:日|周期)?均线', range: [1, 500] } },
        timeframeOverride: { kind: 'enum', required: false, enum: ['true'], default: 'true' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'from-direction',
    },
  },

  'execution.on_start': {
    corpus: {
      aliases: [
        '策略启动',
        '开始运行',
      ],
      positiveExamples: [
        '策略启动后立即检查一次条件',
      ],
      negativeExamples: [
        '只在固定时间段交易',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('execution.on_start'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充启动后执行条件的缺失信息。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['execution.on_start'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        timing: (v) => String(v),
        orderType: (v, locale) => locale === 'zh' ? (v === 'market' ? '市价' : String(v)) : (v === 'market' ? 'market' : String(v)),
        occurrence: (v) => String(v),
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['execution.on_start'][locale],
    },
    surface: {
      intent: {
        keywords: ['立即', '立刻', '开始时', '启动时', 'on start', 'immediately'] as const,
        verbs: {
          fixed: ['市价买入', '市价卖出', '开仓', '平仓', 'market'] as const,
        },
      },
      paramSlots: {
        timing: { kind: 'enum', required: false, enum: ['on_start'], default: 'on_start' },
        orderType: { kind: 'enum', required: false, enum: ['market'], default: 'market', extractor: { kind: 'enum-zh-map', enumMap: { '市价': 'market', '市价买入': 'market', '市价卖出': 'market' } } },
        occurrence: { kind: 'enum', required: false, enum: ['once'], default: 'once' },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'trend.direction': {
    corpus: {
      aliases: [
        '趋势判断',
        '行情方向',
      ],
      positiveExamples: [
        '只在上升趋势做多',
      ],
      negativeExamples: [
        '无视趋势方向',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('trend.direction'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请指定趋势方向：up（向上）或 down（向下）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['trend.direction'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        value: (v, locale) => locale === 'zh' ? (v === 'up' ? '向上' : v === 'down' ? '向下' : String(v)) : (v === 'up' ? 'up' : v === 'down' ? 'down' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['trend.direction'].en
        const value = typeof params.value === 'string' ? params.value : ''
        if (value === 'up') return '趋势向上'
        if (value === 'down') return '趋势向下'
        return '趋势方向过滤'
      },
    },
    surface: {
      intent: {
        keywords: ['趋势', '大趋势', '市场趋势', 'trend'] as const,
        verbs: {
          fixed: ['向上', '上涨', '多头', '向下', '下跌', '空头', 'up', 'down', 'bull', 'bear'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['up', 'down'], extractor: { kind: 'enum-zh-map', enumMap: { '向上': 'up', '上涨': 'up', '多头': 'up', 'up': 'up', 'bull': 'up', '向下': 'down', '下跌': 'down', '空头': 'down', 'down': 'down', 'bear': 'down' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'market.regime': {
    corpus: {
      aliases: [
        '行情结构',
        '市场环境',
      ],
      positiveExamples: [
        '震荡行情使用网格',
      ],
      negativeExamples: [
        '只描述单个价格条件',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('market.regime'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请指定市场状态：trend（趋势市场）/ range（震荡市场）/ volatile（高波动市场）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['market.regime'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        value: (v, locale) => locale === 'zh' ? (v === 'range' ? '震荡区间' : v === 'trend' ? '趋势' : v === 'volatile' ? '高波动' : String(v)) : (v === 'range' ? 'ranging' : v === 'trend' ? 'trending' : v === 'volatile' ? 'volatile' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['market.regime'].en
        const regime = typeof params.regime === 'string' ? params.regime : (typeof params.value === 'string' ? params.value : '')
        if (regime === 'trend') return '趋势市场'
        if (regime === 'range') return '震荡市场'
        if (regime === 'volatile') return '高波动市场'
        return ATOM_PUBLIC_NAMES['market.regime'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['市场状态', '行情', '震荡', '盘整', 'regime', 'range-bound'] as const,
        verbs: {
          fixed: ['震荡区间', '区间震荡', '盘整', 'range-bound'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['range', 'trend', 'volatile'], extractor: { kind: 'enum-zh-map', enumMap: { '震荡区间': 'range', '区间震荡': 'range', '盘整': 'range', 'range-bound': 'range', 'range': 'range', '趋势': 'trend', 'trend': 'trend', '高波动': 'volatile', 'volatile': 'volatile' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'volatility.state': {
    corpus: {
      aliases: [
        '波动环境',
        '波动强弱',
      ],
      positiveExamples: [
        '高波动时降低仓位',
      ],
      negativeExamples: [
        '成交量放大但波动不变',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('volatility.state'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请指定波动率状态：high（高波动率）或 low（低波动率）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['volatility.state'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        value: (v, locale) => locale === 'zh' ? (v === 'high' ? '高波动' : v === 'low' ? '低波动' : String(v)) : (v === 'high' ? 'high' : v === 'low' ? 'low' : String(v)),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['volatility.state'].en
        const state = typeof params.state === 'string' ? params.state : (typeof params.value === 'string' ? params.value : '')
        if (state === 'high') return '高波动率状态'
        if (state === 'low') return '低波动率状态'
        return ATOM_PUBLIC_NAMES['volatility.state'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['波动率', '高波动', '低波动', 'volatility'] as const,
        verbs: {
          fixed: ['过高', '偏低', '升高', '降低', 'high', 'low'] as const,
        },
      },
      paramSlots: {
        value: { kind: 'enum', required: true, enum: ['high', 'low'], extractor: { kind: 'enum-zh-map', enumMap: { '过高': 'high', '高': 'high', '升高': 'high', 'high': 'high', '偏低': 'low', '低': 'low', '降低': 'low', 'low': 'low' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'price.range_position_lte': {
    corpus: {
      aliases: [
        '接近区间底部',
        '区间下沿',
      ],
      positiveExamples: [
        '价格位于近 100 根区间下 20%',
      ],
      negativeExamples: [
        '价格处在区间顶部',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.range_position_lte'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充区间低位条件的缺失信息（如区间百分比阈值）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.range_position_lte'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        lookbackBars: (v) => String(v),
        thresholdPct: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['price.range_position_lte'][locale],
    },
    surface: {
      intent: {
        keywords: ['区间', '区间低位', '区间底部', 'range'] as const,
        verbs: {
          lte: ['区间下', '低位', '底部', 'lower range'] as const,
        },
      },
      paramSlots: {
        // Issue #1403 通用化：lookbackBars 与 minBars 同类——必须紧跟「N 根/N 条/N bars」
        //   量词且不得为 timeframe 数字。复用 declarative quantifier 上下文。
        lookbackBars: {
          kind: 'number',
          required: false,
          range: [1, 5000],
          default: 20,
          extractor: {
            kind: 'number-int',
            range: [1, 5000],
            quantifier: {
              include: ['根', '条', '个', 'bars', 'bar', 'period', '周期'],
              exclude: ['分钟', '小时', '秒', '天', '日', 'minute', 'hour'],
            },
          },
        },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.range_position_gte': {
    corpus: {
      aliases: [
        '接近区间顶部',
        '区间上沿',
      ],
      positiveExamples: [
        '价格位于近 100 根区间上 20%',
      ],
      negativeExamples: [
        '价格处在区间底部',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.range_position_gte'),
    },
    canonicalWave: 'first-wave',
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充区间高位条件的缺失信息（如区间百分比阈值）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.range_position_gte'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        lookbackBars: (v) => String(v),
        thresholdPct: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['price.range_position_gte'][locale],
    },
    surface: {
      intent: {
        keywords: ['区间', '区间高位', '区间顶部', 'range'] as const,
        verbs: {
          gte: ['区间上', '高位', '顶部', 'upper range'] as const,
        },
      },
      paramSlots: {
        // Issue #1403 通用化：lookbackBars 与 minBars 同类——必须紧跟「N 根/N 条/N bars」
        //   量词且不得为 timeframe 数字。复用 declarative quantifier 上下文。
        lookbackBars: {
          kind: 'number',
          required: false,
          range: [1, 5000],
          default: 20,
          extractor: {
            kind: 'number-int',
            range: [1, 5000],
            quantifier: {
              include: ['根', '条', '个', 'bars', 'bar', 'period', '周期'],
              exclude: ['分钟', '小时', '秒', '天', '日', 'minute', 'hour'],
            },
          },
        },
        thresholdPct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'indicator.divergence': {
    corpus: {
      aliases: [
        '背离',
        '顶背离',
        '底背离',
        'RSI 背离',
        'MACD 背离',
        'bullish divergence',
        'bearish divergence',
      ],
      positiveExamples: [
        'RSI 顶背离后开空',
        'MACD 底背离后开多',
        'RSI 底背离 + 确认 3 根 K 线',
      ],
      negativeExamples: [
        '像背离',
        '疑似背离',
        '看起来像背离',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('indicator.divergence'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充指标背离条件的缺失信息（指标类型、背离方向）。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['indicator.divergence'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        indicator: (v) => String(v).toUpperCase(),
        // divergence uses atom-private display (底/顶背离), not shared directionBias (看涨/看跌)
        direction: (v, locale) => ATOM_PRIVATE_DISPLAY.divergenceDirection[v as keyof typeof ATOM_PRIVATE_DISPLAY.divergenceDirection]?.[locale] ?? String(v),
        pivotWindow: (v) => String(v),
        confirmationBars: (v) => String(v),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['indicator.divergence'].en
        const indicator = typeof params.indicator === 'string' ? params.indicator.toUpperCase() : 'RSI'
        const direction = typeof params.direction === 'string' ? params.direction : ''
        const directionLabel = ATOM_PRIVATE_DISPLAY.divergenceDirection[direction as keyof typeof ATOM_PRIVATE_DISPLAY.divergenceDirection]?.zh ?? '背离'
        return `${indicator} ${directionLabel}`
      },
    },
    surface: {
      intent: {
        keywords: ['背离', '顶背离', '底背离', 'divergence', 'bullish divergence', 'bearish divergence'] as const,
        verbs: {
          divergence: ['背离', 'divergence'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: false, enum: ['rsi', 'macd'], default: 'rsi', extractor: { kind: 'enum-zh-map', enumMap: { 'RSI': 'rsi', 'MACD': 'macd' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '底背离': 'bullish', '看涨背离': 'bullish', 'bullish': 'bullish', '顶背离': 'bearish', '看跌背离': 'bearish', 'bearish': 'bearish' } } },
        pivotWindow: { kind: 'number', required: false, range: [1, 500], default: 14, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        confirmationBars: { kind: 'number', required: false, range: [1, 100], default: 3, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 100] } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'price.candle_pattern': {
    corpus: {
      aliases: [
        '吞没形态',
        '锤子线',
        '十字星',
        '连续实体',
        '阳线',
        '阴线',
        'engulfing',
        'hammer',
        'doji',
        'consecutive body',
        'bullish engulfing',
        'bearish engulfing',
      ],
      positiveExamples: [
        '出现看涨吞没形态后开多',
        '锤子线确认后做多',
        '十字星出现后开空',
        '连续 3 根阳线后加多',
        '收盘价高于开盘价时开多',
        '收盘价低于开盘价时平多',
      ],
      negativeExamples: [
        '像吞没',
        '疑似锤子',
        '看起来像十字星',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.candle_pattern'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'price.candle_pattern.pattern') return '请选择 K 线形态：engulfing（吞没）、hammer（锤子线）、doji（十字星）或 consecutive_body（连续实体）。'
      if (slotKey === 'price.candle_pattern.direction') return '请指明形态方向：bullish（看涨）或 bearish（看跌）。'
      if (slotKey === 'price.candle_pattern.minBars') return '连续实体形态需要指定最少连续根数（minBars），例如 3。'
      return '请补充 K 线形态条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.candle_pattern'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        pattern: (v, locale) => ATOM_PRIVATE_DISPLAY.candlePattern[v as keyof typeof ATOM_PRIVATE_DISPLAY.candlePattern]?.[locale] ?? String(v),
        direction: (v, locale) => SHARED_ENUM_DISPLAY.directionBias[v as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.[locale] ?? String(v),
        minBars: (v) => String(v),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['price.candle_pattern'].en
        const pattern = typeof params.pattern === 'string' ? params.pattern : 'engulfing'
        const direction = typeof params.direction === 'string' ? params.direction : ''
        const minBars = typeof params.minBars === 'number' ? params.minBars : undefined
        // 单根 bull/bear bar 渲染（"收盘价高于开盘价"即阳线，反之阴线）
        // Issue #1391 review m3：single_bull/bear_bar 是"单根"形态语义，minBars 在此语义下
        //   会撒谎（用户应改用 consecutive_body+direction）。固定忽略 minBars。
        if (pattern === 'single_bull_bar') {
          return '阳线（收盘价高于开盘价）'
        }
        if (pattern === 'single_bear_bar') {
          return '阴线（收盘价低于开盘价）'
        }
        const directionLabel = direction ? (SHARED_ENUM_DISPLAY.directionBias[direction as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.zh ?? direction) : ''
        const patternLabel = ATOM_PRIVATE_DISPLAY.candlePattern[pattern as keyof typeof ATOM_PRIVATE_DISPLAY.candlePattern]?.zh ?? pattern
        const minBarsLabel = minBars !== undefined ? `（≥${minBars} 根）` : ''
        return `${directionLabel}${patternLabel}形态${minBarsLabel}`
      },
    },
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '连续' / 'consecutive' / 'body' 关键词，覆盖
        //   "bullish consecutive body 连续 3 根" 这类真实 utterance（baseline 修复）
        // Issue #1383 后续：补 '阳线/阴线/收盘价/开盘价/K线' 覆盖单根 bull/bear bar 表达
        keywords: ['吞没', '锤子', '十字星', '连续', 'candle pattern', 'engulfing', 'hammer', 'doji', 'consecutive', 'body', '阳线', '阴线', '收盘价', '开盘价', 'K线', 'k线'] as const,
        verbs: {
          fixed: ['出现', '形态', '根', 'pattern', 'confirmed'] as const,
          // 关系 verb：以"收盘价 高于/低于 开盘价"形式触发单根 bull/bear bar
          gte: ['高于', 'above'] as const,
          lte: ['低于', 'below'] as const,
        },
      },
      paramSlots: {
        // 在原有 enum 上扩 single_bull_bar / single_bear_bar；enum-zh-map 增加
        //   "收盘价高于开盘价 → single_bull_bar"、"收盘价低于开盘价 → single_bear_bar"
        //   "阳线" → single_bull_bar、"阴线" → single_bear_bar 等映射键
        pattern: { kind: 'enum', required: true, enum: ['engulfing', 'hammer', 'doji', 'consecutive_body', 'single_bull_bar', 'single_bear_bar'], extractor: { kind: 'enum-zh-map', enumMap: { '吞没': 'engulfing', 'engulfing': 'engulfing', '锤子': 'hammer', 'hammer': 'hammer', '十字星': 'doji', 'doji': 'doji', '连续阳线': 'consecutive_body', '连续阴线': 'consecutive_body', 'consecutive body': 'consecutive_body', '连续': 'consecutive_body', '阳线': 'single_bull_bar', '收盘价高于开盘价': 'single_bull_bar', '收盘高于开盘': 'single_bull_bar', '收盘价高于开盘': 'single_bull_bar', '阴线': 'single_bear_bar', '收盘价低于开盘价': 'single_bear_bar', '收盘低于开盘': 'single_bear_bar', '收盘价低于开盘': 'single_bear_bar' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '看涨': 'bullish', 'bullish': 'bullish', '看跌': 'bearish', 'bearish': 'bearish' } } },
        // Issue #1403 通用化：用声明式 quantifier 上下文替代 pattern 硬编码。
        //   number-int extractor 在 dispatcher 层统一处理「N + 量词」匹配，所有
        //   含 timeframe / 百分号歧义的 number-* slot 都可以复用该机制。
        //   汉字数字（三/五/十）目前不抽，宁可让 minBars 留 open slot，也好过抽错数字。
        minBars: {
          kind: 'number',
          required: false,
          range: [1, 100],
          extractor: {
            kind: 'number-int',
            range: [1, 100],
            quantifier: {
              include: ['根', '条', '个', 'bars', 'bar'],
              exclude: ['分钟', '小时', '秒', '天', '日', 'minute', 'hour'],
            },
          },
        },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      matchRequires: ['pattern'],
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        antiPatterns: [{
          mistake: '用户原话「连续 N 根」/「连阳/连阴」+「N 根 K 线」时，dispatcher 可能落下 price.candle_pattern(pattern="consecutive_body") 的孤立 atom，但缺少 sequence/nextBarOnly 信息',
          fix: 'planner 必须输出 condition.sequence(sequenceKind="consecutive_body", count=N) 而**不是** price.candle_pattern；count 必须复述用户给出的精确值（如「3 根」→ count=3，不要写 ≥15）。',
        }],
      },
    },
  },

  'price.chart_pattern': {
    corpus: {
      aliases: [
        '头肩',
        '头肩顶',
        '头肩底',
        '双顶',
        '双底',
        '三角形',
        'head and shoulders',
        'inverse head and shoulders',
        'h&s',
        'double top',
        'double bottom',
        'triangle',
      ],
      positiveExamples: [
        '出现头肩底形态后开多',
        '双顶形成后开空',
        '双底形成后做多',
        '三角形向上突破后开多',
      ],
      negativeExamples: [
        '看起来像头肩',
        '疑似双顶',
        'looks like a triangle',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('price.chart_pattern'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'price.chart_pattern.pattern') return '请选择图形形态：head_and_shoulders（头肩）、double_top（双顶）、double_bottom（双底）或 triangle（三角形）。'
      if (slotKey === 'price.chart_pattern.direction') return '请指明形态突破方向：bullish（看涨）或 bearish（看跌）。'
      return '请补充图形形态条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.chart_pattern'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        pattern: (v, locale) => ATOM_PRIVATE_DISPLAY.chartPattern[v as keyof typeof ATOM_PRIVATE_DISPLAY.chartPattern]?.[locale] ?? String(v),
        direction: (v, locale) => SHARED_ENUM_DISPLAY.directionBias[v as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.[locale] ?? String(v),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['price.chart_pattern'].en
        const pattern = typeof params.pattern === 'string' ? params.pattern : 'head_and_shoulders'
        const direction = typeof params.direction === 'string' ? params.direction : ''
        const directionLabel = direction ? (SHARED_ENUM_DISPLAY.directionBias[direction as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.zh ?? direction) : ''
        const patternLabel = ATOM_PRIVATE_DISPLAY.chartPattern[pattern as keyof typeof ATOM_PRIVATE_DISPLAY.chartPattern]?.zh ?? pattern
        return `${directionLabel}${patternLabel}形态`
      },
    },
    surface: {
      intent: {
        keywords: ['头肩', '双顶', '双底', '三角形', 'chart pattern', 'head and shoulders', 'double top', 'double bottom', 'triangle'] as const,
        verbs: {
          breakout_up: ['突破', '上破', 'breakout'] as const,
          breakout_down: ['跌破', '下破', 'breakdown'] as const,
        },
      },
      paramSlots: {
        pattern: { kind: 'enum', required: true, enum: ['head_and_shoulders', 'double_top', 'double_bottom', 'triangle'], extractor: { kind: 'enum-zh-map', enumMap: { '头肩底': 'head_and_shoulders', '头肩顶': 'head_and_shoulders', '头肩': 'head_and_shoulders', 'head and shoulders': 'head_and_shoulders', '双顶': 'double_top', 'double top': 'double_top', '双底': 'double_bottom', 'double bottom': 'double_bottom', '三角形': 'triangle', 'triangle': 'triangle' } } },
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '看涨': 'bullish', 'bullish': 'bullish', '看跌': 'bearish', 'bearish': 'bearish' } } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'liquidity.sweep': {
    corpus: {
      aliases: [
        '流动性扫荡',
        '流动性猎杀',
        '扫止损',
        '扫单',
        '假突破',
        'liquidity sweep',
        'liquidity grab',
        'stop hunt',
        'sweep and reclaim',
      ],
      positiveExamples: [
        '扫前低后反弹做多',
        '扫前高后回落做空',
        'sweep prev low then reclaim within 3 bars',
        'liquidity grab at session high, open short',
      ],
      negativeExamples: [
        '看起来像扫荡',
        '疑似 sweep',
        'looks like a stop hunt',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('liquidity.sweep'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'liquidity.sweep.direction') return '请指明扫荡反转方向：bullish（看涨，扫前低后反弹）或 bearish（看跌，扫前高后回落）。'
      if (slotKey === 'liquidity.sweep.reference') return '请选择被扫荡的关键位：prev_low（前低）、prev_high（前高）、session_low（日内低）或 session_high（日内高）。'
      if (slotKey === 'liquidity.sweep.reclaimBars') return '请指明 reclaim 的最大确认根数（reclaimBars），例如 3。'
      return '请补充流动性扫荡条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['liquidity.sweep'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        direction: (v, locale) => SHARED_ENUM_DISPLAY.directionBias[v as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.[locale] ?? String(v),
        reference: (v, locale) => SHARED_ENUM_DISPLAY.extremaReference[v as keyof typeof SHARED_ENUM_DISPLAY.extremaReference]?.[locale] ?? String(v),
        reclaimBars: (v) => String(v),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['liquidity.sweep'].en
        const direction = typeof params.direction === 'string' ? params.direction : ''
        const reference = typeof params.reference === 'string' ? params.reference : ''
        const reclaimBars = typeof params.reclaimBars === 'number' ? params.reclaimBars : undefined
        const directionLabel = direction ? (SHARED_ENUM_DISPLAY.directionBias[direction as keyof typeof SHARED_ENUM_DISPLAY.directionBias]?.zh ?? direction) : ''
        const referenceLabel = reference ? (SHARED_ENUM_DISPLAY.extremaReference[reference as keyof typeof SHARED_ENUM_DISPLAY.extremaReference]?.zh ?? reference) : ''
        const reclaimLabel = reclaimBars !== undefined ? `（${reclaimBars} 根内 reclaim）` : ''
        return `${directionLabel}流动性扫荡 ${referenceLabel}${reclaimLabel}`
      },
    },
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '假突破' / 'fake breakout' 关键词，覆盖
        //   "假突破后入场" 这类真实 utterance（baseline 修复）
        keywords: ['流动性', '前低', '前高', '扫', '假突破', 'sweep', 'liquidity', 'prev low', 'prev high', 'session low', 'session high', 'fake breakout', 'stop hunt'] as const,
        verbs: {
          // critic m1 fix: '扫前低'/'扫前高' 在 extractor 中仅作为提示文本出现，PR1b 加 fixture 后再决定保留
          touch_lower: ['sweep at prev low'] as const,
          touch_upper: ['sweep at prev high'] as const,
        },
      },
      paramSlots: {
        direction: { kind: 'enum', required: false, enum: ['bullish', 'bearish'], extractor: { kind: 'enum-zh-map', enumMap: { '做多': 'bullish', 'bullish': 'bullish', '反弹': 'bullish', '做空': 'bearish', 'bearish': 'bearish', '回落': 'bearish' } } },
        reference: { kind: 'enum', required: false, enum: ['prev_low', 'prev_high', 'session_low', 'session_high'], extractor: { kind: 'enum-zh-map', enumMap: { '前低': 'prev_low', 'prev low': 'prev_low', '前高': 'prev_high', 'prev high': 'prev_high', 'session low': 'session_low', '日内低点': 'session_low', 'session high': 'session_high', '日内高点': 'session_high' } } },
        reclaimBars: { kind: 'number', required: false, range: [1, 100], extractor: { kind: 'number-int', pattern: '(?<=后\\s*)\\d+(?=\\s*根)', range: [1, 100] } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'external.signal': {
    corpus: {
      aliases: [
        '外部喊单',
        '喊单群',
        'KOL 信号',
        '外部信号',
        'tradingview 信号',
        'discord 信号',
        'telegram 信号',
        'webhook',
        'external signal',
      ],
      positiveExamples: [
        '收到 TradingView webhook 信号后开多',
        'discord 喊单群发出 buy 信号就开仓',
        'telegram bot 推送外部信号触发开多',
      ],
      negativeExamples: [
        '看群里讨论后随手开仓',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('external.signal'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'external.signal.provider') return '请指明外部信号来源：tradingview / discord / telegram / webhook。'
      if (slotKey === 'external.signal.signalId') return '请提供外部信号订阅 ID（用于过滤推送）。'
      if (slotKey === 'external.signal.secret') return '请提供 HMAC 校验 secret，避免冒名信号触发开仓（可由系统生成后回填）。'
      return '请补充外部信号触发条件的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['external.signal'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        provider: (v, locale) => ATOM_PRIVATE_DISPLAY.signalProvider[v as keyof typeof ATOM_PRIVATE_DISPLAY.signalProvider]?.[locale] ?? String(v),
        signalId: (v) => String(v),
        secret: (v) => String(v),
        sourceText: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['external.signal'].en
        const provider = typeof params.provider === 'string' ? params.provider : ''
        const providerLabel = provider ? (ATOM_PRIVATE_DISPLAY.signalProvider[provider as keyof typeof ATOM_PRIVATE_DISPLAY.signalProvider]?.zh ?? provider) : '外部信号'
        return `${providerLabel} 喊单信号`
      },
    },
    surface: {
      intent: {
        // critic m1 fix: 'whale_buy'/'whale_sell' 是事件名而非 utterance 同义词，移除；'on'/'when' 是连接词非触发动词，移除
        keywords: ['webhook', '外部信号', '信号', 'signal', 'signalId'] as const,
        verbs: {
          // Issue #1338：dispatcher 新规要求 kw && verb 同时命中；补中文 webhook 触发动词。
          // 单字 '接' 经 review C1/C2 移除——matchVerbDirection 用 String.includes，
          // 会误命中 '直接/间接/连接/对接/接下来' 等高频词。
          fixed: ['收到', '触发', '接到', '接收', '接入', '接', '订阅'] as const,
        },
      },
      paramSlots: {
        provider: { kind: 'enum', required: false, enum: ['webhook'], default: 'webhook', extractor: { kind: 'enum-zh-map', enumMap: { 'webhook': 'webhook' } } },
        signalId: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause', pattern: 'signalId\\s*[=为：:]?\\s*([A-Za-z0-9_]+)' } },
        secret: { kind: 'enum', required: false, enum: ['configured'], extractor: { kind: 'enum-zh-map', enumMap: { 'secret': 'configured', 'configured': 'configured' } } },
        sourceText: { kind: 'enum', required: false, extractor: { kind: 'verbatim-clause' } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      // external.signal 命中时 evidence.source 应为 'webhook'（而非 'user_explicit'）。
      // dispatcher 读 surface.evidenceProvenance 赋值，无需 atom-key 字面量比较（AC-13 合规）。
      evidenceProvenance: 'webhook',
    },
  },

  // ── 持仓条件（positionConstraint 以 trigger 身份出现）
  'position.has_position': {
    corpus: {
      aliases: [
        '已有仓位不再开仓',
        '持仓中禁止开仓',
        '仓位存在时阻止入场',
        '有仓位',
      ],
      positiveExamples: [
        '已有多头仓位时不再开多',
        '当持仓中禁止同向重复开仓',
      ],
      negativeExamples: [
        '无仓位时开仓',
        '加仓',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('position.has_position'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'position.has_position.sideScope') return '请明确仓位方向：多头（long）、空头（short）或双向（both）。'
      return '请补充仓位检查条件的缺失信息。'
    },
    mutex: ['position.no_position'],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['position.has_position'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        sideScope: (v, locale) => SHARED_ENUM_DISPLAY.side[v as keyof typeof SHARED_ENUM_DISPLAY.side]?.[locale] ?? String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['position.has_position'].en
        const side = typeof params.sideScope === 'string' ? params.sideScope : 'both'
        const sideLabel = SHARED_ENUM_DISPLAY.side[side as keyof typeof SHARED_ENUM_DISPLAY.side]?.zh ?? side
        return `已有${sideLabel}仓位 → 阻止新开仓`
      },
    },
    surface: {
      intent: {
        keywords: ['已有', '已持有', '持仓时', 'has position', 'in position', 'when in'] as const,
        verbs: {
          fixed: ['不再', '时不', 'block entries', 'when'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '多头': 'long', '多单': 'long', '做多': 'long', 'long': 'long', '空头': 'short', '空单': 'short', '做空': 'short', 'short': 'short', '任意': 'both', '双向': 'both', 'both': 'both' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'position.no_position': {
    corpus: {
      aliases: [
        '无仓位才开仓',
        '空仓时才开仓',
        '没有持仓时允许入场',
        '未开仓',
      ],
      positiveExamples: [
        '无多头仓位才开多',
        '当前无仓时才允许入场',
      ],
      negativeExamples: [
        '已有仓位时开仓',
        '加仓',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('position.no_position'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'position.no_position.sideScope') return '请明确仓位方向：多头（long）、空头（short）或双向（both）。'
      return '请补充无仓位检查条件的缺失信息。'
    },
    mutex: ['position.has_position'],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['position.no_position'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        sideScope: (v, locale) => SHARED_ENUM_DISPLAY.side[v as keyof typeof SHARED_ENUM_DISPLAY.side]?.[locale] ?? String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['position.no_position'].en
        const side = typeof params.sideScope === 'string' ? params.sideScope : 'both'
        const sideLabel = SHARED_ENUM_DISPLAY.side[side as keyof typeof SHARED_ENUM_DISPLAY.side]?.zh ?? side
        return `无${sideLabel}仓位 → 允许新开仓`
      },
    },
    surface: {
      intent: {
        keywords: ['无仓位', '无多头', '无空头', '空仓', 'flat', 'only when flat', 'enter only when'] as const,
        verbs: {
          fixed: ['才', '时', 'when'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '无多头': 'long', '无多单': 'long', '无空头': 'short', '无空单': 'short', '空仓': 'both', '无仓位': 'both', 'flat': 'both' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  // ── 行动（actions）
  'action.add_position': {
    corpus: {
      aliases: [
        '追加仓位',
        '顺势加码',
        '金字塔加仓',
        'scale in',
        'pyramid',
      ],
      positiveExamples: [
        '突破后再加一笔仓位',
        '信号再次出现时加仓 50%',
        '盈利 5% 后加仓 30%',
      ],
      negativeExamples: [
        '只开第一笔仓位',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('action.add_position'),
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.add_position'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        sideScope: (v, locale) => SHARED_ENUM_DISPLAY.side[v as keyof typeof SHARED_ENUM_DISPLAY.side]?.[locale] ?? String(v),
        addMode: (v, locale) => locale === 'zh' ? (v === 'signal_confirm' ? '信号确认' : v === 'profit_pct' ? '盈利触发' : v === 'drawdown_pct' ? '回撤触发' : String(v)) : (v === 'signal_confirm' ? 'signal confirm' : v === 'profit_pct' ? 'profit trigger' : v === 'drawdown_pct' ? 'drawdown trigger' : String(v)),
        addRatio: (v) => `${v}`,
        profitThreshold: (v) => `${v}%`,
        drawdownThreshold: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.add_position'][locale],
    },
    summaryContribution: ({ params }) => {
      // inline 自定义：addMode + addRatio 精简摘要
      const addRatio = typeof params.addRatio === 'number' ? params.addRatio : null
      const addMode = typeof params.addMode === 'string' ? params.addMode : null
      const profitThreshold = typeof params.profitThreshold === 'number' ? params.profitThreshold : null
      const drawdownThreshold = typeof params.drawdownThreshold === 'number' ? params.drawdownThreshold : null

      const ratioPct = addRatio !== null ? `${Math.round(addRatio * 100)}%` : null

      if (addMode === 'profit_pct') {
        const triggerPart = profitThreshold !== null ? `盈利 ${profitThreshold}% 后` : '盈利后'
        return ratioPct ? `加仓：${triggerPart}加仓 ${ratioPct}` : `加仓：${triggerPart}加仓`
      }
      if (addMode === 'drawdown_pct') {
        const triggerPart = drawdownThreshold !== null ? `回撤 ${drawdownThreshold}% 后` : '回撤后'
        return ratioPct ? `加仓：${triggerPart}加仓 ${ratioPct}` : `加仓：${triggerPart}加仓`
      }
      if (addMode === 'signal_confirm') {
        return ratioPct ? `加仓：信号确认后加仓 ${ratioPct}` : '加仓：信号确认后加仓'
      }
      return ratioPct ? `加仓：每次 ${ratioPct}` : '加仓'
    },
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey) => {
      if (slotKey === 'action.add_position.constraint') {
        return '请补充加仓约束，例如：最多加仓 3 次，或最大总敞口 30%。'
      }
      return '请补充加仓条件的缺失信息。'
    },
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    surface: {
      intent: {
        // critic m1 fix: 删除 '加码'/'追仓'（extractor/utterance/fixture 全仓 0 命中的凭空同义词）
        keywords: ['加仓', '补仓', 'add position', 'scale in', 'pullback'] as const,
        verbs: {
          // critic M2 fix: 移除通用连接词 '后'/'时'/'when'/'after'，仅保留语义触发词
          fixed: ['回踩', '盈利', '回撤'] as const,
        },
      },
      paramSlots: {
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'long', extractor: { kind: 'enum-zh-map', enumMap: { '多': 'long', '多头': 'long', '做多': 'long', '空': 'short', '空头': 'short', '做空': 'short' } } },
        addMode: { kind: 'enum', required: false, enum: ['signal_confirm', 'profit_pct', 'drawdown_pct'], extractor: { kind: 'enum-zh-map', enumMap: { '信号确认': 'signal_confirm', '回踩': 'signal_confirm', '盈利': 'profit_pct', '回撤': 'drawdown_pct' } } },
        addRatio: { kind: 'percent', required: false, range: [0, 1], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        profitThreshold: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        drawdownThreshold: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'action.reverse_position': {
    corpus: {
      aliases: [
        '反向开仓',
        '平仓后反向',
        '反转持仓',
        '翻仓',
      ],
      positiveExamples: [
        '多单止损后反手开空',
        '信号反转时由多翻空，使用当前仓位',
        '由空翻多，下根 K 线执行',
      ],
      negativeExamples: [
        '只平仓不反向',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('action.reverse_position'),
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.reverse_position'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        fromSide: (v, locale) => SHARED_ENUM_DISPLAY.side[v as keyof typeof SHARED_ENUM_DISPLAY.side]?.[locale] ?? String(v),
        toSide: (v, locale) => SHARED_ENUM_DISPLAY.side[v as keyof typeof SHARED_ENUM_DISPLAY.side]?.[locale] ?? String(v),
        sameBarPolicy: (v, locale) => locale === 'zh' ? (v === 'next_bar_only' ? '下根K线' : v === 'allow' ? '允许同根' : String(v)) : (v === 'next_bar_only' ? 'next bar' : v === 'allow' ? 'allow same bar' : String(v)),
        sizingSource: (v, locale) => locale === 'zh' ? (v === 'fixed' ? '固定' : v === 'current_position' ? '原仓位' : String(v)) : (v === 'fixed' ? 'fixed' : v === 'current_position' ? 'current position' : String(v)),
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.reverse_position'][locale],
    },
    summaryContribution: ({ params }) => {
      const fromSide = typeof params.fromSide === 'string' ? params.fromSide : null
      const toSide = typeof params.toSide === 'string' ? params.toSide : null
      if (fromSide && toSide) {
        const from = fromSide === 'long' ? '多' : fromSide === 'short' ? '空' : fromSide
        const to = toSide === 'long' ? '多' : toSide === 'short' ? '空' : toSide
        return `反手：由${from}翻${to}`
      }
      return '反手'
    },
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充反手动作的方向信息（fromSide / toSide）。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    surface: {
      intent: {
        keywords: ['反手', '翻仓', '反向开仓', '反转持仓', 'reverse position', 'flip position'] as const,
        verbs: {
          fixed: ['下穿', '信号反转', '由多翻空', '由空翻多', 'reverse', 'flip'] as const,
        },
      },
      paramSlots: {
        fromSide: { kind: 'enum', required: false, enum: ['long', 'short'], extractor: { kind: 'enum-zh-map', enumMap: { '由多': 'long', '多翻': 'long', '由空': 'short', '空翻': 'short' } } },
        toSide: { kind: 'enum', required: false, enum: ['long', 'short'], extractor: { kind: 'enum-zh-map', enumMap: { '翻空': 'short', '翻多': 'long' } } },
        sameBarPolicy: { kind: 'enum', required: false, enum: ['next_bar_only', 'allow'], default: 'next_bar_only', extractor: { kind: 'enum-zh-map', enumMap: { '下一根': 'next_bar_only', '同根允许': 'allow', '允许同根': 'allow' } } },
        sizingSource: { kind: 'enum', required: false, enum: ['fixed', 'current_position'], default: 'fixed', extractor: { kind: 'enum-zh-map', enumMap: { '固定': 'fixed', '原仓位': 'current_position', '当前仓位': 'current_position' } } },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  // ── 开多 / 平多 action（PR2c-final-1a：解 caller 切换后 open-slot-resolver spec 3 fail）
  'action.open_long': {
    corpus: {
      aliases: ['开多', '做多', '买入', '入场多', '开多仓', 'open long', 'go long', 'buy'],
      positiveExamples: [
        '满足条件时开多 1000U',
        '金叉时开多仓',
        '突破均线时做多',
      ],
      negativeExamples: ['平多', '开空', '随便买'],
      goldenUtterances: [
        'EMA20 金叉时开多 1000U',
        '价格突破阻力位时开多仓',
      ],
    },
    summaryContribution: () => '开多',
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充开多动作条件的缺失信息。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.open_long'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {},
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.open_long'][locale],
    },
    surface: {
      intent: {
        keywords: ['开多', '做多', '买入', '入场多', 'open long', 'go long', 'buy'] as const,
        verbs: {
          fixed: ['开多', '做多', '买入', 'open long', 'go long', 'buy'] as const,
        },
      },
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
      sideResolver: { kind: 'fn', fn: () => 'long' },
    },
  },

  'action.close_long': {
    corpus: {
      aliases: ['平多', '卖出', '平仓多', '出场多', '止盈平多', 'close long', 'exit long', 'sell'],
      positiveExamples: [
        '止盈时平多',
        '跌破均线时平多仓',
        'EMA20 死叉时平多',
      ],
      negativeExamples: ['开多', '平空', '随便平'],
      goldenUtterances: [
        '价格跌破 EMA20 时平多仓',
        '止盈 5% 时平多',
      ],
    },
    summaryContribution: () => '平多',
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充平多动作条件的缺失信息。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.close_long'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {},
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.close_long'][locale],
    },
    surface: {
      intent: {
        keywords: ['平多', '卖出', '平仓多', '出场多', 'close long', 'exit long', 'sell'] as const,
        verbs: {
          fixed: ['平多', '卖出', '平仓多', 'close long', 'exit long', 'sell'] as const,
        },
      },
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
      sideResolver: { kind: 'fn', fn: () => 'long' },
    },
  },

  // ── 开空 / 平空 action（M2: 镜像 long 补 short atom，消除 isEntryActionKey/isExitActionKey 死代码中
  //   已识别 action.open_short/action.close_short 但 registry 无对应 atom 的不对称）
  'action.open_short': {
    corpus: {
      aliases: ['开空', '做空', '入场空', '开空仓', 'open short', 'go short'],
      positiveExamples: [
        '满足条件时开空 1000U',
        '死叉时开空仓',
        '跌破均线时做空',
      ],
      negativeExamples: ['平空', '开多', '随便卖'],
      goldenUtterances: getGoldenUtterancesForAtom('action.open_short'),
    },
    summaryContribution: () => '开空',
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充开空动作条件的缺失信息。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.open_short'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {},
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.open_short'][locale],
    },
    surface: {
      intent: {
        keywords: ['开空', '做空', '入场空', 'open short', 'go short'] as const,
        verbs: {
          fixed: ['开空', '做空', 'open short', 'go short'] as const,
        },
      },
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
      sideResolver: { kind: 'fn', fn: () => 'short' },
    },
  },

  'action.close_short': {
    corpus: {
      aliases: ['平空', '平仓空', '出场空', '止盈平空', 'close short', 'exit short'],
      positiveExamples: [
        '止盈时平空',
        '突破均线时平空仓',
        'EMA20 金叉时平空',
      ],
      negativeExamples: ['开空', '平多', '随便平'],
      goldenUtterances: getGoldenUtterancesForAtom('action.close_short'),
    },
    summaryContribution: () => '平空',
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充平空动作条件的缺失信息。',
    mutex: [],
    isActionable: true,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['action.close_short'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {},
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['action.close_short'][locale],
    },
    surface: {
      intent: {
        keywords: ['平空', '平仓空', '出场空', 'close short', 'exit short'] as const,
        verbs: {
          fixed: ['平空', '平仓空', 'close short', 'exit short'] as const,
        },
      },
      paramSlots: {},
      phaseResolver: 'by-clause-verb',
      sideResolver: { kind: 'fn', fn: () => 'short' },
    },
  },

  // ── 风险（risk）
  'risk.stop_loss_pct': {
    corpus: {
      aliases: ['止损比例', '亏损止损', '百分比止损', 'stop loss pct'],
      positiveExamples: [
        '亏损 5% 止损',
        '按入场均价亏损 5% 止损',
      ],
      negativeExamples: ['盈利 10% 止盈', '分批止盈一半'],
      goldenUtterances: getGoldenUtterancesForAtom('risk.stop_loss_pct'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'risk.stop_loss_pct.valuePct') return '请补充百分比止损的止损比例。'
      return '请补充百分比止损的缺失信息。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['risk.stop_loss_pct'],
      paramRenderers: {
        valuePct: (v) => `${v}%`,
        basis: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['risk.stop_loss_pct'].en
        const valuePct = typeof params.valuePct === 'number' ? params.valuePct : 0
        const basis = params.basis === 'entry_avg_price' ? '入场均价' : '持仓收益率'
        return `止损：价格相对${basis}下跌${valuePct}% 强制平仓`
      },
    },
    surface: {
      intent: {
        keywords: ['止损', '亏损', '损失', 'stop loss', 'loss'] as const,
        verbs: {
          fixed: ['止损', '亏损', '损失', 'stop loss', 'loss'] as const,
        },
      },
      paramSlots: {
        valuePct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '(?:止损|亏损|损失|stop\\s*loss|loss)\\D{0,12}(\\d+(?:\\.\\d+)?)\\s*%', range: [0, 100] } },
        basis: { kind: 'enum', required: false, enum: ['entry_avg_price', 'position_pnl'], default: 'entry_avg_price', extractor: { kind: 'enum-zh-map', enumMap: { '入场均价': 'entry_avg_price', '开仓均价': 'entry_avg_price', '持仓收益率': 'position_pnl' } } },
      },
      matchRequires: ['valuePct'],
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  'risk.take_profit_pct': {
    corpus: {
      aliases: ['止盈比例', '盈利止盈', '百分比止盈', 'take profit pct'],
      positiveExamples: [
        '盈利 10% 止盈',
        '止盈 10%',
      ],
      negativeExamples: ['亏损 5% 止损', '分批止盈一半'],
      goldenUtterances: getGoldenUtterancesForAtom('risk.take_profit_pct'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充百分比止盈的缺失信息。',
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['risk.take_profit_pct'],
      paramRenderers: {
        valuePct: (v) => `${v}%`,
        basis: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['risk.take_profit_pct'].en
        const valuePct = typeof params.valuePct === 'number' ? params.valuePct : 0
        const basis = params.basis === 'entry_avg_price' ? '入场均价' : '持仓收益率'
        return `止盈：价格相对${basis}上涨${valuePct}% 平仓`
      },
    },
    surface: {
      intent: {
        keywords: ['止盈', '盈利', '利润', 'take profit', 'profit'] as const,
        verbs: {
          fixed: ['止盈', '盈利', '利润', 'take profit', 'profit'] as const,
        },
      },
      paramSlots: {
        valuePct: { kind: 'percent', required: true, range: [0, 100], extractor: { kind: 'percent', pattern: '(?:止盈|盈利|利润|take\\s*profit|profit)\\D{0,12}(\\d+(?:\\.\\d+)?)\\s*%', range: [0, 100] } },
        basis: { kind: 'enum', required: false, enum: ['entry_avg_price', 'position_pnl'], default: 'entry_avg_price', extractor: { kind: 'enum-zh-map', enumMap: { '入场均价': 'entry_avg_price', '开仓均价': 'entry_avg_price', '持仓收益率': 'position_pnl' } } },
      },
      matchRequires: ['valuePct'],
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  'risk.atr_stop': {
    corpus: {
      aliases: ['ATR 止损', '波动止损', 'ATR 动态止损'],
      positiveExamples: [
        '用 2 倍 ATR 作为动态止损',
        '仓位的 2% ATR 作为止损',
      ],
      negativeExamples: ['固定 5% 止损', 'ATR 大于 50 才交易'],
      goldenUtterances: getGoldenUtterancesForAtom('risk.atr_stop'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    // Issue #1383 Lane A：ATR 动态止损 promoted 为 supported_executable（registry 标志位翻转）。
    //   IR compile path 由 Lane C 兑现；此处仅解锁 registry support flag，使
    //   readinessCheck 走通用流水线、不再走 UNSUPPORTED_SKIP 短路。
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'risk.atr_stop.period') return '请指定 ATR 计算周期，例如 14（常用默认值）。'
      if (slotKey === 'risk.atr_stop.multiple') return '请给出 ATR 倍数，例如 2（即 2 倍 ATR 作为止损距离）。'
      if (slotKey === 'risk.atr_stop.pctOfAtr') return '或者给出占 ATR 的百分比，例如 50% ATR。'
      return '请补充 ATR 动态止损的缺失信息（period / multiple / pctOfAtr）。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['risk.atr_stop'],
      paramRenderers: {
        multiple: (v) => String(v),
        pctOfAtr: (v) => `${v}%`,
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['risk.atr_stop'].en
        if (typeof params.multiple === 'number') return `${params.multiple} 倍 ATR 止损`
        if (typeof params.pctOfAtr === 'number') return `${params.pctOfAtr}% ATR 止损`
        return 'ATR 动态止损'
      },
    },
    surface: {
      intent: {
        keywords: ['ATR 止损', 'ATR', '动态止损', '波动止损', 'atr stop'] as const,
        verbs: {
          fixed: ['止损', '作为止损', '动态止损', 'atr stop'] as const,
        },
      },
      paramSlots: {
        // Issue #1383 Lane A：ATR period 默认 14（行业标准），supported_executable 起步默认值。
        // #1497: period 收紧 [1, 100] + multipleOf:1；multiple 收紧 [0.1, 20] + multipleOf:0.1。
        period: { kind: 'number', required: false, range: [1, 100], multipleOf: 1, default: 14, extractor: { kind: 'number-decimal', pattern: 'ATR\\s*(\\d+)', range: [1, 100] } },
        pctOfAtr: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '(\\d+(?:\\.\\d+)?)\\s*%\\s*ATR', range: [0, 100] } },
        multiple: { kind: 'number', required: false, range: [0.1, 20], multipleOf: 0.1, extractor: { kind: 'number-decimal', pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:倍|x)\\s*ATR', range: [0.1, 20] } },
      },
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [{
          keywords: ['X 倍 ATR 止损', 'N 倍 ATR 止损'],
          mustOutput: 'risk.atr_stop + multiple=X。',
        }],
        paramDefaultsHint: 'ATR：{ period: 14 }；倍数（multiple）必须来自用户原话。',
      },
    },
  },

  // Issue #1383 Lane A：risk.partial_take_profit promoted 为 supported_executable
  //   （registry classifier 翻牌；semantic-atom-registry resolvePartialTakeProfitAtom
  //   现已条件性 supported_executable，本 atom 自身 readiness 仍走 UNSUPPORTED_SKIP
  //   仅在 tiers 未填阶段，slot 补全后会被 resolvePartialTakeProfitAtom 升级）
  //   readinessCheck = UNSUPPORTED_SKIP（critic Major #3）：声明"contractReadiness 主动跳过"，
  //   避免与 COMMON_PIPELINE 混淆。summaryContribution 仍 VIA_PRESENTATION_DISPLAY
  //   是为了 partial_take_profit fallback 到 unsupported 路径时仍能渲染 publicName 给用户看
  'risk.partial_take_profit': {
    corpus: {
      aliases: [
        '分档止盈',
        '多档止盈',
        '部分止盈',
        '阶梯止盈',
      ],
      positiveExamples: [
        '盈利 5% 减仓 30%, 10% 再减 30%, 15% 全部平仓',
      ],
      negativeExamples: [
        '盈利 10% 全部止盈',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('risk.partial_take_profit'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: UNSUPPORTED_SKIP,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'risk.partial_take_profit.tiers') return '请补充止盈档位，例如：盈利 5% 平 50%、盈利 10% 平 50%。'
      return '请补充分批止盈的缺失信息。'
    },
    mutex: ATOM_MUTEX['risk.partial_take_profit'] ?? [],
    isActionable: false,
    sizingEvidence: null,
    // Issue #1383 Lane A：promoted to supported_executable（registry 标志位翻转）。
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['risk.partial_take_profit'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        profitPct: (v) => `${v}%`,
        ratio: (v) => `${v}`,
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['risk.partial_take_profit'].en
        const tiers = params.tiers
        if (Array.isArray(tiers) && tiers.length > 0) {
          const parts = (tiers as Array<{ trigger?: { threshold?: number }; reduceRatio?: number }>).map((tier, i) => {
            const pct = typeof tier.trigger?.threshold === 'number' ? `+${tier.trigger.threshold}%` : '?%'
            const ratio = typeof tier.reduceRatio === 'number' ? `减 ${Math.round(tier.reduceRatio * 100)}%` : ''
            return `第${i + 1}档 ${pct} ${ratio}`.trim()
          })
          return `分批止盈：${parts.join('，')}`
        }
        // dispatcher 抽出的简化形状：{ profitPct, ratio }（"盈利 3% 分批止盈一半" 这类自然表达）
        const profitPct = typeof params.profitPct === 'number' && Number.isFinite(params.profitPct) ? params.profitPct : null
        const ratio = typeof params.ratio === 'number' && Number.isFinite(params.ratio) ? params.ratio : null
        if (profitPct !== null && ratio !== null) {
          // ratio 既可能是 0-1 比例（如 0.5）也可能是百分比裸数字（如 3 表示 30%），归一化到百分比口径
          const reducePct = ratio > 0 && ratio <= 1 ? ratio * 100 : ratio
          return `分批止盈：盈利 ${profitPct}% 平 ${reducePct}%`
        }
        if (profitPct !== null) {
          return `分批止盈：盈利 ${profitPct}% 触发`
        }
        return '分批止盈'
      },
    },
    surface: {
      intent: {
        // Issue #1279 PR2b：补 '档' / '减' / '平' 关键词，覆盖中文分档语法
        //   "第一档 +5% 减 30%" / "盈利 5% 平一半" 等真实 utterance（baseline 修复）
        // 裸 "止盈 10%" 属 risk.take_profit_pct，不能触发 partial_take_profit。
        keywords: ['分批止盈', '部分止盈', '部分平仓', '一半', '半仓', '档', '减仓', '减', 'partial take profit', 'scale out', 'tier'] as const,
        verbs: {
          gte: ['盈利', '达到', '第一档', '第二档', '第三档', 'profit', 'at', 'tier'] as const,
        },
      },
      paramSlots: {
        profitPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        ratio: { kind: 'percent', required: false, range: [0, 1], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
    },
  },

  // ── 组合风险 orchestration（portfolioRisk）
  'portfolioRisk.drawdown_block': {
    // TODO #1329b corpus stub，待补真实 NL 语料
    corpus: {
      aliases: [],
      positiveExamples: [],
      negativeExamples: [],
      goldenUtterances: [],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.portfolio_drawdown.threshold_pct') return '请确认账户回撤百分比阈值（0..100）'
      return '请补全账户回撤护栏参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['portfolioRisk.drawdown_block'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        thresholdPct: (v) => `${v}%`,
        lookbackWindow: (v) => String(v),
        mode: (v, locale) => ATOM_PRIVATE_DISPLAY.drawdownMode[v as keyof typeof ATOM_PRIVATE_DISPLAY.drawdownMode]?.[locale] ?? String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['portfolioRisk.drawdown_block'].en
        const thresholdPct = typeof params.thresholdPct === 'number' ? params.thresholdPct : 0
        const mode = typeof params.mode === 'string' ? params.mode : 'enforce'
        if (mode === 'observe') return `账户回撤超过 ${thresholdPct}% 时仅记录`
        return `账户回撤超过 ${thresholdPct}% 时阻止开新仓`
      },
    },
    surface: {
      intent: {
        keywords: ['账户回撤', '最大回撤', '组合回撤', '熔断', 'drawdown', 'account drawdown', 'max drawdown'] as const,
        verbs: {
          gte: ['超过', '达到', '触及', 'exceeds', 'reaches'] as const,
        },
      },
      paramSlots: {
        thresholdPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        lookbackWindow: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  // ── 仓位约束（positionConstraint）
  // Issue #1313 PR4 决策（方案 B：保持 capabilityStatus = 'irshape-not-applicable'）
  // ----------------------------------------------------------------------------
  // `position.dca_schedule` IR 编译阶段无独立产出：`canonical-spec-v2-ir-compiler.service.ts`
  // 内零 case 引用此 atom key（已 grep 验证）。实际消费者：
  //   - `semantic-state-projection.service.ts` —— display token / 状态投影
  //   - `per-trade-sizing-resolver.service.ts` —— sizing 派生（DCA_SIZING_EVIDENCE）
  // 两者均在 IR 编译路径之外，本 atom 不需要 `irShape` / `lifecyclePyramidingShape` /
  // `riskGuardShape` / `ruleBlockShape` / `orchestrationPortfolioRiskShape` 任一接口。
  //
  // 因此本 PR 不为 dca_schedule 引入第 5 类 emit shape，保持
  // `capabilityStatus = 'irshape-not-applicable'`（由 `createPr1bEmit` 默认注入），
  // 显式声明"已审计：IR 编译期无产出"。
  //
  // 与 `position.pyramiding_limit`（'pr3e-lifecycle'）严格分离：
  //   - pyramiding 影响 `portfolio.allowPyramiding` / `maxPyramidingLayers`
  //     → IR 编译末段聚合 → 走 emit.lifecyclePyramidingShape
  //   - dca_schedule 影响 sizing param / runtime constraint
  //     → 走 sizing resolver 派生 → 不进入 IR shape 调度
  //
  // 未来 follow-up（不属于本 PR 范围）：若后续把 per-trade-sizing-resolver 内的
  // DCA 派生逻辑也下沉到 atom 自身，需新增 `sizingShape` 接口（第 5 类 emit shape）；
  // 届时再升级本 atom 的 capabilityStatus，与本次 spec-level shape 设计正交。
  'position.dca_schedule': {
    corpus: {
      aliases: [
        '定投补仓',
        '分批补仓计划',
        'DCA',
        '网格补仓',
        '定期补仓',
      ],
      positiveExamples: [
        '每跌 2% 补仓一次，最多 3 次',
        '定投补仓，总资金上限 1000 USDT',
      ],
      negativeExamples: [
        '只开一次固定仓位',
        '单次加仓',
      ],
      goldenUtterances: getGoldenUtterancesForAtom('position.dca_schedule'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'position.dca_schedule.max_count') return '请确认 DCA 最多执行几次，例如 3。'
      if (slotKey === 'position.dca_schedule.capital_cap') return '请确认 DCA 总资金上限，例如 1000 USDT。'
      if (slotKey === 'position.dca_schedule.per_order_sizing') return '请确认每次 DCA 补仓金额或比例，例如 100 USDT 或 10%。'
      if (slotKey === 'position.dca_schedule.trigger_mode') return '请确认 DCA 触发方式：price_interval（价格间隔）/ time_interval（时间间隔）/ signal（信号触发）。'
      if (slotKey === 'position.dca_schedule.exit_rule') return '请确认 DCA 停止规则，例如跌破前低停止或达到止损退出。'
      return '请补充 DCA 补仓计划的缺失信息。'
    },
    mutex: [],
    isActionable: true,
    sizingEvidence: DCA_SIZING_EVIDENCE,
    classifier: { supportStatus: 'supported_executable', executableSinceVersion: '2026.05.W02' },
    display: {
      publicName: ATOM_PUBLIC_NAMES['position.dca_schedule'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        interval: (v) => String(v),
        dropPct: (v) => `${v}%`,
        perOrderBudget: (v) => String(v),
        maxOrders: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['position.dca_schedule'].en
        const maxCountVal = params.maxCount
        const maxCount = typeof maxCountVal === 'number' ? `最多 ${maxCountVal} 次` : ''
        const triggerModeVal = params.triggerMode
        const triggerMode = typeof triggerModeVal === 'string'
          ? (ATOM_PRIVATE_DISPLAY.dcaTriggerMode[triggerModeVal as keyof typeof ATOM_PRIVATE_DISPLAY.dcaTriggerMode]?.zh ?? triggerModeVal)
          : ''
        const parts = [triggerMode, maxCount].filter(Boolean)
        return parts.length > 0 ? `DCA 补仓计划：${parts.join('，')}` : 'DCA 补仓计划'
      },
    },
    surface: {
      intent: {
        keywords: ['定投', 'DCA', 'dca', '每跌', '分批入场', 'price drops', 'each interval'] as const,
        verbs: {
          fixed: ['跌', '每', '间隔', 'every', 'drops', 'interval'] as const,
        },
      },
      paramSlots: {
        interval: { kind: 'duration', required: false, extractor: { kind: 'duration', pattern: '\\d+[mhd]' } },
        dropPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        perOrderBudget: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '\\d+(\\.\\d+)?' } },
        maxOrders: { kind: 'number', required: false, range: [1, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 1000] } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  // Issue #1191：pyramiding 加入 atom contract registry，sizingEvidence 指向
  //   capital.allocate.per_order_budget；atom 通过 action.add_position 子句间接
  //   触发，无独立 utterance fixture（已在 utterance-corpus.spec
  //   RENDER_CONTRACT_ALLOWED_MISSING_FIXTURE 显式登记）。
  'position.pyramiding_limit': {
    corpus: {
      aliases: [
        '最大加仓层数',
        '分层加仓上限',
      ],
      positiveExamples: [
        '最多加仓 3 层',
      ],
      negativeExamples: [
        '无限制连续加仓',
      ],
      goldenUtterances: [
        '同方向最多保留 3 层仓位',
      ],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充金字塔加仓上限的缺失信息（如最多加仓层数）。',
    mutex: [],
    isActionable: true,
    sizingEvidence: PYRAMIDING_SIZING_EVIDENCE,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['position.pyramiding_limit'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        maxLayers: (v) => String(v),
        layerSizing: (v) => `${v}%`,
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['position.pyramiding_limit'][locale],
    },
    surface: {
      intent: {
        keywords: ['最多加仓', '金字塔', '加仓层数', 'pyramiding', 'max adds', 'max layers'] as const,
        verbs: {
          fixed: ['最多', '不超过', 'max', 'up to'] as const,
        },
      },
      paramSlots: {
        // #1497: maxLayers 收紧到 [1, 10] + multipleOf:1（业务最多 10 层；> 10 几乎一定是幻觉）
        maxLayers: { kind: 'number', required: false, range: [1, 10], multipleOf: 1, extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 10] } },
        layerSizing: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  // Issue #1198：grid.range_rebalance 加入 atom contract registry，sizingEvidence 指向
  //   capital.allocate.per_order_budget；emit 路径在 seed-extractor
  //   `buildGridOrderProgramActionContracts`，PR #1197 已补顶层 kind: 'quote'。
  //   atom 通过 grid 触发器子句（"区间 X-Y, 每格 N USDT"）间接落位，无独立 utterance fixture
  //   （已在 utterance-corpus.spec 的 atomsExemptFromOpenSlotCoverage + 顶层 for-skip 显式登记）。
  'grid.range_rebalance': {
    corpus: {
      aliases: [
        '调整网格区间',
        '网格重置',
      ],
      positiveExamples: [
        '价格离开区间后重新计算网格',
      ],
      negativeExamples: [
        '区间不变一直挂单',
      ],
      goldenUtterances: [
        '突破网格边界后重置交易区间',
      ],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (_slotKey, _params, _locale) => '请补充网格区间再平衡的触发条件（如越界后是否重置区间）。',
    mutex: [],
    isActionable: true,
    sizingEvidence: GRID_SIZING_EVIDENCE,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['grid.range_rebalance'],
      // per-slot renderers; consumed by future UI debug surface (not by current summary path)
      paramRenderers: {
        rangeLower: (v) => String(v),
        rangeUpper: (v) => String(v),
        sideMode: (v, locale) => locale === 'zh' ? (v === 'long_only' ? '只做多' : v === 'short_only' ? '只做空' : v === 'both' ? '双向' : String(v)) : (v === 'long_only' ? 'long only' : v === 'short_only' ? 'short only' : v === 'both' ? 'both' : String(v)),
        recycle: (v, locale) => locale === 'zh' ? (v === 'true' ? '循环' : '不循环') : (v === 'true' ? 'recycle' : 'no recycle'),
        breakoutAction: (v, locale) => locale === 'zh' ? (v === 'continue' ? '继续' : v === 'stop' ? '停止' : String(v)) : (v === 'continue' ? 'continue' : v === 'stop' ? 'stop' : String(v)),
        perGridSizing: (v) => String(v),
      },
      summaryTemplate: (_p, locale) => ATOM_PUBLIC_NAMES['grid.range_rebalance'][locale],
    },
    surface: {
      intent: {
        // 中心偏移句式 keyword：'中心' / '上下各'
        // Issue #1391 follow-up：补 '上下边界'/'网格边界'/'立即停止'/'撤销' 让 dispatcher 在
        //   "当价格突破上下边界时执行立即停止并撤销所有未成交订单" 这类网格停止从句也命中 grid，
        //   令 breakoutAction extractor 抓到 'stop'。
        keywords: ['网格', '区间网格', '区间', '挂格', '每格', '网格间距', '步长', '中心', '上下各', '上下边界', '网格边界', '立即停止', '撤销', 'grid', 'range', 'rebalance'] as const,
        verbs: {
          // Issue #1391 follow-up：'停止'/'撤销'/'cancel'/'stop' 作为 grid 的 stop-action verb，
          //   触发整段子句也归属 grid 域，breakoutAction extractor 才能抓到 enum-zh-map 中 stop 派生词。
          fixed: ['网格', '区间', '每格', '挂', '停止', '撤销', 'grid', 'range', 'each grid', 'stop', 'cancel'] as const,
        },
      },
      paramSlots: {
        // Issue #1383 follow-up：兼容中英文 range 前缀。Chinese "(价格)?区间 X-Y"
        //   与 English "(grid|price)? range X-Y" 共用 number-decimal 抽取，pattern 头部
        //   alternation 覆盖两套词法，避免英文 utterance（"grid range 30000-40000"）
        //   静默丢失 rangeLower/rangeUpper。
        rangeLower: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '(?:(?:价格)?区间|(?:grid\\s+|price\\s+)?range)\\s*(\\d+(?:\\.\\d+)?)' } },
        rangeUpper: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '(?:(?:价格)?区间|(?:grid\\s+|price\\s+)?range)\\s*\\d+(?:\\.\\d+)?\\s*[-~到至]\\s*(\\d+(?:\\.\\d+)?)' } },
        // 中心偏移句式："以当前价/部署时当前价为中心，上下各 0.4% 共 10 格"
        //   centerOffsetPct = 0.4，levels = 10；rangeLower/Upper 由 runtime 用 center * (1 ± pct/100) 推导。
        // Issue #1391 review m4：centerOffsetPct ≤ 0 在 price 域无意义；上限 50%
        //   覆盖任何合理网格设计（±50% 区间已足够极端），上界更稳。
        centerOffsetPct: { kind: 'number', required: false, range: [0.01, 50], extractor: { kind: 'number-decimal', pattern: '上下各\\s*(\\d+(?:\\.\\d+)?)\\s*%' } },
        // Issue #1409：levels 抽取从硬编 pattern '共\\s*(\\d+)\\s*格' 通用化为
        //   quantifier.include=['格']。让单 slot extract（resolver 通用通道下
        //   GenericSeedDispatcher.extractSingleSlot）只用回答里"20格"就能抽到 20，
        //   不再依赖"共"字面量。number-int 配合 quantifier 排除百分号/分钟等量词，
        //   语义等价但更通用、与「N 根/N 条」minBars 等同源。
        levels: { kind: 'number', required: false, range: [2, 1000], extractor: { kind: 'number-int', quantifier: { include: ['格'], exclude: ['%', '％', '分钟', '小时', '秒'] } } },
        // Issue #1391 follow-up：'反向单'/'对冲'/'相邻网格'/'相邻反向' 是用户表达"双向网格"的口语形态，
        //   需映射到 sideMode='both'，避免漏识被默认值掩盖（虽然 default 是 both，但显式 evidence
        //   提升下游 readiness/consistency 信号）。
        sideMode: { kind: 'enum', required: false, enum: ['long_only', 'short_only', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '只做多': 'long_only', '仅做多': 'long_only', '只做空': 'short_only', '仅做空': 'short_only', '双向': 'both', '反向单': 'both', '相邻网格': 'both', '相邻反向': 'both', '对冲': 'both' } } },
        recycle: { kind: 'enum', required: false, enum: ['true', 'false'], default: 'true', extractor: { kind: 'enum-zh-map', enumMap: { '循环': 'true', 'recycle': 'true', '不循环': 'false' } } },
        // Issue #1391 follow-up：'立即停止'/'撤销订单'/'撤销所有未成交' 是用户对网格越界的停止动作表达，
        //   映射到 breakoutAction='stop'，与"继续/continue"形成完整双向枚举。
        breakoutAction: { kind: 'enum', required: false, enum: ['continue', 'stop'], default: 'continue', extractor: { kind: 'enum-zh-map', enumMap: { '继续': 'continue', '停止': 'stop', 'continue': 'continue', 'stop': 'stop', '立即停止': 'stop', '撤销订单': 'stop', '撤销所有未成交': 'stop', '撤销未成交': 'stop' } } },
        stepPct: { kind: 'number', required: false, range: [0, 100], extractor: { kind: 'number-decimal', pattern: '(?:每格间距|网格间距|间距|步长)\\s*(\\d+(?:\\.\\d+)?)\\s*%' } },
        perGridSizing: { kind: 'number', required: false, range: [0, 1e9], extractor: { kind: 'number-decimal', pattern: '(?:每格|per grid|each grid)\\s*(?:使用|用)?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:USDT|USDC|USD|U|刀)' } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'both',
      phraseHints: {
        triggers: [{
          keywords: ['网格', 'grid 区间', '双向网格', '上下边界', '停止', '撤销'],
          mustOutput: '单叶子 rule（phase=entry）condition=grid.range_rebalance + sideMode + breakoutAction="stop|pause|continue"；不需要额外的 entry trigger，也不需要 protective_exit；grid 自身即是连续入场源 + 出场覆盖。',
        }],
      },
      // Issue #1409 — open slot 澄清答复 golden 集
      goldenClarificationAnswers: [
        { answer: '20格', expectParams: { levels: 20 }, description: '格数澄清' },
        { answer: '区间 79200-80200', expectParams: { rangeLower: 79200, rangeUpper: 80200 }, description: '区间澄清' },
        { answer: '双向', expectParams: { sideMode: 'both' }, description: '方向澄清' },
        { answer: '停止', expectParams: { breakoutAction: 'stop' }, description: '越界动作澄清' },
      ],
    },
  },

  // ── orchestration / scope stubs（#1329 follow-up Phase 1）
  // 11 atom key 从 legacy-presentation-data.ts PRESENTATIONS 迁入；Phase 1 仅落地 seed 骨架
  // （surface.keywords/verbs/paramSlots 全部为 stub 占位），display.publicName 走 ATOM_PUBLIC_NAMES
  // 的真实双语，display.paramRenderers / display.summaryTemplate / emit.* 由
  // createPr1bDisplay + createPr1bEmit 注入 stub 兜底；Phase 2 三 stream 分别完整化：
  //   - stream A: portfolioRisk.* + gate.regime
  //   - stream B: program.*
  //   - stream C: scope.*
  // TODO #1329 follow-up Phase 2：完整 surface 同义词 + paramSlots + emit shape。
  'gate.regime': {
    corpus: {
      aliases: ['趋势过滤', '状态过滤', 'regime gate', 'trend gate'],
      positiveExamples: [
        '上涨趋势才允许做多',
        '价格高于 EMA50 才做多',
        '价格低于 EMA60 才做空',
      ],
      negativeExamples: ['形态像头肩顶', '感觉走势不太对'],
      goldenUtterances: getGoldenUtterancesForAtom('gate.regime'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.gate.regime.active_when') {
        return '请确认趋势过滤的指标（EMA/SMA/MA）与周期'
      }
      return '请补全趋势过滤参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['gate.regime'],
      paramRenderers: {
        indicator: (v) => renderEnumDisplayToken('enum.indicator', String(v).toLowerCase()),
        period: (v) => String(v),
        operator: (v, locale) => SHARED_ENUM_DISPLAY.operator[v as keyof typeof SHARED_ENUM_DISPLAY.operator]?.[locale] ?? String(v),
        sideScope: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const sideScope = typeof params.sideScope === 'string' ? params.sideScope : 'both'
        const indicator = typeof params.indicator === 'string' ? params.indicator : 'ema'
        const period = typeof params.period === 'number' ? params.period : 0
        const operator = typeof params.operator === 'string' ? params.operator : 'GT'
        const periodLabel = period > 0 ? `${period}` : ''
        if (locale === 'en') {
          const indicatorWithPeriodEn = `${indicator.toUpperCase()}${periodLabel}`
          const longLineEn = `allow long only when price is above ${indicatorWithPeriodEn}`
          const shortLineEn = `allow short only when price is below ${indicatorWithPeriodEn}`
          if (sideScope === 'long') {
            return operator === 'LT' ? shortLineEn : longLineEn
          }
          if (sideScope === 'short') {
            return operator === 'GT' ? longLineEn : shortLineEn
          }
          return `${longLineEn}; ${shortLineEn}`
        }
        const indicatorLabel = renderEnumDisplayToken('enum.indicator', indicator.toLowerCase())
        const indicatorWithPeriod = `${indicatorLabel}${periodLabel}`
        const longLine = renderDisplayToken('atom.gate.regime.long.display', { indicator: indicatorWithPeriod })
        const shortLine = renderDisplayToken('atom.gate.regime.short.display', { indicator: indicatorWithPeriod })
        if (sideScope === 'long') {
          return operator === 'LT' ? shortLine : longLine
        }
        if (sideScope === 'short') {
          return operator === 'GT' ? longLine : shortLine
        }
        return renderDisplayToken('atom.gate.regime.both.display', { longLine, shortLine })
      },
    },
    surface: {
      intent: {
        keywords: ['趋势过滤', '状态过滤', 'regime gate', 'trend gate', '上涨趋势', '下跌趋势'] as const,
        verbs: {
          fixed: ['才允许', '高于', '低于', 'above', 'below'] as const,
        },
      },
      paramSlots: {
        indicator: { kind: 'enum', required: false, enum: ['ema', 'sma', 'ma'], default: 'ema', extractor: { kind: 'enum-zh-map', enumMap: { 'EMA': 'ema', 'ema': 'ema', 'SMA': 'sma', 'sma': 'sma', 'MA': 'ma', 'ma': 'ma' } } },
        period: { kind: 'number', required: false, range: [1, 500], extractor: { kind: 'number-int', pattern: '\\d+', range: [1, 500] } },
        operator: { kind: 'enum', required: false, enum: ['GT', 'LT'], default: 'GT', extractor: { kind: 'enum-zh-map', enumMap: { '高于': 'GT', '上方': 'GT', '低于': 'LT', '下方': 'LT' } } },
        sideScope: { kind: 'enum', required: false, enum: ['long', 'short', 'both'], default: 'both', extractor: { kind: 'enum-zh-map', enumMap: { '做多': 'long', '做空': 'short', '双向': 'both' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'portfolioRisk.symbol_exposure_cap': {
    corpus: {
      aliases: ['标的敞口', 'symbol exposure cap', 'per-symbol cap', '单标的仓位限制'],
      positiveExamples: [
        'BTCUSDT 单标的敞口不超过 30%',
        'BTCUSDT 仓位超 30% 时缩减敞口',
        '标的敞口超 20% 仅记录',
      ],
      negativeExamples: ['感觉仓位重', '全仓', '随便买'],
      goldenUtterances: getGoldenUtterancesForAtom('portfolioRisk.symbol_exposure_cap'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey.includes('notional_cap_pct')) {
        return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.notional_cap_pct', {})
      }
      if (slotKey.includes('bound_symbol_scope_ref')) {
        return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.bound_symbol_scope_ref', {})
      }
      if (slotKey.includes('effect')) {
        return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.clarify.effect', {})
      }
      return '请补全标的敞口护栏参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['portfolioRisk.symbol_exposure_cap'],
      paramRenderers: {
        notionalCapPct: (v) => `${v}%`,
        mode: (v) => String(v),
        effectWhenTriggered: (v) => String(v),
        symbolLabel: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const notionalCapPct = typeof params.notionalCapPct === 'number' ? params.notionalCapPct : 0
        const mode = typeof params.mode === 'string' ? params.mode : 'enforce'
        const effect = typeof params.effectWhenTriggered === 'string' ? params.effectWhenTriggered : 'block_new_entries'
        const symbolLabelRaw = params['symbolLabel']
        if (locale === 'en') {
          const symbolPrefixEn = typeof symbolLabelRaw === 'string' && symbolLabelRaw.trim() !== ''
            ? `${symbolLabelRaw.trim()} `
            : ''
          if (mode === 'observe') {
            return `observe only: ${symbolPrefixEn}symbol exposure exceeding ${notionalCapPct}%`
          }
          if (effect === 'reduce_exposure') {
            return `reduce ${symbolPrefixEn}symbol exposure back to ${notionalCapPct}% when exceeded`
          }
          return `block new entries when ${symbolPrefixEn}symbol exposure exceeds ${notionalCapPct}%`
        }
        const symbolLabel = typeof symbolLabelRaw === 'string' && symbolLabelRaw.trim() !== ''
          ? `${symbolLabelRaw.trim()} `
          : ''
        if (mode === 'observe') {
          return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.observe', { symbolLabel, notionalCapPct })
        }
        if (effect === 'reduce_exposure') {
          return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.enforce.reduce', { symbolLabel, notionalCapPct })
        }
        return renderDisplayToken('atom.portfolioRisk.symbol_exposure_cap.display.enforce.block', { symbolLabel, notionalCapPct })
      },
    },
    surface: {
      intent: {
        keywords: ['标的敞口', 'symbol exposure cap', 'per-symbol cap', '单标的仓位限制', '单标的敞口'] as const,
        verbs: {
          gte: ['超过', '超', 'exceeds'] as const,
        },
      },
      paramSlots: {
        notionalCapPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        mode: { kind: 'enum', required: false, enum: ['enforce', 'observe'], default: 'enforce', extractor: { kind: 'enum-zh-map', enumMap: { '仅记录': 'observe', '记录': 'observe', '阻止': 'enforce', '强制': 'enforce' } } },
        effectWhenTriggered: { kind: 'enum', required: false, enum: ['block_new_entries', 'reduce_exposure'], default: 'block_new_entries', extractor: { kind: 'enum-zh-map', enumMap: { '阻止开仓': 'block_new_entries', '阻止开新仓': 'block_new_entries', '缩减敞口': 'reduce_exposure', '缩到上限': 'reduce_exposure' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'portfolioRisk.substrategy_exposure_cap': {
    corpus: {
      aliases: ['子策略敞口', 'substrategy exposure cap', 'per-substrategy cap', '子策略仓位限制'],
      positiveExamples: [
        '趋势子策略仓位上限 50%',
        '震荡子策略敞口超 40% 暂停',
        '子策略敞口超 30% 仅记录',
      ],
      negativeExamples: ['感觉子策略仓位重', '暂停所有', '随便'],
      goldenUtterances: getGoldenUtterancesForAtom('portfolioRisk.substrategy_exposure_cap'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey.includes('notional_cap_pct')) {
        return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.notional_cap_pct', {})
      }
      if (slotKey.includes('bound_substrategy_scope_ref')) {
        return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.bound_substrategy_scope_ref', {})
      }
      if (slotKey.includes('effect')) {
        return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.clarify.effect', {})
      }
      return '请补全子策略敞口护栏参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['portfolioRisk.substrategy_exposure_cap'],
      paramRenderers: {
        notionalCapPct: (v) => `${v}%`,
        mode: (v) => String(v),
        effectWhenTriggered: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const notionalCapPct = typeof params.notionalCapPct === 'number' ? params.notionalCapPct : 0
        const mode = typeof params.mode === 'string' ? params.mode : 'enforce'
        const effect = typeof params.effectWhenTriggered === 'string' ? params.effectWhenTriggered : 'block_new_entries'
        if (locale === 'en') {
          if (mode === 'observe') {
            return `observe only: sub-strategy exposure exceeding ${notionalCapPct}%`
          }
          if (effect === 'pause_substrategy') {
            return `pause sub-strategy when its exposure exceeds ${notionalCapPct}%`
          }
          return `block new entries when sub-strategy exposure exceeds ${notionalCapPct}%`
        }
        if (mode === 'observe') {
          return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.observe', { notionalCapPct })
        }
        if (effect === 'pause_substrategy') {
          return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.enforce.pause', { notionalCapPct })
        }
        return renderDisplayToken('atom.portfolioRisk.substrategy_exposure_cap.display.enforce.block', { notionalCapPct })
      },
    },
    surface: {
      intent: {
        keywords: ['子策略敞口', 'substrategy exposure cap', 'per-substrategy cap', '子策略仓位限制'] as const,
        verbs: {
          gte: ['超过', '超', 'exceeds'] as const,
        },
      },
      paramSlots: {
        notionalCapPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        mode: { kind: 'enum', required: false, enum: ['enforce', 'observe'], default: 'enforce', extractor: { kind: 'enum-zh-map', enumMap: { '仅记录': 'observe', '记录': 'observe', '阻止': 'enforce', '强制': 'enforce' } } },
        effectWhenTriggered: { kind: 'enum', required: false, enum: ['block_new_entries', 'pause_substrategy'], default: 'block_new_entries', extractor: { kind: 'enum-zh-map', enumMap: { '阻止开仓': 'block_new_entries', '阻止开新仓': 'block_new_entries', '暂停': 'pause_substrategy', '暂停子策略': 'pause_substrategy' } } },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'both',
    },
  },

  'program.dynamic_grid': {
    corpus: {
      aliases: ['跟随网格', '漂移网格', 'dynamic grid'],
      positiveExamples: [
        '在 BTCUSDT 用最近 50 根 K 线高点为锚的动态网格，5 档每档 0.5%，趋势上涨时启用，停用时撤单',
        '围绕近 30 根 K 线中点挂 8 档动态网格，每档 100 USDT，停用时保留挂单',
        'ETHUSDT 最近 100 根 K 线低点动态网格，3 档 1% 步长，趋势下跌启用，停用平仓',
      ],
      negativeExamples: ['感觉网格策略', '随便挂', '区间网格不变'],
      goldenUtterances: getGoldenUtterancesForAtom('program.dynamic_grid'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.program.dynamic_grid.anchor_lookback_bars') {
        return '请确认动态网格的 anchor lookback K 线根数（10..1000 整数）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.anchor_side') {
        return '请确认 anchor 取值方向：高点 / 低点 / 中点'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.dynamic_grid_step.mode'
        || slotKey === 'orchestration.program.dynamic_grid.dynamic_grid_step.value') {
        return '请确认网格步长（mode = pct/absolute；value > 0）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.level_count') {
        return '请确认网格档位数量（2..100 整数）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.anchor_drift_pct') {
        return '请确认 anchor 漂移阈值百分比（>0 ≤100）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.rebuild_min_interval_sec') {
        return '请确认 rebuild 最小间隔秒数（≥60）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.active_when_ref') {
        return '请确认动态网格的启用/失活条件（引用哪个趋势/状态过滤）'
      }
      if (slotKey === 'orchestration.program.dynamic_grid.sizing.mode'
        || slotKey === 'orchestration.program.dynamic_grid.sizing.value') {
        return '请确认每档下单数量（fixed_quote / fixed_base / fixed_pct）'
      }
      return '请补全动态网格策略参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['program.dynamic_grid'],
      paramRenderers: {
        anchorLookbackBars: (v) => String(v),
        anchorSide: (v) => String(v),
        levelCount: (v) => String(v),
        stepValue: (v) => String(v),
        onDeactivate: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const innerRaw = params.params
        const inner = typeof innerRaw === 'object' && innerRaw !== null && !Array.isArray(innerRaw)
          ? innerRaw as Record<string, unknown>
          : {}
        const source = Object.keys(inner).length > 0 ? inner : params
        const lookback = typeof source.anchorLookbackBars === 'number' && Number.isFinite(source.anchorLookbackBars) ? source.anchorLookbackBars : 0
        const anchorSide = typeof source.anchorSide === 'string' && source.anchorSide.length > 0 ? source.anchorSide : 'high'
        const levels = typeof source.levelCount === 'number' && Number.isFinite(source.levelCount) ? source.levelCount : 0
        const stepRaw = source.step
        const step = typeof stepRaw === 'object' && stepRaw !== null && !Array.isArray(stepRaw)
          ? stepRaw as Record<string, unknown>
          : {}
        const stepMode = typeof step.mode === 'string' && step.mode.length > 0 ? step.mode : 'pct'
        const stepValue = typeof step.value === 'number' && Number.isFinite(step.value) ? step.value : 0
        const onDeactivate = typeof source.onDeactivate === 'string' && source.onDeactivate.length > 0 ? source.onDeactivate : 'cancel'
        const stepLabel = stepMode === 'pct' ? `${stepValue}%` : `${stepValue}`
        if (locale === 'en') {
          const sideLabelEn: Record<string, string> = { high: 'high', low: 'low', mid: 'mid' }
          const deactivateLabelEn: Record<string, string> = { cancel: 'cancel orders', keep: 'keep orders', close: 'close positions' }
          return `dynamic grid anchored at recent ${lookback}-bar ${sideLabelEn[anchorSide] ?? 'high'}, ${levels} levels (${stepLabel} each), on deactivate ${deactivateLabelEn[onDeactivate] ?? 'cancel orders'}`
        }
        const sideLabel: Record<string, string> = { high: '高点', low: '低点', mid: '中点' }
        const deactivateLabel: Record<string, string> = { cancel: '撤单', keep: '保留挂单', close: '平仓' }
        return `围绕最近 ${lookback} 根 K 线${sideLabel[anchorSide] ?? '高点'}的 ${levels} 档动态网格（每档 ${stepLabel}），失活时${deactivateLabel[onDeactivate] ?? '撤单'}`
      },
    },
    surface: {
      intent: {
        keywords: ['动态网格', '跟随网格', '漂移网格', 'dynamic grid'] as const,
        verbs: {
          fixed: ['围绕', '锚定', '动态'] as const,
        },
      },
      paramSlots: {
        anchorLookbackBars: { kind: 'number', required: false, range: [10, 1000], extractor: { kind: 'number-int', pattern: '\\d+', range: [10, 1000] } },
        anchorSide: { kind: 'enum', required: false, enum: ['high', 'low', 'mid'], default: 'high', extractor: { kind: 'enum-zh-map', enumMap: { '高点': 'high', '低点': 'low', '中点': 'mid' } } },
        levelCount: { kind: 'number', required: false, range: [2, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [2, 100] } },
        onDeactivate: { kind: 'enum', required: false, enum: ['cancel', 'keep', 'close'], default: 'cancel', extractor: { kind: 'enum-zh-map', enumMap: { '撤单': 'cancel', '保留挂单': 'keep', '保留': 'keep', '平仓': 'close' } } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  'program.fixed_grid_gated': {
    corpus: {
      aliases: ['门控网格', '区间网格', 'gated grid', 'fixed grid program'],
      positiveExamples: [
        'BTCUSDT 50000-60000 区间挂 10 档网格，5% 步长，趋势上涨时启用',
        '锚定 50000 挂 10 档 5% 步长，失活时撤单',
        '区间网格趋势上涨启用，失活时平仓',
      ],
      negativeExamples: ['感觉网格策略', '挂网格', '随便挂'],
      goldenUtterances: getGoldenUtterancesForAtom('program.fixed_grid_gated'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.program.fixed_grid_gated.gridParams') {
        return '请确认网格区间、档数、步长'
      }
      if (slotKey === 'orchestration.program.fixed_grid_gated.activeWhenRef') {
        return '请确认网格的启用/失活条件（引用哪个趋势/状态过滤）'
      }
      if (slotKey === 'orchestration.program.fixed_grid_gated.sizing') {
        return '请确认每档下单数量'
      }
      return '请补全网格策略参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['program.fixed_grid_gated'],
      paramRenderers: {
        lowerBound: (v) => String(v),
        upperBound: (v) => String(v),
        anchorPrice: (v) => String(v),
        levelCount: (v) => String(v),
        stepPct: (v) => String(v),
        onDeactivate: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const innerRaw = params.params
        const inner = typeof innerRaw === 'object' && innerRaw !== null && !Array.isArray(innerRaw)
          ? innerRaw as Record<string, unknown>
          : {}
        const source = Object.keys(inner).length > 0 ? inner : params
        const lower = typeof source.lowerBound === 'number' && Number.isFinite(source.lowerBound) ? source.lowerBound : 0
        const upper = typeof source.upperBound === 'number' && Number.isFinite(source.upperBound) ? source.upperBound : 0
        const anchor = typeof source.anchorPrice === 'number' && Number.isFinite(source.anchorPrice) ? source.anchorPrice : 0
        const levels = typeof source.levelCount === 'number' && Number.isFinite(source.levelCount) ? source.levelCount : 0
        const step = typeof source.stepPct === 'number' && Number.isFinite(source.stepPct) ? source.stepPct : 0
        const onDeactivate = typeof source.onDeactivate === 'string' && source.onDeactivate.length > 0 ? source.onDeactivate : 'cancel'
        if (locale === 'en') {
          const rangeLabelEn = lower > 0 && upper > 0
            ? `in range ${lower}-${upper}`
            : anchor > 0
              ? `anchored at ${anchor}`
              : 'in the configured range'
          const deactivateLabelEn: Record<string, string> = { cancel: 'cancel orders', keep: 'keep orders', close: 'close positions' }
          return `place ${levels}-level grid ${rangeLabelEn} (step ${step}%), on deactivate ${deactivateLabelEn[onDeactivate] ?? 'cancel orders'}`
        }
        const rangeLabel = lower > 0 && upper > 0
          ? `在 ${lower}-${upper} 区间`
          : anchor > 0
            ? `锚定 ${anchor}`
            : '在指定区间'
        return renderDisplayToken('atom.program.fixed_grid_gated.display', {
          range: rangeLabel,
          levels,
          step,
          onDeactivate: renderEnumDisplayToken('enum.onDeactivate', onDeactivate),
        })
      },
    },
    surface: {
      intent: {
        keywords: ['门控网格', '区间网格', '门控固定网格', 'gated grid', 'fixed grid program'] as const,
        verbs: {
          fixed: ['挂', '锚定', '区间'] as const,
        },
      },
      paramSlots: {
        lowerBound: { kind: 'number', required: false, range: [0, Number.MAX_SAFE_INTEGER], extractor: { kind: 'number-int', pattern: '\\d+(\\.\\d+)?', range: [0, Number.MAX_SAFE_INTEGER] } },
        upperBound: { kind: 'number', required: false, range: [0, Number.MAX_SAFE_INTEGER], extractor: { kind: 'number-int', pattern: '\\d+(\\.\\d+)?', range: [0, Number.MAX_SAFE_INTEGER] } },
        levelCount: { kind: 'number', required: false, range: [2, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [2, 100] } },
        stepPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        onDeactivate: { kind: 'enum', required: false, enum: ['cancel', 'keep', 'close'], default: 'cancel', extractor: { kind: 'enum-zh-map', enumMap: { '撤单': 'cancel', '保留挂单': 'keep', '保留': 'keep', '平仓': 'close' } } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  'program.adaptive_volatility_grid': {
    corpus: {
      aliases: ['波动自适应网格', 'atr grid', 'adaptive grid', '波动率网格'],
      positiveExamples: [
        '用 ATR(14) 的 1.5 倍为步长、3 倍为区间的自适应网格',
        'ATR 自适应网格，6 档，每档不少于 0.2% 不超过 2%',
        '波动率 14 自适应网格，1 倍步长 5 倍区间',
      ],
      negativeExamples: ['挂个自适应网格', '随便用 ATR'],
      goldenUtterances: getGoldenUtterancesForAtom('program.adaptive_volatility_grid'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_period') return '请确认 ATR 周期（2..200 整数）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_multiplier') return '请确认 ATR 步长系数（>0）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.range_multiplier') return '请确认 ATR 区间系数（>0）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.atr_drift_pct') return '请确认 ATR 漂移百分比（>0 且 ≤100）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.rebuild_cooldown_sec') return '请确认重建冷却时长（≥300 整数秒）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.min_step_pct') return '请确认最小步长百分比（>0）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.max_step_pct') return '请确认最大步长百分比（>0 且 ≥ 最小步长）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.level_count') return '请确认档位数量（2..100 整数）'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.sizing') return '请确认每档下单数量'
      if (slotKey === 'orchestration.program.adaptive_volatility_grid.active_when_ref') return '请确认网格启用/失活条件（引用哪个趋势过滤）'
      return '请补全自适应网格参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['program.adaptive_volatility_grid'],
      paramRenderers: {
        atrPeriod: (v) => String(v),
        atrMultiplier: (v) => String(v),
        rangeMultiplier: (v) => String(v),
        minStepPct: (v) => String(v),
        maxStepPct: (v) => String(v),
        levelCount: (v) => String(v),
        onDeactivate: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const innerRaw = params.params
        const inner = typeof innerRaw === 'object' && innerRaw !== null && !Array.isArray(innerRaw)
          ? innerRaw as Record<string, unknown>
          : {}
        const source = Object.keys(inner).length > 0 ? inner : params
        const atrPeriod = typeof source.atrPeriod === 'number' && Number.isFinite(source.atrPeriod) ? source.atrPeriod : 14
        const atrMultiplier = typeof source.atrMultiplier === 'number' && Number.isFinite(source.atrMultiplier) ? source.atrMultiplier : 1.5
        const rangeMultiplier = typeof source.rangeMultiplier === 'number' && Number.isFinite(source.rangeMultiplier) ? source.rangeMultiplier : 3
        const minStepPct = typeof source.minStepPct === 'number' && Number.isFinite(source.minStepPct) ? source.minStepPct : 0.2
        const maxStepPct = typeof source.maxStepPct === 'number' && Number.isFinite(source.maxStepPct) ? source.maxStepPct : 2
        const levelCount = typeof source.levelCount === 'number' && Number.isFinite(source.levelCount) ? source.levelCount : 6
        const onDeactivate = typeof source.onDeactivate === 'string' && source.onDeactivate.length > 0 ? source.onDeactivate : 'cancel'
        if (locale === 'en') {
          const deactivateLabelEn: Record<string, string> = { cancel: 'cancel orders', keep: 'keep orders', close: 'close positions' }
          return (
            `adaptive grid with step ${atrMultiplier}x ATR(${atrPeriod}) and range ${rangeMultiplier}x ATR(${atrPeriod}), `
            + `${levelCount} levels, each clamped to ${minStepPct}%-${maxStepPct}%, on deactivate ${deactivateLabelEn[onDeactivate] ?? 'cancel orders'}`
          )
        }
        const deactivateLabel: Record<string, string> = { cancel: '撤单', keep: '保留挂单', close: '平仓' }
        return (
          `ATR(${atrPeriod}) 的 ${atrMultiplier} 倍为步长、${rangeMultiplier} 倍为区间的自适应网格，`
          + `${levelCount} 档，每档 ${minStepPct}%-${maxStepPct}% 钳制，失活时${deactivateLabel[onDeactivate] ?? '撤单'}`
        )
      },
    },
    surface: {
      intent: {
        keywords: ['ATR 自适应网格', '波动自适应网格', 'atr grid', 'adaptive grid', '波动率网格'] as const,
        verbs: {
          fixed: ['ATR', '自适应', '波动率'] as const,
        },
      },
      paramSlots: {
        atrPeriod: { kind: 'number', required: false, range: [2, 200], extractor: { kind: 'number-int', pattern: '\\d+', range: [2, 200] } },
        atrMultiplier: { kind: 'number', required: false, range: [0.01, 100], extractor: { kind: 'number-int', pattern: '\\d+(\\.\\d+)?', range: [0.01, 100] } },
        rangeMultiplier: { kind: 'number', required: false, range: [0.01, 100], extractor: { kind: 'number-int', pattern: '\\d+(\\.\\d+)?', range: [0.01, 100] } },
        minStepPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        maxStepPct: { kind: 'percent', required: false, range: [0, 100], extractor: { kind: 'percent', pattern: '\\d+(\\.\\d+)?%', range: [0, 100] } },
        levelCount: { kind: 'number', required: false, range: [2, 100], extractor: { kind: 'number-int', pattern: '\\d+', range: [2, 100] } },
        onDeactivate: { kind: 'enum', required: false, enum: ['cancel', 'keep', 'close'], default: 'cancel', extractor: { kind: 'enum-zh-map', enumMap: { '撤单': 'cancel', '保留挂单': 'keep', '保留': 'keep', '平仓': 'close' } } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  'program.event_listener': {
    corpus: {
      aliases: ['事件监听', 'webhook 监听', '外部事件订阅', 'event listener'],
      positiveExamples: [
        'OKX 合约 BTCUSDT 15m，订阅 binance webhook 事件源，趋势上涨时启用 tradingview 喊单监听',
        'discord 事件监听，按 signalId 去重 5 秒，过期 60 秒丢弃',
        'telegram 信号监听，每 10 秒去重，过期 60 秒上报告警',
      ],
      negativeExamples: ['挂个网格策略', '随便接 webhook'],
      goldenUtterances: getGoldenUtterancesForAtom('program.event_listener'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.program.event_listener.event_schema_ref') {
        return '请确认事件 schema（仅支持 webhook 事件）'
      }
      if (slotKey === 'orchestration.program.event_listener.source_ref') {
        return '请确认事件源数据节点 id（引用一个 role=event 的数据源）'
      }
      if (slotKey === 'orchestration.program.event_listener.permission_scope') {
        return '请确认事件权限命名空间（如 tradingview:alpha；小写字母开头，3-64 字符）'
      }
      if (slotKey === 'orchestration.program.event_listener.idempotency_key.field_path') {
        return '请确认幂等字段名（仅允许 0-1 层路径，如 signalId 或 data.signalId）'
      }
      if (slotKey === 'orchestration.program.event_listener.dedup_window_ms') {
        return '请确认去重窗口毫秒（100..3600000 整数）'
      }
      if (slotKey === 'orchestration.program.event_listener.expiration_ttl_ms') {
        return '请确认事件过期时长毫秒（100..86400000 整数；必须严格大于去重窗口）'
      }
      if (slotKey === 'orchestration.program.event_listener.expiration_policy') {
        return '请确认过期事件处理策略（丢弃 / 上报）'
      }
      if (slotKey === 'orchestration.program.event_listener.on_deactivate') {
        return '请确认停用时行为（撤单 / 保留监听）'
      }
      if (slotKey === 'orchestration.program.event_listener.active_when_ref') {
        return '请确认事件监听的启用/失活条件（引用哪个趋势/状态过滤）'
      }
      if (slotKey === 'orchestration.program.event_listener.rebuild_policy') {
        return '请确认重建策略（始终保留 / schema 版本变更时清空）'
      }
      if (slotKey === 'orchestration.program.event_listener.program_kind') {
        return '请确认 programKind 为事件监听类型'
      }
      return '请补全事件监听参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['program.event_listener'],
      paramRenderers: {
        permissionScope: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const innerRaw = params.params
        const inner = typeof innerRaw === 'object' && innerRaw !== null && !Array.isArray(innerRaw)
          ? innerRaw as Record<string, unknown>
          : {}
        const source = Object.keys(inner).length > 0 ? inner : params
        const permissionScope = typeof source.permissionScope === 'string' && source.permissionScope.length > 0 ? source.permissionScope : ''
        if (locale === 'en') {
          const providerEn = permissionScope.split(':')[0] || 'external'
          const providerLabelEn: Record<string, string> = {
            tradingview: 'TradingView alerts',
            discord: 'Discord signals',
            telegram: 'Telegram signals',
            webhook: 'Webhook signals',
          }
          return `event listener — ${providerLabelEn[providerEn] ?? 'external event'}`
        }
        const provider = permissionScope.split(':')[0] || '外部信号'
        const providerLabel: Record<string, string> = {
          tradingview: 'TradingView 喊单',
          discord: 'Discord 喊单',
          telegram: 'Telegram 喊单',
          webhook: 'Webhook 信号',
        }
        return `事件监听 — ${providerLabel[provider] ?? '外部事件'}`
      },
    },
    surface: {
      intent: {
        keywords: ['事件监听', 'webhook 监听', '外部事件订阅', 'event listener'] as const,
        verbs: {
          fixed: ['订阅', '监听', '触发'] as const,
        },
      },
      paramSlots: {
        permissionScope: { kind: 'enum', required: false, enum: ['tradingview', 'discord', 'telegram', 'webhook'], extractor: { kind: 'enum-zh-map', enumMap: { 'tradingview': 'tradingview', 'TradingView': 'tradingview', 'discord': 'discord', 'Discord': 'discord', 'telegram': 'telegram', 'Telegram': 'telegram', 'webhook': 'webhook', 'Webhook': 'webhook' } } },
        dedupWindowMs: { kind: 'number', required: false, range: [100, 3600000], extractor: { kind: 'number-int', pattern: '\\d+', range: [100, 3600000] } },
        expirationTtlMs: { kind: 'number', required: false, range: [100, 86400000], extractor: { kind: 'number-int', pattern: '\\d+', range: [100, 86400000] } },
      },
      phaseResolver: 'fixed-entry',
      sideResolver: 'inherit',
    },
  },

  'scope.symbol': {
    corpus: {
      aliases: ['多标的范围', '多币种作用域', '标的作用域', 'symbol scope'],
      positiveExamples: [
        'BTCUSDT 和 ETHUSDT 同时跑相同策略',
        '在 BTC 和 ETH 上挂网格',
        'BTCUSDT、ETHUSDT、SOLUSDT 多个标的同时跑',
      ],
      negativeExamples: ['只交易 BTCUSDT', '感觉多个币都行', '随便几个币'],
      goldenUtterances: getGoldenUtterancesForAtom('scope.symbol'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.scope.symbol.symbols') return '请确认要绑定的标的列表'
      if (slotKey === 'orchestration.scope.symbol.primary_symbol') return '主标的必须在标的列表中'
      if (slotKey === 'orchestration.scope.symbol.symbols_overlap') return '多 scope 之间标的不能重叠'
      if (slotKey === 'orchestration.scope.symbol.primary_symbol_collision') return '多 scope 主标的必须各自唯一'
      if (slotKey === 'orchestration.scope.symbol.missing_binding') return '请确认该规则绑定到哪个 symbol scope'
      if (slotKey === 'orchestration.scope.unsupported_kind') return '当前仅支持 scope.symbol / scope.leg / scope.timeframe / scope.dataSource / scope.subStrategy'
      return '请补全标的范围参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['scope.symbol'],
      paramRenderers: {
        symbols: (v) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').join('、') : String(v),
        primarySymbol: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const symbolsRaw = params.symbols
        const primary = typeof params.primarySymbol === 'string' ? params.primarySymbol : ''
        if (locale === 'en') {
          const symbolsEn = Array.isArray(symbolsRaw)
            ? symbolsRaw.filter((s): s is string => typeof s === 'string').join(', ')
            : ''
          if (symbolsEn === '') return ATOM_PUBLIC_NAMES['scope.symbol'].en
          if (primary !== '') {
            return `Symbol scope: ${symbolsEn} (primary ${primary})`
          }
          return `Symbol scope: ${symbolsEn}`
        }
        const symbols = Array.isArray(symbolsRaw)
          ? symbolsRaw.filter((s): s is string => typeof s === 'string').join('、')
          : ''
        if (symbols === '') return ATOM_PUBLIC_NAMES['scope.symbol'].zh
        if (primary !== '') {
          return renderDisplayToken('atom.scope.symbol.display.with_primary', { symbols, primarySymbol: primary })
        }
        return renderDisplayToken('atom.scope.symbol.display.no_primary', { symbols })
      },
    },
    surface: {
      intent: {
        keywords: ['标的范围', '多标的范围', '多币种作用域', '标的作用域', 'symbol scope'] as const,
        verbs: {
          fixed: ['标的范围', 'symbol scope'] as const,
        },
      },
      paramSlots: {
        symbols: { kind: 'symbol', required: false },
        primarySymbol: { kind: 'symbol', required: false },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'scope.leg': {
    corpus: {
      aliases: ['对冲腿', '多空腿', 'hedge legs', 'strategy legs', '腿'],
      positiveExamples: [
        '做多 BTC 同时做空 ETH，等比对冲',
        '三条腿：多 BTC、多 ETH、空 SOL',
        'BTCUSDT 多头腿、ETHUSDT 空头腿，1:2 对冲',
      ],
      negativeExamples: ['做多 BTCUSDT 和 ETHUSDT', '随便对冲一下'],
      goldenUtterances: getGoldenUtterancesForAtom('scope.leg'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.scope.leg.unsupported_kind') return '当前仅支持 scope.leg 子类型'
      if (slotKey === 'orchestration.scope.leg.leg_scope_kind') return '请确认 legScopeKind 为 leg'
      if (slotKey === 'orchestration.scope.leg.leg_id') return '请确认腿 id（字母开头、字母数字下划线点、长度 ≤ 64）'
      if (slotKey === 'orchestration.scope.leg.direction') return '请确认腿方向（long/short）'
      if (slotKey === 'orchestration.scope.leg.instrument_ref') return '该腿引用的 scope.symbol 节点必须已存在且 readiness 已通过'
      if (slotKey === 'orchestration.scope.leg.leg_sizing.mode') return '请确认 legSizing.mode（fixed_pct/fixed_quote/fixed_ratio）'
      if (slotKey === 'orchestration.scope.leg.leg_sizing.value') return '请确认 legSizing.value（>0 有限数）'
      if (slotKey === 'orchestration.scope.leg.paired_leg_id') return 'fixed_ratio 模式必须指定 pairedLegId'
      if (slotKey === 'orchestration.scope.leg.direction_collision') return 'paired leg 必须方向相反（对冲腿）'
      if (slotKey === 'orchestration.scope.leg.missing_binding') return '请确认该规则绑定到哪个策略腿'
      return '请补全策略腿参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['scope.leg'],
      paramRenderers: {
        direction: (v) => String(v),
        instrumentSymbol: (v) => String(v),
        instrumentRef: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const direction = typeof params.direction === 'string' ? params.direction : ''
        const instrumentSym = typeof params.instrumentSymbol === 'string' ? params.instrumentSymbol : ''
        const instrumentRefRaw = typeof params.instrumentRef === 'string' ? params.instrumentRef : ''
        const instrument = instrumentSym !== '' ? instrumentSym : instrumentRefRaw
        if (locale === 'en') {
          if (direction === 'long' && instrument !== '') {
            return `Long leg (${instrument})`
          }
          if (direction === 'short' && instrument !== '') {
            return `Short leg (${instrument})`
          }
          const legsRawEn = params.legs
          if (Array.isArray(legsRawEn)) {
            const partsEn: string[] = []
            for (const item of legsRawEn) {
              if (typeof item !== 'object' || item === null) continue
              const r = item as Record<string, unknown>
              const d = typeof r.direction === 'string' ? r.direction : ''
              const sym = typeof r.instrumentSymbol === 'string' ? r.instrumentSymbol : ''
              if (sym === '') continue
              partsEn.push(d === 'short' ? `short ${sym}` : `long ${sym}`)
            }
            if (partsEn.length > 0) {
              return `Hedge combo: ${partsEn.join(', ')}`
            }
          }
          return ATOM_PUBLIC_NAMES['scope.leg'].en
        }
        if (direction === 'long' && instrument !== '') {
          return renderDisplayToken('atom.scope.leg.display.long', { instrument })
        }
        if (direction === 'short' && instrument !== '') {
          return renderDisplayToken('atom.scope.leg.display.short', { instrument })
        }
        const legsRaw = params.legs
        if (Array.isArray(legsRaw)) {
          const parts: string[] = []
          for (const item of legsRaw) {
            if (typeof item !== 'object' || item === null) continue
            const r = item as Record<string, unknown>
            const d = typeof r.direction === 'string' ? r.direction : ''
            const sym = typeof r.instrumentSymbol === 'string' ? r.instrumentSymbol : ''
            if (sym === '') continue
            parts.push(d === 'short' ? `空 ${sym}` : `多 ${sym}`)
          }
          if (parts.length > 0) {
            return renderDisplayToken('atom.scope.leg.display.hedge', { legs: parts.join('、') })
          }
        }
        return ATOM_PUBLIC_NAMES['scope.leg'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['策略腿', '对冲腿', '多空腿', 'hedge legs', 'strategy legs'] as const,
        verbs: {
          fixed: ['对冲腿', 'hedge leg'] as const,
        },
      },
      paramSlots: {
        direction: { kind: 'enum', required: false, enum: ['long', 'short'] },
        instrumentSymbol: { kind: 'symbol', required: false },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'scope.timeframe': {
    corpus: {
      aliases: ['多周期范围', '多时间框架', 'timeframe scope', '周期作用域'],
      positiveExamples: [
        '15 分钟主周期，1 小时和 4 小时做 scope 依赖周期',
        '执行周期 5m，参考 15m 1h 多时间框架 scope',
        '主周期 1h，依赖 4h 1d 严格对齐',
      ],
      negativeExamples: ['只用 15 分钟一个周期', '随便几个周期都行'],
      goldenUtterances: getGoldenUtterancesForAtom('scope.timeframe'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.scope.timeframe.primary_timeframe') return '请确认执行周期（主周期）'
      if (slotKey === 'orchestration.scope.timeframe.required_timeframes') return '请确认依赖周期列表（≥1 个，且与主周期不同）'
      if (slotKey === 'orchestration.scope.timeframe.required_length') return '依赖周期数量必须在 1..8 之间'
      if (slotKey === 'orchestration.scope.timeframe.primary_granularity') return '主周期粒度必须严格细于所有依赖周期'
      if (slotKey === 'orchestration.scope.timeframe.alignment_policy') return '请确认对齐严格度（strict / tolerant）'
      if (slotKey === 'orchestration.scope.timeframe.duplicate_definition') return '多 scope.timeframe 之间 (主周期, 依赖周期集合) 不能完全相同'
      if (slotKey === 'orchestration.scope.timeframe.missing_binding') return '请确认该规则绑定到哪个 timeframe scope（必须显式声明）'
      if (slotKey === 'orchestration.scope.timeframe.unsupported_key') return '当前仅支持 scope.timeframe'
      if (slotKey === 'orchestration.scope.timeframe.scope_kind') return '请确认 scopeKind 为 timeframe'
      return '请补全周期范围参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['scope.timeframe'],
      paramRenderers: {
        primaryTimeframe: (v) => String(v),
        requiredTimeframes: (v) => Array.isArray(v) ? v.filter((tf): tf is string => typeof tf === 'string').join('、') : String(v),
        alignmentPolicy: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const primary = typeof params.primaryTimeframe === 'string' ? params.primaryTimeframe : ''
        const requiredRaw = params.requiredTimeframes
        const required = Array.isArray(requiredRaw)
          ? requiredRaw.filter((tf): tf is string => typeof tf === 'string').join('、')
          : ''
        const alignmentPolicy = typeof params.alignmentPolicy === 'string' && params.alignmentPolicy.length > 0
          ? params.alignmentPolicy
          : 'strict'
        if (locale === 'en') {
          if (primary === '' || required === '') return ATOM_PUBLIC_NAMES['scope.timeframe'].en
          return `Timeframe scope: primary ${primary}, required ${required} (${alignmentPolicy})`
        }
        if (primary === '' || required === '') return ATOM_PUBLIC_NAMES['scope.timeframe'].zh
        return renderDisplayToken('atom.scope.timeframe.display.with_required', {
          primaryTimeframe: primary,
          requiredTimeframes: required,
          alignmentPolicy,
        })
      },
    },
    surface: {
      intent: {
        keywords: ['周期范围', '多周期范围', '多时间框架', 'timeframe scope', '周期作用域'] as const,
        verbs: {
          fixed: ['周期范围', 'timeframe scope'] as const,
        },
      },
      paramSlots: {
        primaryTimeframe: { kind: 'duration', required: false },
        alignmentPolicy: { kind: 'enum', required: false, enum: ['strict', 'tolerant'], default: 'strict' },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  'scope.dataSource': {
    corpus: {
      aliases: ['数据源作用域', '行情源作用域', 'data source scope', 'feed scope'],
      positiveExamples: [
        '主行情源 binance.spot.btcusdt 用 OHLCV',
        '事件源 webhook tradingview.alpha 接收信号',
        'primary feed binance.spot.ethusdt OHLCV, confirmation feed okx.spot.ethusdt orderbook',
      ],
      negativeExamples: ['随便选个数据源', '看市场情况', '只交易 BTC'],
      goldenUtterances: getGoldenUtterancesForAtom('scope.dataSource'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.scope.dataSource.role') return '请确认数据源角色（primary/confirmation/event）'
      if (slotKey === 'orchestration.scope.dataSource.feed_id') return '请确认数据源 feedId（如 binance.spot.btcusdt）'
      if (slotKey === 'orchestration.scope.dataSource.schema_ref') return '请确认数据源 schema（ohlcv/orderbook/liquidation/webhook_event）'
      if (slotKey === 'orchestration.scope.dataSource.feed_id_overlap') return '多 scope 间 feedId 不能重复'
      if (slotKey === 'orchestration.scope.dataSource.primary_collision') return 'primary 数据源最多一个'
      if (slotKey === 'orchestration.scope.dataSource.missing_binding') return '请确认该规则绑定到哪个 dataSource scope'
      if (slotKey === 'orchestration.scope.dataSource.scope_kind') return '请确认 scopeKind 为 dataSource'
      return '请补全数据源参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['scope.dataSource'],
      paramRenderers: {
        role: (v) => String(v),
        feedId: (v) => String(v),
        schemaRef: (v) => String(v),
        schema: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const role = typeof params.role === 'string' ? params.role : ''
        const feedId = typeof params.feedId === 'string' ? params.feedId : ''
        const schemaRefRaw = typeof params.schemaRef === 'string' ? params.schemaRef : ''
        const schemaPlain = typeof params.schema === 'string' ? params.schema : ''
        const schema = schemaRefRaw !== '' ? schemaRefRaw : schemaPlain
        if (locale === 'en') {
          if (role === '' || feedId === '') return ATOM_PUBLIC_NAMES['scope.dataSource'].en
          return `Data source: ${role} (${feedId}${schema !== '' ? ` / ${schema}` : ''})`
        }
        if (role === '' || feedId === '') return ATOM_PUBLIC_NAMES['scope.dataSource'].zh
        return renderDisplayToken('atom.scope.dataSource.display', { role, feedId, schema })
      },
    },
    surface: {
      intent: {
        keywords: ['数据源作用域', '行情源作用域', 'data source scope', 'feed scope'] as const,
        verbs: {
          fixed: ['数据源作用域', 'data source scope'] as const,
        },
      },
      paramSlots: {
        role: { kind: 'enum', required: false, enum: ['primary', 'confirmation', 'event'] },
        feedId: { kind: 'symbol', required: false },
        schemaRef: { kind: 'enum', required: false, enum: ['ohlcv', 'orderbook', 'liquidation', 'webhook_event'] },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  // #1329 follow-up Phase 3e: scope.subStrategy 完整迁入 ATOM_CONTRACT_REGISTRY.display
  'scope.subStrategy': {
    corpus: {
      aliases: ['多子策略', '策略切换范围', 'sub-strategy scope', 'sub strategy scope'],
      positiveExamples: [
        '趋势行情用趋势子策略，震荡行情用震荡子策略',
        '上涨时跑策略 A，下跌时跑策略 B',
        '在 BTCUSDT 上跑两套子策略，根据 ATR 切换',
      ],
      negativeExamples: ['只跑一个策略', '不需要切换', '策略不行'],
      goldenUtterances: getGoldenUtterancesForAtom('scope.subStrategy'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.scope.subStrategy.scope_kind') return '请确认 scopeKind 为 subStrategy'
      if (slotKey === 'orchestration.scope.subStrategy.substrategy_id') return '请确认子策略 ID（非空且长度 ≤ 64）'
      if (slotKey === 'orchestration.scope.subStrategy.position_handling') return '请确认子策略切换时是否平仓（close/keep）'
      if (slotKey === 'orchestration.scope.subStrategy.order_handling') return '请确认子策略切换时是否取消挂单（cancel/keep）'
      if (slotKey === 'orchestration.scope.subStrategy.id_collision') return '多 scope 子策略 ID 必须唯一'
      if (slotKey === 'orchestration.scope.subStrategy.missing_binding') return '请确认该规则绑定到哪个 sub-strategy scope'
      return '请补全子策略范围参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['scope.subStrategy'],
      paramRenderers: {
        subStrategyId: (v) => String(v),
        subStrategyLabel: (v) => String(v),
        positionHandlingOnDeactivate: (v) => String(v),
        orderHandlingOnDeactivate: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const labelRaw = typeof params.subStrategyLabel === 'string' ? params.subStrategyLabel : ''
        const idRaw = typeof params.subStrategyId === 'string' ? params.subStrategyId : ''
        const label = labelRaw !== '' ? labelRaw : idRaw
        const positionHandling = typeof params.positionHandlingOnDeactivate === 'string' ? params.positionHandlingOnDeactivate : ''
        const orderHandling = typeof params.orderHandlingOnDeactivate === 'string' ? params.orderHandlingOnDeactivate : ''
        if (locale === 'en') {
          if (label === '') return ATOM_PUBLIC_NAMES['scope.subStrategy'].en
          if (positionHandling !== '' && orderHandling !== '') {
            return `Sub-strategy: ${label} (on switch — position: ${positionHandling}, orders: ${orderHandling})`
          }
          return `Sub-strategy: ${label}`
        }
        if (label === '') return ATOM_PUBLIC_NAMES['scope.subStrategy'].zh
        if (positionHandling !== '' && orderHandling !== '') {
          return renderDisplayToken('atom.scope.subStrategy.display.with_handling', {
            label,
            positionHandling,
            orderHandling,
          })
        }
        return renderDisplayToken('atom.scope.subStrategy.display.no_handling', { label })
      },
    },
    surface: {
      intent: {
        keywords: ['子策略范围', '多子策略', '策略切换范围', 'sub-strategy scope', 'sub strategy scope'] as const,
        verbs: {
          fixed: ['子策略范围', 'sub-strategy scope'] as const,
        },
      },
      paramSlots: {
        subStrategyId: { kind: 'symbol', required: false },
        positionHandlingOnDeactivate: { kind: 'enum', required: false, enum: ['close', 'keep'] },
        orderHandlingOnDeactivate: { kind: 'enum', required: false, enum: ['cancel', 'keep'] },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  // #1329 follow-up Phase 3e: gate.subStrategy 完整迁入 ATOM_CONTRACT_REGISTRY.display
  'gate.subStrategy': {
    corpus: {
      aliases: ['子策略切换', '子策略暂停', 'sub-strategy gate'],
      positiveExamples: ['RSI > 70 切到震荡子策略，<30 切回趋势子策略', '盘整时暂停趋势子策略'],
      negativeExamples: ['不需要切换'],
      goldenUtterances: getGoldenUtterancesForAtom('gate.subStrategy'),
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: COMMON_PIPELINE,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'orchestration.gate.subStrategy.scope_ref_unknown') return 'gate 引用的子策略 scope 未声明'
      if (slotKey === 'orchestration.gate.subStrategy.effect_phase_mismatch') return 'phase=subStrategy 仅支持 pause_substrategy / switch_substrategy'
      if (slotKey === 'orchestration.gate.subStrategy.switch_target_required') return 'switch_substrategy gate 必须指定切换目标 scope'
      if (slotKey === 'orchestration.gate.subStrategy.switch_target_self') return '切换目标不能与源 scope 相同'
      if (slotKey === 'orchestration.gate.subStrategy.active_when') return '请确认 gate 的判定条件'
      if (slotKey === 'orchestration.gate.unsupported_phase') return '当前不支持 phase=strategy 的 gate'
      if (slotKey === 'orchestration.gate.regime.effect_phase_mismatch') return 'phase=entry 仅支持 block_new_entries effect'
      return '请补全子策略 gate 参数'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: { ...DEFAULT_CLASSIFIER_META },
    display: {
      publicName: ATOM_PUBLIC_NAMES['gate.subStrategy'],
      paramRenderers: {
        effectWhenFalse: (v) => String(v),
        subStrategyScopeRef: (v) => String(v),
        toSubStrategyScopeRef: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        const effect = typeof params.effectWhenFalse === 'string' ? params.effectWhenFalse : ''
        if (locale === 'en') {
          if (effect === 'pause_substrategy') {
            const label = typeof params.subStrategyScopeRef === 'string' ? params.subStrategyScopeRef : ''
            return `Pause sub-strategy${label !== '' ? ` ${label}` : ''} when condition is false`
          }
          if (effect === 'switch_substrategy') {
            const toLabel = typeof params.toSubStrategyScopeRef === 'string' ? params.toSubStrategyScopeRef : ''
            return `Switch to sub-strategy${toLabel !== '' ? ` ${toLabel}` : ''} when condition is true`
          }
          return ATOM_PUBLIC_NAMES['gate.subStrategy'].en
        }
        if (effect === 'pause_substrategy') {
          const label = typeof params.subStrategyScopeRef === 'string' ? params.subStrategyScopeRef : ''
          return renderDisplayToken('atom.gate.subStrategy.pause', { label })
        }
        if (effect === 'switch_substrategy') {
          const toLabel = typeof params.toSubStrategyScopeRef === 'string' ? params.toSubStrategyScopeRef : ''
          return renderDisplayToken('atom.gate.subStrategy.switch', { toLabel })
        }
        return ATOM_PUBLIC_NAMES['gate.subStrategy'].zh
      },
    },
    surface: {
      intent: {
        keywords: ['子策略 gate', '子策略切换', '子策略暂停', 'sub-strategy gate'] as const,
        verbs: {
          fixed: ['子策略 gate', 'sub-strategy gate'] as const,
        },
      },
      paramSlots: {
        effectWhenFalse: { kind: 'enum', required: false, enum: ['pause_substrategy', 'switch_substrategy'] },
        subStrategyScopeRef: { kind: 'symbol', required: false },
        toSubStrategyScopeRef: { kind: 'symbol', required: false },
      },
      phaseResolver: 'fixed-gate',
      sideResolver: 'inherit',
    },
  },

  // =========================================================
  // Issue #1395：新增 4 个 atom（其中 volume.threshold 直接扩 paramSlots，
  //   见 L579+；本段仅注册 3 个新 atom）。
  //
  //   readinessCheck=UNSUPPORTED_SKIP：IR emit / 真实编译路径尚未兑现，
  //   atom 仅落地 registry 元数据让 NL gateway / atom-roles invariant 通过；
  //   下游 codegen 走 unsupported fallback。
  // =========================================================

  'condition.sequence': {
    corpus: {
      aliases: ['条件序列', '连续 N 根', '然后', '先...再', 'consecutive', 'sequence'],
      positiveExamples: [
        'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点',
        '突破前高后回踩不破突破位再买',
        'RSI 跌破 35 后重新上穿 35 买入',
      ],
      negativeExamples: ['单根 K 线突破', '价格在 MA 上方'],
      goldenUtterances: [],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: UNSUPPORTED_SKIP,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'condition.sequence.sequenceKind') return '请明确序列类型：consecutive_body（连续阴/阳线）、pattern_then_volume_spike（形态 + 放量）或 breakout_then_retest（突破回踩）。'
      if (slotKey === 'condition.sequence.count') return '请给出连续根数，例如 3。'
      if (slotKey === 'condition.sequence.direction') return '请给出方向：up 或 down。'
      return '请补充条件序列的缺失信息（sequenceKind / count / direction / lookbackBars）。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: {
      supportStatus: 'supported_executable',
      executableSinceVersion: '2026.05.W02',
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['condition.sequence'],
      paramRenderers: {
        count: (v) => `${v} 根`,
        direction: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['condition.sequence'].en
        const count = typeof params.count === 'number' ? `连续 ${params.count} 根` : '条件序列'
        const dir = params.direction === 'down' ? '阴线' : params.direction === 'up' ? '阳线' : ''
        const nb = params.nextBarOnly === 'true' ? '（下一根触发）' : ''
        return `${count}${dir}${nb}`
      },
    },
    surface: {
      intent: {
        keywords: ['连续', '先', '再', '然后', '下一根', 'sequence', 'consecutive', 'then', 'after', '序列'] as const,
        verbs: {
          fixed: ['出现', '满足', '触发'] as const,
        },
      },
      paramSlots: {
        sequenceKind: { kind: 'enum', required: true, enum: ['consecutive_body', 'pattern_then_volume_spike', 'breakout_then_retest'] },
        count: { kind: 'number', required: false, range: [1, 100], extractor: { kind: 'number-decimal', pattern: '连续\\s*(\\d+)\\s*根', range: [1, 100] } },
        direction: { kind: 'enum', required: false, enum: ['up', 'down'] },
        lookbackBars: { kind: 'number', required: false, range: [1, 500] },
        withinBars: { kind: 'number', required: false, range: [1, 500] },
        // nextBarOnly 用 enum 'true' / 'false' 兜底（ParamSlotSchema 不支持 boolean kind）
        nextBarOnly: { kind: 'enum', required: false, enum: ['true', 'false'] },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [
          {
            keywords: ['连续 N 根', 'consecutive', 'streak', '连阳', '连阴'],
            mustOutput: 'condition.sequence + sequenceKind="consecutive_body" + count=N + direction="up"|"down"；不要写成 ≥15 根；count 必须复述用户给出的精确值。',
          },
          {
            keywords: ['下一根', '下一根 K 线', 'next bar'],
            mustOutput: 'sequence 节点 + nextBarOnly="true"；表示「下一步必须发生在前一步之后的下一根 K 线」。dispatcher 不抽 nextBarOnly，planner 必须主动补。',
          },
          {
            keywords: ['跌破 X 后重新上穿 X', '回到 X 上方', '先跌破 X 再向上穿越 X'],
            mustOutput: 'condition = sequence([ <X 跌破/低于 atom>, <X 上穿 atom> ])。例：RSI 跌破 35 后重新上穿 35 → sequence([oscillator.rsi_lte(value=35), indicator.cross_over(indicator=rsi, value=35)])。禁止拆成两条独立 entry rule，会丢失「先低再上穿」的时序。',
          },
        ],
      },
    },
  },

  'price.previous_extrema_retest': {
    corpus: {
      aliases: ['回踩', '回测', '不破', '回踩不破', 'retest', 'pullback'],
      positiveExamples: [
        '突破 24 小时高点后回踩不破突破位再买',
        '突破前高后回测确认再入场',
      ],
      negativeExamples: ['直接突破买入', '盘整'],
      goldenUtterances: [],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: UNSUPPORTED_SKIP,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'price.previous_extrema_retest.retestKind') return '请明确回踩类型：not_break（不破突破位）或 break_through（跌穿突破位）。'
      if (slotKey === 'price.previous_extrema_retest.memoryKey') return '请提供突破位记忆键（auto 自动生成）。'
      return '请补充突破后回踩的缺失信息（retestKind / tolerancePct / maxBars）。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: {
      supportStatus: 'supported_executable',
      executableSinceVersion: '2026.05.W02',
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['price.previous_extrema_retest'],
      paramRenderers: {
        retestKind: (v) => v === 'not_break' ? '不破' : '跌穿',
        tolerancePct: (v) => `${v}%`,
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['price.previous_extrema_retest'].en
        return params.retestKind === 'not_break' ? '回踩不破突破位' : '回踩跌穿突破位'
      },
    },
    surface: {
      intent: {
        keywords: ['回踩', '回测', '不破', '突破后', 'retest', 'pullback'] as const,
        verbs: {
          fixed: ['回踩', '回测', '触及'] as const,
        },
      },
      paramSlots: {
        // memoryKey 用 symbol kind 兜底（ParamSlotSchema 不支持 string）
        memoryKey: { kind: 'symbol', required: false, default: 'auto' },
        retestKind: { kind: 'enum', required: true, enum: ['not_break', 'break_through'] },
        tolerancePct: { kind: 'percent', required: false, range: [0, 10], default: 0.1 },
        maxBars: { kind: 'number', required: false, range: [1, 100], default: 6 },
      },
      phaseResolver: 'by-clause-verb',
      sideResolver: 'inherit',
    },
  },

  'risk.atr_take_profit': {
    corpus: {
      aliases: ['ATR 止盈', '波动止盈', 'ATR 动态止盈'],
      positiveExamples: [
        '盈利达到 3 倍 ATR 后止盈',
        '用 3 倍 ATR 作为动态止盈',
      ],
      negativeExamples: ['固定 5% 止盈', 'ATR 大于 50 才平仓'],
      goldenUtterances: [],
    },
    summaryContribution: VIA_PRESENTATION_DISPLAY,
    readinessCheck: UNSUPPORTED_SKIP,
    clarificationQuestion: (slotKey, _params, _locale) => {
      if (slotKey === 'risk.atr_take_profit.period') return '请指定 ATR 计算周期，例如 14（常用默认值）。'
      if (slotKey === 'risk.atr_take_profit.multiple') return '请给出 ATR 倍数，例如 3（即 3 倍 ATR 作为止盈距离）。'
      return '请补充 ATR 动态止盈的缺失信息（period / multiple）。'
    },
    mutex: [],
    isActionable: false,
    sizingEvidence: null,
    classifier: {
      supportStatus: 'supported_executable',
      executableSinceVersion: '2026.05.W02',
    },
    display: {
      publicName: ATOM_PUBLIC_NAMES['risk.atr_take_profit'],
      paramRenderers: {
        multiple: (v) => String(v),
      },
      summaryTemplate: (params, locale) => {
        if (locale === 'en') return ATOM_PUBLIC_NAMES['risk.atr_take_profit'].en
        if (typeof params.multiple === 'number') return `${params.multiple} 倍 ATR 止盈`
        return 'ATR 动态止盈'
      },
    },
    surface: {
      intent: {
        keywords: ['ATR 止盈', 'ATR', '动态止盈', '波动止盈', 'atr take profit', '盈利', '倍 ATR 止盈'] as const,
        verbs: {
          fixed: ['止盈', '作为止盈', '动态止盈', 'atr take profit'] as const,
        },
      },
      paramSlots: {
        // #1497: ATR period 收紧 [1, 100] + multipleOf:1；multiple 收紧 [0.1, 20] + multipleOf:0.1
        period: { kind: 'number', required: false, range: [1, 100], multipleOf: 1, default: 14 },
        multiple: { kind: 'number', required: true, range: [0.1, 20], multipleOf: 0.1, extractor: { kind: 'number-decimal', pattern: '(\\d+(?:\\.\\d+)?)\\s*(?:倍|x)\\s*ATR.*?(?:止盈|take\\s*profit)', range: [0.1, 20] } },
      },
      phaseResolver: 'fixed-exit',
      sideResolver: 'inherit',
      phraseHints: {
        triggers: [{
          keywords: ['X 倍 ATR 止盈', '盈利达到 X 倍 ATR', 'take profit at X*ATR'],
          mustOutput: 'risk.atr_take_profit + multiple=X；禁止与 risk.atr_stop 共用同一 atom，也不要回退到 risk.partial_take_profit。',
        }],
      },
    },
  },
})

// TS exhaustive 编译期守门验证（无运行时开销）
// 若 ATOM_CONTRACT_REGISTRY 缺少任一 SupportedAtomKey → TS error
type _ExhaustiveCheck = typeof ATOM_CONTRACT_REGISTRY extends Record<SupportedAtomKey, AtomContract>
  ? true
  : never
const _exhaustiveCheckPass: _ExhaustiveCheck = true
void _exhaustiveCheckPass
