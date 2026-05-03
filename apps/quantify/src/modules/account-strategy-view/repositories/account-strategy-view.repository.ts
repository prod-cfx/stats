import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { PrismaClient } from '@/prisma/prisma.types'
import type { StrategyFundingSnapshot } from '@/modules/trading/core/strategy-buying-power.resolver'
import { ErrorCode, PositionStatus, SubscriptionStatus  } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Injectable  } from '@nestjs/common'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ExchangeAccountNotFoundException } from '@/modules/exchange-accounts/exceptions'
import { RUNTIME_BINDING_STATUS } from '@/modules/strategy-signals/types/runtime-binding-status.type'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI requires runtime value import
import { PrismaService } from '@/prisma/prisma.service'
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
  marketType: 'spot' | 'perp'
  timeframe: string
  positionPct: number | null
  positionSizing?: {
    mode: 'pct_equity' | 'fixed_quote' | 'fixed_base' | 'position_pct'
    value: number
    asset?: string
  }
  deploymentExecutionConfig?: {
    leverage?: number | null
    priceSource?: string | null
    orderType?: string | null
    timeInForce?: string | null
  }
  executionConfigVersion?: number
  publishedSnapshotBinding?: {
    bindingSource: 'PUBLISHED_SNAPSHOT'
    publishedSnapshotId: string
    snapshotHash: string
    sourceStrategyInstanceId: string | null
    sourceStrategyTemplateId: string | null
  }
  initialBalanceQuote?: number
  accountBalanceQuote?: number
  fundingSnapshot?: StrategyFundingSnapshot | null
  mode?: 'TESTNET' | 'LIVE'
  exchangeAccountId?: string
  exchangeAccountName?: string
}

interface ExistingInstanceSnapshotBinding {
  bindingSource?: unknown
  publishedSnapshotId?: unknown
  snapshotHash?: unknown
}

interface ResolvedDeployExchangeAccount {
  id: string
  isTestnet: boolean | null
  exchangeId: 'binance' | 'okx' | 'hyperliquid'
}

@Injectable()
export class AccountStrategyViewRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private readonly prisma: PrismaService,
  ) {}

  async resolveDeployExchangeAccount(input: {
    userId: string
    exchange: 'binance' | 'okx' | 'hyperliquid'
    exchangeAccountId?: string | null
  }): Promise<ResolvedDeployExchangeAccount> {
    if (input.exchangeAccountId) {
      const matchedAccount = await this.prisma.exchangeAccount.findFirst({
        where: {
          id: input.exchangeAccountId,
          userId: input.userId,
        },
        select: { id: true, isTestnet: true, exchangeId: true },
      })
      if (!matchedAccount) {
        throw new ExchangeAccountNotFoundException({ accountId: input.exchangeAccountId })
      }
      if (matchedAccount.exchangeId !== input.exchange) {
        throw new DomainException('account_strategy.deploy_exchange_account_mismatch', {
          code: ErrorCode.BAD_REQUEST,
          status: HttpStatus.BAD_REQUEST,
          args: {
            exchangeAccountId: input.exchangeAccountId,
            expectedExchange: input.exchange,
            actualExchange: matchedAccount.exchangeId,
          },
        })
      }
      return {
        id: matchedAccount.id,
        isTestnet: matchedAccount.isTestnet,
        exchangeId: matchedAccount.exchangeId as 'binance' | 'okx' | 'hyperliquid',
      }
    }

    const existingAccount = await this.prisma.exchangeAccount.findFirst({
      where: {
        userId: input.userId,
        exchangeId: input.exchange,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, isTestnet: true, exchangeId: true },
    })
    if (!existingAccount) {
      throw new ExchangeAccountNotFoundException({
        accountId: `${input.exchange}-account`,
      })
    }
    return {
      id: existingAccount.id,
      isTestnet: existingAccount.isTestnet,
      exchangeId: existingAccount.exchangeId as 'binance' | 'okx' | 'hyperliquid',
    }
  }

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
          select: { id: true, isTestnet: true, exchangeId: true },
        })
        if (!matchedAccount) {
          throw new ExchangeAccountNotFoundException({ accountId: input.exchangeAccountId })
        }
        if (matchedAccount.exchangeId !== input.exchange) {
          throw new DomainException('account_strategy.deploy_exchange_account_mismatch', {
            code: ErrorCode.BAD_REQUEST,
            status: HttpStatus.BAD_REQUEST,
            args: {
              exchangeAccountId: input.exchangeAccountId,
              expectedExchange: input.exchange,
              actualExchange: matchedAccount.exchangeId,
            },
          })
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
      const fundingSnapshot = this.normalizeFundingSnapshotForDeployMode(input.fundingSnapshot, resolvedMode)

      const reusableStrategyInstanceId = input.publishedSnapshotBinding?.sourceStrategyInstanceId ?? null

      if (reusableStrategyInstanceId) {
        const existingInstance = await tx.strategyInstance.findFirst({
          where: {
            id: reusableStrategyInstanceId,
            createdBy: input.userId,
          },
          select: {
            id: true,
            strategyTemplateId: true,
            params: true,
            metadata: true,
          },
        })

        if (!existingInstance) {
          throw new DeployStrategyInstanceNotFoundException({ strategyInstanceId: reusableStrategyInstanceId })
        }

        const snapshotBinding = this.readExistingSnapshotBinding(existingInstance.metadata)
        if (input.publishedSnapshotBinding) {
          this.assertSnapshotBindingMatchesExistingInstance({
            strategyInstanceId: existingInstance.id,
            existingBinding: snapshotBinding,
            expectedPublishedSnapshotId: input.publishedSnapshotBinding.publishedSnapshotId,
            expectedSnapshotHash: input.publishedSnapshotBinding.snapshotHash,
          })
        }

        const mergedParams = {
          ...this.asRecord(existingInstance.params),
          exchange: input.exchange,
          symbol: input.symbol,
          marketType: input.marketType,
          timeframe: input.timeframe,
          ...(input.positionPct !== null ? { positionPct: input.positionPct } : {}),
          ...(input.positionSizing ? { positionSizing: input.positionSizing } : {}),
          ...(input.deploymentExecutionConfig
            ? {
                deploymentExecutionConfig: input.deploymentExecutionConfig,
                executionConfigVersion: input.executionConfigVersion ?? 1,
              }
            : {}),
          ...(typeof input.initialBalanceQuote === 'number' && Number.isFinite(input.initialBalanceQuote)
            ? { initialBalanceQuote: input.initialBalanceQuote }
            : {}),
          ...(typeof input.accountBalanceQuote === 'number' && Number.isFinite(input.accountBalanceQuote)
            ? { accountBalanceQuote: input.accountBalanceQuote }
            : {}),
          ...(fundingSnapshot
            ? { fundingSnapshot: fundingSnapshot as unknown as Prisma.InputJsonValue }
            : {}),
        }

        const snapshotBindingMetadata = this.buildSnapshotBindingMetadata(input)
        const existingMetadata = this.asRecord(existingInstance.metadata)
        await tx.strategyInstance.update({
          where: { id: existingInstance.id },
          data: {
            name: normalizedName,
            description: `AI 策略部署 - ${input.symbol}`,
            params: mergedParams,
            deploymentExecutionConfig: input.deploymentExecutionConfig as Prisma.InputJsonValue | undefined,
            executionConfigVersion: input.executionConfigVersion ?? 1,
            runtimeBindingStatus: RUNTIME_BINDING_STATUS.PENDING,
            runtimeBindingErrorCode: null,
            runtimeBindingUpdatedAt: new Date(),
            updatedBy: input.userId,
            metadata: {
              ...existingMetadata,
              source: 'account-ai-quant-deploy',
              sourceStrategyInstanceId: existingInstance.id,
              ...snapshotBindingMetadata,
            },
          } as any,
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
          select: {
            id: true,
            initialBalance: true,
            balance: true,
            equity: true,
            totalRealizedPnl: true,
            totalUnrealizedPnl: true,
            _count: {
              select: {
                positions: true,
                trades: true,
                ledger: true,
                signalExecutions: true,
              },
            },
          },
        })

        if (!existingStrategyAccount) {
          const initialBalance = this.resolveInitialBalanceQuote(mergedParams)
          const accountBalance = this.resolveAccountBalanceQuote(mergedParams, initialBalance)
          const baseCurrency = this.resolveStrategyAccountBaseCurrency(mergedParams, fundingSnapshot)
          await tx.userStrategyAccount.create({
            data: {
              userId: input.userId,
              strategyId: existingInstance.strategyTemplateId,
              strategyName: normalizedName,
              baseCurrency,
              initialBalance,
              balance: accountBalance,
              equity: initialBalance,
            },
          })
        }
        else if (this.isPristineStrategyAccount(existingStrategyAccount)) {
          const initialBalance = this.resolveInitialBalanceQuote(mergedParams)
          const accountBalance = this.resolveAccountBalanceQuote(mergedParams, initialBalance)
          const baseCurrency = this.resolveStrategyAccountBaseCurrency(mergedParams, fundingSnapshot)
          await tx.userStrategyAccount.update({
            where: { id: existingStrategyAccount.id },
            data: {
              strategyName: normalizedName,
              baseCurrency,
              initialBalance,
              balance: accountBalance,
              equity: initialBalance,
            },
          })
        }

        return {
          strategyInstanceId: existingInstance.id,
          mode: resolvedMode,
        }
      }

      throw new DeployStrategyInstanceNotFoundException({
        strategyInstanceId: input.publishedSnapshotBinding?.sourceStrategyInstanceId ?? undefined,
      })
    })

    return strategyInstanceId
  }

  private readExistingSnapshotBinding(metadata: unknown): ExistingInstanceSnapshotBinding {
    const record = this.asRecord(metadata)
    return {
      bindingSource: record.bindingSource,
      publishedSnapshotId: record.publishedSnapshotId,
      snapshotHash: record.snapshotHash,
    }
  }

  private normalizeFundingSnapshotForDeployMode(
    fundingSnapshot: StrategyFundingSnapshot | null | undefined,
    mode: 'TESTNET' | 'LIVE',
  ): StrategyFundingSnapshot | null {
    if (!fundingSnapshot) return null
    return {
      ...fundingSnapshot,
      fundingSource: mode === 'LIVE' ? 'exchange_live' : 'exchange_testnet',
    }
  }

  private resolveStrategyAccountBaseCurrency(
    params: Record<string, unknown>,
    fundingSnapshot: StrategyFundingSnapshot | null,
  ): string {
    const snapshotAsset = fundingSnapshot?.asset?.trim().toUpperCase()
    if (snapshotAsset) return snapshotAsset

    const rawSymbol = params.symbol
    if (typeof rawSymbol !== 'string') return 'USDT'
    const normalized = rawSymbol.trim().toUpperCase()
    if (normalized.endsWith('USDT')) return 'USDT'
    if (normalized.endsWith('USDC')) return 'USDC'
    const parts = normalized.split(/[/:-]/).filter(Boolean)
    return parts[1] ?? 'USDT'
  }

  private isPristineStrategyAccount(account: {
    initialBalance: unknown
    balance: unknown
    equity: unknown
    totalRealizedPnl: unknown
    totalUnrealizedPnl: unknown
    _count?: {
      positions?: number
      trades?: number
      ledger?: number
      signalExecutions?: number
    }
  }): boolean {
    const hasActivity =
      (account._count?.positions ?? 0) > 0
      || (account._count?.trades ?? 0) > 0
      || (account._count?.ledger ?? 0) > 0
      || (account._count?.signalExecutions ?? 0) > 0
    if (hasActivity) return false

    return this.toFiniteNumber(account.totalRealizedPnl) === 0
      && this.toFiniteNumber(account.totalUnrealizedPnl) === 0
  }

  private toFiniteNumber(value: unknown): number | null {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }

  private assertSnapshotBindingMatchesExistingInstance(input: {
    strategyInstanceId: string
    existingBinding: ExistingInstanceSnapshotBinding
    expectedPublishedSnapshotId: string
    expectedSnapshotHash: string
  }): void {
    const existingPublishedSnapshotId = typeof input.existingBinding.publishedSnapshotId === 'string'
      ? input.existingBinding.publishedSnapshotId.trim()
      : ''
    const existingSnapshotHash = typeof input.existingBinding.snapshotHash === 'string'
      ? input.existingBinding.snapshotHash.trim()
      : ''
    const existingBindingSource = typeof input.existingBinding.bindingSource === 'string'
      ? input.existingBinding.bindingSource.trim()
      : ''

    if (!existingPublishedSnapshotId || !existingSnapshotHash || existingBindingSource !== 'PUBLISHED_SNAPSHOT') {
      throw new DeployStrategyInstanceNotFoundException({
        strategyInstanceId: input.strategyInstanceId,
      })
    }

    if (
      existingPublishedSnapshotId !== input.expectedPublishedSnapshotId
      || existingSnapshotHash !== input.expectedSnapshotHash
    ) {
      throw new DeployStrategyInstanceNotFoundException({
        strategyInstanceId: input.strategyInstanceId,
      })
    }
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
    return this.prisma.deployRequest.findUnique({
      where: {
        userId_deployRequestId: {
          userId,
          deployRequestId,
        },
      },
    })
  }

  async createDeployRequestProcessing(userId: string, deployRequestId: string, payloadHash: string) {
    return this.prisma.deployRequest.create({
      data: {
        userId,
        deployRequestId,
        payloadHash,
        status: 'PROCESSING',
      },
    })
  }

  async markDeployRequestSucceeded(id: string, strategyInstanceId: string) {
    return this.prisma.deployRequest.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        strategyInstanceId,
        errorCode: null,
        errorMessage: null,
      },
    })
  }

  async activateStrategyInstanceForRuntime(params: {
    strategyInstanceId: string
    mode: 'TESTNET' | 'LIVE'
    userId: string
  }) {
    return this.prisma.strategyInstance.update({
      where: { id: params.strategyInstanceId },
      data: {
        status: 'running',
        mode: params.mode,
        startedAt: new Date(),
        updatedBy: params.userId,
        runtimeBindingStatus: RUNTIME_BINDING_STATUS.READY,
        runtimeBindingErrorCode: null,
        runtimeBindingUpdatedAt: new Date(),
      },
    })
  }

  async markStrategyInstanceRuntimeBindingFailed(params: {
    strategyInstanceId: string
    errorCode: string
    userId?: string
  }) {
    return this.prisma.strategyInstance.update({
      where: { id: params.strategyInstanceId },
      data: {
        runtimeBindingStatus: RUNTIME_BINDING_STATUS.FAILED,
        runtimeBindingErrorCode: params.errorCode,
        runtimeBindingUpdatedAt: new Date(),
        ...(params.userId ? { updatedBy: params.userId } : {}),
      },
    })
  }

  async markDeployRequestFailed(id: string, errorCode: string, errorMessage: string) {
    return this.prisma.deployRequest.update({
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

  private buildSnapshotBindingMetadata(input: DeployStrategyInput): Record<string, unknown> {
    if (!input.publishedSnapshotBinding) return {}
    return {
      bindingSource: input.publishedSnapshotBinding.bindingSource,
      publishedSnapshotId: input.publishedSnapshotBinding.publishedSnapshotId,
      snapshotHash: input.publishedSnapshotBinding.snapshotHash,
      sourceStrategyInstanceId: input.publishedSnapshotBinding.sourceStrategyInstanceId,
      sourceStrategyTemplateId: input.publishedSnapshotBinding.sourceStrategyTemplateId,
    }
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

  private resolveAccountBalanceQuote(
    params: Record<string, unknown>,
    fallbackInitialBalance: Prisma.Decimal,
  ): Prisma.Decimal {
    const numeric = Number(params.accountBalanceQuote)
    if (Number.isFinite(numeric) && numeric >= 0) {
      return new Prisma.Decimal(numeric)
    }
    return fallbackInitialBalance
  }

  async updateDeploymentExecutionConfig(input: {
    strategyInstanceId: string
    userId: string
    executionConfig: {
      leverage: number
      priceSource: string
      orderType: string
      timeInForce: string
    }
    executionConfigVersion: number
    existingParams: Record<string, unknown>
    existingMetadata: Record<string, unknown>
    reason?: string
  }) {
    return this.txHost.tx.strategyInstance.update({
      where: { id: input.strategyInstanceId },
      data: {
        deploymentExecutionConfig: input.executionConfig as Prisma.InputJsonValue,
        executionConfigVersion: input.executionConfigVersion,
        updatedBy: input.userId,
        params: {
          ...input.existingParams,
          deploymentExecutionConfig: input.executionConfig,
          executionConfigVersion: input.executionConfigVersion,
        } as Prisma.InputJsonValue,
        metadata: {
          ...input.existingMetadata,
          executionConfigVersion: input.executionConfigVersion,
          reReadAtNextEligibleExecutionCycle: true,
          ...(input.reason ? { executionConfigUpdateReason: input.reason } : {}),
        } as Prisma.InputJsonValue,
      } as any,
    })
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
                id: true,
                name: true,
                exchangeId: true,
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

  async refreshPristineStrategyAccountFunding(input: {
    accountId: string
    baseCurrency: string
    initialBalance: number
    balance: number
    equity: number
  }): Promise<void> {
    const client = this.txHost.tx
    const account = await client.userStrategyAccount.findUnique({
      where: { id: input.accountId },
      select: {
        id: true,
        initialBalance: true,
        balance: true,
        equity: true,
        totalRealizedPnl: true,
        totalUnrealizedPnl: true,
        _count: {
          select: {
            positions: true,
            trades: true,
            ledger: true,
            signalExecutions: true,
          },
        },
      },
    })

    if (!account || !this.isPristineStrategyAccount(account)) return

    await client.userStrategyAccount.update({
      where: { id: input.accountId },
      data: {
        baseCurrency: input.baseCurrency,
        initialBalance: new Prisma.Decimal(input.initialBalance),
        balance: new Prisma.Decimal(input.balance),
        equity: new Prisma.Decimal(input.equity),
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

  async loadLatestDailySnapshot(accountId: string) {
    const client = this.txHost.tx
    return client.strategyPnlDaily.findFirst({
      where: { userStrategyAccountId: accountId },
      orderBy: { date: 'desc' },
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

  async loadOpenPositionsForLiquidation(accountId: string) {
    const client = this.txHost.tx
    return client.position.findMany({
      where: {
        userStrategyAccountId: accountId,
        status: PositionStatus.OPEN,
      },
      select: {
        id: true,
        symbol: true,
        positionSide: true,
        quantity: true,
        exchangeId: true,
        marketType: true,
        status: true,
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
            include: {
              signal: {
                select: {
                  signalType: true,
                  direction: true,
                  symbol: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
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

      await tx.llmStrategyCodegenSession.updateMany({
        where: {
          userId,
          strategyInstanceId: strategy.id,
        },
        data: {
          strategyInstanceId: null,
        },
      })

      await tx.publishedStrategySnapshot.updateMany({
        where: {
          strategyInstanceId: strategy.id,
          session: {
            userId,
          },
        },
        data: {
          strategyInstanceId: null,
        },
      })

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
