/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄥ拰渚濊禆娉ㄥ叆闇€瑕佽繍琛屾椂瀵煎叆 */
import type { SubscriptionStatus } from '@prisma/client'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { AccountsService } from '@/modules/accounts/accounts.service'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions/exchange-account-not-found.exception'
import { PrismaService } from '@/prisma/prisma.service'

import { CreateLlmSubscriptionDto } from './dto/create-llm-subscription.dto'
import { LlmSubscriptionListQueryDto } from './dto/llm-subscription-list-query.dto'
import { LlmSubscriptionResponseDto } from './dto/llm-subscription-response.dto'
import { UpdateLlmSubscriptionDto } from './dto/update-llm-subscription.dto'
import {
  LlmAlreadySubscribedException,
  LlmStrategyNotAvailableException,
  LlmSubscriptionNotFoundException,
} from './exceptions'
import { LlmSubscriptionsRepository } from './repositories/llm-subscriptions.repository'

/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

type SubscriptionWithRelations = Prisma.UserLlmStrategySubscriptionGetPayload<{
  include: {
    llmStrategyInstance: {
      include: {
        strategy: {
          select: {
            id: true
            name: true
            description: true
            status: true
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
export class LlmStrategySubscriptionsService {
  private readonly logger = new Logger(LlmStrategySubscriptionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: LlmSubscriptionsRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async subscribe(userId: string, dto: CreateLlmSubscriptionDto): Promise<LlmSubscriptionResponseDto> {
    const client = this.prisma.getClient()

    const instance = await client.llmStrategyInstance.findUnique({
      where: { id: dto.llmStrategyInstanceId },
      include: {
        strategy: { select: { id: true, name: true, description: true, status: true } },
      },
    })

    if (!instance) {
      throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: dto.llmStrategyInstanceId, status: 'not_found' })
    }

    if (instance.status !== 'running') {
      throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: dto.llmStrategyInstanceId, status: instance.status })
    }

    // 浠呭厑璁歌闃?LIVE 妯″紡瀹炰緥锛堜繚鎸佷笌鏃ц闃呴€昏緫涓€鑷达級
    if (instance.mode !== 'LIVE') {
      throw new LlmStrategyNotAvailableException({
        llmStrategyInstanceId: dto.llmStrategyInstanceId,
        status: `mode_${instance.mode.toLowerCase()}`,
        message: `璇ョ瓥鐣ュ疄渚嬪綋鍓嶅浜?${instance.mode} 妯″紡锛屼粎鏀寔璁㈤槄瀹炵洏妯″紡锛圠IVE锛夌殑绛栫暐`,
      })
    }

    if (instance.strategy.status !== 'live') {
      throw new LlmStrategyNotAvailableException({
        llmStrategyInstanceId: dto.llmStrategyInstanceId,
        status: instance.strategy.status,
      })
    }

    const existing = await this.repo.findByUserAndInstance(userId, dto.llmStrategyInstanceId)

    const effectiveCustomParams =
      dto.customParams !== undefined
        ? dto.customParams
        : (existing?.customParams as Record<string, unknown> | null | undefined)
    const effectiveExchangeAccountId =
      dto.exchangeAccountId !== undefined
        ? dto.exchangeAccountId
        : existing?.exchangeAccountId ?? null

    // 璁㈤槄 / 閲嶆柊婵€娲绘椂锛屽繀椤荤粦瀹氫竴涓悎娉曠殑浜ゆ槗鎵€璐︽埛
    if (!effectiveExchangeAccountId) {
      throw new BadRequestException('exchangeAccountId is required to subscribe LLM strategy')
    }
    await this.ensureExchangeAccountOwnership(userId, effectiveExchangeAccountId)

    // 宸插瓨鍦ㄨ闃呰褰曪細active 鐩存帴鎶ラ敊锛屽惁鍒欐仮澶?
    if (existing) {
      if (existing.status === 'active') {
        throw new LlmAlreadySubscribedException({ llmStrategyInstanceId: dto.llmStrategyInstanceId })
      }

      // 閲嶆柊婵€娲伙細鍏堢‘淇濈瓥鐣ヨ处鎴峰瓨鍦ㄥ苟鍏ラ噾鎴愬姛锛屽啀鏇存柊璁㈤槄鐘舵€佷负 active
      // 杩欐牱鍙互淇濊瘉璁㈤槄涓庤处鎴风殑鐢熷懡鍛ㄦ湡鍚屾锛岄伩鍏嶅嚭鐜?active 璁㈤槄 + 涓嶅瓨鍦ㄨ处鎴?鐨勮剰鐘舵€?
      // - 濡傛灉鐢ㄦ埛鏈浼犲叆浜嗘柊鐨?amount锛坉to.customParams 涓湁锛夛紝璇存槑鐢ㄦ埛鎯宠鎶曞叆杩欑瑪璧勯噾
      // - 濡傛灉娌℃湁浼犲叆 amount 鎴?amount=0锛屽彧鍒涘缓璐︽埛涓嶅叆閲?
      const newAmount = dto.customParams ? this.extractAmount(dto.customParams) : undefined
      // 濮嬬粓璋冪敤 ensureUserStrategyAccount锛屽彧鍦?amount > 0 鏃朵紶鍏ラ噾棰濊繘琛屽叆閲?
      // 澶辫触鏃朵細鎶涘嚭寮傚父锛岃闃呯姸鎬佷笉浼氳鏇存柊涓?active
      await this.ensureUserStrategyAccount(
        userId,
        instance.strategyId,
        instance.strategy.name,
        newAmount && newAmount > 0 ? newAmount : undefined,
      )

      // 璐︽埛鍒涘缓/鍏ラ噾鎴愬姛鍚庢墠鏇存柊璁㈤槄鐘舵€?
      const updated = await this.repo.update(existing.id, {
        status: 'active',
        customParams: effectiveCustomParams as Prisma.InputJsonValue | null,
        exchangeAccountId: effectiveExchangeAccountId,
        unsubscribedAt: null,
      })

      this.logger.log(`鐢ㄦ埛 ${userId} 閲嶆柊婵€娲?LLM 璁㈤槄 ${updated.id}锛堝疄渚?${dto.llmStrategyInstanceId}锛塦)

      const detail = await this.repo.findByIdWithDetails(updated.id)
      if (!detail || detail.userId !== userId) {
        throw new LlmSubscriptionNotFoundException({ subscriptionId: updated.id })
      }
      return this.toResponseDto(detail)
    }

    // 棣栨璁㈤槄锛氬厛鍒涘缓璁㈤槄璁板綍锛屾垚鍔熷悗鍐嶅叆閲?
    // 杩欐牱鍙互闃叉骞跺彂璇锋眰瀵艰嚧閲嶅鍏ラ噾锛?
    // - 绗竴涓姹傚垱寤鸿闃呮垚鍔燂紝绗簩涓姹傚湪姝ゅ灏变細鍥犲敮涓€绱㈠紩鍐茬獊鑰屽け璐?
    // - 鍙湁璁㈤槄鍒涘缓鎴愬姛鐨勮姹傛墠浼氭墽琛屽悗缁殑鍏ラ噾鎿嶄綔
    let created
    try {
      created = await this.repo.create({
        userId,
        llmStrategyInstanceId: dto.llmStrategyInstanceId,
        exchangeAccountId: effectiveExchangeAccountId,
        customParams: effectiveCustomParams as Prisma.InputJsonValue | undefined,
      })
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new LlmAlreadySubscribedException({ llmStrategyInstanceId: dto.llmStrategyInstanceId })
      }
      throw error
    }

    this.logger.log(`鐢ㄦ埛 ${userId} 鎴愬姛璁㈤槄 LLM 绛栫暐瀹炰緥 ${dto.llmStrategyInstanceId}`)

    // 璁㈤槄鍒涘缓鎴愬姛鍚庯紝蹇呴』鍒涘缓绛栫暐璐︽埛锛堟墽琛屽櫒渚濊禆 user_strategy_account 杩囨护璁㈤槄鐢ㄦ埛锛?
    // - 鍗充娇 amount=0 涔熷繀椤诲垱寤鸿处鎴凤紝鍚﹀垯鎵ц鍣ㄦ壘涓嶅埌璇ョ敤鎴凤紝姘歌繙鏀朵笉鍒颁俊鍙?
    // - 鍙湪 amount > 0 鏃惰繘琛屽叆閲戞搷浣?
    const subscribeAmount = this.extractAmount(effectiveCustomParams)
    try {
      await this.ensureUserStrategyAccount(
        userId,
        instance.strategyId,
        instance.strategy.name,
        subscribeAmount && subscribeAmount > 0 ? subscribeAmount : undefined,
      )
    } catch (error) {
      // 鍒涘缓绛栫暐璐︽埛澶辫触鏃堕渶瑕佸洖婊氳闃呰褰?
      // 鍥犱负娌℃湁绛栫暐璐︽埛锛屾墽琛屽櫒鏃犳硶鎵惧埌璇ヨ闃呯敤鎴凤紝璁㈤槄瀹為檯涓婁笉鍙敤
      this.logger.error(
        `鐢ㄦ埛 ${userId} 璁㈤槄 ${created.id} 鍚庡垱寤虹瓥鐣ヨ处鎴峰け璐ワ紝鍥炴粴璁㈤槄: ${error instanceof Error ? error.message : error}`,
      )
      try {
        await this.repo.delete(created.id)
      } catch (deleteError) {
        this.logger.error(
          `鍥炴粴璁㈤槄 ${created.id} 澶辫触: ${deleteError instanceof Error ? deleteError.message : deleteError}`,
        )
      }
      throw new BadRequestException('璁㈤槄澶辫触锛氬垱寤虹瓥鐣ヨ处鎴峰け璐ワ紝璇风◢鍚庨噸璇?)
    }

    const detail = await this.repo.findByIdWithDetails(created.id)
    if (!detail) {
      throw new LlmSubscriptionNotFoundException({ subscriptionId: created.id })
    }
    return this.toResponseDto(detail)
  }

  async listMySubscriptions(
    userId: string,
    query: LlmSubscriptionListQueryDto,
  ): Promise<BasePaginationResponseDto<LlmSubscriptionResponseDto>> {
    const page = query.page
    const limit = query.limit
    const skip = (page - 1) * limit

    const { items, total } = await this.repo.findManyByUser(userId, {
      status: query.status as SubscriptionStatus | undefined,
      skip,
      take: limit,
    })

    const data = items.map(item => this.toResponseDto(item as any))
    return new BasePaginationResponseDto<LlmSubscriptionResponseDto>(total, page, limit, data)
  }

  async getSubscriptionDetail(userId: string, subscriptionId: string): Promise<LlmSubscriptionResponseDto> {
    const subscription = await this.repo.findByIdWithDetails(subscriptionId)
    if (!subscription || subscription.userId !== userId) {
      throw new LlmSubscriptionNotFoundException({ subscriptionId })
    }
    return this.toResponseDto(subscription as any)
  }

  async updateSubscription(
    userId: string,
    subscriptionId: string,
    dto: UpdateLlmSubscriptionDto,
  ): Promise<LlmSubscriptionResponseDto> {
    const existing = await this.repo.findByIdWithDetails(subscriptionId)
    if (!existing || existing.userId !== userId) {
      throw new LlmSubscriptionNotFoundException({ subscriptionId })
    }

    const nextExchangeAccountId =
      dto.exchangeAccountId !== undefined ? dto.exchangeAccountId : existing.exchangeAccountId

    // 璁＄畻鏇存柊鍚庣殑瀹為檯鐘舵€侊紙濡傛灉娌℃湁鏇存敼 status锛屽垯娌跨敤鐜版湁鐘舵€侊級
    const effectiveStatus = dto.status ?? existing.status

    // 绂佹 active 璁㈤槄娓呯┖ exchangeAccountId 鈥斺€?鎵ц鍣ㄩ渶瑕佽处鎴锋墠鑳戒笅鍗?
    // 鐢ㄦ埛蹇呴』鍏堟殏鍋?鍙栨秷璁㈤槄锛屾垨鑰呮彁渚涙柊鐨勮处鎴?ID
    if (effectiveStatus === 'active' && dto.exchangeAccountId === null) {
      throw new BadRequestException('Cannot remove exchangeAccountId from active subscription. Please pause or cancel first.')
    }

    // 褰撶姸鎬佽璁剧疆涓?active锛堟棤璁烘槸鎭㈠杩樻槸浠庡叾瀹冪姸鎬佸垏鎹級鏃讹紝蹇呴』纭繚璁㈤槄缁戝畾浜嗘湁鏁堣处鎴?
    if (dto.status === 'active') {
      if (!nextExchangeAccountId) {
        throw new BadRequestException('exchangeAccountId is required when activating LLM subscription')
      }
      await this.ensureExchangeAccountOwnership(userId, nextExchangeAccountId)
    } else if (dto.exchangeAccountId !== undefined && dto.exchangeAccountId !== null) {
      // 鍏跺畠鏇存柊鍦烘櫙涓紝濡傛灉鏄惧紡淇敼浜嗚处鎴凤紝涔熼渶瑕佹牎楠屽綊灞?
      await this.ensureExchangeAccountOwnership(userId, dto.exchangeAccountId)
    }

    // 鎭㈠ active 鏃舵牎楠屽疄渚嬪彲璁㈤槄
    if (dto.status === 'active') {
      const instance = existing.llmStrategyInstance
      if (!instance) {
        throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: existing.llmStrategyInstanceId, status: 'not_found' })
      }
      if (instance.status !== 'running') {
        throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: existing.llmStrategyInstanceId, status: instance.status })
      }
      if (instance.mode !== 'LIVE') {
        throw new LlmStrategyNotAvailableException({
          llmStrategyInstanceId: existing.llmStrategyInstanceId,
          status: `mode_${instance.mode.toLowerCase()}`,
          message: `璇ョ瓥鐣ュ疄渚嬪綋鍓嶅浜?${instance.mode} 妯″紡锛屼粎鏀寔璁㈤槄瀹炵洏妯″紡锛圠IVE锛夌殑绛栫暐`,
        })
      }
      if (instance.strategy?.status !== 'live') {
        throw new LlmStrategyNotAvailableException({
          llmStrategyInstanceId: existing.llmStrategyInstanceId,
          status: instance.strategy?.status ?? 'unknown',
        })
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
      updatePayload.unsubscribedAt = dto.status === 'cancelled' ? new Date() : null
    }
    if (dto.exchangeAccountId !== undefined) {
      updatePayload.exchangeAccountId = dto.exchangeAccountId
    }
    if (dto.customParams !== undefined) {
      updatePayload.customParams = dto.customParams as Prisma.InputJsonValue | null
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.toResponseDto(existing as any)
    }

    // 褰撶姸鎬佸彉涓?active 鏃讹紝鍏堢‘淇濊处鎴峰瓨鍦ㄥ啀鏇存柊璁㈤槄鐘舵€?
    // 椤哄簭寰堥噸瑕侊細濡傛灉璐︽埛鍒涘缓澶辫触锛岃闃呯姸鎬佷笉浼氳鏇存柊锛屼繚鎸佹暟鎹竴鑷存€?
    if (dto.status === 'active' && existing.llmStrategyInstance) {
      await this.ensureUserStrategyAccount(
        userId,
        existing.llmStrategyInstance.strategyId,
        existing.llmStrategyInstance.strategy?.name ?? null,
      )
    }

    await this.repo.update(subscriptionId, updatePayload)
    this.logger.log(`鐢ㄦ埛 ${userId} 鏇存柊 LLM 璁㈤槄 ${subscriptionId}`)

    const detail = await this.repo.findByIdWithDetails(subscriptionId)
    if (!detail) {
      throw new LlmSubscriptionNotFoundException({ subscriptionId })
    }
    return this.toResponseDto(detail as any)
  }

  async cancelSubscription(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.repo.findById(subscriptionId)
    if (!subscription || subscription.userId !== userId) {
      throw new LlmSubscriptionNotFoundException({ subscriptionId })
    }

    await this.repo.update(subscriptionId, {
      status: 'cancelled',
      unsubscribedAt: new Date(),
    })

    this.logger.log(`鐢ㄦ埛 ${userId} 鍙栨秷 LLM 璁㈤槄 ${subscriptionId}`)
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

  private toResponseDto(subscription: SubscriptionWithRelations): LlmSubscriptionResponseDto {
    if (!subscription.llmStrategyInstance) {
      throw new LlmStrategyNotAvailableException({
        llmStrategyInstanceId: subscription.llmStrategyInstanceId,
        status: 'data_integrity_error',
      })
    }

    return {
      id: subscription.id,
      userId: subscription.userId,
      llmStrategyInstanceId: subscription.llmStrategyInstanceId,
      llmStrategyInstanceName: subscription.llmStrategyInstance.name,
      llmStrategyName: subscription.llmStrategyInstance.strategy?.name ?? 'LLM Strategy',
      llmStrategyDescription: subscription.llmStrategyInstance.strategy?.description ?? null,
      status: subscription.status,
      customParams: subscription.customParams as Record<string, unknown> | null,
      exchangeAccountId: subscription.exchangeAccountId,
      exchangeId: subscription.exchangeAccount?.exchangeId ?? null,
      exchangeName: subscription.exchangeAccount?.name ?? null,
      subscribedAt: subscription.subscribedAt,
      unsubscribedAt: subscription.unsubscribedAt ?? null,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    }
  }

  /**
   * 浠?customParams 涓彁鍙栫敤鎴疯緭鍏ョ殑璁㈤槄閲戦
   */
  private extractAmount(customParams: Record<string, unknown> | null | undefined): number | undefined {
    if (!customParams || typeof customParams !== 'object') {
      return undefined
    }
    const amount = customParams.amount
    if (typeof amount === 'number' && amount > 0) {
      return amount
    }
    if (typeof amount === 'string') {
      const parsed = Number.parseFloat(amount)
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    return undefined
  }

  /**
   * 纭繚鐢ㄦ埛鎷ユ湁鎸囧畾 LLM 绛栫暐瀵瑰簲鐨?UserStrategyAccount锛堣櫄鎷熻处鎴凤級锛屽苟涓哄叾鍏ラ噾銆?
   * 璇ヨ处鎴风敤浜庢墽琛屽櫒涓嬪崟鍜?PnL 璺熻釜銆?
   *
   * strategyId 浣跨敤 LlmStrategy.id锛屼娇寰楁墽琛屽櫒鐨勬煡璇㈡潯浠?
   * `where.strategyId = signal.llmStrategyId` 鑳藉鍖归厤鍒拌璐︽埛銆?
   *
   * @param userId 涓氬姟鐢ㄦ埛 ID
   * @param llmStrategyId LLM 绛栫暐 ID
   * @param strategyName 绛栫暐灞曠ず鍚嶇О
   * @param amount 鐢ㄦ埛璁㈤槄鏃惰緭鍏ョ殑璧勯噾棰濆害锛堜粠 customParams.amount 鎻愬彇锛?
   */
  private async ensureUserStrategyAccount(
    userId: string,
    llmStrategyId: string,
    strategyName: string | null,
    amount?: number,
  ): Promise<void> {
    const client = this.prisma.getClient()
    const fundingAmount = amount && amount > 0 ? String(amount) : '0'

    // 妫€鏌ユ槸鍚﹀凡瀛樺湪璇ョ敤鎴?+ LLM 绛栫暐鐨勮櫄鎷熻处鎴?
    const existing = await client.userStrategyAccount.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId: llmStrategyId,
        },
      },
      select: { id: true },
    })

    if (existing) {
      this.logger.debug(`鐢ㄦ埛 ${userId} 宸叉湁 LLM 绛栫暐 ${llmStrategyId} 鐨勮櫄鎷熻处鎴?${existing.id}`)
      // 濡傛灉鏈夐噾棰濓紝涓哄凡鏈夎处鎴峰叆閲?
      if (amount && amount > 0) {
        // 鍏ラ噾澶辫触鏄笟鍔″け璐ワ紝蹇呴』鎶涘嚭寮傚父璁╀笂灞傛劅鐭?
        // 鍚﹀垯鐢ㄦ埛鐪嬪埌"璁㈤槄鎴愬姛"浣嗚櫄鎷熻处鎴蜂綑棰濅负 0锛屼笅涓€娆′俊鍙峰洜浣欓涓嶈冻琚烦杩?
        await this.accountsService.deposit(existing.id, {
          userId,
          amount: fundingAmount,
          description: `LLM 绛栫暐璁㈤槄鍏ラ噾`,
        })
        this.logger.log(`涓虹敤鎴?${userId} 鐨勮櫄鎷熻处鎴?${existing.id} 鍏ラ噾 ${fundingAmount}`)
      }
      return
    }

    // 鍒涘缓鏂扮殑铏氭嫙璐︽埛锛堝甫鍒濆璧勯噾锛?
    // 娉ㄦ剰锛氳处鎴峰垱寤哄け璐ユ椂蹇呴』鎶涘嚭寮傚父锛屽惁鍒欒闃呮垚鍔熶絾鎵ц鍣ㄦ壘涓嶅埌璐︽埛锛岀敤鎴锋案杩滄棤娉曚笅鍗?
    try {
      await this.accountsService.createUserStrategyAccount(userId, {
        userId,
        strategyId: llmStrategyId,
        strategyName: strategyName ?? 'LLM Strategy',
        baseCurrency: 'USDT',
        initialBalance: fundingAmount,
      })
      this.logger.log(`涓虹敤鎴?${userId} 鍒涘缓 LLM 绛栫暐 ${llmStrategyId} 鐨勮櫄鎷熻处鎴凤紝鍒濆璧勯噾 ${fundingAmount}`)
    } catch (error) {
      // 濡傛灉鏄敮涓€绾︽潫鍐茬獊锛堝苟鍙戝垱寤猴級锛屽拷鐣ラ敊璇苟灏濊瘯鍏ラ噾
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.debug(`鐢ㄦ埛 ${userId} 鐨?LLM 绛栫暐 ${llmStrategyId} 铏氭嫙璐︽埛宸茶骞跺彂鍒涘缓`)
        // 骞跺彂鍒涘缓鍚庝粛闇€鍏ラ噾
        if (amount && amount > 0) {
          const account = await client.userStrategyAccount.findUnique({
            where: { userId_strategyId: { userId, strategyId: llmStrategyId } },
            select: { id: true },
          })
          if (account) {
            // 鍏ラ噾澶辫触蹇呴』鎶涘嚭寮傚父锛屼笌 existing 鍒嗘敮淇濇寔涓€鑷?
            // 鍚﹀垯浼氬嚭鐜?璁㈤槄 active + 铏氭嫙璐︽埛浣欓涓?0"鐨勮剰鐘舵€?
            // 鍚庣画淇″彿鎵ц閮戒細鍥?InsufficientBalance 琚烦杩囷紝鐢ㄦ埛鍗存病鏈変换浣曞け璐ユ彁绀?
            await this.accountsService.deposit(account.id, {
              userId,
              amount: fundingAmount,
              description: `LLM 绛栫暐璁㈤槄鍏ラ噾`,
            })
            this.logger.log(`骞跺彂鍒涘缓鍚庝负鐢ㄦ埛 ${userId} 鐨勮櫄鎷熻处鎴?${account.id} 鍏ラ噾 ${fundingAmount}`)
          }
        }
        return
      }
      // 鍏朵粬閿欒锛氬垱寤鸿处鎴峰け璐ュ繀椤昏璁㈤槄涔熷け璐ワ紝鍚﹀垯鐢ㄦ埛鏀跺埌"璁㈤槄鎴愬姛"鍗存案杩滄棤娉曚笅鍗?
      this.logger.error(
        `涓虹敤鎴?${userId} 鍒涘缓 LLM 绛栫暐 ${llmStrategyId} 鐨勮櫄鎷熻处鎴峰け璐? ${error instanceof Error ? error.message : error}`,
      )
      throw new BadRequestException('鍒涘缓绛栫暐璐︽埛澶辫触锛岃绋嶅悗閲嶈瘯')
    }
  }
}
