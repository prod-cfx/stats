import type { AiSignalPayload } from '@ai/shared'
import type { LegTimeframeData, MultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition } from '@/modules/strategy-templates/types/strategy-template.types'
import type {
  IndicatorConfig,
  MarketBar,
  MarketTimeframe,
  Prisma,
  SignalSourceType,
  SignalStatus,
  StrategyInstance,
  StrategyTemplate,
  Symbol,
} from '@/prisma/prisma.types'
import { fillPromptTemplate, parseAiSignalResponse } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildMultiLegStrategyContext, buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 ConfigService
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
import { mapTimeframe, reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AiService } from '@/modules/ai/ai.service'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
import { StrategySignalEvents } from '../constants/strategy-signal.constants'
import { TradingSignalCreatedEvent } from '../events/strategy-signal.events'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategySignalStateRepository } from '../repositories/strategy-signal-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingSignalRepository } from '../repositories/trading-signal.repository'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { ScriptDebugUtil } from '../utils/script-debug.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalTelemetryService } from './signal-telemetry.service'

interface IndicatorGroup {
  symbol: Symbol
  timeframe: MarketTimeframe
  fields: Map<string, IndicatorConfig>
}

interface IndicatorSnapshot {
  field: string
  value: number
  recordedAt: Date
}

const DEFAULT_RAW_RESPONSE_LIMIT = 4000
const DEFAULT_BAR_LIMIT = 100
const MAX_SCRIPT_TIMEOUT_MS = 5000

type StrategyInstanceWithTemplate = Prisma.StrategyInstanceGetPayload<{
  include: {
    strategyTemplate: true
  }
}>

@Injectable()
export class SignalGeneratorService {
  private readonly logger = new Logger(SignalGeneratorService.name)
  private readonly cronJobName = 'strategy-signals.generate'
  private cronJob?: CronJob
  private isRunning = false
  private lastStrategyIndex = 0
  /**
   * 记录每个策略实例在 candidateGroups 中的轮询位置，
   * 避免多个实例共享同一模板的指针导致各自只覆盖一部分标的。
   */
  private readonly lastGroupIndexByInstance = new Map<string, number>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly aiService: AiService,
    private readonly tradingSignalRepository: TradingSignalRepository,
    private readonly stateRepository: StrategySignalStateRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly telemetry: SignalTelemetryService,
  ) {
    this.registerCronJob()
  }

  private registerCronJob() {
    const config = this.getConfig()
    if (this.cronJob) {
      this.cronJob.stop()
      this.schedulerRegistry.deleteCronJob(this.cronJobName)
    }

    // 使用带错误兜底的回调，避免 runGenerationCycle 中的异常变成未捕获拒绝导致进程崩溃
    this.cronJob = new CronJob(config.cronExpression, async () => {
      try {
        await this.runGenerationCycle()
      }
      catch (error) {
        const detail = error instanceof Error ? error.stack ?? error.message : String(error)
        this.logger.error(`Signal generation cron tick failed: ${detail}`)
      }
    })
    this.schedulerRegistry.addCronJob(this.cronJobName, this.cronJob)
    this.cronJob.start()
    this.logger.log(`Strategy signal generator scheduled with cron ${config.cronExpression}`)
  }

  private async runGenerationCycle() {
    const config = this.getConfig()
    if (!config.enabled) return

    if (this.isRunning) {
      this.logger.warn('Signal generator is still running from the previous cycle, skipping this tick')
      return
    }

    this.isRunning = true
    try {
      await this.generateSignals(config)
    }
    finally {
      this.isRunning = false
    }
  }

  async generateSignals(
    config: StrategySignalsRuntimeConfig = this.getConfig(),
    options: { skipCooldown?: boolean } = {}
  ) {
    if (!config.enabled) {
      this.logger.debug('Strategy signal generation is disabled via configuration')
      return
    }

    // 以“策略实例”为单位生成信号：
    // - 只处理 status='running' 且 mode='LIVE' 的实例
    // - 底层模板必须为 status='live'
    const instances = await this.prisma.strategyInstance.findMany({
      where: {
        status: 'running',
        mode: 'LIVE',
        strategyTemplate: {
          status: 'live',
        },
      },
      // 使用稳定的排序（按 id），配合 lastStrategyIndex 实现轮询，而非永远只处理最新的一批
      orderBy: { id: 'asc' },
      include: {
        strategyTemplate: true,
      },
    })

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
      }
      catch (error) {
        this.logger.error(
          `Failed to process strategy instance ${instance.id}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }

    this.lastStrategyIndex = (this.lastStrategyIndex + batchSize) % total
  }

  private getConfig(): StrategySignalsRuntimeConfig {
    return this.configService.get<StrategySignalsRuntimeConfig>('strategySignals') ?? DEFAULT_STRATEGY_SIGNALS_CONFIG
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
      throw new Error('Strategy signal generation is disabled via configuration (STRATEGY_SIGNALS_ENABLED=false)')
    }

    // 查询指定的策略实例
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: instanceId },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${instanceId} not found`)
    }

    // 验证实例状态
    if (instance.status !== 'running') {
      throw new Error(`Strategy instance ${instanceId} is not running (status: ${instance.status})`)
    }

    if (instance.mode !== 'LIVE') {
      throw new Error(`Strategy instance ${instanceId} is not in LIVE mode (mode: ${instance.mode})`)
    }

    if (!instance.strategyTemplate) {
      throw new Error(`Strategy instance ${instanceId} has no linked template`)
    }

    if (instance.strategyTemplate.status !== 'live') {
      throw new Error(
        `Strategy template for instance ${instanceId} is not live (status: ${instance.strategyTemplate.status})`
      )
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
    options: { skipCooldown?: boolean } = {}
  ): Promise<void> {
    const config = this.getConfig()
    
    if (!config.enabled) {
      this.logger.debug('Strategy signal generation is disabled via configuration')
      return
    }

    // 查询指定的策略实例
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: instanceId },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${instanceId} not found`)
    }

    // 验证实例状态
    if (instance.status !== 'running') {
      throw new Error(`Strategy instance ${instanceId} is not running (status: ${instance.status})`)
    }

    if (instance.mode !== 'LIVE') {
      throw new Error(`Strategy instance ${instanceId} is not in LIVE mode (mode: ${instance.mode})`)
    }

    if (!instance.strategyTemplate) {
      throw new Error(`Strategy instance ${instanceId} has no linked template`)
    }

    if (instance.strategyTemplate.status !== 'live') {
      throw new Error(
        `Strategy template for instance ${instanceId} is not live (status: ${instance.strategyTemplate.status})`
      )
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
    const nodeEnv = process.env.NODE_ENV || 'development'
    
    // 生产环境必须显式启用调试，开发环境默认启用
    if (nodeEnv === 'production') {
      return config.debug?.enabled === true
    }
    
    return config.debug?.enabled !== false
  }

  /**
   * 记录脚本执行的调试信息
   */
  private logScriptDebug(strategy: StrategyTemplate, result?: { success: boolean; value?: any; error?: any }) {
    if (!this.isDebugEnabled()) return

    const config = this.getConfig()
    const maxScriptLength = config.debug?.maxScriptLength ?? 1000
    const maxValueLength = config.debug?.maxValueLength ?? 200

    // 记录脚本内容
    this.logger.debug(
      `[Script Debug] Strategy ${strategy.id} script:\n` +
      `${ScriptDebugUtil.formatScriptForLog(strategy.script, maxScriptLength)}\n` +
      `[End Script]`
    )

    // 如果提供了执行结果，记录结果
    if (result) {
      this.logger.debug(
        `[Script Debug] Strategy ${strategy.id} result: ` +
        `success=${result.success}, ` +
        `valueType=${typeof result.value}, ` +
        `value=${ScriptDebugUtil.formatValueForLog(result.value, maxValueLength)}`
      )
    }
  }

  private async processStrategyInstance(
    instance: StrategyInstanceWithTemplate,
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {}
  ) {
    const strategy = instance.strategyTemplate
    if (!strategy) {
      this.logger.warn(`Strategy instance ${instance.id} has no linked template, skipping signal generation`)
      return
    }

    // 检查策略是否使用新架构（有 execution 和 dataRequirements）
    const execution = strategy.execution as unknown as StrategyExecutionConfig | null | undefined
    const dataRequirements = strategy.dataRequirements as unknown as StrategyDataRequirements | null | undefined
    const legs = strategy.legs as unknown as StrategyLegDefinition[] | null | undefined
    
    if (execution && dataRequirements && legs && legs.length > 0) {
      // 新架构：使用 legs 和 dataRequirements
      return this.processStrategyWithLegsForInstance(instance, strategy, execution, dataRequirements, legs, config, options)
    }
    
    // 旧架构：使用 requiredFields
    const requiredFields = strategy.requiredFields as string[] | null
    if (!requiredFields?.length) {
      this.logger.debug(`Strategy ${strategy.id} has no required fields or legs, skipping signal generation`)
      return
    }

    if (!instance.llmModel || !strategy.promptTemplate) {
      this.logger.debug(
        `Strategy ${strategy.id} / instance ${instance.id} lacks llmModel or promptTemplate, skipping`,
      )
      return
    }

    if (!options.skipCooldown && await this.isStrategyLocked(instance.id)) {
      this.logger.debug(`Strategy instance ${instance.id} cooldown active, skipping generation`)
      return
    }

    const candidateGroups = await this.findCandidateGroups(strategy, requiredFields)
    if (!candidateGroups.length) {
      this.logger.debug(`Strategy ${strategy.id} has no indicator groups covering required fields`)
      this.telemetry.recordGeneration({ strategyId: strategy.id, symbolCode: 'N/A', success: false, reason: 'MISSING_INDICATORS' })
      return
    }

    const totalGroups = candidateGroups.length
    const maxPerTick = Math.min(config.maxSymbolsPerStrategy, totalGroups)
    if (maxPerTick <= 0) {
      this.logger.debug(`Strategy ${strategy.id} has non-positive maxSymbolsPerStrategy, skipping`)
      return
    }

    // 轮询指针改为按实例维度独立维护，避免多个实例“分食”同一模板的标的集合。
    const lastGroupIndex = this.lastGroupIndexByInstance.get(instance.id) ?? 0

    for (let i = 0; i < maxPerTick; i += 1) {
      const index = (lastGroupIndex + i) % totalGroups
      const group = candidateGroups[index]!
      try {
        await this.generateSignalForGroup(instance, strategy, group, requiredFields, config, options)
      }
      catch (error) {
        this.logger.error(
          `Failed to generate signal for strategy ${strategy.id} / instance ${instance.id} and symbol ${group.symbol.code}: ${(error as Error).message}`,
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
    options: { skipCooldown?: boolean } = {}
  ) {
    if (!instance.llmModel || !strategy.promptTemplate) {
      this.logger.debug(
        `Strategy ${strategy.id} / instance ${instance.id} lacks llmModel or promptTemplate, skipping`,
      )
      return
    }

    if (!options.skipCooldown && await this.isStrategyLocked(instance.id)) {
      this.logger.debug(`Strategy instance ${instance.id} cooldown active, skipping generation`)
      return
    }

    // 找到 primary leg
    const primaryLeg = legs.find(leg => leg.role === 'primary')
    if (!primaryLeg) {
      this.logger.warn(`Strategy ${strategy.id} has no primary leg, skipping for instance ${instance.id}`)
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
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
  ) {
    const snapshots = await this.loadIndicatorSnapshots(group, requiredFields)
    if (!snapshots) {
      this.logger.debug(`Unable to load indicator snapshots for strategy ${strategy.id} on ${group.symbol.code}`)
      this.telemetry.recordGeneration({ strategyId: strategy.id, symbolCode: group.symbol.code, success: false, reason: 'SNAPSHOT_MISSING' })
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
      group.timeframe,
      indicatorValues,
      config,
      referencePrice,
    )
    if (!aiPayload) {
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({ strategyId: strategy.id, symbolCode: group.symbol.code, success: false, reason: 'AI_FAILURE' })
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
    skipCooldown = false,
  ) {
    const cooldownSince = new Date(Date.now() - config.cooldownMinutes * 60 * 1000)

    const result = await this.prisma.$transaction(async prisma => {
      // 对当前策略实例行加锁，避免同一实例并发通过冷却检查后重复创建信号
      await prisma.$queryRaw`
        SELECT "id"
        FROM "strategy_instances"
        WHERE "id" = ${instance.id}
        FOR UPDATE
      `

      // 手动触发时允许跳过 cooldown 检查，确保管理员能够强制生成信号
      if (!skipCooldown) {
        const existingCount = await prisma.tradingSignal.count({
          where: {
            strategyId: strategy.id,
            symbolId: group.symbol.id,
            createdAt: {
              gte: cooldownSince,
            },
            // 兼容历史数据：strategyInstanceId 为空的旧信号也视为命中冷却窗口，
            // 避免在数据尚未完全回填前生成重复信号。
            OR: [
              { strategyInstanceId: instance.id },
              { strategyInstanceId: null },
            ],
          },
        })

        if (existingCount > 0) {
          return { created: false as const, signalId: null as string | null }
        }
      }

      const data: Prisma.TradingSignalCreateInput = {
        strategy: { connect: { id: strategy.id } },
        strategyInstance: { connect: { id: instance.id } },
        symbol: { connect: { id: group.symbol.id } },
        sourceType: 'AI_GENERATED' satisfies SignalSourceType,
        signalType: aiPayload.signalType,
        direction: aiPayload.direction,
        status: 'PENDING' satisfies SignalStatus,
        confidence: aiPayload.confidence,
        entryPrice: aiPayload.entryPrice,
        stopLoss: aiPayload.stopLoss,
        takeProfit: aiPayload.takeProfit,
        positionSizeQuote: aiPayload.positionSizeQuote,
        positionSizeRatio: aiPayload.positionSizeRatio,
        aiModel: instance.llmModel,
        aiReasoning: aiPayload.reasoning,
        aiRawResponse: aiPayload.rawResponse,
        marketContext: {
          timeframe: reverseMapTimeframe(group.timeframe as any),  // 转换为应用层格式 "1m"
          indicatorTimestamp: latestIndicatorTime?.toISOString() ?? null,
          indicators: indicatorValues,
        } satisfies Prisma.JsonValue,
        metadata: {
          generatorVersion: 'v1',
        },
      }

      const signal = await prisma.tradingSignal.create({
        data,
      })

      return { created: true as const, signalId: signal.id }
    })

    if (!result.created || !result.signalId) {
      this.logger.debug(
        `Recent signal already exists for strategy ${strategy.id} on ${group.symbol.code}, skipping due to cooldown`,
      )
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: group.symbol.code,
        success: false,
        reason: 'COOLDOWN',
      })
      return
    }

    this.logger.log(`Generated signal ${result.signalId} for strategy ${strategy.id} on ${group.symbol.code}`)
    this.telemetry.recordGeneration({ strategyId: strategy.id, symbolCode: group.symbol.code, success: true })
    this.eventEmitter.emit(StrategySignalEvents.CREATED, new TradingSignalCreatedEvent(result.signalId))
  }

  private async generateSignalWithAi(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    symbol: Symbol,
    timeframe: MarketTimeframe,
    indicators: Record<string, number>,
    config: StrategySignalsRuntimeConfig,
    referencePrice?: number,
  ): Promise<(AiSignalPayload & { rawResponse: string }) | null> {
    // 准备填充 prompt 模板的数据
    let promptData: Record<string, any> = {}
    
    // 如果策略有脚本，执行脚本准备数据
    if (strategy.script) {
      try {
        const engine = createScriptEngine()
        
        // 构建脚本执行上下文
        const marketBars = await this.loadRecentBars(symbol.id, timeframe, DEFAULT_BAR_LIMIT)
        // 转换 MarketBar 到 Bar 类型
        const bars = marketBars ? marketBars.map(bar => ({
          open: Number(bar.open),
          high: Number(bar.high),
          low: Number(bar.low),
          close: Number(bar.close),
          volume: Number(bar.volume),
          timestamp: bar.time.getTime(),
        })) : []
        
        const scriptContext = buildStrategyContext({
          bars,
          symbol: symbol.code,
          timeframe,
          indicators,
          currentPrice: referencePrice || 0,
          timestamp: Date.now(),
          params: this.buildEffectiveParams(strategy, instance),
        })
        
        // 执行脚本 - 智能重试机制
        // 优先用标准模式（新脚本：最后表达式作为返回值）
        let result = await engine.execute(strategy.script, {
          context: scriptContext,
          timeout: MAX_SCRIPT_TIMEOUT_MS,
          allowAsync: false,
        })
        
        // 检测到需要 async 上下文的语法错误，用 allowAsync 重试（旧脚本兼容）
        // 包括：顶层 return、顶层 await 等
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
            result = await engine.execute(strategy.script, {
              context: scriptContext,
              timeout: MAX_SCRIPT_TIMEOUT_MS,
              allowAsync: true,
            })
          }
        }
        
        if (result.success) {
          // 始终调用 validateScriptOutput，即使 result.value 为 undefined
          // 这样可以提供一致的错误提示，与调试接口和多leg路径保持一致
          const validation = validateScriptOutput(result.value, { allowEmpty: true })
          
          if (!validation.valid || !validation.value) {
            this.logger.warn(
              `Script for strategy ${strategy.id} returned invalid data. ` +
              `Reason: ${validation.error ?? 'Unknown validation error'}. ` +
              `Using indicators as fallback.`,
            )
            promptData = indicators
          }
          else {
            promptData = validation.value as Record<string, any>
            this.logger.debug(
              `Script executed successfully for strategy ${strategy.id}, data: ${JSON.stringify(promptData)}`,
            )
          }
        }
        else {
          this.logger.warn(`Script execution failed for strategy ${strategy.id}: ${result.error?.message}`)
          // 脚本执行失败时，使用原始指标数据作为后备
          promptData = indicators
        }
      } catch (error) {
        this.logger.error(`Error executing script for strategy ${strategy.id}: ${(error as Error).message}`)
        // 出错时使用原始指标数据
        promptData = indicators
      }
    } else {
      // 没有脚本时，直接使用指标数据
      promptData = indicators
    }
    
    // 填充 prompt 模板中的占位符（使用 shared helper，保证与调试接口一致）
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
          this.logger.warn(`AI response for strategy ${strategy.id} could not be parsed (attempt ${attempt})`)
          continue
        }

        return {
          ...parsed,
          rawResponse: this.truncateRawResponse(result.content, config),
        }
      }
      catch (error) {
        this.logger.error(`AI request failed for strategy ${strategy.id} (attempt ${attempt}): ${(error as Error).message}`)
      }
    }

    this.logger.warn(`Exceeded AI retry attempts for strategy ${strategy.id}`)
    return null
  }

  private async findCandidateGroups(strategy: StrategyTemplate, requiredFields: string[]) {
    if (!requiredFields.length) return []

    const configs = await this.prisma.indicatorConfig.findMany({
      where: {
        name: { in: requiredFields },
        isEnabled: true,
      },
      include: {
        symbol: true,
      },
    })

    const groups = new Map<string, IndicatorGroup>()

    for (const config of configs) {
      const key = `${config.symbolId}:${config.timeframe}`
      if (!groups.has(key)) {
        groups.set(key, {
          symbol: config.symbol,
          timeframe: config.timeframe,
          fields: new Map(),
        })
      }
      groups.get(key)?.fields.set(config.name, config)
    }

    return Array.from(groups.values()).filter(group => requiredFields.every(field => group.fields.has(field)))
  }

  private async loadIndicatorSnapshots(group: IndicatorGroup, requiredFields: string[]): Promise<IndicatorSnapshot[] | null> {
    const configIds = requiredFields
      .map(field => group.fields.get(field)?.id)
      .filter((id): id is string => Boolean(id))

    if (configIds.length !== requiredFields.length) {
      return null
    }

    const grouped = await this.prisma.indicatorValue.groupBy({
      by: ['indicatorConfigId'],
      where: {
        indicatorConfigId: { in: configIds },
      },
      _max: { time: true },
    })

    if (!grouped.length) return null

    const latestRecords = await this.prisma.indicatorValue.findMany({
      where: {
        OR: grouped
          .filter(item => item._max.time)
          .map(item => ({ indicatorConfigId: item.indicatorConfigId, time: item._max.time as Date })),
      },
      orderBy: { time: 'desc' },
    })

    const result: IndicatorSnapshot[] = []
    for (const field of requiredFields) {
      const config = group.fields.get(field)
      if (!config) return null
      const match = latestRecords.find(value => value.indicatorConfigId === config.id)
      if (!match || match.valueNumeric === null) return null

      const numeric = Number(match.valueNumeric)
      if (!Number.isFinite(numeric)) return null

      result.push({ field, value: numeric, recordedAt: match.time })
    }

    return result
  }

  private async loadLatestBar(symbolId: string, timeframe: MarketTimeframe): Promise<MarketBar | null> {
    return this.prisma.marketBar.findFirst({
      where: { symbolId, timeframe },
      orderBy: { time: 'desc' },
    })
  }

  private async loadRecentBars(
    symbolId: string,
    timeframe: MarketTimeframe,
    limit: number = 100,
  ): Promise<MarketBar[] | null> {
    try {
      const bars = await this.prisma.marketBar.findMany({
        where: { symbolId, timeframe },
        orderBy: { time: 'desc' },
        take: limit,
      })
      // 返回时间升序的结果（最旧的在前）
      return bars.reverse()
    } catch (error) {
      this.logger.error(`Failed to load recent bars: ${(error as Error).message}`)
      return null
    }
  }

  private truncateRawResponse(content: string | undefined, config: StrategySignalsRuntimeConfig): string {
    if (!content) return ''
    const limit = config.ai.maxRawResponseLength ?? DEFAULT_RAW_RESPONSE_LIMIT
    if (content.length <= limit) return content
    return `${content.slice(0, limit)}...`
  }

  private async isStrategyLocked(strategyInstanceId: string) {
    const state = await this.stateRepository.findByStrategyInstanceId(strategyInstanceId)
    if (!state?.lockedUntil) return false
    return state.lockedUntil > new Date()
  }

  private async handleStrategyFailure(strategyInstanceId: string, config: StrategySignalsRuntimeConfig) {
    const state = await this.stateRepository.findByStrategyInstanceId(strategyInstanceId)
    const nextFailures = (state?.consecutiveFailures ?? 0) + 1

    if (nextFailures >= config.ai.maxFailuresBeforeCooldown) {
      const lockedUntil = new Date(Date.now() + config.ai.failureCooldownMinutes * 60 * 1000)
      await this.stateRepository.incrementFailure(strategyInstanceId, { lockedUntil, reset: true })
      this.logger.warn(`Strategy instance ${strategyInstanceId} entered cooldown until ${lockedUntil.toISOString()}`)
      return
    }

    await this.stateRepository.incrementFailure(strategyInstanceId)
  }

  private async resetStrategyFailure(strategyInstanceId: string) {
    await this.stateRepository.reset(strategyInstanceId)
  }

  /**
   * 计算当前实例下脚本可用的参数：
   * - 模板 defaultParams 作为基础
   * - 实例 params 覆盖同名字段
   */
  private buildEffectiveParams(
    strategy: StrategyTemplate,
    instance: StrategyInstance | StrategyInstanceWithTemplate,
  ): Record<string, unknown> | null {
    const templateParams = strategy.defaultParams as Record<string, unknown> | null | undefined
    const instanceParams = instance.params as Record<string, unknown> | null | undefined

    const isObject = (value: unknown): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value)

    const base = isObject(templateParams) ? templateParams : undefined
    const override = isObject(instanceParams) ? instanceParams : undefined

    if (!base && !override) return null

    return {
      ...(base ?? {}),
      ...(override ?? {}),
    }
  }

  /**
   * 批量加载多 Leg 策略的所有数据（性能优化）
   */
  private async loadMultiLegDataBatch(
    legs: StrategyLegDefinition[],
    dataRequirements: StrategyDataRequirements,
  ): Promise<Record<string, Record<string, LegTimeframeData>>> {
    // 1. 批量加载所有 symbols
    const symbolCodes = legs.map(leg => leg.symbol)
    const symbols = await this.prisma.symbol.findMany({
      where: { code: { in: symbolCodes } },
    })
    const symbolMap = new Map(symbols.map(s => [s.code, s]))
    
    // 2. 收集所有需要加载的 (legId, symbolId, timeframe) 组合
    interface DataRequest {
      legId: string
      symbolId: string
      timeframe: MarketTimeframe  // Prisma 枚举格式（如 'h1'）
      originalTimeframe: string   // 应用层格式（如 '1h'）
    }
    
    const dataRequests: DataRequest[] = []
    for (const leg of legs) {
      const symbol = symbolMap.get(leg.symbol)
      if (!symbol) {
        this.logger.warn(`Symbol ${leg.symbol} not found for leg ${leg.id}`)
        continue
      }
      
      const timeframes = dataRequirements[leg.id]
      if (!timeframes || timeframes.length === 0) {
        this.logger.warn(`No timeframes defined for leg ${leg.id}`)
        continue
      }
      
      // 将应用层时间周期映射为 Prisma 枚举
      for (const tf of timeframes) {
        dataRequests.push({ 
          legId: leg.id, 
          symbolId: symbol.id, 
          timeframe: mapTimeframe(tf as any),  // 从应用层 '1h' 转换为 Prisma 'h1'
          originalTimeframe: tf,  // 保留原始应用层格式用于返回
        })
      }
    }
    
    // 3. 并行加载所有 bars 数据
    const barsPromises = dataRequests.map(async req => {
      const bars = await this.loadRecentBars(req.symbolId, req.timeframe, DEFAULT_BAR_LIMIT)
      return { ...req, bars }
    })
    
    const allBarsData = await Promise.all(barsPromises)
    
    // 4. 构建结果
    const result: Record<string, Record<string, LegTimeframeData>> = {}
    
    for (const data of allBarsData) {
      if (!result[data.legId]) {
        result[data.legId] = {}
      }
      
      const bars = data.bars ? data.bars.map(bar => ({
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume),
        timestamp: bar.time.getTime(),
      })) : []
      
      const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : 0
      
      // TODO: 加载指标数据（需要扩展 IndicatorConfig 以支持按 leg 查询）
      const indicators: Record<string, number> = {}
      
      // 使用应用层格式作为 key（如 '1h'）
      result[data.legId][data.originalTimeframe] = {
        bars,
        indicators,
        currentPrice,
      }
    }
    
    return result
  }

  /**
   * 为使用新架构的多 Leg 策略生成信号
   */
  private async generateSignalForMultiLegStrategy(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    execution: StrategyExecutionConfig,
    dataRequirements: StrategyDataRequirements,
    legs: StrategyLegDefinition[],
    primaryLeg: StrategyLegDefinition,
    config: StrategySignalsRuntimeConfig,
    options: { skipCooldown?: boolean } = {},
  ) {
    // 1. 查找 primary leg 的 symbol
    const primarySymbol = await this.prisma.symbol.findUnique({
      where: { code: primaryLeg.symbol },
    })
    
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
    
    try {
      const engine = createScriptEngine()
      const ctx = buildMultiLegStrategyContext(scriptContext)
      
      // 调试日志：打印脚本内容（仅在启用调试时）
      this.logScriptDebug(strategy)
      
      // 智能重试机制：优先标准模式，遇到需要 async 上下文的语法错误则用 allowAsync 重试
      let result = await engine.execute(strategy.script, {
        context: ctx,
        timeout: MAX_SCRIPT_TIMEOUT_MS,
        allowAsync: false,
      })
      
      // 调试日志：打印执行结果（仅在启用调试时）
      this.logScriptDebug(strategy, result)
      
      // 检测到需要 async 上下文的语法错误，用 allowAsync 重试（旧脚本兼容）
      // 包括：顶层 return、顶层 await 等
      if (!result.success && result.error?.message) {
        const errorMsg = result.error.message
        const needsAsync = 
          errorMsg.includes('Illegal return statement') ||
          errorMsg.includes('await is only valid in async functions') ||
          errorMsg.includes('Unexpected reserved word')
        
        if (needsAsync) {
          this.logger.warn(
            `Multi-leg strategy ${strategy.id} script needs async context (${errorMsg}), retrying with allowAsync`,
          )
          result = await engine.execute(strategy.script, {
            context: ctx,
            timeout: MAX_SCRIPT_TIMEOUT_MS,
            allowAsync: true,
          })
        }
      }
      
      // 脚本引擎执行失败（语法错误等）
      if (!result.success) {
        this.logger.error(
          `Multi-leg script execution failed for strategy ${strategy.id}: ${result.error?.message || 'Unknown error'}. ` +
          `Cannot generate signal without valid prompt data.`,
        )
        await this.handleStrategyFailure(instance.id, config)
        this.telemetry.recordGeneration({
          strategyId: strategy.id,
          symbolCode: primaryLeg.symbol,
          success: false,
          reason: 'SCRIPT_EXECUTION_FAILED',
        })
        return
      }

      const rawValue = result.value

      // 只接受"普通对象"作为脚本结果，防止字符串/数组等类型导致后续 fillPromptTemplate 报错
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        // 使用工具函数安全地序列化实际返回值
        const config = this.getConfig()
        const maxValueLength = config.debug?.maxValueLength ?? 200
        const valuePreview = ScriptDebugUtil.formatValueForLog(rawValue, maxValueLength)

        this.logger.error(
          `Multi-leg script for strategy ${strategy.id} returned non-object value (type: ${typeof rawValue}). ` +
          `Cannot generate signal without an object of prompt variables.\n` +
          `Actual value: ${valuePreview}`,
        )
        await this.handleStrategyFailure(instance.id, config)
        this.telemetry.recordGeneration({
          strategyId: strategy.id,
          symbolCode: primaryLeg.symbol,
          success: false,
          reason: 'INVALID_SCRIPT_RESULT',
        })
        return
      }
      
      // 脚本执行成功，但需要校验返回值（即使为 undefined）
      // 与单 Leg 路径和调试接口保持一致，提供结构化的错误信息
      const validation = validateScriptOutput(result.value, { allowEmpty: false })
      
      if (!validation.valid || !validation.value) {
        const reason =
          validation.code === 'EMPTY_OBJECT'
            ? 'EMPTY_SCRIPT_DATA'
            : 'INVALID_SCRIPT_RETURN_TYPE'

        this.logger.error(
          `Multi-leg script for strategy ${strategy.id} returned invalid data. ` +
          `Reason: ${validation.error ?? 'Unknown validation error'}. ` +
          `Cannot generate signal without valid prompt data.`,
        )
        await this.handleStrategyFailure(instance.id, config)
        this.telemetry.recordGeneration({
          strategyId: strategy.id,
          symbolCode: primaryLeg.symbol,
          success: false,
          reason,
        })
        return
      }
      
      promptData = validation.value as Record<string, any>
      
      this.logger.debug(`Multi-leg script executed successfully for strategy ${strategy.id}`)
    } catch (error) {
      this.logger.error(
        `Error executing multi-leg script for strategy ${strategy.id}: ${(error as Error).message}. ` +
        `Cannot generate signal.`,
      )
      await this.handleStrategyFailure(instance.id, config)
      this.telemetry.recordGeneration({
        strategyId: strategy.id,
        symbolCode: primaryLeg.symbol,
        success: false,
        reason: 'SCRIPT_ERROR',
      })
      return
    }
    
    // 5. 填充 prompt 并调用 AI
    const filledPrompt = fillPromptTemplate(strategy.promptTemplate, promptData)
    
    const primaryTimeframeData = multiLegData[primaryLeg.id]?.[execution.timeframe]
    
    // 运行时检查：确保主周期数据存在
    if (!primaryTimeframeData || !primaryTimeframeData.bars || primaryTimeframeData.bars.length === 0) {
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
          this.logger.warn(`AI response for multi-leg strategy ${strategy.id} could not be parsed (attempt ${attempt})`)
          continue
        }

        aiPayload = {
          ...parsed,
          rawResponse: this.truncateRawResponse(result.content, config),
        }
      }
      catch (error) {
        this.logger.error(`AI request failed for multi-leg strategy ${strategy.id} (attempt ${attempt}): ${(error as Error).message}`)
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
      
      this.logger.log(`Generated multi-leg signal ${signalResult.signalId} for strategy ${strategy.id} on ${primaryLeg.symbol}`)
      this.telemetry.recordGeneration({ strategyId: strategy.id, symbolCode: primaryLeg.symbol, success: true })
      return
    }

    this.logger.warn(`Exceeded AI retry attempts for multi-leg strategy ${strategy.id}`)
    await this.handleStrategyFailure(instance.id, config)
    this.telemetry.recordGeneration({
      strategyId: strategy.id,
      symbolCode: primaryLeg.symbol,
      success: false,
      reason: 'AI_FAILURE',
    })
  }

  /**
   * 创建多 Leg 策略的信号
   * @returns 返回创建结果，包含是否创建成功、信号ID和原因
   */
  private async createMultiLegSignal(
    instance: StrategyInstanceWithTemplate,
    strategy: StrategyTemplate,
    primarySymbol: Symbol,
    execution: StrategyExecutionConfig,
    indicators: Record<string, any>,
    aiPayload: AiSignalPayload & { rawResponse: string },
    config: StrategySignalsRuntimeConfig,
    skipCooldown = false,
  ): Promise<{ created: boolean; signalId: string | null; reason?: string }> {
    // 确定冷却时间：无条件保证 >= timeframe 对应的分钟数
    const configuredCooldown = execution.cooldownMinutes ?? config.cooldownMinutes
    const minimumCooldown = timeframeToMinutes(execution.timeframe)
    const cooldownMinutes = Math.max(configuredCooldown, minimumCooldown)
    const cooldownSince = new Date(Date.now() - cooldownMinutes * 60 * 1000)

    const result = await this.prisma.$transaction(async prisma => {
      await prisma.$queryRaw`
        SELECT "id"
        FROM "strategy_instances"
        WHERE "id" = ${instance.id}
        FOR UPDATE
      `

      // 手动触发时允许跳过 cooldown 检查，确保管理员能够强制生成信号
      if (!skipCooldown) {
        const recentSignal = await prisma.tradingSignal.findFirst({
          where: {
            strategyId: strategy.id,
            symbolId: primarySymbol.id,
            createdAt: { gte: cooldownSince },
            // 兼容历史数据：strategyInstanceId 为空的旧信号也视为命中冷却窗口，
            // 避免在数据尚未完全回填前生成重复信号。
            OR: [
              { strategyInstanceId: instance.id },
              { strategyInstanceId: null },
            ],
          },
          orderBy: { createdAt: 'desc' },
        })

        if (recentSignal) {
          return { created: false as const, signalId: null, reason: 'COOLDOWN' }
        }
      }

      // 直接使用事务客户端创建信号，确保原子性
      const data: Prisma.TradingSignalCreateInput = {
        strategy: { connect: { id: strategy.id } },
        strategyInstance: { connect: { id: instance.id } },
        symbol: { connect: { id: primarySymbol.id } },
        sourceType: 'AI_GENERATED' satisfies SignalSourceType,
        direction: aiPayload.direction,
        signalType: aiPayload.signalType,
        status: 'PENDING' satisfies SignalStatus,
        confidence: aiPayload.confidence,
        entryPrice: aiPayload.entryPrice,
        stopLoss: aiPayload.stopLoss,
        takeProfit: aiPayload.takeProfit,
        positionSizeQuote: aiPayload.positionSizeQuote,
        positionSizeRatio: aiPayload.positionSizeRatio,
        aiModel: instance.llmModel,
        aiReasoning: aiPayload.reasoning,
        aiRawResponse: aiPayload.rawResponse,
        marketContext: this.toJsonSafe({
          ...indicators,
          timeframe: execution.timeframe,
        }) satisfies Prisma.JsonValue,
        metadata: {
          generatorVersion: 'v2-multi-leg',
        },
      }

      const newSignal = await prisma.tradingSignal.create({
        data,
      })

      return { created: true as const, signalId: newSignal.id }
    })

    if (result.created && result.signalId) {
      this.eventEmitter.emit(StrategySignalEvents.CREATED, new TradingSignalCreatedEvent(result.signalId))
    }
    
    return result
  }


  /**
   * 将任意值转换为 JSON-safe 的值
   * 处理 Date、undefined、NaN、Infinity、循环引用等非 JSON-safe 的值
   */
  private toJsonSafe(value: any): any {
    // 处理基本类型
    if (value === null || value === undefined) {
      return null
    }
    
    if (typeof value === 'number') {
      // 处理 NaN、Infinity
      if (!Number.isFinite(value)) {
        return String(value)
      }
      return value
    }
    
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value
    }
    
    // 处理 Date
    if (value instanceof Date) {
      return value.toISOString()
    }
    
    // 处理数组
    if (Array.isArray(value)) {
      return value.map(item => this.toJsonSafe(item))
    }
    
    // 处理对象
    if (typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.toJsonSafe(value[key])
        }
      }
      return result
    }
    
    // 其他类型（如 Function、Symbol）转换为字符串
    return String(value)
  }
}
