import type { BacktestExecutionPolicy, BacktestRunInput } from '../types/backtesting.types'
import type { CanonicalRuleV2, CanonicalStrategySpec, RiskRuleSpec } from '@/modules/llm-strategy-codegen/types/canonical-strategy-spec'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- runtime DI required
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
// eslint-disable-next-line ts/consistent-type-imports -- runtime DI required
import { BacktestStrategyAdapterService } from './backtest-strategy-adapter.service'
import { BacktestCompiledSnapshotPreflightService } from './backtest-compiled-snapshot-preflight.service'

export interface SnapshotBacktestStrategyInput {
  id: string
  protocolVersion: 'v1'
  publishedSnapshotId: string
  userId: string
  params?: Record<string, unknown>
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
    const strictParams = this.resolveStrictParams(snapshot)
    this.compiledSnapshotPreflight.validate(snapshot)

    const strategy = await this.strategyAdapter.build({
      id: this.resolveStrategyId(snapshot, input.id),
      protocolVersion: input.protocolVersion,
      scriptCode: snapshot.scriptSnapshot,
      params: strictParams,
    })

    const specSnapshot = this.readJsonRecord(snapshot.specSnapshot) ?? undefined
    const irSnapshot = this.readJsonRecord(snapshot.irSnapshot) ?? undefined

    return {
      ...strategy,
      id: this.resolveStrategyId(snapshot, input.id),
      params: strictParams,
      strategyInstanceId: snapshot.strategyInstanceId ?? undefined,
      strategyTemplateId: snapshot.strategyTemplateId ?? undefined,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      scriptHash: snapshot.scriptHash,
      specHash: this.resolveSpecHash(snapshot),
      irHash: typeof snapshot.irHash === 'string' ? snapshot.irHash : undefined,
      astDigest: typeof snapshot.astDigest === 'string' ? snapshot.astDigest : undefined,
      structuralDigest: typeof snapshot.structuralDigest === 'string' ? snapshot.structuralDigest : undefined,
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      executionPolicy: this.resolveExecutionPolicy(snapshot.executionPolicy),
      riskRules: specSnapshot ? this.buildRiskRules(specSnapshot, irSnapshot) : undefined,
      irSnapshot,
      astSnapshot: this.readJsonRecord(snapshot.astSnapshot) ?? undefined,
      executionEnvelope: this.readJsonRecord(snapshot.executionEnvelope) ?? undefined,
      dataRequirements: snapshot.dataRequirements ?? undefined,
      specSnapshot,
    } as BacktestRunInput['strategy']
  }

  private resolveStrictParams(snapshot: {
    id: string
    paramsSnapshot: unknown
    lockedParams: unknown
  }): Record<string, unknown> {
    const paramsSnapshot = this.readJsonRecord(snapshot.paramsSnapshot)
    const lockedParams = this.readJsonRecord(snapshot.lockedParams)
    const resolvedParams = {
      ...(paramsSnapshot ?? {}),
      ...(lockedParams ?? {}),
    }

    const positionPct = resolvedParams?.positionPct
    const hasPositionPct = typeof positionPct === 'number' && Number.isFinite(positionPct)
    if (!resolvedParams || Object.keys(resolvedParams).length === 0 || !hasPositionPct) {
      throw new DomainException('backtest.snapshot_params_missing', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        args: { snapshotId: snapshot.id },
      })
    }

    return resolvedParams
  }

  private resolveStrategyId(
    snapshot: {
      id: string
      strategyInstanceId: string | null
      strategyTemplateId: string | null
    },
    fallbackId: string,
  ): string {
    return snapshot.strategyInstanceId ?? snapshot.strategyTemplateId ?? snapshot.id ?? fallbackId
  }

  private readJsonRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
  }

  private resolveSpecHash(snapshot: {
    specHash: string
    compiledManifest: unknown
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
      ?? trigger.match(/亏损\s*[≥>=]+\s*([0-9.]+)\s*%/iu)
      ?? trigger.match(/([0-9.]+)\s*%\s*(?:强制)?止损/iu)
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
    const match = trigger.match(/减仓\s*([0-9.]+)\s*%/iu)
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
