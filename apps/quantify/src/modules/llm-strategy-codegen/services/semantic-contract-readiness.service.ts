import { Injectable } from '@nestjs/common'

import type { StrategyVersionInfo } from '../nl-gateway/version-gate/version-gate.types'
import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticNodeStatus,
  SemanticOrderRequirement,
  SemanticPositionConstraintState,
  SemanticPositionState,
  SemanticPriority,
  SemanticRequirement,
  SemanticRuntimeRequirement,
  SemanticOrchestrationNode,
  SemanticSlotState,
  SemanticState,
  SemanticStateRequirement,
} from '../types/semantic-state'
import type { SemanticAtomSupportMetadata } from '../types/semantic-atom-support'
import { buildSemanticSlotId } from '../types/semantic-state'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { SemanticAtomContractService } from './semantic-atom-contract.service'
import { SemanticContractShapeNormalizerService } from './semantic-contract-shape-normalizer.service'
import { SemanticOrchestrationRegistryService } from './semantic-orchestration-registry.service'
import { isBlockingSemanticOpenSlot } from './semantic-open-slot-blocking'
import { validateSemanticExpressionContract } from './strategy-semantic-contracts'

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'
type SemanticSubstrateRequirement =
  | SemanticRuntimeRequirement
  | SemanticStateRequirement
  | SemanticOrderRequirement
type SemanticSubstrateRequirementKind =
  | 'runtime_requirement'
  | 'state_requirement'
  | 'order_requirement'

interface Phase0OrchestrationNormalizationResult {
  state: SemanticState['orchestration']
  hasBlockingSlots: boolean
}

export type MissingSemanticContractRequirementKind = 'capability_missing' | 'timeframe_mismatch'

export interface MissingSemanticContractRequirement extends SemanticRequirement {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  contractId: string
  kind?: MissingSemanticContractRequirementKind
  errorCode?: string
  producer?: { ownerKind: SemanticContractOwnerKind; ownerId: string; timeframe: string }
  consumer?: { source: 'context_slot'; timeframe: string | null }
}

export interface SemanticContractReadinessNormalizationResult {
  state: SemanticState
  ready: boolean
  missingRequirements: MissingSemanticContractRequirement[]
}

interface SemanticContractOwnerRef {
  ownerKind: SemanticContractOwnerKind
  ownerId: string
  atomKey: string
  params: Record<string, unknown>
  support?: SemanticAtomSupportMetadata
  status: SemanticNodeStatus
  openSlots: SemanticSlotState[]
  contracts: SemanticAtomContract[]
}

interface NormalizedProviderContracts {
  contracts: SemanticAtomContract[]
  shapeSlotsByOwnerKey: Map<string, SemanticSlotState[]>
}

@Injectable()
export class SemanticContractReadinessService {
  constructor(
    private readonly semanticAtomContractService: SemanticAtomContractService = new SemanticAtomContractService(),
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly semanticAtomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
    private readonly orchestrationRegistry: SemanticOrchestrationRegistryService = new SemanticOrchestrationRegistryService(),
  ) {}

  normalize(
    state: SemanticState,
    strategyVersion?: StrategyVersionInfo,
  ): SemanticContractReadinessNormalizationResult {
    const activeOwners = collectActiveContractOwners(state)
    const orchestrationResult = normalizePhase0Orchestration(
      state.orchestration,
      this.orchestrationRegistry,
      strategyVersion,
    )
    const unsupportedOrUnknownOwnerKeys = new Set(
      activeOwners
        .filter(owner => this.isUnsupportedOrUnknownOwner(owner))
        .map(owner => ownerKey(owner.ownerKind, owner.ownerId)),
    )
    const supportedOwners = activeOwners.filter(owner =>
      !unsupportedOrUnknownOwnerKeys.has(ownerKey(owner.ownerKind, owner.ownerId)),
    )
    const providerNormalization = this.normalizeProviderContracts(supportedOwners)
    const providerContracts = providerNormalization.contracts
    const resolution = this.semanticAtomContractService.resolve(providerContracts)
    const missingRequirements = [
      ...this.collectMissingRequirements(supportedOwners, resolution.capabilities),
      ...this.validateTimeframePairing(supportedOwners, state),
    ]
    const slotsByOwnerKey = mergeSlotMaps(
      providerNormalization.shapeSlotsByOwnerKey,
      buildMissingRequirementSlots(missingRequirements),
      buildMissingSubstrateSlots(supportedOwners),
      buildUnsupportedSubstrateRequirementSlots(supportedOwners),
      buildContractOpenSlotMap(supportedOwners),
      buildAddPositionConstraintRelationshipSlots(state),
    )
    const nextState: SemanticState = {
      ...state,
      triggers: state.triggers.map(trigger =>
        mergeOwnerOpenSlots(trigger, slotsByOwnerKey.get(ownerKey('trigger', trigger.id))),
      ),
      actions: state.actions.map(action =>
        mergeOwnerOpenSlots(action, slotsByOwnerKey.get(ownerKey('action', action.id))),
      ),
      risk: state.risk.map(risk =>
        mergeOwnerOpenSlots(risk, slotsByOwnerKey.get(ownerKey('risk', risk.id))),
      ),
      position: mergePositionOpenSlots(state.position, slotsByOwnerKey),
      orchestration: orchestrationResult.state,
    }

    return {
      state: nextState,
      ready: unsupportedOrUnknownOwnerKeys.size === 0
        && missingRequirements.length === 0
        && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey)
        && !hasBlockingOwnerOpenSlots(nextState)
        && !orchestrationResult.hasBlockingSlots,
      missingRequirements,
    }
  }

  private normalizeProviderContracts(
    activeOwners: readonly SemanticContractOwnerRef[],
  ): NormalizedProviderContracts {
    const shapeSlotsByOwnerKey = new Map<string, SemanticSlotState[]>()
    const contracts: SemanticAtomContract[] = []

    for (const owner of activeOwners) {
      for (const contract of owner.contracts) {
        const capabilities = contract.capabilities.flatMap((capability) => {
          const normalizedCapability = this.normalizeProviderCapability(owner, contract, capability)

          if (normalizedCapability.openSlots.length) {
            const key = ownerKey(owner.ownerKind, owner.ownerId)
            const slots = shapeSlotsByOwnerKey.get(key) ?? []
            slots.push(...normalizedCapability.openSlots)
            shapeSlotsByOwnerKey.set(key, slots)
          }

          return normalizedCapability.capability ? [normalizedCapability.capability] : []
        })

        if (owner.status === 'locked') {
          contracts.push({
            ...contract,
            capabilities,
          })
        }
      }
    }

    return { contracts, shapeSlotsByOwnerKey }
  }

  private normalizeProviderCapability(
    owner: SemanticContractOwnerRef,
    contract: SemanticAtomContract,
    capability: SemanticCapability,
  ): { capability: SemanticCapability | null; openSlots: SemanticSlotState[] } {
    if (capability.domain === 'price' && capability.verb === 'define' && capability.object === 'level_set') {
      const result = this.shapeNormalizer.normalizeLevelSetShape(capability.shape, {
        requireDensity: true,
        fieldPath: buildCapabilityShapeFieldPath(owner, contract, capability),
      })

      return {
        capability: result.status === 'valid'
          ? { ...capability, shape: result.shape }
          : null,
        openSlots: result.openSlots,
      }
    }

    return { capability, openSlots: [] }
  }

  private collectMissingRequirements(
    activeOwners: readonly SemanticContractOwnerRef[],
    capabilities: readonly SemanticCapability[],
  ): MissingSemanticContractRequirement[] {
    return activeOwners.flatMap(owner =>
      owner.contracts.flatMap(contract =>
        contract.requires
          .filter(requirement => !this.hasCapability(capabilities, requirement))
          .map(requirement => ({
            ownerKind: owner.ownerKind,
            ownerId: owner.ownerId,
            contractId: contract.id,
            domain: requirement.domain,
            verb: requirement.verb,
            object: requirement.object,
          })),
      ),
    )
  }

  private validateTimeframePairing(
    activeOwners: readonly SemanticContractOwnerRef[],
    state: SemanticState,
  ): MissingSemanticContractRequirement[] {
    const consumerTimeframe = readContextSlotTimeframe(state)
    if (!consumerTimeframe) {
      return []
    }

    const mismatches: MissingSemanticContractRequirement[] = []

    for (const owner of activeOwners) {
      if (isTimeframeOverride(owner.params)) {
        continue
      }

      const declared = readDeclaredTimeframe(owner)
      if (!declared || declared === consumerTimeframe) {
        continue
      }

      const targetContractId = owner.contracts[0]?.id ?? `${owner.ownerKind}:${owner.ownerId}`

      mismatches.push({
        ownerKind: owner.ownerKind,
        ownerId: owner.ownerId,
        contractId: targetContractId,
        domain: 'runtime',
        verb: 'align',
        object: 'timeframe',
        kind: 'timeframe_mismatch',
        errorCode: 'READINESS_TIMEFRAME_MISMATCH',
        producer: { ownerKind: owner.ownerKind, ownerId: owner.ownerId, timeframe: declared },
        consumer: { source: 'context_slot', timeframe: consumerTimeframe },
      })
    }

    return mismatches
  }

  private hasCapability(
    capabilities: readonly SemanticCapability[],
    requirement: SemanticRequirement,
  ): boolean {
    return capabilities.some(capability =>
      capability.domain === requirement.domain
      && capability.verb === requirement.verb
      && capability.object === requirement.object
      && this.hasRequiredCapabilityShape(capability, requirement),
    )
  }

  private hasRequiredCapabilityShape(
    capability: SemanticCapability,
    requirement: SemanticRequirement,
  ): boolean {
    if (requirement.domain === 'price' && requirement.verb === 'define' && requirement.object === 'level_set') {
      return this.shapeNormalizer.normalizeLevelSetShape(capability.shape, { requireDensity: true }).status === 'valid'
    }

    if (requirement.domain === 'capital' && requirement.verb === 'allocate' && requirement.object === 'per_order_budget') {
      return this.shapeNormalizer.isValidPerOrderBudgetShape(capability.shape)
    }

    if (requirement.domain === 'exposure' && requirement.verb === 'set' && requirement.object === 'position_mode') {
      return readShapeString(capability.shape, 'mode') !== null
    }

    if (requirement.domain === 'guard' && requirement.verb === 'enforce' && isBoundaryCancelRequirement(requirement.object)) {
      return this.shapeNormalizer.isValidBoundaryCancelShape(capability.shape)
    }

    return true
  }

  private isUnsupportedOrUnknownOwner(owner: SemanticContractOwnerRef): boolean {
    const resolved = this.resolveOwnerSupport(owner)
    if (isSupportedAtom(resolved)) {
      return false
    }

    if (isUnsupportedOrUnknownSupportStatus(resolved.supportStatus)) {
      return true
    }

    if (
      owner.support?.supportStatus === 'recognized_unsupported'
      || owner.support?.supportStatus === 'unsupported_unknown'
    ) {
      return true
    }

    return false
  }

  private resolveOwnerSupport(owner: SemanticContractOwnerRef): ReturnType<SemanticAtomRegistryService['resolve']> {
    if (isExecutableIndicatorReferenceAlias(owner)) {
      const registryKey = owner.atomKey === 'indicator.above' ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
      return {
        ...this.semanticAtomRegistry.get(registryKey),
        key: owner.atomKey,
      }
    }

    return this.semanticAtomRegistry.resolve(owner.atomKey)
  }
}

function isSupportedAtom(resolved: ReturnType<SemanticAtomRegistryService['resolve']>): boolean {
  return resolved.supportStatus === 'supported_executable' || resolved.supportStatus === 'supported_requires_slot'
}

function normalizePhase0Orchestration(
  orchestration: SemanticState['orchestration'],
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
): Phase0OrchestrationNormalizationResult {
  if (!orchestration) {
    return { state: orchestration, hasBlockingSlots: false }
  }

  let changed = false
  let hasBlockingSlots = false
  const siblingNodes = orchestration.nodes
  const nodes = orchestration.nodes.map((node) => {
    const nextNode = applyOrchestrationReadinessForNode(node, registry, strategyVersion, siblingNodes)
    changed ||= nextNode !== node
    hasBlockingSlots ||= ownerHasOpenSlot(nextNode)
    return nextNode
  })

  return {
    state: changed ? { ...orchestration, nodes } : orchestration,
    hasBlockingSlots,
  }
}

function applyOrchestrationReadinessForNode(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): SemanticOrchestrationNode {
  if (node.status !== 'locked') {
    return node
  }

  if (isSupportedRegimeGate(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  if (isSupportedPortfolioDrawdownBlock(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  if (isSupportedFixedGridGated(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  return addPhase0OrchestrationBlocker(node)
}

function isProgramNode(
  node: SemanticOrchestrationNode,
): node is SemanticOrchestrationNode & { kind: 'program' } {
  return node.kind === 'program'
}

/**
 * 判断 program.fixed_grid_gated node 是否可走 registry 驱动的 readiness 路径。
 *
 * 14 重 fail-closed 检查：
 * 1) kind === 'program'
 * 2) key === 'program.fixed_grid_gated'
 * 3) programKind === 'fixed_grid_gated'
 * 4) onDeactivate ∈ {'cancel','keep','close'}
 * 5) rebuildPolicy === 'static'
 * 6) gridParams.anchorPrice 是有限正数
 * 7) gridParams.levelCount 是 2..100 整数
 * 8) gridParams.stepPct ∈ (0, 100]
 * 9) gridParams.lowerBound（若提供）必须 < upperBound 且都是正有限数
 * 10) sizing.mode ∈ {'fixed_quote','fixed_base','fixed_pct'}
 * 11) sizing.value 是有限正数
 * 12) registry 已注册该 contract
 * 13) cross-node：activeWhenRef 必须引用 status:'locked' 且 readiness supported 的 gate.regime 节点
 * 14) version-gate：strategyVersion 必须存在且 atom 对该策略可执行
 */
function isSupportedFixedGridGated(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (!isProgramNode(node)) {
    return false
  }
  if (node.key !== 'program.fixed_grid_gated') {
    return false
  }
  if (node.programKind !== 'fixed_grid_gated') {
    return false
  }
  if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') {
    return false
  }
  if (node.rebuildPolicy !== 'static') {
    return false
  }

  const grid = node.gridParams
  if (!grid) {
    return false
  }
  if (typeof grid.anchorPrice !== 'number' || !Number.isFinite(grid.anchorPrice) || grid.anchorPrice <= 0) {
    return false
  }
  if (
    typeof grid.levelCount !== 'number'
    || !Number.isFinite(grid.levelCount)
    || !Number.isInteger(grid.levelCount)
    || grid.levelCount < 2
    || grid.levelCount > 100
  ) {
    return false
  }
  if (typeof grid.stepPct !== 'number' || !Number.isFinite(grid.stepPct) || grid.stepPct <= 0 || grid.stepPct > 100) {
    return false
  }
  if (grid.lowerBound !== undefined) {
    if (typeof grid.lowerBound !== 'number' || !Number.isFinite(grid.lowerBound) || grid.lowerBound <= 0) {
      return false
    }
    if (grid.upperBound !== undefined) {
      if (typeof grid.upperBound !== 'number' || !Number.isFinite(grid.upperBound) || grid.upperBound <= 0) {
        return false
      }
      if (grid.lowerBound >= grid.upperBound) {
        return false
      }
    }
  }
  if (grid.upperBound !== undefined && (typeof grid.upperBound !== 'number' || !Number.isFinite(grid.upperBound) || grid.upperBound <= 0)) {
    return false
  }

  const sizing = node.sizing
  if (!sizing) {
    return false
  }
  if (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct') {
    return false
  }
  if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
    return false
  }

  const contract = registry.getContractByKey('program.fixed_grid_gated')
  if (!contract) {
    return false
  }

  if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') {
    return false
  }
  const referenced = siblingNodes.find(n => n.id === node.activeWhenRef)
  if (!referenced) {
    return false
  }
  if (referenced.kind !== 'gate' || referenced.key !== 'gate.regime') {
    return false
  }
  if (referenced.status !== 'locked') {
    return false
  }
  if (!isSupportedRegimeGate(referenced, registry, strategyVersion, siblingNodes)) {
    return false
  }

  if (!strategyVersion) {
    return false
  }

  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * 判断 portfolioRisk node 是否可走 registry 驱动的 readiness 路径。
 *
 * 7 重 fail-closed 检查：
 * 1) kind === 'portfolioRisk'
 * 2) key === 'portfolioRisk.drawdown_block'
 * 3) scope === 'portfolio'
 * 4) mode === 'observe' || mode === 'enforce'
 * 5) thresholdPct 是有限正数且 ≤ 100
 * 6) registry 已注册该 contract
 * 7) version-gate：strategyVersion 必须存在且 atom 对该策略可执行
 *    （strategyVersion === undefined / deployedAtSemanticVersion === null 均 fail-closed）
 */
function isSupportedPortfolioDrawdownBlock(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'portfolioRisk') {
    return false
  }
  if (node.key !== 'portfolioRisk.drawdown_block') {
    return false
  }
  if (node.scope !== 'portfolio') {
    return false
  }
  if (node.mode !== 'observe' && node.mode !== 'enforce') {
    return false
  }
  const thresholdPct = node.thresholdPct
  if (thresholdPct !== undefined) {
    if (
      typeof thresholdPct !== 'number'
      || !Number.isFinite(thresholdPct)
      || thresholdPct <= 0
      || thresholdPct > 100
    ) {
      return false
    }
  }

  const contract = registry.getContractByKey('portfolioRisk.drawdown_block')
  if (!contract) {
    return false
  }

  if (!strategyVersion) {
    return false
  }

  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * 判断 orchestration node 是否可走 registry 驱动的 readiness 路径。
 *
 * 6 重 fail-closed 检查：
 * 1) kind === 'gate'
 * 2) key === 'gate.regime'
 * 3) target.phase === 'entry'
 * 4) 若 activeWhen 已提供则必须是合法 SemanticExpression（非合法即 fail-closed）
 *    activeWhen 缺失允许走 registry 路径，由 registry.validate 产出 open slot
 * 5) registry 已注册该 contract
 * 6) version-gate：strategyVersion 必须存在且 atom 对该策略可执行
 *    （strategyVersion === undefined / deployedAtSemanticVersion === null 均 fail-closed）
 */
function isSupportedRegimeGate(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'gate') {
    return false
  }
  if (node.key !== 'gate.regime') {
    return false
  }
  if (node.target?.phase !== 'entry') {
    return false
  }
  if (node.activeWhen !== undefined && !validateSemanticExpressionContract(node.activeWhen).ok) {
    return false
  }

  const contract = registry.getContractByKey('gate.regime')
  if (!contract) {
    return false
  }

  if (!strategyVersion) {
    return false
  }

  return registry.isExecutableForStrategy(contract, strategyVersion)
}

function applyRegistryDrivenReadiness(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
): SemanticOrchestrationNode {
  const validation = registry.validate(node)
  if (validation.ok) {
    return node
  }

  const openSlots = node.openSlots ?? []
  const slotKeys = new Set(openSlots.map(slot => slot.slotKey))
  const merged = [...openSlots]
  for (const slot of validation.missingSlots) {
    if (!slotKeys.has(slot.slotKey)) {
      merged.push(slot)
      slotKeys.add(slot.slotKey)
    }
  }

  return {
    ...node,
    status: 'open',
    openSlots: merged,
  }
}

function addPhase0OrchestrationBlocker(node: SemanticOrchestrationNode): SemanticOrchestrationNode {
  if (node.status !== 'locked') {
    return node
  }

  const blocker = toPhase0OrchestrationBlocker(node)
  const openSlots = node.openSlots ?? []
  const blockerIndex = openSlots.findIndex(slot => slot.slotKey === blocker.slotKey)
  const nextOpenSlots = blockerIndex === -1
    ? [...openSlots, blocker]
    : openSlots.map((slot, index) => index === blockerIndex ? blocker : slot)

  return {
    ...node,
    status: 'open',
    openSlots: nextOpenSlots,
  }
}

function toPhase0OrchestrationBlocker(node: SemanticOrchestrationNode): SemanticSlotState {
  return {
    slotKey: 'orchestration.phase0.unsupported',
    fieldPath: `orchestration.${node.kind}[${node.id}]`,
    status: 'open',
    priority: 'behavior',
    affectsExecution: true,
    questionHint: 'Phase 0 暂不支持部署 orchestration runtime。',
    evidence: {
      source: 'derived',
      text: `Phase 0 cannot deploy orchestration node ${node.id}`,
    },
  }
}

function isUnsupportedOrUnknownSupportStatus(status: ReturnType<SemanticAtomRegistryService['resolve']>['supportStatus']): boolean {
  return status === 'recognized_unsupported' || status === 'unsupported_unknown'
}

function readShapeString(shape: SemanticCapability['shape'], key: string): string | null {
  const value = shape[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function isBoundaryCancelRequirement(object: string): boolean {
  return /boundary|breakout|breach|cancel|halt|stop|order|grid/u.test(object)
}

function collectActiveContractOwners(state: SemanticState): SemanticContractOwnerRef[] {
  const owners: SemanticContractOwnerRef[] = []

  for (const trigger of state.triggers) {
    if (trigger.status !== 'superseded' && trigger.contracts?.length) {
      owners.push({
        ownerKind: 'trigger',
        ownerId: trigger.id,
        atomKey: trigger.key,
        params: trigger.params,
        support: trigger.support,
        status: trigger.status,
        openSlots: trigger.openSlots,
        contracts: trigger.contracts,
      })
    }
  }

  for (const action of state.actions) {
    if (action.status !== 'superseded' && action.contracts?.length) {
      owners.push({
        ownerKind: 'action',
        ownerId: action.id,
        atomKey: action.key,
        params: {},
        support: action.support,
        status: action.status,
        openSlots: action.openSlots ?? [],
        contracts: action.contracts,
      })
    }
  }

  for (const risk of state.risk) {
    if (risk.status !== 'superseded' && risk.contracts?.length) {
      owners.push({
        ownerKind: 'risk',
        ownerId: risk.id,
        atomKey: risk.key,
        params: risk.params,
        support: risk.support,
        status: risk.status,
        openSlots: risk.openSlots,
        contracts: risk.contracts,
      })
    }
  }

  if (
    state.position
    && state.position.mode !== 'constraint_only'
    && state.position.status !== 'superseded'
    && state.position.contracts?.length
  ) {
    owners.push({
      ownerKind: 'position',
      ownerId: positionOwnerId(),
      atomKey: toPositionAtomKey(state.position.mode),
      params: {
        mode: state.position.mode,
        value: state.position.value,
        positionMode: state.position.positionMode,
        sizing: state.position.sizing,
      },
      support: state.position.support,
      status: state.position.status,
      openSlots: state.position.openSlots ?? [],
      contracts: state.position.contracts,
    })
  }

  for (const constraint of state.position?.constraints ?? []) {
    if (constraint.status !== 'superseded' && constraint.contracts?.length) {
      owners.push({
        ownerKind: 'position',
        ownerId: positionConstraintOwnerId(constraint),
        atomKey: constraint.key,
        params: constraint.params,
        support: constraint.support,
        status: constraint.status,
        openSlots: constraint.openSlots,
        contracts: constraint.contracts,
      })
    }
  }

  return owners
}

function isExecutableIndicatorReferenceAlias(owner: SemanticContractOwnerRef): boolean {
  if (owner.ownerKind !== 'trigger' || (owner.atomKey !== 'indicator.above' && owner.atomKey !== 'indicator.below')) {
    return false
  }

  const indicator = readParamString(owner.params, 'indicator')?.toLowerCase() ?? ''
  const referenceRole = readParamString(owner.params, 'referenceRole') ?? ''
  const referencePeriod = owner.params['reference.period']
  const hasReferencePeriod = typeof referencePeriod === 'number' && Number.isFinite(referencePeriod) && referencePeriod > 0
  const hasReferencePeriodOpenSlot = owner.openSlots.some(slot =>
    slot.status === 'open'
    && slot.affectsExecution
    && /reference\.period/u.test(`${slot.slotKey}.${slot.fieldPath}`),
  )

  return (indicator === 'ma' || indicator === 'sma' || indicator === 'ema')
    && referenceRole.length > 0
    && (hasReferencePeriod || hasReferencePeriodOpenSlot)
}

function readParamString(params: Record<string, unknown>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildMissingRequirementSlots(
  requirements: readonly MissingSemanticContractRequirement[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const requirement of requirements) {
    const key = ownerKey(requirement.ownerKind, requirement.ownerId)
    const slots = slotsByOwnerKey.get(key) ?? []

    slots.push(toOpenSlot(requirement))
    slotsByOwnerKey.set(key, slots)
  }

  return slotsByOwnerKey
}

function buildMissingSubstrateSlots(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (hasContractSubstrate(contract)) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      const slots = slotsByOwnerKey.get(key) ?? []
      slots.push({
        slotKey: 'contract.substrate.missing',
        fieldPath: buildContractFieldPath(owner, contract.id),
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '请补齐该语义合约的执行 substrate。',
        evidence: {
          source: 'derived',
          text: `Missing semantic contract substrate ${contract.id}`,
        },
      })
      slotsByOwnerKey.set(key, slots)
    }
  }

  return slotsByOwnerKey
}

const SUPPORTED_SUBSTRATE_REQUIREMENT_KEYS = new Set([
  'runtime.provide.bar_ohlcv',
  'runtime.provide.indicator_helper',
  'runtime.provide.compiled_predicate_runtime',
  'runtime.provide.position_pnl_pct',
  'runtime.provide.position_snapshot',
  'state.read.none',
  'state.write.none',
  'state.read.sequence_state',
  'state.write.sequence_state',
  'state.read.remembered_level',
  'state.write.remembered_level',
  'state.read_write.pyramiding_layer_count',
  'state.read_write.dca_fired_count',
  'order.support.market_order',
  'order.support.close_position',
  'order.support.reduce_position',
  'order.support.reduce_only',
  'order.enforce.no_exposure_increase',
])

const SUPPORTED_SUBSTRATE_REQUIREMENT_KEY_PREFIXES: readonly string[] = [
  // partial_take_profit allocates a per-strategy state slot whose object is the
  // dynamic memoryKey (`partial_tp_<hash>`); accept the family wholesale.
  'state.read_write.partial_tp_',
]

function buildUnsupportedSubstrateRequirementSlots(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (!hasContractSubstrate(contract)) {
        continue
      }

      const unsupportedRequirements = [
        ...contract.runtimeRequirements.map(requirement => ({
          kind: 'runtime_requirement' as const,
          requirement,
        })),
        ...contract.stateRequirements.map(requirement => ({
          kind: 'state_requirement' as const,
          requirement,
        })),
        ...contract.orderRequirements.map(requirement => ({
          kind: 'order_requirement' as const,
          requirement,
        })),
      ].filter(({ requirement }) => !isSupportedSubstrateRequirement(requirement))

      if (!unsupportedRequirements.length) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      const slots = slotsByOwnerKey.get(key) ?? []
      slots.push(...unsupportedRequirements.map(({ kind, requirement }) =>
        toUnsupportedSubstrateRequirementSlot(owner, contract, kind, requirement),
      ))
      slotsByOwnerKey.set(key, slots)
    }
  }

  return slotsByOwnerKey
}

function isSupportedSubstrateRequirement(requirement: SemanticSubstrateRequirement): boolean {
  const key = requirementKey(requirement)
  if (SUPPORTED_SUBSTRATE_REQUIREMENT_KEYS.has(key)) {
    return true
  }
  return SUPPORTED_SUBSTRATE_REQUIREMENT_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
}

function requirementKey(requirement: SemanticSubstrateRequirement): string {
  return `${requirement.domain}.${requirement.verb}.${requirement.object}`
}

function toUnsupportedSubstrateRequirementSlot(
  owner: SemanticContractOwnerRef,
  contract: SemanticAtomContract,
  requirementKind: SemanticSubstrateRequirementKind,
  requirement: SemanticSubstrateRequirement,
): SemanticSlotState {
  const key = requirementKey(requirement)

  return {
    slotKey: `contract.${requirementKind}.${key}`,
    fieldPath: `${buildContractFieldPath(owner, contract.id)}.${requirementKind}.${key}`,
    status: 'open',
    priority: requirementKind === 'order_requirement' ? 'risk' : 'behavior',
    affectsExecution: true,
    questionHint: `请补齐 ${requirement.domain} ${requirement.verb} ${requirement.object} 的执行 substrate。`,
    evidence: {
      source: 'derived',
      text: `Unsupported semantic contract ${requirementKind} ${contract.id}: ${key}`,
    },
  }
}

function buildContractOpenSlotMap(
  activeOwners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of activeOwners) {
    for (const contract of owner.contracts) {
      if (!Array.isArray(contract.openSlots) || !contract.openSlots.length) {
        continue
      }

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      slotsByOwnerKey.set(key, [
        ...(slotsByOwnerKey.get(key) ?? []),
        ...contract.openSlots,
      ])
    }
  }

  return slotsByOwnerKey
}

function buildAddPositionConstraintRelationshipSlots(state: SemanticState): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()
  if (hasActiveAddPositionConstraint(state.position)) {
    return slotsByOwnerKey
  }

  for (const action of state.actions) {
    if (action.status === 'superseded' || action.key !== 'action.add_position') {
      continue
    }

    slotsByOwnerKey.set(ownerKey('action', action.id), [{
      slotKey: 'action.add_position.constraint',
      fieldPath: `actions[${action.id}].params.constraint`,
      status: 'open',
      priority: 'risk',
      affectsExecution: true,
      questionHint: '请确认加仓的约束，例如最大加仓次数或最大总敞口比例。',
      evidence: {
        source: 'derived',
        text: `Missing exposure guard for add_position action ${action.id}`,
      },
    }])
  }

  return slotsByOwnerKey
}

function hasActiveAddPositionConstraint(position: SemanticPositionState | null): boolean {
  return position?.constraints?.some(constraint =>
    constraint.status !== 'superseded'
    && (constraint.key === 'position.pyramiding_limit' || constraint.key === 'position.max_exposure_pct'),
  ) ?? false
}

function hasContractSubstrate(contract: Partial<SemanticAtomContract>): boolean {
  return Array.isArray(contract.runtimeRequirements)
    && Array.isArray(contract.stateRequirements)
    && Array.isArray(contract.orderRequirements)
    && Array.isArray(contract.openSlots)
}

function mergeSlotMaps(
  ...slotMaps: readonly Map<string, SemanticSlotState[]>[]
): Map<string, SemanticSlotState[]> {
  const merged = new Map<string, SemanticSlotState[]>()

  for (const slotMap of slotMaps) {
    for (const [key, slots] of slotMap) {
      merged.set(key, [
        ...(merged.get(key) ?? []),
        ...slots,
      ])
    }
  }

  return merged
}

function hasOpenSlots(slotsByOwnerKey: Map<string, SemanticSlotState[]>): boolean {
  for (const slots of slotsByOwnerKey.values()) {
    if (slots.length) {
      return true
    }
  }

  return false
}

function hasBlockingOwnerOpenSlots(state: SemanticState): boolean {
  return state.triggers.some(ownerHasOpenSlot)
    || state.actions.some(ownerHasOpenSlot)
    || state.risk.some(ownerHasOpenSlot)
    || ownerHasOpenSlot(state.position)
    || (state.position?.constraints ?? []).some(ownerHasOpenSlot)
}

function ownerHasOpenSlot(owner: { openSlots?: readonly SemanticSlotState[] } | null): boolean {
  return owner?.openSlots?.some(isBlockingSemanticOpenSlot) ?? false
}

function toOpenSlot(requirement: MissingSemanticContractRequirement): SemanticSlotState {
  if (requirement.kind === 'timeframe_mismatch') {
    const producerTf = requirement.producer?.timeframe ?? 'unknown'
    const consumerTf = requirement.consumer?.timeframe ?? 'unknown'
    return {
      slotKey: `contract.timeframe_mismatch.${requirement.ownerKind}.${requirement.ownerId}`,
      fieldPath: buildTimeframeMismatchFieldPath(requirement),
      status: 'open',
      priority: 'behavior',
      affectsExecution: true,
      questionHint: `${requirement.ownerKind} 声明的 timeframe (${producerTf}) 与执行上下文 timeframe (${consumerTf}) 不一致，请对齐。`,
      evidence: {
        source: 'derived',
        text: `Timeframe mismatch on ${requirement.ownerKind} ${requirement.ownerId}: producer=${producerTf} consumer=${consumerTf}`,
      },
    }
  }

  const capabilityKey = `${requirement.domain}.${requirement.verb}.${requirement.object}`

  return {
    slotKey: `contract.requirement.${capabilityKey}`,
    fieldPath: buildRequirementFieldPath(requirement, capabilityKey),
    status: 'open',
    priority: toPriority(requirement.domain),
    affectsExecution: true,
    questionHint: `请补充 ${requirement.domain} ${requirement.verb} ${requirement.object} 的执行语义。`,
    evidence: {
      source: 'derived',
      text: `Missing semantic contract requirement ${requirement.contractId}: ${capabilityKey}`,
    },
  }
}

function mergePositionOpenSlots(
  position: SemanticPositionState | null,
  slotsByOwnerKey: Map<string, SemanticSlotState[]>,
): SemanticPositionState | null {
  if (!position) {
    return null
  }

  const constraints = position.constraints?.map(constraint =>
    mergeOwnerOpenSlots(
      constraint,
      slotsByOwnerKey.get(ownerKey('position', positionConstraintOwnerId(constraint))),
    ),
  )
  const nextPosition = mergeOwnerOpenSlots(position, slotsByOwnerKey.get(ownerKey('position', positionOwnerId())))
  return constraints
    ? { ...nextPosition, constraints }
    : nextPosition
}

function mergeOwnerOpenSlots<T extends { openSlots?: SemanticSlotState[]; status?: SemanticNodeStatus }>(
  owner: T,
  slotsToAdd: readonly SemanticSlotState[] | undefined,
): T {
  const missingSlots = slotsToAdd ?? []
  const missingSlotIds = new Set(missingSlots.map(slot => buildSemanticSlotId(slot)))
  const currentOpenSlots = owner.openSlots ?? []
  const openSlots = currentOpenSlots.filter(slot =>
    !isManagedContractReadinessSlot(slot) || missingSlotIds.has(buildSemanticSlotId(slot)),
  )

  if (!missingSlots.length) {
    const nextStatus = openSlots.some(slot => slot.status === 'open')
      ? 'open'
      : owner.status === 'open'
        ? 'locked'
        : owner.status
    if (openSlots.length === currentOpenSlots.length && nextStatus === owner.status) {
      return owner
    }

    return {
      ...owner,
      openSlots,
      ...(nextStatus ? { status: nextStatus } : {}),
    }
  }

  const slotIndexById = new Map(openSlots.map((slot, index) => [buildSemanticSlotId(slot), index]))

  for (const slot of missingSlots) {
    const slotId = buildSemanticSlotId(slot)
    const existingIndex = slotIndexById.get(slotId)

    if (existingIndex === undefined) {
      openSlots.push(slot)
      slotIndexById.set(slotId, openSlots.length - 1)
      continue
    }

    if (openSlots[existingIndex].status !== 'open' && isManagedContractReadinessSlot(slot)) {
      openSlots[existingIndex] = slot
    }
  }

  const nextStatus = openSlots.some(slot => slot.status === 'open')
    ? 'open'
    : owner.status === 'open'
      ? 'locked'
      : owner.status

  return {
    ...owner,
    openSlots,
    ...(nextStatus ? { status: nextStatus } : {}),
  }
}

function isManagedContractReadinessSlot(slot: SemanticSlotState): boolean {
  return slot.slotKey.startsWith('contract.substrate.')
    || slot.slotKey.startsWith('contract.requirement.')
    || slot.slotKey.startsWith('contract.shape.')
    || slot.slotKey.startsWith('contract.runtime_requirement.')
    || slot.slotKey.startsWith('contract.state_requirement.')
    || slot.slotKey.startsWith('contract.order_requirement.')
    || slot.slotKey.startsWith('contract.timeframe_mismatch.')
    || slot.slotKey === 'action.add_position.constraint'
}

function readContextSlotTimeframe(state: SemanticState): string | null {
  const value = state.contextSlots?.timeframe?.value
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readDeclaredTimeframe(owner: SemanticContractOwnerRef): string | null {
  const direct = readParamString(owner.params, 'timeframe')
  if (direct) {
    return direct
  }

  for (const contract of owner.contracts) {
    const fromContractParams = readParamString(contract.params ?? {}, 'timeframe')
    if (fromContractParams) {
      return fromContractParams
    }
  }

  return null
}

function isTimeframeOverride(params: Record<string, unknown>): boolean {
  return params.timeframeOverride === true
}

function buildTimeframeMismatchFieldPath(requirement: MissingSemanticContractRequirement): string {
  if (requirement.ownerKind === 'position') {
    return isPositionConstraintOwnerId(requirement.ownerId)
      ? `position.constraints[${positionConstraintIdFromOwnerId(requirement.ownerId)}].params.timeframe`
      : 'position.params.timeframe'
  }

  return `${ownerCollection(requirement.ownerKind)}[${requirement.ownerId}].params.timeframe`
}

function buildRequirementFieldPath(
  requirement: MissingSemanticContractRequirement,
  capabilityKey: string,
): string {
  if (requirement.ownerKind === 'position' && isPositionConstraintOwnerId(requirement.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(requirement.ownerId)}].contracts[${requirement.contractId}].requires.${capabilityKey}`
  }

  if (requirement.ownerKind === 'position') {
    return `position.contracts[${requirement.contractId}].requires.${capabilityKey}`
  }

  return `${ownerCollection(requirement.ownerKind)}[${requirement.ownerId}].contracts[${requirement.contractId}].requires.${capabilityKey}`
}

function buildCapabilityShapeFieldPath(
  owner: SemanticContractOwnerRef,
  contract: SemanticAtomContract,
  capability: SemanticCapability,
): string {
  const capabilityKey = `${capability.domain}.${capability.verb}.${capability.object}`

  if (owner.ownerKind === 'position' && isPositionConstraintOwnerId(owner.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(owner.ownerId)}].contracts[${contract.id}].capabilities[${capabilityKey}].shape`
  }

  if (owner.ownerKind === 'position') {
    return `position.contracts[${contract.id}].capabilities[${capabilityKey}].shape`
  }

  return `${ownerCollection(owner.ownerKind)}[${owner.ownerId}].contracts[${contract.id}].capabilities[${capabilityKey}].shape`
}

function buildContractFieldPath(
  owner: SemanticContractOwnerRef,
  contractId: string,
): string {
  if (owner.ownerKind === 'position' && isPositionConstraintOwnerId(owner.ownerId)) {
    return `position.constraints[${positionConstraintIdFromOwnerId(owner.ownerId)}].contracts[${contractId}]`
  }

  if (owner.ownerKind === 'position') {
    return `position.contracts[${contractId}]`
  }

  return `${ownerCollection(owner.ownerKind)}[${owner.ownerId}].contracts[${contractId}]`
}

function ownerCollection(ownerKind: Exclude<SemanticContractOwnerKind, 'position'>): 'triggers' | 'actions' | 'risk' {
  if (ownerKind === 'trigger') {
    return 'triggers'
  }

  if (ownerKind === 'action') {
    return 'actions'
  }

  return 'risk'
}

function toPriority(domain: SemanticCapabilityDomain): SemanticPriority {
  if (domain === 'guard') {
    return 'risk'
  }

  if (domain === 'market') {
    return 'context'
  }

  return 'behavior'
}

function ownerKey(ownerKind: SemanticContractOwnerKind, ownerId: string): string {
  return `${ownerKind}:${ownerId}`
}

function positionOwnerId(): string {
  return 'position'
}

function positionConstraintOwnerId(constraint: Pick<SemanticPositionConstraintState, 'id'>): string {
  return `position-constraint:${constraint.id}`
}

function isPositionConstraintOwnerId(ownerId: string): boolean {
  return ownerId.startsWith('position-constraint:')
}

function positionConstraintIdFromOwnerId(ownerId: string): string {
  return ownerId.slice('position-constraint:'.length)
}

function toPositionAtomKey(mode: string): string {
  if (mode === 'fixed_ratio') {
    return 'position.fixed_pct'
  }

  if (mode === 'fixed_quote') {
    return 'position.fixed_notional'
  }

  if (mode === 'fixed_qty') {
    return 'position.fixed_quantity'
  }

  if (isPositionLifecycleConstraintKey(mode)) {
    return `position.main_mode.${mode}`
  }

  if (mode === 'constraint_only') {
    return 'position.main_mode.constraint_only'
  }

  return mode
}

function isPositionLifecycleConstraintKey(mode: string): boolean {
  return mode === 'position.pyramiding_limit'
    || mode === 'position.max_exposure_pct'
    || mode === 'position.dca_schedule'
}
