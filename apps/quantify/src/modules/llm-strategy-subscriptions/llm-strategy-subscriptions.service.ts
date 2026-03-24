/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入 */
import type { SubscriptionStatus } from '@ai/shared'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'

import { AccountsService } from '@/modules/accounts/accounts.service'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions/exchange-account-not-found.exception'
import { Prisma } from '@/prisma/prisma.types'

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
    private readonly repo: LlmSubscriptionsRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async subscribe(userId: string, dto: CreateLlmSubscriptionDto): Promise<LlmSubscriptionResponseDto> {
    const instance = await this.repo.findLlmStrategyInstance(dto.llmStrategyInstanceId)

    if (!instance) {
      throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: dto.llmStrategyInstanceId, status: 'not_found' })
    }

    if (instance.status !== 'running') {
      throw new LlmStrategyNotAvailableException({ llmStrategyInstanceId: dto.llmStrategyInstanceId, status: instance.status })
    }

    // 仅允许订阅 LIVE 模式实例（保持与旧订阅逻辑一致）
    if (instance.mode !== 'LIVE') {
      throw new LlmStrategyNotAvailableException({
        llmStrategyInstanceId: dto.llmStrategyInstanceId,
        status: `mode_${instance.mode.toLowerCase()}`,
        message: `该策略实例当前处于 ${instance.mode} 模式，仅支持订阅实盘模式（LIVE）的策略`,
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

    // 订阅 / 重新激活时，必须绑定一个合法的交易所账户
    if (!effectiveExchangeAccountId) {
      throw new DomainException('llm_subscription.exchange_account_required', { code: ErrorCode.LLM_SUBSCRIPTION_INVALID_OPERATION })
    }
    await this.ensureExchangeAccountOwnership(userId, effectiveExchangeAccountId)

    // 已存在订阅记录：active 直接报错，否则恢复
    if (existing) {
      if (existing.status === 'active') {
        throw new LlmAlreadySubscribedException({ llmStrategyInstanceId: dto.llmStrategyInstanceId })
      }

      // 重新激活：先确保策略账户存在并入金成功，再更新订阅状态为 active
      // 这样可以保证订阅与账户的生命周期同步，避免出现"active 订阅 + 不存在账户"的脏状态
      // - 如果用户本次传入了新的 amount（dto.customParams 中有），说明用户想要投入这笔资金
      // - 如果没有传入 amount 或 amount=0，只创建账户不入金
      const newAmount = dto.customParams ? this.extractAmount(dto.customParams) : undefined
      // 始终调用 ensureUserStrategyAccount，只在 amount > 0 时传入金额进行入金
      // 失败时会抛出异常，订阅状态不会被更新为 active
      await this.ensureUserStrategyAccount(
        userId,
        instance.strategyId,
        instance.strategy.name,
        newAmount && newAmount > 0 ? newAmount : undefined,
      )

      // 账户创建/入金成功后才更新订阅状态
      const updated = await this.repo.update(existing.id, {
        status: 'active',
        customParams: effectiveCustomParams as Prisma.InputJsonValue | null,
        exchangeAccountId: effectiveExchangeAccountId,
        unsubscribedAt: null,
      })

      this.logger.log(`用户 ${userId} 重新激活 LLM 订阅 ${updated.id}（实例 ${dto.llmStrategyInstanceId}）`)

      const detail = await this.repo.findByIdWithDetails(updated.id)
      if (!detail || detail.userId !== userId) {
        throw new LlmSubscriptionNotFoundException({ subscriptionId: updated.id })
      }
      return this.toResponseDto(detail)
    }

    // 首次订阅：先创建订阅记录，成功后再入金
    // 这样可以防止并发请求导致重复入金：
    // - 第一个请求创建订阅成功，第二个请求在此处就会因唯一索引冲突而失败
    // - 只有订阅创建成功的请求才会执行后续的入金操作
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

    this.logger.log(`用户 ${userId} 成功订阅 LLM 策略实例 ${dto.llmStrategyInstanceId}`)

    // 订阅创建成功后，必须创建策略账户（执行器依赖 user_strategy_account 过滤订阅用户）
    // - 即使 amount=0 也必须创建账户，否则执行器找不到该用户，永远收不到信号
    // - 只在 amount > 0 时进行入金操作
    const subscribeAmount = this.extractAmount(effectiveCustomParams)
    try {
      await this.ensureUserStrategyAccount(
        userId,
        instance.strategyId,
        instance.strategy.name,
        subscribeAmount && subscribeAmount > 0 ? subscribeAmount : undefined,
      )
    } catch (error) {
      // 创建策略账户失败时需要回滚订阅记录
      // 因为没有策略账户，执行器无法找到该订阅用户，订阅实际上不可用
      this.logger.error(
        `用户 ${userId} 订阅 ${created.id} 后创建策略账户失败，回滚订阅: ${error instanceof Error ? error.message : error}`,
      )
      try {
        await this.repo.delete(created.id)
      } catch (deleteError) {
        this.logger.error(
          `回滚订阅 ${created.id} 失败: ${deleteError instanceof Error ? deleteError.message : deleteError}`,
        )
      }
      throw new DomainException('llm_subscription.account_creation_failed', { code: ErrorCode.LLM_SUBSCRIPTION_ACCOUNT_FAILED, status: HttpStatus.INTERNAL_SERVER_ERROR })
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

    // 计算更新后的实际状态（如果没有更改 status，则沿用现有状态）
    const effectiveStatus = dto.status ?? existing.status

    // 禁止 active 订阅清空 exchangeAccountId —— 执行器需要账户才能下单
    // 用户必须先暂停/取消订阅，或者提供新的账户 ID
    if (effectiveStatus === 'active' && dto.exchangeAccountId === null) {
      throw new DomainException('llm_subscription.cannot_remove_account_from_active', { code: ErrorCode.LLM_SUBSCRIPTION_INVALID_OPERATION })
    }

    // 当状态被设置为 active（无论是恢复还是从其它状态切换）时，必须确保订阅绑定了有效账户
    if (dto.status === 'active') {
      if (!nextExchangeAccountId) {
        throw new DomainException('llm_subscription.exchange_account_required_for_activation', { code: ErrorCode.LLM_SUBSCRIPTION_INVALID_OPERATION })
      }
      await this.ensureExchangeAccountOwnership(userId, nextExchangeAccountId)
    } else if (dto.exchangeAccountId !== undefined && dto.exchangeAccountId !== null) {
      // 其它更新场景中，如果显式修改了账户，也需要校验归属
      await this.ensureExchangeAccountOwnership(userId, dto.exchangeAccountId)
    }

    // 恢复 active 时校验实例可订阅
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
          message: `该策略实例当前处于 ${instance.mode} 模式，仅支持订阅实盘模式（LIVE）的策略`,
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

    // 当状态变为 active 时，先确保账户存在再更新订阅状态
    // 顺序很重要：如果账户创建失败，订阅状态不会被更新，保持数据一致性
    if (dto.status === 'active' && existing.llmStrategyInstance) {
      await this.ensureUserStrategyAccount(
        userId,
        existing.llmStrategyInstance.strategyId,
        existing.llmStrategyInstance.strategy?.name ?? null,
      )
    }

    await this.repo.update(subscriptionId, updatePayload)
    this.logger.log(`用户 ${userId} 更新 LLM 订阅 ${subscriptionId}`)

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

    this.logger.log(`用户 ${userId} 取消 LLM 订阅 ${subscriptionId}`)
  }

  private async ensureExchangeAccountOwnership(userId: string, exchangeAccountId: string) {
    const account = await this.repo.findExchangeAccountByOwner(exchangeAccountId, userId)
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
   * 从 customParams 中提取用户输入的订阅金额
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
   * 确保用户拥有指定 LLM 策略对应的 UserStrategyAccount（虚拟账户），并为其入金。
   * 该账户用于执行器下单和 PnL 跟踪。
   *
   * strategyId 使用 LlmStrategy.id，使得执行器的查询条件
   * `where.strategyId = signal.llmStrategyId` 能够匹配到该账户。
   *
   * @param userId 业务用户 ID
   * @param llmStrategyId LLM 策略 ID
   * @param strategyName 策略展示名称
   * @param amount 用户订阅时输入的资金额度（从 customParams.amount 提取）
   */
  private async ensureUserStrategyAccount(
    userId: string,
    llmStrategyId: string,
    strategyName: string | null,
    amount?: number,
  ): Promise<void> {
    const fundingAmount = amount && amount > 0 ? String(amount) : '0'

    // 检查是否已存在该用户 + LLM 策略的虚拟账户
    const existing = await this.repo.findUserStrategyAccount(userId, llmStrategyId)

    if (existing) {
      this.logger.debug(`用户 ${userId} 已有 LLM 策略 ${llmStrategyId} 的虚拟账户 ${existing.id}`)
      // 如果有金额，为已有账户入金
      if (amount && amount > 0) {
        // 入金失败是业务失败，必须抛出异常让上层感知
        // 否则用户看到"订阅成功"但虚拟账户余额为 0，下一次信号因余额不足被跳过
        await this.accountsService.deposit(existing.id, {
          userId,
          amount: fundingAmount,
          description: `LLM 策略订阅入金`,
        })
        this.logger.log(`为用户 ${userId} 的虚拟账户 ${existing.id} 入金 ${fundingAmount}`)
      }
      return
    }

    // 创建新的虚拟账户（带初始资金）
    // 注意：账户创建失败时必须抛出异常，否则订阅成功但执行器找不到账户，用户永远无法下单
    try {
      await this.accountsService.createUserStrategyAccount(userId, {
        userId,
        strategyId: llmStrategyId,
        strategyName: strategyName ?? 'LLM Strategy',
        baseCurrency: 'USDT',
        initialBalance: fundingAmount,
      })
      this.logger.log(`为用户 ${userId} 创建 LLM 策略 ${llmStrategyId} 的虚拟账户，初始资金 ${fundingAmount}`)
    } catch (error) {
      // 如果是唯一约束冲突（并发创建），忽略错误并尝试入金
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.debug(`用户 ${userId} 的 LLM 策略 ${llmStrategyId} 虚拟账户已被并发创建`)
        // 并发创建后仍需入金
        if (amount && amount > 0) {
          const account = await this.repo.findUserStrategyAccount(userId, llmStrategyId)
          if (account) {
            // 入金失败必须抛出异常，与 existing 分支保持一致
            // 否则会出现"订阅 active + 虚拟账户余额为 0"的脏状态
            // 后续信号执行都会因 InsufficientBalance 被跳过，用户却没有任何失败提示
            await this.accountsService.deposit(account.id, {
              userId,
              amount: fundingAmount,
              description: `LLM 策略订阅入金`,
            })
            this.logger.log(`并发创建后为用户 ${userId} 的虚拟账户 ${account.id} 入金 ${fundingAmount}`)
          }
        }
        return
      }
      // 其他错误：创建账户失败必须让订阅也失败，否则用户收到"订阅成功"却永远无法下单
      this.logger.error(
        `为用户 ${userId} 创建 LLM 策略 ${llmStrategyId} 的虚拟账户失败: ${error instanceof Error ? error.message : error}`,
      )
      throw new DomainException('llm_subscription.account_creation_failed', { code: ErrorCode.LLM_SUBSCRIPTION_ACCOUNT_FAILED, status: HttpStatus.INTERNAL_SERVER_ERROR })
    }
  }
}
