/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄥ拰渚濊禆娉ㄥ叆闇€瑕佽繍琛屾椂瀵煎叆 */
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

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
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
 * 璋冭瘯鎺ュ彛涓?multiLegData 姣忎釜 timeframe 鐨勮緭鍏ョ粨鏋?
 * 鍙湪 StrategyInstancesService 鍐呴儴浣跨敤锛岀敤浜庣被鍨嬫敹绐勶紝閬垮厤 unknown 璁块棶灞炴€ф椂鎶ラ敊銆?
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

    // 楠岃瘉绛栫暐妯℃澘鏄惁瀛樺湪
    const template = await client.strategyTemplate.findUnique({
      where: { id: dto.strategyTemplateId },
      select: { id: true, name: true },
    })

    if (!template) {
      throw new StrategyTemplateNotFoundException({ templateId: dto.strategyTemplateId })
    }

    // 妫€鏌ユ槸鍚﹀瓨鍦ㄥ悓鍚嶅疄渚嬶紙鍚屼竴妯℃澘 + 鍚屼竴 LLM 妯″瀷 + 鍚屼竴鍚嶇О锛?
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
      `鍒涘缓绛栫暐瀹炰緥鎴愬姛: ${created.id}, 妯℃澘: ${dto.strategyTemplateId}, LLM: ${dto.llmModel}`,
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

    // 鎵归噺鑾峰彇缁熻鏁版嵁 (鍙€?
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

    // 鑾峰彇缁熻鏁版嵁锛堟崟鑾烽敊璇紝涓嶅奖鍝嶄富娴佺▼锛?
    try {
      const stats = await this.statsService.calculateStats(id)
      if (stats) {
        dto.stats = stats
      }
    } catch (error) {
      this.logger.warn(`Failed to calculate stats for instance ${id}`, error)
      // 缁х画杩斿洖涓嶅惈缁熻鏁版嵁鐨勫搷搴?
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

    // 濡傛灉瑕佹洿鏂板悕绉版垨 LLM 妯″瀷锛屾鏌ユ槸鍚﹀瓨鍦ㄥ啿绐?
    if (dto.name || dto.llmModel) {
      const newName = dto.name ?? instance.name
      const newLlmModel = dto.llmModel ?? instance.llmModel

      const exists = await this.instancesRepo.existsByTemplateModelName(
        instance.strategyTemplateId,
        newLlmModel,
        newName,
        id, // 鎺掗櫎鑷繁
      )

      if (exists) {
        throw new StrategyInstanceNameConflictException({
          strategyTemplateId: instance.strategyTemplateId,
          llmModel: newLlmModel,
          name: newName,
        })
      }
    }

    // 鐘舵€佽浆鎹㈤獙璇?
    if (dto.status && dto.status !== instance.status) {
      this.validateStatusTransition(instance.status, dto.status)

      // 馃敶 鍏抽敭鏍￠獙锛氬垏鎹㈠埌 running 鐘舵€佹椂锛屽己鍒惰姹?mode 蹇呴』涓?LIVE
      // 闃叉绠＄悊鍛樺惎鍔?PAPER/TESTNET/BACKTEST 瀹炰緥瀵艰嚧鐢ㄦ埛绔笉鍙
      // 锛堝洜涓?C 绔帴鍙ｅ凡寮哄埗杩囨护 mode !== 'LIVE' 鐨勫疄渚嬶級
      if (dto.status === 'running') {
        const finalMode = dto.mode ?? instance.mode
        if (finalMode !== 'LIVE') {
          throw new InvalidInstanceModeTransitionException({
            from: finalMode,
            to: 'LIVE',
            reason: '鍚姩瀹炰緥鏃跺繀椤讳娇鐢ㄥ疄鐩樻ā寮忥紙LIVE锛夛紝浠ョ‘淇濈敤鎴风鍙銆傝鍏堝垏鎹㈠埌 LIVE 妯″紡鍐嶅惎鍔?
          })
        }
      }
    }

    // 妯″紡杞崲楠岃瘉
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

      // 鐘舵€佽浆鎹㈡椂鑷姩璁剧疆鏃堕棿鎴?
      if (dto.status === 'running' && instance.status !== 'running') {
        updatePayload.startedAt = new Date()
        updatePayload.stoppedAt = null
      } else if (dto.status === 'stopped' && instance.status !== 'stopped') {
        updatePayload.stoppedAt = new Date()
      } else if (dto.status === 'paused' && instance.status === 'running') {
        // 鏆傚仠鏃朵繚鐣?startedAt锛屼笉璁剧疆 stoppedAt
      }
    }

    if (updatedBy) {
      updatePayload.updatedBy = updatedBy
    }

    // 濡傛灉娌℃湁浠讳綍瀛楁闇€瑕佹洿鏂帮紝鐩存帴杩斿洖褰撳墠璇︽儏
    if (Object.keys(updatePayload).length === 0) {
      const currentDetail = await this.instancesRepo.findByIdWithDetails(id)
      if (!currentDetail) {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }
      return this.toResponseDto(currentDetail)
    }

    const updated = await this.instancesRepo.update(id, updatePayload)
    this.logger.log(`鏇存柊绛栫暐瀹炰緥: ${id}, 鐘舵€? ${updated.status}`)

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

    // 鍙湁 draft 鐘舵€佺殑瀹炰緥鍙互鍒犻櫎
    if (instance.status !== 'draft') {
      throw new InvalidInstanceStatusTransitionException({ currentStatus: instance.status, targetStatus: 'deleted' })
    }

    await this.instancesRepo.delete(id)
    this.logger.log(`鍒犻櫎绛栫暐瀹炰緥: ${id}`)
  }

  /**
   * 鏋勯€犱竴涓敤浜庡疄渚嬫鏌ョ殑榛樿璇锋眰浣擄紙涓昏閽堝澶?Leg 澶氬懆鏈熸灦鏋勶級
   *
   * 浠庡競鍦鸿鎯呰〃涓媺鍙栨渶杩戜竴娈?K 绾挎暟鎹紝鎸?legs + dataRequirements 缁勫悎鎴?multiLegData 杩斿洖銆?
   * 涓嶄細鐢熸垚浠讳綍淇″彿锛屼粎鐢ㄤ簬璋冪敤鏂瑰揩閫熸瀯閫犺皟璇曞弬鏁般€?
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
      // 鏃х増鍗?leg 鏋舵瀯锛氳皟鐢ㄦ柟闇€鎵嬪姩濉啓 bars/indicators/currentPrice
      throw new BadRequestException(
        '褰撳墠绛栫暐妯℃澘鏈娇鐢ㄥ Leg 澶氬懆鏈熸灦鏋勶紝鍙洿鎺ュ湪璇锋眰浣撲腑鎵嬪姩濉啓 bars/indicators/currentPrice 杩涜璋冭瘯',
      )
    }

    // 1. 鎵归噺鍔犺浇鎵€鏈?symbols
    const symbolCodes = legs!.map(leg => leg.symbol)
    const symbols = await client.symbol.findMany({
      where: { code: { in: symbolCodes } },
    })
    const symbolMap = new Map(symbols.map(s => [s.code, s]))

    // 2. 鏀堕泦鎵€鏈夐渶瑕佸姞杞界殑 (legId, symbolId, timeframe) 缁勫悎
    interface DataRequest {
      legId: string
      symbolId: string
      timeframe: PrismaMarketTimeframe // Prisma 鏋氫妇鏍煎紡锛堝 'h1'锛?
      originalTimeframe: string // 搴旂敤灞傛牸寮忥紙濡?'1h'锛?
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

    // 3. 涓烘瘡涓粍鍚堝姞杞芥渶杩戜竴娈?K 绾?
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

      // 鐩墠鎸囨爣鏆備笉浠庢暟鎹簱鍔犺浇锛岀暀绌虹粰鑴氭湰浣跨敤 K 绾胯嚜琛岃绠楁垨鐢辫皟璇曡€呰ˉ鍏?
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
   * 涓诲姩瑙﹀彂绛栫暐瀹炰緥妫€鏌ワ紙璋冭瘯鐢級
   *
   * - 涓嶄細鍐欏叆 TradingSignal / 浠撲綅绛変笟鍔¤〃锛屼粎鎵ц鑴氭湰骞惰繑鍥炵粨鏋?
   * - 鏃㈡敮鎸佹棫鐗堝崟 leg 鑴氭湰锛屼篃鏀寔鏂扮増澶?leg 澶氬懆鏈熻剼鏈?
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
      throw new BadRequestException('绛栫暐妯℃澘鏈厤缃剼鏈紙script锛夛紝鏃犳硶鎵ц瀹炰緥妫€鏌?)
    }

    if (!strategy.promptTemplate) {
      this.logger.warn(
        `Strategy ${strategy.id} has no promptTemplate, test run will only return scriptResult`,
      )
    }

    const engine = createScriptEngine()

    // 涓庢寮忔墽琛岃矾寰勪繚鎸佷竴鑷达細鍚堝苟妯℃澘 defaultParams 涓庡疄渚?params
    const effectiveParams = this.buildEffectiveParams(strategy, instance)

    // 浼樺厛浣跨敤鏂扮増澶?leg 澶氬懆鏈熶笂涓嬫枃锛堝綋妯℃澘閰嶇疆浜?legs 涓?dataRequirements 鏃讹級
    const isMultiLeg =
      !!execution && !!dataRequirements && !!legs && Array.isArray(legs) && legs.length > 0

    let scriptContext: StrategyContext | MultiLegStrategyContext
    let contextObject: Record<string, unknown>

    if (isMultiLeg) {
      if (!dto.multiLegData || Object.keys(dto.multiLegData).length === 0) {
        throw new BadRequestException(
          '褰撳墠绛栫暐妯℃澘浣跨敤澶?Leg 澶氬懆鏈熸灦鏋勶紝璇峰湪璇锋眰浣撲腑鎻愪緵 multiLegData锛堟寜 legId + timeframe 缁勭粐鐨勬暟鎹級',
        )
      }

      // 鍩烘湰鏍￠獙锛氱‘淇?dataRequirements 涓０鏄庣殑鎵€鏈?leg/timeframe 閮芥湁瀵瑰簲鏁版嵁锛屾柟渚挎彁鍓嶅彂鐜伴厤缃棶棰?
      for (const leg of legs!) {
        const requiredTimeframes = dataRequirements![leg.id]
        if (!requiredTimeframes || requiredTimeframes.length === 0) continue

        for (const timeframe of requiredTimeframes) {
          const legData = dto.multiLegData?.[leg.id]?.[timeframe] as TestLegTimeframeInput | undefined
          if (!legData) {
            throw new BadRequestException(
              `multiLegData 缂哄皯 leg "${leg.id}" 鍦ㄥ懆鏈?"${timeframe}" 鐨勬暟鎹紝璇疯ˉ鍏呭悗閲嶈瘯`,
            )
          }

          if (!Array.isArray(legData.bars) || legData.bars.length === 0) {
            throw new BadRequestException(
              `multiLegData 涓?leg "${leg.id}" 鍦ㄥ懆鏈?"${timeframe}" 鐨?bars 涓虹┖锛屾棤娉曟墽琛岃剼鏈琡,
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

      // 浣跨敤涓庢寮忎俊鍙风敓鎴愬畬鍏ㄤ竴鑷寸殑澶?leg 涓婁笅鏂囨瀯寤哄櫒锛?
      // 鑷姩娉ㄥ叆 data/legs/execution/dataRequirements/timestamp 浠ュ強 helpers/Math/Date 绛夛紝
      // 骞舵彁渚涘吋瀹瑰瓧娈?bars/symbol/timeframe/indicators/currentPrice銆?
      contextObject = buildMultiLegStrategyContext(scriptContext as MultiLegStrategyContext)
    } else {
      // 鏃х増鍗?leg 鑴氭湰锛氬厑璁稿彧浼?bars / indicators / currentPrice
      if (!dto.bars || dto.bars.length === 0) {
        throw new BadRequestException('璇疯嚦灏戞彁渚涗竴缁?K 绾挎暟鎹?bars 鐢ㄤ簬鑴氭湰鎵ц')
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

      // 浣跨敤涓庢寮忓崟 leg 鎵ц璺緞涓€鑷寸殑涓婁笅鏂囨瀯寤哄櫒锛岃嚜鍔ㄦ敞鍏?helpers/Math/Date/JSON 绛夈€?
      contextObject = buildStrategyContext(strategyContext)
    }

    // 浼樺厛浠ユ爣鍑嗘ā寮忔墽琛岋紙涓嶅寘瑁?async 鍑芥暟锛夛紝鏂拌剼鏈娇鐢ㄦ渶鍚庤〃杈惧紡浣滀负杩斿洖鍊?
    let result = await engine.execute(strategy.script, {
      context: contextObject,
      timeout: StrategyInstancesService.DEBUG_SCRIPT_TIMEOUT_MS,
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
        (result.error ? String(result.error) : '鑴氭湰鎵ц澶辫触锛堟湭鐭ラ敊璇級')
      this.logger.error(
        `Test run for strategy instance ${id} failed: ${message}`,
        result.error instanceof Error ? result.error.stack : undefined,
      )
      throw new BadRequestException(`鑴氭湰鎵ц澶辫触锛?{message}`)
    }

    // 涓庢寮忔墽琛岃矾寰勪繚鎸佷竴鑷达細濮嬬粓浣跨敤 validateScriptOutput 鏍￠獙杩斿洖鍊肩被鍨?
    // 鍗充娇 result.value 涓?undefined锛屼篃搴旇鏄庣‘鎶ラ敊锛岄伩鍏嶈皟璇曟帴鍙ｆ姤鍛婂亣闃虫€?
    // 澶歭eg绛栫暐涓嶅厑璁哥┖瀵硅薄锛坅llowEmpty: false锛夛紝涓庣敓浜х幆澧?SignalGeneratorService 淇濇寔涓€鑷?
    const validation = validateScriptOutput(result.value, { allowEmpty: !isMultiLeg })

    if (!validation.valid || !validation.value) {
      const reason =
        validation.error ??
        `鏈熸湜杩斿洖瀵硅薄锛屽疄闄呯被鍨嬩负 ${typeof result.value}`

      this.logger.error(
        `Test run for strategy instance ${id} returned invalid script result: ${reason}`,
      )
      throw new BadRequestException(
        `鑴氭湰杩斿洖鍊肩被鍨嬩笉鍚堟硶锛?{reason}`,
      )
    }

    const scriptResult = validation.value

    let filledPrompt: string | undefined
    if (strategy.promptTemplate) {
      // 浣跨敤 shared 鐨?fillPromptTemplate 鍑芥暟锛屼繚璇佷笌瀹為檯鎵ц涓€鑷?
      filledPrompt = fillPromptTemplate(strategy.promptTemplate, scriptResult)
    }

    return {
      scriptResult,
      filledPrompt,
    }
  }

  /**
   * 楠岃瘉鐘舵€佽浆鎹㈡槸鍚﹀悎娉?
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
   * 楠岃瘉妯″紡杞崲鐨勫悎娉曟€?
   * @param currentStatus 褰撳墠瀹炰緥鐘舵€?
   * @param currentMode 褰撳墠杩愯妯″紡
   * @param targetMode 鐩爣杩愯妯″紡
   * @throws InvalidInstanceModeTransitionException 褰撹浆鎹笉鍚堟硶鏃?
   */
  private validateModeTransition(
    currentStatus: StrategyInstanceStatus,
    currentMode: StrategyInstanceMode,
    targetMode: StrategyInstanceMode,
  ): void {
    // 瑙勫垯1: 杩愯涓殑瀹炰緥涓嶅厑璁稿垏鎹㈡ā寮?
    if (currentStatus === 'running') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '杩愯涓殑瀹炰緥鏃犳硶鍒囨崲妯″紡锛岃鍏堝仠姝㈠疄渚?,
      })
    }

    // 瑙勫垯2: LIVE 妯″紡涓嶅厑璁稿垏鎹㈠埌 BACKTEST锛堥槻姝㈣鎿嶄綔锛?
    if (currentMode === 'LIVE' && targetMode === 'BACKTEST') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '瀹炵洏妯″紡涓嶅厑璁稿垏鎹㈠埌鍥炴祴妯″紡锛岃繖鍙兘瀵艰嚧鏁版嵁娣锋穯',
      })
    }

    // 瑙勫垯3: 宸插仠姝㈢殑瀹炰緥涓嶅厑璁稿垏鎹㈡ā寮忥紙闃叉鍘嗗彶鏁版嵁娣锋穯锛?
    if (currentStatus === 'stopped') {
      throw new InvalidInstanceModeTransitionException({
        from: currentMode,
        to: targetMode,
        reason: '宸插仠姝㈢殑瀹炰緥鏃犳硶鍒囨崲妯″紡锛岃鍒涘缓鏂板疄渚?,
      })
    }

    this.logger.log(
      `Mode transition validated: ${currentMode} -> ${targetMode} (status: ${currentStatus})`,
    )
  }

  /**
   * 鐢ㄦ埛绔細鑾峰彇杩愯涓殑绛栫暐瀹炰緥鍒楄〃
   * 鍙繑鍥?status='running' 涓斿叧鑱旂瓥鐣ユā鏉夸负 'live' 鐘舵€佺殑瀹炰緥
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

    // 濡傛灉鐢ㄦ埛宸茬櫥褰曪紝鏌ヨ璁㈤槄鐘舵€?
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

    // 鎵归噺鑾峰彇缁熻鏁版嵁 (鍙€?
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
   * 鐢ㄦ埛绔細鑾峰彇杩愯涓殑绛栫暐瀹炰緥璇︽儏
   * 鍙繑鍥?status='running' 涓斿叧鑱旂瓥鐣ユā鏉夸负 'live' 鐘舵€佺殑瀹炰緥
   */
  async getRunningInstanceDetail(
    id: string,
    userId?: string,
  ): Promise<StrategyInstancePublicResponseDto> {
    const instance = await this.instancesRepo.findByIdWithDetails(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    // 鍦ㄧ敓浜х幆澧冧弗鏍奸檺鍒讹紝鍙厑璁告煡鐪嬭繍琛屼腑鐨?LIVE 瀹炵洏瀹炰緥
    // 鍦ㄦ湰鍦板紑鍙戠幆澧冿紝鍒欐斁瀹介檺鍒讹紝鏂逛究璋冭瘯鍜屾紨绀猴紙鍙瀛樺湪灏卞厑璁告煡鐪嬶級
    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    if (!isDevEnv) {
      // 鍙兘鏌ョ湅杩愯涓殑瀹炰緥
      if (instance.status !== 'running') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }

      // 鍙兘鏌ョ湅瀹炵洏妯″紡鐨勫疄渚?
      if (instance.mode !== 'LIVE') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }

      // 鍙兘鏌ョ湅 live 鐘舵€佹ā鏉夸笅鐨勫疄渚嬶紝闃叉娉勯湶鏈彂甯冪瓥鐣?
      if (instance.strategyTemplate?.status !== 'live') {
        throw new StrategyInstanceNotFoundException({ instanceId: id })
      }
    }

    // 濡傛灉鐢ㄦ埛宸茬櫥褰曪紝鏌ヨ璁㈤槄鐘舵€?
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

    // 鑾峰彇缁熻鏁版嵁锛堟崟鑾烽敊璇級
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
   * 鐢ㄦ埛绔細鑾峰彇杩愯涓殑绛栫暐瀹炰緥淇″彿鍒楄〃
   * 浼氬厛澶嶇敤 getRunningInstanceDetail 鍋氬疄渚嬪瓨鍦ㄦ€т笌鍙鎬ф牎楠岋紝
   * 鍚屾椂鍦ㄩ潪寮€鍙戠幆澧冭姹傜敤鎴峰璇ュ疄渚嬫嫢鏈夋湁鏁堣闃咃紝鐒跺悗鍐嶆煡璇俊鍙枫€?
   */
  async getRunningInstanceSignals(
    id: string,
    query: StrategyInstanceSignalsListQueryDto,
    userId?: string,
  ): Promise<BasePaginationResponseDto<StrategyInstanceSignalPublicResponseDto>> {
    // 鍏堟牎楠屽疄渚嬫槸鍚﹀瓨鍦ㄤ笖瀵瑰綋鍓嶇幆澧?鐢ㄦ埛鍙
    await this.getRunningInstanceDetail(id, userId)

    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    // 鐢熶骇鐜蹇呴』瑕佹眰鐢ㄦ埛瀵硅瀹炰緥鎷ユ湁鏈夋晥璁㈤槄
    if (!isDevEnv) {
      if (!userId) {
        throw new ForbiddenException('闇€瑕佺櫥褰曞悗鎵嶈兘鏌ョ湅绛栫暐淇″彿')
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
        throw new ForbiddenException('浠呰闃呰绛栫暐鐨勭敤鎴峰彲浠ユ煡鐪嬭缁嗕俊鍙?)
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
   * 璁＄畻褰撳墠瀹炰緥涓嬭剼鏈彲鐢ㄧ殑鍙傛暟锛?
   * - 妯℃澘 defaultParams 浣滀负鍩虹
   * - 瀹炰緥 params 瑕嗙洊鍚屽悕瀛楁
   *
   * 涓?SignalGeneratorService 涓殑閫昏緫淇濇寔涓€鑷达紝淇濊瘉绾夸笂涓庤皟璇曠幆澧冭涓轰竴鑷淬€?
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
   * 鑾峰彇绛栫暐瀹炰緥鐨勮闃呰鎯?
   * 鍖呮嫭璁㈤槄鐢ㄦ埛鍒楄〃銆佹€昏闃呴噾棰濄€佸綋鍓嶆€讳粨浣嶇瓑淇℃伅
   *
   * @param id 绛栫暐瀹炰緥ID
   * @param page 璁㈤槄鐢ㄦ埛鍒楄〃椤电爜
   * @param limit 璁㈤槄鐢ㄦ埛鍒楄〃姣忛〉鏁伴噺
   */
  async getInstanceSubscriptionDetails(
    id: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<StrategyInstanceSubscriptionDetailsDto> {
    // 杈撳叆楠岃瘉
    if (!id || typeof id !== 'string' || id.length < 20) {
      throw new BadRequestException('Invalid strategy instance ID')
    }

    const instance = await this.instancesRepo.findByIdWithDetails(id)
    if (!instance) {
      throw new StrategyInstanceNotFoundException({ instanceId: id })
    }

    const client = this.prisma.getClient()

    // 1. 浣跨敤鏁版嵁搴撹仛鍚堣幏鍙栬闃呯粺璁★紙閬垮厤鍔犺浇鍏ㄩ儴璁板綍锛?
    const [totalCount, statusStats] = await Promise.all([
      // 鎬昏闃呮暟
      client.userStrategySubscription.count({
        where: { strategyInstanceId: id },
      }),
      // 鎸夌姸鎬佸垎缁勭粺璁?
      client.userStrategySubscription.groupBy({
        by: ['status'],
        where: { strategyInstanceId: id },
        _count: true,
      }),
    ])

    // 缁熻璁㈤槄鏁伴噺
    const activeSubscribers = statusStats.find(s => s.status === 'active')?._count ?? 0
    const pausedSubscribers = statusStats.find(s => s.status === 'paused')?._count ?? 0
    const cancelledSubscribers = statusStats.find(s => s.status === 'cancelled')?._count ?? 0

    // 鍒嗛〉鑾峰彇璁㈤槄璇︽儏
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

    // 2. 浣跨敤鏁版嵁搴撶鑱氬悎璁＄畻鎬讳綋閲戦鍜屾寔浠擄紙浠呯粺璁?active/paused 鐘舵€侊級
    // 鍙湁 active 鍜?paused 鐘舵€佺殑璁㈤槄鎵嶅崰鐢ㄩ搴︼紝cancelled 鐨勪笉搴旇鍏ュ綋鍓嶆寚鏍?
    const activeStatuses: SubscriptionStatus[] = [SubscriptionStatus.active, SubscriptionStatus.paused]

    let totalSubscriptionAmount = new Decimal(0)
    let totalCurrentPositionAmount = new Decimal(0)
    let totalOpenPositions = 0

    // 浣跨敤鏁版嵁搴撶 aggregate锛岄伩鍏嶄紶杈撳叏閮ㄧ敤鎴稩D鍒板簲鐢ㄥ眰
    // 鑱氬悎璐︽埛鎬讳綑棰濓紙浠?active/paused 鐘舵€佺殑璁㈤槄鐢ㄦ埛锛?
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

    // 鑱氬悎鎸佷粨鏁伴噺鍜屽競鍊硷紙閫氳繃 account 鍏宠仈鍒拌闃呯姸鎬侊級
    // 浣跨敤鍘熷 SQL 涓€娆℃€у畬鎴?JOIN 鍜岃仛鍚?
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

    // 4. 涓哄綋鍓嶉〉鐢ㄦ埛鑾峰彇璇︾粏鏁版嵁锛堜粎褰撳墠椤碉級
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

    // 鍒涘缓鐢ㄦ埛ID鍒拌处鎴风殑鏄犲皠
    const accountMap = new Map(pageAccounts.map(a => [a.userId, a]))
    const pageAccountIds = pageAccounts.map(a => a.id)

    // 鑾峰彇褰撳墠椤电敤鎴风殑鎸佷粨淇℃伅
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

    // 鎸夎处鎴峰垎缁勬寔浠?
    const positionsByAccountId = new Map<string, typeof pagePositions[0][]>()
    for (const pos of pagePositions) {
      const existing = positionsByAccountId.get(pos.userStrategyAccountId) ?? []
      existing.push(pos)
      positionsByAccountId.set(pos.userStrategyAccountId, existing)
    }

    // 鏋勫缓褰撳墠椤佃闃呯敤鎴峰垪琛?
    const subscribers: SubscriberInfoDto[] = subscriptions.map(sub => {
      const account = accountMap.get(sub.userId)
      const accountId = account?.id
      const accountPositions = accountId ? (positionsByAccountId.get(accountId) ?? []) : []

      // 璁＄畻褰撳墠浠撲綅閲戦锛坬uantity * avgEntryPrice 鐨勬€诲拰锛?
      let currentPositionAmount = new Decimal(0)
      for (const pos of accountPositions) {
        const posValue = new Decimal(pos.quantity).times(pos.avgEntryPrice)
        currentPositionAmount = currentPositionAmount.plus(posValue)
      }

      // 璁㈤槄閲戦浣跨敤璐︽埛鐨勫垵濮嬩綑棰?
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

    // 璁＄畻骞冲潎浠撲綅鍗犳瘮
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
