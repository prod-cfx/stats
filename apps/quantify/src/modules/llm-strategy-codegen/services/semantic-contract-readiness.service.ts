import { Injectable, Logger } from '@nestjs/common'

import { parseTimeframeMs } from '@ai/shared/script-engine/compiled-runtime'
import type { AtomExpr, AtomExprAtom, SemanticRule, SemanticRuleSideScope } from '../types/atom-expr'
import { collectAtomLeaves } from '../types/atom-expr'
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
import { CapabilityEvidenceIndex } from './capability-evidence-index.service'
import { PerTradeSizingResolver } from './per-trade-sizing-resolver.service'
import { SemanticOrchestrationRegistryService } from './semantic-orchestration-registry.service'
import { ATOM_CONTRACT_REGISTRY } from '../atom-contracts/atom-contract-registry'
import { isBlockingSemanticOpenSlot } from './semantic-open-slot-blocking'
import { validateSemanticExpressionContract } from './strategy-semantic-contracts'
import { readFlatActions, readFlatRisks, readFlatTriggers } from '../types/semantic-state-flat-readers'
import { SemanticRuleProjectionService } from './semantic-rule-projection.service'

type SemanticContractOwnerKind = 'trigger' | 'action' | 'risk' | 'position'
type ExecutableContextField = keyof SemanticState['contextSlots']
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

interface ExecutableContextGateResult {
  state: SemanticState
  hasBlockingSlots: boolean
}

const EXECUTABLE_CONTEXT_QUESTION_HINTS: Record<ExecutableContextField, string> = {
  exchange: '请选择交易所',
  symbol: '请选择交易标的',
  marketType: '请选择市场类型',
  timeframe: '请选择周期',
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
  sourceRuleId?: string
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
  private readonly logger = new Logger(SemanticContractReadinessService.name)

  constructor(
    private readonly semanticAtomContractService: SemanticAtomContractService = new SemanticAtomContractService(),
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly semanticAtomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
    private readonly orchestrationRegistry: SemanticOrchestrationRegistryService = new SemanticOrchestrationRegistryService(),
    // #1186 PR3 (decision 选项 A): multi-leg per_order_budget 判定共用 PR2 落地的 getExecutableLegScopes()
    private readonly sizingResolver: PerTradeSizingResolver = new PerTradeSizingResolver(),
    // #1493 块 D：normalize() 入口跑一次 reproject，把 `flat = pure function of rules` 落成硬不变量。
    private readonly ruleProjection: SemanticRuleProjectionService = new SemanticRuleProjectionService(),
  ) {}

  normalize(
    state: SemanticState,
    strategyVersion?: StrategyVersionInfo,
  ): SemanticContractReadinessNormalizationResult {
    // #1493 块 D：rules 非空时统一从 rules tree 重新投影出 flat 五桶，确保后续
    //   读 flat 等价于读 rules。rules 为空时透传原 state，保留老 fixture 兼容路径。
    //   注意：rules 非空时 ready 由 evaluateRulesReadiness() 决定，flat 8 路 fail-closed
    //   不参与最终判定（见下方 `rulesReady !== null` 分支），但 flat 仍用于
    //   provider-contract / orchestration / missingRequirements 等读路径。
    if (state.rules && state.rules.length > 0) {
      state = this.ruleProjection.reprojectFromRules(state)
    }
    else {
      // Issue #1493 C2：normalize() 入口同样观测 rules 空 + flat 非空 legacy 路径。
      //   生产规约见 types/semantic-state.ts 顶部 docstring。
      const flatNonEmptyCount
        = state.trigger.length
        + state.action.length
        + state.risk.length
        + (state.positionConstraint?.length ?? 0)
        + state.orchestration.length
      if (flatNonEmptyCount > 0) {
        this.logger.warn(
          `[#1493] normalize_rules_missing flatNonEmptyCount=${flatNonEmptyCount}`
          + ` metric=semantic_state_rules_missing_total+=1`,
        )
      }
    }
    const hasRules = Boolean(state.rules && state.rules.length > 0)
    const rulesReadinessForMissing = hasRules
      ? this.evaluateRulesReadiness(state.rules)
      : null
    const flatNonEmptyCountForEmptyRules
      = state.trigger.length
      + state.action.length
      + state.risk.length
      + (state.positionConstraint?.length ?? 0)
      + state.orchestration.length
    const rulesTreeMissingRequirements: MissingSemanticContractRequirement[] = !hasRules && flatNonEmptyCountForEmptyRules === 0
      ? [{
          ownerKind: 'position',
          ownerId: 'rules_tree',
          contractId: 'rules_tree.empty',
          domain: 'state',
          verb: 'define',
          object: 'rules_tree',
          errorCode: 'READINESS_RULES_TREE_EMPTY',
        }]
      : []
    const rulesReadinessMissingRequirements = rulesReadinessForMissing
      ? this.buildRulesReadinessMissingRequirements(rulesReadinessForMissing)
      : []
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
      ...rulesTreeMissingRequirements,
      ...rulesReadinessMissingRequirements,
      ...this.collectMissingRequirements(supportedOwners, resolution.capabilities, state),
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
    const baseNextState: SemanticState = {
      ...state,
      trigger: readFlatTriggers(state).map(trigger =>
        mergeOwnerOpenSlots(trigger, slotsByOwnerKey.get(ownerKey('trigger', trigger.id))),
      ),
      action: readFlatActions(state).map(action =>
        mergeOwnerOpenSlots(action, slotsByOwnerKey.get(ownerKey('action', action.id))),
      ),
      risk: readFlatRisks(state).map(risk =>
        mergeOwnerOpenSlots(risk, slotsByOwnerKey.get(ownerKey('risk', risk.id))),
      ),
      position: mergePositionOpenSlots(state.position, slotsByOwnerKey),
      orchestration: orchestrationResult.state,
    }
    // Phase 5 S2 (#1104): 多 scope 策略对 trigger/action/risk/positionConstraint 加 missing_binding fail-closed
    const { state: afterSymbolBinding, hasBlockingSlots: symbolBindingHasBlockingSlots } =
      applySymbolScopeBindingFailClosed(baseNextState)
    // Phase 5 S11 (#1112): 多 leg 策略对 trigger/action/risk/positionConstraint 加 missing_binding fail-closed
    //   leg binding 第二参 baseNextState 用作 pre-binding 原始 status：避免被 symbol binding 链式降级后误跳过判断
    //   （两条 binding 各自独立 fail-closed，同一 owner 双 ref 缺失会同时落两条 missing_binding open slot）
    const { state: afterLegBinding, hasBlockingSlots: legBindingHasBlockingSlots } =
      applyLegScopeBindingFailClosed(afterSymbolBinding, baseNextState)
    // Phase 5 S3 (#1109): timeframe scope binding fail-closed（≥1 scope.timeframe locked 即强制）
    const timeframeBound = applyTimeframeScopeBindingFailClosed(afterLegBinding)
    // Phase 5 S9 (#1110): 多 dataSource scope 策略 binding fail-closed（dataSourceScopeRef 声明且 ref 不在 supported 集合时降为 open + missing_binding slot）
    const { state: afterDataSourceBinding, hasBlockingSlots: dataSourceBindingHasBlockingSlots } =
      applyDataSourceScopeBindingFailClosed(timeframeBound.state)
    // Phase 5 S10 (#1111): 多 subStrategy 策略对 owner 加 missing_binding fail-closed（与 symbol 平行串联）
    const { state: nextStateBeforeContextGate, hasBlockingSlots: subStrategyBindingHasBlockingSlots } =
      applySubStrategyScopeBindingFailClosed(afterDataSourceBinding)
    const executableContextGate = state.rules && state.rules.length > 0
      ? applyExecutableContextGate(nextStateBeforeContextGate)
      : { state: nextStateBeforeContextGate, hasBlockingSlots: false }
    const nextState = executableContextGate.state

    // Issue #1395 (mute-spider) Stage I.A：state.rules 非空时优先走 rules-tree 判定，
    //   绕过扁平桶 8 路 binding/blocking-owner-open-slots fail-closed（这些信号在
    //   rules-first 形态下与真实结构背离）。仍保留 missingRequirements / orchestration /
    //   provider-shape 校验，因为它们独立于扁平桶 → rules 派生链。
    const rulesReady = rulesReadinessForMissing

    const flatReady
      = unsupportedOrUnknownOwnerKeys.size === 0
      && rulesTreeMissingRequirements.length === 0
      && missingRequirements.length === 0
      && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey)
      && !hasBlockingOwnerOpenSlots(nextState)
      && !orchestrationResult.hasBlockingSlots
      && !symbolBindingHasBlockingSlots
      && !legBindingHasBlockingSlots
      && !timeframeBound.hasBlockingSlots
      && !dataSourceBindingHasBlockingSlots
      && !subStrategyBindingHasBlockingSlots

    const ready = rulesReady !== null
      ? (
          unsupportedOrUnknownOwnerKeys.size === 0
          && missingRequirements.length === 0
          && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey)
          && !orchestrationResult.hasBlockingSlots
          && !executableContextGate.hasBlockingSlots
          && rulesReady.hasEntry
          && rulesReady.hasExit
        )
      : flatReady

    return {
      state: nextState,
      ready,
      missingRequirements,
    }
  }

  private buildRulesReadinessMissingRequirements(
    rulesReady: RulesReadinessSummary,
  ): MissingSemanticContractRequirement[] {
    const requirements: MissingSemanticContractRequirement[] = []

    if (rulesReady.missing.includes('missing_entry')) {
      requirements.push({
        ownerKind: 'position',
        ownerId: 'rules_tree',
        contractId: 'rules_tree.missing_entry',
        domain: 'state',
        verb: 'define',
        object: 'entry_rule',
        errorCode: 'READINESS_RULES_TREE_MISSING_ENTRY',
      })
    }

    if (rulesReady.missing.includes('missing_exit')) {
      requirements.push({
        ownerKind: 'position',
        ownerId: 'rules_tree',
        contractId: 'rules_tree.missing_exit',
        domain: 'state',
        verb: 'define',
        object: 'exit_rule',
        errorCode: 'READINESS_RULES_TREE_MISSING_EXIT',
      })
    }

    return requirements
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
    state: SemanticState,
  ): MissingSemanticContractRequirement[] {
    return activeOwners.flatMap(owner =>
      owner.contracts.flatMap(contract =>
        contract.requires
          .filter(requirement => !this.hasCapability(capabilities, requirement, state, owner))
          .map(requirement => ({
            ownerKind: owner.ownerKind,
            ownerId: owner.ownerId,
            contractId: contract.id,
            domain: requirement.domain,
            verb: requirement.verb,
            object: requirement.object,
            // #1186 PR3: per_order_budget missing 一律带 READINESS_PER_ORDER_BUDGET_MISSING
            // 让上游能区分 multi-leg per-leg 缺 anchor 与 timeframe mismatch 等其他失败模式。
            ...(requirement.domain === 'capital'
              && requirement.verb === 'allocate'
              && requirement.object === 'per_order_budget'
              ? { errorCode: 'READINESS_PER_ORDER_BUDGET_MISSING' }
              : {}),
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
    const multiTimeframeTriggerRuleIds = collectMultiTimeframeTriggerRuleIds(activeOwners)

    for (const owner of activeOwners) {
      if (isTimeframeOverride(owner.params)) {
        continue
      }

      const declared = readDeclaredTimeframe(owner)
      if (!declared || declared === consumerTimeframe) {
        continue
      }
      if (isExplicitMultiTimeframeTriggerMember(owner, multiTimeframeTriggerRuleIds)) {
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
    state: SemanticState,
    owner: SemanticContractOwnerRef,
  ): boolean {
    if (isDcaExitRuleRequirement(requirement) && hasRulesTreeExplicitExitSemantics(state.rules, owner)) {
      return true
    }

    // PR3.4: use CapabilityEvidenceIndex for per_order_budget to unify evidence scanning
    // Q1 fix: filter to locked owners — unsupported/open atoms must not count as satisfied evidence
    if (requirement.domain === 'capital' && requirement.verb === 'allocate' && requirement.object === 'per_order_budget') {
      const evidences = CapabilityEvidenceIndex.build(state)
        .byKey('capital', 'allocate', 'per_order_budget')
        .filter(e => e.ownerStatus === 'locked')
      // #1186 PR3 (decision 选项 A): multi-leg 路径 per-leg anchored gating —
      // 每条 executable leg 各自需有 anchored evidence 才算满足。executable_legs 来源
      // 统一调 PR2 已 land 的 PerTradeSizingResolver.getExecutableLegScopes()（critic C3：
      // 禁止独立计算）。单仓路径保留原 some 语义、行为零变更。
      if (state.isMultiLeg === true) {
        const executableScopes = this.sizingResolver.getExecutableLegScopes(state)
        if (executableScopes.length < 2) return false
        const validAnchored = evidences.filter(
          e => this.hasRequiredCapabilityShape(e.capability, requirement),
        ).length
        return validAnchored === executableScopes.length
      }
      return evidences.some(e => this.hasRequiredCapabilityShape(e.capability, requirement))
    }
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
      const registryKey = owner.atomKey === ATOM_CONTRACT_REGISTRY['indicator.above'].key ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
      return {
        ...this.semanticAtomRegistry.get(registryKey),
        key: owner.atomKey,
      }
    }

    return this.semanticAtomRegistry.resolve(owner.atomKey)
  }

  /**
   * Issue #1395 — Rules-tree 优先的 readiness 判定。
   *
   * 旧路径只看 flat trigger/action/risk 桶，导致：
   * - grid 策略的 `grid.range_rebalance` 自洽闭环被误判缺 entry/exit；
   * - sequence/AND/OR 根节点产出 effects 但扁平桶被 fail-closed 砍光时误报缺 entry；
   * - 多轮编辑后 rules[] 真实结构与扁平投影背离。
   *
   * 本方法**只**对 SemanticRule[] 做判定，不依赖 flat 桶；调用方在 rules 为空时回退到旧路径。
   *
   * 判定口径：
   * - hasEntry: 存在 phase ∈ {entry, gate} 且 effects 含 action.open_long/open_short，
   *   或 condition 子树中含 grid.range_rebalance（grid 自洽视为入场闭环）；
   * - hasExit: 存在 phase = exit 且 effects 含 action.close_*；
   *   或 condition/effects 中含 grid.range_rebalance 且 breakoutAction ∈ {stop, pause}（grid 越界停止视作出场语义）；
   *   或任意 rule 含 grid.range_rebalance（rangeRebalance 即自带循环出场语义）；
   * - hasRisk: effects 中出现 risk.* atom（含 stop_loss_pct / take_profit_pct / atr_stop / atr_take_profit / partial_take_profit）；
   *   或任意 rule 含 grid.range_rebalance（grid range_rebalance 自带越界风控约束）。风险语义用于报告，不作为
   *   rules tree readiness 硬阻断；是否追问风险由 clarification 层按闭环出场语义决定。
   * - hasPosition: effects 中出现 grid.range_rebalance 或 position-domain atom（key 前缀 `position.` / `sizing.`）。
   */
  evaluateRulesReadiness(rules: readonly SemanticRule[] | undefined): RulesReadinessSummary {
    const summary: RulesReadinessSummary = {
      hasEntry: false,
      hasExit: false,
      hasRisk: false,
      hasPosition: false,
      missing: [],
    }

    if (!rules || rules.length === 0) {
      summary.missing.push('rules_empty')
      return summary
    }

    let sawGridRangeRebalance = false
    let sawGridStopBreakout = false

    for (const rule of rules) {
      const condLeaves = collectAtomLeavesSafe(rule.condition)
      const effectLeaves = rule.effects.flatMap(collectAtomLeavesSafe)
      const allLeaves = [...condLeaves, ...effectLeaves]

      // eslint-disable-next-line atom-keys/no-atom-key-literal -- Issue #1395 rules-tree readiness 必须直接匹配 grid.range_rebalance 自洽闭环语义，registry bucket(=positionConstraint) 不足以区分。
      const gridLeaf = allLeaves.find(leaf => leaf.key === 'grid.range_rebalance')
      if (gridLeaf) {
        sawGridRangeRebalance = true
        const breakoutAction = gridLeaf.params?.breakoutAction
        if (breakoutAction === 'stop' || breakoutAction === 'pause') {
          sawGridStopBreakout = true
        }
      }

      const effectKeys = new Set(effectLeaves.map(l => l.key))
      const fulfillsPhase = (leaf: AtomExprAtom, phase: 'entry' | 'exit'): boolean => {
        const contract = ATOM_CONTRACT_REGISTRY[leaf.key as keyof typeof ATOM_CONTRACT_REGISTRY]
        return contract?.fulfillsStrategyPhase?.includes(phase) === true
      }
      const entryCapableEffect = effectLeaves.some(leaf => fulfillsPhase(leaf, 'entry'))
      const exitCapableEffect = effectLeaves.some(leaf => fulfillsPhase(leaf, 'exit'))
      const exitCapableRiskEffect = effectLeaves.some((leaf) => {
        if (!leaf.key.startsWith('risk.')) return false
        return fulfillsPhase(leaf, 'exit')
      })

      if (rule.phase === 'entry' || rule.phase === 'gate') {
        if (effectKeys.has('action.open_long') || effectKeys.has('action.open_short') || entryCapableEffect) {
          summary.hasEntry = true
        }
        if (exitCapableRiskEffect) {
          summary.hasExit = true
        }
      }
      if (rule.phase === 'exit') {
        if (effectKeys.has('action.close_long') || effectKeys.has('action.close_short') || exitCapableEffect) {
          summary.hasExit = true
        }
      }

      for (const key of effectKeys) {
        if (key.startsWith('risk.')) summary.hasRisk = true
        // eslint-disable-next-line atom-keys/no-atom-key-literal -- Issue #1395 rules-tree readiness 直接匹配 grid.range_rebalance（自洽闭环 position 信号），见上方同类豁免。
        if (key === 'grid.range_rebalance' || key.startsWith('position.') || key.startsWith('sizing.')) {
          summary.hasPosition = true
        }
      }
    }

    // grid 自洽闭环：range_rebalance 同时承担 entry + exit 语义
    if (sawGridRangeRebalance) {
      summary.hasEntry = true
      summary.hasExit = true
      summary.hasRisk = true // 越界 breakoutAction 自带风控
      summary.hasPosition = true
    }
    // 显式 grid stop/pause：再强化 exit 信号（用于未来扩展）
    if (sawGridStopBreakout) summary.hasExit = true

    if (!summary.hasEntry) summary.missing.push('missing_entry')
    if (!summary.hasExit) summary.missing.push('missing_exit')

    return summary
  }
}

export interface RulesReadinessSummary {
  hasEntry: boolean
  hasExit: boolean
  hasRisk: boolean
  hasPosition: boolean
  missing: string[]
}

function collectAtomLeavesSafe(expr: AtomExpr | undefined): AtomExprAtom[] {
  if (!expr) return []
  try {
    return collectAtomLeaves(expr)
  }
  catch {
    return []
  }
}

function isDcaExitRuleRequirement(requirement: SemanticRequirement): boolean {
  return requirement.domain === 'guard'
    && requirement.verb === 'define'
    && requirement.object === 'dca_exit_rule'
}

function hasRulesTreeExplicitExitSemantics(
  rules: readonly SemanticRule[] | undefined,
  owner: SemanticContractOwnerRef,
): boolean {
  if (!rules || rules.length === 0) return false
  const dcaSideScopes = findDcaOwnerSideScopes(rules, owner)
  if (dcaSideScopes.length === 0) return false

  for (const rule of rules) {
    const effectLeaves = rule.effects.flatMap(collectAtomLeavesSafe)
    if (
      rule.phase === 'exit'
      && dcaSideScopes.some(sideScope => isCompatibleDcaExitRule(rule, sideScope, effectLeaves))
    ) {
      return true
    }
    if (
      (rule.phase === 'entry' || rule.phase === 'gate')
      && dcaSideScopes.some(sideScope => isCompatibleDcaExitRule(rule, sideScope, effectLeaves))
    ) {
      return true
    }
  }

  return false
}

function findDcaOwnerSideScopes(
  rules: readonly SemanticRule[],
  owner: SemanticContractOwnerRef,
): SemanticRuleSideScope[] {
  const sideScopes = new Set<SemanticRuleSideScope>()
  let matchedRuleCount = 0
  for (const rule of rules) {
    if (owner.sourceRuleId && rule.id !== owner.sourceRuleId) continue
    const effectLeaves = rule.effects.flatMap(collectAtomLeavesSafe)
    if (effectLeaves.some(leaf => leaf.key === owner.atomKey)) {
      matchedRuleCount += 1
      sideScopes.add(rule.sideScope)
    }
  }
  if (!owner.sourceRuleId && matchedRuleCount > 1) return []
  return [...sideScopes]
}

function isCompatibleDcaExitRule(
  rule: SemanticRule,
  dcaSideScope: SemanticRuleSideScope,
  effectLeaves: readonly AtomExprAtom[],
): boolean {
  if (!sideScopesOverlap(rule.sideScope, dcaSideScope)) return false
  return effectLeaves.some(leaf => isExitCapableAtomForSide(leaf, dcaSideScope))
}

function sideScopesOverlap(a: SemanticRuleSideScope, b: SemanticRuleSideScope): boolean {
  return a === 'both' || b === 'both' || a === b
}

function isExitCapableAtomForSide(leaf: AtomExprAtom, sideScope: SemanticRuleSideScope): boolean {
  if (sideScope === 'long') {
    return leaf.key === 'action.close_long'
      || (leaf.key !== 'action.close_short' && leaf.key.startsWith('risk.') && isExitCapableAtom(leaf))
  }
  if (sideScope === 'short') {
    return leaf.key === 'action.close_short'
      || (leaf.key !== 'action.close_long' && leaf.key.startsWith('risk.') && isExitCapableAtom(leaf))
  }
  return isExitCapableAtom(leaf)
}

function isExitCapableAtom(leaf: AtomExprAtom): boolean {
  if (leaf.key === 'action.close_long' || leaf.key === 'action.close_short') {
    return true
  }
  const contract = ATOM_CONTRACT_REGISTRY[leaf.key as keyof typeof ATOM_CONTRACT_REGISTRY]
  return contract?.fulfillsStrategyPhase?.includes('exit') === true
}

function applyExecutableContextGate(state: SemanticState): ExecutableContextGateResult {
  const contextSlots = { ...state.contextSlots }
  let changed = false

  for (const field of ['exchange', 'symbol', 'marketType', 'timeframe'] as const) {
    if (contextSlots[field]) continue
    contextSlots[field] = {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: null,
      status: 'open',
      priority: 'context',
      questionHint: EXECUTABLE_CONTEXT_QUESTION_HINTS[field],
      affectsExecution: true,
    }
    changed = true
  }

  const nextState = changed ? { ...state, contextSlots } : state
  return {
    state: nextState,
    hasBlockingSlots: Object.values(nextState.contextSlots).some(slot =>
      slot ? isBlockingSemanticOpenSlot(slot) : false,
    ),
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

  // Phase 5 S11 (#1112): 多 pass readiness 解决 cross-node 反向引用顺序依赖
  //   Pass 1: scope.symbol 节点先收敛 status（leg.instrumentRef 校验依赖）
  //   Pass 2: scope.leg 节点首轮（instrumentRef 见 Pass 1 状态）
  //   Pass 3: scope.leg 节点二轮（pairedLegId 见 Pass 2 leg 状态）
  //   Pass 4: gate/program/portfolioRisk 维持 S2 原 single-pass 行为
  const initialNodes = orchestration
  /* eslint-disable atom-keys/no-atom-key-literal -- scope.leg / scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
  const isLegScopeNode = (n: SemanticOrchestrationNode): boolean =>
    n.kind === 'scope' && (n.key === 'scope.leg' || n.legScopeKind === 'leg')
  const isSymbolScopeNode = (n: SemanticOrchestrationNode): boolean =>
    n.kind === 'scope' && n.key === 'scope.symbol' && !isLegScopeNode(n)
  /* eslint-enable atom-keys/no-atom-key-literal */

  const afterSymbol = initialNodes.map((node) =>
    isSymbolScopeNode(node)
      ? applyOrchestrationReadinessForNode(node, registry, strategyVersion, initialNodes)
      : node,
  )
  const afterLegPass1 = afterSymbol.map((node) =>
    isLegScopeNode(node)
      ? applyOrchestrationReadinessForNode(node, registry, strategyVersion, afterSymbol)
      : node,
  )
  const afterLegPass2 = afterLegPass1.map((node) =>
    isLegScopeNode(node)
      ? applyOrchestrationReadinessForNode(node, registry, strategyVersion, afterLegPass1)
      : node,
  )
  const finalNodes = afterLegPass2.map((node) => {
    // scope.symbol 与 scope.leg 已在前 passes 收敛，跳过；
    // 其它（含 scope.timeframe、scope.dataSource、未支持 scope kinds、gate/program/portfolioRisk）走最后 pass。
    if (isSymbolScopeNode(node) || isLegScopeNode(node)) return node
    return applyOrchestrationReadinessForNode(node, registry, strategyVersion, afterLegPass2)
  })

  let changed = false
  let hasBlockingSlots = false
  for (let i = 0; i < initialNodes.length; i += 1) {
    if (finalNodes[i] !== initialNodes[i]) changed = true
    if (ownerHasOpenSlot(finalNodes[i])) hasBlockingSlots = true
  }

  return {
    state: changed ? finalNodes : orchestration,
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

  // Phase 5 S8 (#1119): symbol/subStrategy exposure cap 路径
  if (isSupportedPortfolioSymbolExposureCap(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  if (isSupportedPortfolioSubStrategyExposureCap(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  if (isSupportedFixedGridGated(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  if (isSupportedDynamicGrid(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  if (isSupportedAdaptiveVolatilityGrid(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  // Phase 5 S12 (#1118): event_listener
  if (isSupportedEventListener(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry)
  }

  if (isSupportedSymbolScope(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  if (isSupportedLegScope(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  if (isSupportedTimeframeScope(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  if (isSupportedDataSourceScope(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  // Phase 5 S10 (#1111): scope.subStrategy 路径
  if (isSupportedSubStrategyScope(node, registry, strategyVersion, siblingNodes)) {
    return applyRegistryDrivenReadiness(node, registry, siblingNodes)
  }

  return addPhase0OrchestrationBlocker(node)
}

/**
 * Phase 5 S2 (#1104): scope.symbol 节点 6 重 fail-closed:
 *   1) kind === 'scope'
 *   2) key === 'scope.symbol'
 *   3) symbolScopeKind === 'symbol'
 *   4) symbols 非空 + 去重 + 每项匹配 ^[A-Z]{2,5}USDT$
 *   5) primarySymbol 若提供 ∈ symbols；与其它 supported scope 间 symbols 不重叠 + primarySymbol 不冲突
 *   6) version-gate：registry 已注册 + strategyVersion 存在 + atom 对该策略可执行
 */
function isSupportedSymbolScope(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'scope') return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'scope.symbol') return false
  if (node.symbolScopeKind !== 'symbol') return false

  const symbols = node.symbols
  if (!Array.isArray(symbols) || symbols.length === 0) return false

  const SYMBOL_FORMAT = /^[A-Z]{2,5}USDT$/u
  const trimmed: string[] = []
  for (const raw of symbols) {
    if (typeof raw !== 'string') return false
    const t = raw.trim()
    if (t.length === 0 || t.length > 32 || !SYMBOL_FORMAT.test(t)) return false
    trimmed.push(t)
  }
  const dedupedSet = new Set(trimmed)
  if (dedupedSet.size !== trimmed.length) return false

  if (node.primarySymbol !== undefined) {
    const primary = typeof node.primarySymbol === 'string' ? node.primarySymbol.trim() : ''
    if (primary === '' || !dedupedSet.has(primary)) return false
  }

  // (5) 与其它 status='locked' 且 key='scope.symbol' 节点对比 — symbols 不重叠 + primarySymbol 不冲突
  const otherLockedScopes = siblingNodes.filter(
    (other) =>
      other.id !== node.id
      && other.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && other.key === 'scope.symbol'
      && other.status === 'locked',
  )
  for (const other of otherLockedScopes) {
    const otherSymbols = Array.isArray(other.symbols) ? other.symbols : []
    if (otherSymbols.some((s) => typeof s === 'string' && dedupedSet.has(s.trim()))) {
      return false
    }
  }
  const myPrimary = typeof node.primarySymbol === 'string' ? node.primarySymbol.trim() : ''
  if (myPrimary !== '') {
    if (
      otherLockedScopes.some(
        (other) => typeof other.primarySymbol === 'string' && other.primarySymbol.trim() === myPrimary,
      )
    ) {
      return false
    }
  }

  const contract = registry.getContractByKey('scope.symbol')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * Phase 5 S11 (#1112): scope.leg 节点 8 重 fail-closed:
 *   1) kind === 'scope'
 *   2) key === 'scope.leg'
 *   3) legScopeKind === 'leg'（且与 symbolScopeKind='symbol' 互斥）
 *   4) legId 非空、匹配 ^[a-zA-Z][a-zA-Z0-9_.]{0,63}$、与同 state 其它 leg 节点 legId 不重复
 *   5) direction ∈ {'long','short'}
 *   6) instrumentRef trim 非空、引用同 state 中 status:'locked' 的 scope.symbol 节点 id
 *   7) legSizing 缺失允许；若提供：mode 合法 + value > 0；mode='fixed_ratio' 时 pairedLegId 非空、引用 supported leg 的 legId、且 direction 互反
 *   8) version-gate（registry 已注册 + strategyVersion 存在 + atom 对该策略可执行）
 */
const LEG_ID_PATTERN_READINESS = /^[a-zA-Z][a-zA-Z0-9_.]{0,63}$/u

function isSupportedLegScope(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'scope') return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.leg node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'scope.leg') return false
  if (node.legScopeKind !== 'leg') return false
  if (node.symbolScopeKind === 'symbol') return false  // 互斥

  const legId = typeof node.legId === 'string' ? node.legId.trim() : ''
  if (legId === '' || !LEG_ID_PATTERN_READINESS.test(legId)) return false
  if (node.direction !== 'long' && node.direction !== 'short') return false

  const instrumentRef = typeof node.instrumentRef === 'string' ? node.instrumentRef.trim() : ''
  if (instrumentRef === '') return false
  const referenced = siblingNodes.find((n) => n.id === instrumentRef)
  if (
    !referenced
    || referenced.kind !== 'scope'
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    || referenced.key !== 'scope.symbol'
    || referenced.status !== 'locked'
  ) {
    return false
  }

  // legId 在 leg 子集内唯一
  const otherLegNodes = siblingNodes.filter(
    (other) =>
      other.id !== node.id
      && other.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.leg node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && other.key === 'scope.leg',
  )
  if (otherLegNodes.some((other) => typeof other.legId === 'string' && other.legId.trim() === legId)) {
    return false
  }

  // legSizing
  const sizing = node.legSizing
  if (sizing !== undefined) {
    if (sizing.mode !== 'fixed_pct' && sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_ratio') return false
    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return false
    if (sizing.mode === 'fixed_ratio') {
      const paired = typeof sizing.pairedLegId === 'string' ? sizing.pairedLegId.trim() : ''
      if (paired === '' || paired === legId) return false
      const pairedNode = otherLegNodes.find(
        (other) => typeof other.legId === 'string' && other.legId.trim() === paired,
      )
      if (!pairedNode) return false
      if (pairedNode.status !== 'locked') return false
      if (pairedNode.direction === undefined || pairedNode.direction === node.direction) return false
    }
  }

  const contract = registry.getContractByKey('scope.leg')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * Phase 5 S9 (#1110): scope.dataSource 节点 9 重 fail-closed:
 *   1) kind === 'scope'
 *   2) key === 'scope.dataSource'
 *   3) dataSourceScopeKind === 'dataSource'
 *   4) dataSourceRole ∈ {primary, confirmation, event}
 *   5) dataSourceFeedId trim 非空 + 长度 ≤ 64 + 匹配 ^[a-z0-9][a-z0-9_.-]{0,63}$
 *   6) dataSourceSchemaRef ∈ {ohlcv, orderbook, liquidation, webhook_event}（所有 role 必填）
 *   7) cross-node：feedId 与其它 supported scope.dataSource 不重复 + role='primary' 全局唯一
 *   8) registry 已注册 scope.dataSource contract
 *   9) version-gate：strategyVersion 存在 + atom 对该策略可执行
 */
function isSupportedDataSourceScope(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'scope') return false
  if (node.key !== 'scope.dataSource') return false
  if (node.dataSourceScopeKind !== 'dataSource') return false

  const role = node.dataSourceRole
  if (role !== 'primary' && role !== 'confirmation' && role !== 'event') return false

  const FEED_ID_FORMAT = /^[a-z0-9][a-z0-9_.-]{0,63}$/u
  const feedIdRaw = node.dataSourceFeedId
  if (typeof feedIdRaw !== 'string') return false
  const feedId = feedIdRaw.trim()
  if (feedId === '' || feedId.length > 64 || !FEED_ID_FORMAT.test(feedId)) return false

  const schemaRef = node.dataSourceSchemaRef
  if (schemaRef !== 'ohlcv' && schemaRef !== 'orderbook' && schemaRef !== 'liquidation' && schemaRef !== 'webhook_event') return false

  // (7) 与其它 status='locked' 且 key='scope.dataSource' 节点对比 — feedId 不重复 + role='primary' 全局唯一
  const otherLockedScopes = siblingNodes.filter(
    (other) =>
      other.id !== node.id
      && other.kind === 'scope'
      && other.key === 'scope.dataSource'
      && other.status === 'locked',
  )
  for (const other of otherLockedScopes) {
    if (typeof other.dataSourceFeedId === 'string' && other.dataSourceFeedId.trim() === feedId) {
      return false
    }
  }
  if (role === 'primary') {
    if (otherLockedScopes.some((other) => other.dataSourceRole === 'primary')) {
      return false
    }
  }

  const contract = registry.getContractByKey('scope.dataSource')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * Phase 5 S10 (#1111): scope.subStrategy 节点 6 重 fail-closed:
 *   1) kind === 'scope'
 *   2) key === 'scope.subStrategy'
 *   3) subStrategyScopeKind === 'subStrategy'
 *   4) subStrategyId 非空 trim 后长度 ∈ [1, 64]
 *   5) positionHandlingOnDeactivate ∈ {close,keep} + orderHandlingOnDeactivate ∈ {cancel,keep}
 *      + 与其它 supported scope.subStrategy subStrategyId 不冲突
 *   6) version-gate：registry 已注册 + strategyVersion 存在 + atom 对该策略可执行
 */
function isSupportedSubStrategyScope(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'scope') return false
  if (node.key !== 'scope.subStrategy') return false
  if (node.subStrategyScopeKind !== 'subStrategy') return false

  const idRaw = node.subStrategyId
  const trimmedId = typeof idRaw === 'string' ? idRaw.trim() : ''
  if (trimmedId === '' || trimmedId.length > 64) return false

  if (node.positionHandlingOnDeactivate !== 'close' && node.positionHandlingOnDeactivate !== 'keep') return false
  if (node.orderHandlingOnDeactivate !== 'cancel' && node.orderHandlingOnDeactivate !== 'keep') return false

  // (5) 与其它 status='locked' key='scope.subStrategy' 节点 subStrategyId 不冲突
  const otherLocked = siblingNodes.filter(
    (other) =>
      other.id !== node.id
      && other.kind === 'scope'
      && other.key === 'scope.subStrategy'
      && other.status === 'locked',
  )
  if (
    otherLocked.some(
      (other) => typeof other.subStrategyId === 'string' && other.subStrategyId.trim() === trimmedId,
    )
  ) {
    return false
  }

  const contract = registry.getContractByKey('scope.subStrategy')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
}

function isProgramNode(
  node: SemanticOrchestrationNode,
): node is SemanticOrchestrationNode & { kind: 'program' } {
  return node.kind === 'program'
}

/**
 * Phase 5 S3 (#1109): scope.timeframe 节点 9 重 fail-closed:
 *   1) kind === 'scope'
 *   2) key === 'scope.timeframe'
 *   3) timeframeScopeKind === 'timeframe'
 *   4) primaryTimeframe 合法（命中 vocab）
 *   5) requiredTimeframes 非空数组 + 长度 ∈ [1,8] + 每项命中 vocab + 去重 + 不含 primary
 *   6) primary 粒度严格细于所有 required（critic Round 2 C2-R2）
 *   7) alignmentPolicy ∈ {'strict','tolerant'}
 *   8) 与其它 locked sibling (primary, sortedRequired) 不重复
 *   9) registry contract 存在 + version-gate（strategyVersion ≠ undefined + isExecutableForStrategy）
 */
function isSupportedTimeframeScope(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (node.kind !== 'scope') return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.timeframe node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'scope.timeframe') return false
  if (node.timeframeScopeKind !== 'timeframe') return false

  const primaryMs = parseTimeframeMs(node.primaryTimeframe)
  if (primaryMs === null) return false

  const required = node.requiredTimeframes
  if (!Array.isArray(required) || required.length < 1 || required.length > 8) return false

  const requiredMsList: number[] = []
  const dedupedRequired = new Set<string>()
  for (const tf of required) {
    if (typeof tf !== 'string') return false
    const ms = parseTimeframeMs(tf)
    if (ms === null) return false
    if (dedupedRequired.has(tf)) return false
    dedupedRequired.add(tf)
    requiredMsList.push(ms)
  }
  if (typeof node.primaryTimeframe !== 'string') return false
  if (dedupedRequired.has(node.primaryTimeframe)) return false

  // primary 粒度严格细于所有 required
  if (primaryMs >= Math.min(...requiredMsList)) return false

  if (node.alignmentPolicy !== 'strict' && node.alignmentPolicy !== 'tolerant') return false

  // 与其它 locked sibling 不重复
  const otherLockedScopes = siblingNodes.filter(
    (other) =>
      other.id !== node.id
      && other.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.timeframe node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && other.key === 'scope.timeframe'
      && other.status === 'locked',
  )
  const myKey = JSON.stringify([node.primaryTimeframe, [...required].sort()])
  for (const other of otherLockedScopes) {
    if (typeof other.primaryTimeframe !== 'string' || !Array.isArray(other.requiredTimeframes)) continue
    const otherKey = JSON.stringify([other.primaryTimeframe, [...other.requiredTimeframes].sort()])
    if (otherKey === myKey) return false
  }

  const contract = registry.getContractByKey('scope.timeframe')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
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
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- program.fixed_grid_gated node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
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
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- gate.regime node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
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
 * 判断 program.dynamic_grid node 是否可走 registry 驱动的 readiness 路径。
 *
 * 15 重 fail-closed 检查（Phase 5 S5，#984，critic v3 锁定）：
 * 1) kind === 'program'
 * 2) key === 'program.dynamic_grid'
 * 3) programKind === 'dynamic_grid'
 * 4) onDeactivate ∈ {'cancel','keep','close'}
 * 5) rebuildPolicy === 'anchor_on_state_change'
 * 6) anchorLookbackBars 整数 ∈ [10, 1000]
 * 7) anchorSide ∈ {'high','low','mid'}
 * 8) dynamicGridStep.mode ∈ {'pct','absolute'}，dynamicGridStep.value 是有限正数
 * 9) levelCount 整数 ∈ [2, 100]
 * 10) anchorDriftPct ∈ (0, 100] 有限数
 * 11) rebuildMinIntervalSec 整数 ≥ 60（硬下限拒绝刷单）
 * 12) sizing.mode ∈ {'fixed_quote','fixed_base','fixed_pct'}
 * 13) sizing.value 是有限正数
 * 14) cross-node：activeWhenRef 必须引用 status:'locked' 且 readiness supported 的 gate.regime 节点
 * 15) version-gate：strategyVersion 必须存在且 atom 对该策略可执行
 */
function isSupportedDynamicGrid(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (!isProgramNode(node)) {
    return false
  }
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- program.dynamic_grid node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'program.dynamic_grid') {
    return false
  }
  if (node.programKind !== 'dynamic_grid') {
    return false
  }
  if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') {
    return false
  }
  if (node.rebuildPolicy !== 'anchor_on_state_change') {
    return false
  }

  const lookback = node.anchorLookbackBars
  if (
    typeof lookback !== 'number'
    || !Number.isFinite(lookback)
    || !Number.isInteger(lookback)
    || lookback < 10
    || lookback > 1000
  ) {
    return false
  }

  if (node.anchorSide !== 'high' && node.anchorSide !== 'low' && node.anchorSide !== 'mid') {
    return false
  }

  const step = node.dynamicGridStep
  if (!step) {
    return false
  }
  if (step.mode !== 'pct' && step.mode !== 'absolute') {
    return false
  }
  if (typeof step.value !== 'number' || !Number.isFinite(step.value) || step.value <= 0) {
    return false
  }

  const levelCount = node.levelCount
  if (
    typeof levelCount !== 'number'
    || !Number.isFinite(levelCount)
    || !Number.isInteger(levelCount)
    || levelCount < 2
    || levelCount > 100
  ) {
    return false
  }

  const driftPct = node.anchorDriftPct
  if (
    typeof driftPct !== 'number'
    || !Number.isFinite(driftPct)
    || driftPct <= 0
    || driftPct > 100
  ) {
    return false
  }

  const minInterval = node.rebuildMinIntervalSec
  if (
    typeof minInterval !== 'number'
    || !Number.isFinite(minInterval)
    || !Number.isInteger(minInterval)
    || minInterval < 60
  ) {
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

  const contract = registry.getContractByKey('program.dynamic_grid')
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
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- gate.regime node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
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
 * Phase 5 S6 (#984): 判断 program.adaptive_volatility_grid node 是否可走 registry
 * 驱动的 readiness 路径。
 *
 * 16 重 fail-closed 检查（plan v3 Acceptance 章节）：
 * 1) kind === 'program'
 * 2) key === 'program.adaptive_volatility_grid'
 * 3) programKind === 'adaptive_volatility_grid'
 * 4) onDeactivate ∈ {'cancel','keep','close'}
 * 5) rebuildPolicy === 'atr_window'
 * 6) atrPeriod 整数 ∈ [2, 200]
 * 7) atrMultiplier > 0 finite
 * 8) rangeMultiplier > 0 finite
 * 9) atrDriftPct ∈ (0, 100] finite
 * 10) rebuildCooldownSec 整数 ≥ 300（硬下限；与 S5 60s 区分）
 * 11) minStepPct > 0 finite
 * 12) maxStepPct > 0 finite
 * 13) maxStepPct >= minStepPct（配置矛盾拒绝）
 * 14) levelCount 整数 ∈ [2, 100]
 * 15) sizing.mode 合法 enum + sizing.value > 0 finite
 * 16) activeWhenRef cross-node check + 双 version-gate
 */
function isSupportedAdaptiveVolatilityGrid(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (!isProgramNode(node)) return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- program.adaptive_volatility_grid node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'program.adaptive_volatility_grid') return false
  if (node.programKind !== 'adaptive_volatility_grid') return false
  if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep' && node.onDeactivate !== 'close') return false
  if (node.rebuildPolicy !== 'atr_window') return false

  const isPositiveFinite = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0
  const isPositiveInteger = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v > 0

  if (!isPositiveInteger(node.atrPeriod) || node.atrPeriod < 2 || node.atrPeriod > 200) return false
  if (!isPositiveFinite(node.atrMultiplier)) return false
  if (!isPositiveFinite(node.rangeMultiplier)) return false
  if (
    typeof node.atrDriftPct !== 'number'
    || !Number.isFinite(node.atrDriftPct)
    || node.atrDriftPct <= 0
    || node.atrDriftPct > 100
  ) {
    return false
  }
  // Phase 5 S6 risk delta — 硬下限 300（与 S5 dynamic_grid 60s 区分；ATR 是
  // 滑动窗口统计量，需更长 cooldown 反映其平滑特性）
  if (!isPositiveInteger(node.rebuildCooldownSec) || node.rebuildCooldownSec < 300) return false
  if (!isPositiveFinite(node.minStepPct)) return false
  if (!isPositiveFinite(node.maxStepPct)) return false
  if (node.maxStepPct < node.minStepPct) return false
  if (
    typeof node.levelCount !== 'number'
    || !Number.isFinite(node.levelCount)
    || !Number.isInteger(node.levelCount)
    || node.levelCount < 2
    || node.levelCount > 100
  ) {
    return false
  }

  const sizing = node.sizing
  if (!sizing) return false
  if (sizing.mode !== 'fixed_quote' && sizing.mode !== 'fixed_base' && sizing.mode !== 'fixed_pct') return false
  if (!isPositiveFinite(sizing.value)) return false

  if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') return false
  const referenced = siblingNodes.find(n => n.id === node.activeWhenRef)
  if (!referenced) return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- gate.regime node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (referenced.kind !== 'gate' || referenced.key !== 'gate.regime') return false
  if (referenced.status !== 'locked') return false
  if (!isSupportedRegimeGate(referenced, registry, strategyVersion, siblingNodes)) return false

  const contract = registry.getContractByKey('program.adaptive_volatility_grid')
  if (!contract) return false
  if (!strategyVersion) return false
  return registry.isExecutableForStrategy(contract, strategyVersion)
}

/**
 * Phase 5 S12 (#1118): 判断 program.event_listener node 是否可走 registry 驱动的 readiness 路径。
 *
 * 16 重 fail-closed 检查：
 * 1) kind === 'program'
 * 2) key === 'program.event_listener'
 * 3) programKind === 'event_listener'
 * 4) onDeactivate ∈ {'cancel','keep'}（fail-closed 拒收 'close'）
 * 5) rebuildPolicy ∈ {'static','on_schema_version_bump'}
 * 6) eventSchemaRef === 'webhook_event'
 * 7) permissionScope 匹配 EVENT_LISTENER_PERMISSION_SCOPE_PATTERN
 * 8) idempotencyKey.fieldPath 匹配 EVENT_LISTENER_FIELD_PATH_PATTERN（仅 0-1 层 `.`）
 * 9) dedupWindowMs 整数 ∈ [100, 3600000]
 * 10) expirationTtlMs 整数 ∈ [100, 86400000]
 * 11) expirationTtlMs > dedupWindowMs（严格大于）
 * 12) expirationPolicy ∈ {'drop','escalate'}
 * 13) cross-node sourceRef 检查：trim 非空 + 引用 status='locked' + key='scope.dataSource' + role='event' 的节点 + 通过 isSupportedDataSourceScope
 * 14) cross-node activeWhenRef 检查：与 S4/S5/S6 同模式（gate.regime locked + 通过 isSupportedRegimeGate）
 * 15) registry.getContractByKey('program.event_listener') 不为 null
 * 16) version-gate：strategyVersion 存在 + atom 对该策略可执行
 */
const EVENT_LISTENER_PERMISSION_SCOPE_PATTERN_READINESS = /^[a-z][a-z0-9_:]{2,63}$/u
const EVENT_LISTENER_FIELD_PATH_PATTERN_READINESS = /^[a-zA-Z][a-zA-Z0-9_]{0,63}(\.[a-zA-Z][a-zA-Z0-9_]{0,63})?$/u

function isSupportedEventListener(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  if (!isProgramNode(node)) return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- program.event_listener node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (node.key !== 'program.event_listener') return false
  if (node.programKind !== 'event_listener') return false
  if (node.onDeactivate !== 'cancel' && node.onDeactivate !== 'keep') return false
  if (node.rebuildPolicy !== 'static' && node.rebuildPolicy !== 'on_schema_version_bump') return false
  if (node.eventSchemaRef !== 'webhook_event') return false

  const permissionScope = typeof node.permissionScope === 'string' ? node.permissionScope.trim() : ''
  if (permissionScope === '' || !EVENT_LISTENER_PERMISSION_SCOPE_PATTERN_READINESS.test(permissionScope)) return false

  const idempotency = node.idempotencyKey
  const fieldPath = idempotency && typeof idempotency.fieldPath === 'string' ? idempotency.fieldPath.trim() : ''
  if (fieldPath === '' || !EVENT_LISTENER_FIELD_PATH_PATTERN_READINESS.test(fieldPath)) return false

  const dedupWindowMs = node.dedupWindowMs
  if (
    typeof dedupWindowMs !== 'number'
    || !Number.isFinite(dedupWindowMs)
    || !Number.isInteger(dedupWindowMs)
    || dedupWindowMs < 100
    || dedupWindowMs > 3_600_000
  ) {
    return false
  }

  const expirationTtlMs = node.expirationTtlMs
  if (
    typeof expirationTtlMs !== 'number'
    || !Number.isFinite(expirationTtlMs)
    || !Number.isInteger(expirationTtlMs)
    || expirationTtlMs < 100
    || expirationTtlMs > 86_400_000
  ) {
    return false
  }
  if (expirationTtlMs <= dedupWindowMs) return false

  if (node.expirationPolicy !== 'drop' && node.expirationPolicy !== 'escalate') return false

  // (13) cross-node sourceRef → scope.dataSource role='event' locked + supported
  const sourceRef = typeof node.sourceRef === 'string' ? node.sourceRef.trim() : ''
  if (sourceRef === '') return false
  const sourceNode = siblingNodes.find(n => n.id === sourceRef)
  if (!sourceNode) return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.dataSource node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (sourceNode.kind !== 'scope' || sourceNode.key !== 'scope.dataSource') return false
  if (sourceNode.status !== 'locked') return false
  if (sourceNode.dataSourceRole !== 'event') return false
  if (!isSupportedDataSourceScope(sourceNode, registry, strategyVersion, siblingNodes)) return false

  // (14) cross-node activeWhenRef → gate.regime locked + supported
  if (typeof node.activeWhenRef !== 'string' || node.activeWhenRef.trim() === '') return false
  const referenced = siblingNodes.find(n => n.id === node.activeWhenRef)
  if (!referenced) return false
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- gate.regime node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
  if (referenced.kind !== 'gate' || referenced.key !== 'gate.regime') return false
  if (referenced.status !== 'locked') return false
  if (!isSupportedRegimeGate(referenced, registry, strategyVersion, siblingNodes)) return false

  // (15)(16) registry + version-gate
  const contract = registry.getContractByKey('program.event_listener')
  if (!contract) return false
  if (!strategyVersion) return false
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
 * Phase 5 S8 (#1119): portfolioRisk.symbol_exposure_cap 10 重 fail-closed
 *  1) kind === 'portfolioRisk'
 *  2) key === 'portfolioRisk.symbol_exposure_cap'
 *  3) scope === 'symbol'
 *  4) mode ∈ {observe, enforce}
 *  5) notionalCapPct 有限正数且 ∈ (0, 100]
 *  6) effectWhenTriggered ∈ {block_new_entries, reduce_exposure}
 *  7) boundSymbolScopeRef 非空字符串
 *  8) registry 已注册 contract
 *  9) version-gate：strategyVersion 存在 + atom 可执行
 * 10) boundSymbolScopeRef ∈ siblingNodes 中 status='locked' + key='scope.symbol' + id 匹配
 */
function isSupportedPortfolioSymbolExposureCap(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  // (1) kind
  if (node.kind !== 'portfolioRisk') return false
  // (2) key
  if (node.key !== 'portfolioRisk.symbol_exposure_cap') return false
  // (3) scope discriminator
  if (node.scope !== 'symbol') return false
  // (4) mode
  if (node.mode !== 'observe' && node.mode !== 'enforce') return false
  // (5) notionalCapPct
  const cap = node.notionalCapPct
  if (cap === undefined || typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0 || cap > 100) return false
  // (6) effectWhenTriggered
  if (node.effectWhenTriggered !== 'block_new_entries' && node.effectWhenTriggered !== 'reduce_exposure') return false
  // (7) boundSymbolScopeRef
  const ref = node.boundSymbolScopeRef
  if (typeof ref !== 'string' || ref.trim() === '') return false
  // (8) registry
  const contract = registry.getContractByKey('portfolioRisk.symbol_exposure_cap')
  if (!contract) return false
  // (9) version-gate
  if (!strategyVersion) return false
  if (!registry.isExecutableForStrategy(contract, strategyVersion)) return false
  // (10) boundSymbolScopeRef ∈ locked scope.symbol sibling ids
  const trimmedRef = ref.trim()
  const hasMatchingScope = siblingNodes.some(
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    (s) => s.id === trimmedRef && s.kind === 'scope' && s.key === 'scope.symbol' && s.status === 'locked',
  )
  if (!hasMatchingScope) return false

  return true
}

/**
 * Phase 5 S8 (#1119): portfolioRisk.substrategy_exposure_cap 10 重 fail-closed
 *  1) kind === 'portfolioRisk'
 *  2) key === 'portfolioRisk.substrategy_exposure_cap'
 *  3) scope === 'subStrategy'
 *  4) mode ∈ {observe, enforce}
 *  5) notionalCapPct 有限正数且 ∈ (0, 100]
 *  6) effectWhenTriggered ∈ {block_new_entries, pause_substrategy}
 *  7) boundSubStrategyScopeRef 非空字符串
 *  8) registry 已注册 contract
 *  9) version-gate：strategyVersion 存在 + atom 可执行
 * 10) boundSubStrategyScopeRef ∈ siblingNodes 中 status='locked' + key='scope.subStrategy' + id 匹配
 */
function isSupportedPortfolioSubStrategyExposureCap(
  node: SemanticOrchestrationNode,
  registry: SemanticOrchestrationRegistryService,
  strategyVersion: StrategyVersionInfo | undefined,
  siblingNodes: readonly SemanticOrchestrationNode[],
): boolean {
  // (1) kind
  if (node.kind !== 'portfolioRisk') return false
  // (2) key
  if (node.key !== 'portfolioRisk.substrategy_exposure_cap') return false
  // (3) scope discriminator
  if (node.scope !== 'subStrategy') return false
  // (4) mode
  if (node.mode !== 'observe' && node.mode !== 'enforce') return false
  // (5) notionalCapPct
  const cap = node.notionalCapPct
  if (cap === undefined || typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0 || cap > 100) return false
  // (6) effectWhenTriggered
  if (node.effectWhenTriggered !== 'block_new_entries' && node.effectWhenTriggered !== 'pause_substrategy') return false
  // (7) boundSubStrategyScopeRef
  const ref = node.boundSubStrategyScopeRef
  if (typeof ref !== 'string' || ref.trim() === '') return false
  // (8) registry
  const contract = registry.getContractByKey('portfolioRisk.substrategy_exposure_cap')
  if (!contract) return false
  // (9) version-gate
  if (!strategyVersion) return false
  if (!registry.isExecutableForStrategy(contract, strategyVersion)) return false
  // (10) boundSubStrategyScopeRef ∈ locked scope.subStrategy sibling ids
  const trimmedRef = ref.trim()
  const hasMatchingScope = siblingNodes.some(
    (s) => s.id === trimmedRef && s.kind === 'scope' && s.key === 'scope.subStrategy' && s.status === 'locked',
  )
  if (!hasMatchingScope) return false

  return true
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
  // eslint-disable-next-line atom-keys/no-atom-key-literal -- gate.regime node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
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
  siblingNodes: readonly SemanticOrchestrationNode[] = [],
): SemanticOrchestrationNode {
  const validation = registry.validate(node, siblingNodes)
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

/**
 * Phase 5 S2 (#1104): 多 scope.symbol 策略对每个 trigger/action/risk/positionConstraint 节点
 * 进行 binding fail-closed 校验：
 *   - supportedScopeIds.size < 2：兜底，不触发检查（单/0 scope 旧策略行为不变）
 *   - supportedScopeIds.size >= 2 时：每个 status='locked' 的 owner 节点必须有
 *     symbolScopeRef trim 后非空且 ∈ supportedScopeIds，否则 status 降为 'open' +
 *     加 orchestration.scope.symbol.missing_binding open slot
 */
function applySymbolScopeBindingFailClosed(
  state: SemanticState,
): { state: SemanticState; hasBlockingSlots: boolean } {
  const orchestration = state.orchestration
  if (!orchestration) {
    return { state, hasBlockingSlots: false }
  }
  const supportedScopeIds = new Set<string>()
  for (const node of orchestration) {
    if (
      node.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.symbol node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && node.key === 'scope.symbol'
      && node.status === 'locked'
    ) {
      supportedScopeIds.add(node.id)
    }
  }
  if (supportedScopeIds.size < 2) {
    return { state, hasBlockingSlots: false }
  }

  let hasBlockingSlots = false

  function buildMissingBindingSlot(ownerLabel: string, ownerId: string): SemanticSlotState {
    return {
      slotKey: 'orchestration.scope.symbol.missing_binding',
      fieldPath: `${ownerLabel}[${ownerId}]`,
      status: 'open',
      priority: 'core',
      questionHint: `请确认该 ${ownerLabel}（${ownerId}）绑定到哪个 symbol scope`,
      affectsExecution: true,
    }
  }

  function isMissingRef(ref: unknown): boolean {
    if (typeof ref !== 'string') return true
    const trimmed = ref.trim()
    if (trimmed === '') return true
    return !supportedScopeIds.has(trimmed)
  }

  const trigger = readFlatTriggers(state).map((trigger) => {
    if (trigger.status !== 'locked' || !isMissingRef(trigger.symbolScopeRef)) return trigger
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('trigger', trigger.id)
    return {
      ...trigger,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(trigger.openSlots ?? []), slot],
    }
  })
  const action = readFlatActions(state).map((action) => {
    if (action.status !== 'locked' || !isMissingRef(action.symbolScopeRef)) return action
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('action', action.id)
    return {
      ...action,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(action.openSlots ?? []), slot],
    }
  })
  const risk = readFlatRisks(state).map((risk) => {
    if (risk.status !== 'locked' || !isMissingRef(risk.symbolScopeRef)) return risk
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('risk', risk.id)
    return {
      ...risk,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(risk.openSlots ?? []), slot],
    }
  })
  const position = state.position
    ? (() => {
        const constraints = state.positionConstraint
        if (!Array.isArray(constraints) || constraints.length === 0) return state.position
        const nextConstraints = constraints.map((constraint) => {
          if (constraint.status !== 'locked' || !isMissingRef(constraint.symbolScopeRef)) return constraint
          hasBlockingSlots = true
          const slot = buildMissingBindingSlot('positionConstraint', constraint.id)
          return {
            ...constraint,
            status: 'open' as SemanticNodeStatus,
            openSlots: [...(constraint.openSlots ?? []), slot],
          }
        })
        return { ...state.position, constraints: nextConstraints } as typeof state.position
      })()
    : state.position

  return {
    state: { ...state, trigger, action, risk, position },
    hasBlockingSlots,
  }
}

/**
 * Phase 5 S11 (#1112): 多 scope.leg 策略 binding fail-closed
 *   - supportedLegScopeIds.size < 2：旧策略零侵入
 *   - size >= 2 时：每个 status='locked' 的 owner 节点必须有 legScopeRef ∈ supported；否则降为 'open' + missing_binding slot
 *   - preBindingState 用于在 symbol binding 链式降级后仍保留 owner 原始 status，避免误跳过
 */
function applyLegScopeBindingFailClosed(
  state: SemanticState,
  preBindingState?: SemanticState,
): { state: SemanticState; hasBlockingSlots: boolean } {
  const orchestration = state.orchestration
  if (!orchestration) {
    return { state, hasBlockingSlots: false }
  }
  const supportedLegScopeIds = new Set<string>()
  for (const node of orchestration) {
    if (
      node.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.leg node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && node.key === 'scope.leg'
      && node.status === 'locked'
    ) {
      supportedLegScopeIds.add(node.id)
    }
  }
  if (supportedLegScopeIds.size < 2) {
    return { state, hasBlockingSlots: false }
  }

  const triggerStatusBeforeBinding = new Map<string, SemanticNodeStatus>()
  const actionStatusBeforeBinding = new Map<string, SemanticNodeStatus>()
  const riskStatusBeforeBinding = new Map<string, SemanticNodeStatus>()
  const constraintStatusBeforeBinding = new Map<string, SemanticNodeStatus>()
  const sourceState = preBindingState ?? state
  for (const t of readFlatTriggers(sourceState)) triggerStatusBeforeBinding.set(t.id, t.status)
  for (const a of readFlatActions(sourceState)) actionStatusBeforeBinding.set(a.id, a.status)
  for (const r of readFlatRisks(sourceState)) riskStatusBeforeBinding.set(r.id, r.status)
  for (const c of sourceState.positionConstraint ?? []) constraintStatusBeforeBinding.set(c.id, c.status)

  let hasBlockingSlots = false

  function buildLegMissingBindingSlot(ownerLabel: string, ownerId: string): SemanticSlotState {
    return {
      slotKey: 'orchestration.scope.leg.missing_binding',
      fieldPath: `${ownerLabel}[${ownerId}]`,
      status: 'open',
      priority: 'core',
      questionHint: `请确认该 ${ownerLabel}（${ownerId}）绑定到哪个策略腿`,
      affectsExecution: true,
    }
  }

  function isMissingLegRef(ref: unknown): boolean {
    if (typeof ref !== 'string') return true
    const trimmed = ref.trim()
    if (trimmed === '') return true
    return !supportedLegScopeIds.has(trimmed)
  }

  const trigger = readFlatTriggers(state).map((trigger) => {
    const preStatus = triggerStatusBeforeBinding.get(trigger.id) ?? trigger.status
    if (preStatus !== 'locked' || !isMissingLegRef(trigger.legScopeRef)) return trigger
    hasBlockingSlots = true
    const slot = buildLegMissingBindingSlot('trigger', trigger.id)
    return { ...trigger, status: 'open' as SemanticNodeStatus, openSlots: [...(trigger.openSlots ?? []), slot] }
  })
  const action = readFlatActions(state).map((action) => {
    const preStatus = actionStatusBeforeBinding.get(action.id) ?? action.status
    if (preStatus !== 'locked' || !isMissingLegRef(action.legScopeRef)) return action
    hasBlockingSlots = true
    const slot = buildLegMissingBindingSlot('action', action.id)
    return { ...action, status: 'open' as SemanticNodeStatus, openSlots: [...(action.openSlots ?? []), slot] }
  })
  const risk = readFlatRisks(state).map((riskItem) => {
    const preStatus = riskStatusBeforeBinding.get(riskItem.id) ?? riskItem.status
    if (preStatus !== 'locked' || !isMissingLegRef(riskItem.legScopeRef)) return riskItem
    hasBlockingSlots = true
    const slot = buildLegMissingBindingSlot('risk', riskItem.id)
    return { ...riskItem, status: 'open' as SemanticNodeStatus, openSlots: [...(riskItem.openSlots ?? []), slot] }
  })
  const position = state.position
    ? (() => {
        const constraints = state.positionConstraint
        if (!Array.isArray(constraints) || constraints.length === 0) return state.position
        const nextConstraints = constraints.map((constraint) => {
          const preStatus = constraintStatusBeforeBinding.get(constraint.id) ?? constraint.status
          if (preStatus !== 'locked' || !isMissingLegRef(constraint.legScopeRef)) return constraint
          hasBlockingSlots = true
          const slot = buildLegMissingBindingSlot('positionConstraint', constraint.id)
          return { ...constraint, status: 'open' as SemanticNodeStatus, openSlots: [...(constraint.openSlots ?? []), slot] }
        })
        return { ...state.position, constraints: nextConstraints } as typeof state.position
      })()
    : state.position

  return { state: { ...state, trigger, action, risk, position }, hasBlockingSlots }
}

/**
 * Phase 5 S3 (#1109): timeframe scope binding fail-closed
 *   - 与 S2/S11 ≥2 阈值不同——S3 ≥1 supported scope.timeframe locked 节点即强制 owner ref
 *   - 同 owner 同时缺 symbolScopeRef + timeframeScopeRef 时，两个 missing_binding slot 各自单独追加（不合并）
 *   - 通过 openSlots 检测 wasOriginallyLocked：含 symbol_missing_binding slot 即视为"原本 locked"，继续检查 tf ref
 */
function applyTimeframeScopeBindingFailClosed(
  state: SemanticState,
): { state: SemanticState; hasBlockingSlots: boolean } {
  const orchestration = state.orchestration
  if (!orchestration) {
    return { state, hasBlockingSlots: false }
  }
  const supportedScopeIds = new Set<string>()
  for (const node of orchestration) {
    if (
      node.kind === 'scope'
      // eslint-disable-next-line atom-keys/no-atom-key-literal -- scope.timeframe node-type routing, not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
      && node.key === 'scope.timeframe'
      && node.status === 'locked'
    ) {
      supportedScopeIds.add(node.id)
    }
  }
  if (supportedScopeIds.size < 1) {
    return { state, hasBlockingSlots: false }
  }

  let hasBlockingSlots = false

  function buildTfMissingBindingSlot(ownerLabel: string, ownerId: string): SemanticSlotState {
    return {
      slotKey: 'orchestration.scope.timeframe.missing_binding',
      fieldPath: `${ownerLabel}[${ownerId}]`,
      status: 'open',
      priority: 'core',
      questionHint: `请确认该 ${ownerLabel}（${ownerId}）绑定到哪个 timeframe scope（必须显式声明）`,
      affectsExecution: true,
    }
  }

  function isMissingTfRef(ref: unknown): boolean {
    if (typeof ref !== 'string') return true
    const trimmed = ref.trim()
    if (trimmed === '') return true
    return !supportedScopeIds.has(trimmed)
  }

  function wasOriginallyLocked(node: { status: SemanticNodeStatus; openSlots?: readonly SemanticSlotState[] }): boolean {
    if (node.status === 'locked') return true
    return (node.openSlots ?? []).some(s =>
      s.slotKey === 'orchestration.scope.symbol.missing_binding'
      || s.slotKey === 'orchestration.scope.leg.missing_binding'
    )
  }

  const trigger = readFlatTriggers(state).map((trigger) => {
    if (!wasOriginallyLocked(trigger) || !isMissingTfRef(trigger.timeframeScopeRef)) return trigger
    hasBlockingSlots = true
    const slot = buildTfMissingBindingSlot('trigger', trigger.id)
    return { ...trigger, status: 'open' as SemanticNodeStatus, openSlots: [...(trigger.openSlots ?? []), slot] }
  })
  const action = readFlatActions(state).map((action) => {
    if (!wasOriginallyLocked(action) || !isMissingTfRef(action.timeframeScopeRef)) return action
    hasBlockingSlots = true
    const slot = buildTfMissingBindingSlot('action', action.id)
    return { ...action, status: 'open' as SemanticNodeStatus, openSlots: [...(action.openSlots ?? []), slot] }
  })
  const risk = readFlatRisks(state).map((riskItem) => {
    if (!wasOriginallyLocked(riskItem) || !isMissingTfRef(riskItem.timeframeScopeRef)) return riskItem
    hasBlockingSlots = true
    const slot = buildTfMissingBindingSlot('risk', riskItem.id)
    return { ...riskItem, status: 'open' as SemanticNodeStatus, openSlots: [...(riskItem.openSlots ?? []), slot] }
  })
  const position = state.position
    ? (() => {
        const constraints = state.positionConstraint
        if (!Array.isArray(constraints) || constraints.length === 0) return state.position
        const nextConstraints = constraints.map((constraint) => {
          if (!wasOriginallyLocked(constraint) || !isMissingTfRef(constraint.timeframeScopeRef)) return constraint
          hasBlockingSlots = true
          const slot = buildTfMissingBindingSlot('positionConstraint', constraint.id)
          return { ...constraint, status: 'open' as SemanticNodeStatus, openSlots: [...(constraint.openSlots ?? []), slot] }
        })
        return { ...state.position, constraints: nextConstraints } as typeof state.position
      })()
    : state.position

  return { state: { ...state, trigger, action, risk, position }, hasBlockingSlots }
}

/**
 * Phase 5 S9 (#1110): 多 dataSource scope 策略对每个 trigger/action/risk/positionConstraint 节点
 * 进行 binding fail-closed 校验：
 *   - supportedDataSourceScopeIds.size === 0：旧策略零侵入，不读 dataSourceScopeRef
 *   - size ≥ 1 时：每个 status='locked' 的 owner 节点若**声明了** dataSourceScopeRef 但 trim 后空 / 不在 supported 集合：
 *     status 降为 'open' + 加 orchestration.scope.dataSource.missing_binding open slot
 *   - **不强制要求所有 binding 节点必须声明 dataSourceScopeRef**（dataSource 是声明性 feed 集合，不需 per-program 路由）
 */
function applyDataSourceScopeBindingFailClosed(
  state: SemanticState,
): { state: SemanticState; hasBlockingSlots: boolean } {
  const orchestration = state.orchestration
  if (!orchestration) {
    return { state, hasBlockingSlots: false }
  }
  const supportedScopeIds = new Set<string>()
  for (const node of orchestration) {
    if (
      node.kind === 'scope'
      && node.key === 'scope.dataSource'
      && node.status === 'locked'
    ) {
      supportedScopeIds.add(node.id)
    }
  }
  if (supportedScopeIds.size === 0) {
    return { state, hasBlockingSlots: false }
  }

  let hasBlockingSlots = false

  function buildMissingBindingSlot(ownerLabel: string, ownerId: string): SemanticSlotState {
    return {
      slotKey: 'orchestration.scope.dataSource.missing_binding',
      fieldPath: `${ownerLabel}[${ownerId}]`,
      status: 'open',
      priority: 'core',
      questionHint: `请确认该 ${ownerLabel}（${ownerId}）绑定到哪个 dataSource scope`,
      affectsExecution: true,
    }
  }

  // 仅当 owner 节点 *声明了* dataSourceScopeRef（非 undefined）才校验；空字符串与未声明等价 → 强制要求 ref ∈ supported
  function isInvalidExplicitRef(ref: unknown): boolean {
    if (ref === undefined || ref === null) return false   // 未声明：不读
    if (typeof ref !== 'string') return true
    const trimmed = ref.trim()
    if (trimmed === '') return true
    return !supportedScopeIds.has(trimmed)
  }

  const trigger = readFlatTriggers(state).map((trigger) => {
    if (trigger.status !== 'locked' || !isInvalidExplicitRef(trigger.dataSourceScopeRef)) return trigger
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('trigger', trigger.id)
    return {
      ...trigger,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(trigger.openSlots ?? []), slot],
    }
  })
  const action = readFlatActions(state).map((action) => {
    if (action.status !== 'locked' || !isInvalidExplicitRef(action.dataSourceScopeRef)) return action
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('action', action.id)
    return {
      ...action,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(action.openSlots ?? []), slot],
    }
  })
  const risk = readFlatRisks(state).map((risk) => {
    if (risk.status !== 'locked' || !isInvalidExplicitRef(risk.dataSourceScopeRef)) return risk
    hasBlockingSlots = true
    const slot = buildMissingBindingSlot('risk', risk.id)
    return {
      ...risk,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(risk.openSlots ?? []), slot],
    }
  })
  const position = state.position
    ? (() => {
        const constraints = state.positionConstraint
        if (!Array.isArray(constraints) || constraints.length === 0) return state.position
        const nextConstraints = constraints.map((constraint) => {
          if (constraint.status !== 'locked' || !isInvalidExplicitRef(constraint.dataSourceScopeRef)) return constraint
          hasBlockingSlots = true
          const slot = buildMissingBindingSlot('positionConstraint', constraint.id)
          return {
            ...constraint,
            status: 'open' as SemanticNodeStatus,
            openSlots: [...(constraint.openSlots ?? []), slot],
          }
        })
        return { ...state.position, constraints: nextConstraints } as typeof state.position
      })()
    : state.position

  return {
    state: { ...state, trigger, action, risk, position },
    hasBlockingSlots,
  }
}

/**
 * Phase 5 S10 (#1111): scope.subStrategy 多 sub fan-out binding fail-closed
 *   - supportedSubStrategyScopeIds.size < 2：兜底，不触发检查（单/0 sub 旧策略行为不变）
 *   - supportedSubStrategyScopeIds.size >= 2 时：每个 status='locked' 的 owner 节点必须有
 *     subStrategyScopeRef trim 后非空且 ∈ supportedSubStrategyScopeIds，否则 status 降为 'open' +
 *     加 orchestration.scope.subStrategy.missing_binding open slot
 *
 * Linus 简化注释：与 applySymbolScopeBindingFailClosed 形态完全平行；S10 plan §19.1 显式选择
 * "并行新增独立函数，不重命名既有 S2 helper；公共 helper 抽取留 follow-up #1113"。
 */
function applySubStrategyScopeBindingFailClosed(
  state: SemanticState,
): { state: SemanticState; hasBlockingSlots: boolean } {
  const orchestration = state.orchestration
  if (!orchestration) {
    return { state, hasBlockingSlots: false }
  }
  const supportedScopeIds = new Set<string>()
  for (const node of orchestration) {
    if (
      node.kind === 'scope'
      && node.key === 'scope.subStrategy'
      && node.status === 'locked'
    ) {
      supportedScopeIds.add(node.id)
    }
  }
  if (supportedScopeIds.size < 2) {
    return { state, hasBlockingSlots: false }
  }

  let hasBlockingSlots = false

  function buildSubStrategyMissingBindingSlot(ownerLabel: string, ownerId: string): SemanticSlotState {
    return {
      slotKey: 'orchestration.scope.subStrategy.missing_binding',
      fieldPath: `${ownerLabel}[${ownerId}]`,
      status: 'open',
      priority: 'core',
      questionHint: `请确认该 ${ownerLabel}（${ownerId}）绑定到哪个 sub-strategy scope`,
      affectsExecution: true,
    }
  }

  function isMissingSubStrategyRef(ref: unknown): boolean {
    if (typeof ref !== 'string') return true
    const trimmed = ref.trim()
    if (trimmed === '') return true
    return !supportedScopeIds.has(trimmed)
  }

  const trigger = readFlatTriggers(state).map((trigger) => {
    if (trigger.status !== 'locked' || !isMissingSubStrategyRef(trigger.subStrategyScopeRef)) return trigger
    hasBlockingSlots = true
    const slot = buildSubStrategyMissingBindingSlot('trigger', trigger.id)
    return {
      ...trigger,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(trigger.openSlots ?? []), slot],
    }
  })
  const action = readFlatActions(state).map((action) => {
    if (action.status !== 'locked' || !isMissingSubStrategyRef(action.subStrategyScopeRef)) return action
    hasBlockingSlots = true
    const slot = buildSubStrategyMissingBindingSlot('action', action.id)
    return {
      ...action,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(action.openSlots ?? []), slot],
    }
  })
  const risk = readFlatRisks(state).map((risk) => {
    if (risk.status !== 'locked' || !isMissingSubStrategyRef(risk.subStrategyScopeRef)) return risk
    hasBlockingSlots = true
    const slot = buildSubStrategyMissingBindingSlot('risk', risk.id)
    return {
      ...risk,
      status: 'open' as SemanticNodeStatus,
      openSlots: [...(risk.openSlots ?? []), slot],
    }
  })
  const position = state.position
    ? (() => {
        const constraints = state.positionConstraint
        if (!Array.isArray(constraints) || constraints.length === 0) return state.position
        const nextConstraints = constraints.map((constraint) => {
          if (constraint.status !== 'locked' || !isMissingSubStrategyRef(constraint.subStrategyScopeRef)) return constraint
          hasBlockingSlots = true
          const slot = buildSubStrategyMissingBindingSlot('positionConstraint', constraint.id)
          return {
            ...constraint,
            status: 'open' as SemanticNodeStatus,
            openSlots: [...(constraint.openSlots ?? []), slot],
          }
        })
        return { ...state.position, constraints: nextConstraints } as typeof state.position
      })()
    : state.position

  return {
    state: { ...state, trigger, action, risk, position },
    hasBlockingSlots,
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

/**
 * #1493 块 D：rules 真源前置保证后，flat 五桶（trigger/action/risk/positionConstraint
 * 含 position）已由 `normalize()` 入口的 `reprojectFromRules` 重新派生自 rules tree。
 *
 * 因此本函数读 flat 等价于读 rules（AND/OR/sequence/NOT 复合表达式由 projectToFlat
 * 拆叶子并把 combinationContract 挂到首叶子上，不会被"拆散"成多条独立 owner）。
 *
 * rules 为空时本函数仍读取原始 flat — 这条 legacy 路径保留是为兼容老 fixture / 直接
 * 写 flat 的测试用例；最终 readiness 由 normalize() 决定，rules 空 + flat 非空时
 * 不再触发 reproject，readiness 走 legacy flat 8 路 fail-closed 路径。
 *
 * 完整切流 rules-only readiness（即 rules 空 → ready=false rules_missing）的 fixture
 * 迁移留给后续 PR，避免单次推动 86 个 readiness spec 同步改写。
 */
function collectActiveContractOwners(state: SemanticState): SemanticContractOwnerRef[] {
  const owners: SemanticContractOwnerRef[] = []

  for (const trigger of readFlatTriggers(state)) {
    if (trigger.status !== 'superseded' && trigger.contracts?.length) {
      owners.push({
        ownerKind: 'trigger',
        ownerId: trigger.id,
        atomKey: trigger.key,
        sourceRuleId: trigger._provenance?.ruleId,
        params: trigger.params,
        support: trigger.support,
        status: trigger.status,
        openSlots: trigger.openSlots,
        contracts: trigger.contracts,
      })
    }
  }

  for (const action of readFlatActions(state)) {
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

  for (const risk of readFlatRisks(state)) {
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
        sourceRuleId: constraint._provenance?.ruleId,
        params: constraint.params,
        support: constraint.support,
        status: constraint.status,
        openSlots: constraint.openSlots,
        contracts: constraint.contracts,
      })
    }
  }

  for (const constraint of state.positionConstraint ?? []) {
    if (constraint.status !== 'superseded' && constraint.contracts?.length) {
      owners.push({
        ownerKind: 'position',
        ownerId: positionConstraintOwnerId(constraint),
        atomKey: constraint.key,
        sourceRuleId: constraint._provenance?.ruleId,
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
  if (owner.ownerKind !== 'trigger' || (owner.atomKey !== ATOM_CONTRACT_REGISTRY['indicator.above'].key && owner.atomKey !== ATOM_CONTRACT_REGISTRY['indicator.below'].key)) {
    return false
  }

  const indicator = readParamString(owner.params, 'indicator')?.toLowerCase() ?? ''
  const referenceRole = readParamString(owner.params, 'referenceRole') ?? ''
  const referencePeriod = owner.params['reference.period']
  const period = owner.params.period
  const hasReferencePeriod = (
    typeof referencePeriod === 'number'
    && Number.isFinite(referencePeriod)
    && referencePeriod > 0
  ) || (
    typeof period === 'number'
    && Number.isFinite(period)
    && period > 0
  )
  const hasReferencePeriodOpenSlot = owner.openSlots.some(slot =>
    slot.status === 'open'
    && slot.affectsExecution
    && /reference\.period/u.test(`${slot.slotKey}.${slot.fieldPath}`),
  )

  return (indicator === 'ma' || indicator === 'sma' || indicator === 'ema')
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
  // Phase 5 S0a: program lifecycle 跨 K 线状态通道；多 program 共用此 vocabulary，
  // runtime 按 program.id 分桶（详见 CompiledOrderState.programLifecycleStateNext）
  'state.read_write.program_lifecycle',
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
  if (hasActiveAddPositionConstraint(state)) {
    return slotsByOwnerKey
  }

  for (const action of readFlatActions(state)) {
    if (action.status === 'superseded' || action.key !== ATOM_CONTRACT_REGISTRY['action.add_position'].key) {
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

function hasActiveAddPositionConstraint(state: SemanticState): boolean {
  const topLevel = state.positionConstraint?.some(isActiveAddPositionConstraint) ?? false
  if (topLevel) return true

  // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
  return (state.position as { constraints?: SemanticPositionConstraintState[] } | null)?.constraints?.some(isActiveAddPositionConstraint) ?? false
}

function isActiveAddPositionConstraint(constraint: SemanticPositionConstraintState): boolean {
  return (
    constraint.status !== 'superseded'
    // eslint-disable-next-line atom-keys/no-atom-key-literal -- position.max_exposure_pct not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329)
    && (constraint.key === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key || constraint.key === 'position.max_exposure_pct')
  )
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
  return readFlatTriggers(state).some(ownerHasOpenSlot)
    || readFlatActions(state).some(ownerHasOpenSlot)
    || readFlatRisks(state).some(ownerHasOpenSlot)
    || ownerHasOpenSlot(state.position)
    || (state.positionConstraint ?? []).some(ownerHasOpenSlot)
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

  // DEPRECATED Task 6: position.constraints moved to top-level positionConstraint[]
  const constraints = (position as { constraints?: SemanticPositionConstraintState[] }).constraints?.map(constraint =>
    mergeOwnerOpenSlots(
      constraint,
      slotsByOwnerKey.get(ownerKey('position', positionConstraintOwnerId(constraint))),
    ),
  )
  const nextPosition = mergeOwnerOpenSlots(position, slotsByOwnerKey.get(ownerKey('position', positionOwnerId())))
  return constraints
    ? ({ ...nextPosition, constraints } as SemanticPositionState)
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

function collectMultiTimeframeTriggerRuleIds(
  activeOwners: readonly SemanticContractOwnerRef[],
): Set<string> {
  const timeframesByRuleId = new Map<string, Set<string>>()

  for (const owner of activeOwners) {
    if (owner.ownerKind !== 'trigger' || !owner.sourceRuleId) {
      continue
    }

    const declared = readDeclaredTimeframe(owner)
    if (!declared) {
      continue
    }

    const timeframes = timeframesByRuleId.get(owner.sourceRuleId) ?? new Set<string>()
    timeframes.add(declared)
    timeframesByRuleId.set(owner.sourceRuleId, timeframes)
  }

  const multiTimeframeRuleIds = new Set<string>()
  for (const [ruleId, timeframes] of timeframesByRuleId.entries()) {
    if (timeframes.size >= 2) {
      multiTimeframeRuleIds.add(ruleId)
    }
  }

  return multiTimeframeRuleIds
}

function isExplicitMultiTimeframeTriggerMember(
  owner: SemanticContractOwnerRef,
  multiTimeframeTriggerRuleIds: ReadonlySet<string>,
): boolean {
  return owner.ownerKind === 'trigger'
    && typeof owner.sourceRuleId === 'string'
    && multiTimeframeTriggerRuleIds.has(owner.sourceRuleId)
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
  /* eslint-disable atom-keys/no-atom-key-literal -- position.max_exposure_pct / position.dca_schedule not yet in ATOM_CONTRACT_REGISTRY (follow-up #1329) */
  return mode === ATOM_CONTRACT_REGISTRY['position.pyramiding_limit'].key
    || mode === 'position.max_exposure_pct'
    || mode === 'position.dca_schedule'
  /* eslint-enable atom-keys/no-atom-key-literal */
}
