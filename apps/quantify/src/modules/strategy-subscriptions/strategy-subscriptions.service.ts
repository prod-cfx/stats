/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄥ拰渚濊禆娉ㄥ叆闇€瑕佽繍琛屾椂瀵煎叆 */
import type { SubscriptionStatus } from '@prisma/client'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import Ajv from 'ajv'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions/exchange-account-not-found.exception'
import { PrismaService } from '@/prisma/prisma.service'
import { CreateSubscriptionDto } from './dto/create-subscription.dto'
import { SubscriptionListQueryDto } from './dto/subscription-list-query.dto'
import { SubscriptionResponseDto } from './dto/subscription-response.dto'
import { UpdateSubscriptionDto } from './dto/update-subscription.dto'
import {
  AlreadySubscribedException,
  InvalidSubscriptionParamsException,
  StrategyNotAvailableException,
  SubscriptionNotFoundException,
} from './exceptions'
import { SubscriptionsRepository } from './repositories/subscriptions.repository'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

type SubscriptionWithRelations = Prisma.UserStrategySubscriptionGetPayload<{
  include: {
    strategyInstance: {
      select: {
        id: true
        name: true
        description: true
        status: true
        strategyTemplate: {
          select: {
            id: true
            name: true
            description: true
            status: true
            requiredFields: true
            paramsSchema: true
          }
        }
      }
    }
    exchangeAccount: {
      select: {
        id: true
        exchangeId: true
        name: true
      }
    }
  }
}>

@Injectable()
export class StrategySubscriptionsService {
  private readonly logger = new Logger(StrategySubscriptionsService.name)
  private readonly ajv = new Ajv({ allErrors: true, strict: false })

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsRepo: SubscriptionsRepository,
  ) {}

  async subscribe(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const client = this.prisma.getClient()

    // 鏌ヨ绛栫暐瀹炰緥鍙婂叾鍏宠仈鐨勬ā鏉夸俊鎭?
    const strategyInstance = await client.strategyInstance.findUnique({
      where: { id: dto.strategyInstanceId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        mode: true, // 馃敶 鏂板锛氶€夊嚭 mode 瀛楁鐢ㄤ簬鏍￠獙
        strategyTemplate: {
          select: {
            id: true,
            name: true,
            status: true,
            requiredFields: true,
            paramsSchema: true,
          },
        },
      },
    })

    if (!strategyInstance) {
      throw new StrategyNotAvailableException({ strategyInstanceId: dto.strategyInstanceId, status: 'not_found' })
    }

    // 妫€鏌ョ瓥鐣ュ疄渚嬬姸鎬?
    if (strategyInstance.status !== 'running') {
      throw new StrategyNotAvailableException({ strategyInstanceId: dto.strategyInstanceId, status: strategyInstance.status })
    }

    // 馃敶 鍏抽敭鏍￠獙锛氬彧鍏佽璁㈤槄瀹炵洏妯″紡锛圠IVE锛夌殑绛栫暐瀹炰緥
    // 闃叉鐢ㄦ埛璁㈤槄 PAPER/TESTNET/BACKTEST 妯″紡瀹炰緥锛屽鑷磋闃呮垚鍔熶絾鍒楄〃/璇︽儏 API 杩斿洖 404锛堝兊灏歌闃咃級
    // 锛堝洜涓?C 绔帴鍙ｅ凡寮哄埗杩囨护 mode !== 'LIVE' 鐨勫疄渚嬶級
    if (strategyInstance.mode !== 'LIVE') {
      throw new StrategyNotAvailableException({
        strategyInstanceId: dto.strategyInstanceId,
        status: `mode_${strategyInstance.mode.toLowerCase()}`,
        message: `璇ョ瓥鐣ュ疄渚嬪綋鍓嶅浜?${strategyInstance.mode} 妯″紡锛屼粎鏀寔璁㈤槄瀹炵洏妯″紡锛圠IVE锛夌殑绛栫暐`
      })
    }

    // 妫€鏌ョ瓥鐣ユā鏉跨姸鎬?
    if (strategyInstance.strategyTemplate.status !== 'live') {
      throw new StrategyNotAvailableException({
        strategyInstanceId: dto.strategyInstanceId,
        status: strategyInstance.strategyTemplate.status,
      })
    }

    const existing = await this.subscriptionsRepo.findByUserAndStrategy(userId, dto.strategyInstanceId)

    // 鐩爣鍙傛暟涓庝氦鏄撴墍璐︽埛锛氬浜庨噸鏂拌闃呭満鏅紝鑻ユ湭鏄惧紡浼犲叆鍒欐部鐢ㄥ巻鍙茶褰曪紝纭繚鍙傛暟鏍￠獙瑕嗙洊鐪熷疄鐢熸晥鐨勬暟鎹?
    const effectiveCustomParams =
      dto.customParams !== undefined
        ? dto.customParams
        : (existing?.customParams as Record<string, unknown> | null | undefined)
    const effectiveExchangeAccountId =
      dto.exchangeAccountId !== undefined ? dto.exchangeAccountId : existing?.exchangeAccountId ?? null

    if (effectiveExchangeAccountId !== undefined && effectiveExchangeAccountId !== null) {
      await this.ensureExchangeAccountOwnership(userId, effectiveExchangeAccountId)
    }

    this.validateCustomParams(
      strategyInstance.strategyTemplate.requiredFields,
      effectiveCustomParams ?? null,
      strategyInstance.strategyTemplate.paramsSchema as Record<string, unknown> | null,
    )

    // 宸插瓨鍦ㄨ闃呰褰曟椂锛屾牴鎹姸鎬佸喅瀹氭槸鎶ラ敊杩樻槸鎵ц"閲嶆柊璁㈤槄/鎭㈠"
    if (existing) {
      if (existing.status === 'active') {
        throw new AlreadySubscribedException({ strategyInstanceId: dto.strategyInstanceId })
      }

      const updated = await this.subscriptionsRepo.update(existing.id, {
        status: 'active',
        customParams: effectiveCustomParams as Prisma.InputJsonValue | null,
        exchangeAccountId: effectiveExchangeAccountId,
        unsubscribedAt: null,
      })

      this.logger.log(`鐢ㄦ埛 ${userId} 閲嶆柊婵€娲昏闃?${updated.id}锛堢瓥鐣ュ疄渚?${dto.strategyInstanceId}锛塦)

      const detail = await this.subscriptionsRepo.findByIdWithDetails(updated.id)
      if (!detail || detail.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId: updated.id })
      }
      return this.toResponseDto(detail)
    }

    // 棣栨璁㈤槄锛氱洿鎺ュ垱寤烘柊璁板綍
    let created
    try {
      created = await this.subscriptionsRepo.create({
        userId,
        strategyInstanceId: dto.strategyInstanceId,
        exchangeAccountId: effectiveExchangeAccountId ?? undefined,
        customParams: effectiveCustomParams as Prisma.InputJsonValue | undefined,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        // 鍞竴绾︽潫鍐茬獊锛岃涓虹敤鎴峰凡璁㈤槄璇ョ瓥鐣ュ疄渚?
        throw new AlreadySubscribedException({ strategyInstanceId: dto.strategyInstanceId })
      }
      throw error
    }

    this.logger.log(`鐢ㄦ埛 ${userId} 鎴愬姛璁㈤槄绛栫暐瀹炰緥 ${dto.strategyInstanceId}`)

    const detail = await this.subscriptionsRepo.findByIdWithDetails(created.id)
    if (!detail) {
      throw new SubscriptionNotFoundException({ subscriptionId: created.id })
    }
    return this.toResponseDto(detail)
  }

  async listMySubscriptions(
    userId: string,
    query: SubscriptionListQueryDto,
  ): Promise<BasePaginationResponseDto<SubscriptionResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const { items, total } = await this.subscriptionsRepo.findManyByUser(userId, {
      status: query.status as SubscriptionStatus | undefined,
      skip,
      take: limit,
    })

    const data = items.map(item => this.toResponseDto(item))
    return new BasePaginationResponseDto<SubscriptionResponseDto>(total, page, limit, data)
  }

  async getSubscriptionDetail(userId: string, subscriptionId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsRepo.findByIdWithDetails(subscriptionId)
    if (!subscription || subscription.userId !== userId) {
      throw new SubscriptionNotFoundException({ subscriptionId })
    }
    return this.toResponseDto(subscription)
  }

  async updateSubscription(
    userId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    if (dto.exchangeAccountId !== undefined && dto.exchangeAccountId !== null) {
      await this.ensureExchangeAccountOwnership(userId, dto.exchangeAccountId)
    }

    // 褰撻渶瑕佸垏鎹㈢姸鎬佷负 active 鎴栬€呮洿鏂拌嚜瀹氫箟鍙傛暟鏃讹紝浣跨敤鍖呭惈鏍￠獙鏁版嵁鐨勬煡璇?
    if (dto.status === 'active' || dto.customParams !== undefined) {
      const subscription = await this.subscriptionsRepo.findByIdWithValidationData(subscriptionId)

      if (!subscription || subscription.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId })
      }

      if (!subscription.strategyInstance) {
        throw new StrategyNotAvailableException({ strategyInstanceId: subscription.strategyInstanceId, status: 'not_found' })
      }

      if (dto.status === 'active') {
        if (subscription.strategyInstance.status !== 'running') {
          throw new StrategyNotAvailableException({
            strategyInstanceId: subscription.strategyInstanceId,
            status: subscription.strategyInstance.status,
          })
        }
        // 馃敶 鍏抽敭鏍￠獙锛氭仮澶嶈闃呮椂涔熻妫€鏌?mode锛岄槻姝㈡仮澶嶉潪 LIVE 妯″紡鐨勮闃?
        if (subscription.strategyInstance.mode !== 'LIVE') {
          throw new StrategyNotAvailableException({
            strategyInstanceId: subscription.strategyInstanceId,
            status: `mode_${subscription.strategyInstance.mode.toLowerCase()}`,
            message: `璇ョ瓥鐣ュ疄渚嬪綋鍓嶅浜?${subscription.strategyInstance.mode} 妯″紡锛屼粎鏀寔璁㈤槄瀹炵洏妯″紡锛圠IVE锛夌殑绛栫暐`
          })
        }
        if (subscription.strategyInstance.strategyTemplate.status !== 'live') {
          throw new StrategyNotAvailableException({
            strategyInstanceId: subscription.strategyInstanceId,
            status: subscription.strategyInstance.strategyTemplate.status,
          })
        }
      }

      // 1) 濡傛灉 PATCH 閲屾樉寮忓甫浜?customParams锛屽垯鏍￠獙鏂板弬鏁?
      if (dto.customParams !== undefined) {
        this.validateCustomParams(
          subscription.strategyInstance.strategyTemplate.requiredFields,
          dto.customParams,
          subscription.strategyInstance.strategyTemplate.paramsSchema as Record<string, unknown> | null,
        )
      }
      // 2) 浠呭垏鎹㈢姸鎬佷负 active锛屾湭甯?customParams 鏃讹紝蹇呴』鐢ㄥ巻鍙插弬鏁板仛涓€娆℃牎楠?
      else if (dto.status === 'active') {
        this.validateCustomParams(
          subscription.strategyInstance.strategyTemplate.requiredFields,
          subscription.customParams as Record<string, unknown> | null | undefined,
          subscription.strategyInstance.strategyTemplate.paramsSchema as Record<string, unknown> | null,
        )
      }
    } else {
      // 涓嶉渶瑕佹牎楠屾椂锛屽彧鏌ヨ鍩烘湰璁㈤槄淇℃伅
      const subscription = await this.subscriptionsRepo.findById(subscriptionId)
      if (!subscription || subscription.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId })
      }
    }

    const updatePayload: {
      status?: SubscriptionStatus
      customParams?: Prisma.InputJsonValue | null
      exchangeAccountId?: string | null
      unsubscribedAt?: Date | null
    } = {}

    if (dto.status) {
      updatePayload.status = dto.status
      if (dto.status === 'cancelled') {
        updatePayload.unsubscribedAt = new Date()
      } else {
        updatePayload.unsubscribedAt = null
      }
    }

    if (dto.exchangeAccountId !== undefined) {
      updatePayload.exchangeAccountId = dto.exchangeAccountId
    }

    if (dto.customParams !== undefined) {
      updatePayload.customParams = dto.customParams as Prisma.InputJsonValue | null
    }

    // 濡傛灉娌℃湁浠讳綍瀛楁闇€瑕佹洿鏂帮紝鐩存帴杩斿洖褰撳墠璇︽儏
    if (Object.keys(updatePayload).length === 0) {
      const currentDetail = await this.subscriptionsRepo.findByIdWithDetails(subscriptionId)
      if (!currentDetail || currentDetail.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId })
      }
      return this.toResponseDto(currentDetail)
    }

    const updated = await this.subscriptionsRepo.update(subscriptionId, updatePayload)
    this.logger.log(`鐢ㄦ埛 ${userId} 鏇存柊璁㈤槄 ${subscriptionId}`)

    const detail = await this.subscriptionsRepo.findByIdWithDetails(updated.id)
    if (!detail) {
      throw new SubscriptionNotFoundException({ subscriptionId: updated.id })
    }
    return this.toResponseDto(detail)
  }

  private validateCustomParams(
    requiredFields: string[],
    customParams: Record<string, unknown> | null | undefined,
    paramsSchema?: Record<string, unknown> | null,
  ) {
    // 1) 鍏堟寜 requiredFields 鍋?蹇呭～瀛楁"鏍￠獙锛堝鏋滄ā鏉块厤缃簡锛?
    if (requiredFields && requiredFields.length > 0) {
      if (customParams === undefined || customParams === null) {
        throw new InvalidSubscriptionParamsException({
          reason: 'MISSING_REQUIRED_FIELDS',
          requiredFields,
          missingFields: requiredFields,
        })
      }

      if (typeof customParams !== 'object' || Array.isArray(customParams)) {
        throw new InvalidSubscriptionParamsException({
          reason: 'INVALID_TYPE',
          requiredFields,
        })
      }

      const missing = requiredFields.filter(field => {
        // 浣跨敤 Object.prototype.hasOwnProperty.call 鏉ラ伩鍏嶅師鍨嬮摼姹℃煋
        // 妫€鏌ュ瓧娈垫槸鍚︾湡姝ｅ瓨鍦ㄤ簬瀵硅薄鑷韩灞炴€т腑锛岃€屼笉鏄師鍨嬮摼涓?
        if (!Object.prototype.hasOwnProperty.call(customParams, field)) {
          return true
        }
        // 鍗充娇灞炴€у瓨鍦紝涔熻妫€鏌ュ€兼槸鍚︿负 undefined 鎴?null
        const value = customParams[field]
        return value === undefined || value === null
      })
      if (missing.length > 0) {
        throw new InvalidSubscriptionParamsException({
          reason: 'MISSING_REQUIRED_FIELDS',
          requiredFields,
          missingFields: missing,
        })
      }
    }

    // 2) 鏃犺 requiredFields 鏄惁涓虹┖锛屽彧瑕?paramsSchema 瀛樺湪涓斾紶鍏ヤ簡 customParams锛屽氨鎵ц JSON Schema 鏍￠獙
    if (paramsSchema && customParams) {
      if (typeof paramsSchema !== 'object' || Array.isArray(paramsSchema)) {
        this.logger.warn('绛栫暐妯℃澘 paramsSchema 涓嶆槸鏈夋晥鐨?JSON Schema 瀵硅薄锛岃烦杩?JSON Schema 鏍￠獙')
        return
      }

      // 闄愬埗 schema 澶у皬锛岄槻姝?DoS 鏀诲嚮
      // 濡傛灉 schema 杩囧ぇ锛岃繖鏄湇鍔″櫒绔厤缃棶棰橈紝涓嶅簲璇ヨ繑鍥?400 缁欑敤鎴?
      // 璁板綍璀﹀憡骞惰烦杩囨牎楠岋紝璁╄繍缁村洟闃熶慨澶嶆ā鏉块厤缃?
      const schemaSize = JSON.stringify(paramsSchema).length
      if (schemaSize > 50000) {
        this.logger.warn(`paramsSchema 杩囧ぇ (${schemaSize} bytes)锛岃烦杩?JSON Schema 鏍￠獙锛岃妫€鏌ョ瓥鐣ユā鏉块厤缃甡)
        return
      }

      try {
        const validate = this.ajv.compile(paramsSchema)

        // 鐩存帴鎵ц楠岃瘉锛堣秴鏃朵繚鎶ら€氳繃 ajv 閰嶇疆瀹炵幇锛?
        const valid = validate(customParams)

        if (!valid) {
          throw new InvalidSubscriptionParamsException({
            reason: 'JSON_SCHEMA_VALIDATION',
            requiredFields,
            schemaErrors: validate.errors,
          })
        }
      } catch (error) {
        if (error instanceof InvalidSubscriptionParamsException) {
          throw error
        }

        this.logger.error(
          `璁㈤槄鍙傛暟 JSON Schema 鏍￠獙澶辫触`,
          { subscriptionError: error instanceof Error ? error.message : 'Unknown error' },
        )
        throw new InvalidSubscriptionParamsException({
          reason: 'JSON_SCHEMA_VALIDATION',
          requiredFields,
        })
      }
    }
  }

  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionsRepo.findById(subscriptionId)
    if (!subscription || subscription.userId !== userId) {
      throw new SubscriptionNotFoundException({ subscriptionId })
    }

    await this.subscriptionsRepo.update(subscriptionId, {
      status: 'cancelled',
      unsubscribedAt: new Date(),
    })

    this.logger.log(`鐢ㄦ埛 ${userId} 鍙栨秷璁㈤槄 ${subscriptionId}`)
  }

  private async ensureExchangeAccountOwnership(userId: string, exchangeAccountId: string) {
    const account = await this.prisma.getClient().exchangeAccount.findFirst({
      where: {
        id: exchangeAccountId,
        userId,
      },
      select: { id: true },
    })

    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId: exchangeAccountId })
    }
  }

  private toResponseDto(subscription: SubscriptionWithRelations): SubscriptionResponseDto {
    // 闃插尽鎬ф鏌ワ細纭繚鍏宠仈鏁版嵁瀛樺湪
    if (!subscription.strategyInstance) {
      throw new StrategyNotAvailableException({ strategyInstanceId: subscription.strategyInstanceId, status: 'data_integrity_error' })
    }

    if (!subscription.strategyInstance.strategyTemplate) {
      throw new StrategyNotAvailableException({ strategyInstanceId: subscription.strategyInstanceId, status: 'template_missing' })
    }

    return {
      id: subscription.id,
      userId: subscription.userId,
      strategyInstanceId: subscription.strategyInstanceId,
      strategyInstanceName: subscription.strategyInstance.name,
      strategyDescription: subscription.strategyInstance.strategyTemplate.description,
      status: subscription.status,
      customParams: subscription.customParams as Record<string, unknown> | null,
      exchangeAccountId: subscription.exchangeAccountId,
      // 浣跨敤鐢ㄦ埛涓轰氦鏄撴墍璐︽埛閰嶇疆鐨勫埆鍚嶏紱濡傞渶鏆撮湶搴曞眰 exchangeId 璇峰湪 DTO 涓崟鐙墿灞曞瓧娈?
      exchangeName: subscription.exchangeAccount?.name ?? null,
      subscribedAt: subscription.subscribedAt,
      unsubscribedAt: subscription.unsubscribedAt ?? null,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    }
  }
}
