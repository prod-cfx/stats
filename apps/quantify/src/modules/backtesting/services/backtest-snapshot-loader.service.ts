import type { BacktestExecutionPolicy, BacktestRunInput } from '../types/backtesting.types'
import type { BacktestSymbolAvailabilityCheckInput } from './backtest-symbol-availability.service'
import type { CanonicalRuleV2, CanonicalStrategySpec, RiskRuleSpec } from '@/modules/llm-strategy-codegen/types/canonical-strategy-spec'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- runtime DI required
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { BacktestCompiledSnapshotPreflightService } from './backtest-compiled-snapshot-preflight.service'
// eslint-disable-next-line ts/consistent-type-imports -- runtime DI required
import { BacktestStrategyAdapterService } from './backtest-strategy-adapter.service'

interface PublishedSnapshotRecord {
  id: string
  strategyInstanceId: string | null
  strategyTemplateId: string | null
  snapshotHash: string
  scriptHash: string
  specHash: string
  scriptSnapshot: string
  compiledManifest?: unknown
  specSnapshot?: unknown
  paramsSnapshot?: unknown
  strategyConfig?: unknown
  backtestConfigDefaults?: unknown
  deploymentExecutionDefaults?: unknown
  deploymentExecutionConstraints?: unknown
  lockedParams?: unknown
  executionPolicy?: unknown
  dataRequirements?: unknown
  irSnapshot?: unknown
  astSnapshot?: unknown
  executionEnvelope?: unknown
  irHash?: string | null
  astDigest?: string | null
  structuralDigest?: string | null
}

export interface SnapshotBacktestStrategyInput {
  id?: string
  protocolVersion: 'v1'
  publishedSnapshotId: string
  userId: string
  params?: Record<string, unknown>
}

export function extractSnapshotBoundSymbolAvailabilityInput(
  strategy: BacktestRunInput['strategy'],
): BacktestSymbolAvailabilityCheckInput | null {
  if (strategy.bindingSource !== 'PUBLISHED_SNAPSHOT_STRICT') {
    return null
  }

  const params = strategy.params as Record<string, unknown>
  const exchange = readSnapshotBoundTrimmedString(params.exchange)
  const symbol = readSnapshotBoundTrimmedString(params.symbol)
  const baseTimeframe = readSnapshotBoundTrimmedString(params.timeframe)
  const marketTypeRaw = readSnapshotBoundTrimmedString(params.marketType)
  const marketType = marketTypeRaw === 'spot' || marketTypeRaw === 'perp'
    ? marketTypeRaw
    : null
  const missingFields = [
    !exchange ? 'exchange' : null,
    !symbol ? 'symbol' : null,
    !baseTimeframe ? 'timeframe' : null,
    !marketType ? 'marketType' : null,
  ].filter((field): field is string => field !== null)

  if (missingFields.length > 0) {
    throw new DomainException('backtest.snapshot_params_missing', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args: {
        snapshotId: strategy.snapshotId ?? strategy.id,
        missingFields,
      },
    })
  }

  return {
    exchange,
    symbol,
    marketType,
    baseTimeframe,
  }
}

interface FormalSnapshotTruth {
  strategyConfig: {
    exchange: string
    symbol: string
    marketType: string
    baseTimeframe: string
    stateTimeframes: string[]
    positionPct: number | null
    positionSizing?: SnapshotPositionSizing
  }
  backtestConfigDefaults: {
    initialCash: number
    leverage: number | null
    slippageBps: number
    feeBps: number
    priceSource: 'open' | 'close' | 'mid'
    allowPartial: boolean
  }
  deploymentExecutionDefaults: {
    priceSource: string
    orderType: string
    timeInForce: string
  }
  deploymentExecutionConstraints: {
    defaultLeverage: number
    supportedPriceSources: string[]
    supportedOrderTypes: string[]
    supportedTimeInForce: string[]
  }
}

interface SnapshotPositionSizing {
  mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
  value: number
  asset?: string
}

function readSnapshotBoundTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized || null
}

@Injectable()
export class BacktestSnapshotLoaderService {
  constructor(
    private readonly snapshotsRepository: PublishedStrategySnapshotsRepository,
    private readonly strategyAdapter: BacktestStrategyAdapterService,
    private readonly compiledSnapshotPreflight: BacktestCompiledSnapshotPreflightService = new BacktestCompiledSnapshotPreflightService(),
  ) {}

  async load(input: SnapshotBacktestStrategyInput): Promise<BacktestRunInput['strategy']> {
    const snapshot = await this.snapshotsRepository.findByIdForUser(input.publishedSnapshotId, input.userId)
    if (!snapshot) {
      throw new DomainException('backtest.snapshot_not_found', {
        code: ErrorCode.BACKTEST_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { snapshotId: input.publishedSnapshotId },
      })
    }
    const publishedSnapshot = snapshot as unknown as PublishedSnapshotRecord
    const formalTruth = this.resolveFormalSnapshotTruth(publishedSnapshot)
    const strictParams = this.resolveStrictParams({
      id: publishedSnapshot.id,
      strategyConfig: formalTruth.strategyConfig,
    })
    this.compiledSnapshotPreflight.validate(publishedSnapshot)

    const strategy = await this.strategyAdapter.build({
      id: this.resolveStrategyId(publishedSnapshot, input.id),
      protocolVersion: input.protocolVersion,
      scriptCode: publishedSnapshot.scriptSnapshot,
      params: strictParams,
    })

    const specSnapshot = this.readJsonRecord(publishedSnapshot.specSnapshot) ?? undefined
    const irSnapshot = this.readJsonRecord(publishedSnapshot.irSnapshot) ?? undefined

    return {
      ...strategy,
      id: this.resolveStrategyId(publishedSnapshot, input.id),
      params: strictParams,
      stateTimeframes: formalTruth.strategyConfig.stateTimeframes,
      strategyInstanceId: publishedSnapshot.strategyInstanceId ?? undefined,
      strategyTemplateId: publishedSnapshot.strategyTemplateId ?? undefined,
      snapshotId: publishedSnapshot.id,
      snapshotHash: publishedSnapshot.snapshotHash,
      scriptHash: publishedSnapshot.scriptHash,
      specHash: this.resolveSpecHash(publishedSnapshot),
      irHash: typeof publishedSnapshot.irHash === 'string' ? publishedSnapshot.irHash : undefined,
      astDigest: typeof publishedSnapshot.astDigest === 'string' ? publishedSnapshot.astDigest : undefined,
      structuralDigest: typeof publishedSnapshot.structuralDigest === 'string' ? publishedSnapshot.structuralDigest : undefined,
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      executionPolicy: this.resolveExecutionPolicy(publishedSnapshot.executionPolicy),
      riskRules: specSnapshot ? this.buildRiskRules(specSnapshot, irSnapshot) : undefined,
      irSnapshot,
      astSnapshot: this.readJsonRecord(publishedSnapshot.astSnapshot) ?? undefined,
      executionEnvelope: this.readJsonRecord(publishedSnapshot.executionEnvelope) ?? undefined,
      dataRequirements: publishedSnapshot.dataRequirements ?? undefined,
      specSnapshot,
    } as BacktestRunInput['strategy']
  }

  private resolveStrictParams(snapshot: {
    id: string
    strategyConfig: FormalSnapshotTruth['strategyConfig']
  }): Record<string, unknown> {
    const resolvedParams = {
      exchange: snapshot.strategyConfig.exchange,
      symbol: snapshot.strategyConfig.symbol,
      marketType: snapshot.strategyConfig.marketType,
      timeframe: snapshot.strategyConfig.baseTimeframe,
      ...(snapshot.strategyConfig.positionPct !== null ? { positionPct: snapshot.strategyConfig.positionPct } : {}),
      ...(snapshot.strategyConfig.positionSizing ? { positionSizing: snapshot.strategyConfig.positionSizing } : {}),
    }

    if (!resolvedParams || Object.keys(resolvedParams).length === 0) {
      throw new DomainException('backtest.snapshot_params_missing', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { snapshotId: snapshot.id },
      })
    }

    return resolvedParams
  }

  private resolveFormalSnapshotTruth(snapshot: PublishedSnapshotRecord): FormalSnapshotTruth {
    const missingFields: string[] = []

    const strategyConfigRaw = this.readJsonRecord(snapshot.strategyConfig)
    const strategyConfig = strategyConfigRaw ? this.parseStrategyConfig(strategyConfigRaw) : null
    if (!strategyConfig) missingFields.push('strategyConfig')

    const backtestConfigDefaultsRaw = this.readJsonRecord(snapshot.backtestConfigDefaults)
    const backtestConfigDefaults = backtestConfigDefaultsRaw
      ? this.parseBacktestConfigDefaults(backtestConfigDefaultsRaw, strategyConfig?.marketType ?? null)
      : null
    if (!backtestConfigDefaults) missingFields.push('backtestConfigDefaults')

    const deploymentExecutionDefaultsRaw = this.readJsonRecord(snapshot.deploymentExecutionDefaults)
    const deploymentExecutionDefaults = deploymentExecutionDefaultsRaw
      ? this.parseDeploymentExecutionDefaults(deploymentExecutionDefaultsRaw)
      : null
    if (!deploymentExecutionDefaults) missingFields.push('deploymentExecutionDefaults')

    const deploymentExecutionConstraintsRaw = this.readJsonRecord(snapshot.deploymentExecutionConstraints)
    const deploymentExecutionConstraints = deploymentExecutionConstraintsRaw
      ? this.parseDeploymentExecutionConstraints(deploymentExecutionConstraintsRaw)
      : null
    if (!deploymentExecutionConstraints) missingFields.push('deploymentExecutionConstraints')

    if (missingFields.length > 0) {
      throw new DomainException('backtest.invalid_snapshot_execution_config', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: {
          snapshotId: snapshot.id,
          missingFields,
          requiresRepublish: true,
        },
      })
    }

    return {
      strategyConfig,
      backtestConfigDefaults,
      deploymentExecutionDefaults,
      deploymentExecutionConstraints,
    }
  }

  private resolveStrategyId(
    snapshot: {
      id: string
      strategyInstanceId: string | null
      strategyTemplateId: string | null
    },
    fallbackId?: string,
  ): string {
    return snapshot.strategyInstanceId ?? snapshot.strategyTemplateId ?? fallbackId ?? snapshot.id
  }

  private readJsonRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
  }

  private parseStrategyConfig(raw: Record<string, unknown>): FormalSnapshotTruth['strategyConfig'] | null {
    const exchange = this.readTrimmedString(raw.exchange)
    const symbol = this.readTrimmedString(raw.symbol)
    const marketTypeRaw = this.readTrimmedString(raw.marketType)
    const marketType = marketTypeRaw === 'spot' || marketTypeRaw === 'perp' ? marketTypeRaw : null
    const baseTimeframe = this.readTrimmedString(raw.baseTimeframe)
    const stateTimeframes = this.readStringArray(raw.stateTimeframes)
    const positionPct = this.readFiniteNumber(raw.positionPct)
    const positionSizing = this.parsePositionSizing(raw.positionSizing, positionPct)
    if (!exchange || !symbol || !marketType || !baseTimeframe) {
      return null
    }

    return {
      exchange,
      symbol,
      marketType,
      baseTimeframe,
      stateTimeframes,
      positionPct,
      ...(positionSizing ? { positionSizing } : {}),
    }
  }

  private parsePositionSizing(raw: unknown, positionPct: number | null): SnapshotPositionSizing | undefined {
    const sizing = this.readJsonRecord(raw)
    if (sizing) {
      const mode = sizing.mode
      const value = this.readFiniteNumber(sizing.value)
      const asset = this.readTrimmedString(sizing.asset)
      if (
        (mode === 'pct_equity' || mode === 'fixed_quote' || mode === 'fixed_base' || mode === 'position_pct')
        && value !== null
      ) {
        return {
          mode,
          value,
          ...(asset ? { asset } : {}),
        }
      }
    }

    return positionPct !== null
      ? { mode: 'pct_equity', value: positionPct }
      : undefined
  }

  private parseBacktestConfigDefaults(
    raw: Record<string, unknown>,
    marketType: string | null,
  ): FormalSnapshotTruth['backtestConfigDefaults'] | null {
    const initialCash = this.readFiniteNumber(raw.initialCash)
    const leverage = this.readFiniteNumber(raw.leverage)
    const slippageBps = this.readFiniteNumber(raw.slippageBps)
    const feeBps = this.readFiniteNumber(raw.feeBps)
    const priceSource = raw.priceSource
    const allowPartial = raw.allowPartial

    if (
      initialCash === null || initialCash <= 0
      || slippageBps === null || slippageBps < 0
      || feeBps === null || feeBps < 0
      || (priceSource !== 'open' && priceSource !== 'close' && priceSource !== 'mid')
      || typeof allowPartial !== 'boolean'
      || (marketType === 'perp' && (leverage === null || leverage <= 0))
      || (marketType !== 'spot' && marketType !== 'perp')
    ) {
      return null
    }

    return {
      initialCash,
      leverage: leverage !== null && leverage > 0 ? leverage : null,
      slippageBps,
      feeBps,
      priceSource,
      allowPartial,
    }
  }

  private parseDeploymentExecutionDefaults(raw: Record<string, unknown>): FormalSnapshotTruth['deploymentExecutionDefaults'] | null {
    const priceSource = this.readTrimmedString(raw.priceSource)
    const orderType = this.readTrimmedString(raw.orderType)
    const timeInForce = this.readTrimmedString(raw.timeInForce)
    if (!priceSource || !orderType || !timeInForce) {
      return null
    }

    return {
      priceSource,
      orderType,
      timeInForce,
    }
  }

  private parseDeploymentExecutionConstraints(raw: Record<string, unknown>): FormalSnapshotTruth['deploymentExecutionConstraints'] | null {
    const defaultLeverage = this.readFiniteNumber(raw.defaultLeverage)
    const supportedPriceSources = this.readStringArray(raw.supportedPriceSources)
    const supportedOrderTypes = this.readStringArray(raw.supportedOrderTypes)
    const supportedTimeInForce = this.readStringArray(raw.supportedTimeInForce)

    if (
      defaultLeverage === null || defaultLeverage <= 0
      || supportedPriceSources.length === 0
      || supportedOrderTypes.length === 0
      || supportedTimeInForce.length === 0
    ) {
      return null
    }

    return {
      defaultLeverage,
      supportedPriceSources,
      supportedOrderTypes,
      supportedTimeInForce,
    }
  }

  private readTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private readFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  private resolveSpecHash(snapshot: {
    specHash: string
    compiledManifest?: unknown
  }): string {
    const manifest = this.readJsonRecord(snapshot.compiledManifest)
    const manifestSpecHash = manifest?.specHash
    const normalizedManifestSpecHash = this.normalizeHashString(manifestSpecHash)
    if (normalizedManifestSpecHash) {
      return normalizedManifestSpecHash
    }

    return this.normalizeHashString(snapshot.specHash) ?? snapshot.specHash
  }

  private resolveExecutionPolicy(raw: unknown): BacktestRunInput['strategy']['executionPolicy'] {
    const policy = this.readJsonRecord(raw)
    if (!policy) return undefined

    const signalTiming: BacktestExecutionPolicy['signalTiming'] | undefined = typeof policy.signalTiming === 'string'
      ? policy.signalTiming === 'BAR_CLOSE' ? 'BAR_CLOSE' : undefined
      : policy.signalEvaluation === 'bar_close'
        ? 'BAR_CLOSE'
        : undefined
    const fillTiming: BacktestExecutionPolicy['fillTiming'] | undefined = typeof policy.fillTiming === 'string'
      ? policy.fillTiming === 'BAR_CLOSE' || policy.fillTiming === 'NEXT_BAR_OPEN'
        ? policy.fillTiming
        : undefined
      : policy.fillPolicy === 'next_bar_open'
        ? 'NEXT_BAR_OPEN'
        : policy.fillPolicy === 'same_bar_close'
          ? 'BAR_CLOSE'
          : undefined
    const noNextBarHandling: BacktestExecutionPolicy['noNextBarHandling'] | undefined = typeof policy.noNextBarHandling === 'string'
      ? policy.noNextBarHandling === 'KEEP_PENDING' || policy.noNextBarHandling === 'DROP_SIGNAL'
        ? policy.noNextBarHandling
        : undefined
      : signalTiming && fillTiming
        ? 'KEEP_PENDING'
        : undefined

    if (!signalTiming || !fillTiming || !noNextBarHandling) {
      return undefined
    }

    return {
      signalTiming,
      fillTiming,
      noNextBarHandling,
    }
  }

  private normalizeHashString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    if (!normalized) return null
    if (normalized.startsWith('sha256:')) return normalized
    if (/^[a-f0-9]{64}$/u.test(normalized)) return `sha256:${normalized}`
    return normalized
  }

  private buildRiskRules(
    specSnapshot: Record<string, unknown>,
    irSnapshot?: Record<string, unknown>,
  ): BacktestRunInput['strategy']['riskRules'] {
    const riskRules: NonNullable<BacktestRunInput['strategy']['riskRules']> = {}
    const canonicalSpec = this.readCanonicalSpec(specSnapshot)
    if (canonicalSpec?.version === 2) {
      const stopLossRule = canonicalSpec.rules.find(rule => this.isStopLossRuleV2(rule))
      const stopLossPct = this.parseStopLossPctV2(stopLossRule)
      if (typeof stopLossPct === 'number') {
        riskRules.maxFloatingLossPct = stopLossPct
      }

      const outsideBandRule = canonicalSpec.rules.find(rule => this.isOutsideBandRuleV2(rule))
      const bollingerIndicator = canonicalSpec.indicators.find(item => item.kind === 'bollingerBands')
      if (outsideBandRule && bollingerIndicator) {
        const hasReduceAction = outsideBandRule.actions.some(action =>
          action.type === 'REDUCE_LONG' || action.type === 'REDUCE_SHORT')
        riskRules.outsideBand = {
          mode: 'BOLLINGER_BANDS',
          lowerBound: 0,
          upperBound: 0,
          indicator: {
            kind: 'bollingerBands',
            period: Number(bollingerIndicator.params.period ?? 20),
            stdDev: Number(bollingerIndicator.params.stdDev ?? 2),
          },
          consecutiveBars: this.parseConsecutiveBarsV2(outsideBandRule) ?? 3,
          action: hasReduceAction ? 'REDUCE' : 'CLOSE',
          reduceRatio: hasReduceAction ? 0.5 : undefined,
        }
      }

      return Object.keys(riskRules).length > 0 ? riskRules : undefined
    }

    const stopLossPct = canonicalSpec
      ? this.parseStopLossPct(canonicalSpec.riskRules.find(rule => rule.effect === 'FORCE_STOP'))
      : this.parseStopLossPct(this.findGraphTrigger(specSnapshot, trigger => /亏损|lossPct/i.test(trigger)))
    if (typeof stopLossPct === 'number') {
      riskRules.maxFloatingLossPct = stopLossPct
    }

    const outsideBandRule = canonicalSpec?.riskRules.find(rule => this.isOutsideBandRule(rule))
    const outsideBandTrigger = outsideBandRule?.trigger
      ?? this.findGraphTrigger(specSnapshot, trigger => this.isOutsideBandTrigger(trigger))
    const bollingerIndicator = canonicalSpec?.indicators.find(item => item.kind === 'bollingerBands')
      ?? this.readBollingerIndicatorFromIr(irSnapshot)
    if (outsideBandTrigger && bollingerIndicator) {
      const outsideBandAction = outsideBandRule
        ? outsideBandRule.effect === 'REDUCE_POSITION' ? 'REDUCE' : 'CLOSE'
        : this.parseOutsideBandAction(outsideBandTrigger)
      riskRules.outsideBand = {
        mode: 'BOLLINGER_BANDS',
        lowerBound: 0,
        upperBound: 0,
        indicator: {
          kind: 'bollingerBands',
          period: Number(bollingerIndicator.params.period ?? 20),
          stdDev: Number(bollingerIndicator.params.stdDev ?? 2),
        },
        consecutiveBars: this.parseConsecutiveBars(outsideBandTrigger) ?? 3,
        action: outsideBandAction,
        reduceRatio: outsideBandAction === 'REDUCE' ? this.parseReduceRatio(outsideBandTrigger) ?? 0.5 : undefined,
      }
    }

    return Object.keys(riskRules).length > 0 ? riskRules : undefined
  }

  private readCanonicalSpec(raw: Record<string, unknown>): CanonicalStrategySpec | undefined {
    if (!Array.isArray(raw.indicators) || !Array.isArray(raw.riskRules)) return undefined
    return raw as unknown as CanonicalStrategySpec
  }

  private findGraphTrigger(
    specSnapshot: Record<string, unknown>,
    predicate: (trigger: string) => boolean,
  ): string | undefined {
    const triggerNodes = Array.isArray(specSnapshot.trigger) ? specSnapshot.trigger : []
    for (const node of triggerNodes) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue
      const operator = (node as { operator?: unknown }).operator
      if (typeof operator === 'string' && predicate(operator)) {
        return operator
      }
    }
    return undefined
  }

  private readBollingerIndicatorFromIr(
    irSnapshot?: Record<string, unknown>,
  ): { kind: 'bollingerBands', params: Record<string, number | string | boolean> } | undefined {
    const signalCatalog = this.readJsonRecord(irSnapshot?.signalCatalog)
    const series = Array.isArray(signalCatalog?.series) ? signalCatalog.series : []
    for (const rawSeries of series) {
      if (!rawSeries || typeof rawSeries !== 'object' || Array.isArray(rawSeries)) continue
      const series = rawSeries as { kind?: unknown, params?: unknown }
      if (
        series.kind !== 'LOWER_BAND'
        && series.kind !== 'MID_BAND'
        && series.kind !== 'UPPER_BAND'
      ) {
        continue
      }
      const params = this.readJsonRecord(series.params)
      return {
        kind: 'bollingerBands',
        params: {
          period: Number(params?.period ?? 20),
          stdDev: Number(params?.stdDev ?? 2),
        },
      }
    }
    return undefined
  }

  private parseStopLossPct(rule?: RiskRuleSpec | string): number | undefined {
    const trigger = typeof rule === 'string' ? rule : rule?.trigger
    if (!trigger) return undefined
    const match = trigger.match(/lossPct\s*>=\s*([0-9.]+)/i)
      ?? trigger.match(/亏损\s*[≥>=]+\s*([0-9.]+)\s*%/u)
      ?? trigger.match(/([0-9.]+)\s*%\s*(?:强制)?止损/u)
    const value = Number(match?.[1] ?? '')
    if (!Number.isFinite(value) || value <= 0) return undefined
    return value <= 1 ? value * 100 : value
  }

  private parseConsecutiveBars(trigger: string): number | undefined {
    const match = trigger.match(/(?:连续\s*)?(\d+)\s*(?:根|bars?)/i)
    const value = Number(match?.[1] ?? '')
    if (!Number.isFinite(value) || value <= 0) return undefined
    return Math.floor(value)
  }

  private isOutsideBandRule(rule: RiskRuleSpec): boolean {
    return /轨外|outside/i.test(rule.trigger)
  }

  private isOutsideBandTrigger(trigger: string): boolean {
    return /轨外|outside/i.test(trigger)
  }

  private parseOutsideBandAction(trigger: string): 'REDUCE' | 'CLOSE' {
    return /减仓|reduce/i.test(trigger) ? 'REDUCE' : 'CLOSE'
  }

  private parseReduceRatio(trigger: string): number | undefined {
    const match = trigger.match(/减仓\s*([0-9.]+)\s*%/u)
      ?? trigger.match(/reduce(?:\s+position)?\s*([0-9.]+)\s*%/iu)
    const value = Number(match?.[1] ?? '')
    if (!Number.isFinite(value) || value <= 0) return undefined
    return value > 1 ? value / 100 : value
  }

  private parseStopLossPctV2(rule?: CanonicalRuleV2): number | undefined {
    if (!rule || rule.condition.kind !== 'atom' || rule.condition.key !== 'position_loss_pct') {
      return undefined
    }

    const value = typeof rule.condition.value === 'number' ? rule.condition.value : Number.NaN
    if (!Number.isFinite(value) || value <= 0) return undefined
    return value <= 1 ? value * 100 : value
  }

  private parseConsecutiveBarsV2(rule: CanonicalRuleV2): number | undefined {
    if (rule.condition.kind !== 'atom') return undefined
    const rawBars = rule.condition.params?.bars
    if (typeof rawBars === 'number' && Number.isFinite(rawBars) && rawBars > 0) {
      return Math.floor(rawBars)
    }
    const rawValue = rule.condition.value
    if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
      return Math.floor(rawValue)
    }
    return undefined
  }

  private isOutsideBandRuleV2(rule: CanonicalRuleV2): boolean {
    return rule.condition.kind === 'atom' && rule.condition.key === 'bollinger.bars_outside'
  }

  private isStopLossRuleV2(rule: CanonicalRuleV2): boolean {
    return rule.phase === 'risk'
      && rule.condition.kind === 'atom'
      && rule.condition.key === 'position_loss_pct'
      && rule.actions.some(action => action.type === 'FORCE_EXIT')
  }
}
