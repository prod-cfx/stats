import type { SupportedAtomKey } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import type { FirstWaveTriggerAtom } from '../constants/canonical-strategy-capabilities'
import type {
  AtomContractDisplay,
  AtomContractEmit,
  AtomContractKey,
  AtomContractSurface,
} from './atom-contract-types'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
import { CONDITION_ATOM_EMITS } from './atom-contract-condition-emits'
import { RISK_GUARD_ATOM_EMITS } from './atom-contract-risk-guard-emits'
import { LIFECYCLE_ATOM_EMITS } from './atom-contract-lifecycle-emits'
import { RULE_BLOCK_ATOM_EMITS } from './atom-contract-rule-block-emits'
import { ORCHESTRATION_ATOM_EMITS } from './atom-contract-orchestration-emits'
import { ACTION_ATOM_EMITS } from './atom-contract-action-emits'
import { ATOM_CONTRACT_REGISTRY, type NotApplicableIrShapeBuilder } from './atom-contract-registry'

// =========================================================
// #1329 PR3c Round 1 C2：corpus 4 字段空值 invariant 守门
// =========================================================
// 单一真相源契约：所有 atom 的 corpus 4 字段（aliases / positiveExamples /
// negativeExamples / goldenUtterances）不允许同时为空，除非该 atom 显式纳入
// STUB_CORPUS_WHITELIST。后者用于 inline summaryContribution 覆盖渲染、不依赖
// corpus 字段的 atom（如 portfolioRisk.drawdown_block 有 inline 渲染函数）。
//
// 配合 #1329b follow-up：6 个高频 actionable atom（action.{open,close}_{long,short} +
// indicator.{above,below}）已在 C2 内补真实 corpus；剩余 1 个 stub atom
// (portfolioRisk.drawdown_block) 显式 whitelist 标记，避免裸 stub 漂移。
export const STUB_CORPUS_WHITELIST: ReadonlySet<AtomContractKey> = new Set<AtomContractKey>([
  // portfolioRisk.drawdown_block 有 inline summaryContribution + clarificationQuestion
  // 函数自带语料表达，corpus 4 字段允许空（仍可派生于 utterance-corpus / dispatcher
  // 间接覆盖）。见 #1329b follow-up。
  'portfolioRisk.drawdown_block',
])

/**
 * #1329 C2：corpus invariant runtime 守门。
 *
 * 任一 atom 的 corpus 4 字段（aliases / positiveExamples / negativeExamples /
 * goldenUtterances）全部为空，且不在 STUB_CORPUS_WHITELIST 内，即抛错。
 *
 * 由 atom-contracts 模块在加载时自动调用一次（见模块底部 IIFE）。
 * 单测 / E2E 启动时若 registry 状态违反契约，立即 fail-loud；防止生产代码
 * 进入"corpus 空、依赖 PRESENTATIONS 遗留派生"的隐式静默状态。
 */
export function checkCorpusInvariants(
  registry: typeof ATOM_CONTRACT_REGISTRY = ATOM_CONTRACT_REGISTRY,
): void {
  const violations: AtomContractKey[] = []
  for (const key of Object.keys(registry) as AtomContractKey[]) {
    const corpus = registry[key].corpus
    const empty =
      corpus.aliases.length === 0
      && corpus.positiveExamples.length === 0
      && corpus.negativeExamples.length === 0
      && corpus.goldenUtterances.length === 0
    if (empty && !STUB_CORPUS_WHITELIST.has(key)) {
      violations.push(key)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `[corpus invariant] atoms with 4-field empty corpus but not in STUB_CORPUS_WHITELIST: `
      + `${violations.join(', ')}. Either add real corpus data or whitelist explicitly.`,
    )
  }
}

// 模块加载即执行：违反契约即 fail-loud，单测 / E2E / 生产 boot 都会立即报错。
checkCorpusInvariants(ATOM_CONTRACT_REGISTRY)

type Registry = typeof ATOM_CONTRACT_REGISTRY
type RegistryKey = keyof Registry
type AssertTrue<T extends true> = T

type MissingSurfaceKeys = {
  [K in RegistryKey]: Registry[K] extends { readonly surface: AtomContractSurface } ? never : K
}[RegistryKey]

type MissingDisplayKeys = {
  [K in RegistryKey]: Registry[K] extends { readonly display: AtomContractDisplay } ? never : K
}[RegistryKey]

type MissingEmitKeys = {
  [K in RegistryKey]: Registry[K] extends { readonly emit: AtomContractEmit } ? never : K
}[RegistryKey]

type MutexPeers<K extends RegistryKey> = Registry[K] extends { readonly mutex: readonly (infer Peer)[] }
  ? Extract<Peer, RegistryKey>
  : never

type MutexNotBidirectionalKeys = {
  [K in RegistryKey]:
    MutexPeers<K> extends infer Peer
      ? Peer extends RegistryKey
        ? K extends MutexPeers<Peer> ? never : K
        : never
      : never
}[RegistryKey]

type FirstWaveCoverageMissingKeys = Exclude<FirstWaveTriggerAtom, RegistryKey>
type FirstWaveNonTriggerKeys = never

type MissingCapabilityKeys = {
  [K in RegistryKey]:
    Registry[K]['emit']['capability'] extends {
      readonly domain: string
      readonly verb: string
      readonly object: string
    }
      ? never
      : K
}[RegistryKey]

// Issue #1279 PR3a Phase 2：condition predicate 类 atom（trigger 与 grid.range_rebalance）
// 兑现 `emit.irShape` 为真实实现（capabilityStatus = 'pr3a-condition'）；
// 见下方 `_ConditionIrShapeAllReal` 守门。
// Issue #1279 PR3e：non-condition bucket atom（action / risk / orchestration / 非
// grid 的 positionConstraint）走 rule-level / spec-level IR 编译路径，**不参与**
// `compileAtom` 的 emit.irShape 调度；其 capabilityStatus 显式声明为
// 'irshape-not-applicable'，与「未兑现 stub」语义严格分离。
// 见下方 `_NonConditionIrShapeNotApplicable` 守门。
type ConditionAtomKey =
  | 'execution.on_start'
  | 'indicator.above'
  | 'indicator.below'
  | 'price.range_position_lte'
  | 'price.range_position_gte'
  | 'price.percent_change'
  | 'oscillator.rsi_lte'
  | 'oscillator.rsi_gte'
  | 'bollinger.touch_upper'
  | 'bollinger.touch_lower'
  | 'bollinger.touch_middle'
  | 'trend.direction'
  | 'market.regime'
  | 'volatility.state'
  | 'indicator.divergence'
  | 'price.candle_pattern'
  | 'price.chart_pattern'
  | 'liquidity.sweep'
  | 'grid.range_rebalance'
  | 'indicator.cross_over'
  | 'indicator.cross_under'
  | 'price.breakout_up'
  | 'price.breakout_down'

// Issue #1313 PR2 / PR3 / PR4 / PR5c 反转：以下 atom 都已迁出 `'irshape-not-applicable'` 领域，
//   分别通过专用 emit shape 在 ir-compiler 对应 dispatcher 调度：
//   - `position.has_position` / `position.no_position` (PR2) → `emit.riskGuardShape`
//     ↔ `tryCompileRiskGuard`（capabilityStatus = 'pr3e-risk-guard'）
//   - `risk.partial_take_profit` (PR3) → `emit.ruleBlockShape`
//     ↔ `tryCompileReduceActionRule`（capabilityStatus = 'pr3e-rule-block'）
//   - `portfolioRisk.drawdown_block` (PR3) → `emit.orchestrationPortfolioRiskShape`
//     ↔ `compileOrchestrationPortfolioRisks`（capabilityStatus = 'pr3e-orchestration-portfolio'）
//   - `position.pyramiding_limit` (PR4) → `emit.lifecyclePyramidingShape`
//     ↔ `resolveLifecyclePyramiding`（capabilityStatus = 'pr3e-lifecycle'）
//   - 6 个 action atom (`action.open_long` / `action.close_long` /
//     `action.open_short` / `action.close_short` / `action.add_position` /
//     `action.reverse_position`) (PR5c) → `emit.actionShape`
//     ↔ `compileActions` REGISTRY 调度（capabilityStatus = 'pr3e-action'）
//   五组 atom 从 NonConditionRegistryKey 同时排除，让 `_NonConditionIrShapeNotApplicable` /
//   `_NonConditionCapabilityNotApplicable` 不再约束其 irShape brand 与 capabilityStatus；
//   正向守门由 `_RiskGuardEmitAllReal` / `_RuleBlockEmitAllReal` /
//   `_OrchestrationPortfolioRiskEmitAllReal` / `_LifecyclePyramidingEmitAllReal`
//   接管；`_ActionEmitAllReal` AssertTrue 在 PR5c 仅声明 report 字段、暂不导出，
//   PR5d 启用（与 PR5b 注释里的 PR5d 计划一致）。
type NonConditionRegistryKey = Exclude<
  RegistryKey,
  | ConditionAtomKey
  | RiskGuardAtomKey
  | RuleBlockAtomKey
  | OrchestrationPortfolioRiskAtomKey
  | LifecyclePyramidingAtomKey
  | ActionAtomKey
>

// Issue #1279 PR3e：non-condition bucket atom（action / risk / orchestration / 非
// grid 的 positionConstraint）走 rule-level / spec-level IR 编译路径，不参与
// `compileAtom` 的 `emit.irShape` 调度。invariant 显式守门：所有
// NonConditionRegistryKey 必须 `capabilityStatus === 'irshape-not-applicable'` 且
// `emit.irShape` 携带 `__notApplicable: true` brand。
// 「未兑现 stub」语义保留为 `'pr1b-stub'`（PR3e 后不再被默认构造，仅留作未来
// 潜在 condition atom 迁移的临时占位），违规即触发 invariant 编译挂。
type WrongStatusNonConditionKeys = {
  [K in NonConditionRegistryKey]: Registry[K]['emit']['capabilityStatus'] extends 'irshape-not-applicable' ? never : K
}[NonConditionRegistryKey]

type WrongBrandNonConditionKeys = {
  [K in NonConditionRegistryKey]: Registry[K]['emit']['irShape'] extends NotApplicableIrShapeBuilder ? never : K
}[NonConditionRegistryKey]

// Issue #1279 PR3a Phase 2-3：condition atom 全量兑现守门。
// 直接从 `CONDITION_ATOM_EMITS` 字面量类型推导：任一 ConditionAtomKey 在
// CONDITION_ATOM_EMITS 中缺失，或其 `capabilityStatus` 不是 'pr3a-condition'
// → 在 StubConditionIrShapeKeys 中暴露 → `_ConditionIrShapeAllReal` AssertTrue 编译挂。
// 这是反转后的正向 invariant（Phase 1 仅有 `_*AllStub` 的逆否检查）。
type ConditionEmits = typeof CONDITION_ATOM_EMITS

type StubConditionIrShapeKeys = {
  [K in ConditionAtomKey]: K extends keyof ConditionEmits
    ? ConditionEmits[K] extends { readonly capabilityStatus: 'pr3a-condition' } ? never : K
    : K
}[ConditionAtomKey]

// =========================================================
// Issue #1313 PR1 + PR5a：rule-level / spec-level atom emit shape invariant 骨架
// =========================================================
// 5 类 non-condition bucket atom 按 emit shape 分组，每组对应一个 capabilityStatus
// 字面量与一个 `emit.*Shape` 字段：
//   - RiskGuardAtomKey            ↔ 'pr3e-risk-guard'            ↔ `emit.riskGuardShape`
//   - RuleBlockAtomKey            ↔ 'pr3e-rule-block'            ↔ `emit.ruleBlockShape`
//   - OrchestrationPortfolioRiskAtomKey ↔ 'pr3e-orchestration-portfolio' ↔ `emit.orchestrationPortfolioRiskShape`
//   - LifecyclePyramidingAtomKey  ↔ 'pr3e-lifecycle'             ↔ `emit.lifecyclePyramidingShape`
//   - ActionAtomKey               ↔ 'pr3e-action'                ↔ `emit.actionShape`  (PR5a 新增)
//
// 本 PR 仅声明类型与派生 `Stub*Keys` 集合，**不**导出 AssertTrue 守门：
//   - 当前所有此 5 类 atom 仍处于 `'irshape-not-applicable'` 状态，
//     `_NonConditionIrShapeNotApplicable` 守门继续生效（NonConditionRegistryKey 保持原状）；
//   - 后续 atom 迁移 PR（PR2..PRN / PR5c / PR5d）按分组反转 invariant：
//       * 从 `NonConditionRegistryKey` 集合移出该组 atom；
//       * 导出对应 `_RiskGuardEmitAllReal` / `_RuleBlockEmitAllReal` /
//         `_OrchestrationEmitAllReal` / `_LifecyclePyramidingEmitAllReal` /
//         `_ActionEmitAllReal` AssertTrue 锁死；
//       * 配合 atom emit shape 实际迁移 + `capabilityStatus` 字面量。
//
// 注：`position.dca_schedule` 不属于此 5 组（IR 编译阶段无独立产出，影响透过
//   `position.constraints[]` 由 sizing resolver 派生），继续保持
//   `'irshape-not-applicable'` 状态，不引入第 6 类 shape。

type RiskGuardAtomKey = 'position.has_position' | 'position.no_position'

type RuleBlockAtomKey = 'risk.partial_take_profit'

type OrchestrationPortfolioRiskAtomKey = 'portfolioRisk.drawdown_block'

type LifecyclePyramidingAtomKey = 'position.pyramiding_limit'

// Issue #1313 PR5a：action atom IR emit shape 接口骨架（5 类中第 5 类）。
// 与上方 4 组 *AtomKey 同形：与 'pr3e-action' capabilityStatus 字面量 + `emit.actionShape`
// 字段配对；当前 6 个 action atom 仍处 `'irshape-not-applicable'` 状态，仍在
// `NonConditionRegistryKey` 守门集合内。
// 后续 PR5b / PR5c / PR5d 接力：
//   - PR5b：`CanonicalRuleAction.atomKey?: string` 字段 + builder
//     `buildActionsForSemanticActionKey` / `buildActionsForSemanticLifecycleAction` 翻译点透传；
//   - PR5c：6 atom emit.actionShape 真实兑现 + IR compiler `compileActions` REGISTRY 调度优先 +
//     enum 兜底（保留 REDUCE_LONG / REDUCE_SHORT / FORCE_EXIT / BLOCK_NEW_ENTRY 4 case 走
//     `action.reduce_position` / `risk.partial_take_profit` / `portfolioRisk.drawdown_block` 等
//     非本 6 atom 集合的 atom 各自的 shape）；
//   - PR5d：从 `NonConditionRegistryKey` 移出 6 atom + 启用 `_ActionEmitAllReal` AssertTrue。
type ActionAtomKey =
  | 'action.open_long'
  | 'action.close_long'
  | 'action.open_short'
  | 'action.close_short'
  | 'action.add_position'
  | 'action.reverse_position'

// PR1 派生集合：`capabilityStatus !== 'pr3e-*'` 的 atom（即尚未迁移到对应 emit shape 的 atom）。
// 本 PR 内 5 组集合各自等于完整 *AtomKey 联合，再随 atom 迁移逐组反转。
// 后续 atom 迁移 PR 兑现某 atom 后，对应 `Stub*Keys` 类型自动收窄；当某组 `Stub*Keys`
// 收窄为 `never` 时，启用对应 `_*EmitAllReal` AssertTrue 守门。
// Issue #1313 PR2 / PR3：与 `StubConditionIrShapeKeys` 同模式 —— 直接从
//   `RISK_GUARD_ATOM_EMITS` / `RULE_BLOCK_ATOM_EMITS` / `ORCHESTRATION_ATOM_EMITS`
//   字面量类型派生（registry merge 走运行时，`ATOM_CONTRACT_REGISTRY[K]['emit']`
//   静态类型推断仍是 `NotApplicableEmit` fallback，无法收窄到 'pr3e-*'）。
//   任一对应 atom 在 *_ATOM_EMITS 中缺失，或其 `capabilityStatus` 不是对应字面量
//   → 在 `Stub*Keys` 中暴露 → `_*EmitAllReal` AssertTrue 编译挂。
type RiskGuardEmits = typeof RISK_GUARD_ATOM_EMITS
type RuleBlockEmits = typeof RULE_BLOCK_ATOM_EMITS
type OrchestrationEmits = typeof ORCHESTRATION_ATOM_EMITS

type StubRiskGuardKeys = {
  [K in RiskGuardAtomKey]: K extends keyof RiskGuardEmits
    ? RiskGuardEmits[K] extends { readonly capabilityStatus: 'pr3e-risk-guard' } ? never : K
    : K
}[RiskGuardAtomKey]

type StubRuleBlockKeys = {
  [K in RuleBlockAtomKey]: K extends keyof RuleBlockEmits
    ? RuleBlockEmits[K] extends { readonly capabilityStatus: 'pr3e-rule-block' } ? never : K
    : K
}[RuleBlockAtomKey]

type StubOrchestrationPortfolioRiskKeys = {
  [K in OrchestrationPortfolioRiskAtomKey]: K extends keyof OrchestrationEmits
    ? OrchestrationEmits[K] extends { readonly capabilityStatus: 'pr3e-orchestration-portfolio' } ? never : K
    : K
}[OrchestrationPortfolioRiskAtomKey]

// 直接从 `LIFECYCLE_ATOM_EMITS` 字面量类型推导（mirror condition 守门思路）：
//   `Registry[K]['emit']` 经 `completePr1bRegistry` 的 `mergedEmit: AtomContractEmit` 显式
//   cast 后丢失 override 字面量；查源头 LIFECYCLE_ATOM_EMITS 才能看到真实的
//   `'pr3e-lifecycle'` + `lifecyclePyramidingShape` 字段类型。
type LifecycleEmits = typeof LIFECYCLE_ATOM_EMITS

type StubLifecyclePyramidingKeys = {
  [K in LifecyclePyramidingAtomKey]: K extends keyof LifecycleEmits
    ? LifecycleEmits[K] extends { readonly capabilityStatus: 'pr3e-lifecycle' } ? never : K
    : K
}[LifecyclePyramidingAtomKey]

// Issue #1313 PR5a + PR5c：同形派生 `StubActionKeys` —— 任一 ActionAtomKey 的
// `capabilityStatus` 不是 'pr3e-action' → 暴露在 StubActionKeys 中。
// PR5c 兑现后 6 个 action atom 全部 `capabilityStatus === 'pr3e-action'`，类型收窄到
// `never`。与 LIFECYCLE_ATOM_EMITS 守门同模式：直接从源头 ACTION_ATOM_EMITS 字面量
// 类型派生（registry merge 走运行时，`Registry[K]['emit']` 静态类型推断仍是 fallback，
// 无法收窄到 'pr3e-action'）。PR5d 翻转：导出 `_ActionEmitAllReal` AssertTrue 锁死
// `StubActionKeys | MissingActionShapeKeys` 收窄至 never；与
// `_LifecyclePyramidingEmitAllReal` 同模式（PR4 已落地）。
type ActionEmits = typeof ACTION_ATOM_EMITS

type StubActionKeys = {
  [K in ActionAtomKey]: K extends keyof ActionEmits
    ? ActionEmits[K] extends { readonly capabilityStatus: 'pr3e-action' } ? never : K
    : K
}[ActionAtomKey]

// PR4 同形：额外要求迁移到 'pr3e-action' 的 atom 必须挂载真实 `emit.actionShape`
// 函数。combined 与 `StubActionKeys` 共同收敛为 `never` 才放行；防止"只改
// `capabilityStatus` 字面量、未挂 shape"漂移。
type MissingActionShapeKeys = {
  [K in ActionAtomKey]: K extends keyof ActionEmits
    ? ActionEmits[K] extends { readonly actionShape: (...args: never[]) => unknown } ? never : K
    : K
}[ActionAtomKey]

// Issue #1313 PR4 反转：额外要求迁移到 'pr3e-lifecycle' 的 atom 必须挂载
// 真实 `emit.lifecyclePyramidingShape` 函数。combined 与 `StubLifecyclePyramidingKeys`
// 共同收敛为 `never` 才放行；防止"只改 capabilityStatus 字面量、未挂 shape"漂移。
type MissingLifecyclePyramidingShapeKeys = {
  [K in LifecyclePyramidingAtomKey]: K extends keyof LifecycleEmits
    ? LifecycleEmits[K] extends { readonly lifecyclePyramidingShape: (...args: never[]) => unknown } ? never : K
    : K
}[LifecyclePyramidingAtomKey]

// 编译期 self-test：确保 5 组 *AtomKey 与 ConditionAtomKey 不相交、且属于 RegistryKey
// （即未误把 condition atom 拉入 rule-level / spec-level emit 集合）。
// Issue #1313 PR2 / PR3 / PR4 / PR5a：`NonConditionRegistryKey` 已陆续移出 RiskGuard /
// RuleBlock / OrchestrationPortfolioRisk / LifecyclePyramiding atom，自检改用
// 「与 ConditionAtomKey 不相交 ∧ 属于 RegistryKey」的不变形态（PR2 引入）；PR5a
// 第 5 组 ActionAtomKey 沿用此不变形态,避免依赖 NonConditionRegistryKey 在 PR5d
// 反转时再修一次。
type _RiskGuardAtomsAreNonCondition = AssertTrue<
  [Extract<RiskGuardAtomKey, ConditionAtomKey>] extends [never]
    ? RiskGuardAtomKey extends RegistryKey ? true : false
    : false
>
type _RuleBlockAtomsAreNonCondition = AssertTrue<
  [Extract<RuleBlockAtomKey, ConditionAtomKey>] extends [never]
    ? RuleBlockAtomKey extends RegistryKey ? true : false
    : false
>
type _OrchestrationPortfolioRiskAtomsAreNonCondition = AssertTrue<
  [Extract<OrchestrationPortfolioRiskAtomKey, ConditionAtomKey>] extends [never]
    ? OrchestrationPortfolioRiskAtomKey extends RegistryKey ? true : false
    : false
>
type _LifecyclePyramidingAtomsAreNonCondition = AssertTrue<
  [Extract<LifecyclePyramidingAtomKey, ConditionAtomKey>] extends [never]
    ? LifecyclePyramidingAtomKey extends RegistryKey ? true : false
    : false
>
type _ActionAtomsAreNonCondition = AssertTrue<
  [Extract<ActionAtomKey, ConditionAtomKey>] extends [never]
    ? ActionAtomKey extends RegistryKey ? true : false
    : false
>

// 防 "已声明但完全未引用" tsc / eslint 警告：聚合为 unused-type 链。
// `StubLifecyclePyramidingKeys` / `MissingLifecyclePyramidingShapeKeys` /
// `StubActionKeys` / `MissingActionShapeKeys` 已在
// `_LifecyclePyramidingEmitAllReal` / `actionEmitAllReal` 中被实际消费，无需再列入
// aggregate。
type _Pr1ShapeAtomKeysAggregate =
  | StubRiskGuardKeys
  | StubRuleBlockKeys
  | StubOrchestrationPortfolioRiskKeys

export type _Pr1ShapeAtomKeysSkeleton =
  | _RiskGuardAtomsAreNonCondition
  | _RuleBlockAtomsAreNonCondition
  | _OrchestrationPortfolioRiskAtomsAreNonCondition
  | _LifecyclePyramidingAtomsAreNonCondition
  | _ActionAtomsAreNonCondition
  | _Pr1ShapeAtomKeysAggregate

export type AtomContractInvariantReport = {
  readonly exhaustive: SupportedAtomKey extends RegistryKey ? true : false
  readonly reverse: RegistryKey extends SupportedAtomKey ? true : false
  readonly surfaceComplete: [MissingSurfaceKeys] extends [never] ? true : false
  readonly displayComplete: [MissingDisplayKeys] extends [never] ? true : false
  readonly emitComplete: [MissingEmitKeys] extends [never] ? true : false
  readonly mutexBidirectional: [MutexNotBidirectionalKeys] extends [never] ? true : false
  readonly firstWaveCovered: [FirstWaveCoverageMissingKeys | FirstWaveNonTriggerKeys] extends [never] ? true : false
  readonly capabilityCovered: [MissingCapabilityKeys] extends [never] ? true : false
  readonly nonConditionIrShapeNotApplicable: [WrongBrandNonConditionKeys] extends [never] ? true : false
  readonly nonConditionCapabilityNotApplicable: [WrongStatusNonConditionKeys] extends [never] ? true : false
  readonly conditionIrShapeAllReal: [StubConditionIrShapeKeys] extends [never] ? true : false
  // Issue #1313 PR2：rule-level RiskGuard 类 atom（`position.has_position` /
  //   `position.no_position`）必须全部 `capabilityStatus === 'pr3e-risk-guard'`。
  readonly riskGuardEmitAllReal: [StubRiskGuardKeys] extends [never] ? true : false
  // Issue #1313 PR4 反转：lifecycle pyramiding emit 全量真实兑现 +
  //   `emit.lifecyclePyramidingShape` 字段实际挂载（双重收窄至 never）。
  readonly lifecyclePyramidingEmitAllReal: [
    StubLifecyclePyramidingKeys | MissingLifecyclePyramidingShapeKeys,
  ] extends [never] ? true : false
  // Issue #1313 PR3：rule-block / spec-level orchestration emit shape 兑现的正向 invariant。
  //   `risk.partial_take_profit` 必须 `capabilityStatus === 'pr3e-rule-block'` 且
  //   `portfolioRisk.drawdown_block` 必须 `capabilityStatus === 'pr3e-orchestration-portfolio'`。
  //   任一 atom 字面量回退或 emit shape override 文件被误删 → 对应 Stub 集合非空 →
  //   AssertTrue 编译挂。
  readonly ruleBlockEmitAllReal: [StubRuleBlockKeys] extends [never] ? true : false
  readonly orchestrationPortfolioRiskEmitAllReal: [StubOrchestrationPortfolioRiskKeys] extends [never] ? true : false
  // Issue #1313 PR5c/PR5d：6 个 action atom 全部 `capabilityStatus === 'pr3e-action'` +
  //   `emit.actionShape` 实际挂载（双重收窄至 never）。PR5c 仅声明字段；PR5d
  //   导出 `_ActionEmitAllReal` AssertTrue 锁死，任一 atom 字面量回退或 shape
  //   override 文件被误删即触发编译挂。
  readonly actionEmitAllReal: [
    StubActionKeys | MissingActionShapeKeys,
  ] extends [never] ? true : false
}

export type _AtomContractExhaustive = AssertTrue<AtomContractInvariantReport['exhaustive']>
export type _AtomContractReverseExhaustive = AssertTrue<AtomContractInvariantReport['reverse']>
export type _AtomContractSurfaceComplete = AssertTrue<AtomContractInvariantReport['surfaceComplete']>
export type _AtomContractDisplayComplete = AssertTrue<AtomContractInvariantReport['displayComplete']>
export type _AtomContractEmitComplete = AssertTrue<AtomContractInvariantReport['emitComplete']>
export type _AtomContractMutexBidirectional = AssertTrue<AtomContractInvariantReport['mutexBidirectional']>
export type _FirstWaveTriggerAtomsCovered = AssertTrue<AtomContractInvariantReport['firstWaveCovered']>
export type _AtomContractCapabilityCovered = AssertTrue<AtomContractInvariantReport['capabilityCovered']>
export type _NonConditionIrShapeNotApplicable = AssertTrue<AtomContractInvariantReport['nonConditionIrShapeNotApplicable']>
export type _NonConditionCapabilityNotApplicable = AssertTrue<AtomContractInvariantReport['nonConditionCapabilityNotApplicable']>
export type _ConditionIrShapeAllReal = AssertTrue<AtomContractInvariantReport['conditionIrShapeAllReal']>
export type _RiskGuardEmitAllReal = AssertTrue<AtomContractInvariantReport['riskGuardEmitAllReal']>
export type _LifecyclePyramidingEmitAllReal = AssertTrue<AtomContractInvariantReport['lifecyclePyramidingEmitAllReal']>
// Issue #1313 PR3：positive existence invariant —— rule-block / orchestration
//   两个 atom 的 capabilityStatus 字面量必须严格匹配对应 'pr3e-*' 字面量。
export type _RuleBlockEmitAllReal = AssertTrue<AtomContractInvariantReport['ruleBlockEmitAllReal']>
export type _OrchestrationPortfolioRiskEmitAllReal = AssertTrue<AtomContractInvariantReport['orchestrationPortfolioRiskEmitAllReal']>
// Issue #1313 PR5d 翻转：6 个 action atom 全部 `capabilityStatus === 'pr3e-action'`
//   且 `emit.actionShape` 实际挂载（双重收窄）。任一漂移 → AssertTrue 编译挂。
export type _ActionEmitAllReal = AssertTrue<AtomContractInvariantReport['actionEmitAllReal']>
