import { Injectable, Optional } from '@nestjs/common'
import { MARKET_TIMEFRAMES } from '@ai/shared'
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type {
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityShape,
  SemanticContractKind,
  SemanticExpression,
  SemanticExpressionOperator,
  SemanticExpressionOperand,
  SemanticPositionSizingContract,
  SemanticRiskBasis,
  SemanticRiskBasisSource,
  SemanticSlotState,
} from '../types/semantic-state'
import type { MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
import { NaturalLanguageGatewayService } from './natural-language-gateway.service'
import { PositionSizingContractService } from './position-sizing-contract.service'
import { SemanticEventFrameParserService } from './semantic-event-frame-parser.service'
import { SemanticEventFrameProjectorService } from './semantic-event-frame-projector.service'
import { SemanticFrameNormalizerService } from './semantic-frame-normalizer.service'
import { buildTriggerCombinationContract } from './semantic-state-normalization'

type SeedTrigger = NonNullable<CodegenSemanticPatch['triggers']>[number]
type SeedAction = NonNullable<CodegenSemanticPatch['actions']>[number]
type SeedRisk = NonNullable<CodegenSemanticPatch['risk']>[number]
type SeedContextSlots = NonNullable<CodegenSemanticPatch['contextSlots']>
type SeedPositionConstraint = NonNullable<NonNullable<CodegenSemanticPatch['position']>['constraints']>[number]
type QuoteAsset = 'USDT' | 'USDC' | 'USD'
type FixedGridRange = {
  lower: number
  upper: number
}

const LEVEL_SET_DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const LEVEL_SET_SPACING_CONFLICT_SLOT_KEY = 'contract.shape.price.level_set.spacing_conflict'
const GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH = 'triggers[grid.range_rebalance].contracts[contract-grid-fixed-levels].capabilities[price.define.level_set].shape'
const REDUCED_INDICATOR_CROSS_SIGNATURE_INDICATORS = new Set(['ma', 'ema', 'moving_average', 'macd'])
const SUPPORTED_EXECUTION_TIMEFRAMES = new Set<string>(MARKET_TIMEFRAMES)

type SemanticAliasContext = {
  bollingerBandParams?: {
    period?: number
    stdDev?: number
  }
  movingAverage?: {
    indicator: 'ma' | 'ema'
    period: number
  }
  rsi?: {
    period: number
  }
}

type TriggerCombinationContractInput = {
  groupId: string
  join: 'AND' | 'OR'
  actionKey?: string
  actionKeySource?: 'default' | 'explicit'
}

@Injectable()
export class SemanticSeedExtractorService {
  constructor(
    private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
    private readonly eventFrameParser: SemanticEventFrameParserService = new SemanticEventFrameParserService(),
    private readonly eventFrameProjector: SemanticEventFrameProjectorService = new SemanticEventFrameProjectorService(),
    @Optional()
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
    private readonly naturalLanguageGateway: NaturalLanguageGatewayService = new NaturalLanguageGatewayService(),
    private readonly frameNormalizer: SemanticFrameNormalizerService = new SemanticFrameNormalizerService(),
  ) {}

  extract(message?: string): CodegenSemanticPatch {
    const text = this.normalizeText(message)
    if (!text) {
      return {}
    }

    const lifecycleActions = this.extractPositionLifecycleActions(text)
    const lifecycleConstraints = this.extractPositionLifecycleConstraints(text) ?? []
    const hasPositionLifecycleSemantics = lifecycleActions.length > 0 || lifecycleConstraints.length > 0
    const legacyContextSlots = hasPositionLifecycleSemantics
      ? this.withInheritedLifecycleContextSlots(this.extractContextSlots(text))
      : this.extractContextSlots(text)
    const gatewayPatch = this.frameNormalizer.normalize(this.naturalLanguageGateway.parse(text))
    const contextSlots = this.mergeContextSlots(gatewayPatch.contextSlots ?? {}, legacyContextSlots, text)
    const aliasContext = this.extractAliasContext(text)
    const eventFramePatch = this.eventFrameProjector.project(this.eventFrameParser.parse(text))
    const eventFrameTriggers = eventFramePatch.triggers ?? []
    const legacyTriggers = this.extractTriggers(text, aliasContext)
    const gatewayTriggers = this.filterGatewayTriggers(gatewayPatch.triggers ?? [], legacyTriggers)
    const gatewayRisk = gatewayPatch.risk ?? []
    const gatewayActions = gatewayTriggers.length > 0 || gatewayRisk.length > 0
      ? (gatewayPatch.actions ?? [])
      : []
    const triggers = this.atomizeTriggers(this.withRecognizedTriggerCombinationContracts(this.groupEntryConfirmationTriggers(this.inheritIndicatorBoundaryConfirmationModes(
      this.removeStaticIndicatorTriggersCoveredBySequences(
        this.removeLogicalAnyOfExitChildren(this.harmonizeBollingerTriggers(this.mergeSeedTriggers(
          gatewayTriggers,
          this.mergeSeedTriggers(eventFrameTriggers, legacyTriggers),
        ))),
      ),
    ))))
    const actions = this.atomizeActions(this.mergeSeedActions(
      gatewayActions,
      this.mergeSeedActions(
        this.mergeSeedActions(
          eventFramePatch.actions ?? [],
          this.extractActions(text, triggers),
        ),
        lifecycleActions,
      ),
    ))
    const risk = this.atomizeRisk(this.mergeSeedRisk(
      gatewayRisk,
      this.extractRisk(text),
    ))
    const position = this.atomizePosition(this.withPositionLifecycleConstraints(
      this.extractPosition(text, triggers),
      lifecycleConstraints,
      lifecycleActions.length > 0,
      this.resolveLifecyclePositionMode(text, lifecycleActions, lifecycleConstraints),
    ))

    const patch: CodegenSemanticPatch = {}

    if (Object.keys(contextSlots).length > 0) {
      patch.contextSlots = contextSlots
    }
    if (triggers.length > 0) {
      patch.triggers = triggers
    }
    if (actions.length > 0) {
      patch.actions = actions
    }
    if (risk.length > 0) {
      patch.risk = risk
    }
    if (position) {
      patch.position = position
    }
    const orchestrationNodes = gatewayPatch.orchestration?.nodes ?? []
    if (orchestrationNodes.length > 0) {
      patch.orchestration = { nodes: [...orchestrationNodes] }
    }

    return patch
  }

  private filterGatewayTriggers(
    gatewayTriggers: readonly SeedTrigger[],
    legacyTriggers: readonly SeedTrigger[],
  ): SeedTrigger[] {
    return gatewayTriggers.filter((trigger) => {
      if (trigger.key !== 'condition.expression' || trigger.phase !== 'gate') {
        return true
      }

      return !this.hasLegacyMovingAverageStackForGatewayGate(trigger, legacyTriggers)
    })
  }

  private hasLegacyMovingAverageStackForGatewayGate(
    gatewayTrigger: SeedTrigger,
    legacyTriggers: readonly SeedTrigger[],
  ): boolean {
    const sideScope = gatewayTrigger.sideScope ?? 'long'
    const stackKey = sideScope === 'short' ? 'indicator.below' : 'indicator.above'
    const stackPeriods = legacyTriggers
      .filter(trigger => (
        trigger.key === stackKey
        && trigger.phase === 'entry'
        && (trigger.sideScope ?? 'long') === sideScope
        && typeof trigger.params?.indicator === 'string'
        && (trigger.params.indicator === 'ema' || trigger.params.indicator === 'ma')
        && typeof trigger.params['reference.period'] === 'number'
        && Number.isFinite(trigger.params['reference.period'])
      ))
      .map(trigger => trigger.params?.['reference.period'])

    return new Set(stackPeriods).size >= 2
  }

  private mergeContextSlots(
    gatewayContextSlots: SeedContextSlots,
    legacyContextSlots: SeedContextSlots,
    text: string,
  ): SeedContextSlots {
    const merged: SeedContextSlots = {
      ...legacyContextSlots,
      ...gatewayContextSlots,
    }

    if (
      this.isPlainObject(legacyContextSlots.symbol)
      && typeof gatewayContextSlots.symbol === 'string'
    ) {
      merged.symbol = legacyContextSlots.symbol
    }

    if (!this.shouldUseGatewayTimeframe(gatewayContextSlots, legacyContextSlots, text)) {
      if (legacyContextSlots.timeframe !== undefined) {
        merged.timeframe = legacyContextSlots.timeframe
      }
      else {
        delete merged.timeframe
      }
    }

    return merged
  }

  private shouldUseGatewayTimeframe(
    gatewayContextSlots: SeedContextSlots,
    legacyContextSlots: SeedContextSlots,
    text: string,
  ): boolean {
    if (gatewayContextSlots.timeframe === undefined) {
      return false
    }

    if (
      legacyContextSlots.timeframe !== undefined
      && legacyContextSlots.timeframe !== gatewayContextSlots.timeframe
    ) {
      return false
    }

    return !this.hasMultiTimeframeMovingAveragePredicateScope(text)
  }

  private mergeSeedTriggers(
    primaryTriggers: readonly SeedTrigger[],
    secondaryTriggers: readonly SeedTrigger[],
  ): SeedTrigger[] {
    const merged: SeedTrigger[] = []
    const seen = new Set<string>()
    const looseIndicatorIndex = new Map<string, number>()

    for (const trigger of [...primaryTriggers, ...secondaryTriggers]) {
      if (this.isGenericBoundaryFallbackCoveredByMergedTrigger(trigger, merged)) continue
      const concreteBoundaryIndex = this.findConcreteBoundaryEquivalentIndex(trigger, merged)
      if (concreteBoundaryIndex !== null) {
        merged[concreteBoundaryIndex] = trigger
        continue
      }

      const signature = this.buildTriggerMergeSignature(trigger)
      if (seen.has(signature)) continue

      const looseSignature = this.buildLooseIndicatorCrossMergeSignature(trigger)
      if (looseSignature) {
        const existingIndex = looseIndicatorIndex.get(looseSignature)
        if (existingIndex !== undefined) {
          const existingTrigger = merged[existingIndex]
          if (this.canMergeLooseIndicatorCross(existingTrigger, trigger)) {
            if (this.countIndicatorPeriodParams(trigger) > this.countIndicatorPeriodParams(existingTrigger)) {
              merged[existingIndex] = trigger
              seen.add(signature)
            }
            continue
          }
        }
        else {
          looseIndicatorIndex.set(looseSignature, merged.length)
        }
      }

      seen.add(signature)
      merged.push(trigger)
    }

    return merged
  }

  private isGenericBoundaryFallbackCoveredByMergedTrigger(
    trigger: SeedTrigger,
    merged: readonly SeedTrigger[],
  ): boolean {
    if (
      trigger.key !== 'price.detect.indicator_boundary'
      || !this.isPlainObject(trigger.params?.indicator)
      || trigger.params.indicator.name !== 'generic_boundary'
      || typeof trigger.params.boundaryRole !== 'string'
    ) {
      return false
    }

    return merged.some(candidate => (
      candidate.key === trigger.key
      && candidate.phase === trigger.phase
      && candidate.sideScope === trigger.sideScope
      && candidate.params?.boundaryRole === trigger.params?.boundaryRole
      && this.isPlainObject(candidate.params?.indicator)
      && candidate.params.indicator.name !== 'generic_boundary'
    ))
  }

  private findConcreteBoundaryEquivalentIndex(
    trigger: SeedTrigger,
    merged: readonly SeedTrigger[],
  ): number | null {
    const boundary = this.readConcreteBoundaryMergeParts(trigger)
    if (!boundary) return null

    const index = merged.findIndex((candidate) => {
      const candidateBoundary = this.readConcreteBoundaryMergeParts(candidate)
      return candidateBoundary !== null
        && candidateBoundary.phase === boundary.phase
        && candidateBoundary.sideScope === boundary.sideScope
        && candidateBoundary.boundaryRole === boundary.boundaryRole
        && candidateBoundary.indicatorName === boundary.indicatorName
    })

    return index >= 0 ? index : null
  }

  private readConcreteBoundaryMergeParts(trigger: SeedTrigger): {
    phase: SeedTrigger['phase']
    sideScope: SeedTrigger['sideScope'] | null
    boundaryRole: string
    indicatorName: string
  } | null {
    if (
      trigger.key !== 'price.detect.indicator_boundary'
      || typeof trigger.params?.boundaryRole !== 'string'
      || !this.isPlainObject(trigger.params.indicator)
      || typeof trigger.params.indicator.name !== 'string'
      || trigger.params.indicator.name === 'generic_boundary'
    ) {
      return null
    }

    return {
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      boundaryRole: trigger.params.boundaryRole,
      indicatorName: trigger.params.indicator.name,
    }
  }

  private buildLooseIndicatorCrossMergeSignature(trigger: SeedTrigger): string | null {
    if (!this.isIndicatorCrossTrigger(trigger)) {
      return null
    }

    return JSON.stringify({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      indicator: trigger.params?.indicator,
      semantic: this.resolveIndicatorCrossSemantic(trigger),
    })
  }

  private canMergeLooseIndicatorCross(left: SeedTrigger, right: SeedTrigger): boolean {
    if (!this.isIndicatorCrossTrigger(left) || !this.isIndicatorCrossTrigger(right)) {
      return false
    }

    return this.countIndicatorPeriodParams(left) === 0 || this.countIndicatorPeriodParams(right) === 0
  }

  private countIndicatorPeriodParams(trigger: SeedTrigger): number {
    let count = 0
    if (trigger.params?.fastPeriod !== undefined) count += 1
    if (trigger.params?.slowPeriod !== undefined) count += 1
    if (trigger.params?.signalPeriod !== undefined) count += 1

    return count
  }

  private buildTriggerMergeSignature(trigger: SeedTrigger): string {
    if (this.isIndicatorCrossTrigger(trigger)) {
      return JSON.stringify({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope ?? null,
        params: this.stableValue({
          indicator: trigger.params?.indicator,
          semantic: this.resolveIndicatorCrossSemantic(trigger),
          fastPeriod: trigger.params?.fastPeriod,
          slowPeriod: trigger.params?.slowPeriod,
          signalPeriod: trigger.params?.signalPeriod,
        }),
      })
    }

    return JSON.stringify({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      params: this.stableValue(trigger.params ?? {}),
    })
  }

  private isIndicatorCrossTrigger(trigger: SeedTrigger): boolean {
    return (trigger.key === 'indicator.cross_over' || trigger.key === 'indicator.cross_under')
      && typeof trigger.params?.indicator === 'string'
      && REDUCED_INDICATOR_CROSS_SIGNATURE_INDICATORS.has(trigger.params.indicator)
  }

  private resolveIndicatorCrossSemantic(trigger: SeedTrigger): string {
    if (trigger.params?.semantic === 'cross_up' || trigger.params?.semantic === 'cross_down') {
      return trigger.params.semantic
    }
    return trigger.key === 'indicator.cross_over' ? 'cross_up' : 'cross_down'
  }

  private mergeSeedActions(
    primaryActions: readonly SeedAction[],
    secondaryActions: readonly SeedAction[],
  ): SeedAction[] {
    const merged: SeedAction[] = []
    const seen = new Set<string>()

    for (const action of [...primaryActions, ...secondaryActions]) {
      const signature = JSON.stringify({
        key: action.key,
        params: this.stableValue(action.params ?? {}),
      })
      if (seen.has(signature)) continue
      seen.add(signature)
      merged.push(action)
    }

    return merged
  }

  private mergeSeedRisk(
    primaryRisk: readonly SeedRisk[],
    secondaryRisk: readonly SeedRisk[],
  ): SeedRisk[] {
    const merged: SeedRisk[] = []
    const seen = new Set<string>()

    for (const risk of [...primaryRisk, ...secondaryRisk]) {
      const equivalentIndex = this.findEquivalentRiskIndex(risk, merged)
      if (equivalentIndex !== null) {
        merged[equivalentIndex] = risk
        continue
      }

      const signature = JSON.stringify({
        key: risk.key,
        params: this.stableValue(risk.params ?? {}),
      })
      if (seen.has(signature)) continue
      seen.add(signature)
      merged.push(risk)
    }

    return merged
  }

  private findEquivalentRiskIndex(risk: SeedRisk, merged: readonly SeedRisk[]): number | null {
    if (typeof risk.params.valuePct !== 'number') {
      return null
    }

    const index = merged.findIndex(candidate => (
      candidate.key === risk.key
      && candidate.params.valuePct === risk.params.valuePct
    ))

    return index >= 0 ? index : null
  }

  private stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.stableValue(item))
    }
    if (this.isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, item]) => [key, this.stableValue(item)]),
      )
    }
    return value
  }

  private atomizeTriggers(triggers: SeedTrigger[]): SeedTrigger[] {
    return triggers.map((trigger, index) => {
      const contracts = trigger.contracts ?? []
      if (contracts.some(contract => !this.isTriggerCombinationLikeContract(contract))) {
        return trigger
      }

      return {
        ...trigger,
        contracts: [
          ...contracts,
          this.buildAtomContract({
            id: `contract-seed-trigger-${index + 1}-${this.slugifyContractId(trigger.key)}`,
            kind: 'trigger',
            capability: this.buildTriggerCapability({
              ...trigger,
              params: this.stripTriggerCombinationMarkerParams(trigger.params ?? {}),
            }),
            params: this.stripTriggerCombinationMarkerParams(trigger.params ?? {}),
          }),
        ],
      }
    })
  }

  private stripTriggerCombinationMarkerParams(params: Record<string, unknown>): Record<string, unknown> {
    const {
      groupId: _groupId,
      semanticGroupId: _semanticGroupId,
      logicalGroupId: _logicalGroupId,
      combinationId: _combinationId,
      atomicCombinationId: _atomicCombinationId,
      join: _join,
      logic: _logic,
      operator: _operator,
      conditionOperator: _conditionOperator,
      actionKey: _actionKey,
      actionBinding: _actionBinding,
      role: _role,
      ...stripped
    } = params

    return stripped
  }

  private withRecognizedTriggerCombinationContracts(triggers: SeedTrigger[]): SeedTrigger[] {
    const movingAverageStackGroups = this.resolveMovingAverageStackCombinationGroups(triggers)

    return triggers.map((trigger, index) => {
      const explicit = this.resolveRecognizedTriggerCombination(trigger, movingAverageStackGroups.get(index))
      if (explicit) {
        return this.withTriggerCombinationContract(trigger, explicit)
      }

      const legacyGroupId = this.readTriggerGroupMarker(trigger)
      if (!legacyGroupId) {
        return trigger
      }

      const explicitActionKey = this.readString(trigger.params?.actionKey)
      return this.withTriggerCombinationContract(trigger, {
        groupId: legacyGroupId,
        join: this.readTriggerCombinationJoin(trigger.params ?? {}) ?? 'AND',
        ...(explicitActionKey
          ? {
              actionKey: explicitActionKey,
              actionKeySource: 'explicit' as const,
            }
          : {}),
      })
    })
  }

  private resolveRecognizedTriggerCombination(
    trigger: SeedTrigger,
    movingAverageStack: TriggerCombinationContractInput | undefined,
  ): TriggerCombinationContractInput | null {
    if (movingAverageStack) {
      return movingAverageStack
    }

    if (
      trigger.key === 'logical.any_of'
      && trigger.phase === 'exit'
      && this.isMa100MacdExitAnyOf(trigger)
    ) {
      return {
        groupId: 'exit-ma100-macd',
        join: 'OR',
      }
    }

    return null
  }

  private resolveMovingAverageStackCombinationGroups(
    triggers: SeedTrigger[],
  ): Map<number, TriggerCombinationContractInput> {
    const candidates = new Map<string, Array<{ trigger: SeedTrigger, index: number, period: number }>>()

    triggers.forEach((trigger, index) => {
      if (!this.isMovingAverageStackCandidate(trigger)) return

      const period = Number(trigger.params?.['reference.period'])
      const sideScope = trigger.sideScope ?? 'long'
      const timeframe = typeof trigger.params?.timeframe === 'string' ? trigger.params.timeframe : 'default'
      const groupKey = [
        trigger.phase,
        sideScope,
        trigger.key,
        trigger.params?.indicator,
        timeframe,
      ].join(':')
      candidates.set(groupKey, [...(candidates.get(groupKey) ?? []), { trigger, index, period }])
    })

    const groups = new Map<number, TriggerCombinationContractInput>()
    for (const members of candidates.values()) {
      const periods = Array.from(new Set(members.map(member => member.period))).sort((left, right) => left - right)
      if (periods.length < 2) continue

      const first = members[0]!.trigger
      const sideScope = first.sideScope ?? 'long'
      const indicator = String(first.params?.indicator)
      const direction = first.key === 'indicator.above' ? 'above' : 'below'
      const timeframe = typeof first.params?.timeframe === 'string' ? `-${first.params.timeframe}` : ''
      const groupId = `${first.phase}-${sideScope}-${indicator}-${direction}-stack${timeframe}-${periods.join('-')}`

      for (const member of members) {
        groups.set(member.index, { groupId, join: 'AND' })
      }
    }

    return groups
  }

  private isMovingAverageStackCandidate(trigger: SeedTrigger): boolean {
    return (trigger.phase === 'entry' || trigger.phase === 'exit')
      && (trigger.key === 'indicator.above' || trigger.key === 'indicator.below')
      && (trigger.params?.indicator === 'ema' || trigger.params?.indicator === 'ma')
      && typeof trigger.params?.['reference.period'] === 'number'
      && Number.isFinite(trigger.params['reference.period'])
  }

  private withTriggerCombinationContract(
    trigger: SeedTrigger,
    input: TriggerCombinationContractInput,
  ): SeedTrigger {
    if (trigger.contracts?.some(contract => this.isTriggerCombinationLikeContract(contract))) {
      return {
        ...trigger,
        contracts: trigger.contracts.map(contract =>
          this.isTriggerCombinationLikeContract(contract)
            ? this.upgradeTriggerCombinationContract(trigger, contract, input)
            : contract,
        ),
      }
    }

    return {
      ...trigger,
      contracts: [
        ...(trigger.contracts ?? []),
        buildTriggerCombinationContract({
          ...input,
          phase: trigger.phase,
          sideScope: trigger.sideScope,
        }),
      ],
    }
  }

  private upgradeTriggerCombinationContract(
    trigger: SeedTrigger,
    contract: SemanticAtomContract,
    input: TriggerCombinationContractInput,
  ): SemanticAtomContract {
    const standard = buildTriggerCombinationContract({
      ...input,
      phase: trigger.phase,
      sideScope: trigger.sideScope,
    })

    return {
      ...contract,
      capabilities: this.isTriggerCombinationContract(contract)
        ? [...contract.capabilities]
        : [...contract.capabilities, ...standard.capabilities],
      requires: [...contract.requires],
      params: {
        ...contract.params,
        ...standard.params,
      },
      ...(contract.effects ? { effects: [...contract.effects] } : {}),
    }
  }

  private isMa100MacdExitAnyOf(trigger: SeedTrigger): boolean {
    const items = trigger.params?.items
    if (!Array.isArray(items)) return false

    const hasMa100Breakdown = items.some(item =>
      this.isPlainObject(item)
      && item.key === 'indicator.below'
      && this.isPlainObject(item.params)
      && item.params.indicator === 'ma'
      && item.params['reference.period'] === 100,
    )
    const hasMacdDeathCross = items.some(item =>
      this.isPlainObject(item)
      && item.key === 'indicator.cross_under'
      && this.isPlainObject(item.params)
      && item.params.indicator === 'macd',
    )

    return hasMa100Breakdown && hasMacdDeathCross
  }

  private readTriggerCombinationJoin(params: Record<string, unknown>): 'AND' | 'OR' | null {
    for (const key of ['join', 'logic', 'operator', 'conditionOperator']) {
      const value = params[key]
      if (typeof value !== 'string') continue

      const normalized = value.trim().toUpperCase()
      if (normalized === 'AND' || normalized === 'OR') {
        return normalized
      }
    }

    return null
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private defaultTriggerCombinationActionKey(trigger: SeedTrigger): string {
    const side = trigger.sideScope === 'short' ? 'short' : 'long'
    return trigger.phase === 'exit' ? `close_${side}` : `open_${side}`
  }

  private groupEntryConfirmationTriggers(triggers: SeedTrigger[]): SeedTrigger[] {
    const groups = new Map<string, Array<{ trigger: SeedTrigger, index: number }>>()
    triggers.forEach((trigger, index) => {
      if (trigger.phase !== 'entry' || !this.isEntryCombinationAtom(trigger)) {
        return
      }
      const groupKey = `${trigger.phase}:${trigger.sideScope ?? 'long'}`
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), { trigger, index }])
    })

    const selectedGroups = Array.from(groups.values()).filter((group) => {
      const hasSequence = group.some(({ trigger }) => trigger.key === 'condition.sequence')
      const hasSequenceConfirmation = group.some(({ trigger }) => (
        trigger.key === 'volume.relative_average'
        || trigger.key === 'confirmation.rebound'
      ))
      const hasIndicatorBoundary = group.some(({ trigger }) => trigger.key === 'price.detect.indicator_boundary')
      const hasVolume = group.some(({ trigger }) => trigger.key === 'volume.relative_average')
      return group.length > 1 && (
        (hasSequence && hasSequenceConfirmation)
        || (hasIndicatorBoundary && hasVolume)
      )
    })
    if (selectedGroups.length === 0) {
      return triggers
    }

    const groupIdsByIndex = new Map<number, string>()
    selectedGroups.forEach((group, groupIndex) => {
      const groupId = group
        .map(({ trigger }) => this.readTriggerGroupMarker(trigger))
        .find((marker): marker is string => Boolean(marker))
        ?? `entry-atomic-confirmation-${groupIndex + 1}`
      for (const { index } of group) {
        groupIdsByIndex.set(index, groupId)
      }
    })

    return triggers.map((trigger, index) => {
      const groupId = groupIdsByIndex.get(index)
      if (!groupId || this.readTriggerGroupMarker(trigger)) {
        return trigger
      }

      return {
        ...trigger,
        params: {
          ...(trigger.params ?? {}),
          groupId,
        },
      }
    })
  }

  private isEntryCombinationAtom(trigger: SeedTrigger): boolean {
    return trigger.key === 'condition.sequence'
      || trigger.key === 'volume.relative_average'
      || trigger.key === 'confirmation.rebound'
      || trigger.key === 'price.detect.indicator_boundary'
  }

  private readTriggerGroupMarker(trigger: SeedTrigger): string | null {
    const params = trigger.params
    if (!params) return null
    const marker = params.groupId
      ?? params.displayGroupId
      ?? params.semanticGroupId
      ?? params.logicalGroupId
      ?? params.combinationId
      ?? params.atomicCombinationId
    return typeof marker === 'string' && marker.trim().length > 0 ? marker.trim() : null
  }

  private inheritIndicatorBoundaryConfirmationModes(triggers: SeedTrigger[]): SeedTrigger[] {
    const groups = new Map<string, Array<{ trigger: SeedTrigger, index: number }>>()

    triggers.forEach((trigger, index) => {
      if (trigger.key !== 'price.detect.indicator_boundary') {
        return
      }

      const indicator = trigger.params?.indicator
      const indicatorName = this.isPlainObject(indicator) && typeof indicator.name === 'string'
        ? indicator.name.toLowerCase()
        : null
      if (!indicatorName) {
        return
      }

      const groupKey = `${indicatorName}:${trigger.sideScope ?? 'both'}`
      groups.set(groupKey, [...(groups.get(groupKey) ?? []), { trigger, index }])
    })

    if (groups.size === 0) {
      return triggers
    }

    const inheritedByIndex = new Map<number, string>()
    for (const group of groups.values()) {
      const modes = Array.from(new Set(
        group
          .map(({ trigger }) => typeof trigger.params?.confirmationMode === 'string' ? trigger.params.confirmationMode : null)
          .filter((mode): mode is string => Boolean(mode)),
      ))
      if (modes.length !== 1) {
        continue
      }

      for (const { trigger, index } of group) {
        if (typeof trigger.params?.confirmationMode !== 'string') {
          inheritedByIndex.set(index, modes[0])
        }
      }
    }

    if (inheritedByIndex.size === 0) {
      return triggers
    }

    return triggers.map((trigger, index) => {
      const confirmationMode = inheritedByIndex.get(index)
      if (!confirmationMode) {
        return trigger
      }

      return {
        ...trigger,
        params: {
          ...(trigger.params ?? {}),
          confirmationMode,
        },
      }
    })
  }

  private atomizeActions(actions: SeedAction[]): SeedAction[] {
    return actions.map((action, index) => (
      this.hasContracts(action)
        ? action
        : {
            ...action,
            contracts: [this.buildActionContract(action, index)],
          }
    ))
  }

  private buildActionContract(action: SeedAction, index: number): SemanticAtomContract {
    const contract = this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(action.key)}`,
      kind: 'action',
      capability: this.buildActionCapability(action),
      params: action.params ?? {},
    })

    if (action.key === 'action.reduce_position') {
      return {
        ...contract,
        orderRequirements: [
          ...contract.orderRequirements,
          { domain: 'order', verb: 'enforce', object: 'no_exposure_increase' },
        ],
        effects: [
          { domain: 'exposure', verb: 'reduce', object: 'position' },
        ],
      }
    }

    if (action.key === 'action.add_position') {
      return {
        ...contract,
        effects: [
          { domain: 'exposure', verb: 'increase', object: 'position' },
        ],
      }
    }

    if (action.key === 'action.reverse_position') {
      return {
        ...contract,
        effects: [
          { domain: 'exposure', verb: 'reduce', object: 'position', shape: this.toCapabilityShape({ phase: 'close_current' }) },
          { domain: 'exposure', verb: 'increase', object: 'position', shape: this.toCapabilityShape({ phase: 'open_opposite' }) },
        ],
      }
    }

    return contract
  }

  private atomizeRisk(risk: SeedRisk[]): SeedRisk[] {
    return risk.map((riskItem, index) => (
      this.hasContracts(riskItem)
        ? riskItem
        : {
            ...riskItem,
            contracts: [this.buildAtomContract({
              id: `contract-seed-risk-${index + 1}-${this.slugifyContractId(riskItem.key)}`,
              kind: 'risk',
              capability: this.buildRiskCapability(riskItem),
              params: riskItem.params,
            })],
          }
    ))
  }

  private atomizePosition(
    position: NonNullable<CodegenSemanticPatch['position']> | null,
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    if (!position || this.hasContracts(position)) {
      return position
    }

    return {
      ...position,
      contracts: [this.buildAtomContract({
        id: 'contract-seed-position-sizing',
        kind: 'position',
        capability: this.buildPositionCapability(position),
        params: {
          sizing: position.sizing ?? null,
          mode: position.mode,
          value: position.value,
          positionMode: position.positionMode,
        },
      })],
    }
  }

  private hasContracts(node: { contracts?: SemanticAtomContract[] }): boolean {
    return Array.isArray(node.contracts) && node.contracts.length > 0
  }

  private isTriggerCombinationContract(contract: SemanticAtomContract): boolean {
    return contract.kind === 'trigger'
      && contract.capabilities.some(capability =>
        capability.domain === 'market'
        && capability.verb === 'combine'
        && capability.object === 'predicate_group',
      )
  }

  private isTriggerCombinationLikeContract(contract: SemanticAtomContract): boolean {
    return contract.kind === 'trigger' && this.readString(contract.params.groupId) !== null
  }

  private buildAtomContract(input: {
    id: string
    kind: SemanticContractKind
    capability: SemanticCapability
    params: Record<string, unknown>
  }): SemanticAtomContract {
    return {
      id: input.id,
      kind: input.kind,
      capabilities: [input.capability],
      requires: [],
      params: input.params,
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    }
  }

  private buildTriggerCapability(trigger: SeedTrigger): SemanticCapability {
    if (trigger.key === 'grid.range_rebalance') {
      return {
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'execution.on_start') {
      return {
        domain: 'order_program',
        verb: 'schedule',
        object: 'execution_trigger',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'price.detect.indicator_boundary') {
      return {
        domain: 'price',
        verb: 'detect',
        object: 'indicator_boundary',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'volume.spike' || trigger.key === 'volume.threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_condition',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'volume.relative_average') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_relative_average',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'volatility.atr_threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volatility_condition',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'condition.sequence') {
      return {
        domain: 'price',
        verb: 'detect',
        object: 'sequence_condition',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    if (trigger.key === 'confirmation.rebound') {
      return {
        domain: 'price',
        verb: 'confirm',
        object: 'rebound',
        shape: this.toCapabilityShape({
          key: trigger.key,
          phase: trigger.phase,
          sideScope: trigger.sideScope ?? null,
          ...(trigger.params ?? {}),
        }),
      }
    }

    return {
      domain: 'price',
      verb: 'detect',
      object: 'signal_condition',
      shape: this.toCapabilityShape({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope ?? null,
        ...(trigger.params ?? {}),
      }),
    }
  }

  private buildActionCapability(action: SeedAction): SemanticCapability {
    return {
      domain: 'order_program',
      verb: 'execute',
      object: 'order_action',
      shape: this.toCapabilityShape({
        key: action.key,
        side: this.resolveActionSide(action.key),
        intent: this.resolveActionIntent(action.key),
        ...(action.params ?? {}),
      }),
    }
  }

  private buildRiskCapability(risk: SeedRisk): SemanticCapability {
    if (risk.key === 'risk.stop_loss_pct') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'stop_loss',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    if (risk.key === 'risk.take_profit_pct') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'take_profit',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    if (risk.key === 'risk.atr_stop') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'atr_stop',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    if (risk.key === 'risk.partial_take_profit') {
      return {
        domain: 'guard',
        verb: 'enforce',
        object: 'partial_take_profit',
        shape: this.toCapabilityShape({
          key: risk.key,
          ...risk.params,
        }),
      }
    }

    return {
      domain: 'guard',
      verb: 'enforce',
      object: 'risk_condition',
      shape: this.toCapabilityShape({
        key: risk.key,
        ...risk.params,
      }),
    }
  }

  private buildPositionCapability(
    position: NonNullable<CodegenSemanticPatch['position']>,
  ): SemanticCapability {
    return {
      domain: 'capital',
      verb: 'allocate',
      object: 'position_sizing',
      shape: this.toCapabilityShape({
        sizing: position.sizing ?? null,
        mode: position.mode,
        value: position.value,
        positionMode: position.positionMode,
      }),
    }
  }

  private resolveActionSide(key: string): 'long' | 'short' | 'unknown' {
    if (key.includes('long')) return 'long'
    if (key.includes('short')) return 'short'
    return 'unknown'
  }

  private resolveActionIntent(key: string): 'open' | 'close' | 'unknown' {
    if (key.startsWith('open_')) return 'open'
    if (key.startsWith('close_')) return 'close'
    return 'unknown'
  }

  private toCapabilityShape(input: Record<string, unknown>): SemanticCapabilityShape {
    const shape: SemanticCapabilityShape = {}
    for (const [key, value] of Object.entries(input)) {
      const normalizedValue = this.toCapabilityShapeValue(value)
      if (normalizedValue !== undefined) {
        shape[key] = normalizedValue
      }
    }
    return shape
  }

  private toCapabilityShapeValue(
    value: unknown,
  ): string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[] | undefined {
    if (value === null) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return Number.isNaN(value) ? undefined : value
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.toCapabilityArrayItem(item))
        .filter((item): item is SemanticCapabilityShape => item !== undefined)
    }
    if (this.isPlainObject(value)) {
      return this.toCapabilityShape(value)
    }
    return undefined
  }

  private toCapabilityArrayItem(value: unknown): SemanticCapabilityShape | undefined {
    const normalizedValue = this.toCapabilityShapeValue(value)
    if (normalizedValue === undefined) {
      return undefined
    }
    if (
      normalizedValue === null
      || typeof normalizedValue === 'string'
      || typeof normalizedValue === 'number'
      || typeof normalizedValue === 'boolean'
    ) {
      return { value: normalizedValue }
    }
    if (Array.isArray(normalizedValue)) {
      return { items: normalizedValue }
    }
    return normalizedValue
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private slugifyContractId(value: string): string {
    return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'atom'
  }

  private extractContextSlots(text: string): NonNullable<CodegenSemanticPatch['contextSlots']> {
    const contextSlots: NonNullable<CodegenSemanticPatch['contextSlots']> = {}

    const exchange = this.extractExchange(text)
    if (exchange) {
      contextSlots.exchange = exchange
    }

    const marketType = this.extractMarketType(text)
    if (marketType) {
      contextSlots.marketType = marketType
    }

    const symbol = this.extractSymbol(text)
    if (symbol) {
      contextSlots.symbol = symbol
      if (symbol.marketTypeHint && !contextSlots.marketType) {
        contextSlots.marketType = symbol.marketTypeHint
      }
    }

    const timeframes = this.extractExecutionContextTimeframes(text)
    const timeframe = this.hasMultiTimeframeMovingAveragePredicateScope(text)
      ? null
      : (timeframes[0] ?? this.extractFirstExecutionContextTimeframe(text))
    if (timeframe) {
      contextSlots.timeframe = timeframe
    }

    return contextSlots
  }

  private extractTriggers(text: string, aliasContext: SemanticAliasContext): SeedTrigger[] {
    const triggers: SeedTrigger[] = []
    const seen = new Set<string>()
    const segments = this.splitSegments(text)

    for (const segment of segments) {
      this.pushCandleExpressionTriggers(segment, triggers, seen)
      this.pushNoPositionGateTriggers(segment, triggers, seen, text)
      this.pushPreviousBarExtremaExpressionTriggers(segment, triggers, seen)
      this.pushMovingAverageCrossTrigger(segment, triggers, seen)
      this.pushMovingAverageGateTriggers(segment, triggers, seen)
      this.pushMovingAverageTrigger(segment, triggers, seen, aliasContext)
      this.pushBollingerTriggers(segment, triggers, seen, aliasContext)
      this.pushIndicatorBoundaryTriggers(segment, triggers, seen, aliasContext)
      this.pushSequenceTriggers(segment, triggers, seen)
      this.pushRsiTriggers(segment, triggers, seen, aliasContext)
      this.pushMacdTriggers(segment, triggers, seen, text)
      this.pushPartialBreakoutTriggers(segment, triggers, seen)
      this.pushRollingExtremaBreakoutTriggers(segment, triggers, seen)
      this.pushBreakoutTriggers(segment, triggers, seen)
      this.pushRangePositionTriggers(segment, triggers, seen, text)
      this.pushGridTrigger(segment, triggers, seen, text)
      this.pushExecutionTrigger(segment, triggers, seen)
      this.pushPercentChangeTrigger(segment, triggers, seen, text)
      this.pushVagueDipBuyingTriggers(segment, triggers, seen)
      this.pushVolumeRelativeAverageTriggers(segment, triggers, seen)
      this.pushReboundConfirmationTriggers(segment, triggers, seen)
      this.pushLogicalAnyOfTriggers(segment, triggers, seen)
      this.pushMarketStateTriggers(segment, triggers, seen)
      this.pushRecognizedUnsupportedTriggers(segment, triggers, seen)
      this.pushUnknownUnsupportedTriggers(segment, triggers, seen)
    }

    if (!triggers.some(trigger => trigger.key === 'grid.range_rebalance')) {
      this.pushGridTrigger(text, triggers, seen)
    }
    this.pushDcaPercentChangeTrigger(text, triggers, seen)

    return this.removeLogicalAnyOfExitChildren(this.harmonizeBollingerTriggers(triggers))
  }

  private extractActions(text: string, triggers: SeedTrigger[]): NonNullable<CodegenSemanticPatch['actions']> {
    const actions: SeedAction[] = []
    const seen = new Set<string>()
    const push = (key: string, params?: Record<string, unknown>, extra?: Omit<SeedAction, 'key' | 'params'>) => {
      const action: SeedAction = {
        key,
        ...(params ? { params } : {}),
        ...(extra ?? {}),
      }
      const signature = JSON.stringify(action)
      if (seen.has(signature)) return
      seen.add(signature)
      actions.push(action)
    }
    const hasShortTrigger = triggers.some(trigger => trigger.sideScope === 'short')
    const hasLongTrigger = triggers.some(trigger => trigger.sideScope === 'long')

    for (const trigger of triggers) {
      if (trigger.key === 'grid.range_rebalance') {
        if (trigger.sideScope === 'short') {
          push('open_short', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
          push('close_short')
        } else if (trigger.sideScope === 'both') {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
          push('close_long')
          push('open_short')
          push('close_short')
        } else {
          push('open_long', undefined, this.buildGridOrderProgramActionContracts(text, trigger))
          push('close_long')
        }
        continue
      }

      if (trigger.phase === 'entry') {
        if (trigger.sideScope === 'short') {
          push('open_short')
        } else if (trigger.sideScope === 'long') {
          push('open_long')
        } else if (trigger.sideScope === 'both') {
          push('open_long')
          push('open_short')
        }
        continue
      }

      if (trigger.phase === 'exit') {
        if (trigger.sideScope === 'short') {
          push('close_short')
        } else if (trigger.sideScope === 'long') {
          push('close_long')
        } else if (trigger.sideScope === 'both') {
          push('close_long')
          push('close_short')
        }
      }
    }

    if (actions.length === 0 && (hasShortTrigger || hasLongTrigger)) {
      push('open_long')
    }

    this.pushRecognizedUnsupportedActions(text, actions, seen)

    return actions
  }

  private extractPositionLifecycleActions(text: string): SeedAction[] {
    const actions: SeedAction[] = []
    const push = (action: SeedAction) => {
      if (actions.some(item => JSON.stringify([item.key, item.params]) === JSON.stringify([action.key, action.params]))) {
        return
      }
      actions.push(action)
    }

    for (const clause of this.splitPositionLifecycleClauses(text)) {
      if (!/(?:减仓|scale\s*out)/iu.test(clause) || this.hasNegatedPositionLifecycleActionContext(clause)) {
        continue
      }
      const reducePercent = this.extractPercentAfterKeywords(clause, ['减仓', '减'])
      if (reducePercent !== null && reducePercent > 0 && reducePercent <= 100) {
        push({
          key: 'action.reduce_position',
          params: {
            sideScope: this.resolveLifecycleSideScope(clause),
            reduceBasis: 'ratio',
            reduceValue: reducePercent / 100,
          },
        })
      }
    }

    for (const clause of this.extractAddPositionLifecycleTexts(text)) {
      if (this.hasNegatedPositionLifecycleActionContext(clause)) {
        continue
      }
      const sizingPercent = this.extractPercentAfterKeywords(clause, ['每次加仓', '加仓', '每次'])
      push({
        key: 'action.add_position',
        params: {
          sideScope: this.resolveLifecycleSideScope(clause),
          ...(sizingPercent !== null && sizingPercent > 0 && sizingPercent <= 100
            ? { sizing: { kind: 'ratio', value: sizingPercent / 100, unit: 'ratio' } }
            : {}),
        },
      })
    }

    for (const clause of this.splitPositionLifecycleClauses(text)) {
      if (!/(?:反手|reverse\s+position|flip\s+position)/iu.test(clause) || this.hasNegatedPositionLifecycleActionContext(clause)) {
        continue
      }
      const fromSide = /平空|空单/u.test(clause) && /做多|开多/u.test(clause) ? 'short' : 'long'
      const toSide = fromSide === 'long' ? 'short' : 'long'
      push({
        key: 'action.reverse_position',
        params: {
          fromSide,
          toSide,
          sameBarPolicy: /允许.{0,12}(?:同一根|同根).{0,8}K|(?:同一根|同根).{0,8}K.{0,12}允许/u.test(text)
            ? 'allow'
            : 'next_bar_only',
          sizingSource: /沿用(?:原|当前)?仓位|原仓位|当前仓位|same\s+size/iu.test(text)
            ? 'current_position'
            : 'explicit',
        },
      })
    }

    return actions
  }

  private extractPositionLifecycleConstraints(text: string): NonNullable<CodegenSemanticPatch['position']>['constraints'] {
    const constraints: SeedPositionConstraint[] = []

    for (const clause of this.extractAddPositionLifecycleTexts(text)) {
      if (this.hasNegatedPositionLifecycleActionContext(clause)) {
        continue
      }
      const maxLayers = this.extractNumberBefore(clause, ['次', '层'], /(?:次|层)/u)
      const layerPercent = this.extractPercentAfterKeywords(clause, ['每次加仓', '加仓', '每次'])
      if (maxLayers !== null && maxLayers > 0) {
        constraints.push({
          key: 'position.pyramiding_limit',
          params: {
            maxLayers,
            ...(layerPercent !== null && layerPercent > 0 && layerPercent <= 100
              ? { layerSizing: { kind: 'ratio', value: layerPercent / 100, unit: 'ratio' } }
              : {}),
          },
        })
      }
    }

    for (const clause of this.extractDcaLifecycleTexts(text)) {
      const maxCount = this.extractNumberBefore(clause, ['次'], /(?:次|回)/u)
      const perOrderSizing = this.extractQuoteAmountAfter(clause, '每次')
      const capitalCap = this.extractQuoteAmountAfter(clause, '总投入不超过')
        ?? this.extractQuoteAmountAfter(clause, '总投入')
      const exitRule = this.hasDcaExitRule(clause) ? this.resolveDcaExitRule(clause) : null
      constraints.push({
        key: 'position.dca_schedule',
        params: {
          ...(maxCount !== null && maxCount > 0 ? { maxCount } : {}),
          ...(perOrderSizing ? { perOrderSizing } : {}),
          ...(capitalCap ? { capitalCap } : {}),
          triggerMode: 'price_interval',
          ...(exitRule ? { exitRule } : {}),
        },
      })
    }

    return constraints
  }

  private withPositionLifecycleConstraints(
    position: NonNullable<CodegenSemanticPatch['position']> | null,
    lifecycleConstraints: NonNullable<NonNullable<CodegenSemanticPatch['position']>['constraints']>,
    hasLifecycleActions = false,
    lifecyclePositionMode: 'long_only' | 'short_only' | 'long_short' = 'long_only',
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    if (lifecycleConstraints.length === 0 && !hasLifecycleActions) {
      return position
    }

    if (!position) {
      return {
        mode: 'constraint_only',
        value: 0,
        positionMode: lifecyclePositionMode,
        ...(lifecycleConstraints.length > 0 ? { constraints: lifecycleConstraints } : {}),
      }
    }

    return {
      ...position,
      constraints: [
        ...(position.constraints ?? []),
        ...lifecycleConstraints,
      ],
    }
  }

  private resolveLifecyclePositionMode(
    text: string,
    actions: readonly SeedAction[],
    constraints: readonly SeedPositionConstraint[],
  ): 'long_only' | 'short_only' | 'long_short' {
    const sideScopes = actions
      .map(action => action.params?.sideScope)
      .filter((value): value is 'long' | 'short' | 'both' => value === 'long' || value === 'short' || value === 'both')

    if (constraints.length > 0 && sideScopes.length === 0) {
      sideScopes.push(this.resolveLifecycleSideScope(text))
    }

    const uniqueSides = new Set(sideScopes)
    if (uniqueSides.has('both') || (uniqueSides.has('long') && uniqueSides.has('short'))) {
      return 'long_short'
    }
    if (uniqueSides.has('short')) {
      return 'short_only'
    }
    return 'long_only'
  }

  private extractAddPositionLifecycleTexts(text: string): string[] {
    const texts: string[] = []
    for (const segment of this.splitPositionLifecycleSegments(text)) {
      const clauses = this.splitPositionLifecycleClauses(segment)
      const addClauses = clauses.filter(clause =>
        /(?:加仓|scale\s*in)/iu.test(clause)
        && !this.isDcaLifecycleClause(clause)
        && !this.hasNegatedPositionLifecycleActionContext(clause),
      )
      if (addClauses.length === 0) continue

      texts.push(addClauses.join('，'))
    }

    return texts
  }

  private extractDcaLifecycleTexts(text: string): string[] {
    const texts: string[] = []
    for (const segment of this.splitPositionLifecycleSegments(text)) {
      const clauses = this.splitPositionLifecycleClauses(segment)
      for (let index = 0; index < clauses.length; index += 1) {
        if (!this.isDcaLifecycleStartClause(clauses[index])) continue

        const dcaClauses: string[] = []
        for (const clause of clauses.slice(index)) {
          if (
            dcaClauses.length > 0
            && /(?:加仓|减仓|反手|scale\s*in|scale\s*out|reverse\s+position|flip\s+position)/iu.test(clause)
            && !this.isDcaLifecycleStartClause(clause)
          ) {
            break
          }
          dcaClauses.push(clause)
        }

        const dcaText = dcaClauses.join('，')
        if (
          dcaText
          && /(?:补仓|DCA|dca|定投)/u.test(dcaText)
          && !this.hasNegatedUnsupportedPositionContext(dcaText)
        ) {
          texts.push(dcaText)
          break
        }
      }
    }

    return texts
  }

  private splitPositionLifecycleSegments(text: string): string[] {
    return text
      .split(/[；;。]/u)
      .map(segment => segment.trim())
      .filter(Boolean)
  }

  private splitPositionLifecycleClauses(text: string): string[] {
    return text
      .split(/[，,.;；。]/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private isDcaLifecycleClause(clause: string): boolean {
    if (this.hasNegatedUnsupportedPositionContext(clause)) {
      return false
    }

    return /(?:DCA|dca|定投)/u.test(clause)
      || (/(?:每跌|每下跌)/u.test(clause) && /补仓/u.test(clause))
  }

  private isDcaLifecycleStartClause(clause: string): boolean {
    if (this.hasNegatedUnsupportedPositionContext(clause)) {
      return false
    }

    return /(?:每跌|每下跌|DCA|dca|定投)/u.test(clause)
  }

  private withInheritedLifecycleContextSlots(
    contextSlots: NonNullable<CodegenSemanticPatch['contextSlots']>,
  ): NonNullable<CodegenSemanticPatch['contextSlots']> {
    return {
      exchange: contextSlots.exchange ?? this.buildInheritedLifecycleContextSlot('exchange', 'contextSlots.exchange'),
      symbol: contextSlots.symbol ?? this.buildInheritedLifecycleContextSlot('symbol', 'contextSlots.symbol'),
      marketType: contextSlots.marketType ?? this.buildInheritedLifecycleContextSlot('marketType', 'contextSlots.marketType'),
      timeframe: contextSlots.timeframe ?? this.buildInheritedLifecycleContextSlot('timeframe', 'contextSlots.timeframe'),
    }
  }

  private buildInheritedLifecycleContextSlot(slotKey: string, fieldPath: string): SemanticSlotState {
    return {
      slotKey,
      fieldPath,
      value: 'inherited',
      status: 'locked',
      priority: 'context',
      questionHint: '沿用当前策略上下文。',
      affectsExecution: true,
    }
  }

  private resolveLifecycleSideScope(text: string): 'long' | 'short' | 'both' {
    if (/双向|多空|long\s*\/\s*short/iu.test(text)) return 'both'
    if (/空单|做空|开空|平空|short/iu.test(text) && !/多单|做多|开多|平多|long/iu.test(text)) return 'short'
    return 'long'
  }

  private extractPercentAfterKeywords(text: string, keywords: readonly string[]): number | null {
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      const match = text.match(new RegExp(`${escaped}\\s*(?:[:：]?\\s*)?(\\d+(?:\\.\\d+)?)\\s*%`, 'iu'))
        ?? text.match(new RegExp(`${escaped}\\s*(?:[:：]?\\s*)?百分之?\\s*(\\d+(?:\\.\\d+)?)`, 'iu'))
      if (!match?.[1]) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }

    return null
  }

  private extractNumberBefore(text: string, _units: readonly string[], pattern: RegExp): number | null {
    const unitPattern = _units
      .map(unit => unit.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('|')
    const maxMatch = text.match(new RegExp(`最多(?:加仓|补仓)?\\s*(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]+)\\s*(?:${unitPattern})`, 'u'))
    if (maxMatch?.[1]) {
      return this.parseChineseInteger(maxMatch[1])
    }

    const directMatches = Array.from(text.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]+)\\s*(?:${unitPattern})`, 'gu')))
    const last = directMatches.at(-1)?.[1]
    if (last) {
      return this.parseChineseInteger(last)
    }

    if (!pattern.test(text)) return null

    return null
  }

  private extractQuoteAmountAfter(text: string, keyword: string): { kind: 'quote'; value: number; asset: QuoteAsset } | null {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const match = text.match(new RegExp(`${escaped}.{0,12}?(\\d+(?:\\.\\d+)?)\\s*(USDT|USDC|USD|U)(?![A-Z0-9])`, 'iu'))
    if (!match?.[1] || !match[2]) return null

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return null

    const asset = this.normalizeQuoteAsset(match[2])
    return { kind: 'quote', value, asset }
  }

  private normalizeQuoteAsset(asset: string): QuoteAsset {
    const normalized = asset.toUpperCase()
    if (normalized === 'USDC') return 'USDC'
    if (normalized === 'USD') return 'USD'
    return 'USDT'
  }

  private hasDcaExitRule(text: string): boolean {
    return /(?:跌破|下破|失守).{0,8}前低.{0,8}(?:停止|暂停|不再|终止)|(?:停止|暂停|不再|终止).{0,12}(?:补仓|DCA|定投)/iu.test(text)
  }

  private resolveDcaExitRule(text: string): Record<string, string> {
    if (/(?:跌破|下破|失守).{0,8}前低/iu.test(text)) {
      return {
        type: 'stop_on_break_previous_low',
        reference: 'previous_low',
      }
    }

    return {
      type: 'stop_dca',
      sourceText: text,
    }
  }

  private buildGridOrderProgramActionContracts(text: string, trigger: SeedTrigger): Omit<SeedAction, 'key' | 'params'> | undefined {
    if (!this.hasLevelSetContract(trigger) && !this.hasGridSemantics(text)) {
      return undefined
    }

    const perOrderBudget = this.extractPerGridBudget(text)
    const shouldRecycleOnFill = /反向挂单|反向单|相邻网格|成交后|双向网格|真实网格/u.test(text)
    return {
      contracts: [{
        id: 'contract-grid-limit-ladder',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: {
              orderType: 'limit',
              timeInForce: 'gtc',
              recycleOnFill: shouldRecycleOnFill,
              pairingPolicy: shouldRecycleOnFill || /相邻/u.test(text) ? 'adjacent_level' : 'grid_level',
            },
          },
          ...(perOrderBudget
            ? [{
                domain: 'capital' as const,
                verb: 'allocate',
                object: 'per_order_budget',
                shape: {
                  value: perOrderBudget.value,
                  asset: perOrderBudget.asset,
                },
              }]
            : []),
        ],
        requires: [],
        params: {},
        runtimeRequirements: [],
        stateRequirements: [],
        orderRequirements: [],
        openSlots: [],
      }],
    }
  }

  private hasLevelSetContract(trigger: SeedTrigger): boolean {
    return trigger.contracts?.some(contract =>
      contract.capabilities.some(capability =>
        capability.domain === 'price'
        && capability.verb === 'define'
        && capability.object === 'level_set',
      ),
    ) ?? false
  }

  private extractPerGridBudget(text: string): { value: number; asset: 'USDT' | 'USDC' | 'USD' } | null {
    const match = text.match(/每格(?:下单)?(?:资金|金额|预算)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
      ?? text.match(/(?:每一格|单格)(?:下单)?(?:资金|金额|预算)?\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|U|u|刀)/u)
    if (!match?.[1] || !match[2]) {
      return null
    }

    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) {
      return null
    }

    const rawAsset = match[2].toUpperCase()
    const asset = rawAsset === 'USDC' ? 'USDC' : (rawAsset === 'USD' ? 'USD' : 'USDT')
    return { value, asset }
  }

  private extractRisk(text: string): NonNullable<CodegenSemanticPatch['risk']> {
    const risk: NonNullable<CodegenSemanticPatch['risk']> = []

    const stopLossPatterns = [
      /亏损\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /亏损\s*[：:]?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止损\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /止损\s*[：:]?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止损|亏损)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止损|亏损)/u,
    ]
    const stopLossClause = this.splitRiskClauses(text)
      .find(clause => !this.isHaltOnlyRiskContext(clause) && this.extractPercent(clause, stopLossPatterns) !== null)
    const stopLoss = stopLossClause ? this.extractPercent(stopLossClause, stopLossPatterns) : null
    if (stopLoss !== null && stopLossClause) {
      const riskContext = this.resolveRiskClauseContext(stopLossClause, 'stop_loss')
      const basis = this.resolveRiskBasis(riskContext)
      const basisSource = this.resolveRiskBasisSource(riskContext, basis)
      risk.push({
        key: 'risk.stop_loss_pct',
        params: {
          valuePct: stopLoss,
          direction: 'loss',
          basis,
          basisSource,
          effect: 'close_position',
          scope: 'current_position',
        },
      })
    }

    const takeProfit = this.extractPercent(text, [
      /盈利\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利(?:达到|达|到)?\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /盈利\s*[：:]?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /止盈\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /止盈\s*[：:]?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /(\d+(?:\.\d+)?)\s*%\s*(?:止盈|盈利)/u,
      /百分之?\s*(\d+(?:\.\d+)?)\s*(?:止盈|盈利)/u,
    ])
    if (takeProfit !== null) {
      const riskContext = this.resolveRiskClauseContext(text, 'take_profit')
      const basis = this.resolveRiskBasis(riskContext)
      const basisSource = this.resolveRiskBasisSource(riskContext, basis)
      risk.push({
        key: 'risk.take_profit_pct',
        params: {
          valuePct: takeProfit,
          direction: 'profit',
          basis,
          basisSource,
          effect: 'close_position',
          scope: 'current_position',
        },
      })
    }

    const trailingStop = this.extractPercent(text, [
      /移动止损\s*[：:]?\s*(\d+(?:\.\d+)?)\s*%/u,
      /trailing[_\s-]?stop\D{0,8}(\d+(?:\.\d+)?)\s*%/iu,
    ])
    if (trailingStop !== null && !/(?:ATR|平均真实波幅).{0,12}(?:移动止损|动态止损|止损|trailing)/iu.test(text)) {
      risk.push({
        key: 'risk.trailing_stop_pct',
        params: {
          valuePct: trailingStop,
          direction: 'loss',
          basis: 'entry_avg_price',
          basisSource: 'user_explicit',
          effect: 'close_position',
          scope: 'current_position',
        },
      })
    }

    const strategyHaltLoss = this.extractPercent(text, [
      /持仓亏损(?:超过|达到|达|到)\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /亏损(?:超过|达到|达|到)\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /亏损\s*(\d+(?:\.\d+)?)\s*%.*(?:暂停策略|停止策略)/u,
      /(\d+(?:\.\d+)?)\s*%\s*亏损.*(?:暂停策略|停止策略)/u,
    ])
    if (strategyHaltLoss !== null) {
      const condition: SemanticExpression = {
        kind: 'predicate',
        left: { kind: 'position', field: 'pnl_pct' },
        op: 'LTE',
        right: { kind: 'constant', value: -strategyHaltLoss, unit: 'percent' },
      }
      risk.push({
        key: 'risk.condition_expression',
        params: {
          condition,
          effect: { type: 'pause_strategy' },
          scope: 'strategy',
          capabilityStatus: 'recognized_unsupported',
          unsupportedReason: 'risk_expression_compiler_not_available',
        },
      })
    }

    const boundaryGuard = this.extractBoundaryGuardRisk(text)
    if (boundaryGuard) {
      risk.push(boundaryGuard)
    }

    this.pushAtrMultipleRisk(text, risk)
    this.pushRememberedLevelStopRisk(text, risk)
    this.pushFallingKnifeRisk(text, risk)
    this.pushRecognizedUnsupportedRisk(text, risk)

    return risk
  }

  private pushRecognizedUnsupportedRisk(text: string, risk: SeedRisk[]): void {
    const clauses = this.splitRiskClauses(text)

    for (const clause of clauses) {
      if (this.hasNegatedUnsupportedContext(clause)) continue

      if (this.hasAtrStopSemantics(clause)) {
        this.pushRisk(risk, {
          key: 'risk.atr_stop',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }

    this.pushPartialTakeProfitRisk(text, clauses, risk)
  }

  private readonly partialTakeProfitPhraseRe = /(?:分批止盈|部分止盈|多档止盈|分.{1,3}档止盈|平一半|scale\s*out|take\s*profit)/iu

  private pushPartialTakeProfitRisk(text: string, clauses: string[], risk: SeedRisk[]): void {
    const allNegated = clauses.every((c) => this.hasNegatedUnsupportedContext(c))
    if (allNegated) return

    const matchingClause = clauses.find(
      (clause) =>
        !this.hasNegatedUnsupportedContext(clause) &&
        this.partialTakeProfitPhraseRe.test(clause),
    )

    // Try full text first (captures multi-tier expressions joined by separators)
    const tiersFromText = this.extractPartialTakeProfitTiers(text)

    // Case A: explicit phrase trigger found
    if (matchingClause) {
      const tiers = tiersFromText ?? this.extractPartialTakeProfitTiers(matchingClause)
      const sourceText = tiersFromText ? text : matchingClause
      if (tiers && tiers.length > 0) {
        this.pushRisk(risk, {
          key: 'risk.partial_take_profit',
          params: { tiers, sourceText },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
      else {
        this.pushRisk(risk, {
          key: 'risk.partial_take_profit',
          params: { sourceText: matchingClause },
          status: 'open',
          source: 'user_explicit',
          openSlots: [{
            slotKey: 'risk.partial_take_profit.tiers',
            fieldPath: 'risk.params.tiers',
            status: 'open',
            priority: 'risk',
            questionHint: '请说明分批止盈每档的触发条件（PnL 百分比）和减仓比例',
            affectsExecution: true,
          }],
        })
      }
      return
    }

    // Case B: no explicit phrase, but structured multi-tier pattern detected on full text
    if (tiersFromText && tiersFromText.length >= 2) {
      this.pushRisk(risk, {
        key: 'risk.partial_take_profit',
        params: { tiers: tiersFromText, sourceText: text },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })
    }
  }

  private extractPartialTakeProfitTiers(clause: string): Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> | null {
    const tiers: Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> = []

    // 模式 4: "第N档 +X% 减/平 Y%"（最具结构，优先）
    const tierPattern = /第[一二三四五六七八九十]+档\s*\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:减|平)\s*(\d+(?:\.\d+)?)\s*%/giu
    let match
    while ((match = tierPattern.exec(clause)) !== null) {
      tiers.push({
        trigger: { kind: 'pnl_pct', threshold: Number(match[1]) },
        reduceRatio: Number(match[2]) / 100,
      })
    }
    if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

    // 模式 1: "盈利/赚 X% 平/减/止盈 Y%"
    const cnPattern = /(?:盈利|赚)\s*\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:平|减|止盈)\s*(\d+(?:\.\d+)?)\s*%/giu
    while ((match = cnPattern.exec(clause)) !== null) {
      tiers.push({
        trigger: { kind: 'pnl_pct', threshold: Number(match[1]) },
        reduceRatio: Number(match[2]) / 100,
      })
    }
    if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

    // 模式 2: "+X% 平一半/剩下/全部/Y%"（中文口语）
    const cnColloqPattern = /\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:平|减|止盈)\s*(?:(\d+(?:\.\d+)?)\s*%|(一半|剩下|全部|全平))/giu
    while ((match = cnColloqPattern.exec(clause)) !== null) {
      const threshold = Number(match[1])
      const ratioPct = match[2] ? Number(match[2]) : null
      const colloquial = match[3] ?? null
      const reduceRatio = ratioPct !== null ? ratioPct / 100 : (colloquial === '一半' ? 0.5 : 1.0)
      tiers.push({ trigger: { kind: 'pnl_pct', threshold }, reduceRatio })
    }
    if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

    // 模式 3: 英文 "Y% at +X%"
    const enPattern = /(\d+(?:\.\d+)?)\s*%\s*(?:at|@)\s*\+?\s*(\d+(?:\.\d+)?)\s*%/giu
    while ((match = enPattern.exec(clause)) !== null) {
      tiers.push({
        trigger: { kind: 'pnl_pct', threshold: Number(match[2]) },
        reduceRatio: Number(match[1]) / 100,
      })
    }
    if (tiers.length > 0) return this.normalizePartialTakeProfitTiers(tiers)

    return null
  }

  private normalizePartialTakeProfitTiers(
    tiers: Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }>,
  ): Array<{ trigger: { kind: 'pnl_pct'; threshold: number }; reduceRatio: number }> | null {
    const sorted = [...tiers].sort((a, b) => a.trigger.threshold - b.trigger.threshold)
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].trigger.threshold <= sorted[i - 1].trigger.threshold) return null
    }
    // Validate each ratio in range (0, 1]
    for (const tier of sorted) {
      if (!Number.isFinite(tier.reduceRatio) || tier.reduceRatio <= 0 || tier.reduceRatio > 1) return null
    }
    // Sum check: only enforce sum ≤ 1 when no tier has reduceRatio = 1.0
    // A tier with reduceRatio = 1.0 means "close all remaining" (e.g., "平剩下"), which is always valid
    const hasCloseAll = sorted.some((t) => t.reduceRatio >= 0.999999)
    if (!hasCloseAll) {
      const sum = sorted.reduce((acc, t) => acc + t.reduceRatio, 0)
      if (sum > 1.000001) return null
    }
    return sorted
  }

  private pushAtrMultipleRisk(text: string, risk: SeedRisk[]): void {
    for (const clause of this.splitRiskClauses(text)) {
      const stopMultiple = this.extractNumber(clause, [
        /止损.{0,8}(\d+(?:\.\d+)?)\s*倍\s*(?:ATR|平均真实波幅)/iu,
        /(\d+(?:\.\d+)?)\s*倍\s*(?:ATR|平均真实波幅).{0,8}止损/iu,
      ])
      if (stopMultiple !== null) {
        this.pushRisk(risk, {
          key: 'risk.atr_multiple_stop',
          params: {
            multiple: stopMultiple,
            basis: 'atr',
            effect: 'close_position',
            scope: 'current_position',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      const takeProfitMultiple = this.extractNumber(clause, [
        /(?:盈利|止盈).{0,12}(\d+(?:\.\d+)?)\s*倍\s*(?:ATR|平均真实波幅)/iu,
        /(\d+(?:\.\d+)?)\s*倍\s*(?:ATR|平均真实波幅).{0,12}(?:止盈|盈利)/iu,
      ])
      if (takeProfitMultiple !== null) {
        this.pushRisk(risk, {
          key: 'risk.atr_multiple_take_profit',
          params: {
            multiple: takeProfitMultiple,
            basis: 'atr',
            effect: 'close_position',
            scope: 'current_position',
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }
  }

  private pushRememberedLevelStopRisk(text: string, risk: SeedRisk[]): void {
    if (/(?:跌破|下破|失守).{0,8}前低.{0,8}(?:停止|暂停|终止)/u.test(text)) {
      this.pushRisk(risk, {
        key: 'risk.remembered_level_stop',
        params: {
          levelKey: 'previous_low',
          event: 'breakdown_below',
          effect: 'stop_dca',
          scope: 'position_lifecycle',
        },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })
      return
    }

    if (!/(突破位|突破位置|breakout\s+level)/iu.test(text)) return
    if (!/(跌回|跌破|下方|止损)/u.test(text)) return

    this.pushRisk(risk, {
      key: 'risk.remembered_level_stop',
      params: {
        levelKey: 'breakout',
        event: 'breakdown_below',
        effect: 'close_position',
        scope: 'current_position',
      },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    })
  }

  private pushFallingKnifeRisk(text: string, risk: SeedRisk[]): void {
    if (!/(接飞刀|飞刀|falling\s+knife)/iu.test(text)) return

    this.pushRisk(risk, {
      key: 'risk.falling_knife_guard',
      params: {},
      status: 'open',
      source: 'user_explicit',
      openSlots: [{
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk.params.definition',
        status: 'open',
        priority: 'risk',
        questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
        affectsExecution: true,
      }],
    })
  }

  private hasAtrStopSemantics(clause: string): boolean {
    return /(?:ATR|平均真实波幅).{0,12}(?:移动止损|动态止损|止损)/iu.test(clause)
      || /\bATR\s+(?:(?:moving|dynamic|trailing)\s+)?stop\b/iu.test(clause)
  }

  private extractBoundaryGuardRisk(text: string): SeedRisk | null {
    if (!/网格/u.test(text) || !/(?:突破|超出|越过|越界|离开).{0,12}(?:上下边界|上下界|边界|区间)/u.test(text)) {
      return null
    }
    if (!/(?:停止|暂停|停用|立即停止|halt|stop)/iu.test(text) || !/(?:撤销|撤单|取消).{0,12}(?:未成交|挂单|订单)/u.test(text)) {
      return null
    }

    const cancelScope = /网格.{0,8}限价|限价.{0,8}网格/u.test(text)
      ? 'unfilled_grid_limit_orders'
      : 'unfilled_grid_orders'

    return {
      key: 'risk.boundary_guard',
      params: {},
      status: 'locked',
      source: 'user_explicit',
      contracts: [{
        id: 'contract-boundary-stop',
        kind: 'risk',
        capabilities: [{
          domain: 'guard',
          verb: 'enforce',
          object: 'boundary_cancel',
          shape: {
            trigger: 'boundary_breach',
            onBreach: 'HALT_STRATEGY',
            cancelOrders: true,
            cancelScope,
            regrid: false,
          },
        }],
        requires: [],
        params: {},
        runtimeRequirements: [],
        stateRequirements: [],
        orderRequirements: [],
        openSlots: [],
      }],
    }
  }

  private extractPosition(
    text: string,
    triggers: SeedTrigger[],
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    if (this.hasPositiveDcaScheduleContext(text)) {
      return null
    }

    const unsupportedPosition = this.extractRecognizedUnsupportedPosition(text, triggers)
    if (unsupportedPosition) {
      return unsupportedPosition
    }

    const parsed = this.positionSizingContracts.parse(text)
    if (parsed) {
      return {
        sizing: parsed.sizing,
        mode: this.resolveLegacySizingMode(parsed.sizing),
        value: parsed.sizing.value,
        positionMode: this.resolvePositionMode(text, triggers),
      }
    }

    const availableBalancePercent = this.extractPercent(text, [
      /(?:使用|用|投入)?\s*(?:可用余额|账户余额|余额)(?:的)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /(?:可用余额|账户余额|余额)(?:的)?\s*百分之?\s*(\d+(?:\.\d+)?)/u,
    ])
    if (availableBalancePercent === null || availableBalancePercent <= 0 || availableBalancePercent > 100) {
      if (this.hasAmbiguousSizingText(text)) {
        return {
          sizing: null,
          mode: 'fixed_ratio',
          value: 0,
          positionMode: this.resolvePositionMode(text, triggers),
          status: 'open',
          source: 'user_explicit',
          openSlots: [this.buildPositionSizingOpenSlot()],
        }
      }

      return null
    }

    const value = availableBalancePercent / 100
    return {
      sizing: { kind: 'ratio', value, unit: 'ratio' },
      mode: 'fixed_ratio',
      value,
      positionMode: this.resolvePositionMode(text, triggers),
    }
  }

  private hasAmbiguousSizingText(text: string): boolean {
    return /买一点|买一些|小仓位|轻仓|少量/u.test(text)
  }

  private buildPositionSizingOpenSlot(): SemanticSlotState {
    return {
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    }
  }

  private resolveLegacySizingMode(sizing: SemanticPositionSizingContract): 'fixed_ratio' | 'fixed_quote' | 'fixed_qty' {
    if (sizing.kind === 'quote') return 'fixed_quote'
    if (sizing.kind === 'base') return 'fixed_qty'
    return 'fixed_ratio'
  }

  private pushCandleExpressionTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const expression = this.extractCloseOpenCandleExpression(clause)
      if (!expression) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      this.pushTrigger(triggers, seen, {
        key: 'condition.expression',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { expression },
      })
    }
  }

  private pushNoPositionGateTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    const hasExistingPositionOpenBlock = this.hasExistingPositionContext(segment)
      && /(?:不再|不要|不可|不能|禁止|避免|则不再).*(?:开仓|开多|开空)|(?:不开仓|不加仓)/u.test(segment)
    const hasNoPositionEntryGate = this.hasNoPositionContext(segment)
      && /(?:开仓|开多|开空|买入|做多|做空|入场)/u.test(segment)
    const hasInheritedNoPositionEntryGate = !hasNoPositionEntryGate
      && !this.hasExistingPositionContext(segment)
      && this.hasNoPositionContext(contextText)
      && /(?:开仓|开多|开空|买入|做多|做空|入场)/u.test(segment)
    if (!hasExistingPositionOpenBlock && !hasNoPositionEntryGate && !hasInheritedNoPositionEntryGate) return

    const sideScope = this.resolveNoPositionGateSideScope(segment, contextText)
    const expression: SemanticExpression = {
      kind: 'predicate',
      op: 'EQ',
      left: { kind: 'position', field: 'has_position', side: sideScope },
      right: { kind: 'constant', value: false },
    }

    this.pushTrigger(triggers, seen, {
      key: 'condition.expression',
      phase: 'gate',
      sideScope,
      params: { expression },
    })
  }

  private pushPreviousBarExtremaExpressionTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const previousExtrema = this.extractPreviousExtremaReference(clause)
      if (previousExtrema) {
        const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
        if (intent) {
          this.pushTrigger(triggers, seen, {
            key: 'price.previous_extrema',
            phase: intent.phase,
            sideScope: intent.sideScope,
            params: previousExtrema,
          })
        }
      }

      const expression = this.extractPreviousBarExtremaExpression(clause)
      if (!expression) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      this.pushTrigger(triggers, seen, {
        key: 'condition.expression',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { expression },
      })
    }
  }

  private extractPreviousExtremaReference(clause: string): { indicator: 'previous_extrema'; reference: 'previous_high' | 'previous_low'; event: 'breakout_up' | 'breakout_down' } | null {
    if (/前高/u.test(clause) && /突破|升破|上破|高于|超过/u.test(clause)) {
      return {
        indicator: 'previous_extrema',
        reference: 'previous_high',
        event: 'breakout_up',
      }
    }

    if (/前低/u.test(clause) && /跌破|下破|失守|低于/u.test(clause)) {
      return {
        indicator: 'previous_extrema',
        reference: 'previous_low',
        event: 'breakout_down',
      }
    }

    return null
  }

  private extractPreviousBarExtremaExpression(clause: string): SemanticExpression | null {
    const compact = clause.replace(/\s+/gu, '')
    const closeLatest = /(?:最新|当前)?(?:K线)?收盘价|close/iu
    const previousHigh = /(?:上一根|前一根|上根)(?:K线)?(?:最高价|最高|高点|high)/iu
    const previousLow = /(?:上一根|前一根|上根)(?:K线)?(?:最低价|最低|低点|low)/iu

    if (closeLatest.test(compact) && previousHigh.test(compact) && /突破|升破|上破|高于|大于|超过|站上|>/u.test(compact)) {
      return {
        kind: 'predicate',
        op: 'GT',
        left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
        right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
      }
    }

    if (closeLatest.test(compact) && previousLow.test(compact) && /跌破|下破|跌穿|低于|小于|失守|</u.test(compact)) {
      return {
        kind: 'predicate',
        op: 'LT',
        left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
        right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
      }
    }

    return null
  }

  private extractCloseOpenCandleExpression(clause: string): SemanticExpression | null {
    const compact = clause.replace(/\s+/gu, '')
    const relation = this.extractCloseOpenRelation(compact)
    if (!relation) return null

    const op = relation.leftField === 'close' ? relation.operator : this.invertExpressionOperator(relation.operator)
    const left: SemanticExpressionOperand = { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 }
    const right: SemanticExpressionOperand = { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 }

    return {
      kind: 'predicate',
      op,
      left,
      right,
    }
  }

  private extractCloseOpenRelation(compact: string): {
    leftField: 'open' | 'close'
    operator: SemanticExpressionOperator
  } | null {
    const closeOpenMatch = compact.match(/(?:收盘价|close)(不低于|大于等于|至少|>=|不高于|小于等于|至多|<=|高于|大于|超过|>|站上|低于|小于|跌破|<|失守|等于|=|相等)(?:开盘价|open)/iu)
    if (closeOpenMatch?.[1]) {
      const operator = this.resolveExpressionOperatorToken(closeOpenMatch[1])
      return operator ? { leftField: 'close', operator } : null
    }

    const openCloseMatch = compact.match(/(?:开盘价|open)(不低于|大于等于|至少|>=|不高于|小于等于|至多|<=|高于|大于|超过|>|站上|低于|小于|跌破|<|失守|等于|=|相等)(?:收盘价|close)/iu)
    if (openCloseMatch?.[1]) {
      const operator = this.resolveExpressionOperatorToken(openCloseMatch[1])
      return operator ? { leftField: 'open', operator } : null
    }

    return null
  }

  private resolveExpressionOperatorToken(token: string): SemanticExpressionOperator | null {
    if (/不低于|大于等于|至少|>=/u.test(token)) return 'GTE'
    if (/不高于|小于等于|至多|<=/u.test(token)) return 'LTE'
    if (/高于|大于|超过|>|站上/u.test(token)) return 'GT'
    if (/低于|小于|跌破|<|失守/u.test(token)) return 'LT'
    if (/等于|=|相等/u.test(token)) return 'EQ'
    return null
  }

  private invertExpressionOperator(operator: SemanticExpressionOperator): SemanticExpressionOperator {
    switch (operator) {
      case 'GT':
        return 'LT'
      case 'GTE':
        return 'LTE'
      case 'LT':
        return 'GT'
      case 'LTE':
        return 'GTE'
      default:
        return operator
    }
  }

  private resolveNoPositionGateSideScope(segment: string, contextText: string): 'long' | 'short' | 'both' {
    if (/做空|开空|空单|short/u.test(segment)) return 'short'
    if (/做多|开多|多单|买入|long/u.test(segment)) return 'long'
    if (/做空|开空|空单|short/u.test(contextText) && /做多|开多|多单|买入|long/u.test(contextText)) return 'both'
    if (/做空|开空|空单|short/u.test(contextText)) return 'short'
    return 'long'
  }

  private hasExistingPositionContext(segment: string): boolean {
    return /(?:已有|已经有|当前有|现在有|目前有|现有|持有)(?:持仓|仓位)|(?:^|[^没无未])有(?:持仓|仓位)|(?:持仓|仓位)(?:已存在|存在|不为空)/u.test(segment)
  }

  private hasNoPositionContext(segment: string): boolean {
    return /(?:当前|现在|目前)?(?:没有|无|未持有)(?:持仓|仓位)|(?:空仓|无仓位)/u.test(segment)
  }

  private pushMovingAverageGateTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const pair = clause.match(/\b(?:MA|EMA)\s*(\d{1,4})\s*(?:(?:在|位于)\s*\b(?:MA|EMA)\s*(\d{1,4})\s*(?:上方|之上)|(?:高于|大于)\s*\b(?:MA|EMA)\s*(\d{1,4}))/iu)
      const slowPeriodText = pair?.[2] ?? pair?.[3]
      if (pair?.[1] && slowPeriodText) {
        const fastPeriod = Number(pair[1])
        const slowPeriod = Number(slowPeriodText)
        if (Number.isFinite(fastPeriod) && Number.isFinite(slowPeriod)) {
          this.pushTrigger(triggers, seen, {
            key: 'condition.expression',
            phase: 'gate',
            sideScope: /只做多|做多|买入/u.test(segment) ? 'long' : undefined,
            params: {
              expression: {
                kind: 'predicate',
                op: 'GT',
                left: { kind: 'indicator', name: 'sma', params: { period: fastPeriod } },
                right: { kind: 'indicator', name: 'sma', params: { period: slowPeriod } },
              },
            },
          })
        }
        continue
      }

      const priceAbove = clause.match(/(?:价格|收盘价)?\s*(?:在|位于)?\s*\b(MA|EMA)\s*(\d{1,4})\s*(?:上方|之上|高于)/iu)
      if (!priceAbove?.[1] || !priceAbove[2]) continue
      if (this.hasDirectTradeActionIntent(clause) && !/(?:只做多|只做空|只买入|只卖出)/u.test(clause)) {
        continue
      }

      const period = Number(priceAbove[2])
      if (!Number.isFinite(period)) continue

      const indicator = priceAbove[1].toLowerCase() === 'ema' ? 'ema' : 'ma'
      const key = /价格|收盘价/u.test(clause) && /MACD|或/u.test(segment)
        ? 'indicator.above'
        : 'condition.expression'

      this.pushTrigger(triggers, seen, {
        key,
        phase: 'gate',
        sideScope: /只做多|做多|买入/u.test(segment) ? 'long' : undefined,
        params: key === 'indicator.above'
          ? {
              indicator,
              referenceRole: period >= 20 ? 'long_term' : 'short_term',
              'reference.period': period,
              reference: { indicator, period },
              timeframeOverride: true,
            }
          : {
              expression: {
                kind: 'predicate',
                op: 'GT',
                left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
                right: { kind: 'indicator', name: indicator === 'ema' ? 'ema' : 'sma', params: { period } },
              },
            },
      })
    }
  }

  private hasDirectTradeActionIntent(text: string): boolean {
    return /(?:买入|卖出|做多|做空|开多|开空|开仓|平多|平空|平仓)/u.test(text)
  }

  private pushMovingAverageTrigger(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    const clauses = this.splitCommaClauses(segment)

    for (const clause of clauses) {
      const subClauses = this.splitConjunctionClauses(clause)

      for (const subClause of subClauses) {
        if (/(?:或|或者|任一|any\s+of)/iu.test(subClause)) continue
        if (/布林|bollinger|上轨|下轨|中轨/iu.test(subClause)) continue
        if (!/(?:MA|EMA)\s*\d+|均线/iu.test(subClause)) continue
        if (this.isTrueMovingAverageCrossClause(subClause)?.isCross) continue
        const referencePeriods = Array.from(subClause.matchAll(/(?:MA|EMA)\s*(\d{1,4})/giu))
          .map(match => Number(match[1]))
          .filter(value => Number.isFinite(value))
        if (referencePeriods.length === 0) {
          const fallbackPeriod = this.extractNumber(subClause, [/均线\s*(\d{1,4})/u])
          if (fallbackPeriod !== null) {
            referencePeriods.push(fallbackPeriod)
          } else if (aliasContext.movingAverage && /(?:该均线|均线)/u.test(subClause)) {
            referencePeriods.push(aliasContext.movingAverage.period)
          } else {
            continue
          }
        }

        const intent = this.resolveTradeIntent(subClause) ?? this.resolveTradeIntent(clause)
        if (!intent) continue

        const confirmationMode = this.extractConfirmationMode(subClause)
        const hasExplicitEma = /\bEMA\s*\d+/iu.test(subClause)
        const hasExplicitMa = /\bMA\s*\d+/iu.test(subClause)
        const indicator = hasExplicitEma
          ? 'ema'
          : (hasExplicitMa ? 'ma' : (aliasContext.movingAverage?.indicator ?? 'ma'))
        const key = /突破|上穿|站上|高于|上方/u.test(subClause)
          ? 'indicator.above'
          : (/跌破|下穿|失守|低于|下方/u.test(subClause) ? 'indicator.below' : null)
        if (!key) continue

        const timeframes = this.extractAllTimeframes(subClause)

        for (const referencePeriod of referencePeriods) {
          const params = {
            indicator,
            referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
            'reference.period': referencePeriod,
            ...(confirmationMode ? { confirmationMode } : {}),
          }
          const targetTimeframes = timeframes.length > 0
            ? timeframes
            : []

          if (targetTimeframes.length > 0) {
            for (const timeframe of targetTimeframes) {
              this.pushTrigger(triggers, seen, {
                key,
                phase: intent.phase,
                sideScope: intent.sideScope,
                params: { ...params, timeframe, timeframeOverride: true },
                evidence: { text: clause, source: 'user_explicit' },
              })
            }
          } else {
            this.pushTrigger(triggers, seen, {
              key,
              phase: intent.phase,
              sideScope: intent.sideScope,
              params: { ...params, timeframeOverride: true },
              evidence: { text: clause, source: 'user_explicit' },
            })
          }
        }
      }
    }
  }

  private pushBollingerTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    const hasExplicitBollinger = /布林带/u.test(segment)
    if (!hasExplicitBollinger && !aliasContext.bollingerBandParams) return
    if (hasExplicitBollinger && this.hasMultipleBoundaryRolesInOneCommaClause(segment)) return
    if (this.shouldPreferUniversalBoundaryTriggersForBollinger(segment)) return

    const clauses = this.splitCommaClauses(segment)
    const segmentBandParams = this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams
    let previousEntrySideScope: 'long' | 'short' | null = null

    for (const clause of clauses) {
      const isAliasClause = !/布林带/u.test(clause)
      if (isAliasClause && !this.hasBollingerBandAction(clause)) continue
      const bandParams = this.extractBollingerBandParams(clause) ?? segmentBandParams
      const confirmationMode = this.extractConfirmationMode(clause) ?? this.extractConfirmationMode(segment)
      const intent = this.resolveTradeIntent(clause)

      if (/上轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_upper',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            band: 'upper',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
        if (intent.phase === 'entry') {
          previousEntrySideScope = intent.sideScope
        }
      }

      if (/下轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_lower',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            band: 'lower',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
        if (intent.phase === 'entry') {
          previousEntrySideScope = intent.sideScope
        }
      }

      if (/中轨/u.test(clause)) {
        if (!intent) continue
        this.pushTrigger(triggers, seen, {
          key: 'bollinger.touch_middle',
          phase: 'exit',
          sideScope: this.resolveBollingerMiddleSideScope(clause, previousEntrySideScope),
          params: {
            band: 'middle',
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
            ...(confirmationMode ? { confirmationMode } : {}),
          },
        })
      }
    }
  }

  private hasIndicatorBoundaryLanguage(segment: string): boolean {
    return /布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu.test(segment)
  }

  private resolveIndicatorName(segment: string, aliasContext?: SemanticAliasContext): 'bollinger' | 'channel' | 'generic_boundary' {
    if (/布林线|布林带|bollinger/iu.test(segment)) return 'bollinger'
    if (/通道|channel/iu.test(segment)) return 'channel'
    if (aliasContext?.bollingerBandParams && /上轨|下轨|中轨/iu.test(segment)) return 'bollinger'
    return 'generic_boundary'
  }

  private resolveBoundaryRole(clause: string): 'upper' | 'lower' | 'middle' | null {
    if (/上轨|上沿|上边界|upper/iu.test(clause)) return 'upper'
    if (/下轨|下沿|下边界|lower/iu.test(clause)) return 'lower'
    if (/中轨|中线|middle|midline/iu.test(clause)) return 'middle'
    return null
  }

  private pushIndicatorBoundaryTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    if (!this.hasIndicatorBoundaryLanguage(segment)) return
    if (this.isBareBollingerBoundaryAlias(segment, aliasContext) && !this.hasBollingerBandAction(segment)) return

    const indicatorName = this.resolveIndicatorName(segment, aliasContext)
    const bandParams = indicatorName === 'bollinger'
      ? this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams
      : null

    let previousEntrySideScope: 'long' | 'short' | null = null
    for (const clause of this.splitIndicatorBoundaryClauses(segment)) {
      const boundaryRole = this.resolveBoundaryRole(clause)
      if (!boundaryRole) continue

      const intent: { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' | 'both' } | null = this.resolveIndicatorBoundaryTradeIntent(clause, previousEntrySideScope)
        ?? this.resolveIndicatorBoundaryTradeIntentFromSegment(boundaryRole, segment)
      if (!intent) continue

      const confirmationMode = this.extractBoundaryConfirmationMode(clause)
        ?? this.extractConfirmationMode(segment)
        ?? this.inferBoundaryBreakoutMode(boundaryRole, segment)
        ?? this.inferPlainBoundaryTouchMode(boundaryRole, clause, segment)

      this.pushTrigger(triggers, seen, {
        key: 'price.detect.indicator_boundary',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          indicator: {
            name: indicatorName,
            sourceText: this.extractIndicatorSourceText(clause),
            ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
            ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
          },
          boundaryRole,
          ...(confirmationMode ? { confirmationMode } : {}),
          sourceText: clause,
        },
      })
      if (intent.phase === 'entry' && intent.sideScope !== 'both') {
        previousEntrySideScope = intent.sideScope
      }
    }
  }

  private resolveIndicatorBoundaryTradeIntent(
    clause: string,
    previousEntrySideScope: 'long' | 'short' | null,
  ): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' | 'both' } | null {
    const explicitCloseSideScope = this.resolveExplicitCloseSideScope(clause)
    if (explicitCloseSideScope) return { phase: 'exit', sideScope: explicitCloseSideScope }

    const intent = this.resolveTradeIntent(clause)
    if (intent) {
      if (intent.phase === 'exit' && !this.hasExplicitTradeSide(clause)) {
        return {
          ...intent,
          sideScope: previousEntrySideScope ?? 'both',
        }
      }
      return intent
    }
    if (/(?:买)(?!回)/u.test(clause)) return { phase: 'entry', sideScope: 'long' }
    if (/卖/u.test(clause)) return { phase: 'exit', sideScope: 'long' }
    return null
  }

  private resolveIndicatorBoundaryTradeIntentFromSegment(
    boundaryRole: 'upper' | 'lower' | 'middle',
    segment: string,
  ): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' | 'both' } | null {
    if (boundaryRole === 'lower' && /下轨.{0,40}买入|买入.{0,40}下轨/u.test(segment)) {
      return { phase: 'entry', sideScope: 'long' }
    }
    if (boundaryRole === 'upper' && /上轨.{0,40}卖出|卖出.{0,40}上轨/u.test(segment)) {
      return { phase: 'exit', sideScope: 'long' }
    }
    return null
  }

  private inferPlainBoundaryTouchMode(
    boundaryRole: 'upper' | 'lower' | 'middle',
    clause: string,
    segment: string,
  ): 'touch' | null {
    if (/突破|跌破|上破|下破|穿越|cross/iu.test(clause)) return null
    if (this.hasBoundaryBreakoutVerb(boundaryRole, segment)) return null
    if (boundaryRole === 'lower' && /下轨.{0,40}买入|买入.{0,40}下轨/u.test(segment)) return 'touch'
    if (boundaryRole === 'upper' && /上轨.{0,40}卖出|卖出.{0,40}上轨/u.test(segment)) return 'touch'
    return null
  }

  private hasBoundaryBreakoutVerb(boundaryRole: 'upper' | 'lower' | 'middle', segment: string): boolean {
    const boundaryMatches = Array.from(segment.matchAll(/上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|upper|lower|middle|midline/giu))
      .map(match => ({
        index: match.index ?? 0,
        length: match[0].length,
        role: this.resolveBoundaryRole(match[0]),
      }))
      .filter((match): match is { index: number, length: number, role: 'upper' | 'lower' | 'middle' } => match.role !== null)

    for (let index = 0; index < boundaryMatches.length; index += 1) {
      const match = boundaryMatches[index]
      if (!match || match.role !== boundaryRole) continue

      const previousBoundary = boundaryMatches[index - 1]
      const nextBoundary = boundaryMatches[index + 1]
      const previousDelimiter = Math.max(
        segment.lastIndexOf('，', match.index),
        segment.lastIndexOf(',', match.index),
        segment.lastIndexOf('；', match.index),
        segment.lastIndexOf(';', match.index),
        segment.lastIndexOf('。', match.index),
      )
      const nextDelimiterCandidates = ['，', ',', '；', ';', '。']
        .map(delimiter => segment.indexOf(delimiter, match.index + match.length))
        .filter(candidate => candidate >= 0)
      const nextDelimiter = nextDelimiterCandidates.length > 0 ? Math.min(...nextDelimiterCandidates) : segment.length
      const contextStart = Math.max(previousDelimiter + 1, previousBoundary ? previousBoundary.index + previousBoundary.length : 0)
      const contextEnd = Math.min(nextDelimiter, nextBoundary?.index ?? segment.length)
      const localContext = segment.slice(contextStart, contextEnd)
      if (/(?:突破|跌破|上破|下破|穿越|cross)/iu.test(localContext)) {
        return true
      }
    }

    return false
  }

  private inferBoundaryBreakoutMode(
    boundaryRole: 'upper' | 'lower' | 'middle',
    segment: string,
  ): 'breakout' | null {
    return this.hasBoundaryBreakoutVerb(boundaryRole, segment) ? 'breakout' : null
  }

  private resolveExplicitCloseSideScope(clause: string): 'long' | 'short' | null {
    if (!/平仓|平多|平空|离场|出场/u.test(clause)) return null
    if (/平空|买回空单|买回平空|空单|做空|开空|short/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|多单|做多|开多|long/u.test(clause)) return 'long'
    return null
  }

  private hasExplicitTradeSide(clause: string): boolean {
    return /做空|开空|空单|short|平空|买回空单|买回平空|做多|开多|多单|long|平多|卖出多单|卖出平多|买入|卖出/u.test(clause)
  }

  private isBareBollingerBoundaryAlias(segment: string, aliasContext: SemanticAliasContext): boolean {
    return Boolean(aliasContext.bollingerBandParams)
      && !/布林线|布林带|bollinger|通道|channel|上边界|下边界|边界/iu.test(segment)
      && /上轨|下轨|中轨/iu.test(segment)
  }

  private shouldPreferUniversalBoundaryTriggersForBollinger(segment: string): boolean {
    const clauses = this.splitCommaClauses(segment)
    if (clauses.length < 2) return false
    const explicitBollingerBoundaryClauses = clauses.filter(clause => (
      /布林带|bollinger/iu.test(clause)
      && this.resolveBoundaryRole(clause) !== null
      && this.resolveTradeIntent(clause) !== null
    ))
    return explicitBollingerBoundaryClauses.length >= 2
  }

  private hasMultipleBoundaryRolesInOneCommaClause(segment: string): boolean {
    return this.splitCommaClauses(segment).some((clause) => {
      const roles = new Set(
        Array.from(clause.matchAll(/上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|upper|lower|middle|midline/giu))
          .map(match => this.resolveBoundaryRole(match[0]))
          .filter((role): role is 'upper' | 'lower' | 'middle' => role !== null),
      )
      return roles.size > 1
    })
  }

  private splitIndicatorBoundaryClauses(segment: string): string[] {
    return this.splitCommaClauses(segment).flatMap((clause) => {
      const matches = Array.from(clause.matchAll(/(?:上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界|upper|lower|middle|midline)/giu))
      if (matches.length <= 1) return [clause]

      return matches.map((match, index) => {
        const start = match.index ?? 0
        const end = matches[index + 1]?.index ?? clause.length
        return clause.slice(start, end).trim()
      }).filter(Boolean)
    })
  }

  private extractIndicatorSourceText(clause: string): string {
    const match = clause.match(/布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu)
    return match?.[0] ?? 'boundary'
  }

  private resolveBollingerMiddleSideScope(
    clause: string,
    previousEntrySideScope: 'long' | 'short' | null = null,
  ): 'long' | 'short' | 'both' {
    if (/平空|买回空单|买回平空|做空.*平仓|空单.*平仓/u.test(clause)) return 'short'
    if (/平多|卖出多单|卖出平多|做多.*平仓|多单.*平仓/u.test(clause)) return 'long'
    if (previousEntrySideScope) return previousEntrySideScope
    return 'both'
  }

  private pushMovingAverageCrossTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const clauses = segment.includes('，') || segment.includes(',')
      ? segment.split(/[，,]/u).map(clause => clause.trim()).filter(Boolean)
      : [segment]

    for (const clause of clauses) {
      const cross = this.parseMovingAverageCrossClause(clause) ?? this.parseGenericMovingAverageCrossClause(clause, segment)
      if (!cross) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      if (cross.direction === 'up') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            semantic: 'cross_up',
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
          evidence: { text: segment, source: 'user_explicit' },
        })
      }

      if (cross.direction === 'down') {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            indicator: cross.indicator,
            semantic: 'cross_down',
            ...(cross.fastPeriod !== undefined ? { fastPeriod: cross.fastPeriod } : {}),
            ...(cross.slowPeriod !== undefined ? { slowPeriod: cross.slowPeriod } : {}),
          },
          evidence: { text: segment, source: 'user_explicit' },
        })
      }
    }
  }

  private pushSequenceTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    this.pushPullbackReclaimSequence(segment, triggers, seen)
    this.pushRsiReclaimSequence(segment, triggers, seen)
    this.pushConsecutiveCandlesSequence(segment, triggers, seen)
    this.pushBreakoutRetestSequence(segment, triggers, seen)
  }

  private pushPullbackReclaimSequence(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const match = segment.match(/回踩\s*(MA|EMA)\s*(\d{1,4}).{0,16}(?:重新)?(?:站上|上穿|收回|收复)\s*(?:MA|EMA)?\s*\d{0,4}/iu)
      ?? segment.match(/回踩\s*(MA|EMA)\s*(\d{1,4}).{0,16}(?:不破|未跌破|不跌破)/iu)
    if (!match?.[1] || !match[2]) return

    const intent = /(?:买入|买|做多|开多)/u.test(segment)
      ? { phase: 'entry' as const, sideScope: 'long' as const }
      : (this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const })
    const period = Number(match[2])
    if (!Number.isFinite(period)) return

    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        sequenceKind: 'pullback_reclaim',
        reference: {
          indicator: match[1].toLowerCase() === 'ema' ? 'ema' : 'ma',
          period,
        },
      },
      evidence: { text: segment, source: 'user_explicit' },
    })
  }

  private pushRsiReclaimSequence(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/RSI/iu.test(segment) || !/(?:跌破|下穿).{0,32}(?:重新)?(?:上穿|穿回|站上)/u.test(segment)) return

    const threshold = this.extractNumber(segment, [
      /RSI\s*(?:跌破|下穿)\s*(\d+(?:\.\d+)?).{0,24}(?:重新)?(?:上穿|穿回|站上)\s*\1/iu,
      /RSI.*?(?:跌破|下穿)\s*(\d+(?:\.\d+)?)/iu,
    ])
    if (threshold === null) return

    const intent = /(?:买入|买|做多|开多)/u.test(segment)
      ? { phase: 'entry' as const, sideScope: 'long' as const }
      : (this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const })
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        sequenceKind: 'rsi_reclaim',
        threshold,
      },
      evidence: { text: segment, source: 'user_explicit' },
    })
  }

  private pushConsecutiveCandlesSequence(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const match = segment.match(/连续\s*(\d{1,3}|[一二两三四五六七八九十]+)\s*根.{0,8}K\s*线/u)
      ?? segment.match(/连续\s*(?:跌|下跌|涨|上涨)\s*(\d{1,3}|[一二两三四五六七八九十]+)\s*根/u)
    if (!match?.[1] || !/(跌|下跌|涨|上涨)/u.test(segment)) return

    const count = this.parseChineseInteger(match[1])
    if (count === null) return

    const intent = /(?:买入|买|做多|开多)/u.test(segment)
      ? { phase: 'entry' as const, sideScope: 'long' as const }
      : (this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const })
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        sequenceKind: 'consecutive_candles',
        count,
        direction: /跌|下跌/u.test(segment) ? 'down' : 'up',
      },
    })
  }

  private pushBreakoutRetestSequence(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(突破|升破|上破).{0,32}(回踩|回测)/u.test(segment)) return
    if (!/(不立刻|不马上|等待|等|再买|买入)/u.test(segment)) return

    const hours = this.extractNumber(segment, [/过去\s*(\d{1,4})\s*(?:小时|h|hour)/iu])
    const bars = this.extractNumber(segment, [/过去\s*(\d{1,4})\s*根\s*K\s*线/u])
    const intent = /(?:买入|买|做多|开多)/u.test(segment)
      ? { phase: 'entry' as const, sideScope: 'long' as const }
      : (this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const })
    const hasReferenceDefinition = hours !== null || bars !== null

    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      status: hasReferenceDefinition ? 'locked' : 'open',
      params: {
        sequenceKind: 'breakout_retest',
        memoryKey: 'breakout',
        ...(hours !== null ? { lookbackWindow: `${hours}h` } : {}),
        ...(bars !== null ? { lookbackBars: bars } : {}),
      },
      ...(hasReferenceDefinition
        ? {}
        : {
            openSlots: [{
              slotKey: 'trigger.breakout_retest.reference_definition',
              fieldPath: `triggers[${triggers.length}].params.memoryKey`,
              status: 'open' as const,
              priority: 'core' as const,
              questionHint: '请确认突破位如何定义，例如过去多少根 K 线高点或过去多少小时高点。',
              affectsExecution: true,
              evidence: { text: '突破位', source: 'user_explicit' as const },
            }],
          }),
    })
  }

  private parseGenericMovingAverageCrossClause(
    clause: string,
    segment: string,
  ): { indicator: 'moving_average'; direction: 'up' | 'down'; fastPeriod?: number; slowPeriod?: number } | null {
    const hasMovingAverageContext = /均线|moving\s*average/iu.test(clause) || /均线|moving\s*average/iu.test(segment)
    if (!hasMovingAverageContext) return null
    if (/金叉/u.test(clause)) return { indicator: 'moving_average', direction: 'up' }
    if (/死叉/u.test(clause)) return { indicator: 'moving_average', direction: 'down' }
    return null
  }

  private pushGridTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>, context = segment): void {
    if (!this.hasGridSemantics(segment)) return
    const sideScopeContext = `${segment} ${context}`

    const centeredRange = this.extractCenteredGridRange(segment)
    if (centeredRange) {
      const sideScope = this.resolveGridSideScope(sideScopeContext)
      this.pushTrigger(triggers, seen, {
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope,
        params: {
          sideMode: sideScope === 'short'
            ? 'short_only'
            : (sideScope === 'both' ? 'bidirectional' : 'long_only'),
          recycle: /反向挂单|反向单|自动挂/u.test(segment),
          breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
        },
        contracts: [{
          id: 'contract-grid-centered-levels',
          kind: 'trigger',
          capabilities: [{
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: {
              mode: 'centered_percent_range',
              centerTiming: centeredRange.centerTiming,
              centerSource: centeredRange.centerSource,
              halfRangePct: centeredRange.halfRangePct,
              ...(centeredRange.gridIntervals !== null ? { gridIntervals: centeredRange.gridIntervals } : {}),
              gridCount: centeredRange.gridCount,
              spacingMode: 'arithmetic',
            },
          }],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      })
      return
    }

    const fixedRange = this.extractFixedGridRange(segment)
    const stepPct = this.extractPercent(segment, [
      /步长\s*(\d+(?:\.\d+)?)\s*%/u,
      /间距\s*(\d+(?:\.\d+)?)\s*%/u,
      /按\s*(\d+(?:\.\d+)?)\s*%\s*网格/u,
      /(\d+(?:\.\d+)?)\s*%\s*网格/u,
      /每一格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /每格\s*(?:间距|距离)?\s*(\d+(?:\.\d+)?)\s*%/u,
      /千分之\s*(\d+(?:\.\d+)?)/u,
    ])
    const absoluteSpacing = this.extractAbsoluteGridSpacing(segment)
    const explicitGridCount = this.extractGridLevelCount(segment)
    const gridIntervals = this.extractGridIntervals(segment)

    if (!fixedRange) return

    const sideScope = this.resolveGridSideScope(sideScopeContext)
    const absoluteSpacingGridCount = explicitGridCount === null && gridIntervals === null && absoluteSpacing !== null
      ? this.deriveGridCountFromAbsoluteSpacing(fixedRange.lower, fixedRange.upper, absoluteSpacing)
      : null
    const hasAbsoluteSpacingConflict = explicitGridCount === null
      && gridIntervals === null
      && absoluteSpacing !== null
      && absoluteSpacingGridCount === null
    const hasMissingDensity = explicitGridCount === null
      && gridIntervals === null
      && absoluteSpacing === null
      && stepPct === null
    const shape: SemanticCapabilityShape = {
      mode: 'fixed_range',
      lower: fixedRange.lower,
      upper: fixedRange.upper,
      spacingMode: 'arithmetic',
      ...(explicitGridCount !== null ? { gridCount: explicitGridCount } : {}),
      ...(explicitGridCount === null && gridIntervals !== null
        ? {
            gridIntervals,
            gridCount: gridIntervals + 1,
          }
        : {}),
      ...(absoluteSpacingGridCount !== null ? { gridCount: absoluteSpacingGridCount } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(stepPct !== null ? { spacingPct: stepPct } : {}),
    }
    this.pushTrigger(triggers, seen, {
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope,
      ...(hasAbsoluteSpacingConflict || hasMissingDensity
        ? {
            status: 'open' as const,
            openSlots: [
              hasAbsoluteSpacingConflict
                ? this.buildLevelSetSpacingConflictOpenSlot()
                : this.buildLevelSetDensityOpenSlot(),
            ],
          }
        : {}),
      params: {
        rangeLower: fixedRange.lower,
        rangeUpper: fixedRange.upper,
        ...(stepPct !== null ? { stepPct } : {}),
        ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
        ...(explicitGridCount !== null ? { gridCount: explicitGridCount } : {}),
        ...(explicitGridCount === null && gridIntervals !== null ? { gridIntervals, gridCount: gridIntervals + 1 } : {}),
        ...(absoluteSpacingGridCount !== null ? { gridCount: absoluteSpacingGridCount } : {}),
        sideMode: sideScope === 'short'
          ? 'short_only'
          : (sideScope === 'both' ? 'bidirectional' : 'long_only'),
        recycle: true,
        breakoutAction: /停|暂停|停止/u.test(segment) ? 'pause' : 'continue',
      },
      contracts: [{
        id: 'contract-grid-fixed-levels',
        kind: 'trigger',
        capabilities: [{
          domain: 'price',
          verb: 'define',
          object: 'level_set',
          shape,
        }],
        requires: [],
        params: {},
        runtimeRequirements: [],
        stateRequirements: [],
        orderRequirements: [],
        openSlots: [],
      }],
    })
  }

  private buildLevelSetDensityOpenSlot(): SemanticSlotState {
    return {
      slotKey: LEVEL_SET_DENSITY_SLOT_KEY,
      fieldPath: GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH,
      status: 'open',
      priority: 'core',
      questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
      affectsExecution: true,
    }
  }

  private buildLevelSetSpacingConflictOpenSlot(): SemanticSlotState {
    return {
      slotKey: LEVEL_SET_SPACING_CONFLICT_SLOT_KEY,
      fieldPath: GRID_FIXED_LEVEL_SET_SHAPE_FIELD_PATH,
      status: 'open',
      priority: 'core',
      questionHint: '价格区间无法按每格间距整除，请调整间距或格数。',
      affectsExecution: true,
    }
  }

  private hasGridSemantics(segment: string): boolean {
    return /网格|每格|每一格|单格|共\s*\d{1,4}\s*格|拆成\s*\d{1,4}\s*份|分成\s*\d{1,4}\s*(?:格|份)/u.test(segment)
  }

  private extractFixedGridRange(segment: string): FixedGridRange | null {
    const match = segment.match(/(?:价格区间|固定区间|区间)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:-|~|到|至)\s*(\d+(?:\.\d+)?)/u)
      ?? segment.match(/(\d+(?:\.\d+)?)\s*(?:-|~|到|至)\s*(\d+(?:\.\d+)?)/u)

    if (!match?.[1] || !match[2]) {
      return null
    }

    const lower = Number(match[1])
    const upper = Number(match[2])
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower <= 0 || upper <= lower) {
      return null
    }

    return { lower, upper }
  }

  private extractGridLevelCount(segment: string): number | null {
    return this.extractPositiveInteger(segment, [
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})\s*个/u,
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})(?!\s*格)/u,
      /(\d{1,4})\s*个\s*网格/u,
    ])
  }

  private extractGridIntervals(segment: string): number | null {
    return this.extractPositiveInteger(segment, [
      /共\s*(\d{1,4})\s*格/u,
      /网格(?:数量|数)?\s*[:：]?\s*(\d{1,4})\s*格/u,
      /拆成\s*(\d{1,4})\s*份/u,
      /分成\s*(\d{1,4})\s*(?:格|份)/u,
    ])
  }

  private extractAbsoluteGridSpacing(segment: string): number | null {
    return this.extractNumber(segment, [
      /每格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
      /每一格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
      /单格(?:价格)?(?:间距|距离)\s*[:：]?\s*(\d+(?:\.\d+)?)(?![\d.])(?!\s*%)\s*(?:USDT|USDC|USD|U|u|刀)?/u,
    ])
  }

  private extractPositiveInteger(segment: string, patterns: RegExp[]): number | null {
    const value = this.extractNumber(segment, patterns)
    if (value === null || !Number.isInteger(value) || value <= 0) {
      return null
    }

    return value
  }

  private deriveGridCountFromAbsoluteSpacing(lower: number, upper: number, absoluteSpacing: number): number | null {
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || !Number.isFinite(absoluteSpacing) || lower <= 0 || upper <= lower || absoluteSpacing <= 0) {
      return null
    }

    const intervals = (upper - lower) / absoluteSpacing
    const roundedIntervals = Math.round(intervals)
    if (roundedIntervals < 1 || Math.abs(intervals - roundedIntervals) > 1e-9) {
      return null
    }

    return roundedIntervals + 1
  }

  private extractCenteredGridRange(segment: string): {
    centerTiming: 'deployment' | 'runtime'
    centerSource: 'last_trade' | 'last_price' | 'mark_price'
    halfRangePct: number
    gridIntervals: number | null
    gridCount: number
  } | null {
    if (!/(?:当前价|当前价格|最新价|最新成交价|last|标记价|mark).{0,16}(?:中心|为中心)|(?:中心|为中心).{0,16}(?:当前价|当前价格|最新价|最新成交价|last|标记价|mark)/iu.test(segment)) {
      return null
    }

    const halfRangePct = this.extractPercent(segment, [
      /上下\s*各\s*(\d+(?:\.\d+)?)\s*%/u,
      /上下\s*各\s*百分之?\s*(\d+(?:\.\d+)?)/u,
      /上(?:下)?\s*各\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    const gridIntervals = this.extractGridIntervals(segment)
    const explicitGridCount = this.extractGridLevelCount(segment)
    const gridCount = gridIntervals !== null ? gridIntervals + 1 : explicitGridCount
    if (halfRangePct === null || halfRangePct <= 0 || gridCount === null || gridCount <= 0) {
      return null
    }

    return {
      centerTiming: /部署|下单|启动|创建/u.test(segment) ? 'deployment' : 'runtime',
      centerSource: /最新成交价|last/iu.test(segment)
        ? 'last_trade'
        : (/标记价|mark/iu.test(segment) ? 'mark_price' : 'last_price'),
      halfRangePct,
      gridIntervals,
      gridCount,
    }
  }

  private resolveGridSideScope(segment: string): 'long' | 'short' | 'both' {
    if (/做空|开空|卖空/u.test(segment) && !/做多|开多|买入/u.test(segment)) {
      return 'short'
    }
    if (/(?:双向|多空|both|bidirectional)/iu.test(segment)) {
      return 'both'
    }
    return 'long'
  }

  private pushMarketStateTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (/(?:震荡区间|区间震荡|盘整|range[-_\s]?bound)/iu.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'market.regime',
        phase: 'gate',
        params: { value: 'range' },
      })
    }

    if (/(?:市场趋势|大趋势|整体趋势|(?:\d{1,2}\s*(?:h|小时|时))?\s*趋势).{0,8}(?:向上|上涨|多头|up|bull)/iu.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'trend.direction',
        phase: 'gate',
        params: { value: 'up' },
      })
    }

    for (const clause of this.splitLogicClauses(segment)) {
      if (!/(?:趋势|trend)/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause)
      if (!intent) continue

      if (/(?:向上|上涨|走强|多头|up|bull)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'trend.direction',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: { value: 'up' },
        })
      }

      if (/(?:转弱|向下|下跌|空头|down|bear)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'trend.direction',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: { value: 'down' },
        })
      }
    }
  }

  private pushRsiTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    aliasContext: SemanticAliasContext,
  ): void {
    if (!/RSI/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    const segmentPeriod = this.extractLastRsiPeriod(segment) ?? aliasContext.rsi?.period ?? 14

    for (const clause of clauses) {
      if (!/RSI/iu.test(clause) && !this.isRsiThresholdAliasClause(clause, segment)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const period = this.extractLastRsiPeriod(clause) ?? segmentPeriod
      const threshold = this.extractRsiThreshold(clause, period)
      if (threshold === null) continue

      if (/上穿|穿回|向上/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_over',
          phase: intent.phase,
          sideScope: intent.sideScope,
          evidence: { text: clause, source: 'user_explicit' },
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
            thresholdRole: 'upper_threshold',
          },
        })
        continue
      }

      if (/下穿|跌破|向下/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.cross_under',
          phase: intent.phase,
          sideScope: intent.sideScope,
          evidence: { text: clause, source: 'user_explicit' },
          params: {
            indicator: 'rsi',
            period,
            value: threshold,
            thresholdRole: 'lower_threshold',
          },
        })
        continue
      }

      if (/高于|大于|超过|上方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_gte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          evidence: { text: clause, source: 'user_explicit' },
          params: {
            period,
            value: threshold,
            thresholdRole: 'upper_threshold',
          },
        })
        continue
      }

      if (/低于|小于|下方/u.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'oscillator.rsi_lte',
          phase: intent.phase,
          sideScope: intent.sideScope,
          evidence: { text: clause, source: 'user_explicit' },
          params: {
            period,
            value: threshold,
            thresholdRole: 'lower_threshold',
          },
        })
      }
    }
  }

  private pushMacdTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/MACD|DIF|DEA/iu.test(segment)) return

    const params = this.extractMacdParams(segment) ?? this.extractMacdParams(contextText)
    const eventFrames = this.eventFrameParser.parse(segment)
      .filter(frame => frame.trigger.kind === 'indicator_cross' && frame.trigger.indicator === 'macd')

    if (eventFrames.length > 0) {
      for (const frame of eventFrames) {
        this.pushTrigger(triggers, seen, {
          key: frame.trigger.direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under',
          phase: frame.phase,
          sideScope: frame.sideScope,
          params: {
            indicator: 'macd',
            semantic: frame.trigger.semantic,
            ...(params ? {
              fastPeriod: params.fastPeriod,
              slowPeriod: params.slowPeriod,
              signalPeriod: params.signalPeriod,
            } : {}),
          },
        })
      }
      return
    }

    const clauses = this.splitLogicClauses(segment)

    for (const clause of clauses) {
      if (!/MACD|DIF|DEA/iu.test(clause)) continue
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const direction = /上穿|金叉/iu.test(clause)
        ? 'over'
        : (/下穿|死叉/iu.test(clause) ? 'under' : null)
      if (!direction) continue

      this.pushTrigger(triggers, seen, {
        key: direction === 'over' ? 'indicator.cross_over' : 'indicator.cross_under',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          indicator: 'macd',
          ...(params ? {
            fastPeriod: params.fastPeriod,
            slowPeriod: params.slowPeriod,
            signalPeriod: params.signalPeriod,
          } : {}),
        },
      })
    }
  }

  private pushBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/最近\s*\d{1,4}\s*根\s*K\s*线/u.test(segment)) return
    if (!/突破|跌回|跌破|高点|低点/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const highPeriod = this.extractNumber(clause, [
        /(?:突破|升破|上破)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:高点|最高|高位).*?(?:突破|升破|上破)/u,
      ])
      if (highPeriod !== null) {
        const bufferPct = this.extractPercent(clause, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
          ?? this.extractPercent(segment, [/突破缓冲\s*(\d+(?:\.\d+)?)\s*%/u])
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_up',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: highPeriod,
            reference: 'channel_high',
            ...(bufferPct !== null ? { bufferPct } : {}),
          },
        })
        continue
      }

      const lowPeriod = this.extractNumber(clause, [
        /(?:跌回|跌破|下破|跌穿)\s*最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位)/u,
        /最近\s*(\d{1,4})\s*根\s*K\s*线(?:低点|最低|低位).*?(?:跌回|跌破|下破|跌穿)/u,
      ])
      if (lowPeriod !== null) {
        this.pushTrigger(triggers, seen, {
          key: 'price.breakout_down',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            period: lowPeriod,
            reference: 'channel_low',
          },
        })
      }
    }
  }

  private pushPartialBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(突破|升破|上破|跌破|下破|失守).{0,12}(关键位置|支撑|压力|阻力)/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      if (!/(突破|升破|上破|跌破|下破|失守).{0,12}(关键位置|支撑|压力|阻力)/u.test(clause)) continue

      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const isDown = /跌破|下破|失守|支撑/u.test(clause)
      const referenceText = /支撑/u.test(clause)
        ? '支撑'
        : /压力|阻力/u.test(clause)
          ? '压力'
          : '关键位置'

      this.pushTrigger(triggers, seen, {
        key: isDown ? 'price.breakout_down' : 'price.breakout_up',
        phase: intent.phase,
        sideScope: intent.sideScope,
        status: 'open',
        params: { reference: 'unknown', referenceText },
        evidence: { text: clause, source: 'user_explicit' },
        openSlots: [{
          slotKey: 'trigger.reference_definition',
          fieldPath: `triggers[${triggers.length}].params.reference`,
          status: 'open',
          priority: 'core',
          questionHint: `请确认${referenceText}如何定义。`,
          affectsExecution: true,
          evidence: { text: referenceText, source: 'user_explicit' },
        }],
      })
    }
  }

  private pushRollingExtremaBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(过去|最近)\s*\d{1,4}\s*根\s*K\s*线/u.test(segment)) return
    if (!/(最高价|最高|高点|最低价|最低|低点)/u.test(segment)) return

    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
      if (!intent) continue

      const highLookback = this.extractNumber(clause, [
        /(?:突破|升破|上破).{0,8}(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最高价|最高|高点)/u,
        /(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最高价|最高|高点).{0,8}(?:突破|升破|上破)/u,
      ])
      if (highLookback !== null) {
        this.pushTrigger(triggers, seen, {
          key: 'price.rolling_extrema_breakout',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            extrema: 'high',
            lookbackBars: highLookback,
            event: 'breakout_up',
          },
        })
        continue
      }

      const lowLookback = this.extractNumber(clause, [
        /(?:跌破|下破|跌穿|失守).{0,8}(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最低价|最低|低点)/u,
        /(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最低价|最低|低点).{0,8}(?:跌破|下破|跌穿|失守)/u,
      ])
      if (lowLookback !== null) {
        this.pushTrigger(triggers, seen, {
          key: 'price.rolling_extrema_breakout',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            extrema: 'low',
            lookbackBars: lowLookback,
            event: 'breakout_down',
          },
        })
      }
    }
  }

  private pushRangePositionTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string,
  ): void {
    if (!/区间/u.test(segment) || !/%/u.test(segment)) return

    const lookbackBars = this.extractNumber(segment, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? this.extractNumber(contextText, [/最近\s*(\d{1,4})\s*根\s*K\s*线区间/u])
      ?? 20
    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const lowerThreshold = this.extractPercent(segment, [
      /区间\s*下\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:低位|底部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (lowerThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_lte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: lowerThreshold,
        },
      })
      return
    }

    const upperThreshold = this.extractPercent(segment, [
      /区间\s*上\s*(\d+(?:\.\d+)?)\s*%/u,
      /区间(?:高位|顶部)\s*(\d+(?:\.\d+)?)\s*%/u,
    ])
    if (upperThreshold !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.range_position_gte',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          lookbackBars,
          thresholdPct: upperThreshold,
        },
      })
    }
  }

  private pushExecutionTrigger(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/立即|立刻|马上|开始时|启动时|一开始/u.test(segment)) return
    if (!/市价|当前价/u.test(segment) || !/买入|卖出|开仓|平仓|做多|做空/u.test(segment)) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    this.pushTrigger(triggers, seen, {
      key: 'execution.on_start',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        timing: 'on_start',
        orderType: 'market',
        occurrence: 'once',
      },
    })
  }

  private pushPercentChangeTrigger(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
    contextText: string = segment,
  ): void {
    const clauses = this.splitPercentChangeClauses(segment)
    if (clauses.length === 0 && this.hasMultiplePercentChangeRawClauses(segment)) {
      return
    }
    if (clauses.length > 0 && (clauses.length > 1 || clauses[0] !== segment)) {
      for (const clause of clauses) {
        this.pushPercentChangeTrigger(clause, triggers, seen, contextText)
      }
      return
    }

    if (!/%|百分/u.test(segment)) return
    if (this.isNonPricePercentContext(segment)) return
    if (!this.hasExplicitPriceChangeContext(segment)) return
    const direction = this.resolvePercentDirection(segment)
    if (!direction) return

    const intent = this.resolveTradeIntent(segment)
    if (!intent) return

    const valuePct = this.extractPercent(segment, [/(\d+(?:\.\d+)?)\s*%/u, /百分之?\s*(\d+(?:\.\d+)?)/u])
    if (valuePct === null) return

    const basis = this.resolvePercentBasis(segment)
    const window = this.extractFirstTimeframe(segment) ?? this.extractFirstTimeframe(contextText)

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        direction,
        valuePct: direction === 'up' ? Math.abs(valuePct) : -Math.abs(valuePct),
        basis,
        ...(window ? { window } : {}),
      },
    })
  }

  private pushDcaPercentChangeTrigger(text: string, triggers: SeedTrigger[], seen: Set<string>): void {
    const dcaPercentChange = this.extractDcaLifecycleTexts(text)
      .map(clause => ({
        clause,
        valuePct: this.extractPercentAfterKeywords(clause, ['每跌', '每下跌']),
      }))
      .find((entry): entry is { clause: string; valuePct: number } =>
        entry.valuePct !== null && entry.valuePct > 0,
      )
    if (!dcaPercentChange) return

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: 'entry',
      sideScope: 'long',
      params: {
        direction: 'down',
        valuePct: -Math.abs(dcaPercentChange.valuePct),
        basis: 'prev_close',
      },
      evidence: { text: dcaPercentChange.clause, source: 'user_explicit' },
    })
  }

  private pushVagueDipBuyingTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(大跌|暴跌|急跌|下杀|深跌|抄底)/u.test(segment)) return
    if (!/(买|买入|抄底|做多)/u.test(segment)) return

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: 'gate',
      sideScope: 'long',
      status: 'open',
      source: 'user_explicit',
      params: {
        direction: 'down',
      },
      openSlots: [{
        slotKey: 'trigger.percent_change.magnitude',
        fieldPath: 'triggers[price.percent_change].params.valuePct',
        status: 'open',
        priority: 'core',
        questionHint: '请确认“大跌”的跌幅阈值，例如 3% / 5% / 10%。',
        affectsExecution: true,
      }],
    })

    if (/反弹确认|确认反弹|反弹.{0,8}确认/u.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'confirmation.rebound',
        phase: 'entry',
        sideScope: 'long',
        status: 'open',
        source: 'user_explicit',
        params: {},
        openSlots: [{
          slotKey: 'trigger.confirmation.rebound_definition',
          fieldPath: 'triggers[confirmation.rebound].params.definition',
          status: 'open',
          priority: 'core',
          questionHint: '请确认反弹确认方式，例如重新站上 MA20 / 下一根 K 线收阳 / 反弹超过 1%。',
          affectsExecution: true,
        }],
      })
    }
  }

  private pushVolumeRelativeAverageTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/成交量|放量|量能|volume/iu.test(segment)) return

    const clauses = this.splitLogicClauses(segment)
    if (clauses.length > 1) {
      for (const clause of clauses) {
        if (/成交量|放量|量能|volume/iu.test(clause)) {
          this.pushVolumeRelativeAverageTriggers(clause, triggers, seen)
        }
      }
      return
    }

    const explicitMatch = segment.match(/(?:成交量|量能|volume).{0,12}(?:高于|大于|超过|gt|greater\s+than).{0,12}(?:过去|最近)\s*(\d{1,4})\s*根?(?:K\s*线)?(?:均量|平均量|平均成交量)(?:的)?\s*(\d+(?:\.\d+)?)\s*倍/iu)
      ?? segment.match(/(?:过去|最近)\s*(\d{1,4})\s*根?(?:K\s*线)?(?:均量|平均量|平均成交量)(?:的)?\s*(\d+(?:\.\d+)?)\s*倍/iu)
    const intent = /(?:买入|买|做多|开多)/u.test(segment)
      ? { phase: 'entry' as const, sideScope: 'long' as const }
      : (this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const })

    if (explicitMatch?.[1] && explicitMatch[2]) {
      const lookbackBars = Number(explicitMatch[1])
      const multiplier = Number(explicitMatch[2])
      if (Number.isFinite(lookbackBars) && Number.isFinite(multiplier)) {
        this.pushTrigger(triggers, seen, {
          key: 'volume.relative_average',
          phase: intent.phase,
          sideScope: intent.sideScope,
          params: {
            lookbackBars,
            multiplier,
            comparator: 'gt',
          },
        })
      }
      return
    }

    if (/放量|成交量放大|量能放大|volume\s*spike/iu.test(segment)) {
      this.pushTrigger(triggers, seen, {
        key: 'volume.relative_average',
        phase: intent.phase,
        sideScope: intent.sideScope,
        status: 'open',
        source: 'user_explicit',
        params: {
          event: 'spike',
          comparator: 'gt',
        },
        openSlots: [
          {
            slotKey: 'trigger.volume.relative_average.lookback_bars',
            fieldPath: 'triggers[volume.relative_average].params.lookbackBars',
            status: 'open',
            priority: 'core',
            questionHint: '请确认放量比较窗口，例如过去 20 根 K 线均量。',
            affectsExecution: true,
          },
          {
            slotKey: 'trigger.volume.relative_average.multiplier',
            fieldPath: 'triggers[volume.relative_average].params.multiplier',
            status: 'open',
            priority: 'core',
            questionHint: '请确认放量倍数，例如高于均量 1.5 倍。',
            affectsExecution: true,
          },
        ],
      })
    }
  }

  private pushReboundConfirmationTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/反弹/u.test(segment) || !/(买|买入|做多|开多)/u.test(segment)) return
    if (/反弹确认|确认反弹|反弹.{0,8}确认/u.test(segment)) return

    const intent = this.resolveTradeIntent(segment) ?? { phase: 'entry' as const, sideScope: 'long' as const }
    this.pushTrigger(triggers, seen, {
      key: 'confirmation.rebound',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {},
    })
  }

  private pushLogicalAnyOfTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
    if (!/(?:或|或者|任一|any\s+of)/iu.test(segment)) return
    if (!/(卖出|平仓|平多|出场|离场)/u.test(segment)) return

    const items: Array<Record<string, unknown>> = []
    const maBreakdown = segment.match(/跌破\s*(MA|EMA)\s*(\d{1,4})/iu)
    if (maBreakdown?.[1] && maBreakdown[2]) {
      const referenceIndicator = maBreakdown[1].toLowerCase() === 'ema' ? 'ema' : 'ma'
      const referencePeriod = Number(maBreakdown[2])
      items.push({
        key: 'indicator.below',
        params: {
          indicator: referenceIndicator,
          referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
          'reference.period': referencePeriod,
          reference: {
            indicator: referenceIndicator,
            period: referencePeriod,
          },
        },
      })
    }
    if (/MACD.{0,8}死叉|死叉.{0,8}MACD/iu.test(segment)) {
      items.push({
        key: 'indicator.cross_under',
        params: {
          indicator: 'macd',
          semantic: 'cross_down',
        },
      })
    }
    if (items.length < 2) return

    this.pushTrigger(triggers, seen, {
      key: 'logical.any_of',
      phase: 'exit',
      sideScope: 'long',
      params: { items },
    })
  }

  private splitPercentChangeClauses(segment: string): string[] {
    const rawClauses = segment
      .split(/[，,、；;。]|(?:另有|另外|同时|并且|以及)/u)
      .map(clause => clause.trim())

    const clauses = rawClauses
      .filter(Boolean)
      .filter(clause => /%|百分/u.test(clause))
      .filter(clause => /(上涨|下跌|涨|跌|回撤|回落|回调|反弹)/u.test(clause))
      .filter(clause => /(买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/u.test(clause))
      .filter(clause => !/(止损|止盈|亏损|盈利)/u.test(clause))

    if (rawClauses.filter(Boolean).length > 1) {
      return clauses
    }

    const clausePattern = /\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)[^；;。,，]*?(?:上涨|下跌|涨|跌)[^；;。,，]*?(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)[^；;。,，]*?(?:买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空)/giu
    const matches = Array.from(segment.matchAll(clausePattern))
      .map(match => match[0].trim())
      .filter(Boolean)
    return matches.length > 0 ? matches : [segment]
  }

  private hasMultiplePercentChangeRawClauses(segment: string): boolean {
    return segment
      .split(/[，,、；;。]|(?:另有|另外|同时|并且|以及)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
      .length > 1
  }

  private isNonPricePercentContext(segment: string): boolean {
    return /(?:单笔|仓位|资金|余额|头寸|下单|投入|使用|用|买一点|买一些|轻仓|小仓位|少量).{0,12}(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)/u.test(segment)
      || /(?:止损|止盈|亏损|盈利).{0,12}(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)/u.test(segment)
  }

  private pushRecognizedUnsupportedTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      if (this.hasNegatedUnsupportedContext(clause)) continue

      if (/(?:动态网格|自适应网格|自动重算网格|重算网格|AI\s*网格)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'grid.dynamic_grid',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (this.isTimeWindowClause(clause)) {
        this.extractTimeWindowTrigger(clause, segment, triggers, seen)
      }

      if (this.isHasPositionClause(clause)) {
        this.extractHasPositionTrigger(clause, triggers, seen)
      }
      else if (this.isNoPositionClause(clause)) {
        this.extractNoPositionTrigger(clause, triggers, seen)
      }

      if (/(?:多周期|多时间框架|multi[-_\s]?timeframe|先看\s*\d{1,2}\s*(?:m|h|d|分钟|小时|天)|\d{1,2}\s*h\s*趋势)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'strategy.multi_timeframe',
          phase: 'gate',
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:背离|divergence|底背离|顶背离)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'indicator.divergence',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:头肩|双底|双顶|三角形|楔形|旗形|形态|pattern)/iu.test(clause) && !/(?:截图|screenshot|image)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'price.pattern',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/放量|成交量放大|volume\s*spike|量能放大/iu.test(clause) && !this.hasSupportedVolumeRelativeAverageContext(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'volume.spike',
          ...this.resolveUnsupportedTriggerIntent(clause, segment),
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/成交量.*(?:大于|超过|高于|阈值)|volume.*(?:gte|threshold)/iu.test(clause) && !this.hasSupportedVolumeRelativeAverageContext(clause)) {
        const volumeIntent = this.resolveUnsupportedTriggerIntent(clause, segment)
        const volumeOperator = /(?:小于|低于|不超过|less\s+than|lte)/iu.test(clause) ? 'LT'
          : /(?:不低于|不少于|gte)/iu.test(clause) ? 'GTE'
          : 'GT'
        const volumeMetric = /(?:成交额|quote.*volume)/iu.test(clause) ? 'quote_volume' : 'base_volume'
        // critic round 1 C-A2/C-A3 修复：
        // 1. 检测中文/英文单位（亿/万/千/百万/M/K）：当前缺解析器，**不静默锁数值**，
        //    强制走 open_slot.value 让用户重新指定纯数字（避免 "1 亿 USDT" 锁 value=1）。
        // 2. 数值正则严格邻近 metric 关键词（成交量/成交额/volume/turnover），
        //    避免捕获 "单笔 10%" / "trailing 3%" 等无关数字。
        const hasUnsupportedUnit = /(?:亿|万|千|百万|million|billion|thousand|\d+\s*[mMkKbB](?![ai-z]))/u.test(clause)
        const volumeValue = hasUnsupportedUnit
          ? null
          : this.extractNumber(clause, [
            // 必须紧邻 metric 关键词：成交量/成交额/volume/turnover 后允许 0-12 字符再数字
            /(?:成交量|成交额|volume|turnover)[^0-9%]{0,12}?(\d+(?:\.\d+)?)/iu,
          ])
        const openSlotHint = hasUnsupportedUnit
          ? '检测到中文/英文单位（亿/万/M/K 等）。请改用纯数字阈值，例如 100000000（成交量单位：张/枚）或 500000（成交额单位：USDT）。'
          : '请给出成交量阈值，例如 1000（成交量单位：张/枚）或 500000（成交额单位：USDT）。'
        this.pushTrigger(triggers, seen, {
          key: 'volume.threshold',
          phase: volumeIntent.phase,
          ...(volumeIntent.sideScope ? { sideScope: volumeIntent.sideScope } : {}),
          params: {
            operator: volumeOperator,
            metric: volumeMetric,
            ...(volumeValue !== null ? { value: volumeValue } : {}),
          },
          status: volumeValue !== null ? 'locked' : 'open',
          source: 'user_explicit',
          openSlots: volumeValue !== null ? [] : [{
            slotKey: 'volume.threshold.value',
            fieldPath: 'triggers[volume.threshold].params.value',
            status: 'open' as const,
            priority: 'core' as const,
            questionHint: openSlotHint,
            affectsExecution: true,
          }],
        })
      }

      if (
        /(?:ATR|平均真实波幅).*(?:阈值|过滤|大于|小于|threshold|filter|greater\s+than|less\s+than|gte|lte)/iu.test(clause)
        // critic round 1 M-A6：排除 ATR 止损/止盈/trailing 等已存在 atom 的关键词，避免与
        // risk.atr_take_profit / risk.atr_stop_loss / risk.trailing_stop 误命中
        && !/(?:止损|止盈|stop|trailing|动态|dynamic)/iu.test(clause)
      ) {
        const atrIntent = this.resolveUnsupportedTriggerIntent(clause, segment)
        // critic round 1 C-A3/C-B1 修复：4 操作符分支顺序按"长字符串优先"匹配，
        // 避免 "不超过" 误归 LT、"不高于" 误归 GT。
        // 严苛规则：
        //   "不超过" / "不高于" / "<=" / "lte" → LTE
        //   "不低于" / "不少于" / "≥" / "gte" → GTE
        //   "小于" / "低于" / "less than" → LT
        //   "大于" / "高于" / "超过" / "greater than" / 默认 → GT
        const atrOperator = /(?:不超过|不高于|<=|lte)/iu.test(clause) ? 'LTE'
          : /(?:不低于|不少于|>=|gte)/iu.test(clause) ? 'GTE'
          : /(?:小于|低于|less\s+than)/iu.test(clause) ? 'LT'
          : 'GT'
        // critic round 1 C-A1 修复：字段名从 atrPeriod → period，与 canonical-spec-builder /
        // canonical-spec-v2-ir-compiler 在 trigger.params.period 的读取约定对齐，
        // 避免 silent default to 14 的严重 bug。
        // critic round 1 M-A5 修复：period 加 \d{1,4} 上界
        const period = this.extractNumber(clause, [
          /(?:ATR|平均真实波幅)\s*(\d{1,4})/iu,
        ])
        // critic round 1 M-A4 修复：[ai-z] 是字符类（含 a + i-z），漏 b-h；改为 [a-z] 并白名单
        // 常见 timeframe 后缀（1m/5m/15m/1h/4h/1d/1w/30m）避免 "MA20" 误命中
        const isLikelyTimeframe = /\b\d+\s*[mhdw]\b/iu.test(clause) && !/(?:亿|万|千|百万|billion|million)/iu.test(clause)
        const hasUnsupportedUnit = /(?:亿|万|千|百万|million|billion|thousand)/iu.test(clause)
          || (!isLikelyTimeframe && /\b\d+\s*[KkMmBb]\b/u.test(clause))
        // critic round 1 C-B3 修复：threshold 提取限制 clause 内不跨标点
        // [^0-9,，。；;]{0,12} 排除标点跨段
        const atrThreshold = hasUnsupportedUnit
          ? null
          : this.extractNumber(clause, [
            /(?:阈值|threshold|过滤|filter)[^0-9,，。；;]{0,12}?(\d+(?:\.\d+)?)/iu,
            /(?:大于|小于|低于|高于|超过|不超过|不低于|不高于|greater\s+than|less\s+than|gte|lte|>=|<=)\s*(\d+(?:\.\d+)?)/iu,
          ])
        // critic round 1 C-A2 修复：当前 IR compiler 不消费 thresholdUnit。pct 分支会 silent-wrong
        // （IR 不区分 50 USDT 与 50% 都按 ATR>50 比较）。简化方案：仅支持 quote_currency；
        // 检测到 % 时整个 trigger 改走 recognized_unsupported（pct 单位待 IR 支持后通过 follow-up issue 重新启用）
        const hasPercentUnit = /(?:%|percent|百分)/iu.test(clause)
        if (hasPercentUnit) {
          this.pushTrigger(triggers, seen, {
            key: 'volatility.atr_threshold',
            ...this.resolveUnsupportedTriggerIntent(clause, segment),
            params: { sourceText: clause, reason: 'atr_pct_unit_not_supported_yet' },
            status: 'locked',
            source: 'user_explicit',
            openSlots: [],
          })
          continue
        }
        const openSlots: Array<{
          slotKey: string
          fieldPath: string
          status: 'open'
          priority: 'core'
          questionHint: string
          affectsExecution: boolean
        }> = []
        if (period === null) {
          openSlots.push({
            slotKey: 'volatility.atr_threshold.period',
            fieldPath: 'triggers[volatility.atr_threshold].params.period',
            status: 'open' as const,
            priority: 'core' as const,
            questionHint: '请指定 ATR 计算周期，例如 14（常用默认值）。',
            affectsExecution: true,
          })
        }
        if (atrThreshold === null) {
          const thresholdHint = hasUnsupportedUnit
            ? '检测到中文/英文单位（亿/万/M/K 等）。请改用纯数字阈值，例如 50。'
            : '请给出 ATR 阈值数值，例如 50。'
          openSlots.push({
            slotKey: 'volatility.atr_threshold.threshold',
            fieldPath: 'triggers[volatility.atr_threshold].params.threshold',
            status: 'open' as const,
            priority: 'core' as const,
            questionHint: thresholdHint,
            affectsExecution: true,
          })
        }
        const isLocked = openSlots.length === 0
        this.pushTrigger(triggers, seen, {
          key: 'volatility.atr_threshold',
          phase: atrIntent.phase,
          ...(atrIntent.sideScope ? { sideScope: atrIntent.sideScope } : {}),
          params: {
            operator: atrOperator,
            ...(period !== null ? { period } : {}),
            ...(atrThreshold !== null ? { threshold: atrThreshold } : {}),
            // C-A2：pct 分支已移除，仅写 quote_currency
            thresholdUnit: 'quote_currency',
          },
          status: isLocked ? 'locked' : 'open',
          source: 'user_explicit',
          openSlots,
        })
      }
    }
  }

  private isTimeWindowClause(clause: string): boolean {
    const hasTimezoneKeyword = /(?:北京时间|上海时间|Asia\/Shanghai|UTC|GMT|America\/New_York|纽约时间|东京时间|Asia\/Tokyo|伦敦时间|Europe\/London|交易时段|时间窗口|时间段|time\s*window|trading\s*hours?|允许开仓时间)/iu.test(clause)
    const hasTimeDigits = /(?:\d{1,2}\s*[:：点]\s*\d{0,2}|\d{1,2}\s*[:：点]|\d{1,2}\s*点|\bAM\b|\bPM\b)/iu.test(clause)
    // Timezone keyword alone (missing windows → open_slot) OR timezone + time digits (fully locked)
    if (hasTimezoneKeyword) return true
    // "只在/仅在 ... 时间" pattern with time digits
    if (/(?:只在|仅在).{0,30}(?:\d{1,2}\s*[:：点])/iu.test(clause)) return true
    // 时间窗口 keywords with time digits
    if (hasTimeDigits && /(?:时间|window|trading\s*hour|开仓时间)/iu.test(clause)) return true
    return false
  }

  /** 从自然语言句子提取 strategy.time_window atom 参数。
   * params.timezone: string (IANA timezone 或 offset，如 "Asia/Shanghai" / "+08:00")
   * params.windows: JSON-encoded string of Array<{start: string; end: string}>
   * timezone 缺失 → open_slot.timezone
   * windows 缺失 → open_slot.windows
   */
  private extractTimeWindowTrigger(
    clause: string,
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    const intent = this.resolveUnsupportedTriggerIntent(clause, segment)

    // 1. Extract timezone
    const timezone = this.extractTimezone(clause)

    // 2. Extract time windows (HH:mm pairs)
    const windows = this.extractTimeWindows(clause)

    const openSlots: Array<{
      slotKey: string
      fieldPath: string
      status: 'open'
      priority: 'core'
      questionHint: string
      affectsExecution: boolean
    }> = []

    if (!timezone) {
      openSlots.push({
        slotKey: 'strategy.time_window.timezone',
        fieldPath: 'triggers[strategy.time_window].params.timezone',
        status: 'open' as const,
        priority: 'core' as const,
        questionHint: '请指定时区，例如 Asia/Shanghai（北京时间）或 UTC。',
        affectsExecution: true,
      })
    }

    if (!windows || windows.length === 0) {
      openSlots.push({
        slotKey: 'strategy.time_window.windows',
        fieldPath: 'triggers[strategy.time_window].params.windows',
        status: 'open' as const,
        priority: 'core' as const,
        questionHint: '请指定允许开仓的时间段，例如 09:30-11:30（24小时制）。',
        affectsExecution: true,
      })
    }

    const isLocked = openSlots.length === 0
    this.pushTrigger(triggers, seen, {
      key: 'strategy.time_window',
      phase: 'gate',
      ...(intent.sideScope ? { sideScope: intent.sideScope } : {}),
      params: {
        ...(timezone ? { timezone } : {}),
        // builder reads windows as Array; IR compiler receives JSON string after builder serializes it
        ...(windows && windows.length > 0 ? { windows } : {}),
      },
      status: isLocked ? 'locked' : 'open',
      source: 'user_explicit',
      openSlots,
    })
  }

  private extractTimezone(text: string): string | null {
    // IANA timezone names
    if (/Asia\/Shanghai/iu.test(text)) return 'Asia/Shanghai'
    if (/Asia\/Tokyo/iu.test(text)) return 'Asia/Tokyo'
    if (/Asia\/Hong_Kong/iu.test(text)) return 'Asia/Hong_Kong'
    if (/America\/New_York/iu.test(text)) return 'America/New_York'
    if (/America\/Chicago/iu.test(text)) return 'America/Chicago'
    if (/Europe\/London/iu.test(text)) return 'Europe/London'
    // Named timezone shortcuts (Chinese / English)
    if (/北京时间|上海时间|CST|中国标准时间/iu.test(text)) return 'Asia/Shanghai'
    if (/纽约时间|Eastern\s*Time|EST|EDT/iu.test(text)) return 'America/New_York'
    if (/东京时间|Japan\s*Time|JST/iu.test(text)) return 'Asia/Tokyo'
    if (/伦敦时间|London\s*Time|BST|GMT/iu.test(text)) return 'Europe/London'
    // Plain "UTC"
    if (/\bUTC\b/iu.test(text)) return 'UTC'
    // critic round 1 Major #3 修复：UTC offset 转换为 IANA 兼容的 Etc/GMT 格式
    // （IANA Etc/GMT 符号反转：UTC+8 = Etc/GMT-8），避免 runtime helper 用 IANA name 解析时抛错
    const offsetMatch = text.match(/([+-])(\d{2}):?(\d{2})/)
    if (offsetMatch) {
      const sign = offsetMatch[1]
      const hours = Number(offsetMatch[2])
      const mins = Number(offsetMatch[3])
      // 仅整点 offset 转 Etc/GMT；非整点（如 +05:30）不转，保留 raw offset 让 runtime 自行决定
      if (mins === 0 && hours >= 0 && hours <= 14) {
        // sign 反转：用户写 +08:00 (UTC+8) → IANA Etc/GMT-8
        const ianaSign = sign === '+' ? '-' : '+'
        return `Etc/GMT${ianaSign}${hours}`
      }
      return offsetMatch[0]
    }
    return null
  }

  private extractTimeWindows(
    text: string,
  ): Array<{ start: string; end: string }> | null {
    // critic round 1 Critical #1 修复：旧实现全段扫所有时间样数字 + (i, i+1) 简单配对，
    // "5 分钟级别 9 点到 11 点" 会被误配 (5:00, 9:00)。
    // 新实现：单一 anchored regex 强制 start—连接词—end 同时出现。
    // 支持：
    //   "9:30 到 11:30" / "9:30-11:30" / "09:30 to 11:30" / "9点30 到 11点30"
    //   "9 点 到 11 点" / "9-11" (only with explicit time-keyword nearby; see isTimeWindowClause gate)
    const timePart = String.raw`(\d{1,2}(?:[:：点]\d{0,2})?)`
    const sep = String.raw`\s*(?:到|至|~|–|-|to)\s*`
    const pattern = new RegExp(`${timePart}${sep}${timePart}`, 'giu')

    const windows: Array<{ start: string; end: string }> = []
    const seen = new Set<string>()
    let m: RegExpExecArray | null
    // eslint-disable-next-line no-cond-assign
    while ((m = pattern.exec(text)) !== null) {
      const start = this.normaliseTimeOfDay(m[1])
      const end = this.normaliseTimeOfDay(m[2])
      if (start === null || end === null) continue
      const key = `${start}-${end}`
      if (seen.has(key)) continue
      seen.add(key)
      windows.push({ start, end })
    }

    return windows.length > 0 ? windows : null
  }

  /**
   * 把 "9" / "9:30" / "9点" / "9点30" / "09:30" 等格式归一化为 "HH:MM"。
   * 小时超出 0-23 / 分钟超出 0-59 → 返回 null（fail-closed，进入 open_slot）。
   */
  private normaliseTimeOfDay(raw: string): string | null {
    const match = raw.match(/^(\d{1,2})(?:[:：点](\d{0,2}))?$/)
    if (!match) return null
    const hour = Number(match[1])
    const minute = match[2] ? Number(match[2] || '0') : 0
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    if (hour < 0 || hour > 23) return null
    if (minute < 0 || minute > 59) return null
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  private pushUnknownUnsupportedTriggers(
    segment: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    for (const clause of this.splitLogicClauses(segment)) {
      const intent = this.resolveUnsupportedTriggerIntent(clause, segment)
      if (/(?:外部喊单|喊单群|KOL|口令|神秘评分|内部\s*AI|external\s+signal)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'external.signal',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:截图|神秘形态|image|screenshot)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'image.pattern',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }

      if (/(?:新闻情绪|Twitter|社媒|市场情绪|sentiment|news)/iu.test(clause)) {
        this.pushTrigger(triggers, seen, {
          key: 'news.sentiment',
          ...intent,
          params: { sourceText: clause },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        })
      }
    }
  }

  private pushRecognizedUnsupportedActions(text: string, actions: SeedAction[], seen: Set<string>): void {
    const push = (key: string, params: Record<string, unknown>) => {
      const action: SeedAction = {
        key,
        params,
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
      const signature = JSON.stringify(action)
      if (seen.has(signature)) return
      seen.add(signature)
      actions.push(action)
    }

    for (const clause of this.splitLogicClauses(text)) {
      if (this.hasNegatedUnsupportedActionContext(clause)) continue

      if (/(?:暂停交易|停止交易|暂停策略|停止策略|pause\s+trading|halt\s+trading)/iu.test(clause)) {
        push('action.pause_trading', { sourceText: clause })
      }
    }
  }

  private extractRecognizedUnsupportedPosition(
    text: string,
    triggers: SeedTrigger[],
  ): NonNullable<CodegenSemanticPatch['position']> | null {
    const leverage = this.extractNumber(text, [
      /(\d+(?:\.\d+)?)\s*(?:倍杠杆|x\s*leverage|X\s*leverage)/u,
    ])
    if ((leverage !== null || /杠杆|leverage/iu.test(text)) && !/(?:不使用|不用|无需|无|no)\s*.{0,8}(?:杠杆|leverage)/iu.test(text)) {
      return {
        mode: 'position.leverage',
        value: leverage ?? 1,
        positionMode: this.resolvePositionMode(text, triggers),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    if (/(?:逐仓|全仓|isolated|cross\s+margin)/iu.test(text)) {
      return {
        mode: 'position.margin_mode',
        value: 1,
        positionMode: this.resolvePositionMode(text, triggers),
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }
    }

    return null
  }

  private resolveUnsupportedTriggerIntent(
    clause: string,
    segment: string,
  ): { phase: SeedTrigger['phase']; sideScope?: SeedTrigger['sideScope'] } {
    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (intent) {
      return {
        phase: intent.phase,
        sideScope: intent.sideScope,
      }
    }

    if (/(?:过滤|条件|阈值|filter|condition|threshold|大于|小于|高于|超过|gte|lte|greater\s+than|less\s+than)/iu.test(clause)) {
      return { phase: 'gate' }
    }

    return { phase: 'entry' }
  }

  private hasNegatedUnsupportedContext(clause: string): boolean {
    return /(?:不要|不用|无需|不|without|no)\s*.{0,12}(?:放量|成交量|量能|volume|ATR|平均真实波幅|分批止盈|部分止盈|多档止盈|平一半|scale\s*out)/iu.test(clause)
  }

  private hasSupportedVolumeRelativeAverageContext(clause: string): boolean {
    return /放量|成交量放大|量能放大|volume\s*spike/iu.test(clause)
      || /(?:成交量|量能|volume).{0,32}(?:过去|最近)\s*\d{1,4}\s*根?(?:K\s*线)?(?:均量|平均量|平均成交量)/iu.test(clause)
      || /(?:过去|最近)\s*\d{1,4}\s*根?(?:K\s*线)?(?:均量|平均量|平均成交量).{0,32}\d+(?:\.\d+)?\s*倍/iu.test(clause)
  }

  private hasNegatedUnsupportedActionContext(clause: string): boolean {
    return /(?:不要|不用|无需|不可|不能|禁止|避免|不|without|no)\s*.{0,12}(?:加仓|补仓|反手|scale\s*in|reverse\s+position|flip\s+position)/iu.test(clause)
  }

  private hasNegatedPositionLifecycleActionContext(clause: string): boolean {
    return /(?:不要|不用|无需|不可|不能|禁止|避免|without|no)\s*.{0,12}(?:减仓|加仓|补仓|反手|scale\s*in|scale\s*out|reverse\s+position|flip\s+position)/iu.test(clause)
      || /不(?:要|再)?(?:减仓|加仓|补仓|反手)/u.test(clause)
  }

  private hasNegatedUnsupportedPositionContext(text: string): boolean {
    return /(?:不要|不用|无需|不可|不能|禁止|避免|不|without|no)\s*.{0,12}(?:DCA|定投|补仓)/iu.test(text)
  }

  private hasPositiveDcaScheduleContext(text: string): boolean {
    return this.extractDcaLifecycleTexts(text).length > 0
  }

  private pushTrigger(triggers: SeedTrigger[], seen: Set<string>, trigger: SeedTrigger): void {
    const signature = JSON.stringify([trigger.key, trigger.phase, trigger.sideScope ?? null, trigger.params])
    if (seen.has(signature)) return
    seen.add(signature)
    triggers.push(trigger)
  }

  private pushRisk(risk: SeedRisk[], riskItem: SeedRisk): void {
    const signature = JSON.stringify([riskItem.key, riskItem.params])
    if (risk.some(item => JSON.stringify([item.key, item.params]) === signature)) return
    risk.push(riskItem)
  }

  private resolvePositionMode(text: string, triggers: SeedTrigger[]): 'long_only' | 'short_only' | 'long_short' {
    const sideScopes = new Set(triggers.map(trigger => trigger.sideScope).filter(Boolean))

    if (sideScopes.has('long') && sideScopes.has('short')) {
      return 'long_short'
    }
    if (/双向网格/u.test(text) || /bidirectional/u.test(text)) {
      return 'long_short'
    }
    if (/做空|开空|卖空/u.test(text) && !/做多|开多|买入/u.test(text)) {
      return 'short_only'
    }
    return 'long_only'
  }

  private resolveRiskBasis(text: string): SemanticRiskBasis {
    if (/持仓盈亏|持仓.*盈亏|持仓收益率|持仓.*收益率|浮盈|pnl/u.test(text)) {
      return 'position_pnl'
    }
    return 'entry_avg_price'
  }

  private resolveRiskBasisSource(text: string, basis: SemanticRiskBasis): SemanticRiskBasisSource {
    if (basis === 'position_pnl') {
      return 'user_explicit'
    }
    if (/开仓价|入场价|入场均价|持仓均价|成本价|均价|entry_avg_price/u.test(text)) {
      return 'user_explicit'
    }
    return 'system_default'
  }

  private resolveRiskClauseContext(text: string, kind: 'stop_loss' | 'take_profit'): string {
    const matcher = kind === 'stop_loss'
      ? /亏损|止损/u
      : /盈利|止盈/u
    return this.splitRiskClauses(text).find(clause => matcher.test(clause)) ?? text
  }

  private splitRiskClauses(text: string): string[] {
    return text
      .split(/[；;。。，,、]|(?:并且|以及|同时|且)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private isHaltOnlyRiskContext(text: string): boolean {
    return /暂停策略|停止策略/u.test(text) && !/止损|平仓|全平/u.test(text)
  }

  private resolveTradeIntent(segment: string): { phase: 'entry' | 'exit'; sideScope: 'long' | 'short' } | null {
    if (/买回平空|平空|买回空单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'short' }
    }
    if (/卖出平多|平多|卖出多单/u.test(segment)) {
      return { phase: 'exit', sideScope: 'long' }
    }
    if (/出场|离场/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做空|开空|空单|short/u.test(segment)) {
      return { phase: 'entry', sideScope: 'short' }
    }
    if (/卖出|卖/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    if (/做多|开多|买入|买|入场|开仓|long/u.test(segment)) {
      return { phase: 'entry', sideScope: 'long' }
    }
    if (/平仓/u.test(segment)) {
      return { phase: 'exit', sideScope: /做空|开空|空单|short/u.test(segment) ? 'short' : 'long' }
    }
    return null
  }

  private isTrueMovingAverageCrossClause(clause: string): { isCross: boolean } | null {
    return this.parseMovingAverageCrossClause(clause)
      ? { isCross: true }
      : null
  }

  private parseMovingAverageCrossClause(clause: string): {
    indicator: 'ma' | 'ema'
    direction: 'up' | 'down'
    fastPeriod?: number
    slowPeriod?: number
  } | null {
    const normalized = clause.replace(/\s+/gu, '')
    const indicator: 'ma' | 'ema' = /\bEMA\s*\d+/iu.test(clause) ? 'ema' : 'ma'
    const refs = Array.from(normalized.matchAll(/(?:EMA|MA)(\d{1,4})/giu))
      .map(match => Number(match[1]))
      .filter(value => Number.isFinite(value))
    const barePairMatch = normalized.match(/(\d{1,4})[\/和与、](\d{1,4})均线/)
      ?? normalized.match(/(\d{1,4})均线.*?(\d{1,4})均线/)
    const barePairRefs = barePairMatch
      ? [Number(barePairMatch[1]), Number(barePairMatch[2])].filter(value => Number.isFinite(value))
      : []
    const resolvedRefs = refs.length > 0 ? refs : barePairRefs

    const hasUpWord = /上穿|crossover|金叉/iu.test(normalized)
    const hasDownWord = /下穿|crossunder|死叉/iu.test(normalized)
    if (!hasUpWord && !hasDownWord) {
      return null
    }

    const hasPairMarkers = /[\/和与、]/u.test(normalized) || /均线/iu.test(normalized) || resolvedRefs.length >= 2
    if (!hasPairMarkers) {
      return null
    }

    const isExplicitPairCross = /(?:EMA|MA)\d{1,4}.*?(?:上穿|下穿|crossover|crossunder).*(?:EMA|MA)\d{1,4}/iu.test(normalized)
      || /(\d{1,4})[\/和与、](\d{1,4})均线.*?(?:上穿|下穿|crossover|crossunder)/iu.test(normalized)
    const isGoldenCrossPair = /(?:EMA|MA)\d{1,4}.*?(?:和|\/|与|、)?(?:EMA|MA)\d{1,4}.*?(?:金叉|死叉)/iu.test(normalized)
      || /(?:\d{1,4})\s*[\/和与、]\s*(?:\d{1,4})\s*均线.*?(?:金叉|死叉)/iu.test(normalized)

    if (!isExplicitPairCross && !isGoldenCrossPair) {
      return null
    }

    const direction: 'up' | 'down' = hasUpWord ? 'up' : 'down'
    const fastPeriod = resolvedRefs[0]
    const slowPeriod = resolvedRefs[1]

    return {
      indicator,
      direction,
      ...(fastPeriod !== undefined ? { fastPeriod } : {}),
      ...(slowPeriod !== undefined ? { slowPeriod } : {}),
    }
  }

  private extractRsiThreshold(clause: string, period: number): number | null {
    const compact = clause.replace(/\s+/gu, '')
    const explicitThreshold = this.extractNumber(compact, [
      /(?:高于|大于|超过|上方|低于|小于|下方|上穿|穿回|下穿|跌破)(\d+(?:\.\d+)?)/u,
      /(?:从)?(\d+(?:\.\d+)?)(?:上方|下方)(?:向上|向下)?(?:穿回|上穿|下穿|跌破)/u,
    ])
    if (explicitThreshold !== null) return explicitThreshold

    const numbers = Array.from(compact.matchAll(/\d+(?:\.\d+)?/gu))
      .map(match => Number(match[0]))
      .filter(value => Number.isFinite(value))
    const withoutPeriod = numbers.filter(value => value !== period)
    return withoutPeriod[0] ?? numbers[0] ?? null
  }

  private isRsiThresholdAliasClause(clause: string, segment: string): boolean {
    if (!/RSI/iu.test(segment)) return false
    if (/\b(?:MA|EMA)\s*\d{1,4}/iu.test(clause)) return false
    return /(?:高于|大于|超过|上方|低于|小于|下方|上穿|穿回|下穿|跌破)\s*\d+(?:\.\d+)?/u.test(clause)
  }

  private extractMacdParams(text: string): { fastPeriod: number; slowPeriod: number; signalPeriod: number } | null {
    const match = text.match(/MACD\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*\/\s*(\d{1,3})/iu)
    if (!match?.[1] || !match[2] || !match[3]) return null
    const fastPeriod = Number(match[1])
    const slowPeriod = Number(match[2])
    const signalPeriod = Number(match[3])
    if (!Number.isFinite(fastPeriod) || !Number.isFinite(slowPeriod) || !Number.isFinite(signalPeriod)) {
      return null
    }
    return { fastPeriod, slowPeriod, signalPeriod }
  }

  private splitLogicClauses(segment: string): string[] {
    return segment
      .split(/[，,、]|(?:且|并且|同时|以及)/u)
      .map(clause => clause.trim())
      .filter(Boolean)
  }

  private hasExplicitPriceChangeContext(segment: string): boolean {
    return /(相对|上一根|前一根|前收盘|收盘价|开仓均价|入场价|成本价|持仓盈亏|盈亏|pnl|收益率)/iu.test(segment)
      || /(?:\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)).*(?:上涨|下跌|涨|跌).*(?:%|百分)/iu.test(segment)
      || (/(?:上涨|下跌|涨|跌|回撤|回落|回调|反弹).*(?:%|百分)/u.test(segment) && this.hasExecutableTradeIntent(segment))
  }

  private hasExplicitPriceChangeDirection(segment: string): boolean {
    return /(上涨|下跌|涨|跌|回撤|回落|回调|反弹)/u.test(segment)
  }

  private hasExecutableTradeIntent(segment: string): boolean {
    return /(买入|卖出|买|卖|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空|多单|空单)/u.test(segment)
  }

  private hasBollingerBandAction(segment: string): boolean {
    return /(触及|突破|回到|回归|跌破|上穿|下穿|站上|失守|高于|低于)/u.test(segment)
  }

  private hasExecutableConditionOperator(segment: string): boolean {
    return this.hasBollingerBandAction(segment)
      || /(上方|下方|之上|之下|大于|小于|超过|少于|>=|<=|>|<)/u.test(segment)
  }

  private resolvePercentDirection(segment: string): 'up' | 'down' | 'drawdown' | null {
    if (/回撤/u.test(segment)) {
      return 'drawdown'
    }
    if (/(下跌|跌|回落|回调)/u.test(segment)) {
      return 'down'
    }
    if (/(上涨|涨|反弹)/u.test(segment)) {
      return 'up'
    }
    return null
  }

  private extractAliasContext(text: string): SemanticAliasContext {
    const bollingerBandParams = this.extractBollingerBandAliasContext(text)
    const movingAverage = this.extractMovingAverageAliasContext(text)
    const rsi = this.extractRsiAliasContext(text)

    return {
      ...(bollingerBandParams ? { bollingerBandParams } : {}),
      ...(movingAverage ? { movingAverage } : {}),
      ...(rsi ? { rsi } : {}),
    }
  }

  private extractMovingAverageAliasContext(text: string): SemanticAliasContext['movingAverage'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitLogicClauses(segment))
      .filter(clause => this.isMovingAverageAliasDeclarationClause(clause))
      .map(clause => ({
        declaration: this.extractLastMovingAverageDeclaration(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((item): item is { declaration: { indicator: 'ma' | 'ema'; period: number }; isCorrection: boolean } => item.declaration !== null)
    const lastCorrection = declarations.filter(item => item.isCorrection).at(-1)
    if (lastCorrection) {
      return lastCorrection.declaration
    }

    const uniqueDeclarations = declarations.map(item => item.declaration).filter((declaration, index, all) => (
      all.findIndex(item => item.indicator === declaration.indicator && item.period === declaration.period) === index
    ))
    const declaration = uniqueDeclarations[0]

    return uniqueDeclarations.length === 1 && declaration ? declaration : null
  }

  private extractLastMovingAverageDeclaration(clause: string): { indicator: 'ma' | 'ema'; period: number } | null {
    const matches = Array.from(clause.matchAll(/\b(MA|EMA)\s*(\d{1,4})(?!\s*[\/和与、]\s*\d)/giu))
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[2])
    if (!Number.isFinite(period)) return null

    return {
      indicator: match[1].toLowerCase() === 'ema' ? 'ema' : 'ma',
      period,
    }
  }

  private isMovingAverageAliasDeclarationClause(clause: string): boolean {
    if (/布林|bollinger|上轨|下轨|中轨/iu.test(clause)) return false
    if (this.hasExecutableTradeIntent(clause)) return false
    if (/(?:突破|上穿|站上|高于|跌破|下穿|失守|低于)/u.test(clause)) return false
    if (this.isCorrectionClause(clause)) {
      return /\b(?:MA|EMA)\s*\d{1,4}(?!\s*[\/和与、]\s*\d)/iu.test(clause)
    }
    if (!/(使用|采用|基于|指标|参数|设置|用)/u.test(clause)) return false
    return /\b(?:MA|EMA)\s*\d{1,4}(?!\s*[\/和与、]\s*\d)/iu.test(clause)
  }

  private extractRsiAliasContext(text: string): SemanticAliasContext['rsi'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitLogicClauses(segment))
      .filter(clause => this.isRsiAliasDeclarationClause(clause))
      .map(clause => ({
        period: this.extractLastRsiPeriod(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((item): item is { period: number; isCorrection: boolean } => item.period !== null)
    const lastCorrection = declarations.filter(item => item.isCorrection).at(-1)
    if (lastCorrection) {
      return { period: lastCorrection.period }
    }

    const uniquePeriods = Array.from(new Set(declarations.map(item => item.period)))
    const period = uniquePeriods[0]

    return uniquePeriods.length === 1 && period !== undefined ? { period } : null
  }

  private extractLastRsiPeriod(clause: string): number | null {
    const matches = Array.from(clause.matchAll(/RSI\s*(\d{1,3})/giu))
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1]) return null

    const period = Number(match[1])
    return Number.isFinite(period) ? period : null
  }

  private extractBollingerBandAliasContext(text: string): SemanticAliasContext['bollingerBandParams'] | null {
    const declarations = this.splitSegments(text)
      .flatMap(segment => this.splitCommaClauses(segment))
      .filter(clause => this.isBollingerAliasDeclarationClause(clause))
      .map(clause => ({
        params: this.extractLastBollingerBandParams(clause),
        isCorrection: this.isCorrectionClause(clause),
      }))
      .filter((declaration): declaration is { params: { period?: number; stdDev?: number }; isCorrection: boolean } => declaration.params !== null)
    const lastCorrection = declarations.filter(declaration => declaration.isCorrection).at(-1)
    if (lastCorrection) {
      return lastCorrection.params
    }

    const uniqueDeclarations = declarations.map(declaration => declaration.params).filter((declaration, index, all) => (
      all.findIndex(item => item.period === declaration.period && item.stdDev === declaration.stdDev) === index
    ))
    const declaration = uniqueDeclarations[0]

    return uniqueDeclarations.length === 1 && declaration ? declaration : null
  }

  private isBollingerAliasDeclarationClause(clause: string): boolean {
    if (!/布林带|bollinger/iu.test(clause)) return false
    if (this.hasExecutableTradeIntent(clause)) return false
    if (/(?:上轨|下轨|中轨)/u.test(clause) && this.hasBollingerBandAction(clause)) return false
    if (this.isCorrectionClause(clause)) return true
    return /(使用|采用|基于|指标|参数|设置|用)/u.test(clause)
  }

  private isCorrectionClause(clause: string): boolean {
    return /(更正|修正|改为|调整为|改成|不是|而是)/u.test(clause)
  }

  private isRsiAliasDeclarationClause(clause: string): boolean {
    if (this.hasExecutableTradeIntent(clause)) return false
    if (this.isCorrectionClause(clause)) return /RSI\s*\d{1,3}/iu.test(clause)
    if (!/(使用|采用|基于|指标|参数|设置|用)/u.test(clause)) return false
    return /RSI\s*\d{1,3}/iu.test(clause)
  }

  private extractLastBollingerBandParams(segment: string): { period?: number; stdDev?: number } | null {
    const matches = [
      ...Array.from(segment.matchAll(/布林带\s*[（(]\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)\s*[)）]/gu)),
      ...Array.from(segment.matchAll(/布林带\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)/gu)),
      ...Array.from(segment.matchAll(/布林带\s*(\d{1,4})\s*(?:周期|日|根|period)?\s*(\d+(?:\.\d+)?)\s*(?:倍)?\s*标准差/gu)),
    ]
      .filter(match => match.index !== undefined)
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    const match = matches.at(-1)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[1])
    const stdDev = Number(match[2])
    if (!Number.isFinite(period) || !Number.isFinite(stdDev)) return null

    return { period, stdDev }
  }

  private extractBollingerBandParams(segment: string): { period?: number; stdDev?: number } | null {
    const match = segment.match(/布林带\s*[（(]\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)\s*[)）]/u)
      ?? segment.match(/布林带\s*(\d{1,4})\s*[，,]\s*(\d+(?:\.\d+)?)/u)
      ?? segment.match(/布林带\s*(\d{1,4})\s*(?:周期|日|根|period)?\s*(\d+(?:\.\d+)?)\s*(?:倍)?\s*标准差/u)
    if (!match?.[1] || !match[2]) return null

    const period = Number(match[1])
    const stdDev = Number(match[2])
    if (!Number.isFinite(period) || !Number.isFinite(stdDev)) return null

    return { period, stdDev }
  }

  private harmonizeBollingerTriggers(triggers: SeedTrigger[]): SeedTrigger[] {
    const reference = triggers.find(trigger => (
      trigger.key.startsWith('bollinger.touch_')
      && typeof trigger.params?.period === 'number'
      && typeof trigger.params.stdDev === 'number'
    ))

    if (!reference) {
      return this.removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(triggers)
    }

    const harmonized = triggers.map((trigger) => {
      if (!trigger.key.startsWith('bollinger.touch_')) {
        return trigger
      }
      return {
        ...trigger,
        params: {
          ...trigger.params,
          ...(typeof trigger.params?.period === 'number' ? {} : { period: reference.params?.period }),
          ...(typeof trigger.params?.stdDev === 'number' ? {} : { stdDev: reference.params?.stdDev }),
        },
      }
    })
    return this.removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(harmonized)
  }

  private removeLegacyBollingerTriggersWithUniversalBoundaryEquivalent(triggers: SeedTrigger[]): SeedTrigger[] {
    const universalBollingerBoundaries = new Set(
      triggers
        .filter(trigger => (
          trigger.key === 'price.detect.indicator_boundary'
          && this.isPlainObject(trigger.params?.indicator)
          && trigger.params.indicator.name === 'bollinger'
          && typeof trigger.params.boundaryRole === 'string'
        ))
        .map(trigger => JSON.stringify([
          trigger.params?.boundaryRole,
          trigger.phase,
          trigger.sideScope ?? null,
        ])),
    )
    if (universalBollingerBoundaries.size === 0) return triggers

    return triggers.filter((trigger) => {
      const boundaryRole = this.resolveLegacyBollingerBoundaryRole(trigger.key)
      if (!boundaryRole) return true
      if (boundaryRole === 'middle') {
        return !triggers.some(candidate => (
          candidate.key === 'price.detect.indicator_boundary'
          && candidate.phase === trigger.phase
          && candidate.params?.boundaryRole === 'middle'
          && this.isPlainObject(candidate.params.indicator)
          && candidate.params.indicator.name === 'bollinger'
        ))
      }
      return !universalBollingerBoundaries.has(JSON.stringify([
        boundaryRole,
        trigger.phase,
        trigger.sideScope ?? null,
      ]))
    })
  }

  private removeLogicalAnyOfExitChildren(triggers: SeedTrigger[]): SeedTrigger[] {
    const anyOfExitChildren = new Set<string>()

    for (const trigger of triggers) {
      if (trigger.key !== 'logical.any_of' || trigger.phase !== 'exit') continue
      const items = trigger.params?.items
      if (!Array.isArray(items)) continue

      for (const item of items) {
        if (!this.isPlainObject(item) || typeof item.key !== 'string') continue
        anyOfExitChildren.add(this.buildLogicalAnyOfChildSignature(item.key, item.params))
      }
    }

    if (anyOfExitChildren.size === 0) return triggers

    return triggers.filter((trigger) => {
      if (trigger.key === 'logical.any_of' || trigger.phase !== 'exit') return true
      return !anyOfExitChildren.has(this.buildLogicalAnyOfChildSignature(trigger.key, trigger.params))
    })
  }

  private buildLogicalAnyOfChildSignature(key: string, params: unknown): string {
    return JSON.stringify([key, this.stableValue(params ?? {})])
  }

  private removeStaticIndicatorTriggersCoveredBySequences(triggers: SeedTrigger[]): SeedTrigger[] {
    const coveredIndicatorBoundaries = new Set<string>()

    for (const trigger of triggers) {
      const boundary = this.readSequenceCoveredIndicatorBoundary(trigger)
      if (boundary) {
        coveredIndicatorBoundaries.add(boundary)
      }
    }

    if (coveredIndicatorBoundaries.size === 0) return triggers

    return triggers.filter((trigger) => {
      const boundary = this.readStaticIndicatorBoundary(trigger)
      return !boundary || !coveredIndicatorBoundaries.has(boundary)
    })
  }

  private readSequenceCoveredIndicatorBoundary(trigger: SeedTrigger): string | null {
    if (trigger.key !== 'condition.sequence') return null

    const sequenceKind = trigger.params?.sequenceKind
    if (sequenceKind !== 'pullback_reclaim' && sequenceKind !== 'rsi_reclaim') {
      return null
    }

    if (sequenceKind === 'pullback_reclaim') {
      const reference = trigger.params?.reference
      if (!this.isPlainObject(reference)) return null
      const indicator = typeof reference.indicator === 'string' ? reference.indicator.toLowerCase() : null
      const period = typeof reference.period === 'number' && Number.isFinite(reference.period) ? reference.period : null
      if (!indicator || period === null) return null

      return this.buildStaticIndicatorBoundarySignature({
        key: 'indicator.above',
        phase: trigger.phase,
        sideScope: trigger.sideScope,
        indicator,
        period,
      })
    }

    const threshold = typeof trigger.params?.threshold === 'number' && Number.isFinite(trigger.params.threshold)
      ? trigger.params.threshold
      : null
    if (threshold === null) return null

    return this.buildStaticIndicatorBoundarySignature({
      key: 'oscillator.rsi_gte',
      phase: trigger.phase,
      sideScope: trigger.sideScope,
      indicator: 'rsi',
      period: typeof trigger.params?.period === 'number' && Number.isFinite(trigger.params.period)
        ? trigger.params.period
        : 14,
      threshold,
    })
  }

  private readStaticIndicatorBoundary(trigger: SeedTrigger): string | null {
    if (trigger.key === 'indicator.above' || trigger.key === 'indicator.below') {
      const indicator = typeof trigger.params?.indicator === 'string' ? trigger.params.indicator.toLowerCase() : 'ma'
      const period = typeof trigger.params?.['reference.period'] === 'number' && Number.isFinite(trigger.params['reference.period'])
        ? trigger.params['reference.period']
        : null
      if (period === null) return null

      return this.buildStaticIndicatorBoundarySignature({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope,
        indicator,
        period,
      })
    }

    if (trigger.key === 'oscillator.rsi_gte' || trigger.key === 'oscillator.rsi_lte') {
      const threshold = typeof trigger.params?.value === 'number' && Number.isFinite(trigger.params.value)
        ? trigger.params.value
        : null
      if (threshold === null) return null

      return this.buildStaticIndicatorBoundarySignature({
        key: trigger.key,
        phase: trigger.phase,
        sideScope: trigger.sideScope,
        indicator: 'rsi',
        period: typeof trigger.params?.period === 'number' && Number.isFinite(trigger.params.period)
          ? trigger.params.period
          : 14,
        threshold,
      })
    }

    if (
      (trigger.key === 'indicator.cross_over' || trigger.key === 'indicator.cross_under')
      && typeof trigger.params?.indicator === 'string'
      && trigger.params.indicator.toLowerCase() === 'rsi'
    ) {
      const threshold = typeof trigger.params?.value === 'number' && Number.isFinite(trigger.params.value)
        ? trigger.params.value
        : null
      if (threshold === null) return null

      return this.buildStaticIndicatorBoundarySignature({
        key: trigger.key === 'indicator.cross_over' ? 'oscillator.rsi_gte' : 'oscillator.rsi_lte',
        phase: trigger.phase,
        sideScope: trigger.sideScope,
        indicator: 'rsi',
        period: typeof trigger.params?.period === 'number' && Number.isFinite(trigger.params.period)
          ? trigger.params.period
          : 14,
        threshold,
      })
    }

    return null
  }

  private buildStaticIndicatorBoundarySignature(input: {
    key: string
    phase: SeedTrigger['phase']
    sideScope?: SeedTrigger['sideScope']
    indicator: string
    period: number
    threshold?: number
  }): string {
    return JSON.stringify([
      input.key,
      input.phase,
      input.sideScope ?? null,
      input.indicator,
      input.period,
      input.threshold ?? null,
    ])
  }

  private resolveLegacyBollingerBoundaryRole(key: string): 'upper' | 'lower' | 'middle' | null {
    if (key === 'bollinger.touch_upper') return 'upper'
    if (key === 'bollinger.touch_lower') return 'lower'
    if (key === 'bollinger.touch_middle') return 'middle'
    return null
  }

  private resolvePercentBasis(segment: string): 'prev_close' | 'entry_avg_price' | 'position_pnl' {
    if (/开仓均价|入场价|成本价/u.test(segment)) {
      return 'entry_avg_price'
    }
    if (/持仓盈亏|持仓.*盈亏|浮盈|pnl/u.test(segment)) {
      return 'position_pnl'
    }
    return 'prev_close'
  }

  private extractConfirmationMode(segment: string): 'close_confirm' | null {
    if (/收盘|确认|close/u.test(segment)) {
      return 'close_confirm'
    }
    return null
  }

  private extractBoundaryConfirmationMode(segment: string): 'touch' | 'close_confirm' | null {
    const closeConfirm = this.extractConfirmationMode(segment)
    if (closeConfirm) return closeConfirm
    if (/触及|触碰|碰到|回到|达到|到达/u.test(segment)) {
      return 'touch'
    }
    return null
  }

  private extractExchange(text: string): string | null {
    if (/币安/u.test(text)) return 'binance'
    if (/欧易/u.test(text)) return 'okx'
    if (/海伯利安|hyperliquid/iu.test(text)) return 'hyperliquid'

    const match = text.match(/\b(OKX|BINANCE|HYPERLIQUID)\b/iu)
    if (!match?.[1]) return null

    return match[1].toLowerCase()
  }

  private extractMarketType(text: string): string | null {
    if (/现货|spot/u.test(text)) return 'spot'
    if (/合约|永续|perp|swap|\bcontract\b/iu.test(text)) return 'perp'
    return null
  }

  private extractSymbol(text: string): MarketInstrumentSymbolResolution | null {
    for (const candidate of this.extractSymbolCandidates(text)) {
      const resolution = this.symbolResolver.resolve(candidate)
      if (resolution && /[A-Z]/iu.test(resolution.base)) {
        return this.withMarketTypeHint(resolution, candidate)
      }
    }

    return null
  }

  private extractSymbolCandidates(text: string): string[] {
    const candidates: string[] = []

    for (const match of text.matchAll(/\b([A-Z0-9]{2,20}(?:[-/\s]?(?:FDUSD|USDT|USDC|BUSD|TUSD|USD))(?:-SWAP|:PERP|:SPOT)?)\b/giu)) {
      const candidate = match[1]?.trim()
      if (!candidate || !/[A-Z]/iu.test(candidate)) continue
      candidates.push(candidate)
    }

    for (const match of text.matchAll(/\b([A-Z][A-Z0-9]{1,19}\s*(?:永续合约|合约))/giu)) {
      const candidate = match[1]?.trim()
      if (candidate) {
        candidates.push(candidate)
      }
    }

    for (const match of text.matchAll(/((?:合约|永续合约|永续|现货|spot|perp|swap|contract)\s+[A-Z][A-Z0-9]{1,19})(?=$|[\s,，、。;；])/giu)) {
      const candidate = match[1]?.trim()
      if (candidate) {
        candidates.push(candidate)
      }
    }

    for (const match of text.matchAll(/(?:买入|买|卖出|卖|做多|做空|交易|标的|币种)\s*([A-Z][A-Z0-9]{1,19})\b/giu)) {
      const candidate = match[1]?.trim()
      if (candidate) {
        candidates.push(candidate)
      }
    }

    const leadingCandidate = /^\s*([A-Z][A-Z0-9]{1,19})(?=$|[\s,，、。])/iu.exec(text)?.[1]?.trim()
    if (leadingCandidate) {
      candidates.push(leadingCandidate)
    }

    for (const match of text.matchAll(/(以太坊|比特币)(?:永续合约|合约)?/gu)) {
      const candidate = match[0]?.trim()
      if (candidate) {
        candidates.push(candidate)
      }
    }

    return candidates
  }

  private withMarketTypeHint(
    resolution: MarketInstrumentSymbolResolution,
    evidenceText: string,
  ): MarketInstrumentSymbolResolution {
    if (resolution.marketTypeHint) {
      return resolution
    }

    const marketTypeHint = this.extractMarketType(evidenceText)
    if (marketTypeHint !== 'perp' && marketTypeHint !== 'spot') {
      return resolution
    }

    return {
      ...resolution,
      marketTypeHint,
    }
  }

  private extractFirstTimeframe(text: string): string | null {
    const special = this.matchSpecialChinesePhraseTimeframe(text)
    if (special) return special

    const compactMatch = text.match(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b(?:\s*(?:level|tf|timeframe))?/iu)
    if (compactMatch?.[1] && compactMatch[2]) {
      return `${compactMatch[1]}${this.normalizeTimeframeUnit(compactMatch[2])}`
    }

    for (const chineseMatch of text.matchAll(/((?:\d{1,2})|[一二三四五六七八九十]+)\s*(分钟|分|小时|时|天|日)(?:线|级别|周期)?/gu)) {
      if (!chineseMatch[1] || !chineseMatch[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, chineseMatch.index ?? -1, chineseMatch[0].length)) continue
      const value = this.parseTimeframeNumber(chineseMatch[1])
      if (value === null) continue

      return `${value}${this.normalizeTimeframeUnit(chineseMatch[2])}`
    }
    if (/日线|日\s*K|天线/u.test(text)) return '1d'
    return null
  }

  private extractFirstExecutionContextTimeframe(text: string): string | null {
    return this.extractExecutionContextTimeframes(text)[0] ?? null
  }

  private extractExecutionContextTimeframes(text: string): string[] {
    const values: string[] = []
    const seen = new Set<string>()
    const pushCandidate = (value: string, index: number, length: number) => {
      if (!SUPPORTED_EXECUTION_TIMEFRAMES.has(value)) return
      if (this.isRollingWindowTimeframeCandidate(text, index, length)) return
      if (seen.has(value)) return
      seen.add(value)
      values.push(value)
    }

    for (const special of this.matchAllSpecialChinesePhraseTimeframes(text)) {
      pushCandidate(special.value, special.index, special.length)
    }

    for (const match of text.matchAll(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b(?:\s*(?:level|tf|timeframe))?/giu)) {
      if (!match[1] || !match[2]) continue
      pushCandidate(`${match[1]}${this.normalizeTimeframeUnit(match[2])}`, match.index ?? -1, match[0].length)
    }

    for (const match of text.matchAll(/((?:\d{1,2})|[一二三四五六七八九十]+)\s*(分钟|分|小时|时|天|日)(?:线|级别|周期)?/gu)) {
      if (!match[1] || !match[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, match.index ?? -1, match[0].length)) continue
      const value = this.parseTimeframeNumber(match[1])
      if (value === null) continue
      pushCandidate(`${value}${this.normalizeTimeframeUnit(match[2])}`, match.index ?? -1, match[0].length)
    }

    if (/日线|日\s*K|天线/u.test(text)) {
      pushCandidate('1d', text.search(/日线|日\s*K|天线/u), 2)
    }

    return values
  }

  private hasMultiTimeframeMovingAveragePredicateScope(text: string): boolean {
    return this.splitSegments(text).some(segment =>
      this.splitCommaClauses(segment).some(clause =>
        this.splitConjunctionClauses(clause).some((subClause) => {
          const timeframes = this.extractAllTimeframes(subClause)
          return timeframes.length > 1
            && /(?:MA|EMA)\s*\d+|均线/iu.test(subClause)
            && /突破|上穿|站上|高于|上方|跌破|下穿|失守|低于|下方/u.test(subClause)
            && (this.resolveTradeIntent(subClause) ?? this.resolveTradeIntent(clause)) !== null
        }),
      ),
    )
  }

  private splitConjunctionClauses(clause: string): string[] {
    if (!/(?:并且|同时|且|并)/u.test(clause)) {
      return [clause]
    }

    const subClauses = clause
      .split(/(?:并且|同时|且|并)/u)
      .map(part => part.trim())
      .filter(Boolean)

    return subClauses.length > 0 ? subClauses : [clause]
  }

  private extractAllTimeframes(text: string): string[] {
    const values: string[] = []
    const seen = new Set<string>()
    const push = (value: string) => {
      if (seen.has(value)) return
      seen.add(value)
      values.push(value)
    }

    for (const special of this.matchAllSpecialChinesePhraseTimeframes(text)) {
      push(special.value)
    }

    for (const match of text.matchAll(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b(?:\s*(?:level|tf|timeframe))?/giu)) {
      if (!match[1] || !match[2]) continue
      push(`${match[1]}${this.normalizeTimeframeUnit(match[2])}`)
    }

    for (const match of text.matchAll(/((?:\d{1,2})|[一二三四五六七八九十]+)\s*(分钟|分|小时|时|天|日)(?:线|级别|周期)?/gu)) {
      if (!match[1] || !match[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, match.index ?? -1, match[0].length)) continue
      const value = this.parseTimeframeNumber(match[1])
      if (value === null) continue
      push(`${value}${this.normalizeTimeframeUnit(match[2])}`)
    }
    if (/日线|日\s*K|天线/u.test(text)) {
      push('1d')
    }

    return values
  }

  private normalizeTimeframeUnit(unit: string): 'm' | 'h' | 'd' {
    const normalizedUnit = unit.toLowerCase()
    if (normalizedUnit.startsWith('m') || normalizedUnit === '分钟' || normalizedUnit === '分') return 'm'
    if (normalizedUnit.startsWith('h') || normalizedUnit === '小时' || normalizedUnit === '时') return 'h'
    return 'd'
  }

  private parseChineseNumeral(text: string): number | null {
    const digitMap: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    }

    if (text.length === 0) return null
    if (text === '十') return 10
    if (text.length === 2 && text.startsWith('十')) {
      const tail = digitMap[text[1] ?? '']
      return tail === undefined ? null : 10 + tail
    }
    if (text.length === 2 && text.endsWith('十')) {
      const head = digitMap[text[0] ?? '']
      return head === undefined ? null : head * 10
    }
    if (text.length === 3 && text[1] === '十') {
      const head = digitMap[text[0] ?? '']
      const tail = digitMap[text[2] ?? '']
      if (head === undefined || tail === undefined) return null
      return head * 10 + tail
    }
    if (text.length === 1) {
      const value = digitMap[text]
      return value === undefined ? null : value
    }
    return null
  }

  private parseTimeframeNumber(token: string): number | null {
    if (/^\d+$/.test(token)) {
      const value = Number.parseInt(token, 10)
      return Number.isFinite(value) ? value : null
    }
    return this.parseChineseNumeral(token)
  }

  private matchSpecialChinesePhraseTimeframe(text: string): string | null {
    const first = this.matchAllSpecialChinesePhraseTimeframes(text)[0]
    return first ? first.value : null
  }

  private matchAllSpecialChinesePhraseTimeframes(text: string): Array<{ value: string; index: number; length: number }> {
    // 顺序很重要：长短语优先匹配，避免被截断
    const phraseMap: Array<{ regex: RegExp; value: string }> = [
      { regex: /一\s*刻钟/gu, value: '15m' },
      { regex: /半\s*小时/gu, value: '30m' },
      { regex: /半\s*天/gu, value: '12h' },
      { regex: /刻钟/gu, value: '15m' },
    ]

    const results: Array<{ value: string; index: number; length: number }> = []
    const consumedRanges: Array<[number, number]> = []
    const overlapsConsumed = (start: number, end: number) =>
      consumedRanges.some(([cs, ce]) => start < ce && end > cs)

    for (const { regex, value } of phraseMap) {
      for (const match of text.matchAll(regex)) {
        const index = match.index ?? -1
        if (index < 0) continue
        const length = match[0].length
        if (overlapsConsumed(index, index + length)) continue
        consumedRanges.push([index, index + length])
        results.push({ value, index, length })
      }
    }
    results.sort((a, b) => a.index - b.index)
    return results
  }

  private isIndicatorPeriodTimeframeCandidate(text: string, matchIndex: number, matchLength: number): boolean {
    if (matchIndex < 0) return false

    const prefix = text.slice(Math.max(0, matchIndex - 16), matchIndex)
    if (/(?:EMA|SMA|MA|均线)\s*$/iu.test(prefix)) {
      return true
    }

    const matchedText = text.slice(matchIndex, matchIndex + matchLength)
    const suffix = text.slice(matchIndex + matchLength, matchIndex + matchLength + 16)
    if (/(?:日|天)/u.test(matchedText)) {
      return /^\s*(?:EMA|SMA|MA|均线)/iu.test(suffix)
    }
    return /(?:分钟|分|小时|时)/u.test(matchedText)
      && /^\s*(?:EMA|SMA|MA|均线)(?!\s*\d)/iu.test(suffix)
  }

  private isRollingWindowTimeframeCandidate(text: string, matchIndex: number, matchLength: number): boolean {
    if (matchIndex < 0) return false

    const prefix = text.slice(Math.max(0, matchIndex - 24), matchIndex)
    const suffix = text.slice(matchIndex + matchLength, matchIndex + matchLength + 32)
    const hasWindowPrefix = /(?:过去|最近|近|前|last|past|previous|prior|lookback)\s*$/iu.test(prefix)
    const hasReferenceSuffix = /^\s*(?:的)?\s*(?:最高价|最低价|高点|低点|最高|最低|区间|范围|突破位|breakout|high|low|range)/iu.test(suffix)

    return hasWindowPrefix && hasReferenceSuffix
  }

  private extractNumber(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private parseChineseInteger(text: string): number | null {
    const numeric = Number(text)
    if (Number.isFinite(numeric)) return numeric

    const digits: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
    }
    if (text === '十') return 10
    if (text.startsWith('十')) {
      return 10 + (digits[text.slice(1)] ?? 0)
    }
    if (text.includes('十')) {
      const [tensText, onesText = ''] = text.split('十')
      const tens = digits[tensText] ?? 1
      const ones = onesText ? digits[onesText] : 0
      return tens * 10 + (ones ?? 0)
    }

    return digits[text] ?? null
  }

  private extractPercent(text: string, patterns: RegExp[]): number | null {
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match?.[1] === undefined) continue
      const value = Number(match[1])
      if (Number.isFinite(value)) {
        return value
      }
    }
    return null
  }

  private splitSegments(text: string): string[] {
    return text
      .split(/[；;。]/u)
      .map(segment => segment.trim())
      .filter(Boolean)
  }

  private splitCommaClauses(segment: string): string[] {
    const clauses: string[] = []
    let depth = 0
    let start = 0

    for (let index = 0; index < segment.length; index += 1) {
      const char = segment[index]
      if (char === '(' || char === '（') {
        depth += 1
        continue
      }
      if (char === ')' || char === '）') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (depth === 0 && (char === '，' || char === ',')) {
        if (this.isBollingerParamComma(segment, index)) continue
        const clause = segment.slice(start, index).trim()
        if (clause) clauses.push(clause)
        start = index + 1
      }
    }

    const tail = segment.slice(start).trim()
    if (tail) clauses.push(tail)
    const explicitClauses = clauses.length > 0 ? clauses : [segment]
    return explicitClauses.flatMap(clause => this.splitImplicitTradeClauses(clause))
  }

  private splitImplicitTradeClauses(clause: string): string[] {
    const parts: string[] = []
    let start = 0

    for (const match of clause.matchAll(/\s+/gu)) {
      const index = match.index ?? -1
      if (index <= start) continue

      const before = clause.slice(start, index).trim()
      const after = clause.slice(index + match[0].length).trim()
      if (!before || !after) continue
      if (!this.hasExecutableTradeIntent(before)) continue
      if (!this.looksLikeNewExecutableClause(after)) continue

      parts.push(before)
      start = index + match[0].length
    }

    const tail = clause.slice(start).trim()
    if (tail) parts.push(tail)
    return parts.length > 0 ? parts : [clause]
  }

  private looksLikeNewExecutableClause(text: string): boolean {
    return /^(?:如果|当|若|在)?\s*(?:(?:\d{1,2}\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|分钟|分|小时|时|天|日))|(?:价格|K线|k线|收盘价|开盘价|close|open|MA|EMA|均线|RSI|MACD|布林|bollinger))/iu.test(text)
      && this.hasExecutableTradeIntent(text)
      && this.hasExecutableConditionOperator(text)
  }

  private isBollingerParamComma(segment: string, commaIndex: number): boolean {
    const before = segment.slice(0, commaIndex)
    const after = segment.slice(commaIndex + 1)
    return /布林带\s*\d{1,4}\s*$/u.test(before) && /^\s*\d+(?:\.\d+)?/u.test(after)
  }

  private normalizeText(message?: string): string {
    return message?.trim().replace(/\s+/gu, ' ') ?? ''
  }

  // ── position.has_position / position.no_position ──────────────────────────

  /** 检测 position.has_position 短语（已有仓位、持仓中 等）
   * critic round 1 C-B2 修复：`有.{0,4}仓位` 会子串匹配 "没有/未有/无...仓位" → has 优先吃掉 no。
   * 加负向先行 `(?<!没|未|无)有` 避免 collision。
   */
  private isHasPositionClause(clause: string): boolean {
    // 中文：已有/已经开仓/持仓中；"有X仓位" 加负向先行排除"没/未/无 + 有"
    if (/(?:已有.{0,4}仓位|持仓中|仓位存在|已开仓|已经开仓|(?<!没|未|无)有.{0,4}仓位)/iu.test(clause)) return true
    // 英文（避免吞 "no position / not in position / when flat"）
    if (/(?<!no\s|not\s)(?:has\s+position|when\s+(?:in\s+)?(?:a\s+)?position|when\s+holding|while\s+(?:in\s+)?position|already\s+(?:in\s+)?position)/iu.test(clause)) return true
    return false
  }

  /** 检测 position.no_position 短语（无仓位、没有持仓 等）
   * 注意：must be checked AFTER isHasPositionClause to avoid false negatives
   */
  private isNoPositionClause(clause: string): boolean {
    // 中文：无/没有/未.*仓位；空仓
    if (/(?:无.{0,4}仓位|没有.{0,4}仓位|仓位为零|未开仓|空仓|无持仓|没有持仓)/iu.test(clause)) return true
    // 英文
    if (/(?:no\s+position|when\s+flat|when\s+not\s+(?:in\s+)?(?:a\s+)?position|not\s+(?:in\s+)?position|enter\s+only\s+when\s+flat)/iu.test(clause)) return true
    return false
  }

  /** 从自然语言提取 position.has_position atom（已有仓位 → 阻止新开仓）
   * 当方向不明确时默认 both（任意方向），保持 locked 状态避免路由降级为 open_slots。
   */
  private extractHasPositionTrigger(
    clause: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    const sideScope = this.resolvePositionSideScope(clause) ?? 'both'
    this.pushTrigger(triggers, seen, {
      key: 'position.has_position',
      phase: 'gate',
      sideScope,
      params: { sideScope },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    })
  }

  /** 从自然语言提取 position.no_position atom（无仓位 → 允许开仓，有仓位时 gate 拦截）
   * 当方向不明确时默认 both（任意方向），保持 locked 状态避免路由降级为 open_slots。
   */
  private extractNoPositionTrigger(
    clause: string,
    triggers: SeedTrigger[],
    seen: Set<string>,
  ): void {
    const sideScope = this.resolvePositionSideScope(clause) ?? 'both'
    this.pushTrigger(triggers, seen, {
      key: 'position.no_position',
      phase: 'gate',
      sideScope,
      params: { sideScope },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    })
  }

  /** 从 clause 解析多空方向 */
  private resolvePositionSideScope(clause: string): 'long' | 'short' | 'both' | null {
    // 多头 / long
    if (/(?:多头|多仓|long\s+position|long\s+side)/iu.test(clause)) return 'long'
    // 空头 / short
    if (/(?:空头|空仓|short\s+position|short\s+side)/iu.test(clause)) return 'short'
    // 双向 / both explicit
    if (/(?:双向|多空|both\s+side|any\s+(?:direction|position))/iu.test(clause)) return 'both'
    return null
  }
}
