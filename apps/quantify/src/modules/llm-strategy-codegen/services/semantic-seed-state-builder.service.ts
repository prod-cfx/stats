import { createHash } from 'crypto'

import { Injectable } from '@nestjs/common'

import type {
  MarketInstrumentQuote,
  MarketInstrumentQuoteSource,
  MarketInstrumentSymbolResolution,
  MarketInstrumentSymbolSource,
} from '../types/market-instrument-symbol'
import type {
  SemanticActionState,
  SemanticAtomContract,
  SemanticCapability,
  SemanticCapabilityDomain,
  SemanticCapabilityShape,
  SemanticEffect,
  SemanticEvidence,
  SemanticNodeStatus,
  SemanticOrderRequirement,
  SemanticPositionConstraintState,
  SemanticPositionSizingContract,
  SemanticPriority,
  SemanticRequirement,
  SemanticRiskState,
  SemanticRuntimeRequirement,
  SemanticSlotState,
  SemanticSource,
  SemanticState,
  SemanticStateRequirement,
  SemanticTriggerState,
} from '../types/semantic-state'
import { FIRST_WAVE_TRIGGER_ATOMS } from '../constants/canonical-strategy-capabilities'
import { toSemanticSupportOpenSlot } from '../types/semantic-atom-support'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
import { SemanticAtomRegistryService } from './semantic-atom-registry.service'
import { normalizeRiskSemantic } from './semantic-state-normalization'
import { validateSemanticRiskContract } from './strategy-semantic-contracts'

type SemanticPatchRecord = Record<string, unknown>
type ContextField = 'exchange' | 'symbol' | 'marketType' | 'timeframe'
type SlotValueRead =
  | { present: true, value: string | number | boolean | null }
  | { present: false }

const CONTEXT_QUESTION_HINTS: Record<ContextField, string> = {
  exchange: '请确认交易所（binance / okx / hyperliquid）。',
  symbol: '请确认策略交易标的（例如 BTCUSDT）。',
  marketType: '请确认市场类型（现货或合约/perp）。',
  timeframe: '请确认策略主周期（例如 15m 或 1h）。',
}
const SYNTHESIZABLE_TRIGGER_KEYS = new Set<string>(FIRST_WAVE_TRIGGER_ATOMS)
const SYNTHESIZABLE_ACTION_KEYS = new Set(['open_long', 'close_long', 'open_short', 'close_short'])
const SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS = new Set(['action.reduce_position', 'action.add_position', 'action.reverse_position'])
const SYNTHESIZABLE_GRID_ACTION_KEYS = new Set(['place_limit_grid', 'grid_ladder', 'grid.ladder', 'action.grid_ladder', 'maintain_limit_ladder'])
const SYNTHESIZABLE_POSITION_MODES = new Set(['fixed_ratio', 'fixed_quote', 'fixed_qty'])
const LEVEL_SET_DENSITY_SLOT_KEY = 'contract.shape.price.level_set.density'
const MARKET_INSTRUMENT_QUOTES: readonly MarketInstrumentQuote[] = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD']

@Injectable()
export class SemanticSeedStateBuilderService {
  constructor(
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
    private readonly semanticAtomRegistry: SemanticAtomRegistryService = new SemanticAtomRegistryService(),
  ) {}

  build(semanticPatch: unknown): SemanticState | null {
    if (!this.isRecord(semanticPatch)) {
      return null
    }

    const triggerItems = Array.isArray(semanticPatch.triggers)
      ? semanticPatch.triggers
      : (Array.isArray(semanticPatch.triggerUpdates) ? semanticPatch.triggerUpdates : [])
    const actionItems = Array.isArray(semanticPatch.actions)
      ? semanticPatch.actions
      : (Array.isArray(semanticPatch.actionUpdates) ? semanticPatch.actionUpdates : [])
    const riskItems = Array.isArray(semanticPatch.risk)
      ? semanticPatch.risk
      : (Array.isArray(semanticPatch.riskUpdates) ? semanticPatch.riskUpdates : [])
    const positionUpdate = this.toPositionState(semanticPatch.position ?? semanticPatch.positionUpdate)
    const contextSlots = this.toContextSlots(
      semanticPatch.contextSlots ?? semanticPatch.contextUpdates ?? semanticPatch.context,
    )

    const triggerUpdates = triggerItems
      .map((item, index) => this.toTriggerState(item, index))
      .filter((item): item is SemanticTriggerState => item !== null)
    const actionUpdates = actionItems
      .map((item, index) => this.toActionState(item, index))
      .filter((item): item is SemanticActionState => item !== null)
    const riskUpdates = riskItems
      .map((item, index) => this.toRiskState(item, index))
      .filter((item): item is SemanticRiskState => item !== null)

    if (
      triggerUpdates.length === 0
      && actionUpdates.length === 0
      && riskUpdates.length === 0
      && !positionUpdate
      && !Object.values(contextSlots).some(Boolean)
    ) {
      return null
    }

    return this.withRequiredSeedOpenSlots({
      version: 1,
      families: [],
      triggers: triggerUpdates,
      actions: actionUpdates,
      risk: riskUpdates,
      position: positionUpdate,
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    })
  }

  private toTriggerState(update: unknown, index: number): SemanticTriggerState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    const phase = update.phase
    if (!key || (phase !== 'entry' && phase !== 'exit' && phase !== 'risk' && phase !== 'gate')) {
      return null
    }

    const params = this.normalizeTriggerParams(key, this.readParams(update.params))
    const sideScope = update.sideScope === 'long' || update.sideScope === 'short' || update.sideScope === 'both'
      ? update.sideScope
      : null
    let openSlots = this.ensureBollingerConfirmationOpenSlot({
      key,
      phase,
      params,
      openSlots: this.readOpenSlots(update.openSlots),
      triggerIndex: index,
      statusValue: update.status,
    })
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const contracts = this.readContracts(update.contracts)
      ?? (this.shouldSynthesizeMissingContracts(update)
        ? this.synthesizeTriggerContracts(key, phase, sideScope, params, index)
        : null)
    openSlots = this.ensureGridLevelSetDensityOpenSlot({
      key,
      openSlots,
      contracts,
      triggerIndex: index,
    })
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `triggers[${index}].contracts`,
      priority: 'core',
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-trigger-${index + 1}`,
      key,
      phase,
      params,
      ...(sideScope
        ? { sideScope }
        : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private toActionState(update: unknown, index: number): SemanticActionState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    if (!key) {
      return null
    }

    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const openSlots = this.readOpenSlots(update.openSlots)
    const params = this.readParams(update.params)
    const contracts = this.readContracts(update.contracts)
      ?? (this.shouldSynthesizeMissingContracts(update)
        ? this.synthesizeActionContracts(key, params, index)
        : null)
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `actions[${index}].contracts`,
      priority: 'behavior',
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-action-${index + 1}`,
      key,
      ...(this.isRecord(update.params) ? { params } : {}),
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private toRiskState(update: unknown, index: number): SemanticRiskState | null {
    if (!this.isRecord(update)) {
      return null
    }

    const key = this.readTrimmedString(update.key)
    if (!key) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const rawParams = this.readParams(update.params)
    const mergedParams = key === 'risk.partial_take_profit'
      ? this.attachPartialTakeProfitMemoryKey(rawParams)
      : rawParams
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizeRiskContracts(key, mergedParams, index))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `risk[${index}].contracts`,
      priority: 'risk',
    })

    const risk: SemanticRiskState = {
      id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
      key,
      params: mergedParams,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }

    return normalizeRiskSemantic(risk, index)
  }

  private toPositionState(update: unknown): SemanticState['position'] {
    if (!this.isRecord(update)) {
      return null
    }

    const mainMode = this.readTrimmedString(update.mode)
    if (this.isPositionConstraintKey(mainMode)) {
      return this.toPositionStateWithConstraintMode(update, mainMode)
    }

    const sizing = this.readPositionSizing(update.sizing)
    if (
      typeof update.mode !== 'string'
      || typeof update.positionMode !== 'string'
      || typeof update.value !== 'number'
      || !Number.isFinite(update.value)
    ) {
      return null
    }

    const openSlots = this.readOpenSlots(update.openSlots)
    const constraints = Array.isArray(update.constraints)
      ? update.constraints
          .map((item, index) => this.toPositionConstraintState(item, index))
          .filter((item): item is SemanticPositionConstraintState => item !== null)
      : []
    const sizingProvided = this.hasOwnProperty(update, 'sizing')
    const positionMode = this.normalizePositionSideMode(update.positionMode) ?? update.positionMode
    const normalizedMode = this.normalizePositionSizingMode(update.mode)
    const evidence = this.readEvidence(update.evidence)
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts')
        ? null
        : this.synthesizePositionContracts({
          sizing,
          sizingProvided,
          mode: normalizedMode,
          value: update.value,
          positionMode,
        }))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: 'position.contracts',
      priority: 'behavior',
    })

    return {
      ...(sizing ? { sizing } : {}),
      mode: normalizedMode ?? update.mode,
      value: update.value,
      positionMode,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(contracts ? { contracts } : {}),
      ...(constraints.length > 0 ? { constraints } : {}),
    }
  }

  private toPositionStateWithConstraintMode(
    update: SemanticPatchRecord,
    key: SemanticPositionConstraintState['key'],
  ): SemanticState['position'] {
    const explicitConstraint = this.toPositionConstraintState({
      id: this.readTrimmedString(update.id) ?? `planner-${this.slugifyContractId(key)}`,
      key,
      params: this.readParams(update.params),
      status: update.status,
      source: update.source,
      evidence: update.evidence,
      openSlots: update.openSlots,
      contracts: update.contracts,
      supersedes: update.supersedes,
    }, 0)
    const nestedConstraints = Array.isArray(update.constraints)
      ? update.constraints
          .map((item, index) => this.toPositionConstraintState(item, index + 1))
          .filter((item): item is SemanticPositionConstraintState => item !== null)
      : []
    const constraints = [
      ...(explicitConstraint ? [explicitConstraint] : []),
      ...nestedConstraints,
    ]
    const positionMode = typeof update.positionMode === 'string'
      ? this.normalizePositionSideMode(update.positionMode) ?? update.positionMode
      : 'long_only'

    return {
      mode: 'constraint_only',
      value: 0,
      positionMode,
      status: constraints.length > 0 ? 'locked' : 'open',
      source: this.readSource(update.source),
      openSlots: [],
      ...(constraints.length > 0 ? { constraints } : {}),
    }
  }

  private toPositionConstraintState(update: unknown, index: number): SemanticPositionConstraintState | null {
    if (!this.isRecord(update)) return null
    const key = this.readTrimmedString(update.key)
    if (!this.isPositionConstraintKey(key)) {
      return null
    }

    const params = this.readParams(update.params)
    const openSlots = this.readOpenSlots(update.openSlots)
    const evidence = this.readEvidence(update.evidence)
    const supersedes = this.readStringArray(update.supersedes)
    const contracts = this.readContracts(update.contracts)
      ?? (this.hasOwnProperty(update, 'contracts') ? null : this.synthesizePositionConstraintContracts(key, params, index))
    const contractCoverage = this.resolveContractCoverage({
      contracts,
      openSlots,
      statusValue: update.status,
      fieldPath: `position.constraints[${index}].contracts`,
      priority: 'behavior',
    })

    return {
      id: this.readTrimmedString(update.id) ?? `planner-position-constraint-${index + 1}`,
      key,
      params,
      status: contractCoverage.status,
      source: this.readSource(update.source),
      ...(evidence ? { evidence } : {}),
      openSlots: contractCoverage.openSlots,
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private readPositionSizing(sizing: unknown): SemanticPositionSizingContract | null {
    if (!this.isRecord(sizing)) {
      return null
    }

    if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) {
      return null
    }

    if (sizing.kind === 'ratio' && (sizing.unit === 'ratio' || sizing.unit === 'percent')) {
      return { kind: 'ratio', value: sizing.value, unit: sizing.unit }
    }

    if (
      sizing.kind === 'quote'
      && (sizing.asset === 'USDT' || sizing.asset === 'USDC' || sizing.asset === 'USD')
    ) {
      return { kind: 'quote', value: sizing.value, asset: sizing.asset }
    }

    if (
      sizing.kind === 'base'
      && typeof sizing.asset === 'string'
      && /^[A-Z][A-Z0-9]{1,15}$/u.test(sizing.asset)
    ) {
      return { kind: 'base', value: sizing.value, asset: sizing.asset }
    }

    return null
  }

  private normalizePositionSizingMode(mode: string): string | null {
    if (SYNTHESIZABLE_POSITION_MODES.has(mode)) {
      return mode
    }

    return null
  }

  private normalizePositionSideMode(positionMode: string): string | null {
    if (positionMode === 'long' || positionMode === 'long_only') {
      return 'long_only'
    }
    if (positionMode === 'short' || positionMode === 'short_only') {
      return 'short_only'
    }
    if (positionMode === 'both' || positionMode === 'long_short') {
      return 'long_short'
    }
    return null
  }

  private isPositionConstraintKey(value: string | null): value is SemanticPositionConstraintState['key'] {
    return value === 'position.pyramiding_limit'
      || value === 'position.max_exposure_pct'
      || value === 'position.dca_schedule'
  }

  private isSupportedPositionSideMode(positionMode: string): boolean {
    return positionMode === 'long_only' || positionMode === 'short_only' || positionMode === 'long_short'
  }

  private synthesizeTriggerContracts(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (!this.canSynthesizeTriggerContract(key, params)) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-trigger-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'trigger',
      capability: this.buildTriggerCapability(key, phase, sideScope, params),
      params,
    })

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private canSynthesizeTriggerContract(key: string, params: Record<string, unknown>): boolean {
    if (key === 'condition.expression') {
      return this.isRecord(params.expression)
    }

    if (key === 'price.percent_change') {
      return this.isFiniteNonZeroNumber(params.valuePct)
    }

    if (key === 'indicator.cross_over' || key === 'indicator.cross_under') {
      return this.hasIndicatorIdentity(params)
        && (this.hasFiniteNumber(params.fastPeriod) || this.hasFiniteNumber(params.slowPeriod))
    }

    if (key === 'indicator.above' || key === 'indicator.below') {
      return this.hasIndicatorIdentity(params) && this.hasIndicatorReference(params)
    }

    if (key === 'oscillator.rsi_gte' || key === 'oscillator.rsi_lte') {
      return this.hasFiniteNumber(params.value)
    }

    if (key === 'bollinger.touch_upper' || key === 'bollinger.touch_lower' || key === 'bollinger.touch_middle') {
      return this.hasFiniteNumber(params.period) && this.hasFiniteNumber(params.stdDev)
    }

    if (key === 'price.detect.indicator_boundary') {
      return this.isSupportedBollingerBoundaryParams(params)
    }

    if (
      key === 'volume.spike'
      || key === 'volume.threshold'
      || key === 'volume.relative_average'
      || key === 'volatility.atr_threshold'
      || key === 'strategy.time_window'
    ) {
      return true
    }

    if (key === 'condition.sequence') {
      return typeof params.sequenceKind === 'string' && params.sequenceKind.trim().length > 0
    }

    if (key === 'confirmation.rebound') {
      return true
    }

    if (key === 'price.breakout_up' || key === 'price.breakout_down') {
      return this.hasBreakoutReference(params)
    }

    if (key === 'price.range_position_lte' || key === 'price.range_position_gte') {
      return this.hasPositiveInteger(params.lookbackBars) && this.isPercentThreshold(params.thresholdPct)
    }

    if (key === 'grid.range_rebalance') {
      return this.resolveGridRange(params) !== null
    }

    if (
      key === 'trend.direction'
      || key === 'market.trend'
      || key === 'market.range'
      || key === 'market.regime'
      || key === 'volatility.state'
    ) {
      return Object.keys(params).length > 0
    }

    return key === 'execution.on_start' && SYNTHESIZABLE_TRIGGER_KEYS.has(key)
  }

  private hasIndicatorIdentity(params: Record<string, unknown>): boolean {
    return Boolean(this.readTrimmedString(params.indicator))
  }

  private hasIndicatorReference(params: Record<string, unknown>): boolean {
    if (
      this.hasFiniteNumber(params.period)
      || this.hasFiniteNumber(params.fastPeriod)
      || this.hasFiniteNumber(params.slowPeriod)
      || this.hasFiniteNumber(params['reference.period'])
    ) {
      return true
    }

    return this.isRecord(params.reference) && this.hasFiniteNumber(params.reference.period)
  }

  private hasBreakoutReference(params: Record<string, unknown>): boolean {
    const reference = this.readTrimmedString(params.reference)
    if (reference && reference !== 'unknown') {
      return true
    }

    return this.hasFiniteNumber(params.lookbackBars)
      || this.hasFiniteNumber(params.windowBars)
      || this.isRecord(params.expression)
  }

  private isSupportedBollingerBoundaryParams(params: Record<string, unknown>): boolean {
    const indicator = params.indicator
    return this.isRecord(indicator)
      && indicator.name === 'bollinger'
      && (params.boundaryRole === 'upper' || params.boundaryRole === 'lower' || params.boundaryRole === 'middle')
  }

  private hasFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
  }

  private isFiniteNonZeroNumber(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value !== 0
  }

  private hasPositiveFiniteNumber(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value > 0
  }

  private hasPositiveInteger(value: unknown): value is number {
    return this.hasPositiveFiniteNumber(value) && Number.isInteger(value)
  }

  private isPercentThreshold(value: unknown): value is number {
    return this.hasFiniteNumber(value) && value > 0 && value <= 100
  }

  private resolveGridRange(params: Record<string, unknown>): { lower: number; upper: number } | null {
    const lower = this.readFiniteNumberParam(params, ['rangeLower', 'rangeMin', 'lower'])
    const upper = this.readFiniteNumberParam(params, ['rangeUpper', 'rangeMax', 'upper'])
    if (lower === null || upper === null || lower <= 0 || upper <= lower) {
      return null
    }

    return { lower, upper }
  }

  private resolveGridDensityShape(params: Record<string, unknown>): SemanticCapabilityShape {
    const gridCount = this.readFiniteNumberParam(params, ['gridCount'])
    const gridIntervals = this.readFiniteNumberParam(params, ['gridIntervals'])
    const absoluteSpacing = this.readFiniteNumberParam(params, ['absoluteSpacing'])
    const spacingPct = this.readFiniteNumberParam(params, ['spacingPct', 'stepPct'])

    return this.toCapabilityShape({
      ...(gridCount !== null ? { gridCount } : {}),
      ...(gridIntervals !== null ? { gridIntervals } : {}),
      ...(absoluteSpacing !== null ? { absoluteSpacing } : {}),
      ...(spacingPct !== null ? { spacingPct } : {}),
    })
  }

  private readFiniteNumberParam(params: Record<string, unknown>, keys: readonly string[]): number | null {
    for (const key of keys) {
      const value = this.readFiniteNumber(params[key])
      if (value !== null) {
        return value
      }
    }

    return null
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private buildTriggerCapability(
    key: string,
    phase: SemanticTriggerState['phase'],
    sideScope: SemanticTriggerState['sideScope'] | null,
    params: Record<string, unknown>,
  ): SemanticCapability {
    if (key === 'volume.spike' || key === 'volume.threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'volume.relative_average') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volume_relative_average',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'volatility.atr_threshold') {
      return {
        domain: 'market',
        verb: 'detect',
        object: 'volatility_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'condition.sequence') {
      return {
        domain: 'price',
        verb: 'detect',
        object: 'sequence_condition',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'confirmation.rebound') {
      return {
        domain: 'price',
        verb: 'confirm',
        object: 'rebound',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'execution.on_start') {
      return {
        domain: 'order_program',
        verb: 'schedule',
        object: 'execution_trigger',
        shape: this.toCapabilityShape({
          key,
          phase,
          sideScope: sideScope ?? null,
          ...params,
        }),
      }
    }

    if (key === 'grid.range_rebalance') {
      const range = this.resolveGridRange(params)
      return {
        domain: 'price',
        verb: 'define',
        object: 'level_set',
        shape: this.toCapabilityShape({
          mode: 'fixed_range',
          lower: range?.lower ?? null,
          upper: range?.upper ?? null,
          spacingMode: 'arithmetic',
          ...this.resolveGridDensityShape(params),
        }),
      }
    }

    return {
      domain: 'price',
      verb: 'detect',
      object: 'signal_condition',
      shape: this.toCapabilityShape({
        key,
        phase,
        sideScope: sideScope ?? null,
        ...params,
      }),
    }
  }

  private ensureGridLevelSetDensityOpenSlot(input: {
    key: string
    openSlots: SemanticSlotState[]
    contracts: SemanticAtomContract[] | null
    triggerIndex: number
  }): SemanticSlotState[] {
    if (input.key !== 'grid.range_rebalance' || !input.contracts?.length) {
      return input.openSlots
    }

    const target = this.resolveLevelSetContractTarget(input.contracts, `triggers[${input.triggerIndex}]`)
    if (!target || this.hasLevelSetDensity(target.capability.shape)) {
      return input.openSlots
    }

    if (input.openSlots.some(slot => slot.slotKey === LEVEL_SET_DENSITY_SLOT_KEY && slot.fieldPath === target.fieldPath)) {
      return input.openSlots
    }

    return [
      ...this.removeContractRequiredSlots(input.openSlots, target.contractFieldPath),
      {
        slotKey: LEVEL_SET_DENSITY_SLOT_KEY,
        fieldPath: target.fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: '请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。',
        affectsExecution: true,
      },
    ]
  }

  private resolveLevelSetContractTarget(contracts: SemanticAtomContract[], ownerFieldPath: string): {
    capability: SemanticCapability
    contractFieldPath: string
    fieldPath: string
  } | null {
    for (const contract of contracts) {
      const capability = contract.capabilities.find(item =>
        item.domain === 'price'
        && item.verb === 'define'
        && item.object === 'level_set',
      )
      if (!capability) continue

      return {
        capability,
        contractFieldPath: `${ownerFieldPath}.contracts`,
        fieldPath: `${ownerFieldPath}.contracts[${contract.id}].capabilities[price.define.level_set].shape`,
      }
    }

    return null
  }

  private hasLevelSetDensity(shape: SemanticCapabilityShape): boolean {
    return this.hasPositiveFiniteNumber(shape.gridCount)
      || this.hasPositiveFiniteNumber(shape.gridIntervals)
      || this.hasPositiveFiniteNumber(shape.absoluteSpacing)
      || this.hasPositiveFiniteNumber(shape.spacingPct)
  }

  private synthesizeActionContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (SYNTHESIZABLE_GRID_ACTION_KEYS.has(key)) {
      return [this.withRegistryContractSubstrate(key, this.buildGridActionContract(key, params, index))]
    }

    if (SYNTHESIZABLE_POSITION_LIFECYCLE_ACTION_KEYS.has(key)) {
      return [this.buildPositionLifecycleActionContract(key, params, index)]
    }

    if (!SYNTHESIZABLE_ACTION_KEYS.has(key)) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'execute',
        object: 'order_action',
        shape: this.toCapabilityShape({
          key,
          side: this.resolveActionSide(key),
          intent: this.resolveActionIntent(key),
          ...params,
        }),
      },
      params,
    })

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private buildGridActionContract(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    return this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'maintain',
        object: 'limit_ladder',
        shape: this.toCapabilityShape({
          key,
          orderType: this.readTrimmedString(params.orderType) ?? 'limit',
          timeInForce: this.readTrimmedString(params.timeInForce) ?? 'gtc',
          recycleOnFill: typeof params.recycleOnFill === 'boolean' ? params.recycleOnFill : true,
          pairingPolicy: this.readTrimmedString(params.pairingPolicy) ?? 'grid_level',
        }),
      },
      params,
    })
  }

  private buildPositionLifecycleActionContract(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    const intent = this.resolvePositionLifecycleActionIntent(key)
    const contract = this.withRegistryContractSubstrate(key, this.buildAtomContract({
      id: `contract-seed-action-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'action',
      capability: {
        domain: 'order_program',
        verb: 'execute',
        object: 'order_action',
        shape: this.toCapabilityShape({
          key,
          intent,
          ...params,
        }),
      },
      params,
    }))

    if (key === 'action.reduce_position') {
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

    if (key === 'action.add_position') {
      return {
        ...contract,
        effects: [
          { domain: 'exposure', verb: 'increase', object: 'position' },
        ],
      }
    }

    return {
      ...contract,
      effects: [
        { domain: 'exposure', verb: 'reduce', object: 'position', shape: this.toCapabilityShape({ phase: 'close_current' }) },
        { domain: 'exposure', verb: 'increase', object: 'position', shape: this.toCapabilityShape({ phase: 'open_opposite' }) },
      ],
    }
  }

  private resolvePositionLifecycleActionIntent(key: string): 'reduce' | 'add' | 'reverse' {
    if (key === 'action.reduce_position') {
      return 'reduce'
    }

    if (key === 'action.add_position') {
      return 'add'
    }

    return 'reverse'
  }

  private synthesizeRiskContracts(
    key: string,
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (!this.canSynthesizeRiskContract(key, params)) {
      return null
    }

    const object = this.resolveRiskContractObject(key)
    if (!object) {
      return null
    }

    const contract = this.buildAtomContract({
      id: `contract-seed-risk-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'risk',
      capability: {
        domain: 'guard',
        verb: 'enforce',
        object,
        shape: this.toCapabilityShape({
          key,
          ...params,
        }),
      },
      params,
    })

    return [this.withRegistryContractSubstrate(key, contract)]
  }

  private canSynthesizeRiskContract(key: string, params: Record<string, unknown>): boolean {
    if (key === 'risk.atr_stop' || key === 'risk.partial_take_profit') {
      return true
    }

    if (
      key === 'risk.stop_loss_pct'
      || key === 'risk.take_profit_pct'
      || key === 'risk.trailing_stop_pct'
      || key === 'risk.max_drawdown_pct'
      || key === 'risk.max_single_loss_pct'
    ) {
      return this.hasPositiveFiniteNumber(params.valuePct)
    }

    if (key === 'risk.condition_expression') {
      return validateSemanticRiskContract({
        key,
        params: {
          capabilityStatus: 'recognized_unsupported',
          ...params,
        },
      }).ok
    }

    const resolved = this.semanticAtomRegistry.resolve(key)
    return resolved.category === 'risk' && resolved.supportStatus === 'supported_requires_slot'
  }

  private resolveRiskContractObject(key: string): string | null {
    if (key === 'risk.stop_loss_pct') {
      return 'stop_loss'
    }
    if (key === 'risk.take_profit_pct') {
      return 'take_profit'
    }
    if (key === 'risk.trailing_stop_pct') {
      return 'trailing_stop'
    }
    if (key === 'risk.max_drawdown_pct') {
      return 'max_drawdown'
    }
    if (key === 'risk.max_single_loss_pct') {
      return 'max_single_loss'
    }
    if (key === 'risk.condition_expression') {
      return 'risk_condition'
    }
    if (key === 'risk.atr_stop') {
      return 'atr_stop'
    }
    if (key === 'risk.partial_take_profit') {
      return 'partial_take_profit'
    }
    if (key === 'risk.falling_knife_guard') {
      return 'falling_knife_guard'
    }
    return null
  }

  private attachPartialTakeProfitMemoryKey(params: Record<string, unknown>): Record<string, unknown> {
    const existing = typeof params.memoryKey === 'string' && params.memoryKey.startsWith('partial_tp_')
      ? params.memoryKey
      : null
    const memoryKey = existing ?? this.derivePartialTakeProfitMemoryKey(params)
    return { ...params, memoryKey }
  }

  private derivePartialTakeProfitMemoryKey(params: Record<string, unknown>): string {
    const rawTiers = Array.isArray(params.tiers) ? params.tiers : []
    // Sort by trigger.threshold so equivalent tier sets — regardless of LLM
    // insertion order — produce identical memoryKey and reuse runtime state.
    const sortedTiers = [...rawTiers].sort((a, b) => {
      const ta = typeof (a as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
        ? (a as { trigger: { threshold: number } }).trigger.threshold
        : 0
      const tb = typeof (b as { trigger?: { threshold?: unknown } })?.trigger?.threshold === 'number'
        ? (b as { trigger: { threshold: number } }).trigger.threshold
        : 0
      return ta - tb
    })
    const tiersJson = JSON.stringify(sortedTiers)
    const sourceText = typeof params.sourceText === 'string' ? params.sourceText : ''
    const hash = createHash('sha256').update(`${tiersJson}|${sourceText}`).digest('hex').slice(0, 16)
    return `partial_tp_${hash}`
  }

  private withRequiredSeedOpenSlots(state: SemanticState): SemanticState {
    const hasExecutableSemantics = state.triggers.length > 0 || state.actions.length > 0
    if (!hasExecutableSemantics) {
      return state
    }

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
        questionHint: CONTEXT_QUESTION_HINTS[field],
        affectsExecution: true,
      }
      changed = true
    }

    if (!state.position && !this.hasContractPerOrderBudget(state.actions)) {
      return {
        ...state,
        contextSlots,
        position: {
          mode: 'fixed_ratio',
          value: 0,
          sizing: null,
          positionMode: this.inferPositionModeFromActions(state.actions),
          status: 'open',
          source: 'derived',
          openSlots: [{
            slotKey: 'position.sizing',
            fieldPath: 'position.sizing',
            status: 'open',
            priority: 'risk',
            questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
            affectsExecution: true,
          }],
        },
      }
    }

    return changed ? { ...state, contextSlots } : state
  }

  private hasContractPerOrderBudget(actions: SemanticActionState[]): boolean {
    return actions.some(action =>
      action.contracts?.some(contract =>
        contract.capabilities.some(capability =>
          capability.domain === 'capital'
          && capability.verb === 'allocate'
          && capability.object === 'per_order_budget',
        ),
      ),
    )
  }

  private inferPositionModeFromActions(actions: SemanticActionState[]): 'long_only' | 'short_only' | 'long_short' {
    const hasLong = actions.some(action => action.key.includes('long'))
    const hasShort = actions.some(action => action.key.includes('short'))
    if (hasLong && hasShort) return 'long_short'
    if (hasShort) return 'short_only'
    return 'long_only'
  }

  private synthesizePositionContracts(position: {
    sizing: SemanticPositionSizingContract | null
    sizingProvided: boolean
    mode: string | null
    value: number
    positionMode: string
  }): SemanticAtomContract[] | null {
    if (
      !position.mode
      || !this.hasPositiveFiniteNumber(position.value)
      || !this.isSupportedPositionSideMode(position.positionMode)
      || (position.sizingProvided && !position.sizing)
    ) {
      return null
    }

    return [this.buildAtomContract({
      id: 'contract-seed-position-sizing',
      kind: 'position',
      capability: {
        domain: 'capital',
        verb: 'allocate',
        object: 'position_sizing',
        shape: this.toCapabilityShape({
          sizing: position.sizing,
          mode: position.mode,
          value: position.value,
          positionMode: position.positionMode,
        }),
      },
      params: {
        sizing: position.sizing,
        mode: position.mode,
        value: position.value,
        positionMode: position.positionMode,
      },
    })]
  }

  private synthesizePositionConstraintContracts(
    key: SemanticPositionConstraintState['key'],
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract[] | null {
    if (key === 'position.dca_schedule') {
      return [this.synthesizeDcaScheduleContract(key, params, index)]
    }

    const object = key === 'position.pyramiding_limit'
      ? 'pyramiding_layers'
      : 'max_exposure_pct'
    const contract = this.withRegistryContractSubstrate(key, this.buildAtomContract({
      id: `contract-seed-position-constraint-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'position',
      capability: {
        domain: 'exposure',
        verb: 'limit',
        object,
        shape: this.toCapabilityShape({
          key,
          ...params,
        }),
      },
      params,
    }))

    return [{
      ...contract,
      effects: [
        { domain: 'guard', verb: 'block', object: 'exposure_increase' },
      ],
    }]
  }

  private synthesizeDcaScheduleContract(
    key: SemanticPositionConstraintState['key'],
    params: Record<string, unknown>,
    index: number,
  ): SemanticAtomContract {
    const exitRuleShape = this.readUnknownShape(params.exitRule)
    const contract = this.withRegistryContractSubstrate(key, {
      id: `contract-seed-position-constraint-${index + 1}-${this.slugifyContractId(key)}`,
      kind: 'position',
      capabilities: [
        {
          domain: 'runtime',
          verb: 'schedule',
          object: 'dca_orders',
          shape: this.toCapabilityShape({
            key,
            maxCount: this.readFiniteNumber(params.maxCount),
            capitalCap: this.readCapitalCapShape(params.capitalCap),
            perOrderSizing: this.readUnknownShape(params.perOrderSizing) ?? params.perOrderSizing,
            triggerMode: params.triggerMode,
          }),
        },
        ...(exitRuleShape
          ? [{
              domain: 'guard' as const,
              verb: 'define',
              object: 'dca_exit_rule',
              shape: exitRuleShape,
            }]
          : []),
      ],
      requires: exitRuleShape
        ? []
        : [{ domain: 'guard', verb: 'define', object: 'dca_exit_rule' }],
      params,
      runtimeRequirements: [],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
    })

    return {
      ...contract,
      openSlots: this.filterSatisfiedDcaContractOpenSlots(contract.openSlots, params),
      effects: [
        { domain: 'exposure', verb: 'increase', object: 'position' },
      ],
    }
  }

  private filterSatisfiedDcaContractOpenSlots(
    openSlots: readonly SemanticSlotState[],
    params: Record<string, unknown>,
  ): SemanticSlotState[] {
    return openSlots.filter((slot) => {
      if (slot.slotKey === 'position.dca_schedule.max_count') {
        return this.readFiniteNumber(params.maxCount) === null
      }
      if (slot.slotKey === 'position.dca_schedule.capital_cap') {
        return this.readCapitalCapShape(params.capitalCap) === null
      }
      if (slot.slotKey === 'position.dca_schedule.per_order_sizing') {
        return this.readUnknownShape(params.perOrderSizing) === null
      }
      if (slot.slotKey === 'position.dca_schedule.trigger_mode') {
        return typeof params.triggerMode !== 'string' || params.triggerMode.length === 0
      }
      if (slot.slotKey === 'position.dca_schedule.exit_rule') {
        return this.readUnknownShape(params.exitRule) === null
      }

      return true
    })
  }

  private readCapitalCapShape(value: unknown): number | SemanticCapabilityShape | null {
    const finiteNumber = this.readFiniteNumber(value)
    if (finiteNumber !== null) {
      return finiteNumber
    }

    return this.readUnknownShape(value)
  }

  private buildAtomContract(input: {
    id: string
    kind: SemanticAtomContract['kind']
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

  private withRegistryContractSubstrate(
    atomKey: string,
    contract: SemanticAtomContract,
  ): SemanticAtomContract {
    const resolved = this.semanticAtomRegistry.resolve(
      this.resolveContractSubstrateAtomKey(atomKey, contract.params),
      contract.params,
    )
    if (!('contractSubstrate' in resolved) || !resolved.contractSubstrate) {
      return contract
    }

    return {
      ...contract,
      runtimeRequirements: [...resolved.contractSubstrate.runtimeRequirements],
      stateRequirements: [...resolved.contractSubstrate.stateRequirements],
      orderRequirements: [...resolved.contractSubstrate.orderRequirements],
      openSlots: resolved.contractSubstrate.openSlots.map(slot => toSemanticSupportOpenSlot(slot)),
    }
  }

  private resolveContractSubstrateAtomKey(atomKey: string, params: Record<string, unknown>): string {
    if ((atomKey !== 'indicator.above' && atomKey !== 'indicator.below') || !this.isMovingAverageIndicatorAlias(params)) {
      return atomKey
    }

    return atomKey === 'indicator.above' ? 'indicator.threshold_gte' : 'indicator.threshold_lte'
  }

  private isMovingAverageIndicatorAlias(params: Record<string, unknown>): boolean {
    const indicator = this.readTrimmedString(params.indicator)?.toLowerCase()
    return indicator === 'ma' || indicator === 'sma' || indicator === 'ema'
  }

  private readContracts(value: unknown): SemanticAtomContract[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const contracts = value
      .map(item => this.toContract(item))
      .filter((item): item is SemanticAtomContract => item !== null)
    return contracts.length > 0 ? contracts : null
  }

  private toContract(value: unknown): SemanticAtomContract | null {
    if (!this.isRecord(value)) {
      return null
    }

    const id = this.readTrimmedString(value.id)
    const capabilities = this.readCapabilities(value.capabilities)
    const requires = this.readRequirements(value.requires)
    const runtimeRequirements = this.readRuntimeRequirements(value.runtimeRequirements)
    const stateRequirements = this.readStateRequirements(value.stateRequirements)
    const orderRequirements = this.readOrderRequirements(value.orderRequirements)
    if (
      !id
      || !this.isContractKind(value.kind)
      || !capabilities
      || !requires
      || !runtimeRequirements
      || !stateRequirements
      || !orderRequirements
    ) {
      return null
    }

    const effects = this.readEffects(value.effects)

    return {
      id,
      kind: value.kind,
      capabilities,
      requires,
      params: this.readParams(value.params),
      runtimeRequirements,
      stateRequirements,
      orderRequirements,
      openSlots: this.readOpenSlots(value.openSlots),
      ...(effects ? { effects } : {}),
    }
  }

  private readCapabilities(value: unknown): SemanticCapability[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const capabilities: SemanticCapability[] = []
    for (const item of value) {
      const capability = this.toCapability(item)
      if (!capability) {
        return null
      }
      capabilities.push(capability)
    }

    return capabilities.length > 0 ? capabilities : null
  }

  private toCapability(value: unknown): SemanticCapability | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object || !this.isCapabilityShape(value.shape)) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
      shape: value.shape,
    }
  }

  private readRequirements(value: unknown): SemanticRequirement[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticRequirement[] = []
    for (const item of value) {
      const requirement = this.toRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toRequirement(value: unknown): SemanticRequirement | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    if (!verb || !object) {
      return null
    }

    return {
      domain: value.domain,
      verb,
      object,
    }
  }

  private readRuntimeRequirements(value: unknown): SemanticRuntimeRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticRuntimeRequirement[] = []
    for (const item of value) {
      const requirement = this.toRuntimeRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toRuntimeRequirement(value: unknown): SemanticRuntimeRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'runtime') {
      return null
    }

    return {
      domain: 'runtime',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private readStateRequirements(value: unknown): SemanticStateRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticStateRequirement[] = []
    for (const item of value) {
      const requirement = this.toStateRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toStateRequirement(value: unknown): SemanticStateRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'state') {
      return null
    }

    return {
      domain: 'state',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private readOrderRequirements(value: unknown): SemanticOrderRequirement[] | null {
    if (value === undefined) {
      return []
    }

    if (!Array.isArray(value)) {
      return null
    }

    const requirements: SemanticOrderRequirement[] = []
    for (const item of value) {
      const requirement = this.toOrderRequirement(item)
      if (!requirement) {
        return null
      }
      requirements.push(requirement)
    }

    return requirements
  }

  private toOrderRequirement(value: unknown): SemanticOrderRequirement | null {
    const requirement = this.toRequirementWithOptionalShape(value)
    if (!requirement || requirement.domain !== 'order') {
      return null
    }

    return {
      domain: 'order',
      verb: requirement.verb,
      object: requirement.object,
      ...(requirement.shape === undefined ? {} : { shape: requirement.shape }),
    }
  }

  private toRequirementWithOptionalShape(value: unknown): (SemanticRequirement & { shape?: SemanticCapabilityShape }) | null {
    const requirement = this.toRequirement(value)
    if (!requirement || !this.isRecord(value)) {
      return null
    }

    if (value.shape === undefined) {
      return requirement
    }

    if (!this.isCapabilityShape(value.shape)) {
      return null
    }

    return {
      ...requirement,
      shape: value.shape,
    }
  }

  private readEffects(value: unknown): SemanticEffect[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const effects: SemanticEffect[] = []
    for (const item of value) {
      const effect = this.toEffect(item)
      if (!effect) {
        return null
      }
      effects.push(effect)
    }

    return effects.length > 0 ? effects : null
  }

  private toEffect(value: unknown): SemanticEffect | null {
    if (!this.isRecord(value) || !this.isCapabilityDomain(value.domain)) {
      return null
    }

    const verb = this.readTrimmedString(value.verb)
    const object = this.readTrimmedString(value.object)
    const shape = value.shape
    if (!verb || !object) {
      return null
    }

    const effect: SemanticEffect = {
      domain: value.domain,
      verb,
      object,
    }

    if (shape === undefined) {
      return effect
    }

    if (!this.isCapabilityShape(shape)) {
      return null
    }

    return {
      ...effect,
      shape,
    }
  }

  private toContextSlots(update: unknown): SemanticState['contextSlots'] {
    if (!this.isRecord(update)) {
      return {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      }
    }

    return {
      exchange: this.toContextSlot('exchange', update.exchange),
      symbol: this.toContextSlot('symbol', update.symbol),
      marketType: this.toContextSlot('marketType', update.marketType),
      timeframe: this.toContextSlot('timeframe', update.timeframe),
    }
  }

  private toContextSlot(
    field: ContextField,
    value: unknown,
  ): SemanticState['contextSlots'][typeof field] {
    if (field === 'symbol') {
      return this.toSymbolContextSlot(value)
    }

    if (this.isRecord(value)) {
      const slot = this.toSlotState(value, {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS[field],
      })
      return slot
    }

    const trimmedValue = this.readTrimmedString(value)
    if (!trimmedValue) {
      return null
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: trimmedValue,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS[field],
      affectsExecution: true,
    }
  }

  private toSymbolContextSlot(value: unknown): SemanticState['contextSlots']['symbol'] {
    const resolution = this.resolveSymbolContextSlotValue(value)
    if (resolution) {
      return this.toResolvedSymbolSlot(resolution)
    }

    if (this.isRecord(value)) {
      return this.toSlotState(value, {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS.symbol,
      })
    }

    return null
  }

  private resolveSymbolContextSlotValue(value: unknown): MarketInstrumentSymbolResolution | null {
    const text = this.readTrimmedString(value)
    if (text) {
      return this.symbolResolver.resolve(text)
    }

    if (!this.isRecord(value)) {
      return null
    }

    return this.readSymbolResolution(value)
      ?? this.resolveSymbolContextSlotValue(value.value)
  }

  private readSymbolResolution(value: SemanticPatchRecord): MarketInstrumentSymbolResolution | null {
    const base = this.readTrimmedString(value.base)?.toUpperCase()
    const quote = this.readMarketInstrumentQuote(value.quote)
    const source = this.readMarketInstrumentSymbolSource(value.source)
    const evidenceText = this.readTrimmedString(value.evidenceText)
    const quoteSource = this.readMarketInstrumentQuoteSource(value.quoteSource)
    if (!base || !quote || !source || !evidenceText || !quoteSource) {
      return null
    }

    const venueSymbolHint = this.readTrimmedString(value.venueSymbolHint)
    const marketTypeHint = this.readMarketInstrumentMarketTypeHint(value.marketTypeHint)

    return {
      value: `${base}${quote}`,
      source,
      evidenceText,
      base,
      quote,
      quoteSource,
      ...(venueSymbolHint ? { venueSymbolHint } : {}),
      ...(marketTypeHint ? { marketTypeHint } : {}),
    }
  }

  private toResolvedSymbolSlot(resolution: MarketInstrumentSymbolResolution): SemanticSlotState {
    return {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: resolution.value,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS.symbol,
      affectsExecution: true,
      evidence: {
        text: resolution.evidenceText,
        source: resolution.source,
      },
      contracts: [this.symbolResolver.buildContextContract(resolution)],
    }
  }

  private readParams(value: unknown): Record<string, unknown> {
    if (!this.isRecord(value)) {
      return {}
    }

    return { ...value }
  }

  private shouldSynthesizeMissingContracts(update: SemanticPatchRecord): boolean {
    if (!this.hasOwnProperty(update, 'contracts')) {
      return true
    }

    return update.contracts === null
      || (Array.isArray(update.contracts) && update.contracts.length === 0)
  }

  private normalizeTriggerParams(
    key: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    if (
      (key === 'indicator.cross_over' || key === 'indicator.cross_under')
      && this.readTrimmedString(params.indicator)?.toLowerCase() === 'macd'
    ) {
      return {
        ...params,
        fastPeriod: this.hasFiniteNumber(params.fastPeriod) ? params.fastPeriod : 12,
        slowPeriod: this.hasFiniteNumber(params.slowPeriod) ? params.slowPeriod : 26,
        signalPeriod: this.hasFiniteNumber(params.signalPeriod) ? params.signalPeriod : 9,
      }
    }

    if (key !== 'price.percent_change' || typeof params.valuePct !== 'number' || !Number.isFinite(params.valuePct)) {
      return params
    }

    if (params.direction === 'down' || params.direction === '跌' || params.direction === '下跌') {
      return {
        ...params,
        valuePct: -Math.abs(params.valuePct),
      }
    }

    if (params.direction === 'up' || params.direction === '涨' || params.direction === '上涨') {
      return {
        ...params,
        valuePct: Math.abs(params.valuePct),
      }
    }

    return params
  }

  private readOpenSlots(value: unknown): SemanticSlotState[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map(item => this.toSlotState(item))
      .filter((item): item is SemanticSlotState => item !== null)
  }

  private ensureBollingerConfirmationOpenSlot(input: {
    key: string
    phase: SemanticTriggerState['phase']
    params: Record<string, unknown>
    openSlots: SemanticSlotState[]
    triggerIndex: number
    statusValue: unknown
  }): SemanticSlotState[] {
    if (
      input.statusValue === 'superseded'
      || !this.requiresBollingerConfirmationMode(input.key, input.params)
      || typeof input.params.confirmationMode === 'string'
    ) {
      return input.openSlots
    }

    const slotKey = `confirmationMode.${input.phase}`
    const fieldPath = `triggers[${input.triggerIndex}].params.confirmationMode`
    if (input.openSlots.some(slot => slot.slotKey === slotKey && slot.fieldPath === fieldPath)) {
      return input.openSlots
    }

    return [
      ...input.openSlots,
      {
        slotKey,
        fieldPath,
        status: 'open',
        priority: 'core',
        questionHint: '该触发条件是触碰即触发，还是收盘确认后触发？',
        affectsExecution: true,
      },
    ]
  }

  private requiresBollingerConfirmationMode(
    key: string,
    params: Record<string, unknown>,
  ): boolean {
    if (key.startsWith('bollinger.touch_')) {
      return true
    }

    if (key !== 'price.detect.indicator_boundary') {
      return false
    }

    const indicator = params.indicator
    return this.isRecord(indicator) && indicator.name === 'bollinger'
  }

  private resolveContractCoverage(options: {
    contracts: SemanticAtomContract[] | null
    openSlots: SemanticSlotState[]
    statusValue: unknown
    fieldPath: string
    priority: SemanticPriority
  }): { status: SemanticNodeStatus, openSlots: SemanticSlotState[] } {
    if (options.statusValue === 'superseded') {
      return {
        status: 'superseded',
        openSlots: this.removeContractRequiredSlots(options.openSlots, options.fieldPath),
      }
    }

    if (options.contracts) {
      const openSlots = this.removeContractRequiredSlots(options.openSlots, options.fieldPath)
      return {
        status: this.resolveNodeStatus(options.statusValue, openSlots),
        openSlots,
      }
    }

    return {
      status: 'open',
      openSlots: this.appendContractRequiredSlot(options.openSlots, options.fieldPath, options.priority),
    }
  }

  private appendContractRequiredSlot(
    openSlots: SemanticSlotState[],
    fieldPath: string,
    priority: SemanticPriority,
  ): SemanticSlotState[] {
    if (openSlots.some(slot => slot.slotKey === 'contract.required' && slot.fieldPath === fieldPath)) {
      return openSlots
    }

    return [
      ...openSlots,
      {
        slotKey: 'contract.required',
        fieldPath,
        status: 'open',
        priority,
        questionHint: '请补充该原子的执行合约。',
        affectsExecution: true,
      },
    ]
  }

  private removeContractRequiredSlots(openSlots: SemanticSlotState[], fieldPath: string): SemanticSlotState[] {
    return openSlots.filter(slot => slot.slotKey !== 'contract.required' || slot.fieldPath !== fieldPath)
  }

  private resolveActionSide(key: string): 'long' | 'short' | 'unknown' {
    if (key.includes('long')) {
      return 'long'
    }
    if (key.includes('short')) {
      return 'short'
    }
    return 'unknown'
  }

  private resolveActionIntent(key: string): 'open' | 'close' | 'unknown' {
    if (key.startsWith('open_')) {
      return 'open'
    }
    if (key.startsWith('close_')) {
      return 'close'
    }
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

  private readUnknownShape(value: unknown): SemanticCapabilityShape | null {
    const normalizedValue = this.toCapabilityShapeValue(value)
    if (normalizedValue === undefined) {
      return null
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

  private toCapabilityShapeValue(
    value: unknown,
  ): string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[] | undefined {
    if (value === null) {
      return null
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return Number.isNaN(value) ? undefined : value
    }
    if (Array.isArray(value)) {
      return value
        .map(item => this.toCapabilityArrayItem(item))
        .filter((item): item is SemanticCapabilityShape => item !== undefined)
    }
    if (this.isRecord(value)) {
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

  private slugifyContractId(value: string): string {
    return value.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '').toLowerCase() || 'atom'
  }

  private toSlotState(
    value: unknown,
    defaults?: {
      slotKey: string
      fieldPath: string
      priority: SemanticPriority
      questionHint: string
    },
  ): SemanticSlotState | null {
    if (!this.isRecord(value)) {
      return null
    }

    const slotKey = this.readTrimmedString(value.slotKey) ?? defaults?.slotKey
    const fieldPath = this.readTrimmedString(value.fieldPath) ?? defaults?.fieldPath
    const status = this.readStatus(value.status) ?? 'open'
    const priority = this.readPriority(value.priority) ?? defaults?.priority
    const questionHint = this.readTrimmedString(value.questionHint) ?? defaults?.questionHint
    const evidence = this.readEvidence(value.evidence)
    const supersedes = this.readStringArray(value.supersedes)
    const contracts = this.readContracts(value.contracts)

    if (!slotKey || !fieldPath || !priority || !questionHint || typeof value.affectsExecution !== 'boolean') {
      return null
    }

    const slotValue = this.readSlotValue(value.value)

    return {
      slotKey,
      fieldPath,
      ...(slotValue.present ? { value: slotValue.value } : {}),
      status,
      priority,
      questionHint,
      affectsExecution: value.affectsExecution,
      ...(evidence ? { evidence } : {}),
      ...(supersedes ? { supersedes } : {}),
      ...(contracts ? { contracts } : {}),
    }
  }

  private resolveNodeStatus(statusValue: unknown, openSlots: SemanticSlotState[]): SemanticNodeStatus {
    const status = this.readStatus(statusValue) ?? 'locked'
    if (status === 'superseded') {
      return status
    }
    return openSlots.some(slot => slot.status === 'open') ? 'open' : status
  }

  private readEvidence(value: unknown): SemanticEvidence | null {
    if (!this.isRecord(value)) {
      return null
    }

    const text = this.readTrimmedString(value.text)
    const source = this.readSource(value.source, null)
    if (!text || !source) {
      return null
    }

    return {
      text,
      ...(typeof value.messageIndex === 'number' && Number.isInteger(value.messageIndex)
        ? { messageIndex: value.messageIndex }
        : {}),
      source,
    }
  }

  private readSource(value: unknown): SemanticSource
  private readSource(value: unknown, fallback: SemanticSource): SemanticSource
  private readSource(value: unknown, fallback: null): SemanticSource | null
  private readSource(value: unknown, fallback: SemanticSource | null = 'user_explicit'): SemanticSource | null {
    if (value === 'user_explicit' || value === 'inferred' || value === 'derived') {
      return value
    }
    return fallback
  }

  private readStatus(value: unknown): SemanticNodeStatus | null {
    if (value === 'open' || value === 'locked' || value === 'superseded') {
      return value
    }
    return null
  }

  private readPriority(value: unknown): SemanticPriority | null {
    if (value === 'core' || value === 'behavior' || value === 'risk' || value === 'context') {
      return value
    }
    return null
  }

  private isContractKind(value: unknown): value is SemanticAtomContract['kind'] {
    return value === 'trigger'
      || value === 'action'
      || value === 'risk'
      || value === 'position'
      || value === 'context'
  }

  private readMarketInstrumentSymbolSource(value: unknown): MarketInstrumentSymbolSource | null {
    if (value === 'user_explicit' || value === 'inferred') {
      return value
    }

    return null
  }

  private readMarketInstrumentQuote(value: unknown): MarketInstrumentQuote | null {
    if (typeof value === 'string' && MARKET_INSTRUMENT_QUOTES.includes(value as MarketInstrumentQuote)) {
      return value as MarketInstrumentQuote
    }

    return null
  }

  private readMarketInstrumentQuoteSource(value: unknown): MarketInstrumentQuoteSource | null {
    if (value === 'explicit' || value === 'default_usdt') {
      return value
    }

    return null
  }

  private readMarketInstrumentMarketTypeHint(value: unknown): MarketInstrumentSymbolResolution['marketTypeHint'] | null {
    if (value === 'perp' || value === 'spot') {
      return value
    }

    return null
  }

  private isCapabilityDomain(value: unknown): value is SemanticCapabilityDomain {
    return value === 'market'
      || value === 'price'
      || value === 'order_program'
      || value === 'capital'
      || value === 'exposure'
      || value === 'margin'
      || value === 'guard'
      || value === 'runtime'
      || value === 'state'
      || value === 'order'
      || value === 'portfolio'
      || value === 'orchestration'
  }

  private isCapabilityShape(value: unknown): value is SemanticCapabilityShape {
    if (!this.isRecord(value)) {
      return false
    }

    return Object.values(value).every(item =>
      item === null
      || typeof item === 'string'
      || typeof item === 'number'
      || typeof item === 'boolean'
      || this.isCapabilityShape(item)
      || (Array.isArray(item) && item.every(nested => this.isCapabilityShape(nested))),
    )
  }

  private readStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const items = value
      .map(item => this.readTrimmedString(item))
      .filter((item): item is string => Boolean(item))
    return items.length > 0 ? items : null
  }

  private readSlotValue(value: unknown): SlotValueRead {
    if (value === null) {
      return { present: true, value: null }
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return { present: true, value }
    }

    return { present: false }
  }

  private readTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  private isRecord(value: unknown): value is SemanticPatchRecord {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  }

  private hasOwnProperty(value: SemanticPatchRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
  }
}
