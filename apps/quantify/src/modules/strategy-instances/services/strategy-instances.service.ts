/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入 */
import type { LegTimeframeData, MultiLegStrategyContext, StrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import type { StrategyInstanceMode, StrategyInstanceStatus } from '@prisma/client'
import type { PrismaMarketTimeframe } from '@/common/utils/prisma-enum-mappers'
import type { StrategyDataRequirements, StrategyExecutionConfig, StrategyLegDefinition } from '@/modules/strategy-templates/types/strategy-template.types'
import { fillPromptTemplate } from '@ai/shared'
import { createScriptEngine, validateScriptOutput } from '@ai/shared/node'
import { buildMultiLegStrategyContext, buildStrategyContext } from '@ai/shared/script-engine/helpers/context-builder'
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { Prisma, SubscriptionStatus } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { mapTimeframe } from '@/common/utils/prisma-enum-mappers'
import { TradingSignalRepository } from '@/modules/strategy-signals/repositories/trading-signal.repository'
import { StrategyTemplateNotFoundException } from '@/modules/strategy-templates/exceptions/strategy-template-not-found.exception'
import { PrismaService } from '@/prisma/prisma.service'
import { CreateStrategyInstanceDto } from '../dto/create-strategy-instance.dto'
import { LiveStrategyInstanceListQueryDto } from '../dto/live-strategy-instance-list-query.dto'
import { StrategyInstancePublicResponseDto } from '../dto/live-strategy-instance-response.dto'
import { StrategyInstanceListQueryDto } from '../dto/strategy-instance-list-query.dto'
import { StrategyInstanceResponseDto } from '../dto/strategy-instance-response.dto'
import { StrategyInstanceSignalPublicResponseDto } from '../dto/strategy-instance-signal-public-response.dto'
import { StrategyInstanceSignalsListQueryDto } from '../dto/strategy-instance-signals-list-query.dto'
import { StrategyInstanceStatsDto } from '../dto/strategy-instance-stats.dto'
import { StrategyInstanceSubscriptionDetailsDto, SubscriberInfoDto } from '../dto/strategy-instance-subscription-details.dto'
import { TestStrategyInstanceDto, TestStrategyInstanceResultDto } from '../dto/test-strategy-instance.dto'
import { UpdateStrategyInstanceDto } from '../dto/update-strategy-instance.dto'
import {
  InvalidInstanceModeTransitionException,
  InvalidInstanceStatusTransitionException,
  StrategyInstanceNameConflictException,
  StrategyInstanceNotFoundException,
} from '../exceptions'
import { StrategyInstancesRepository } from '../repositories/strategy-instances.repository'
import { StrategyInstanceStatsService } from './strategy-instance-stats.service'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError

type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

type InstanceWithRelations = Prisma.StrategyInstanceGetPayload<{
  include: {
    strategyTemplate: {
      select: {
        id: true
        name: true
        description: true
        status: true
      }
    }
  }
}>

/**
 * 调试接口中 multiLegData 每个 timeframe 的输入结构
 * 只在 StrategyInstancesService 内部使用，用于类型收窄，避免 unknown 访问属性时报错。
 */
interface TestLegTimeframeInput {
  bars?: Array<{
    open: number
    high: number
    low: number
    close: number
    volume: number
    timestamp?: number
  }>
  indicators?: Record<string, number>
  currentPrice?: number
}

@Injectable()
export class StrategyInstancesService {
  private readonly logger = new Logger(StrategyInstancesService.name)
  private static readonly DEBUG_SCRIPT_TIMEOUT_MS = 5000
  private static readonly DEBUG_BAR_LIMIT = 100

  constructor(
    private readonly prisma: PrismaService,
    private readonly instancesRepo: StrategyInstancesRepository,
    private readonly statsService: StrategyInstanceStatsService,
    private readonly tradingSignalRepository: TradingSignalRepository,
  ) {}

  async createInstance(
    dto: CreateStrategyInstanceDto,
    createdBy?: string,
  ): Promise<StrategyInstanceResponseDto> {
    const client = this.prisma.getClient()

    // 验证策略模板是否存在
    const template = await client.strategyTemplate.findUnique({
      where: { id: dto.strategyTemplateId },
      select: { id: true, name: true },
    })

    if (!template) {
      throw new StrategyTemplateNotFoundException({ templateId: dto.strategyTemplateId })
    }

    // 检查是否存在同名实例（同一模板 + 同一 LLM 模型 + 同一名称）
    const exists = await this.instancesRepo.existsByTemplateModelName(
      dto.strategyTemplateId,
      dto.llmModel,
      dto.name,
    )

    if (exists) {
      throw new StrategyInstanceNameConflictException({
        strategyTemplateId: dto.strategyTemplateId,
        llmModel: dto.llmModel,
        name: dto.name,
      })
    }

    let created
    try {
      created = await this.instancesRepo.create({
        strategyTemplateId: dto.strategyTemplateId,
        name: dto.name,
        description: dto.description,
        llmModel: dto.llmModel,
        mode: dto.mode,
        params: dto.params as Prisma.InputJsonValue | undefined,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        createdBy,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new StrategyInstanceNameConflictException({
          strategyTemplateId: dto.strategyTemplateId,
          llmModel: dto.llmModel,
          name: dto.name,
        })
      }
      throw error
    }

    this.logger.log(
      `创建策略实例成功: ${created.id}, 模板: ${dto.strategyTemplateId}, LLM: ${dto.llmModel}`,
    )

    const detail = await this.instancesRepo.findByIdWithDetails(created.id)
    if (!detail) {
      throw new StrategyInstanceNotFoundException({ instanceId: created.id })
    }
    return this.toResponseDto(detail)
  }

  async listInstances(
    query: StrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<StrategyInstanceResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const { items, total } = await this.instancesRepo.findMany({
      strategyTemplateId: query.strategyTemplateId,
      status: query.status,
      mode: query.mode,
      llmModel: query.llmModel,
      skip,
      take: limit,
    })

    // 批量获取统计数据 (可选)
    let statsMap: Map<string, StrategyInstanceStatsDto | null> | undefined
    if (query.includeStats !== false && items.length > 0) {
      const instanceIds = items.map(item => item.id)
      try {
        statsMap = await this.statsService.calculateBatchStats(instanceIds)
      } catch (error) {
        this.logger.warn('Failed to calculate batch stats, continuing without stats', error)
      }
    }

    const data = items.map(item => {
      const dto = this.toResponseDto(item)
      if (statsMap) {
        const stats = statsMap.get(item.id)
        if (stats) {
          dto.stats = stats
        }
      }
      return dto
    })

    return new BasePaginationResponseDto<StrategyInstanceResponseDto>(total, page, limit, data)
  }

  async getInstanceDetail(id: string): Promise<StrategyInstanceResponseDto> {
    const instance = await this.instancesRepo.findByIdWithDetails(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }
    
    const dto = this.toResponseDto(instance)
    
    // 获取统计数据（捕获错误，不影响主流程）
    try {
      const stats = await this.statsService.calculateStats(id)
      if (stats) {
        dto.stats = stats
      }
    } catch (error) {
      this.logger.warn(`Failed to calculate stats for instance ${id}`, error)
      // 继续返回不含统计数据的响应
    }
    
    return dto
  }

  async updateInstance(
    id: string,
    dto: UpdateStrategyInstanceDto,
    updatedBy?: string,
  ): Promise<StrategyInstanceResponseDto> {
    const instance = await this.instancesRepo.findById(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    // 如果要更新名称或 LLM 模型，检查是否存在冲突
    if (dto.name || dto.llmModel) {
      const newName = dto.name ?? instance.name
      const newLlmModel = dto.llmModel ?? instance.llmModel

      const exists = await this.instancesRepo.existsByTemplateModelName(
        instance.strategyTemplateId,
        newLlmModel,
        newName,
        id, // 排除自己
      )

      if (exists) {
        throw new StrategyInstanceNameConflictException({
          strategyTemplateId: instance.strategyTemplateId,
          llmModel: newLlmModel,
          name: newName,
        })
      }
    }

    // 状态转换验证
    if (dto.status && dto.status !== instance.status) {
      this.validateStatusTransition(instance.status, dto.status)
      
      // 🔴 关键校验：切换到 running 状态时，强制要求 mode 必须为 LIVE
      // 防止管理员启动 PAPER/TESTNET/BACKTEST 实例导致用户端不可见
      // （因为 C 端接口已强制过滤 mode !== 'LIVE' 的实例）
      if (dto.status === 'running') {
        const finalMode = dto.mode ?? instance.mode
        if (finalMode !== 'LIVE') {
          throw new InvalidInstanceModeTransitionException({
            from: finalMode,
            to: 'LIVE',
            reason: '启动实例时必须使用实盘模式（LIVE），以确保用户端可见。请先切换到 LIVE 模式再启动'
          })
        }
      }
    }

    // 模式转换验证
    if (dto.mode !== undefined && dto.mode !== instance.mode) {
      this.validateModeTransition(instance.status, instance.mode, dto.mode)
    }

    const updatePayload: {
      name?: string
      description?: string
      llmModel?: string
      status?: StrategyInstanceStatus
      mode?: StrategyInstanceMode
      params?: Prisma.InputJsonValue | null
      metadata?: Prisma.InputJsonValue | null
      startedAt?: Date | null
      stoppedAt?: Date | null
      updatedBy?: string
    } = {}

    if (dto.name !== undefined) {
      updatePayload.name = dto.name
    }

    if (dto.description !== undefined) {
      updatePayload.description = dto.description
    }

    if (dto.llmModel !== undefined) {
      updatePayload.llmModel = dto.llmModel
    }

    if (dto.mode !== undefined) {
      updatePayload.mode = dto.mode
    }

    if (dto.params !== undefined) {
      updatePayload.params = dto.params as Prisma.InputJsonValue | null
    }

    if (dto.metadata !== undefined) {
      updatePayload.metadata = dto.metadata as Prisma.InputJsonValue | null
    }

    if (dto.status !== undefined) {
      updatePayload.status = dto.status

      // 状态转换时自动设置时间戳
      if (dto.status === 'running' && instance.status !== 'running') {
        updatePayload.startedAt = new Date()
        updatePayload.stoppedAt = null
      } else if (dto.status === 'stopped' && instance.status !== 'stopped') {
        updatePayload.stoppedAt = new Date()
      } else if (dto.status === 'paused' && instance.status === 'running') {
        // 暂停时保留 startedAt，不设置 stoppedAt
      }
    }

    if (updatedBy) {
      updatePayload.updatedBy = updatedBy
    }

    // 如果没有任何字段需要更新，直接返回当前详情
    if (Object.keys(updatePayload).length === 0) {
      const currentDetail = await this.instancesRepo.findByIdWithDetails(id)
      if (!currentDetail) {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }
      return this.toResponseDto(currentDetail)
    }

    const updated = await this.instancesRepo.update(id, updatePayload)
    this.logger.log(`更新策略实例: ${id}, 状态: ${updated.status}`)

    const detail = await this.instancesRepo.findByIdWithDetails(updated.id)
    if (!detail) {
      throw new StrategyInstanceNotFoundException({ instanceId: updated.id })
    }
    return this.toResponseDto(detail)
  }

  async deleteInstance(id: string): Promise<void> {
    const instance = await this.instancesRepo.findById(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    // 只有 draft 状态的实例可以删除
    if (instance.status !== 'draft') {
      throw new InvalidInstanceStatusTransitionException({ currentStatus: instance.status, targetStatus: 'deleted' })
    }

    await this.instancesRepo.delete(id)
    this.logger.log(`删除策略实例: ${id}`)
  }

  /**
   * 构造一个用于实例检查的默认请求体（主要针对多 Leg 多周期架构）
   *
   * 从市场行情表中拉取最近一段 K 线数据，按 legs + dataRequirements 组合成 multiLegData 返回。
   * 不会生成任何信号，仅用于调用方快速构造调试参数。
   */
  async buildTestPayload(id: string): Promise<TestStrategyInstanceDto> {
    const client = this.prisma.getClient()

    const instance = await client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance || !instance.strategyTemplate) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    const strategy = instance.strategyTemplate
    const execution = strategy.execution as unknown as StrategyExecutionConfig | null | undefined
    const dataRequirements = strategy.dataRequirements as unknown as
      | StrategyDataRequirements
      | null
      | undefined
    const legs = strategy.legs as unknown as StrategyLegDefinition[] | null | undefined

    const isMultiLeg =
      !!execution && !!dataRequirements && !!legs && Array.isArray(legs) && legs.length > 0

    if (!isMultiLeg) {
      // 旧版单 leg 架构：调用方需手动填写 bars/indicators/currentPrice
      throw new BadRequestException(
        '当前策略模板未使用多 Leg 多周期架构，可直接在请求体中手动填写 bars/indicators/currentPrice 进行调试',
      )
    }

    // 1. 批量加载所有 symbols
    const symbolCodes = legs!.map(leg => leg.symbol)
    const symbols = await client.symbol.findMany({
      where: { code: { in: symbolCodes } },
    })
    const symbolMap = new Map(symbols.map(s => [s.code, s]))

    // 2. 收集所有需要加载的 (legId, symbolId, timeframe) 组合
    interface DataRequest {
      legId: string
      symbolId: string
      timeframe: PrismaMarketTimeframe // Prisma 枚举格式（如 'h1'）
      originalTimeframe: string // 应用层格式（如 '1h'）
    }

    const dataRequests: DataRequest[] = []
    for (const leg of legs!) {
      const symbol = symbolMap.get(leg.symbol)
      if (!symbol) {
        this.logger.warn(`Symbol ${leg.symbol} not found for leg ${leg.id} when building test payload`)
        continue
      }

      const timeframes = dataRequirements![leg.id]
      if (!timeframes || timeframes.length === 0) {
        this.logger.warn(`No timeframes defined for leg ${leg.id} when building test payload`)
        continue
      }

      for (const tf of timeframes) {
        dataRequests.push({
          legId: leg.id,
          symbolId: symbol.id,
          timeframe: mapTimeframe(tf as any),
          originalTimeframe: tf,
        })
      }
    }

    // 3. 为每个组合加载最近一段 K 线
    const multiLegData: Record<string, Record<string, { bars: any[]; indicators: Record<string, number>; currentPrice: number }>> =
      {}

    for (const req of dataRequests) {
      const bars = await client.marketBar.findMany({
        where: {
          symbolId: req.symbolId,
          timeframe: req.timeframe,
        },
        orderBy: { time: 'desc' },
        take: StrategyInstancesService.DEBUG_BAR_LIMIT,
      })

      const normalizedBars =
        bars
          .reverse()
          .map(bar => ({
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
            volume: Number(bar.volume),
            timestamp: bar.time.getTime(),
          })) ?? []

      const currentPrice =
        normalizedBars.length > 0 ? normalizedBars[normalizedBars.length - 1]!.close : 0

      if (!multiLegData[req.legId]) {
        multiLegData[req.legId] = {}
      }

      // 目前指标暂不从数据库加载，留空给脚本使用 K 线自行计算或由调试者补充
      multiLegData[req.legId]![req.originalTimeframe] = {
        bars: normalizedBars,
        indicators: {},
        currentPrice,
      }
    }

    return {
      multiLegData,
    }
  }

  /**
   * 主动触发策略实例检查（调试用）
   *
   * - 不会写入 TradingSignal / 仓位等业务表，仅执行脚本并返回结果
   * - 既支持旧版单 leg 脚本，也支持新版多 leg 多周期脚本
   */
  async testInstance(
    id: string,
    dto: TestStrategyInstanceDto,
  ): Promise<TestStrategyInstanceResultDto> {
    const client = this.prisma.getClient()

    const instance = await client.strategyInstance.findUnique({
      where: { id },
      include: {
        strategyTemplate: true,
      },
    })

    if (!instance || !instance.strategyTemplate) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    const strategy = instance.strategyTemplate
    const execution = strategy.execution as unknown as StrategyExecutionConfig | null | undefined
    const dataRequirements = strategy.dataRequirements as unknown as
      | StrategyDataRequirements
      | null
      | undefined
    const legs = strategy.legs as unknown as StrategyLegDefinition[] | null | undefined

    if (!strategy.script) {
      throw new BadRequestException('策略模板未配置脚本（script），无法执行实例检查')
    }

    if (!strategy.promptTemplate) {
      this.logger.warn(
        `Strategy ${strategy.id} has no promptTemplate, test run will only return scriptResult`,
      )
    }

    const engine = createScriptEngine()

    // 与正式执行路径保持一致：合并模板 defaultParams 与实例 params
    const effectiveParams = this.buildEffectiveParams(strategy, instance)

    // 优先使用新版多 leg 多周期上下文（当模板配置了 legs 与 dataRequirements 时）
    const isMultiLeg =
      !!execution && !!dataRequirements && !!legs && Array.isArray(legs) && legs.length > 0

    let scriptContext: StrategyContext | MultiLegStrategyContext
    let contextObject: Record<string, unknown>

    if (isMultiLeg) {
      if (!dto.multiLegData || Object.keys(dto.multiLegData).length === 0) {
        throw new BadRequestException(
          '当前策略模板使用多 Leg 多周期架构，请在请求体中提供 multiLegData（按 legId + timeframe 组织的数据）',
        )
      }

      // 基本校验：确保 dataRequirements 中声明的所有 leg/timeframe 都有对应数据，方便提前发现配置问题
      for (const leg of legs!) {
        const requiredTimeframes = dataRequirements![leg.id]
        if (!requiredTimeframes || requiredTimeframes.length === 0) continue

        for (const timeframe of requiredTimeframes) {
          const legData = dto.multiLegData?.[leg.id]?.[timeframe] as TestLegTimeframeInput | undefined
          if (!legData) {
            throw new BadRequestException(
              `multiLegData 缺少 leg "${leg.id}" 在周期 "${timeframe}" 的数据，请补充后重试`,
            )
          }

          if (!Array.isArray(legData.bars) || legData.bars.length === 0) {
            throw new BadRequestException(
              `multiLegData 中 leg "${leg.id}" 在周期 "${timeframe}" 的 bars 为空，无法执行脚本`,
            )
          }
        }
      }

      const multiLegData: Record<string, Record<string, LegTimeframeData>> = {}
      for (const [legId, timeframes] of Object.entries(
        dto.multiLegData as Record<string, Record<string, TestLegTimeframeInput>>,
      )) {
        multiLegData[legId] = {}
        for (const [timeframe, value] of Object.entries(timeframes)) {
          multiLegData[legId]![timeframe] = {
            bars: (value.bars ?? []).map(bar => ({
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              timestamp: bar.timestamp,
            })),
            indicators: value.indicators ?? {},
            currentPrice: value.currentPrice ?? 0,
          }
        }
      }

      scriptContext = {
        data: multiLegData,
        execution: {
          timeframe: execution!.timeframe,
          cooldownMinutes: execution!.cooldownMinutes,
        },
        legs: legs!.map(leg => ({
          id: leg.id,
          symbol: leg.symbol,
          role: leg.role,
          description: leg.description,
        })),
        dataRequirements: dataRequirements!,
        timestamp: Date.now(),
        params: effectiveParams,
      }

      // 使用与正式信号生成完全一致的多 leg 上下文构建器，
      // 自动注入 data/legs/execution/dataRequirements/timestamp 以及 helpers/Math/Date 等，
      // 并提供兼容字段 bars/symbol/timeframe/indicators/currentPrice。
      contextObject = buildMultiLegStrategyContext(scriptContext as MultiLegStrategyContext)
    } else {
      // 旧版单 leg 脚本：允许只传 bars / indicators / currentPrice
      if (!dto.bars || dto.bars.length === 0) {
        throw new BadRequestException('请至少提供一组 K 线数据 bars 用于脚本执行')
      }

      const primarySymbol =
        dto.symbol ??
        (Array.isArray(legs) && legs.length > 0 ? legs[0]!.symbol : undefined) ??
        'UNKNOWN'

      const primaryTimeframe =
        dto.timeframe ??
        (execution && execution.timeframe ? execution.timeframe : '1h')

      const strategyContext: StrategyContext = {
        bars: dto.bars.map(bar => ({
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          timestamp: bar.timestamp,
        })),
        symbol: primarySymbol,
        timeframe: primaryTimeframe,
        indicators: dto.indicators ?? {},
        currentPrice: dto.currentPrice,
        timestamp: Date.now(),
        params: effectiveParams,
      }

      scriptContext = strategyContext

      // 使用与正式单 leg 执行路径一致的上下文构建器，自动注入 helpers/Math/Date/JSON 等。
      contextObject = buildStrategyContext(strategyContext)
    }

    // 优先以标准模式执行（不包装 async 函数），新脚本使用最后表达式作为返回值
    let result = await engine.execute(strategy.script, {
      context: contextObject,
      timeout: StrategyInstancesService.DEBUG_SCRIPT_TIMEOUT_MS,
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
          `Test run for strategy instance ${id} detected script needs async context (${errorMsg}), retrying with allowAsync`,
        )
        result = await engine.execute(strategy.script, {
          context: contextObject,
          timeout: StrategyInstancesService.DEBUG_SCRIPT_TIMEOUT_MS,
          allowAsync: true,
        })
      }
    }

    if (!result.success) {
      const message =
        result.error?.message ??
        (result.error ? String(result.error) : '脚本执行失败（未知错误）')
      this.logger.error(
        `Test run for strategy instance ${id} failed: ${message}`,
        result.error instanceof Error ? result.error.stack : undefined,
      )
      throw new BadRequestException(`脚本执行失败：${message}`)
    }

    // 与正式执行路径保持一致：始终使用 validateScriptOutput 校验返回值类型
    // 即使 result.value 为 undefined，也应该明确报错，避免调试接口报告假阳性
    // 多leg策略不允许空对象（allowEmpty: false），与生产环境 SignalGeneratorService 保持一致
    const validation = validateScriptOutput(result.value, { allowEmpty: !isMultiLeg })

    if (!validation.valid || !validation.value) {
      const reason =
        validation.error ??
        `期望返回对象，实际类型为 ${typeof result.value}`

      this.logger.error(
        `Test run for strategy instance ${id} returned invalid script result: ${reason}`,
      )
      throw new BadRequestException(
        `脚本返回值类型不合法：${reason}`,
      )
    }

    const scriptResult = validation.value

    let filledPrompt: string | undefined
    if (strategy.promptTemplate) {
      // 使用 shared 的 fillPromptTemplate 函数，保证与实际执行一致
      filledPrompt = fillPromptTemplate(strategy.promptTemplate, scriptResult)
    }

    return {
      scriptResult,
      filledPrompt,
    }
  }

  /**
   * 验证状态转换是否合法
   */
  private validateStatusTransition(
    currentStatus: StrategyInstanceStatus,
    targetStatus: StrategyInstanceStatus,
  ): void {
    const validTransitions: Record<StrategyInstanceStatus, StrategyInstanceStatus[]> = {
      draft: ['running'],
      running: ['paused', 'stopped'],
      paused: ['running', 'stopped'],
      stopped: [],
    }

    const allowed = validTransitions[currentStatus]
    if (!allowed.includes(targetStatus)) {
      throw new InvalidInstanceStatusTransitionException({ currentStatus, targetStatus })
    }
  }

  /**
   * 验证模式转换的合法性
   * @param currentStatus 当前实例状态
   * @param currentMode 当前运行模式
   * @param targetMode 目标运行模式
   * @throws InvalidInstanceModeTransitionException 当转换不合法时
   */
  private validateModeTransition(
    currentStatus: StrategyInstanceStatus,
    currentMode: StrategyInstanceMode,
    targetMode: StrategyInstanceMode,
  ): void {
    // 规则1: 运行中的实例不允许切换模式
    if (currentStatus === 'running') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '运行中的实例无法切换模式，请先停止实例',
      })
    }

    // 规则2: LIVE 模式不允许切换到 BACKTEST（防止误操作）
    if (currentMode === 'LIVE' && targetMode === 'BACKTEST') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '实盘模式不允许切换到回测模式，这可能导致数据混淆',
      })
    }

    // 规则3: 已停止的实例不允许切换模式（防止历史数据混淆）
    if (currentStatus === 'stopped') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '已停止的实例无法切换模式，请创建新实例',
      })
    }

    this.logger.log(
      `Mode transition validated: ${currentMode} -> ${targetMode} (status: ${currentStatus})`,
    )
  }

  /**
   * 用户端：获取运行中的策略实例列表
   * 只返回 status='running' 且关联策略模板为 'live' 状态的实例
   */
  async listRunningInstances(
    query: LiveStrategyInstanceListQueryDto,
    userId?: string,
  ): Promise<BasePaginationResponseDto<StrategyInstancePublicResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const { items, total } = await this.instancesRepo.findRunningInstances({
      strategyTemplateId: query.strategyTemplateId,
      llmModel: query.llmModel,
      skip,
      take: limit,
    })

    // 如果用户已登录，查询订阅状态
    const subscriptionMap = new Map<string, boolean>()
    if (userId) {
      const client = this.prisma.getClient()
      const instanceIds = items.map(item => item.id)
      if (instanceIds.length > 0) {
        const subscriptions = await client.userStrategySubscription.findMany({
          where: {
            userId,
            strategyInstanceId: { in: instanceIds },
            status: 'active',
          },
          select: { 
            strategyInstanceId: true,
          },
        })
        subscriptions.forEach(sub => {
          subscriptionMap.set(sub.strategyInstanceId, true)
        })
      }
    }

    // 批量获取统计数据 (可选)
    let statsMap: Map<string, StrategyInstanceStatsDto | null> | undefined
    if (query.includeStats !== false && items.length > 0) {
      const instanceIds = items.map(item => item.id)
      try {
        statsMap = await this.statsService.calculateBatchStats(instanceIds)
      } catch (error) {
        this.logger.warn('Failed to calculate batch stats for running instances', error)
      }
    }

    const data = items.map(item => {
      const dto = this.toUserResponseDto(item, subscriptionMap)
      if (statsMap) {
        const stats = statsMap.get(item.id)
        if (stats) {
          dto.stats = stats
        }
      }
      return dto
    })

    return new BasePaginationResponseDto<StrategyInstancePublicResponseDto>(total, page, limit, data)
  }

  /**
   * 用户端：获取运行中的策略实例详情
   * 只返回 status='running' 且关联策略模板为 'live' 状态的实例
   */
  async getRunningInstanceDetail(
    id: string,
    userId?: string,
  ): Promise<StrategyInstancePublicResponseDto> {
    const instance = await this.instancesRepo.findByIdWithDetails(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    // 在生产环境严格限制，只允许查看运行中的 LIVE 实盘实例
    // 在本地开发环境，则放宽限制，方便调试和演示（只要存在就允许查看）
    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    if (!isDevEnv) {
      // 只能查看运行中的实例
      if (instance.status !== 'running') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }

      // 只能查看实盘模式的实例
      if (instance.mode !== 'LIVE') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }

      // 只能查看 live 状态模板下的实例，防止泄露未发布策略
      if (instance.strategyTemplate?.status !== 'live') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }
    }

    // 如果用户已登录，查询订阅状态
    const subscriptionMap = new Map<string, boolean>()
    if (userId) {
      const client = this.prisma.getClient()
      const subscription = await client.userStrategySubscription.findFirst({
        where: {
          userId,
          strategyInstanceId: id,
          status: 'active',
        },
        select: { id: true },
      })
      
      if (subscription) {
        subscriptionMap.set(id, true)
      }
    }

    const dto = this.toUserResponseDto(instance, subscriptionMap)
    
    // 获取统计数据（捕获错误）
    try {
      const stats = await this.statsService.calculateStats(id)
      if (stats) {
        dto.stats = stats
      }
    } catch (error) {
      this.logger.warn(`Failed to calculate stats for running instance ${id}`, error)
    }
    
    return dto
  }

  /**
   * 用户端：获取运行中的策略实例信号列表
   * 会先复用 getRunningInstanceDetail 做实例存在性与可见性校验，
   * 同时在非开发环境要求用户对该实例拥有有效订阅，然后再查询信号。
   */
  async getRunningInstanceSignals(
    id: string,
    query: StrategyInstanceSignalsListQueryDto,
    userId?: string,
  ): Promise<BasePaginationResponseDto<StrategyInstanceSignalPublicResponseDto>> {
    // 先校验实例是否存在且对当前环境/用户可见
    await this.getRunningInstanceDetail(id, userId)

    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    // 生产环境必须要求用户对该实例拥有有效订阅
    if (!isDevEnv) {
      if (!userId) {
        throw new ForbiddenException('需要登录后才能查看策略信号')
      }

      const client = this.prisma.getClient()
      const hasSubscription = await client.userStrategySubscription.findFirst({
        where: {
          userId,
          strategyInstanceId: id,
          status: SubscriptionStatus.active,
        },
        select: { id: true },
      })

      if (!hasSubscription) {
        throw new ForbiddenException('仅订阅该策略的用户可以查看详细信号')
      }
    }

    const page = query.page
    const limit = query.limit

    const result = await this.tradingSignalRepository.findMany({
      strategyInstanceId: id,
      page,
      limit,
    })

    const items = result.items.map(item => new StrategyInstanceSignalPublicResponseDto(item))

    return new BasePaginationResponseDto<StrategyInstanceSignalPublicResponseDto>(
      result.total,
      page,
      limit,
      items,
    )
  }

  private toResponseDto(instance: InstanceWithRelations): StrategyInstanceResponseDto {
    return {
      id: instance.id,
      strategyTemplateId: instance.strategyTemplateId,
      strategyTemplateName: instance.strategyTemplate?.name,
      name: instance.name,
      description: instance.description,
      llmModel: instance.llmModel,
      params: instance.params as Record<string, unknown> | null,
      status: instance.status,
      mode: instance.mode,
      startedAt: instance.startedAt,
      stoppedAt: instance.stoppedAt,
      createdBy: instance.createdBy,
      updatedBy: instance.updatedBy,
      metadata: instance.metadata as Record<string, unknown> | null,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    }
  }

  private toUserResponseDto(
    instance: InstanceWithRelations,
    subscriptionMap: Map<string, boolean>,
  ): StrategyInstancePublicResponseDto {
    return {
      id: instance.id,
      strategyTemplateId: instance.strategyTemplateId,
      strategyTemplateName: instance.strategyTemplate?.name,
      strategyTemplateDescription: instance.strategyTemplate?.description,
      name: instance.name,
      description: instance.description,
      llmModel: instance.llmModel,
      startedAt: instance.startedAt,
      isSubscribed: subscriptionMap.get(instance.id) ?? false,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    }
  }

  /**
   * 计算当前实例下脚本可用的参数：
   * - 模板 defaultParams 作为基础
   * - 实例 params 覆盖同名字段
   *
   * 与 SignalGeneratorService 中的逻辑保持一致，保证线上与调试环境行为一致。
   */
  private buildEffectiveParams(
    strategy: { defaultParams: Prisma.JsonValue | null },
    instance: { params: Prisma.JsonValue | null },
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
   * 获取策略实例的订阅详情
   * 包括订阅用户列表、总订阅金额、当前总仓位等信息
   * 
   * @param id 策略实例ID
   * @param page 订阅用户列表页码
   * @param limit 订阅用户列表每页数量
   */
  async getInstanceSubscriptionDetails(
    id: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<StrategyInstanceSubscriptionDetailsDto> {
    // 输入验证
    if (!id || typeof id !== 'string' || id.length < 20) {
      throw new BadRequestException('Invalid strategy instance ID')
    }

    const instance = await this.instancesRepo.findByIdWithDetails(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    const client = this.prisma.getClient()

    // 1. 使用数据库聚合获取订阅统计（避免加载全部记录）
    const [totalCount, statusStats] = await Promise.all([
      // 总订阅数
      client.userStrategySubscription.count({
        where: { strategyInstanceId: id },
      }),
      // 按状态分组统计
      client.userStrategySubscription.groupBy({
        by: ['status'],
        where: { strategyInstanceId: id },
        _count: true,
      }),
    ])

    // 统计订阅数量
    const activeSubscribers = statusStats.find(s => s.status === 'active')?._count ?? 0
    const pausedSubscribers = statusStats.find(s => s.status === 'paused')?._count ?? 0
    const cancelledSubscribers = statusStats.find(s => s.status === 'cancelled')?._count ?? 0

    // 分页获取订阅详情
    const skip = (page - 1) * limit
    const subscriptions = await client.userStrategySubscription.findMany({
      where: {
        strategyInstanceId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            email: true,
          },
        },
        exchangeAccount: {
          select: {
            id: true,
            exchangeId: true,
            name: true,
          },
        },
      },
      orderBy: {
        subscribedAt: 'desc',
      },
      skip,
      take: limit,
    })

    // 2. 使用数据库端聚合计算总体金额和持仓（仅统计 active/paused 状态）
    // 只有 active 和 paused 状态的订阅才占用额度，cancelled 的不应计入当前指标
    const activeStatuses: SubscriptionStatus[] = [SubscriptionStatus.active, SubscriptionStatus.paused]
    
    let totalSubscriptionAmount = new Decimal(0)
    let totalCurrentPositionAmount = new Decimal(0)
    let totalOpenPositions = 0

    // 使用数据库端 aggregate，避免传输全部用户ID到应用层
    // 聚合账户总余额（仅 active/paused 状态的订阅用户）
    const accountAggregate = await client.userStrategyAccount.aggregate({
      where: {
        strategyId: instance.strategyTemplateId,
        user: {
          strategySubscriptions: {
            some: {
              strategyInstanceId: id,
              status: { in: activeStatuses },
            },
          },
        },
      },
      _sum: {
        initialBalance: true,
      },
    })
    totalSubscriptionAmount = new Decimal(accountAggregate._sum.initialBalance ?? 0)

    // 聚合持仓数量和市值（通过 account 关联到订阅状态）
    // 使用原始 SQL 一次性完成 JOIN 和聚合
    const positionAggregateResult = await client.$queryRaw<Array<{ 
      totalPositions: bigint
      totalValue: any 
    }>>`
      SELECT 
        COALESCE(COUNT(*), 0) as "totalPositions",
        COALESCE(SUM(p.quantity * p.avg_entry_price), 0) as "totalValue"
      FROM positions p
      INNER JOIN user_strategy_accounts usa ON p.user_strategy_account_id = usa.id
      INNER JOIN user_strategy_subscriptions uss ON usa.user_id = uss.user_id
      WHERE usa.strategy_id = ${instance.strategyTemplateId}
        AND uss.strategy_instance_id = ${id}
        AND uss.status = ANY(ARRAY['active', 'paused']::"SubscriptionStatus"[])
        AND p.status = 'OPEN'
    `
    
    if (positionAggregateResult.length > 0) {
      totalOpenPositions = Number(positionAggregateResult[0].totalPositions)
      if (positionAggregateResult[0].totalValue != null) {
        totalCurrentPositionAmount = new Decimal(positionAggregateResult[0].totalValue.toString())
      }
    }

    // 4. 为当前页用户获取详细数据（仅当前页）
    const pageUserIds = subscriptions.map(s => s.userId)
    const pageAccounts = await client.userStrategyAccount.findMany({
      where: {
        userId: { in: pageUserIds },
        strategyId: instance.strategyTemplateId,
      },
      select: {
        id: true,
        userId: true,
        initialBalance: true,
      },
    })

    // 创建用户ID到账户的映射
    const accountMap = new Map(pageAccounts.map(a => [a.userId, a]))
    const pageAccountIds = pageAccounts.map(a => a.id)

    // 获取当前页用户的持仓信息
    const pagePositions = await client.position.findMany({
      where: {
        userStrategyAccountId: { in: pageAccountIds },
        status: 'OPEN',
      },
      select: {
        userStrategyAccountId: true,
        quantity: true,
        avgEntryPrice: true,
      },
    })

    // 按账户分组持仓
    const positionsByAccountId = new Map<string, typeof pagePositions[0][]>()
    for (const pos of pagePositions) {
      const existing = positionsByAccountId.get(pos.userStrategyAccountId) ?? []
      existing.push(pos)
      positionsByAccountId.set(pos.userStrategyAccountId, existing)
    }

    // 构建当前页订阅用户列表
    const subscribers: SubscriberInfoDto[] = subscriptions.map(sub => {
      const account = accountMap.get(sub.userId)
      const accountId = account?.id
      const accountPositions = accountId ? (positionsByAccountId.get(accountId) ?? []) : []

      // 计算当前仓位金额（quantity * avgEntryPrice 的总和）
      let currentPositionAmount = new Decimal(0)
      for (const pos of accountPositions) {
        const posValue = new Decimal(pos.quantity).times(pos.avgEntryPrice)
        currentPositionAmount = currentPositionAmount.plus(posValue)
      }

      // 订阅金额使用账户的初始余额
      const subscriptionAmount = account?.initialBalance ?? new Decimal(0)

      return {
        userId: sub.userId,
        username: sub.user?.nickname ?? undefined,
        email: sub.user?.email ?? undefined,
        status: sub.status,
        subscriptionAmount: subscriptionAmount.toNumber(),
        currentPositionAmount: currentPositionAmount.toNumber(),
        openPositionsCount: accountPositions.length,
        exchangeAccountId: sub.exchangeAccountId ?? undefined,
        exchangeName: sub.exchangeAccount?.name ?? undefined,
        subscribedAt: sub.subscribedAt,
        customParams: sub.customParams as Record<string, any> | undefined,
      }
    })

    // 计算平均仓位占比
    const averagePositionRatio = totalSubscriptionAmount.greaterThan(0)
      ? totalCurrentPositionAmount.dividedBy(totalSubscriptionAmount).times(100).toNumber()
      : 0

    return {
      strategyInstanceId: instance.id,
      strategyInstanceName: instance.name,
      strategyTemplateName: instance.strategyTemplate?.name ?? '',
      totalSubscribers: totalCount,
      activeSubscribers,
      pausedSubscribers,
      cancelledSubscribers,
      totalSubscriptionAmount: totalSubscriptionAmount.toNumber(),
      totalCurrentPositionAmount: totalCurrentPositionAmount.toNumber(),
      averagePositionRatio,
      totalOpenPositions,
      subscribers,
      totalSubscribersCount: totalCount,
      currentPage: page,
      pageSize: limit,
      lastUpdatedAt: new Date(),
    }
  }
}
