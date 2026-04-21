import type {
  AiSignalPayload,
  MarketTimeframe as AppMarketTimeframe,
  StrategyDecisionV1, SignalSourceType, SignalStatus 
} from '@ai/shared'
import type {
  MultiLegStrategyContext,
} from '@ai/shared/script-engine/helpers/context-builder'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { CronJob } from 'cron'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type {IndicatorGroup, IndicatorSnapshot} from './signal-generation-candidate.stage';
import type {GeneratedSignalPayload} from './signal-generation-decision.stage';
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import type { GatewayBar } from '@/modules/market-data/services/market-data-read.gateway'
import type {
  StrategyDataRequirements,
  StrategyExecutionConfig,
  StrategyLegDefinition,
} from '@/modules/strategy-templates/types/strategy-template.types'
import type { Prisma, PrismaClient, StrategyInstance, StrategyTemplate, Symbol } from '@/prisma/prisma.types'
import { fillPromptTemplate, parseAiSignalResponse, ErrorCode } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import {
  buildMultiLegStrategyContext,
  buildStrategyContext,
} from '@ai/shared/script-engine/helpers/context-builder'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 TransactionHost
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 ConfigService
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { Optional } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { EnvService } from '@/common/services/env.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PublishedStrategySnapshotsRepository } from '@/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository'
import { mapTimeframe, reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AiService } from '@/modules/ai/ai.service'
import { normalizeGatewayBars } from '@/modules/market-data/services/market-data-bar.mapper'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { MarketDataReadGateway } from '@/modules/market-data/services/market-data-read.gateway'
import { resolveStrategyOutput, strategyDecisionToSignalPayload } from '@/modules/strategy-runtime/strategy-protocol.util'
import { compileStrategyScriptForVm } from '@/modules/strategy-runtime/strategy-script-compiler.util'
import {
  parseDataRequirements,
} from '@/modules/strategy-templates/utils/data-requirements-timeframe.mapper'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalGeneratorRepository } from '../repositories/signal-generator.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategyRuntimeExecutionStateRepository } from '../repositories/strategy-runtime-execution-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategySignalStateRepository } from '../repositories/strategy-signal-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingSignalRepository } from '../repositories/trading-signal.repository'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { ScriptDebugUtil } from '../utils/script-debug.util'
import {
  SignalGenerationCandidateStage
} from './signal-generation-candidate.stage'
import {
  SignalGenerationDecisionStage
} from './signal-generation-decision.stage'
import { SignalGenerationPersistenceStage } from './signal-generation-persistence.stage'
import { SignalGenerationSchedulerStage } from './signal-generation-scheduler.stage'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalTelemetryService } from './signal-telemetry.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategyRuntimeExecutionStateService } from './strategy-runtime-execution-state.service'

const DEFAULT_BAR_LIMIT = 100
const MAX_SCRIPT_TIMEOUT_MS = 5000

type StrategyInstanceWithTemplate = Prisma.StrategyInstanceGetPayload<{
  include: {
    strategyTemplate: true
  }
}>

type RuntimeStrategySource = {
  strategy: StrategyTemplate
  provenance: Prisma.JsonObject
  executionSemanticKeys?: string[]
}

@Injectable()
export class SignalGeneratorService {
  private readonly logger = new Logger(SignalGeneratorService.name)
  private readonly cronJobName = 'strategy-signals.generate'
  private cronJob?: CronJob
  private isRunning = false
  private lastStrategyIndex = 0
  private readonly schedulerStage: SignalGenerationSchedulerStage
  private readonly candidateStage: SignalGenerationCandidateStage
  private readonly decisionStage: SignalGenerationDecisionStage
  private readonly persistenceStage: SignalGenerationPersistenceStage
  /**
   * 记录每个策略实例在 candidateGroups 中的轮询位置，
   * 避免多个实例共享同一模板的指针导致各自只覆盖一部分标的。
   */
  private readonly lastGroupIndexByInstance = new Map<string, number>()

  constructor(
    private readonly generatorRepository: SignalGeneratorRepository,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly aiService: AiService,
    private readonly tradingSignalRepository: TradingSignalRepository,
    private readonly stateRepository: StrategySignalStateRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly telemetry: SignalTelemetryService,
    private readonly marketDataReadGateway: MarketDataReadGateway,
    private readonly env: EnvService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    @Optional() private readonly publishedSnapshotsRepository?: PublishedStrategySnapshotsRepository,
    @Optional() private readonly runtimeExecutionStateService?: StrategyRuntimeExecutionStateService,
    @Optional() private readonly runtimeExecutionStateRepository?: StrategyRuntimeExecutionStateRepository,
  ) {
    this.schedulerStage = new SignalGenerationSchedulerStage(
      this.schedulerRegistry,
      this.logger,
    )
    this.candidateStage = new SignalGenerationCandidateStage(
      this.generatorRepository,
      this.marketDataReadGateway,
    )
    this.decisionStage = new SignalGenerationDecisionStage(this.aiService, this.logger)
    this.persistenceStage = new SignalGenerationPersistenceStage(
      this.generatorRepository,
      this.tradingSignalRepository,
      this.stateRepository,
      this.eventEmitter,
      this.telemetry,
      this.txHost,
      this.logger,
    )
    this.registerCronJob()
  }

  private registerCronJob() {
    const config = this.getConfig()
    this.cronJob = this.schedulerStage.registerCronJob(
      this.cronJobName,
      config.cronExpression,
      this.cronJob,
      async () => this.runGenerationCycle(),
    )
  }

  private async runGenerationCycle() {
    const config = this.getConfig()
    await this.schedulerStage.runGenerationCycle(
      config,
      this.isRunning,
      value => {
        this.isRunning = value
      },
      async () => this.generateSignals(config),
    )
  }

  async generateSignals(
    config: StrategySignalsRuntimeConfig = this.getConfig(),
    options: { skipCooldown?: boolean } = {},
  ) {
    if (!config.enabled) {
      this.logger.debug('Strategy signal generation is disabled via configuration')
      return
    }

    // 以“策略实例”为单位生成信号：
    // - 只处理 status='running' 且 mode='LIVE' 的实例
    // - 底层模板必须为 status='live'
    const instances = await this.generatorRepository.findRunningInstances()

    const total = instances.length
    if (!total) {
      this.logger.debug('No running strategy instances found for signal generation')
      return
    }

    const batchSize = Math.min(config.batchSize, total)
    if (batchSize <= 0) {
      this.logger.debug('Strategy signal generation batchSize is non-positive, skipping')
      return
    }

    for (let i = 0; i < batchSize; i += 1) {
      const index = (this.lastStrategyIndex + i) % total
      const instance = instances[index]!
      try {
        await this.processStrategyInstance(instance, config, options)
      } catch (error) {
        this.logger.error(
          `Failed to process strategy instance ${instance.id}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }

    this.lastStrategyIndex = (this.lastStrategyIndex + batchSize) % total
  }

  private getConfig(): StrategySignalsRuntimeConfig {
    return (
      this.configService.get<StrategySignalsRuntimeConfig>('strategySignals') ??
      DEFAULT_STRATEGY_SIGNALS_CONFIG
    )
  }

  /**
   * 验证策略实例是否可以手动触发信号生成
   * 在返回前同步验证所有必须条件，避免误报成功
   * @param instanceId 策略实例 ID
   * @throws 如果验证失败，抛出带详细错误信息的异常
   */
  async validateManualTriggerTarget(instanceId: string): Promise<void> {
    const config = this.getConfig()

    if (!config.enabled) {
      throw new DomainException('signal.generation_disabled', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { reason: 'STRATEGY_SIGNALS_ENABLED=false' },
      })
    }

    // 查询指定的策略实例
    const instance = await this.generatorRepository.findStrategyInstance(instanceId)

    if (!instance) {
      throw new DomainException('signal.instance_not_found', {
        code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: instanceId },
      })
    }

    // 验证实例状态
    if (instance.status !== 'running') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, status: instance.status },
      })
    }

    if (instance.mode !== 'LIVE' && instance.mode !== 'TESTNET') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, mode: instance.mode },
      })
    }

    if (!instance.strategyTemplate) {
      throw new DomainException('strategy.template_not_found', {
        code: ErrorCode.STRATEGY_TEMPLATE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: instanceId },
      })
    }

    if (instance.strategyTemplate.status !== 'live') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, templateStatus: instance.strategyTemplate.status },
      })
    }
  }

  /**
   * 为指定的策略实例生成信号（用于手动触发）
   * @param instanceId 策略实例 ID
   * @param options 选项配置
   * @param options.skipCooldown 是否跳过 cooldown 检查
   */
  async generateSignalForInstance(
    instanceId: string,
    options: { skipCooldown?: boolean } = {},
  ): Promise<void> {
    const config = this.getConfig()

    if (!config.enabled) {
      this.logger.debug('Strategy signal generation is disabled via configuration')
      return
    }

    // 查询指定的策略实例
    const instance = await this.generatorRepository.findStrategyInstance(instanceId)

    if (!instance) {
      throw new DomainException('signal.instance_not_found', {
        code: ErrorCode.STRATEGY_INSTANCE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: instanceId },
      })
    }

    // 验证实例状态
    if (instance.status !== 'running') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, status: instance.status },
      })
    }

    if (instance.mode !== 'LIVE' && instance.mode !== 'TESTNET') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, mode: instance.mode },
      })
    }

    if (!instance.strategyTemplate) {
      throw new DomainException('strategy.template_not_found', {
        code: ErrorCode.STRATEGY_TEMPLATE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { id: instanceId },
      })
    }

    if (instance.strategyTemplate.status !== 'live') {
      throw new DomainException('signal.generation_error', {
        code: ErrorCode.STRATEGY_SIGNAL_GENERATION_ERROR,
        status: HttpStatus.BAD_REQUEST,
        args: { id: instanceId, templateStatus: instance.strategyTemplate.status },
      })
    }

    // 处理该实例
    this.logger.log(`Manually generating signal for strategy instance ${instanceId}`)
    await this.processStrategyInstance(instance, config, options)
  }

  /**
   * 检查是否启用脚本调试日志
   * 生产环境默认禁用，除非显式配置
   */
  private isDebugEnabled(): boolean {
    const config = this.getConfig()

    // 生产环境必须显式启用调试，开发环境默认启用
    if (this.env.isProd()) {
      return config.debug?.enabled === true
    }

    return config.debug?.enabled !== false
  }

  private async processStrategyInstance(
    instance: StrategyInstanceWithTemplate,
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
  ) {
    const strategy = instance.strategyTemplate
    if (!strategy) {
      this.logger.warn(
        `Strategy instance ${instance.id} has no linked template, skipping signal generation`,
      )
      return
    }

    const runtimeSource = await this.resolveRuntimeStrategySource(instance, strategy)
    if (!runtimeSource) {
      return
    }
    const runtimeStrategy = runtimeSource.strategy
    const runtimeProvenance = runtimeSource.provenance

    if (runtimeProvenance.executionContentSource === 'PUBLISHED_SNAPSHOT') {
      await this.processPublishedSnapshotStrategyInstance(
        instance,
        runtimeStrategy,
        runtimeProvenance,
        runtimeSource.executionSemanticKeys ?? [],
        config,
        options,
      )
      return
    }

    // 检查策略是否使用新架构（有 execution 和 dataRequirements）
    const execution = runtimeStrategy.execution as unknown as StrategyExecutionConfig | null | undefined
    const dataRequirements = parseDataRequirements(runtimeStrategy.dataRequirements)
    const legs = runtimeStrategy.legs as unknown as StrategyLegDefinition[] | null | undefined

    if (execution && dataRequirements && legs && legs.length > 0) {
      // 新架构：使用 legs 和 dataRequirements
      return this.processStrategyWithLegsForInstance(
        instance,
        runtimeStrategy,
        execution,
        dataRequirements,
        legs,
        config,
        options,
        runtimeProvenance,
      )
    }

    // 旧架构：使用 requiredFields
    const requiredFields = runtimeStrategy.requiredFields as string[] | null
    if (!requiredFields?.length) {
      this.logger.debug(
        `Strategy ${runtimeStrategy.id} has no required fields or legs, skipping signal generation`,
      )
      return
    }

    if (!instance.llmModel || !runtimeStrategy.promptTemplate) {
      this.logger.debug(
        `Strategy ${runtimeStrategy.id} / instance ${instance.id} lacks llmModel or promptTemplate, skipping`,
      )
      return
    }

    if (!options.skipCooldown && (await this.isStrategyLocked(instance.id))) {
      this.logger.debug(`Strategy instance ${instance.id} cooldown active, skipping generation`)
      return
    }

    const candidateGroups = await this.findCandidateGroups(runtimeStrategy, requiredFields)
    if (!candidateGroups.length) {
      this.logger.debug(`Strategy ${runtimeStrategy.id} has no indicator groups covering required fields`)
      this.telemetry.recordGeneration({
        strategyId: runtimeStrategy.id,
        symbolCode: 'N/A',
        success: false,
        reason: 'MISSING_INDICATORS',
      })
      return
    }

    const totalGroups = candidateGroups.length
    const maxPerTick = Math.min(config.maxSymbolsPerStrategy, totalGroups)
    if (maxPerTick <= 0) {
      this.logger.debug(`Strategy ${runtimeStrategy.id} has non-positive maxSymbolsPerStrategy, skipping`)
      return
    }

    // 轮询指针改为按实例维度独立维护，避免多个实例“分食”同一模板的标的集合。
    const lastGroupIndex = this.lastGroupIndexByInstance.get(instance.id) ?? 0

    for (let i = 0; i < maxPerTick; i += 1) {
      const index = (lastGroupIndex + i) % totalGroups
      const group = candidateGroups[index]!
      try {
        await this.generateSignalForGroup(
          instance,
          runtimeStrategy,
          group,
          requiredFields,
          runtimeProvenance,
          config,
          options,
        )
      } catch (error) {
        this.logger.error(
          `Failed to generate signal for strategy ${runtimeStrategy.id} / instance ${instance.id} and symbol ${group.symbol.code}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }

    this.lastGroupIndexByInstance.set(instance.id, (lastGroupIndex + maxPerTick) % totalGroups)
  }

  /**
   * 处理使用新架构的策略（多 Leg 多周期）
   */
  private async processStrategyWithLegsForInstance(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    execution: StrategyExecutionConfig,
    dataRequirements: StrategyDataRequirements,
    legs: StrategyLegDefinition[],
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
    runtimeProvenance: Prisma.JsonObject = {},
  ) {
    if (!instance.llmModel || !strategy.promptTemplate) {
      this.logger.debug(
        `Strategy ${strategy.id} / instance ${instance.id} lacks llmModel or promptTemplate, skipping`,
      )
      return
    }

    if (!options.skipCooldown && (await this.isStrategyLocked(instance.id))) {
      this.logger.debug(`Strategy instance ${instance.id} cooldown active, skipping generation`)
      return
    }

    // 找到 primary leg
    const primaryLeg = legs.find(leg => leg.role === 'primary')
    if (!primaryLeg) {
      this.logger.warn(
        `Strategy ${strategy.id} has no primary leg, skipping for instance ${instance.id}`,
      )
      return
    }

    // 为 primary leg 生成信号
    try {
      await this.generateSignalForMultiLegStrategy(
        instance,
        strategy,
        execution,
        dataRequirements,
        legs,
        primaryLeg,
        config,
        options,
        runtimeProvenance,
      )
    } catch (error) {
      this.logger.error(
        `Failed to generate signal for multi-leg strategy ${strategy.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  private async generateSignalForGroup(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    group: IndicatorGroup,
    requiredFields: string[],
    runtimeProvenance: Prisma.JsonObject,
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
  ) {
    const snapshots = await this.loadIndicatorSnapshots(group, requiredFields)
    if (!snapshots) {
      this.logger.debug(
        `Unable to load indicator snapshots for strategy ${strategy.id} on ${group.symbol.code}`,
      )
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: group.symbol.code,
        success: false,
        reason: 'SNAPSHOT_MISSING',
      })
      return
    }

    const indicatorValues: Record<string, number> = {}
    let latestIndicatorTime: Date | undefined
    for (const snapshot of snapshots) {
      indicatorValues[snapshot.field] = snapshot.value
      if (!latestIndicatorTime || snapshot.recordedAt > latestIndicatorTime) {
        latestIndicatorTime = snapshot.recordedAt
      }
    }

    const referenceBar = await this.loadLatestBar(group.symbol.id, group.timeframe)
    const referencePrice = referenceBar ? Number(referenceBar.close) : undefined

    const aiPayload = await this.generateSignalWithAi(
      instance,
      strategy,
      group.symbol,
      reverseMapTimeframe(group.timeframe),
      indicatorValues,
      config,
      referencePrice,
      options.skipCooldown ?? false,
    )
    if (!aiPayload) {
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: group.symbol.code,
        success: false,
        reason: 'AI_FAILURE',
      })
      return
    }

    await this.resetStrategyFailure(instance.id)

    await this.createSignalWithCooldownAndLock(
      instance,
      strategy,
      group,
      config,
      indicatorValues,
      latestIndicatorTime,
      aiPayload,
      runtimeProvenance,
      options.skipCooldown ?? false,
    )
  }

  /**
   * 在多副本部署场景下，使用数据库行锁 + 冷却时间检查保证同一策略/标的/冷却窗口内只生成一次信号。
   * 逻辑：
   * 1. 对 strategy_templates 行加 FOR UPDATE 锁，串行化同一策略的生成流程；
   * 2. 在同一事务内再次检查冷却窗口内是否已有 TradingSignal；
   * 3. 若已存在则跳过；否则创建新信号并在事务外发布事件。
   */
  private async createSignalWithCooldownAndLock(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    group: IndicatorGroup,
    config: StrategySignalsRuntimeConfig,
    indicatorValues: Record<string, number>,
    latestIndicatorTime: Date | undefined,
    aiPayload: AiSignalPayload & { rawResponse: string },
    runtimeProvenance: Prisma.JsonObject,
    skipCooldown = false,
    onCreatedInTransaction?: (signalId: string) => Promise<void>,
  ) {
    return this.persistenceStage.createSignalWithCooldownAndLock(
      instance,
      strategy,
      group,
      config,
      indicatorValues,
      latestIndicatorTime,
      aiPayload,
      runtimeProvenance,
      skipCooldown,
      onCreatedInTransaction,
    )
  }

  private async generateSignalWithAi(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    symbol: Symbol,
    timeframe: AppMarketTimeframe,
    indicators: Record<string, number>,
    config: StrategySignalsRuntimeConfig,
    referencePrice?: number,
    manualTrigger = false,
    compiledDecisionState?: { barIndex: number; lastTriggeredByProgram: Record<string, number> },
  ): Promise<(AiSignalPayload & { rawResponse: string }) | null> {
    const isStrictCodegen = this.isStrictPublishedCodegenTemplate(strategy)
    let promptData: Record<string, any> = {}

    if (strategy.script) {
      try {
        const engine = createScriptEngine()
        const compiledScript = compileStrategyScriptForVm(strategy.script)
        if (!compiledScript.ok) {
          this.logger.error(
            `TypeScript check failed for strategy ${strategy.id}: ${compiledScript.error ?? 'Unknown error'}`,
          )
          if (isStrictCodegen) {
            return null
          }
          promptData = indicators
        } else {
          const requireFinalLatestBar = isStrictCodegen
          const marketBars = await this.loadRecentBars(symbol.id, timeframe, DEFAULT_BAR_LIMIT, {
            requireFinalLatestBar,
          })
          const bars = this.normalizeRuntimeBars(marketBars ?? [], {
            requireFinalLatestBar,
          })
          const scriptContext = {
            ...buildStrategyContext({
              bars,
              symbol: symbol.code,
              timeframe,
              indicators,
              currentPrice: referencePrice || 0,
              timestamp: Date.now(),
              params: this.buildEffectiveParams(strategy, instance),
            }),
            ...(compiledDecisionState ? { __compiledDecisionState: compiledDecisionState } : {}),
          }

          let result = await engine.execute(compiledScript.executableCode, {
            context: scriptContext,
            timeout: MAX_SCRIPT_TIMEOUT_MS,
            allowAsync: false,
          })

          if (!result.success && result.error?.message) {
            const errorMsg = result.error.message
            const needsAsync =
              errorMsg.includes('Illegal return statement') ||
              errorMsg.includes('await is only valid in async functions') ||
              errorMsg.includes('Unexpected reserved word')

            if (needsAsync) {
              this.logger.warn(
                `Strategy ${strategy.id} script needs async context (${errorMsg}), retrying with allowAsync`,
              )
              result = await engine.execute(compiledScript.executableCode, {
                context: scriptContext,
                timeout: MAX_SCRIPT_TIMEOUT_MS,
                allowAsync: true,
              })
            }
          }

          if (result.success) {
            const validation = validateScriptOutput(result.value, { allowEmpty: true })

            if (!validation.valid || !validation.value) {
              this.logger.warn(
                `Script for strategy ${strategy.id} returned invalid data. ` +
                  `Reason: ${validation.error ?? 'Unknown validation error'}. ` +
                  `Using indicators as fallback.`,
              )
              if (isStrictCodegen) {
                return null
              }
              promptData = indicators
            } else {
              const resolved = await resolveStrategyOutput(
                validation.value as Record<string, unknown>,
                scriptContext as unknown as Record<string, unknown>,
              )
              if (resolved.error) {
                this.logger.warn(
                  `Script adapter resolution failed for strategy ${strategy.id}: ${resolved.error}. Using indicators as fallback.`,
                )
                if (isStrictCodegen) {
                  return null
                }
                promptData = indicators
              } else if (resolved.decision) {
                const decisionContext = this.buildDecisionContext(indicators, referencePrice)
                if (
                  this.requiresExplicitDecisionContext(resolved.decision) &&
                  !this.hasExplicitDecisionContext(decisionContext)
                ) {
                  this.logger.error(
                    `Script for strategy ${strategy.id} returned ADJUST_POSITION without explicit context (currentQty/equity/markPrice). Rejecting decision.`,
                  )
                  return null
                }
                promptData = isStrictCodegen
                  ? this.buildStrictPublishedPromptDataFromDecision(
                      resolved.decision,
                      referencePrice || 0,
                      decisionContext,
                    )
                  : (strategyDecisionToSignalPayload(
                      resolved.decision,
                      referencePrice || 0,
                      decisionContext,
                    ) as Record<string, any>)
              } else {
                promptData = (resolved.passthrough ?? validation.value) as Record<string, any>
              }
              this.logger.debug(
                `Script executed successfully for strategy ${strategy.id}, data: ${JSON.stringify(promptData)}`,
              )
            }
          } else {
            this.logger.warn(
              `Script execution failed for strategy ${strategy.id}: ${result.error?.message}`,
            )
            if (isStrictCodegen) {
              return null
            }
            promptData = indicators
          }
        }
      } catch (error) {
        this.logger.error(
          `Error executing script for strategy ${strategy.id}: ${(error as Error).message}`,
        )
        if (isStrictCodegen) {
          return null
        }
        promptData = indicators
      }
    } else {
      if (isStrictCodegen) {
        return null
      }
      promptData = indicators
    }

    const directSignal = this.buildPublishedCodegenSignalPayload(
      promptData,
      referencePrice,
      strategy,
      instance,
    )
    if (directSignal) {
      if (directSignal.type === 'none') {
        return null
      }
      return directSignal.payload
    }
    if (isStrictCodegen) {
      return null
    }

    const filledPrompt = fillPromptTemplate(strategy.promptTemplate, promptData)

    const systemPrompt =
      'You are a quantitative trading assistant. Analyze the provided market data and respond with a strict JSON object. ' +
      'The JSON must include direction (BUY, SELL, CLOSE_LONG, CLOSE_SHORT), signalType (ENTRY or EXIT), confidence (0-100), ' +
      'entryPrice, stopLoss, takeProfit, and reasoning. ' +
      'You can optionally specify position size: either positionSizeQuote (absolute amount in quote currency like USDT) ' +
      'or positionSizeRatio (fraction of account balance, 0-1). If not specified, system defaults will be used.'

    const userPrompt = [
      `Strategy: ${strategy.name}`,
      strategy.description ? `Description: ${strategy.description}` : null,
      `Symbol: ${symbol.code}`,
      `Timeframe: ${timeframe}`,
      '',
      'Respond with JSON only, for example: {"direction":"BUY","signalType":"ENTRY","confidence":80,"entryPrice":62000,"stopLoss":60000,"takeProfit":65000,"positionSizeRatio":0.15,"reasoning":"text"}',
    ]
      .filter(Boolean)
      .join('\n')

    let attempt = 0
    while (attempt < config.ai.maxAttempts) {
      attempt += 1
      try {
        const result = await this.aiService.chat({
          model: instance.llmModel!,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `${filledPrompt ?? strategy.promptTemplate ?? ''}\n\n${userPrompt}`,
            },
          ],
          temperature: config.ai.temperature,
          maxTokens: config.ai.maxTokens,
        })

        const parsed = parseAiSignalResponse(result.content, referencePrice)
        if (!parsed) {
          this.logger.warn(
            `AI response for strategy ${strategy.id} could not be parsed (attempt ${attempt})`,
          )
          continue
        }

        return {
          ...parsed,
          rawResponse: this.truncateRawResponse(result.content, config),
        }
      } catch (error) {
        this.logger.error(
          `AI request failed for strategy ${strategy.id} (attempt ${attempt}): ${(error as Error).message}`,
        )
      }
    }

    this.logger.warn(`Exceeded AI retry attempts for strategy ${strategy.id}`)
    if (manualTrigger && !isStrictCodegen) {
      return this.buildManualFallbackSignal(referencePrice, strategy.id, symbol.code)
    }
    return null
  }

  private async findCandidateGroups(_strategy: StrategyTemplate, requiredFields: string[]) {
    return this.candidateStage.findCandidateGroups(_strategy, requiredFields)
  }

  private async loadIndicatorSnapshots(
    group: IndicatorGroup,
    requiredFields: string[],
  ): Promise<IndicatorSnapshot[] | null> {
    return this.candidateStage.loadIndicatorSnapshots(group, requiredFields)
  }

  private async loadLatestBar(
    symbolId: string,
    timeframe: PrismaMarketTimeframe,
  ): Promise<GatewayBar | null> {
    return this.candidateStage.loadLatestBar(symbolId, timeframe)
  }

  private async loadRecentBars(
    symbolId: string,
    timeframe: AppMarketTimeframe,
    limit: number = 100,
    options?: {
      requireFinalLatestBar?: boolean
    },
  ): Promise<GatewayBar[] | null> {
    const bars = await this.candidateStage.loadRecentBars(symbolId, timeframe, limit)
    return this.filterLatestGatewayBar(bars ?? [], options)
  }

  private filterLatestGatewayBar(
    bars: readonly GatewayBar[],
    options: {
      requireFinalLatestBar?: boolean
    } = {},
  ): GatewayBar[] {
    if (!options.requireFinalLatestBar || bars.length === 0) {
      return [...bars]
    }

    const latestBar = bars[bars.length - 1]
    if (latestBar.isFinal ?? true) {
      return [...bars]
    }

    return bars.slice(0, -1)
  }

  private normalizeRuntimeBars(
    bars: readonly GatewayBar[],
    options: {
      requireFinalLatestBar?: boolean
    } = {},
  ) {
    const normalizedBars = normalizeGatewayBars(bars)
    if (!options.requireFinalLatestBar || normalizedBars.length === 0) {
      return normalizedBars
    }

    const latestBar = normalizedBars[normalizedBars.length - 1]
    if (latestBar.isFinal) {
      return normalizedBars
    }

    return normalizedBars.slice(0, -1)
  }

  private buildPublishedCodegenSignalPayload(
    promptData: Record<string, unknown>,
    referencePrice: number | undefined,
    strategy: Pick<StrategyTemplate, 'promptTemplate' | 'defaultParams'>,
    instance: Pick<StrategyInstance, 'params'>,
  ): GeneratedSignalPayload | null {
    return this.decisionStage.buildPublishedCodegenSignalPayload(
      promptData,
      referencePrice,
      strategy,
      instance,
      this.getConfig(),
    )
  }

  private buildPublishedCodegenNormalizedSignal(promptData: Record<string, unknown>): AiSignalPayload | null {
    return this.decisionStage.buildPublishedCodegenNormalizedSignal(promptData)
  }

  private truncateRawResponse(
    content: string | undefined,
    config: StrategySignalsRuntimeConfig,
  ): string {
    return this.decisionStage.truncateRawResponse(content, config)
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.decisionStage.asRecord(value)
  }

  private readNumeric(value: unknown): number | undefined {
    return this.decisionStage.readNumeric(value)
  }

  private isStrictPublishedCodegenTemplate(
    strategy: Pick<StrategyTemplate, 'promptTemplate'>,
  ): boolean {
    return this.decisionStage.isStrictPublishedCodegenTemplate(strategy)
  }

  private buildStrictPublishedPromptDataFromDecision(
    decision: StrategyDecisionV1,
    referencePrice: number,
    context?: { currentQty?: number; equity?: number; markPrice?: number },
  ): Record<string, unknown> {
    return this.decisionStage.buildStrictPublishedPromptDataFromDecision(decision, referencePrice, context)
  }

  private buildManualFallbackSignal(
    referencePrice: number | undefined,
    strategyId: string,
    symbolCode: string,
  ): (AiSignalPayload & { rawResponse: string }) | null {
    return this.decisionStage.buildManualFallbackSignal(referencePrice, strategyId, symbolCode)
  }

  private async handleStrategyFailure(
    strategyInstanceId: string,
    config: StrategySignalsRuntimeConfig,
  ) {
    await this.persistenceStage.handleStrategyFailure(strategyInstanceId, config)
  }

  private async resetStrategyFailure(strategyInstanceId: string) {
    await this.persistenceStage.resetStrategyFailure(strategyInstanceId)
  }

  private async isStrategyLocked(strategyInstanceId: string) {
    const state = await this.stateRepository.findByStrategyInstanceId(strategyInstanceId)
    if (!state?.lockedUntil) return false
    return state.lockedUntil > new Date()
  }

  private async processPublishedSnapshotStrategyInstance(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    runtimeProvenance: Prisma.JsonObject,
    executionSemanticKeys: string[],
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
  ) {
    if (!options.skipCooldown && (await this.isStrategyLocked(instance.id))) {
      this.logger.debug(`Strategy instance ${instance.id} cooldown active, skipping generation`)
      return
    }

    const params = this.buildEffectiveParams(strategy, instance) ?? {}
    const symbolCode = this.readString(params.symbol)
    const timeframe = this.readRuntimeTimeframe(params.timeframe ?? params.baseTimeframe)
    if (executionSemanticKeys.length > 0 && !this.runtimeExecutionStateRepository) {
      this.logger.warn(
        `Strategy instance ${instance.id} requires runtime execution state repository for published snapshot execution`,
      )
      return
    }
    const activeRuntimeState = await this.loadPublishedSnapshotRuntimeState(
      instance,
      runtimeProvenance,
      executionSemanticKeys,
    )
    if (executionSemanticKeys.length > 0 && !activeRuntimeState) {
      return
    }

    if (!symbolCode || !timeframe) {
      this.logger.warn(
        `Published snapshot runtime params missing symbol/timeframe for instance ${instance.id}, skipping generation`,
      )
      await this.handleStrategyFailure(instance.id, config)
      await this.markRuntimeExecutionStateFailed(activeRuntimeState, {
        failureReason: 'SNAPSHOT_RUNTIME_PARAMS_MISSING',
        failureCode: 'SNAPSHOT_RUNTIME_PARAMS_MISSING',
      })
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: symbolCode ?? 'N/A',
        success: false,
        reason: 'SNAPSHOT_RUNTIME_PARAMS_MISSING',
      })
      return
    }

    const symbol = await this.generatorRepository.findSymbolByCode(symbolCode)
    if (!symbol) {
      this.logger.warn(`Symbol ${symbolCode} not found for published snapshot runtime on instance ${instance.id}`)
      await this.handleStrategyFailure(instance.id, config)
      await this.markRuntimeExecutionStateFailed(activeRuntimeState, {
        failureReason: 'SYMBOL_NOT_FOUND',
        failureCode: 'SYMBOL_NOT_FOUND',
      })
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode,
        success: false,
        reason: 'SYMBOL_NOT_FOUND',
      })
      return
    }

    const prismaTimeframe = mapTimeframe(timeframe)
    const referenceBar = await this.loadLatestBar(symbol.id, prismaTimeframe)
    const referencePrice = referenceBar ? Number(referenceBar.close) : undefined
    const aiPayload = await this.generateSignalWithAi(
      instance,
      strategy,
      symbol,
      timeframe,
      {},
      config,
      referencePrice,
      options.skipCooldown ?? false,
      this.buildCompiledDecisionStateForRuntimeExecution(activeRuntimeState),
    )

    if (!aiPayload) {
      await this.handleStrategyFailure(instance.id, config)
      await this.markRuntimeExecutionStateFailed(activeRuntimeState, {
        failureReason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
        failureCode: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      })
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode,
        success: false,
        reason: 'SNAPSHOT_SCRIPT_NO_SIGNAL',
      })
      return
    }

    await this.resetStrategyFailure(instance.id)

    const createdSignal = await this.createSignalWithCooldownAndLock(
      instance,
      strategy,
      {
        symbol,
        timeframe: prismaTimeframe,
        fields: new Map(),
      },
      config,
      {},
      referenceBar?.time,
      aiPayload,
      runtimeProvenance,
      options.skipCooldown ?? false,
      activeRuntimeState && this.runtimeExecutionStateRepository
        ? async () => {
            await this.markRuntimeExecutionStateConsumed(activeRuntimeState)
          }
        : undefined,
    )

    if (!createdSignal.created) {
      await this.markRuntimeExecutionStateConsumed(activeRuntimeState)
    }
  }

  private async resolveRuntimeStrategySource(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
  ): Promise<RuntimeStrategySource | null> {
    const binding = this.readSnapshotBinding(instance.metadata)
    const baseProvenance: Prisma.JsonObject = {
      bindingSource: binding.bindingSource ?? 'STRATEGY_TEMPLATE',
      publishedSnapshotId: binding.publishedSnapshotId,
      snapshotHash: binding.snapshotHash,
      sourceStrategyInstanceId: binding.sourceStrategyInstanceId,
      sourceStrategyTemplateId: binding.sourceStrategyTemplateId ?? strategy.id,
      runtimeStrategyInstanceId: instance.id,
      runtimeStrategyTemplateId: strategy.id,
      controlPlaneSource: 'STRATEGY_TEMPLATE',
      executionContentSource: 'STRATEGY_TEMPLATE',
    }

    if (binding.bindingSource !== 'PUBLISHED_SNAPSHOT' || !binding.publishedSnapshotId) {
      return {
        strategy,
        provenance: baseProvenance,
      }
    }

    if (!this.publishedSnapshotsRepository) {
      this.logger.warn(
        `Strategy instance ${instance.id} requires published snapshot ${binding.publishedSnapshotId}, but snapshot repository is unavailable`,
      )
      return null
    }
    if (!this.runtimeExecutionStateService) {
      this.logger.warn(
        `Strategy instance ${instance.id} requires runtime execution state service for published snapshot execution`,
      )
      return null
    }

    const snapshot = await this.publishedSnapshotsRepository.findById(binding.publishedSnapshotId)
    if (!snapshot) {
      this.logger.warn(
        `Strategy instance ${instance.id} is bound to missing published snapshot ${binding.publishedSnapshotId}`,
      )
      return null
    }

    if (binding.snapshotHash && snapshot.snapshotHash !== binding.snapshotHash) {
      this.logger.warn(
        `Strategy instance ${instance.id} snapshot hash mismatch: expected ${binding.snapshotHash}, got ${snapshot.snapshotHash}`,
      )
      return null
    }

    return {
      strategy: {
        ...strategy,
        script: snapshot.scriptSnapshot,
        promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE',
        defaultParams: {
          ...(this.readJsonRecord(snapshot.paramsSnapshot) ?? {}),
          ...(this.readJsonRecord(snapshot.lockedParams) ?? {}),
        } as Prisma.JsonObject,
      },
      provenance: {
        ...baseProvenance,
        publishedSnapshotId: snapshot.id,
        snapshotHash: snapshot.snapshotHash,
        sourceStrategyInstanceId: snapshot.strategyInstanceId ?? binding.sourceStrategyInstanceId,
        sourceStrategyTemplateId: snapshot.strategyTemplateId ?? binding.sourceStrategyTemplateId ?? strategy.id,
        executionContentSource: 'PUBLISHED_SNAPSHOT',
      },
      executionSemanticKeys: this.runtimeExecutionStateService?.buildExecutionSemanticKeysFromSnapshot(snapshot) ?? [],
    }
  }

  private async loadPublishedSnapshotRuntimeState(
    instance: StrategyInstanceWithTemplate,
    runtimeProvenance: Prisma.JsonObject,
    executionSemanticKeys: string[],
  ): Promise<{
    strategyInstanceId: string
    publishedSnapshotId: string
    executionSemanticKey: string
  } | null> {
    if (executionSemanticKeys.length === 0) {
      return null
    }

    if (!this.runtimeExecutionStateService) {
      this.logger.warn(
        `Strategy instance ${instance.id} requires runtime execution state service for published snapshot semantics`,
      )
      return null
    }

    const publishedSnapshotId = this.readString(runtimeProvenance.publishedSnapshotId)
    const snapshotHash = this.readString(runtimeProvenance.snapshotHash)
    if (!publishedSnapshotId || !snapshotHash) {
      this.logger.warn(
        `Strategy instance ${instance.id} is missing published snapshot binding provenance for runtime execution state`,
      )
      return null
    }

    const executableStates = await this.runtimeExecutionStateService.loadExecutableStates({
      strategyInstanceId: instance.id,
      publishedSnapshotId,
      snapshotHash,
    })
    if (!executableStates.length) {
      return null
    }

    const readyState = executableStates.find(state => executionSemanticKeys.includes(state.executionSemanticKey))
    if (!readyState) {
      return null
    }

    return {
      strategyInstanceId: readyState.strategyInstanceId,
      publishedSnapshotId: readyState.publishedSnapshotId,
      executionSemanticKey: readyState.executionSemanticKey,
    }
  }

  private async markRuntimeExecutionStateConsumed(
    activeRuntimeState: {
      strategyInstanceId: string
      publishedSnapshotId: string
      executionSemanticKey: string
    } | null,
  ): Promise<void> {
    if (!activeRuntimeState || !this.runtimeExecutionStateRepository) {
      return
    }

    await this.runtimeExecutionStateRepository.markConsumed({
      strategyInstanceId: activeRuntimeState.strategyInstanceId,
      publishedSnapshotId: activeRuntimeState.publishedSnapshotId,
      executionSemanticKey: activeRuntimeState.executionSemanticKey,
    })
  }

  private async markRuntimeExecutionStateFailed(
    activeRuntimeState: {
      strategyInstanceId: string
      publishedSnapshotId: string
      executionSemanticKey: string
    } | null,
    args: {
      failureReason: string
      failureCode: string
    },
  ): Promise<void> {
    if (!activeRuntimeState || !this.runtimeExecutionStateRepository) {
      return
    }

    await this.runtimeExecutionStateRepository.markFailed({
      strategyInstanceId: activeRuntimeState.strategyInstanceId,
      publishedSnapshotId: activeRuntimeState.publishedSnapshotId,
      executionSemanticKey: activeRuntimeState.executionSemanticKey,
      failureReason: args.failureReason,
      failureCode: args.failureCode,
    })
  }

  private readSnapshotBinding(metadata: unknown): {
    bindingSource: 'PUBLISHED_SNAPSHOT' | 'STRATEGY_TEMPLATE' | null
    publishedSnapshotId: string | null
    snapshotHash: string | null
    sourceStrategyInstanceId: string | null
    sourceStrategyTemplateId: string | null
  } {
    const record = this.asRecord(metadata)
    const rawBindingSource = this.readString(record.bindingSource)
    return {
      bindingSource: rawBindingSource === 'PUBLISHED_SNAPSHOT' ? 'PUBLISHED_SNAPSHOT' : null,
      publishedSnapshotId: this.readString(record.publishedSnapshotId),
      snapshotHash: this.readString(record.snapshotHash),
      sourceStrategyInstanceId: this.readString(record.sourceStrategyInstanceId),
      sourceStrategyTemplateId: this.readString(record.sourceStrategyTemplateId),
    }
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private readRuntimeTimeframe(value: unknown): AppMarketTimeframe | null {
    const normalized = this.readString(value)
    if (!normalized) return null
    const allowed = new Set<AppMarketTimeframe>([
      '1m', '3m', '5m', '15m', '30m', '1h', '4h', '6h', '8h', '12h', '1d', '1w',
    ])
    return allowed.has(normalized as AppMarketTimeframe)
      ? (normalized as AppMarketTimeframe)
      : null
  }

  private readJsonRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }

  private buildEffectiveParams(
    strategy: StrategyTemplate,
    instance: StrategyInstance | StrategyInstanceWithTemplate,
  ): Record<string, unknown> | null {
    return this.decisionStage.buildEffectiveParams(strategy, instance)
  }

  private async loadMultiLegDataBatch(
    legs: StrategyLegDefinition[],
    dataRequirements: StrategyDataRequirements,
  ): Promise<Record<string, Record<string, any>>> {
    return this.candidateStage.loadMultiLegDataBatch(legs, dataRequirements)
  }

  private async generateSignalForMultiLegStrategy(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    execution: StrategyExecutionConfig,
    dataRequirements: StrategyDataRequirements,
    legs: StrategyLegDefinition[],
    primaryLeg: StrategyLegDefinition,
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
    runtimeProvenance: Prisma.JsonObject = {},
  ) {
    // 1. 查找 primary leg 的 symbol
    const primarySymbol = await this.generatorRepository.findSymbolByCode(primaryLeg.symbol)

    if (!primarySymbol) {
      this.logger.warn(`Symbol ${primaryLeg.symbol} not found for strategy ${strategy.id}`)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: 'SYMBOL_NOT_FOUND',
      })
      return
    }

    // 2. 批量加载所有 leg 的数据（性能优化）
    const multiLegData = await this.loadMultiLegDataBatch(legs, dataRequirements)

    // 2.1 校验数据完整性：确保所有 dataRequirements 中定义的数据都已加载
    for (const leg of legs) {
      const requiredTimeframes = dataRequirements[leg.id]
      if (!requiredTimeframes || requiredTimeframes.length === 0) {
        continue
      }

      for (const timeframe of requiredTimeframes) {
        const legData = multiLegData[leg.id]?.[timeframe]

        // 检查数据是否存在
        if (!legData) {
          this.logger.error(
            `Missing data for leg "${leg.id}" timeframe "${timeframe}" in strategy ${strategy.id}. ` +
              `Cannot generate signal with incomplete market context.`,
          )
          await this.handleStrategyFailure(instance.id, config)
          this.telemetry.recordGeneration({
            strategyId: strategy.id,
            symbolCode: leg.symbol,
            success: false,
            reason: 'MISSING_LEG_DATA',
          })
          return
        }

        // 检查 bars 是否为空
        if (!legData.bars || legData.bars.length === 0) {
          this.logger.error(
            `Empty bars for leg "${leg.id}" timeframe "${timeframe}" in strategy ${strategy.id}. ` +
              `Cannot generate signal without market data.`,
          )
          await this.handleStrategyFailure(instance.id, config)
          this.telemetry.recordGeneration({
            strategyId: strategy.id,
            symbolCode: leg.symbol,
            success: false,
            reason: 'EMPTY_LEG_BARS',
          })
          return
        }
      }
    }

    // 3. 构建脚本上下文
    const scriptContext: MultiLegStrategyContext = {
      data: multiLegData,
      execution: {
        timeframe: execution.timeframe,
        cooldownMinutes: execution.cooldownMinutes,
      },
      legs: legs.map(leg => ({
        id: leg.id,
        symbol: leg.symbol,
        role: leg.role,
        description: leg.description,
      })),
      dataRequirements,
      timestamp: Date.now(),
      params: this.buildEffectiveParams(strategy, instance),
    }

    // 4. 执行脚本准备数据
    let promptData: Record<string, any> = {}

    if (!strategy.script) {
      // 新架构必须有脚本
      this.logger.error(
        `Strategy ${strategy.id} is using multi-leg architecture but has no script. ` +
          `Cannot generate signal without data preparation script.`,
      )
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: 'MISSING_SCRIPT',
      })
      return
    }

    const scriptPromptData = await this.decisionStage.resolveMultiLegScriptPromptData(
      strategy,
      execution,
      primaryLeg,
      multiLegData,
      scriptContext,
    )
    if (scriptPromptData.ok === false) {
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: scriptPromptData.reason,
      })
      return
    }
    promptData = scriptPromptData.promptData
    this.logger.debug(`Multi-leg script executed successfully for strategy ${strategy.id}`)

    const primaryTimeframeData = multiLegData[primaryLeg.id]?.[execution.timeframe]

    // 运行时检查：确保主周期数据存在
    if (
      !primaryTimeframeData ||
      !primaryTimeframeData.bars ||
      primaryTimeframeData.bars.length === 0
    ) {
      this.logger.error(
        `Primary leg "${primaryLeg.id}" 缺少 execution.timeframe (${execution.timeframe}) 的数据。` +
          `请检查 dataRequirements 配置是否正确。`,
      )
      // 将缺失主周期数据视为实例级失败，触发冷却，避免实例在每个 tick 上无限重试。
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: 'MISSING_PRIMARY_DATA',
      })
      return
    }

    const referencePrice = primaryTimeframeData.currentPrice

    const directSignal = this.buildPublishedCodegenSignalPayload(
      promptData,
      referencePrice,
      strategy,
      instance,
    )
    const isStrictCodegen = this.isStrictPublishedCodegenTemplate(strategy)
    if (directSignal) {
      if (directSignal.type === 'none') {
        if (isStrictCodegen && directSignal.reason !== 'NO_ACTION') {
          await this.handleStrategyFailure(instance.id, config)
          this.telemetry.recordGeneration({
            strategyId: strategy.id,
            symbolCode: primaryLeg.symbol,
            success: false,
            reason: directSignal.reason || 'STRICT_CODEGEN_SIGNAL_INVALID',
          })
          return
        }
        this.logger.debug(
          `Multi-leg strategy ${strategy.id} direct codegen output requested no action (${directSignal.reason})`,
        )
        return
      }

      await this.resetStrategyFailure(instance.id)

      const signalResult = await this.createMultiLegSignal(
        instance,
        strategy,
        primarySymbol,
        execution,
        promptData,
        directSignal.payload,
        config,
        runtimeProvenance,
        options.skipCooldown ?? false,
      )

      if (!signalResult.created) {
        this.logger.debug(
          `Signal not created for strategy ${strategy.id} on ${primaryLeg.symbol}: ${signalResult.reason || 'COOLDOWN'}`,
        )
        this.telemetry.recordGeneration({
          strategyId: strategy.id,
          symbolCode: primaryLeg.symbol,
          success: false,
          reason: signalResult.reason || 'COOLDOWN',
        })
        return
      }

      this.logger.log(
        `Generated multi-leg signal ${signalResult.signalId} for strategy ${strategy.id} on ${primaryLeg.symbol}`,
      )
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: true,
      })
      return
    }
    if (isStrictCodegen) {
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: 'STRICT_CODEGEN_SIGNAL_INVALID',
      })
      return
    }

    // 5. 填充 prompt 并调用 AI
    const filledPrompt = fillPromptTemplate(strategy.promptTemplate, promptData)

    const systemPrompt =
      'You are a quantitative trading assistant. Analyze the provided market data and respond with a strict JSON object. ' +
      'The JSON must include direction (BUY, SELL, CLOSE_LONG, CLOSE_SHORT), signalType (ENTRY or EXIT), confidence (0-100), ' +
      'entryPrice, stopLoss, takeProfit, and reasoning. ' +
      'You can optionally specify position size: either positionSizeQuote (absolute amount in quote currency like USDT) ' +
      'or positionSizeRatio (fraction of account balance, 0-1). If not specified, system defaults will be used.'

    const userPrompt = [
      `Strategy: ${strategy.name}`,
      strategy.description ? `Description: ${strategy.description}` : null,
      `Primary Symbol: ${primaryLeg.symbol}`,
      `Primary Timeframe: ${execution.timeframe}`,
      '',
      'Respond with JSON only, for example: {"direction":"BUY","signalType":"ENTRY","confidence":80,"entryPrice":62000,"stopLoss":60000,"takeProfit":65000,"positionSizeRatio":0.15,"reasoning":"text"}',
    ]
      .filter(Boolean)
      .join('\n')

    let attempt = 0
    while (attempt < config.ai.maxAttempts) {
      attempt += 1

      // AI 调用和解析（可重试）
      let aiPayload: AiSignalPayload & { rawResponse: string }
      try {
        const result = await this.aiService.chat({
          model: instance.llmModel!,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${filledPrompt}\n\n${userPrompt}` },
          ],
          temperature: config.ai.temperature,
          maxTokens: config.ai.maxTokens,
        })

        const parsed = parseAiSignalResponse(result.content, referencePrice)
        if (!parsed) {
          this.logger.warn(
            `AI response for multi-leg strategy ${strategy.id} could not be parsed (attempt ${attempt})`,
          )
          continue
        }

        aiPayload = {
          ...parsed,
          rawResponse: this.truncateRawResponse(result.content, config),
        }
      } catch (error) {
        this.logger.error(
          `AI request failed for multi-leg strategy ${strategy.id} (attempt ${attempt}): ${(error as Error).message}`,
        )
        continue
      }

      // AI 解析成功，立即重置失败计数器（与单腿路径保持一致）
      await this.resetStrategyFailure(instance.id)

      // 创建信号（数据库操作，不重试，错误应该冒泡）
      const signalResult = await this.createMultiLegSignal(
        instance,
        strategy,
        primarySymbol,
        execution,
        promptData,
        aiPayload,
        config,
        runtimeProvenance,
        options.skipCooldown ?? false,
      )

      // 记录创建结果
      if (!signalResult.created) {
        this.logger.debug(
          `Signal not created for strategy ${strategy.id} on ${primaryLeg.symbol}: ${signalResult.reason || 'COOLDOWN'}`,
        )
        this.telemetry.recordGeneration({
          strategyId: strategy.id,
          symbolCode: primaryLeg.symbol,
          success: false,
          reason: signalResult.reason || 'COOLDOWN',
        })
        return
      }

      this.logger.log(
        `Generated multi-leg signal ${signalResult.signalId} for strategy ${strategy.id} on ${primaryLeg.symbol}`,
      )
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: true,
      })
      return
    }

    this.logger.warn(`Exceeded AI retry attempts for multi-leg strategy ${strategy.id}`)
    if (options.skipCooldown) {
      const fallback = this.buildManualFallbackSignal(
        referencePrice,
        strategy.id,
        primaryLeg.symbol,
      )
      if (fallback) {
        await this.resetStrategyFailure(instance.id)
        const signalResult = await this.createMultiLegSignal(
          instance,
          strategy,
          primarySymbol,
          execution,
          promptData,
          fallback,
          config,
          runtimeProvenance,
          options.skipCooldown ?? false,
        )
        if (signalResult.created && signalResult.signalId) {
          this.logger.warn(
            `AI failed for strategy ${strategy.id}, created manual fallback signal ${signalResult.signalId}`,
          )
          this.telemetry.recordGeneration({
            strategyId: strategy.id,
            symbolCode: primaryLeg.symbol,
            success: true,
          })
          return
        }
      }
    }
    await this.handleStrategyFailure(instance.id, config)
    this.telemetry.recordGeneration({
      strategyId: strategy.id,
      symbolCode: primaryLeg.symbol,
      success: false,
      reason: 'AI_FAILURE',
    })
  }

  private async createMultiLegSignal(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    primarySymbol: Symbol,
    execution: StrategyExecutionConfig,
    indicators: Record<string, any>,
    aiPayload: AiSignalPayload & { rawResponse: string },
    config: StrategySignalsRuntimeConfig,
    runtimeProvenance: Prisma.JsonObject,
    skipCooldown = false,
  ): Promise<{ created: boolean; signalId: string | null; reason?: string }> {
    return this.persistenceStage.createMultiLegSignal(
      instance,
      strategy,
      primarySymbol,
      execution,
      indicators,
      aiPayload,
      config,
      runtimeProvenance,
      skipCooldown,
    )
  }

  private buildDecisionContext(
    indicators: Record<string, unknown>,
    markPrice: number | undefined,
  ): { currentQty?: number; equity?: number; markPrice?: number } {
    return this.decisionStage.buildDecisionContext(indicators, markPrice)
  }

  private buildCompiledDecisionStateForRuntimeExecution(
    activeRuntimeState: { executionSemanticKey: string } | null,
  ): { barIndex: number; lastTriggeredByProgram: Record<string, number> } | undefined {
    if (!activeRuntimeState) return undefined

    if (activeRuntimeState.executionSemanticKey.startsWith('on_start.')) {
      return {
        barIndex: 1,
        lastTriggeredByProgram: {},
      }
    }

    return undefined
  }

  private requiresExplicitDecisionContext(decision: StrategyDecisionV1): boolean {
    return this.decisionStage.requiresExplicitDecisionContext(decision)
  }

  private hasExplicitDecisionContext(context: {
    currentQty?: number
    equity?: number
    markPrice?: number
  }): context is { currentQty: number; equity: number; markPrice: number } {
    return this.decisionStage.hasExplicitDecisionContext(context)
  }
}
