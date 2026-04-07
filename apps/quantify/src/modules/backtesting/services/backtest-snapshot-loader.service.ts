import type { BacktestRunInput } from '../types/backtesting.types'
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

    const specSnapshot = this.readCanonicalSpec(snapshot.specSnapshot)

    return {
      ...strategy,
      id: this.resolveStrategyId(snapshot, input.id),
      params: strictParams,
      strategyInstanceId: snapshot.strategyInstanceId ?? undefined,
      strategyTemplateId: snapshot.strategyTemplateId ?? undefined,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      scriptHash: snapshot.scriptHash,
      specHash: snapshot.specHash,
      irHash: typeof snapshot.irHash === 'string' ? snapshot.irHash : undefined,
      astDigest: typeof snapshot.astDigest === 'string' ? snapshot.astDigest : undefined,
      structuralDigest: typeof snapshot.structuralDigest === 'string' ? snapshot.structuralDigest : undefined,
      bindingSource: 'PUBLISHED_SNAPSHOT_STRICT',
      executionPolicy: snapshot.executionPolicy ?? undefined,
      riskRules: specSnapshot ? this.buildRiskRules(specSnapshot) : undefined,
      irSnapshot: this.readJsonRecord(snapshot.irSnapshot) ?? undefined,
      astSnapshot: this.readJsonRecord(snapshot.astSnapshot) ?? undefined,
      executionEnvelope: this.readJsonRecord(snapshot.executionEnvelope) ?? undefined,
      dataRequirements: snapshot.dataRequirements ?? undefined,
      specSnapshot: specSnapshot as unknown as Record<string, unknown> | undefined,
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

  private readCanonicalSpec(raw: unknown): CanonicalStrategySpec | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    return raw as CanonicalStrategySpec
  }

  private readJsonRecord(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as Record<string, unknown>
  }

  private buildRiskRules(spec: CanonicalStrategySpec): BacktestRunInput['strategy']['riskRules'] {
    const riskRules: NonNullable<BacktestRunInput['strategy']['riskRules']> = {}
    if (spec.version === 2) {
      const stopLossRule = spec.rules.find(rule => this.isStopLossRuleV2(rule))
      const stopLossPct = this.parseStopLossPctV2(stopLossRule)
      if (typeof stopLossPct === 'number') {
        riskRules.maxFloatingLossPct = stopLossPct
      }

      const outsideBandRule = spec.rules.find(rule => this.isOutsideBandRuleV2(rule))
      const bollingerIndicator = spec.indicators.find(item => item.kind === 'bollingerBands')
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

    const stopLossRule = spec.riskRules.find(rule => rule.effect === 'FORCE_STOP')
    const stopLossPct = this.parseStopLossPct(stopLossRule)
    if (typeof stopLossPct === 'number') {
      riskRules.maxFloatingLossPct = stopLossPct
    }

    const outsideBandRule = spec.riskRules.find(rule => this.isOutsideBandRule(rule))
    const bollingerIndicator = spec.indicators.find(item => item.kind === 'bollingerBands')
    if (outsideBandRule && bollingerIndicator) {
      riskRules.outsideBand = {
        mode: 'BOLLINGER_BANDS',
        lowerBound: 0,
        upperBound: 0,
        indicator: {
          kind: 'bollingerBands',
          period: Number(bollingerIndicator.params.period ?? 20),
          stdDev: Number(bollingerIndicator.params.stdDev ?? 2),
        },
        consecutiveBars: this.parseConsecutiveBars(outsideBandRule.trigger) ?? 3,
        action: outsideBandRule.effect === 'REDUCE_POSITION' ? 'REDUCE' : 'CLOSE',
        reduceRatio: outsideBandRule.effect === 'REDUCE_POSITION' ? 0.5 : undefined,
      }
    }

    return Object.keys(riskRules).length > 0 ? riskRules : undefined
  }

  private parseStopLossPct(rule?: RiskRuleSpec): number | undefined {
    if (!rule) return undefined
    const match = rule.trigger.match(/lossPct\s*>=\s*([0-9.]+)/i)
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
