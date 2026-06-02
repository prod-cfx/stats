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
      const mount = mountFromFact(fact)
      if (!mount) continue
      pushContractEvidence(entries, fact, mount)
      pushSynthesizedSizingEvidence(entries, fact, mount)
    }

    pushLegacyFlatOwnerEvidence(entries, state)

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

function pushLegacyFlatOwnerEvidence(entries: CapabilityEvidence[], state: SemanticState): void {
  const legacy = state as SemanticState & {
    action?: LegacyCapabilityOwner[]
    risk?: LegacyCapabilityOwner[]
    positionConstraint?: LegacyCapabilityOwner[]
  }
  for (const owner of legacy.action ?? []) {
    pushLegacyOwnerContracts(entries, owner, 'action')
  }
  for (const owner of legacy.risk ?? []) {
    pushLegacyOwnerContracts(entries, owner, 'risk')
  }
  for (const owner of legacy.positionConstraint ?? []) {
    pushLegacyOwnerContracts(entries, owner, 'position_constraint')
  }
}

interface LegacyCapabilityOwner {
  readonly id: string
  readonly key: string
  readonly status: SemanticNodeStatus
  readonly contracts?: ReadonlyArray<{
    readonly id: string
    readonly capabilities: readonly SemanticCapability[]
  }>
}

function pushLegacyOwnerContracts(
  entries: CapabilityEvidence[],
  owner: LegacyCapabilityOwner,
  mount: CapabilityMountKind,
): void {
  for (const contract of owner.contracts ?? []) {
    for (const capability of contract.capabilities) {
      entries.push({
        mount,
        ownerId: owner.id,
        ownerKey: owner.key,
        ownerStatus: owner.status,
        contractId: contract.id,
        capability,
      })
    }
  }
}

function mountFromFact(fact: RulesMainflowAtomFact): CapabilityMountKind | null {
  if (fact.role === 'action') return 'action'
  if (fact.role === 'position') return 'position_constraint'
  if (fact.role === 'risk') return 'risk'
  if (fact.role === 'condition' && fact.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key) {
    return 'position_constraint'
  }
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
  // Issue #1707 Gap B：rules-only mode 下 dispatcher / planner emit 的 `position.sizing` /
  // 其它 positionConstraint leaf 走 role='position' → mount='position_constraint'。
  // 原先只对 mount='action' 合成 per_order_budget evidence，PerTradeSizingResolver
  // (c) 路径在 position_constraint 这边永远拿不到 evidence，叠加 dispatcher 的空 emit
  // (Gap C) 导致仓位识别不出来，clarification 一直追问 position.sizing。
  // 与 action mount 对称地放开：fact.contracts 为空（atom 未显式带 contract）时合成。
  if (mount !== 'action' && mount !== 'position_constraint') return
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
  if (isRecord(value)) return value
  if (fact.key === ATOM_CONTRACT_REGISTRY['grid.range_rebalance'].key
    && typeof value === 'number'
    && Number.isFinite(value)
    && value > 0) {
    return { kind: 'ratio', value, unit: 'ratio' }
  }
  return null
}

function ownerIdForFact(fact: RulesMainflowAtomFact, mount: CapabilityMountKind): string {
  return mount === 'position_constraint' ? fact.key : fact.id
}

function isRecord(value: unknown): value is SemanticCapability['shape'] {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
