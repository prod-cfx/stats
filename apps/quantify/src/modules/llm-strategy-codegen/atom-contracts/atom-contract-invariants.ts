import type { SupportedExecutableUtteranceAtom } from '../nl-gateway/utterance-corpus/utterance-corpus.types'
import type { FirstWaveTriggerAtom } from '../constants/canonical-strategy-capabilities'
import type {
  AtomContractDisplay,
  AtomContractEmit,
  AtomContractSurface,
} from './atom-contract-types'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
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

type NonStubIrShapeKeys = {
  [K in RegistryKey]: Registry[K]['emit']['irShape'] extends Pr1bStubIrShapeBuilder ? never : K
}[RegistryKey]

type NonStubCapabilityKeys = {
  [K in RegistryKey]: Registry[K]['emit']['capabilityStatus'] extends 'pr1b-stub' ? never : K
}[RegistryKey]

export type AtomContractInvariantReport = {
  readonly exhaustive: SupportedExecutableUtteranceAtom extends RegistryKey ? true : false
  readonly reverse: RegistryKey extends SupportedExecutableUtteranceAtom ? true : false
  readonly surfaceComplete: [MissingSurfaceKeys] extends [never] ? true : false
  readonly displayComplete: [MissingDisplayKeys] extends [never] ? true : false
  readonly emitComplete: [MissingEmitKeys] extends [never] ? true : false
  readonly mutexBidirectional: [MutexNotBidirectionalKeys] extends [never] ? true : false
  readonly firstWaveCovered: [FirstWaveCoverageMissingKeys | FirstWaveNonTriggerKeys] extends [never] ? true : false
  readonly capabilityCovered: [MissingCapabilityKeys] extends [never] ? true : false
  readonly irShapeAllStub: [NonStubIrShapeKeys] extends [never] ? true : false
  readonly capabilityAllStub: [NonStubCapabilityKeys] extends [never] ? true : false
}

export type _AtomContractExhaustive = AssertTrue<AtomContractInvariantReport['exhaustive']>
export type _AtomContractReverseExhaustive = AssertTrue<AtomContractInvariantReport['reverse']>
export type _AtomContractSurfaceComplete = AssertTrue<AtomContractInvariantReport['surfaceComplete']>
export type _AtomContractDisplayComplete = AssertTrue<AtomContractInvariantReport['displayComplete']>
export type _AtomContractEmitComplete = AssertTrue<AtomContractInvariantReport['emitComplete']>
export type _AtomContractMutexBidirectional = AssertTrue<AtomContractInvariantReport['mutexBidirectional']>
export type _FirstWaveTriggerAtomsCovered = AssertTrue<AtomContractInvariantReport['firstWaveCovered']>
export type _AtomContractCapabilityCovered = AssertTrue<AtomContractInvariantReport['capabilityCovered']>
export type _IrShapeAllStub = AssertTrue<AtomContractInvariantReport['irShapeAllStub']>
export type _CapabilityAllStub = AssertTrue<AtomContractInvariantReport['capabilityAllStub']>
