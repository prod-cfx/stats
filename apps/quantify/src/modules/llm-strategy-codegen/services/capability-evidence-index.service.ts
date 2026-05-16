import type { SemanticCapability, SemanticState } from '../types/semantic-state'
import type { SemanticNodeStatus } from '../types/semantic-state'
import { readFlatActions, readFlatRisks } from '../types/semantic-state-flat-readers'

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

    for (const action of readFlatActions(state)) {
      if (!action.contracts) continue
      for (const contract of action.contracts) {
        for (const capability of contract.capabilities) {
          entries.push({
            mount: 'action',
            ownerId: action.id,
            ownerKey: action.key,
            ownerStatus: action.status,
            contractId: contract.id,
            capability,
          })
        }
      }
    }

    if (state.positionConstraint) {
      for (const pc of state.positionConstraint) {
        if (!pc.contracts) continue
        for (const contract of pc.contracts) {
          for (const capability of contract.capabilities) {
            entries.push({
              mount: 'position_constraint',
              ownerId: pc.key,
              ownerKey: pc.key,
              ownerStatus: pc.status,
              contractId: contract.id,
              capability,
            })
          }
        }
      }
    }

    for (const risk of readFlatRisks(state)) {
      if (!risk.contracts) continue
      for (const contract of risk.contracts) {
        for (const capability of contract.capabilities) {
          entries.push({
            mount: 'risk',
            ownerId: risk.id,
            ownerKey: risk.key,
            ownerStatus: risk.status,
            contractId: contract.id,
            capability,
          })
        }
      }
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
