/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器和依赖注入需要运行时导入 */
import type { SubscriptionStatus } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
import Ajv from 'ajv'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions/exchange-account-not-found.exception'
import { Prisma } from '@/prisma/prisma.types'
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

// Prisma 7: 从 Prisma namespace 导出类型和值
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
    private readonly subscriptionsRepo: SubscriptionsRepository,
  ) {}

  async subscribe(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    // 查询策略实例及其关联的模板信息
    const strategyInstance = await this.subscriptionsRepo.findStrategyInstanceForSubscribe(dto.strategyInstanceId)

    if (!strategyInstance) {
      throw new StrategyNotAvailableException({ strategyInstanceId: dto.strategyInstanceId, status: 'not_found' })
    }

    // 检查策略实例状态
    if (strategyInstance.status !== 'running') {
      throw new StrategyNotAvailableException({ strategyInstanceId: dto.strategyInstanceId, status: strategyInstance.status })
    }

    // 🔴 关键校验：只允许订阅实盘模式（LIVE）的策略实例
    // 防止用户订阅 PAPER/TESTNET/BACKTEST 模式实例，导致订阅成功但列表/详情 API 返回 404（僵尸订阅）
    // （因为 C 端接口已强制过滤 mode !== 'LIVE' 的实例）
    if (strategyInstance.mode !== 'LIVE') {
      throw new StrategyNotAvailableException({ 
        strategyInstanceId: dto.strategyInstanceId, 
        status: `mode_${strategyInstance.mode.toLowerCase()}`,
        message: `该策略实例当前处于 ${strategyInstance.mode} 模式，仅支持订阅实盘模式（LIVE）的策略`
      })
    }

    // 检查策略模板状态
    if (strategyInstance.strategyTemplate.status !== 'live') {
      throw new StrategyNotAvailableException({
        strategyInstanceId: dto.strategyInstanceId,
        status: strategyInstance.strategyTemplate.status,
      })
    }

    const existing = await this.subscriptionsRepo.findByUserAndStrategy(userId, dto.strategyInstanceId)

    // 目标参数与交易所账户：对于重新订阅场景，若未显式传入则沿用历史记录，确保参数校验覆盖真实生效的数据
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

    // 已存在订阅记录时，根据状态决定是报错还是执行"重新订阅/恢复"
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

      this.logger.log(`用户 ${userId} 重新激活订阅 ${updated.id}（策略实例 ${dto.strategyInstanceId}）`)

      const detail = await this.subscriptionsRepo.findByIdWithDetails(updated.id)
      if (!detail || detail.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId: updated.id })
      }
      return this.toResponseDto(detail)
    }

    // 首次订阅：直接创建新记录
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
        // 唯一约束冲突，视为用户已订阅该策略实例
        throw new AlreadySubscribedException({ strategyInstanceId: dto.strategyInstanceId })
      }
      throw error
    }

    this.logger.log(`用户 ${userId} 成功订阅策略实例 ${dto.strategyInstanceId}`)

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

    // 当需要切换状态为 active 或者更新自定义参数时，使用包含校验数据的查询
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
        // 🔴 关键校验：恢复订阅时也要检查 mode，防止恢复非 LIVE 模式的订阅
        if (subscription.strategyInstance.mode !== 'LIVE') {
          throw new StrategyNotAvailableException({
            strategyInstanceId: subscription.strategyInstanceId,
            status: `mode_${subscription.strategyInstance.mode.toLowerCase()}`,
            message: `该策略实例当前处于 ${subscription.strategyInstance.mode} 模式，仅支持订阅实盘模式（LIVE）的策略`
          })
        }
        if (subscription.strategyInstance.strategyTemplate.status !== 'live') {
          throw new StrategyNotAvailableException({
            strategyInstanceId: subscription.strategyInstanceId,
            status: subscription.strategyInstance.strategyTemplate.status,
          })
        }
      }

      // 1) 如果 PATCH 里显式带了 customParams，则校验新参数
      if (dto.customParams !== undefined) {
        this.validateCustomParams(
          subscription.strategyInstance.strategyTemplate.requiredFields,
          dto.customParams,
          subscription.strategyInstance.strategyTemplate.paramsSchema as Record<string, unknown> | null,
        )
      }
      // 2) 仅切换状态为 active，未带 customParams 时，必须用历史参数做一次校验
      else if (dto.status === 'active') {
        this.validateCustomParams(
          subscription.strategyInstance.strategyTemplate.requiredFields,
          subscription.customParams as Record<string, unknown> | null | undefined,
          subscription.strategyInstance.strategyTemplate.paramsSchema as Record<string, unknown> | null,
        )
      }
    } else {
      // 不需要校验时，只查询基本订阅信息
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

    // 如果没有任何字段需要更新，直接返回当前详情
    if (Object.keys(updatePayload).length === 0) {
      const currentDetail = await this.subscriptionsRepo.findByIdWithDetails(subscriptionId)
      if (!currentDetail || currentDetail.userId !== userId) {
        throw new SubscriptionNotFoundException({ subscriptionId })
      }
      return this.toResponseDto(currentDetail)
    }

    const updated = await this.subscriptionsRepo.update(subscriptionId, updatePayload)
    this.logger.log(`用户 ${userId} 更新订阅 ${subscriptionId}`)

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
    // 1) 先按 requiredFields 做"必填字段"校验（如果模板配置了）
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
        // 使用 Object.prototype.hasOwnProperty.call 来避免原型链污染
        // 检查字段是否真正存在于对象自身属性中，而不是原型链上
        if (!Object.prototype.hasOwnProperty.call(customParams, field)) {
          return true
        }
        // 即使属性存在，也要检查值是否为 undefined 或 null
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

    // 2) 无论 requiredFields 是否为空，只要 paramsSchema 存在且传入了 customParams，就执行 JSON Schema 校验
    if (paramsSchema && customParams) {
      if (typeof paramsSchema !== 'object' || Array.isArray(paramsSchema)) {
        this.logger.warn('策略模板 paramsSchema 不是有效的 JSON Schema 对象，跳过 JSON Schema 校验')
        return
      }

      // 限制 schema 大小，防止 DoS 攻击
      // 如果 schema 过大，这是服务器端配置问题，不应该返回 400 给用户
      // 记录警告并跳过校验，让运维团队修复模板配置
      const schemaSize = JSON.stringify(paramsSchema).length
      if (schemaSize > 50000) {
        this.logger.warn(`paramsSchema 过大 (${schemaSize} bytes)，跳过 JSON Schema 校验，请检查策略模板配置`)
        return
      }

      try {
        const validate = this.ajv.compile(paramsSchema)
        
        // 直接执行验证（超时保护通过 ajv 配置实现）
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
          `订阅参数 JSON Schema 校验失败`,
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

    this.logger.log(`用户 ${userId} 取消订阅 ${subscriptionId}`)
  }

  private async ensureExchangeAccountOwnership(userId: string, exchangeAccountId: string) {
    const account = await this.subscriptionsRepo.findExchangeAccountOwnership(exchangeAccountId, userId)

    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId: exchangeAccountId })
    }
  }

  private toResponseDto(subscription: SubscriptionWithRelations): SubscriptionResponseDto {
    // 防御性检查：确保关联数据存在
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
      // 使用用户为交易所账户配置的别名；如需暴露底层 exchangeId 请在 DTO 中单独扩展字段
      exchangeName: subscription.exchangeAccount?.name ?? null,
      subscribedAt: subscription.subscribedAt,
      unsubscribedAt: subscription.unsubscribedAt ?? null,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    }
  }
}
