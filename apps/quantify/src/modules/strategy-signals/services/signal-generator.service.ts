import type { AiSignalPayload } from '@ai/shared'
import type { LegTimeframeData, MultiLegStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
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
} from '@prisma/client'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition } from '@/modules/strategy-templates/types/strategy-template.types'
import { fillPromptTemplate, parseAiSignalResponse } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildMultiLegStrategyContext, buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 ConfigService
import { ConfigService } from '@nestjs/config'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 EventEmitter2
import { EventEmitter2 } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
import { mapTimeframe, reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { AiService } from '@/modules/ai/ai.service'
import { timeframeToMinutes } from '@/modules/strategy-templates/types/strategy-template.types'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PrismaService } from '@/prisma/prisma.service'
import { StrategySignalEvents } from '../constants/strategy-signal.constants'
import { TradingSignalCreatedEvent } from '../events/strategy-signal.events'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { StrategySignalStateRepository } from '../repositories/strategy-signal-state.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { TradingSignalRepository } from '../repositories/trading-signal.repository'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { ScriptDebugUtil } from '../utils/script-debug.util'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
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
   * 璁板綍姣忎釜绛栫暐瀹炰緥鍦?candidateGroups 涓殑杞浣嶇疆锛?
   * 閬垮厤澶氫釜瀹炰緥鍏变韩鍚屼竴妯℃澘鐨勬寚閽堝鑷村悇鑷彧瑕嗙洊涓€閮ㄥ垎鏍囩殑銆?
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

    // 浣跨敤甯﹂敊璇厹搴曠殑鍥炶皟锛岄伩鍏?runGenerationCycle 涓殑寮傚父鍙樻垚鏈崟鑾锋嫆缁濆鑷磋繘绋嬪穿婧?
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

    // 浠モ€滅瓥鐣ュ疄渚嬧€濅负鍗曚綅鐢熸垚淇″彿锛?
    // - 鍙鐞?status='running' 涓?mode='LIVE' 鐨勫疄渚?
    // - 搴曞眰妯℃澘蹇呴』涓?status='live'
    const instances = await this.prisma.strategyInstance.findMany({
      where: {
        status: 'running',
        mode: 'LIVE',
        strategyTemplate: {
          status: 'live',
        },
      },
      // 浣跨敤绋冲畾鐨勬帓搴忥紙鎸?id锛夛紝閰嶅悎 lastStrategyIndex 瀹炵幇杞锛岃€岄潪姘歌繙鍙鐞嗘渶鏂扮殑涓€鎵?
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
   * 楠岃瘉绛栫暐瀹炰緥鏄惁鍙互鎵嬪姩瑙﹀彂淇″彿鐢熸垚
   * 鍦ㄨ繑鍥炲墠鍚屾楠岃瘉鎵€鏈夊繀椤绘潯浠讹紝閬垮厤璇姤鎴愬姛
   * @param instanceId 绛栫暐瀹炰緥 ID
   * @throws 濡傛灉楠岃瘉澶辫触锛屾姏鍑哄甫璇︾粏閿欒淇℃伅鐨勫紓甯?
   */
  async validateManualTriggerTarget(instanceId: string): Promise<void> {
    const config = this.getConfig()

    if (!config.enabled) {
      throw new Error('Strategy signal generation is disabled via configuration (STRATEGY_SIGNALS_ENABLED=false)')
    }

    // 鏌ヨ鎸囧畾鐨勭瓥鐣ュ疄渚?
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: instanceId },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${instanceId} not found`)
    }

    // 楠岃瘉瀹炰緥鐘舵€?
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
   * 涓烘寚瀹氱殑绛栫暐瀹炰緥鐢熸垚淇″彿锛堢敤浜庢墜鍔ㄨЕ鍙戯級
   * @param instanceId 绛栫暐瀹炰緥 ID
   * @param options 閫夐」閰嶇疆
   * @param options.skipCooldown 鏄惁璺宠繃 cooldown 妫€鏌?
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

    // 鏌ヨ鎸囧畾鐨勭瓥鐣ュ疄渚?
    const instance = await this.prisma.strategyInstance.findUnique({
      where: { id: instanceId },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance) {
      throw new Error(`Strategy instance ${instanceId} not found`)
    }

    // 楠岃瘉瀹炰緥鐘舵€?
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

    // 澶勭悊璇ュ疄渚?
    this.logger.log(`Manually generating signal for strategy instance ${instanceId}`)
    await this.processStrategyInstance(instance, config, options)
  }

  /**
   * 妫€鏌ユ槸鍚﹀惎鐢ㄨ剼鏈皟璇曟棩蹇?
   * 鐢熶骇鐜榛樿绂佺敤锛岄櫎闈炴樉寮忛厤缃?
   */
  private isDebugEnabled(): boolean {
    const config = this.getConfig()
    const nodeEnv = process.env.NODE_ENV || 'development'

    // 鐢熶骇鐜蹇呴』鏄惧紡鍚敤璋冭瘯锛屽紑鍙戠幆澧冮粯璁ゅ惎鐢?
    if (nodeEnv === 'production') {
      return config.debug?.enabled === true
    }

    return config.debug?.enabled !== false
  }

  /**
   * 璁板綍鑴氭湰鎵ц鐨勮皟璇曚俊鎭?
   */
  private logScriptDebug(strategy: StrategyTemplate, result?: { success: boolean; value?: any; error?: any }) {
    if (!this.isDebugEnabled()) return

    const config = this.getConfig()
    const maxScriptLength = config.debug?.maxScriptLength ?? 1000
    const maxValueLength = config.debug?.maxValueLength ?? 200

    // 璁板綍鑴氭湰鍐呭
    this.logger.debug(
      `[Script Debug] Strategy ${strategy.id} script:\n` +
      `${ScriptDebugUtil.formatScriptForLog(strategy.script, maxScriptLength)}\n` +
      `[End Script]`
    )

    // 濡傛灉鎻愪緵浜嗘墽琛岀粨鏋滐紝璁板綍缁撴灉
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

    // 妫€鏌ョ瓥鐣ユ槸鍚︿娇鐢ㄦ柊鏋舵瀯锛堟湁 execution 鍜?dataRequirements锛?
    const execution = strategy.execution as unknown as StrategyExecutionConfig | null | undefined
    const dataRequirements = strategy.dataRequirements as unknown as StrategyDataRequirements | null | undefined
    const legs = strategy.legs as unknown as StrategyLegDefinition[] | null | undefined

    if (execution && dataRequirements && legs && legs.length > 0) {
      // 鏂版灦鏋勶細浣跨敤 legs 鍜?dataRequirements
      return this.processStrategyWithLegsForInstance(instance, strategy, execution, dataRequirements, legs, config, options)
    }

    // 鏃ф灦鏋勶細浣跨敤 requiredFields
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

    // 杞鎸囬拡鏀逛负鎸夊疄渚嬬淮搴︾嫭绔嬬淮鎶わ紝閬垮厤澶氫釜瀹炰緥鈥滃垎椋熲€濆悓涓€妯℃澘鐨勬爣鐨勯泦鍚堛€?
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
   * 澶勭悊浣跨敤鏂版灦鏋勭殑绛栫暐锛堝 Leg 澶氬懆鏈燂級
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

    // 鎵惧埌 primary leg
    const primaryLeg = legs.find(leg => leg.role === 'primary')
    if (!primaryLeg) {
      this.logger.warn(`Strategy ${strategy.id} has no primary leg, skipping for instance ${instance.id}`)
      return
    }

    // 涓?primary leg 鐢熸垚淇″彿
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
   * 鍦ㄥ鍓湰閮ㄧ讲鍦烘櫙涓嬶紝浣跨敤鏁版嵁搴撹閿?+ 鍐峰嵈鏃堕棿妫€鏌ヤ繚璇佸悓涓€绛栫暐/鏍囩殑/鍐峰嵈绐楀彛鍐呭彧鐢熸垚涓€娆′俊鍙枫€?
   * 閫昏緫锛?
   * 1. 瀵?strategy_templates 琛屽姞 FOR UPDATE 閿侊紝涓茶鍖栧悓涓€绛栫暐鐨勭敓鎴愭祦绋嬶紱
   * 2. 鍦ㄥ悓涓€浜嬪姟鍐呭啀娆℃鏌ュ喎鍗寸獥鍙ｅ唴鏄惁宸叉湁 TradingSignal锛?
   * 3. 鑻ュ凡瀛樺湪鍒欒烦杩囷紱鍚﹀垯鍒涘缓鏂颁俊鍙峰苟鍦ㄤ簨鍔″鍙戝竷浜嬩欢銆?
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
      // 瀵瑰綋鍓嶇瓥鐣ュ疄渚嬭鍔犻攣锛岄伩鍏嶅悓涓€瀹炰緥骞跺彂閫氳繃鍐峰嵈妫€鏌ュ悗閲嶅鍒涘缓淇″彿
      await prisma.$queryRaw`
        SELECT "id"
        FROM "strategy_instances"
        WHERE "id" = ${instance.id}
        FOR UPDATE
      `

      // 鎵嬪姩瑙﹀彂鏃跺厑璁歌烦杩?cooldown 妫€鏌ワ紝纭繚绠＄悊鍛樿兘澶熷己鍒剁敓鎴愪俊鍙?
      if (!skipCooldown) {
        const existingCount = await prisma.tradingSignal.count({
          where: {
            strategyId: strategy.id,
            symbolId: group.symbol.id,
            createdAt: {
              gte: cooldownSince,
            },
            // 鍏煎鍘嗗彶鏁版嵁锛歴trategyInstanceId 涓虹┖鐨勬棫淇″彿涔熻涓哄懡涓喎鍗寸獥鍙ｏ紝
            // 閬垮厤鍦ㄦ暟鎹皻鏈畬鍏ㄥ洖濉墠鐢熸垚閲嶅淇″彿銆?
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
          timeframe: reverseMapTimeframe(group.timeframe as any),  // 杞崲涓哄簲鐢ㄥ眰鏍煎紡 "1m"
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
    // 鍑嗗濉厖 prompt 妯℃澘鐨勬暟鎹?
    let promptData: Record<string, any> = {}

    // 濡傛灉绛栫暐鏈夎剼鏈紝鎵ц鑴氭湰鍑嗗鏁版嵁
    if (strategy.script) {
      try {
        const engine = createScriptEngine()

        // 鏋勫缓鑴氭湰鎵ц涓婁笅鏂?
        const marketBars = await this.loadRecentBars(symbol.id, timeframe, DEFAULT_BAR_LIMIT)
        // 杞崲 MarketBar 鍒?Bar 绫诲瀷
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

        // 鎵ц鑴氭湰 - 鏅鸿兘閲嶈瘯鏈哄埗
        // 浼樺厛鐢ㄦ爣鍑嗘ā寮忥紙鏂拌剼鏈細鏈€鍚庤〃杈惧紡浣滀负杩斿洖鍊硷級
        let result = await engine.execute(strategy.script, {
          context: scriptContext,
          timeout: MAX_SCRIPT_TIMEOUT_MS,
          allowAsync: false,
        })

        // 妫€娴嬪埌闇€瑕?async 涓婁笅鏂囩殑璇硶閿欒锛岀敤 allowAsync 閲嶈瘯锛堟棫鑴氭湰鍏煎锛?
        // 鍖呮嫭锛氶《灞?return銆侀《灞?await 绛?
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
          // 濮嬬粓璋冪敤 validateScriptOutput锛屽嵆浣?result.value 涓?undefined
          // 杩欐牱鍙互鎻愪緵涓€鑷寸殑閿欒鎻愮ず锛屼笌璋冭瘯鎺ュ彛鍜屽leg璺緞淇濇寔涓€鑷?
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
          // 鑴氭湰鎵ц澶辫触鏃讹紝浣跨敤鍘熷鎸囨爣鏁版嵁浣滀负鍚庡
          promptData = indicators
        }
      } catch (error) {
        this.logger.error(`Error executing script for strategy ${strategy.id}: ${(error as Error).message}`)
        // 鍑洪敊鏃朵娇鐢ㄥ師濮嬫寚鏍囨暟鎹?
        promptData = indicators
      }
    } else {
      // 娌℃湁鑴氭湰鏃讹紝鐩存帴浣跨敤鎸囨爣鏁版嵁
      promptData = indicators
    }

    // 濉厖 prompt 妯℃澘涓殑鍗犱綅绗︼紙浣跨敤 shared helper锛屼繚璇佷笌璋冭瘯鎺ュ彛涓€鑷达級
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
      // 杩斿洖鏃堕棿鍗囧簭鐨勭粨鏋滐紙鏈€鏃х殑鍦ㄥ墠锛?
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
   * 璁＄畻褰撳墠瀹炰緥涓嬭剼鏈彲鐢ㄧ殑鍙傛暟锛?
   * - 妯℃澘 defaultParams 浣滀负鍩虹
   * - 瀹炰緥 params 瑕嗙洊鍚屽悕瀛楁
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
   * 鎵归噺鍔犺浇澶?Leg 绛栫暐鐨勬墍鏈夋暟鎹紙鎬ц兘浼樺寲锛?
   */
  private async loadMultiLegDataBatch(
    legs: StrategyLegDefinition[],
    dataRequirements: StrategyDataRequirements,
  ): Promise<Record<string, Record<string, LegTimeframeData>>> {
    // 1. 鎵归噺鍔犺浇鎵€鏈?symbols
    const symbolCodes = legs.map(leg => leg.symbol)
    const symbols = await this.prisma.symbol.findMany({
      where: { code: { in: symbolCodes } },
    })
    const symbolMap = new Map(symbols.map(s => [s.code, s]))

    // 2. 鏀堕泦鎵€鏈夐渶瑕佸姞杞界殑 (legId, symbolId, timeframe) 缁勫悎
    interface DataRequest {
      legId: string
      symbolId: string
      timeframe: MarketTimeframe  // Prisma 鏋氫妇鏍煎紡锛堝 'h1'锛?
      originalTimeframe: string   // 搴旂敤灞傛牸寮忥紙濡?'1h'锛?
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

      // 灏嗗簲鐢ㄥ眰鏃堕棿鍛ㄦ湡鏄犲皠涓?Prisma 鏋氫妇
      for (const tf of timeframes) {
        dataRequests.push({
          legId: leg.id,
          symbolId: symbol.id,
          timeframe: mapTimeframe(tf as any),  // 浠庡簲鐢ㄥ眰 '1h' 杞崲涓?Prisma 'h1'
          originalTimeframe: tf,  // 淇濈暀鍘熷搴旂敤灞傛牸寮忕敤浜庤繑鍥?
        })
      }
    }

    // 3. 骞惰鍔犺浇鎵€鏈?bars 鏁版嵁
    const barsPromises = dataRequests.map(async req => {
      const bars = await this.loadRecentBars(req.symbolId, req.timeframe, DEFAULT_BAR_LIMIT)
      return { ...req, bars }
    })

    const allBarsData = await Promise.all(barsPromises)

    // 4. 鏋勫缓缁撴灉
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

      // TODO: 鍔犺浇鎸囨爣鏁版嵁锛堥渶瑕佹墿灞?IndicatorConfig 浠ユ敮鎸佹寜 leg 鏌ヨ锛?
      const indicators: Record<string, number> = {}

      // 浣跨敤搴旂敤灞傛牸寮忎綔涓?key锛堝 '1h'锛?
      result[data.legId][data.originalTimeframe] = {
        bars,
        indicators,
        currentPrice,
      }
    }

    return result
  }

  /**
   * 涓轰娇鐢ㄦ柊鏋舵瀯鐨勫 Leg 绛栫暐鐢熸垚淇″彿
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
    // 1. 鏌ユ壘 primary leg 鐨?symbol
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

    // 2. 鎵归噺鍔犺浇鎵€鏈?leg 鐨勬暟鎹紙鎬ц兘浼樺寲锛?
    const multiLegData = await this.loadMultiLegDataBatch(legs, dataRequirements)

    // 2.1 鏍￠獙鏁版嵁瀹屾暣鎬э細纭繚鎵€鏈?dataRequirements 涓畾涔夌殑鏁版嵁閮藉凡鍔犺浇
    for (const leg of legs) {
      const requiredTimeframes = dataRequirements[leg.id]
      if (!requiredTimeframes || requiredTimeframes.length === 0) {
        continue
      }

      for (const timeframe of requiredTimeframes) {
        const legData = multiLegData[leg.id]?.[timeframe]

        // 妫€鏌ユ暟鎹槸鍚﹀瓨鍦?
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

        // 妫€鏌?bars 鏄惁涓虹┖
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

    // 3. 鏋勫缓鑴氭湰涓婁笅鏂?
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

    // 4. 鎵ц鑴氭湰鍑嗗鏁版嵁
    let promptData: Record<string, any> = {}

    if (!strategy.script) {
      // 鏂版灦鏋勫繀椤绘湁鑴氭湰
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

      // 璋冭瘯鏃ュ織锛氭墦鍗拌剼鏈唴瀹癸紙浠呭湪鍚敤璋冭瘯鏃讹級
      this.logScriptDebug(strategy)

      // 鏅鸿兘閲嶈瘯鏈哄埗锛氫紭鍏堟爣鍑嗘ā寮忥紝閬囧埌闇€瑕?async 涓婁笅鏂囩殑璇硶閿欒鍒欑敤 allowAsync 閲嶈瘯
      let result = await engine.execute(strategy.script, {
        context: ctx,
        timeout: MAX_SCRIPT_TIMEOUT_MS,
        allowAsync: false,
      })

      // 璋冭瘯鏃ュ織锛氭墦鍗版墽琛岀粨鏋滐紙浠呭湪鍚敤璋冭瘯鏃讹級
      this.logScriptDebug(strategy, result)

      // 妫€娴嬪埌闇€瑕?async 涓婁笅鏂囩殑璇硶閿欒锛岀敤 allowAsync 閲嶈瘯锛堟棫鑴氭湰鍏煎锛?
      // 鍖呮嫭锛氶《灞?return銆侀《灞?await 绛?
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

      // 鑴氭湰寮曟搸鎵ц澶辫触锛堣娉曢敊璇瓑锛?
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

      // 鍙帴鍙?鏅€氬璞?浣滀负鑴氭湰缁撴灉锛岄槻姝㈠瓧绗︿覆/鏁扮粍绛夌被鍨嬪鑷村悗缁?fillPromptTemplate 鎶ラ敊
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        // 浣跨敤宸ュ叿鍑芥暟瀹夊叏鍦板簭鍒楀寲瀹為檯杩斿洖鍊?
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

      // 鑴氭湰鎵ц鎴愬姛锛屼絾闇€瑕佹牎楠岃繑鍥炲€硷紙鍗充娇涓?undefined锛?
      // 涓庡崟 Leg 璺緞鍜岃皟璇曟帴鍙ｄ繚鎸佷竴鑷达紝鎻愪緵缁撴瀯鍖栫殑閿欒淇℃伅
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

    // 5. 濉厖 prompt 骞惰皟鐢?AI
    const filledPrompt = fillPromptTemplate(strategy.promptTemplate, promptData)

    const primaryTimeframeData = multiLegData[primaryLeg.id]?.[execution.timeframe]

    // 杩愯鏃舵鏌ワ細纭繚涓诲懆鏈熸暟鎹瓨鍦?
    if (!primaryTimeframeData || !primaryTimeframeData.bars || primaryTimeframeData.bars.length === 0) {
      this.logger.error(
        `Primary leg "${primaryLeg.id}" 缂哄皯 execution.timeframe (${execution.timeframe}) 鐨勬暟鎹€俙 +
        `璇锋鏌?dataRequirements 閰嶇疆鏄惁姝ｇ‘銆俙,
      )
      // 灏嗙己澶变富鍛ㄦ湡鏁版嵁瑙嗕负瀹炰緥绾уけ璐ワ紝瑙﹀彂鍐峰嵈锛岄伩鍏嶅疄渚嬪湪姣忎釜 tick 涓婃棤闄愰噸璇曘€?
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

      // AI 璋冪敤鍜岃В鏋愶紙鍙噸璇曪級
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

      // AI 瑙ｆ瀽鎴愬姛锛岀珛鍗抽噸缃け璐ヨ鏁板櫒锛堜笌鍗曡吙璺緞淇濇寔涓€鑷达級
      await this.resetStrategyFailure(instance.id)

      // 鍒涘缓淇″彿锛堟暟鎹簱鎿嶄綔锛屼笉閲嶈瘯锛岄敊璇簲璇ュ啋娉★級
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

      // 璁板綍鍒涘缓缁撴灉
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
   * 鍒涘缓澶?Leg 绛栫暐鐨勪俊鍙?
   * @returns 杩斿洖鍒涘缓缁撴灉锛屽寘鍚槸鍚﹀垱寤烘垚鍔熴€佷俊鍙稩D鍜屽師鍥?
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
    // 纭畾鍐峰嵈鏃堕棿锛氭棤鏉′欢淇濊瘉 >= timeframe 瀵瑰簲鐨勫垎閽熸暟
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

      // 鎵嬪姩瑙﹀彂鏃跺厑璁歌烦杩?cooldown 妫€鏌ワ紝纭繚绠＄悊鍛樿兘澶熷己鍒剁敓鎴愪俊鍙?
      if (!skipCooldown) {
        const recentSignal = await prisma.tradingSignal.findFirst({
          where: {
            strategyId: strategy.id,
            symbolId: primarySymbol.id,
            createdAt: { gte: cooldownSince },
            // 鍏煎鍘嗗彶鏁版嵁锛歴trategyInstanceId 涓虹┖鐨勬棫淇″彿涔熻涓哄懡涓喎鍗寸獥鍙ｏ紝
            // 閬垮厤鍦ㄦ暟鎹皻鏈畬鍏ㄥ洖濉墠鐢熸垚閲嶅淇″彿銆?
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

      // 鐩存帴浣跨敤浜嬪姟瀹㈡埛绔垱寤轰俊鍙凤紝纭繚鍘熷瓙鎬?
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
   * 灏嗕换鎰忓€艰浆鎹负 JSON-safe 鐨勫€?
   * 澶勭悊 Date銆乽ndefined銆丯aN銆両nfinity銆佸惊鐜紩鐢ㄧ瓑闈?JSON-safe 鐨勫€?
   */
  private toJsonSafe(value: any): any {
    // 澶勭悊鍩烘湰绫诲瀷
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === 'number') {
      // 澶勭悊 NaN銆両nfinity
      if (!Number.isFinite(value)) {
        return String(value)
      }
      return value
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return value
    }

    // 澶勭悊 Date
    if (value instanceof Date) {
      return value.toISOString()
    }

    // 澶勭悊鏁扮粍
    if (Array.isArray(value)) {
      return value.map(item => this.toJsonSafe(item))
    }

    // 澶勭悊瀵硅薄
    if (typeof value === 'object') {
      const result: Record<string, any> = {}
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          result[key] = this.toJsonSafe(value[key])
        }
      }
      return result
    }

    // 鍏朵粬绫诲瀷锛堝 Function銆丼ymbol锛夎浆鎹负瀛楃涓?
    return String(value)
  }
}
