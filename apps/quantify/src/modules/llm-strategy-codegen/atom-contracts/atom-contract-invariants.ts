import type { SupportedExecutableUtteranceAtom } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import type { FirstWaveTriggerAtom } from '../constants/canonical-strategy-capabilities'
import type {
  AtomContractDisplay,
  AtomContractEmit,
  AtomContractSurface,
} from './atom-contract-types'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
import { CONDITION_ATOM_EMITS } from './atom-contract-condition-emits'
import { ATOM_CONTRACT_REGISTRY, type Pr1bStubIrShapeBuilder } from './atom-contract-registry'

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
// 在本 PR 内逐个兑现 `emit.irShape` 为真实实现，因此被显式从 stub 守门集合排除；
// 仍保留 stub 的 action / risk / positionConstraint(除 grid) / orchestration 类 atom
// 走 `NonConditionRegistryKey` 检查，保证 PR3d/PR3e 之前不被绕过。
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

type NonConditionRegistryKey = Exclude<RegistryKey, ConditionAtomKey>

type NonStubIrShapeKeys = {
  [K in NonConditionRegistryKey]: Registry[K]['emit']['irShape'] extends Pr1bStubIrShapeBuilder ? never : K
}[NonConditionRegistryKey]

type NonStubCapabilityKeys = {
  [K in NonConditionRegistryKey]: Registry[K]['emit']['capabilityStatus'] extends 'pr1b-stub' ? never : K
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

export type AtomContractInvariantReport = {
  readonly exhaustive: SupportedExecutableUtteranceAtom extends RegistryKey ? true : false
  readonly reverse: RegistryKey extends SupportedExecutableUtteranceAtom ? true : false
  readonly surfaceComplete: [MissingSurfaceKeys] extends [never] ? true : false
  readonly displayComplete: [MissingDisplayKeys] extends [never] ? true : false
  readonly emitComplete: [MissingEmitKeys] extends [never] ? true : false
  readonly mutexBidirectional: [MutexNotBidirectionalKeys] extends [never] ? true : false
  readonly firstWaveCovered: [FirstWaveCoverageMissingKeys | FirstWaveNonTriggerKeys] extends [never] ? true : false
  readonly capabilityCovered: [MissingCapabilityKeys] extends [never] ? true : false
  readonly nonConditionIrShapeAllStub: [NonStubIrShapeKeys] extends [never] ? true : false
  readonly nonConditionCapabilityAllStub: [NonStubCapabilityKeys] extends [never] ? true : false
  readonly conditionIrShapeAllReal: [StubConditionIrShapeKeys] extends [never] ? true : false
}

export type _AtomContractExhaustive = AssertTrue<AtomContractInvariantReport['exhaustive']>
export type _AtomContractReverseExhaustive = AssertTrue<AtomContractInvariantReport['reverse']>
export type _AtomContractSurfaceComplete = AssertTrue<AtomContractInvariantReport['surfaceComplete']>
export type _AtomContractDisplayComplete = AssertTrue<AtomContractInvariantReport['displayComplete']>
export type _AtomContractEmitComplete = AssertTrue<AtomContractInvariantReport['emitComplete']>
export type _AtomContractMutexBidirectional = AssertTrue<AtomContractInvariantReport['mutexBidirectional']>
export type _FirstWaveTriggerAtomsCovered = AssertTrue<AtomContractInvariantReport['firstWaveCovered']>
export type _AtomContractCapabilityCovered = AssertTrue<AtomContractInvariantReport['capabilityCovered']>
export type _NonConditionIrShapeAllStub = AssertTrue<AtomContractInvariantReport['nonConditionIrShapeAllStub']>
export type _NonConditionCapabilityAllStub = AssertTrue<AtomContractInvariantReport['nonConditionCapabilityAllStub']>
export type _ConditionIrShapeAllReal = AssertTrue<AtomContractInvariantReport['conditionIrShapeAllReal']>
