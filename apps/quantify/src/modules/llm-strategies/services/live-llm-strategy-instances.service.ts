import type { LlmStrategyInstanceMode, LlmStrategyInstanceStatus } from '@prisma/client'
import type { LiveLlmStrategyInstanceListQueryDto } from '../dto/live-llm-strategy-instance-list-query.dto'
import type { LiveLlmStrategySignalsQueryDto } from '../dto/live-llm-strategy-signals-query.dto'
import { ForbiddenException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest 娉ㄥ叆闇€瑕佽繍琛屾椂绫?
import { PrismaService } from '@/prisma/prisma.service'
import { LlmStrategyInstancePublicResponseDto } from '../dto/live-llm-strategy-instance-response.dto'
import { LlmStrategyInstanceNotFoundException } from '../exceptions/llm-strategy-instance-not-found.exception'

@Injectable()
export class LiveLlmStrategyInstancesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 鍏紑鍏ュ彛锛氳幏鍙栬繍琛屼腑鐨?LLM 绛栫暐瀹炰緥鍒楄〃
   * - 鐢熶骇鐜锛氫粎杩斿洖 status=running 涓?mode=LIVE 涓旀墍灞炵瓥鐣ヤ负 live 鐨勫疄渚?
   * - 寮€鍙戠幆澧冿細鏀惧闄愬埗锛堜富瑕佺敤浜庢湰鍦拌仈璋冿級
   */
  async listRunningInstances(
    query: LiveLlmStrategyInstanceListQueryDto,
    userId?: string,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstancePublicResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const client = this.prisma.getClient()

    // 涓轰簡涓庝骇鍝侀鏈熶竴鑷达細鏃犺鐜閮藉彧杩斿洖鈥滆繍琛屼腑鈥濈殑瀹炰緥
    // - status 蹇呴』涓?running
    // - mode 蹇呴』涓?LIVE
    // - 鎵€灞炵瓥鐣ュ繀椤讳负 live
    const where = {
      status: 'running' as LlmStrategyInstanceStatus,
      mode: 'LIVE' as LlmStrategyInstanceMode,
      strategy: { status: 'live' as const },
      ...(query.llmModel ? { llmModel: query.llmModel } : {}),
      ...(query.strategyId ? { strategyId: query.strategyId } : {}),
    }

    const [items, total] = await Promise.all([
      client.llmStrategyInstance.findMany({
        where,
        include: {
          strategy: { select: { name: true, description: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      client.llmStrategyInstance.count({ where }),
    ])

    const subscriptionMap = new Map<string, boolean>()
    if (userId) {
      const instanceIds = items.map(item => item.id)
      if (instanceIds.length > 0) {
        try {
          const subs = await client.userLlmStrategySubscription.findMany({
            where: {
              userId,
              llmStrategyInstanceId: { in: instanceIds },
              status: 'active',
            },
            select: { llmStrategyInstanceId: true },
          })
          subs.forEach(sub => subscriptionMap.set(sub.llmStrategyInstanceId, true))
        } catch (error) {
          // 鏈湴寮€鍙戠幆澧冨彲鑳藉皻鏈墽琛?LLM 璁㈤槄鐩稿叧杩佺Щ锛岃〃涓嶅瓨鍦ㄦ椂闄嶇骇涓烘湭璁㈤槄鐘舵€?
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2021' &&
            String(error.message).includes('user_llm_strategy_subscriptions')
          ) {
            // ignore and treat all as not subscribed
          } else {
            throw error
          }
        }
      }
    }

    const data = items.map(
      item => new LlmStrategyInstancePublicResponseDto(item, { isSubscribed: subscriptionMap.get(item.id) ?? false }),
    )

    return new BasePaginationResponseDto<LlmStrategyInstancePublicResponseDto>(total, page, limit, data)
  }

  /**
   * 鐢ㄦ埛绔細鑾峰彇杩愯涓殑 LLM 绛栫暐瀹炰緥璇︽儏锛堝叕寮€锛?
   */
  async getRunningInstanceDetail(
    id: string,
    userId?: string,
  ): Promise<LlmStrategyInstancePublicResponseDto> {
    const client = this.prisma.getClient()

    const instance = await client.llmStrategyInstance.findUnique({
      where: { id },
      include: {
        strategy: { select: { name: true, description: true, status: true } },
      },
    })

    if (!instance) {
      throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
    }

    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    if (!isDevEnv) {
      if (instance.status !== 'running') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
      if (instance.mode !== 'LIVE') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
      if (instance.strategy.status !== 'live') {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }
    }

    let isSubscribed = false
    if (userId) {
      try {
        const sub = await client.userLlmStrategySubscription.findFirst({
          where: {
            userId,
            llmStrategyInstanceId: id,
            status: 'active',
          },
          select: { id: true },
        })
        isSubscribed = !!sub
      } catch (error) {
        // 琛ㄤ笉瀛樺湪鏃跺湪鏈湴寮€鍙戠幆澧冮檷绾т负鏈闃呯姸鎬侊紝閬垮厤鏁翠釜璇︽儏鎺ュ彛 500
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2021' &&
          String(error.message).includes('user_llm_strategy_subscriptions')
        ) {
          isSubscribed = false
        } else {
          throw error
        }
      }
    }

    return new LlmStrategyInstancePublicResponseDto(instance, { isSubscribed })
  }

  /**
   * 鐢ㄦ埛绔細LLM 绛栫暐瀹炰緥淇″彿鍒楄〃锛堝綋鍓嶅厛杩斿洖绌哄垪琛紱鍚庣画鍙帴鍏?runs/鐢熸垚淇″彿鎸佷箙鍖栵級
   * - 鐢熶骇鐜锛氳姹傜敤鎴峰繀椤昏闃呭悗鎵嶅彲璁块棶锛堥伩鍏嶆硠闇茬瓥鐣ヨ涓虹粏鑺傦級
   */
  async getRunningInstanceSignals(
    id: string,
    query: LiveLlmStrategySignalsQueryDto,
    userId: string,
  ): Promise<BasePaginationResponseDto<any>> {
    const isDevEnv =
      process.env.NODE_ENV === 'development' ||
      process.env.APP_ENV === 'development'

    // 鏍￠獙瀹炰緥鍙鎬?
    await this.getRunningInstanceDetail(id, userId)

    if (!isDevEnv) {
      const client = this.prisma.getClient()
      try {
        const hasSubscription = await client.userLlmStrategySubscription.findFirst({
          where: {
            userId,
            llmStrategyInstanceId: id,
            status: 'active',
          },
          select: { id: true },
        })
        if (!hasSubscription) {
          throw new ForbiddenException('浠呰闃呰绛栫暐鐨勭敤鎴峰彲浠ユ煡鐪嬭缁嗕俊鍙?)
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2021' &&
          String(error.message).includes('user_llm_strategy_subscriptions')
        ) {
          // 鐢熶骇鐜琛ㄤ笉瀛樺湪灞炰簬閰嶇疆閿欒锛岃繖閲屼粛鐒舵姏鍑?500 浠ヤ究鍛婅
          throw error
        }
        throw error
      }
    }

    return new BasePaginationResponseDto(0, query.page, query.limit, [])
  }
}
