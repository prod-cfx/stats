import type { SemanticCapability, SemanticState } from '../types/semantic-state'
import type { SemanticNodeStatus } from '../types/semantic-state'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import type { MainflowLeafRole, RulesMainflowAtomFact } from './rules-mainflow-reader.service'
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

export type CapabilityMountKind = 'action' | 'position_constraint' | 'risk' | 'position'

export interface CapabilityEvidence {
  readonly mount: CapabilityMountKind
  readonly ownerId: string
  readonly ownerKey: string
  readonly ownerStatus: SemanticNodeStatus
  readonly contractId: string
  readonly capability: SemanticCapability
}

const FROZEN_EMPTY: readonly CapabilityEvidence[] = Object.freeze([])
const RULES_MAINFLOW_READER = new RulesMainflowReaderService()

/** @pure 无 IO 无事务边界 — static factory only, not a DI provider */
export class CapabilityEvidenceIndex {
  private readonly byKeyMap: Map<string, CapabilityEvidence[]>
  private readonly byMountMap: Map<CapabilityMountKind, CapabilityEvidence[]>
  private readonly allList: readonly CapabilityEvidence[]

  private constructor(entries: CapabilityEvidence[]) {
    this.byKeyMap = new Map()
    this.byMountMap = new Map()

    for (const e of entries) {
      const k = `${e.capability.domain}:${e.capability.verb}:${e.capability.object}`
      let kArr = this.byKeyMap.get(k)
      if (!kArr) {
        kArr = []
        this.byKeyMap.set(k, kArr)
      }
      kArr.push(e)

      let mArr = this.byMountMap.get(e.mount)
      if (!mArr) {
        mArr = []
        this.byMountMap.set(e.mount, mArr)
      }
      mArr.push(e)
    }

    // Freeze all internal arrays so readonly return signatures are substantive
    for (const arr of this.byKeyMap.values()) {
      Object.freeze(arr)
    }
    for (const arr of this.byMountMap.values()) {
      Object.freeze(arr)
    }
    this.allList = Object.freeze(entries)
  }

  static build(state: SemanticState): CapabilityEvidenceIndex {
    const entries: CapabilityEvidence[] = []

    for (const fact of RULES_MAINFLOW_READER.readFacts(state)) {
      const mount = mountFromFactRole(fact.role)
      if (!mount) continue
      pushContractEvidence(entries, fact, mount)
      pushSynthesizedSizingEvidence(entries, fact, mount)
    }

    if (state.position?.contracts) {
      for (const contract of state.position.contracts) {
        for (const capability of contract.capabilities) {
          entries.push({
            mount: 'position',
            ownerId: 'position',
            ownerKey: 'position',
            ownerStatus: state.position.status,
            contractId: contract.id,
            capability,
          })
        }
      }
    }

    return new CapabilityEvidenceIndex(entries)
  }

  byKey(domain: string, verb: string, object: string): readonly CapabilityEvidence[] {
    return this.byKeyMap.get(`${domain}:${verb}:${object}`) ?? FROZEN_EMPTY
  }

  byMount(mount: CapabilityMountKind): readonly CapabilityEvidence[] {
    return this.byMountMap.get(mount) ?? FROZEN_EMPTY
  }

  all(): readonly CapabilityEvidence[] {
    return this.allList
  }
}

function mountFromFactRole(role: MainflowLeafRole): CapabilityMountKind | null {
  if (role === 'action') return 'action'
  if (role === 'position') return 'position_constraint'
  if (role === 'risk') return 'risk'
  return null
}

function pushContractEvidence(
  entries: CapabilityEvidence[],
  fact: RulesMainflowAtomFact,
  mount: CapabilityMountKind,
): void {
  for (const contract of fact.contracts ?? []) {
    for (const capability of contract.capabilities) {
      entries.push({
        mount,
        ownerId: ownerIdForFact(fact, mount),
        ownerKey: fact.key,
        ownerStatus: fact.status,
        contractId: contract.id,
        capability,
      })
    }
  }
}

function pushSynthesizedSizingEvidence(
  entries: CapabilityEvidence[],
  fact: RulesMainflowAtomFact,
  mount: CapabilityMountKind,
): void {
  if (fact.ruleIndex < 0) return
  if (mount !== 'action') return
  if (fact.contracts?.length) return
  const capability = synthesizeSizingCapability(fact)
  if (!capability) return
  entries.push({
    mount,
    ownerId: ownerIdForFact(fact, mount),
    ownerKey: fact.key,
    ownerStatus: fact.status,
    contractId: `${fact.id}:sizing`,
    capability,
  })
}

function synthesizeSizingCapability(fact: RulesMainflowAtomFact): SemanticCapability | null {
  const shape = readSizingShape(fact)
  if (!shape) return null
  return {
    domain: 'capital',
    verb: 'allocate',
    object: 'per_order_budget',
    shape,
  }
}

function readSizingShape(fact: RulesMainflowAtomFact): SemanticCapability['shape'] | null {
  const direct = fact.params.sizing
  if (isRecord(direct)) return direct

  const contract = (ATOM_CONTRACT_REGISTRY as Record<string, { sizingEvidence?: { paramSource: string } | null }>)[fact.key]
  const paramSource = contract?.sizingEvidence?.paramSource
  if (!paramSource) return null
  const value = fact.params[paramSource]
  return isRecord(value) ? value : null
}

function ownerIdForFact(fact: RulesMainflowAtomFact, mount: CapabilityMountKind): string {
  return mount === 'position_constraint' ? fact.key : fact.id
}

function isRecord(value: unknown): value is SemanticCapability['shape'] {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
