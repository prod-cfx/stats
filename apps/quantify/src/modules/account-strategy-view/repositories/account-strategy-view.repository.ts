import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import { ErrorCode, SubscriptionStatus  } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable  } from '@nestjs/common'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions'
import { Prisma } from '@/prisma/prisma.types'
import { DeployModeAccountMismatchException, DeployStrategyInstanceNotFoundException } from '../exceptions'

interface ListStrategiesQuery {
  userId: string
  page: number
  limit: number
  status?: 'running' | 'stopped' | 'draft'
  subscribedOnly?: boolean
  excludeDraft?: boolean
}

interface DeployStrategyInput {
  userId: string
  name: string
  exchange: 'binance' | 'okx' | 'hyperliquid'
  symbol: string
  timeframe: string
  positionPct: number
  mode?: 'TESTNET' | 'LIVE'
  strategyInstanceId?: string
  exchangeAccountId?: string
  exchangeAccountName?: string
}

@Injectable()
export class AccountStrategyViewRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

  async deployStrategyForUser(input: DeployStrategyInput): Promise<{ strategyInstanceId: string; mode: 'TESTNET' | 'LIVE' }> {
    const normalizedName = this.normalizeStrategyName(input.name)
    const strategyInstanceId = await this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx
      const existingUser = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      })

      if (!existingUser) {
        throw new DomainException('account_strategy.user_not_found', {
          code: ErrorCode.USER_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
          args: { userId: input.userId },
        })
      }

      let resolvedExchangeAccountId: string | undefined
      let resolvedAccountIsTestnet: boolean | null = null
      if (input.exchangeAccountId) {
        const matchedAccount = await tx.exchangeAccount.findFirst({
          where: {
            id: input.exchangeAccountId,
            userId: input.userId,
          },
          select: { id: true, isTestnet: true },
        })
        if (!matchedAccount) {
          throw new ExchangeAccountNotFoundException({ accountId: input.exchangeAccountId })
        }
        resolvedExchangeAccountId = matchedAccount.id
        resolvedAccountIsTestnet = matchedAccount.isTestnet
      }

      if (!resolvedExchangeAccountId) {
        const existingAccount = await tx.exchangeAccount.findFirst({
          where: {
            userId: input.userId,
            exchangeId: input.exchange,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, isTestnet: true },
        })
        if (!existingAccount) {
          throw new ExchangeAccountNotFoundException({
            accountId: input.exchangeAccountId ?? `${input.exchange}-account`,
          })
        }
        resolvedExchangeAccountId = existingAccount.id
        resolvedAccountIsTestnet = existingAccount.isTestnet
      }

      const resolvedMode: 'TESTNET' | 'LIVE' = resolvedAccountIsTestnet ? 'TESTNET' : 'LIVE'
      if (input.mode && input.mode !== resolvedMode) {
        throw new DeployModeAccountMismatchException({
          expectedMode: resolvedMode,
          accountIsTestnet: resolvedAccountIsTestnet ?? undefined,
          exchangeAccountId: resolvedExchangeAccountId,
        })
      }

      if (input.strategyInstanceId) {
        const existingInstance = await tx.strategyInstance.findFirst({
          where: {
            id: input.strategyInstanceId,
            createdBy: input.userId,
          },
          select: {
            id: true,
            strategyTemplateId: true,
            params: true,
          },
        })

        if (!existingInstance) {
          throw new DeployStrategyInstanceNotFoundException({ strategyInstanceId: input.strategyInstanceId })
        }

        const mergedParams = {
          ...this.asRecord(existingInstance.params),
          exchange: input.exchange,
          symbol: input.symbol,
          timeframe: input.timeframe,
          positionPct: input.positionPct,
        }

        await tx.strategyInstance.update({
          where: { id: existingInstance.id },
          data: {
            name: normalizedName,
            description: `AI 策略部署 - ${input.symbol}`,
            params: mergedParams,
            status: 'running',
            mode: resolvedMode,
            startedAt: new Date(),
            updatedBy: input.userId,
            metadata: {
              source: 'account-ai-quant-deploy',
              sourceStrategyInstanceId: existingInstance.id,
            },
          },
        })

        const existingSubscription = await tx.userStrategySubscription.findFirst({
          where: {
            userId: input.userId,
            strategyInstanceId: existingInstance.id,
          },
          select: { id: true },
        })

        if (existingSubscription) {
          await tx.userStrategySubscription.update({
            where: { id: existingSubscription.id },
            data: {
              status: 'active',
              customParams: mergedParams,
              exchangeAccountId: resolvedExchangeAccountId,
              unsubscribedAt: null,
            },
          })
        } else {
          await tx.userStrategySubscription.create({
            data: {
              userId: input.userId,
              strategyInstanceId: existingInstance.id,
              status: 'active',
              customParams: mergedParams,
              exchangeAccountId: resolvedExchangeAccountId,
            },
          })
        }

        const existingStrategyAccount = await tx.userStrategyAccount.findUnique({
          where: {
            userId_strategyId: {
              userId: input.userId,
              strategyId: existingInstance.strategyTemplateId,
            },
          },
          select: { id: true },
        })

        if (!existingStrategyAccount) {
          const initialBalance = this.resolveInitialBalanceQuote(mergedParams)
          await tx.userStrategyAccount.create({
            data: {
              userId: input.userId,
              strategyId: existingInstance.strategyTemplateId,
              strategyName: normalizedName,
              baseCurrency: 'USDT',
              initialBalance,
              balance: initialBalance,
              equity: initialBalance,
            },
          })
        }

        return {
          strategyInstanceId: existingInstance.id,
          mode: resolvedMode,
        }
      }

      const templateName = `AI量化快捷模板-${input.userId}`
      const existingTemplate = await tx.strategyTemplate.findUnique({
        where: { name: templateName },
        select: { id: true },
      })
      const strategyTemplateId = existingTemplate?.id
        ?? (await tx.strategyTemplate.create({
            data: {
              name: templateName,
              description: '用于 AI 量化一键部署验证的自动模板',
              llmModel: 'gpt-4',
              promptTemplate: 'AUTO_DEPLOY_TEMPLATE',
              paramsSchema: {},
              defaultParams: {
                exchange: input.exchange,
                symbol: input.symbol,
                timeframe: input.timeframe,
                positionPct: input.positionPct,
              },
              requiredFields: [],
              status: 'live',
              createdBy: input.userId,
              updatedBy: input.userId,
              metadata: { source: 'account-ai-quant-deploy' },
            },
            select: { id: true },
          })).id

      const instanceName = `${normalizedName}-${Date.now()}`
      const params = {
        exchange: input.exchange,
        symbol: input.symbol,
        timeframe: input.timeframe,
        positionPct: input.positionPct,
      }

      const strategyInstance = await tx.strategyInstance.create({
        data: {
          strategyTemplateId,
          name: instanceName,
          description: `一键部署 - ${input.symbol}`,
          llmModel: 'gpt-4',
          params,
          status: 'running',
          mode: resolvedMode,
          startedAt: new Date(),
          createdBy: input.userId,
          updatedBy: input.userId,
          metadata: { source: 'account-ai-quant-deploy' },
        },
        select: { id: true },
      })

      await tx.userStrategySubscription.create({
        data: {
          userId: input.userId,
          strategyInstanceId: strategyInstance.id,
          status: 'active',
          customParams: params,
          exchangeAccountId: resolvedExchangeAccountId,
        },
      })

      return {
        strategyInstanceId: strategyInstance.id,
        mode: resolvedMode,
      }
    })

    return strategyInstanceId
  }

  async listStrategiesForUser(query: ListStrategiesQuery) {
    const page = this.normalizePage(query.page)
    const limit = this.normalizeLimit(query.limit)
    const client = this.txHost.tx
    const skip = (page - 1) * limit

    const where: Prisma.StrategyInstanceWhereInput = {
      ...this.buildStatusWhere(query.status),
    }

    if (query.subscribedOnly) {
      where.subscriptions = {
        some: {
          userId: query.userId,
          status: SubscriptionStatus.active,
        },
      }
    } else {
      const subscribedInstanceIds = (
        await client.userStrategySubscription.findMany({
          where: { userId: query.userId },
          select: { strategyInstanceId: true },
        })
      ).map(item => item.strategyInstanceId)

      where.OR = [
        { id: { in: subscribedInstanceIds.length > 0 ? subscribedInstanceIds : ['__none__'] } },
        { createdBy: query.userId },
      ]
    }

    if (query.excludeDraft) {
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : []
      where.AND = [
        ...existingAnd,
        { status: { not: 'draft' } },
      ]
    }

    const [items, total] = await Promise.all([
      client.strategyInstance.findMany({
        where,
        include: {
          strategyTemplate: {
            select: {
              id: true,
              defaultParams: true,
              paramsSchema: true,
              rulesVersion: true,
              metadata: true,
            },
          },
          subscriptions: {
            where: { userId: query.userId },
            select: {
              status: true,
              customParams: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      client.strategyInstance.count({ where }),
    ])

    return new BasePaginationResponseDto(total, page, limit, items.map(item => {
      const userSub = item.subscriptions[0]
      const isSubscribed = !!userSub && userSub.status === SubscriptionStatus.active
      return {
        id: item.id,
        name: item.name,
        status: item.status,
        strategyTemplateId: item.strategyTemplateId,
        params: item.params as Record<string, unknown> | null,
        defaultParams: item.strategyTemplate?.defaultParams as Record<string, unknown> | null,
        strategySchema: item.strategyTemplate?.paramsSchema as Record<string, unknown> | null,
        schemaVersion: item.strategyTemplate?.rulesVersion != null
          ? String(item.strategyTemplate.rulesVersion)
          : null,
        metadata: item.strategyTemplate?.metadata as Record<string, unknown> | null,
        customParams: userSub?.customParams as Record<string, unknown> | null,
        updatedAt: item.updatedAt,
        subscribed: isSubscribed,
      }
    }))
  }

  async findDeployRequestByUserAndRequestId(userId: string, deployRequestId: string) {
    return this.txHost.tx.deployRequest.findUnique({
      where: {
        userId_deployRequestId: {
          userId,
          deployRequestId,
        },
      },
    })
  }

  async createDeployRequestProcessing(userId: string, deployRequestId: string, payloadHash: string) {
    return this.txHost.tx.deployRequest.create({
      data: {
        userId,
        deployRequestId,
        payloadHash,
        status: 'PROCESSING',
      },
    })
  }

  async markDeployRequestSucceeded(id: string, strategyInstanceId: string) {
    return this.txHost.tx.deployRequest.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        strategyInstanceId,
        errorCode: null,
        errorMessage: null,
      },
    })
  }

  async markDeployRequestFailed(id: string, errorCode: string, errorMessage: string) {
    return this.txHost.tx.deployRequest.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorCode,
        errorMessage,
      },
    })
  }

  async upsertRiskProfile(params: {
    strategyInstanceId: string
    adminPerOrderMaxQuote: Prisma.Decimal
    adminDailyMaxQuote: Prisma.Decimal
    adminMaxRiskFractionCap: Prisma.Decimal
    userPerOrderMaxQuote: Prisma.Decimal
    userDailyMaxQuote: Prisma.Decimal
    userMaxRiskFraction: Prisma.Decimal
    effectivePerOrderMaxQuote: Prisma.Decimal
    effectiveDailyMaxQuote: Prisma.Decimal
    effectiveMaxRiskFraction: Prisma.Decimal
  }) {
    return this.txHost.tx.strategyInstanceRiskProfile.upsert({
      where: { strategyInstanceId: params.strategyInstanceId },
      create: {
        ...params,
      },
      update: {
        ...params,
        version: { increment: 1 },
      },
    })
  }

  private normalizePage(value: number): number {
    const page = Number(value)
    if (!Number.isFinite(page) || page < 1) {
      return 1
    }
    return Math.trunc(page)
  }

  private normalizeLimit(value: number): number {
    const limit = Number(value)
    if (!Number.isFinite(limit) || limit < 1) {
      return PAGINATION_CONSTANTS.DEFAULT_PAGE_SIZE
    }
    return Math.min(Math.trunc(limit), PAGINATION_CONSTANTS.MAX_PAGE_SIZE)
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  private normalizeStrategyName(value: unknown): string {
    if (typeof value !== 'string') {
      return 'AI策略'
    }
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : 'AI策略'
  }

  private resolveInitialBalanceQuote(params: Record<string, unknown>): Prisma.Decimal {
    const candidates = [params.initialBalanceQuote, params.accountBalanceQuote]
    for (const candidate of candidates) {
      const numeric = Number(candidate)
      if (Number.isFinite(numeric) && numeric > 0) {
        return new Prisma.Decimal(numeric)
      }
    }
    return new Prisma.Decimal(1000)
  }

  async findStrategyForUser(userId: string, strategyInstanceId: string) {
    const client = this.txHost.tx
    return client.strategyInstance.findFirst({
      where: {
        id: strategyInstanceId,
        OR: [
          { createdBy: userId },
          { subscriptions: { some: { userId } } },
        ],
      },
      include: {
        strategyTemplate: {
          select: {
            id: true,
            defaultParams: true,
            paramsSchema: true,
            rulesVersion: true,
            metadata: true,
          },
        },
        subscriptions: {
          where: { userId },
          include: {
            exchangeAccount: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })
  }

  async findUserStrategyAccount(userId: string, strategyId: string) {
    const client = this.txHost.tx
    return client.userStrategyAccount.findUnique({
      where: {
        userId_strategyId: {
          userId,
          strategyId,
        },
      },
    })
  }

  async findLatestExecutedAccountByUserAndSymbol(userId: string, symbol: string) {
    const client = this.txHost.tx
    const normalizedSymbol = symbol.trim().toUpperCase()

    const latestTrade = await client.trade.findFirst({
      where: {
        symbol: normalizedSymbol,
        account: {
          userId,
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      select: {
        account: {
          select: {
            id: true,
            baseCurrency: true,
            initialBalance: true,
            balance: true,
            equity: true,
            totalRealizedPnl: true,
            totalUnrealizedPnl: true,
          },
        },
      },
    })

    return latestTrade?.account ?? null
  }

  async loadEquitySeries(accountId: string, limit = 120) {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findMany({
      where: { userStrategyAccountId: accountId },
      orderBy: { date: 'asc' },
      take: limit,
    })
  }

  async loadTradeStats(accountId: string) {
    const client = this.txHost.tx
    const [tradeCount, closedCount, winningCount] = await Promise.all([
      client.trade.count({ where: { userStrategyAccountId: accountId } }),
      client.position.count({
        where: { userStrategyAccountId: accountId, status: 'CLOSED' },
      }),
      client.position.count({
        where: {
          userStrategyAccountId: accountId,
          status: 'CLOSED',
          realizedPnl: { gt: 0 },
        },
      }),
    ])

    return {
      tradeCount,
      closedCount,
      winningCount,
    }
  }

  async loadPositionOverview(accountId: string) {
    const client = this.txHost.tx
    const [openCount, closedCount] = await Promise.all([
      client.position.count({
        where: { userStrategyAccountId: accountId, status: 'OPEN' },
      }),
      client.position.count({
        where: { userStrategyAccountId: accountId, status: 'CLOSED' },
      }),
    ])

    return {
      openCount,
      closedCount,
    }
  }

  async loadPositionFinancials(accountId: string) {
    const client = this.txHost.tx
    const [closedAggregate, openPositions] = await Promise.all([
      client.position.aggregate({
        where: {
          userStrategyAccountId: accountId,
          status: 'CLOSED',
        },
        _sum: {
          realizedPnl: true,
        },
      }),
      client.position.findMany({
        where: {
          userStrategyAccountId: accountId,
          status: 'OPEN',
        },
        select: {
          quantity: true,
          avgEntryPrice: true,
          unrealizedPnl: true,
        },
      }),
    ])

    const totalRealizedPnl = closedAggregate._sum.realizedPnl ?? new Prisma.Decimal(0)
    let totalUnrealizedPnl = new Prisma.Decimal(0)
    let openCostBasis = new Prisma.Decimal(0)

    for (const position of openPositions) {
      totalUnrealizedPnl = totalUnrealizedPnl.add(position.unrealizedPnl ?? new Prisma.Decimal(0))
      openCostBasis = openCostBasis.add(position.quantity.mul(position.avgEntryPrice))
    }

    return {
      totalRealizedPnl,
      totalUnrealizedPnl,
      openCostBasis,
    }
  }

  async loadOpenPositionsForValuation(accountId: string) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: 'OPEN',
      },
      select: {
        symbol: true,
        positionSide: true,
        quantity: true,
        avgEntryPrice: true,
        unrealizedPnl: true,
      },
    })
  }

  async loadClosedPositionPnlSeries(accountId: string, limit = 500) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: 'CLOSED',
      },
      orderBy: {
        closedAt: 'asc',
      },
      take: limit,
      select: {
        openedAt: true,
        closedAt: true,
        realizedPnl: true,
      },
    })
  }

  async loadTimeline(userId: string, strategyInstanceId: string, accountId?: string) {
    const client = this.txHost.tx

    const [instance, subscription, signalExecutions, trades] = await Promise.all([
      client.strategyInstance.findUnique({
        where: { id: strategyInstanceId },
        select: {
          createdAt: true,
          startedAt: true,
          stoppedAt: true,
          status: true,
        },
      }),
      client.userStrategySubscription.findFirst({
        where: { userId, strategyInstanceId },
        select: {
          subscribedAt: true,
          unsubscribedAt: true,
          status: true,
        },
      }),
      accountId
        ? client.userSignalExecution.findMany({
            where: { userId, userStrategyAccountId: accountId },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      accountId
        ? client.trade.findMany({
            where: { userStrategyAccountId: accountId },
            orderBy: { executedAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ])

    return {
      instance,
      subscription,
      signalExecutions,
      trades,
    }
  }

  async deleteStrategyForUser(userId: string, strategyInstanceId: string): Promise<void> {
    await this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx
      const strategy = await tx.strategyInstance.findFirst({
        where: {
          id: strategyInstanceId,
          createdBy: userId,
        },
        select: {
          id: true,
        },
      })
      if (!strategy) {
        return
      }

      await tx.strategyInstance.delete({
        where: {
          id: strategy.id,
        },
      })
    })
  }

  private buildStatusWhere(status?: 'running' | 'stopped' | 'draft'): Prisma.StrategyInstanceWhereInput {
    if (!status) return {}
    if (status === 'running') {
      return { status: 'running' }
    }
    if (status === 'draft') {
      return { status: 'draft' }
    }
    return { status: { in: ['stopped', 'paused'] } }
  }
}
