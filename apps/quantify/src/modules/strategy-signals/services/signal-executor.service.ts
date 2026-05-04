import type { PositionSide, SignalDirection, SignalStatus, TradeSide } from '@ai/shared'
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { TradingSignalCreatedEvent } from '../events/strategy-signal.events'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { ExecutionStage } from '@/modules/trading/core/execution-stage'
import type { ExchangeId, MarketType, UnifiedOrder } from '@/modules/trading/core/types'
import type {
  OrderIntent,
  OrderIntentRole,
  TradingExecutionPrepareResult,
  TradingExecutionResult,
  TradingExecutionSubmitPreparedResult,
} from '@/modules/trading-execution/types/trading-execution.types'
import type {
  Symbol as PrismaSymbol,
  PrismaClient,
  UserStrategyAccount,
  StrategyInstanceRiskProfile,
} from '@/prisma/prisma.types'
import { setTimeout as sleep } from 'node:timers/promises'
import { LedgerEntryType } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 TransactionHost
import { TransactionHost } from '@nestjs-cls/transactional'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 ConfigService
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { AccountsService } from '@/modules/accounts/accounts.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PositionsService } from '@/modules/positions/positions.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { StrategyInstancesService } from '@/modules/strategy-instances/services/strategy-instances.service'
import { EXECUTION_STAGES } from '@/modules/trading/core/execution-stage'
import { resolveStrategyFundingFromStrategyAccount } from '@/modules/trading/core/strategy-buying-power.resolver'
import { normalizeLedgerSymbol } from '@/modules/trading/core/symbol-normalizer'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingExecutionService } from '@/modules/trading-execution/services/trading-execution.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingService } from '@/modules/trading/trading.service'
import { Prisma } from '@/prisma/prisma.types'
import { StrategySignalEvents } from '../constants/strategy-signal.constants'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalExecutionRepository } from '../repositories/signal-execution.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalExecutorRepository } from '../repositories/signal-executor.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { TradingSignalRepository } from '../repositories/trading-signal.repository'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
import { PositionAdmissionService, type PortfolioAdmissionConstraints } from './position-admission.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalTelemetryService } from './signal-telemetry.service'

// Prisma 7: 从 Prisma namespace 导出类型和值
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

type LoadedSignal = NonNullable<Awaited<ReturnType<TradingSignalRepository['findById']>>>
type LockedStrategyAccount = Pick<
  UserStrategyAccount,
  'id' | 'userId' | 'baseCurrency' | 'balance' | 'equity' | 'initialBalance'
>

interface OrderParams {
  exchangeId: 'binance' | 'okx' | 'hyperliquid'
  marketType: 'spot' | 'perp'
  symbol: string
  side: 'buy' | 'sell'
  reduceOnly?: boolean
  amount: number
  price?: number
}

const RECOVERY_BATCH_SIZE = 50
const EXECUTION_RECOVERY_GRACE_MS = 5_000
const ORDER_RECONCILE_RETRY_MS = 300
const ORDER_RECONCILE_RETRY_COUNT = 3
const EXECUTION_RECOVERY_CRON_JOB = 'strategy-signals.execute-recovery'

@Injectable()
export class SignalExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalExecutorService.name)
  private recoveryCronJob?: CronJob

  constructor(
    private readonly executorRepository: SignalExecutorRepository,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly tradingService: TradingService,
    private readonly tradingExecution: TradingExecutionService,
    private readonly accountsService: AccountsService,
    private readonly strategyInstancesService: StrategyInstancesService,
    private readonly positionsService: PositionsService,
    private readonly tradingSignalRepository: TradingSignalRepository,
    private readonly executionRepository: SignalExecutionRepository,
    private readonly telemetry: SignalTelemetryService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    private readonly positionAdmissionService: PositionAdmissionService = new PositionAdmissionService(),
  ) {}

  async onModuleInit() {
    const config = this.getConfig()
    if (!config.execution.enabled) return

    this.registerRecoveryCronJob(config)

    try {
      await this.recoverExecutableSignals(config)
    }
    catch (error) {
      this.logger.error(
        `Failed to recover executable signals on startup: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  onModuleDestroy() {
    if (!this.recoveryCronJob) return

    this.recoveryCronJob.stop()
    this.schedulerRegistry.deleteCronJob(EXECUTION_RECOVERY_CRON_JOB)
    this.recoveryCronJob = undefined
  }

  @OnEvent(StrategySignalEvents.CREATED, { async: true })
  async handleSignalCreated(event: TradingSignalCreatedEvent) {
    const config = this.getConfig()
    if (!config.execution.enabled) {
      this.logger.debug(`Signal execution disabled; skipping signal ${event.signalId}`)
      return
    }

    await this.txHost.withTransaction(async () => {
      await this.executeSignalForSubscribedUsers(event.signalId, config)
    })
  }

  private getConfig(): StrategySignalsRuntimeConfig {
    return this.configService.get<StrategySignalsRuntimeConfig>('strategySignals') ?? DEFAULT_STRATEGY_SIGNALS_CONFIG
  }

  private registerRecoveryCronJob(config: StrategySignalsRuntimeConfig) {
    if (this.recoveryCronJob) {
      this.recoveryCronJob.stop()
      this.schedulerRegistry.deleteCronJob(EXECUTION_RECOVERY_CRON_JOB)
    }

    this.recoveryCronJob = new CronJob(config.cronExpression, async () => {
      try {
        await this.recoverExecutableSignals(this.getConfig())
      } catch (error) {
        const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
        this.logger.error(`Signal execution recovery cron tick failed: ${detail}`)
      }
    })

    this.schedulerRegistry.addCronJob(EXECUTION_RECOVERY_CRON_JOB, this.recoveryCronJob)
    this.recoveryCronJob.start()
    this.logger.log(`Signal execution recovery scheduled with cron ${config.cronExpression}`)
  }

  /**
   * 对仍处于可补偿窗口的 signal 做补偿执行，
   * 既服务于启动恢复，也服务于运行时的定期恢复。
   */
  private async recoverExecutableSignals(config: StrategySignalsRuntimeConfig) {
    const signals = await this.executorRepository.findRecoverableSignals({
      limit: RECOVERY_BATCH_SIZE,
      readyBefore: new Date(Date.now() - EXECUTION_RECOVERY_GRACE_MS),
    })

    if (!signals.length) return

    this.logger.log(`Recovering ${signals.length} executable signals`)

    for (const signal of signals) {
      try {
        await this.executeSignalForSubscribedUsers(signal.id, config)
      }
      catch (error) {
        this.logger.error(
          `Failed to recover signal ${signal.id}: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    }
  }

  async executeSignalForSubscribedUsers(signalId: string, config: StrategySignalsRuntimeConfig = this.getConfig()) {
    if (!config.execution.enabled) return

    const signal = await this.tradingSignalRepository.findById(signalId, {
      includeStrategy: true,
      includeSymbol: true,
    })

    // LLM 信号可能不会关联旧版 strategy（strategyId 为空），但仍应进入执行链路
    // 因此这里仅要求 signal 和 symbol 存在
    if (!signal || !signal.symbol) {
      this.logger.warn(`Signal ${signalId} not found or missing relations, aborting execution`)
      return
    }

    // 兼容：旧策略使用 strategyId，LLM 策略使用 llmStrategyId
    const effectiveStrategyId = signal.strategyId ?? signal.llmStrategyId
    if (!effectiveStrategyId) {
      this.logger.warn(`Signal ${signal.id} missing strategyId/llmStrategyId, aborting execution`)
      return
    }

    const where: Prisma.UserStrategyAccountWhereInput = {
      // 注意：这里沿用 userStrategyAccount.strategyId 作为“策略维度”的账户映射键；
      // 旧策略填 strategyId，LLM 策略填 llmStrategyId（执行器用 effectiveStrategyId 统一处理）
      strategyId: effectiveStrategyId,
      // 仅选择尚未为当前 signal 创建执行记录的账户，避免重复执行
      signalExecutions: {
        none: {
          signalId: signal.id,
        },
      },
    }

    // 如果信号绑定到了具体的策略实例，则只对订阅了该实例的用户执行
    if (signal.strategyInstanceId) {
      where.user = {
        strategySubscriptions: {
          some: {
            strategyInstanceId: signal.strategyInstanceId,
            status: 'active',
          },
        },
      }
    } else if (signal.llmStrategyInstanceId) {
      // LLM 实例级订阅过滤：仅对订阅了该 LLM 实例的用户执行
      // 执行器通过 signal.llmStrategyId 查找 UserStrategyAccount.strategyId 来匹配账户
      // 订阅服务在创建/激活订阅时会自动创建对应的 UserStrategyAccount
      where.user = {
        llmStrategySubscriptions: {
          some: {
            llmStrategyInstanceId: signal.llmStrategyInstanceId,
            status: 'active',
          },
        },
      }
    }

    const accounts = await this.executorRepository.findSubscribedAccounts(where, config.execution.maxAccountsPerSignal)

    if (!accounts.length) {
      this.logger.debug(`No subscribed accounts for signal ${signal.id}`)
      await this.tradingSignalRepository.updateStatus(signal.id, 'FAILED', { reason: 'NO_SUBSCRIBERS' })
      return
    }

    let executed = 0
    let failed = 0
    let skipped = 0

    for (const account of accounts) {
      const result = await this.processAccount(signal, account, config)
      if (result === 'executed') executed += 1
      else if (result === 'failed') failed += 1
      else skipped += 1
    }

    const total = accounts.length
    let status: SignalStatus
    if (executed === total) status = 'EXECUTED'
    else if (executed === 0 && failed === 0) status = 'CANCELLED'
    else if (executed === 0 && failed > 0) status = 'FAILED'
    else status = 'PARTIAL'

    await this.tradingSignalRepository.updateStatus(signal.id, status, {
      executions: { total, executed, failed, skipped },
    })

    if (signal.strategyInstanceId) {
      if (status === 'FAILED') {
        const safety = await this.executorRepository.incrementStrategyExecutionFailure(signal.strategyInstanceId)
        if (safety.consecutiveExecutionFailures >= 3) {
          await this.strategyInstancesService.updateInstance(
            signal.strategyInstanceId,
            {
              status: 'stopped',
              metadata: {
                autoStopped: true,
                reason: 'CONSECUTIVE_EXECUTION_FAILURES',
                threshold: 3,
              },
            } as any,
            'system:auto-stop',
          )
          await this.executorRepository.markStrategyAutoStopped(
            signal.strategyInstanceId,
            'CONSECUTIVE_EXECUTION_FAILURES',
          )
          this.logger.warn(`Strategy instance ${signal.strategyInstanceId} auto-stopped after 3 execution failures`)
        }
      } else if (status === 'EXECUTED' || status === 'PARTIAL') {
        await this.executorRepository.resetStrategyExecutionFailure(signal.strategyInstanceId)
      }
    }

    this.telemetry.recordExecutionSummary({ signalId: signal.id, executed, failed, skipped })
  }

  private async processAccount(
    signal: Awaited<ReturnType<TradingSignalRepository['findById']>>,
    account: UserStrategyAccount,
    config: StrategySignalsRuntimeConfig,
  ): Promise<'executed' | 'failed' | 'skipped'> {
    try {
      if (!signal?.symbol) return 'skipped'
      const resolvedSignal = signal as NonNullable<typeof signal>

      let strategySubscription: Awaited<ReturnType<SignalExecutorRepository['findActiveSubscriptionNetwork']>> | null = null

      if (resolvedSignal.strategyInstanceId) {
        const [instanceModeRow, subscriptionNetwork] = await Promise.all([
          this.executorRepository.findStrategyInstanceMode(resolvedSignal.strategyInstanceId),
          this.executorRepository.findActiveSubscriptionNetwork(account.userId, resolvedSignal.strategyInstanceId),
        ])
        strategySubscription = subscriptionNetwork
        const mode = instanceModeRow?.mode
        const shouldEnforceNetworkMatch = mode === 'TESTNET' || mode === 'LIVE'
        const expectedIsTestnet = mode === 'TESTNET'
        const actualIsTestnet = subscriptionNetwork?.exchangeAccount?.isTestnet
        if (shouldEnforceNetworkMatch && typeof actualIsTestnet === 'boolean' && expectedIsTestnet !== actualIsTestnet) {
          this.logger.error(
            `Mode/account network mismatch for strategyInstance=${resolvedSignal.strategyInstanceId}, user=${account.userId}: mode=${instanceModeRow?.mode}, account.isTestnet=${actualIsTestnet}`,
          )
          return 'failed'
        }
      }

      const direction = resolvedSignal.direction
      const tradeSide = this.mapTradeSide(direction)
      const positionSide = this.mapPositionSide(direction)
      if (!tradeSide || !positionSide) return 'skipped'
      const runtimeProvenance = this.readSignalRuntimeProvenance(resolvedSignal)
      const expectedMarketType = this.readExpectedRuntimeMarketType(resolvedSignal)

      const preparation = await this.prepareExecution(resolvedSignal, account, config, tradeSide, positionSide)
      if (preparation.type === 'duplicate') {
        this.logger.debug(`Execution already exists for signal=${signal.id} account=${account.id}`)
        return 'skipped'
      }
      if (preparation.type === 'skip') {
        if (preparation.executionId) {
          await this.executionRepository.markSkipped(preparation.executionId, preparation.reason)
        }
        return 'skipped'
      }

      const { execution, orderParams, reservedQuote, reserveReference } = preparation

      if (config.execution.dryRun) {
        await this.executionRepository.markSkipped(execution.id, 'Execution currently running in dry-run mode')
        await this.releaseReservation(account.id, reservedQuote, reserveReference)
        return 'skipped'
      }

      // 对于 LLM 策略信号，获取用户订阅时绑定的交易所账户
      // 策略本身不限制交易所，用户订阅时选择的账户决定实际使用的交易所
      let exchangeAccountId: string | undefined
      let effectiveExchangeId = orderParams.exchangeId
      let effectiveOrderParams = orderParams

      if (resolvedSignal.strategyInstanceId) {
        if (!strategySubscription?.exchangeAccountId) {
          await this.executionRepository.markSkipped(
            execution.id,
            'SUBSCRIPTION_EXCHANGE_ACCOUNT_MISSING',
          )
          await this.releaseReservation(account.id, reservedQuote, reserveReference)
          return 'skipped'
        }
        exchangeAccountId = strategySubscription.exchangeAccountId
      }

      if (resolvedSignal.llmStrategyInstanceId) {
        const subscription = await this.executorRepository.findActiveLlmSubscription(
          account.userId,
          resolvedSignal.llmStrategyInstanceId,
        )
        if (subscription?.exchangeAccountId) {
          exchangeAccountId = subscription.exchangeAccountId
          // 使用用户订阅时选择的账户的 exchangeId，而不是信号中 symbol.exchange
          const accountExchangeId = this.normalizeExchangeId(subscription.exchangeAccount?.exchangeId)
          if (accountExchangeId && accountExchangeId !== orderParams.exchangeId) {
            // 检测到跨交易所跟单：需要重新获取目标交易所 symbol metadata 并重新计算 orderParams
            effectiveExchangeId = accountExchangeId

            this.logger.log(
              `Cross-exchange subscription detected: signal exchange=${orderParams.exchangeId}, ` +
              `user account exchange=${accountExchangeId}. Recalculating orderParams for target exchange.`,
            )

            // 重新获取目标交易所的 symbol metadata
            // 注意：market_symbols.exchange 存储的是大写（如 BINANCE/OKX），
            // exchangeAccount.exchangeId 可能是小写，需要统一转为大写进行查询
            const targetExchangeForQuery = (subscription.exchangeAccount?.exchangeId ?? '').toUpperCase()
            const targetSymbolMeta = await this.executorRepository.findSymbolForCrossExchange({
              exchange: targetExchangeForQuery,
              baseAsset: resolvedSignal.symbol.baseAsset,
              quoteAsset: resolvedSignal.symbol.quoteAsset,
              instrumentType: resolvedSignal.symbol.instrumentType,
            })

            if (!targetSymbolMeta) {
              this.logger.warn(
                `Target exchange ${accountExchangeId} does not support symbol ` +
                `${resolvedSignal.symbol.baseAsset}/${resolvedSignal.symbol.quoteAsset}. ` +
                `Skipping execution for account ${account.id}.`,
              )
              await this.executionRepository.markSkipped(
                execution.id,
                `Target exchange ${accountExchangeId} does not support the required symbol`,
              )
              await this.releaseReservation(account.id, reservedQuote, reserveReference)
              return 'skipped'
            }

            // 使用目标交易所的 symbol metadata 重新计算 orderParams
            const recalcResult = this.recalculateOrderParamsForTargetExchange(
              orderParams,
              resolvedSignal.symbol,
              targetSymbolMeta,
              accountExchangeId,
            )

            // 检查重新计算是否成功
            if ('reason' in recalcResult) {
              // 重新计算失败，跳过本次执行
              this.logger.warn(
                `Failed to recalculate orderParams for target exchange ${accountExchangeId}: ${recalcResult.reason}. ` +
                `Skipping execution for account ${account.id}.`,
              )
              await this.executionRepository.markSkipped(execution.id, recalcResult.reason)
              await this.releaseReservation(account.id, reservedQuote, reserveReference)
              return 'skipped'
            }

            // 成功：使用重新计算的参数
            effectiveOrderParams = recalcResult.params
          } else if (accountExchangeId) {
            effectiveExchangeId = accountExchangeId
          }
        }
      }

      const marketTypeValidation = this.validateOrderMarketTypeConsistency({
        expectedMarketType,
        symbolInstrumentType: resolvedSignal.symbol.instrumentType,
        orderMarketType: effectiveOrderParams.marketType,
      })

      if ('reason' in marketTypeValidation) {
        await this.executionRepository.markSkipped(execution.id, marketTypeValidation.reason)
        await this.releaseReservation(account.id, reservedQuote, reserveReference)
        return 'skipped'
      }

      let exchangeAccepted = false
      try {
        const orderIntent: OrderIntent = {
          source: 'signal',
          sourceId: execution.id,
          userId: account.userId,
          exchangeAccountId: exchangeAccountId ?? null,
          exchangeId: effectiveExchangeId,
          marketType: effectiveOrderParams.marketType,
          symbol: effectiveOrderParams.symbol,
          side: effectiveOrderParams.side,
          type: 'market',
          amount: effectiveOrderParams.amount,
          price: effectiveOrderParams.price,
          reduceOnly: effectiveOrderParams.reduceOnly ?? false,
          role: this.mapOrderIntentRole(
            effectiveOrderParams.marketType,
            effectiveOrderParams.side,
            effectiveOrderParams.reduceOnly ?? false,
          ),
          ...(effectiveOrderParams.marketType === 'perp' ? { tdMode: 'cross' as const } : {}),
        }

        const orderRequest = this.toJsonObject(orderIntent as unknown as Record<string, unknown>)

        const prepared = await this.tradingExecution.prepareIntent(orderIntent)

        if (prepared.status !== 'prepared') {
          await this.executionRepository.markStage(execution.id, 'ORDER_SUBMITTED', {
            exchangeAccountId: exchangeAccountId ?? null,
            orderRequest,
            tradingExecution: this.buildTradingExecutionResultSnapshot(prepared),
          })
          await this.executionRepository.markFailed(execution.id, prepared.reason)
          await this.releaseReservation(account.id, reservedQuote, reserveReference)
          return 'failed'
        }

        await this.executionRepository.markStage(execution.id, 'ORDER_SUBMITTED', {
          exchangeAccountId: exchangeAccountId ?? null,
          orderRequest,
          tradingExecution: this.buildTradingExecutionResultSnapshot(prepared),
        })

        const executionResult = await this.tradingExecution.submitPrepared(prepared)

        if (executionResult.status === 'reconcile_required') {
          exchangeAccepted = true
          await this.executionRepository.markStage(execution.id, 'RECONCILE_REQUIRED', {
            reconcileRequired: true,
            reason: executionResult.reason,
            ...(executionResult.order ? { orderResponse: this.buildOrderResponseSnapshot(executionResult.order) } : {}),
          })
          await this.executionRepository.markFailed(execution.id, executionResult.reason)
          return 'failed'
        }

        if (executionResult.status !== 'submitted') {
          await this.executionRepository.markStage(execution.id, 'ORDER_SUBMITTED', {
            exchangeAccountId: exchangeAccountId ?? null,
            orderRequest,
            tradingExecution: this.buildTradingExecutionResultSnapshot(executionResult),
          })
          await this.executionRepository.markFailed(execution.id, executionResult.reason)
          await this.releaseReservation(account.id, reservedQuote, reserveReference)
          return 'failed'
        }

        exchangeAccepted = true
        const initialOrder = executionResult.order

        let order: UnifiedOrder
        try {
          order = await this.resolveFinalOrderState(
            account.userId,
            effectiveExchangeId,
            effectiveOrderParams.marketType,
            effectiveOrderParams.symbol,
            initialOrder,
            exchangeAccountId,
          )
        }
        catch (error) {
          await this.executionRepository.markStage(execution.id, 'RECONCILE_REQUIRED', {
            reconcileRequired: true,
            reason: 'ORDER_RECONCILE_ERROR',
            error: (error as Error).message,
            orderResponse: this.buildOrderResponseSnapshot(initialOrder),
          })
          await this.executionRepository.markFailed(execution.id, 'ORDER_RECONCILE_ERROR')
          return 'failed'
        }

        await this.executionRepository.markStage(execution.id, 'ORDER_ACKED', {
          orderResponse: this.buildOrderResponseSnapshot(order),
        })

        const orderStatus = String(order.status).toLowerCase()
        const unfilledTerminalStatus = orderStatus === 'canceled' || orderStatus === 'rejected' || orderStatus === 'expired'
        // If we cannot reconcile a market order into a filled state, do not treat it as executed.
        // Keep the reservation in place and flag for reconciliation.
        if (order.type === 'market' && (orderStatus === 'open' || (order.filled ?? 0) <= 0 && unfilledTerminalStatus)) {
          const failureReason = orderStatus === 'open' ? 'ORDER_NOT_FINAL' : 'ORDER_NOT_FILLED'
          await this.executionRepository.markStage(execution.id, 'RECONCILE_REQUIRED', {
            reconcileRequired: true,
            reason: failureReason,
            orderResponse: this.buildOrderResponseSnapshot(order),
          })
          await this.executionRepository.markFailed(execution.id, failureReason)
          return 'failed'
        }
        const executedQuantity = order.filled ?? order.amount
        const { amount: executedFee, currency: executedFeeCurrency } = this.extractOrderFee(order)

        let executedQuote: Decimal | null = null
        if (order.price && executedQuantity) {
          executedQuote = new Decimal(order.price).mul(executedQuantity)
        }

        // 计算本次记录在账的真实扣款与“超预算”部分：
        // - 默认只允许本地台账扣减至 reservedQuote，超出部分交由后续资金对账流程处理
        // - 若 executedQuote 小于等于 reservedQuote，正常归还剩余预留
        const overBudget =
          executedQuote && executedQuote.gt(0) && executedQuote.gt(reservedQuote)
            ? executedQuote.sub(reservedQuote)
            : null

        const leftover =
          executedQuote && executedQuote.gt(0)
            ? Decimal.max(new Decimal(0), reservedQuote.sub(executedQuote))
            : reservedQuote

        if (leftover.gt(0)) {
          await this.releaseReservation(account.id, leftover, reserveReference)
        }

        if (overBudget && overBudget.gt(0)) {
          this.logger.warn(
            `Executed quote for account ${account.id} exceeded reserved budget by ${overBudget.toString()} ` +
              `for signal ${signal.id}. This requires external reconciliation with exchange balances.`,
          )
        }

        let ledgerFailed = false

        // 记录成交到本地仓位系统，确保本地仓位与交易所同步
        // 注意：必须使用 effectiveExchangeId 和 effectiveOrderParams（实际下单的交易所和参数）
        // 而不是 orderParams.exchangeId（信号中的交易所），否则会出现账面不一致问题
        if (order.price && executedQuantity && executedQuantity > 0) {
          try {
            const ledgerSymbol = normalizeLedgerSymbol(effectiveOrderParams.symbol)
            const feeCurrency =
              executedFeeCurrency
              ?? signal.symbol?.quoteAsset
              ?? 'USDT'

            await this.positionsService.recordTrade({
              userStrategyAccountId: account.id,
              symbol: ledgerSymbol,
              market: `${effectiveExchangeId}:${effectiveOrderParams.marketType}`,
              side: tradeSide,
              positionSide,
              price: order.price.toString(),
              quantity: executedQuantity.toString(),
              fee: executedFee > 0 ? executedFee.toString() : '0',
              feeCurrency,
              orderId: order.id,
              externalTradeId: order.id,
              provider: effectiveExchangeId,
              executedAt: new Date(order.createdAt).toISOString(),
              metadata: {
                signalId: signal.id,
                executionId: execution.id,
                ...(runtimeProvenance ? { runtimeProvenance } : {}),
              },
            })

            this.logger.log(
              `Successfully recorded trade to local position for account ${account.id}, ` +
              `symbol ${ledgerSymbol}, qty ${executedQuantity}`,
            )

            await this.executionRepository.markStage(execution.id, 'LEDGER_APPLIED', {
              ledgerApplied: true,
            })
          }
          catch (error) {
            ledgerFailed = true
            // 记录成交失败不应阻断订单执行流程，仅记录错误日志，等待后续对账任务修复
            this.logger.error(
              `Failed to record trade to local position for account ${account.id}: ${(error as Error).message}`,
              (error as Error).stack,
            )

            await this.executionRepository.markStage(execution.id, 'RECONCILE_REQUIRED', {
              ledgerApplied: false,
              reconcileRequired: true,
              ledgerError: (error as Error).message,
            })
            await this.executionRepository.markFailed(execution.id, (error as Error).message)
            return 'failed'
          }
        }

        if (ledgerFailed) {
          return 'failed'
        }

        await this.executionRepository.markExecuted(execution.id, {
          executedPrice: order.price,
          executedQuantity,
          fee: executedFee,
          feeCurrency: executedFeeCurrency ?? undefined,
          tradeId: order.id,
          executedAt: new Date(order.createdAt),
          metadata: {
            providerOrderId: order.id,
            providerStatus: order.status,
            executedQuote: executedQuote?.toString(),
            reservedQuote: reservedQuote.toString(),
            overBudget: overBudget?.toString() ?? null,
          },
        })

        return 'executed'
      }
      catch (error) {
        if (exchangeAccepted) {
          await this.markPostSubmitLocalFailure(execution.id, error)
          return 'failed'
        }
        await this.executionRepository.markFailed(execution.id, (error as Error).message)
        this.logger.error(`Signal execution failed for account ${account.id}: ${(error as Error).message}`)
        // 下单失败时释放全部预留
        await this.releaseReservation(account.id, reservedQuote, reserveReference)
        return 'failed'
      }
    }
    catch (error) {
      // 兜底捕获 prepareExecution/事务中的异常，避免打断整个信号执行循环
      this.logger.error(
        `Unexpected error while processing account ${account.id} for signal ${signal.id}: ${(error as Error).message}`,
      )
      return 'failed'
    }
  }

  private async prepareExecution(
    signal: LoadedSignal,
    account: UserStrategyAccount,
    config: StrategySignalsRuntimeConfig,
    orderSide: TradeSide,
    positionSide: PositionSide,
  ): Promise<
    | { type: 'duplicate' }
    | { type: 'skip'; reason: string; executionId?: string }
    | { type: 'ready'; execution: Prisma.UserSignalExecutionGetPayload<{ select: { id: true } }>; orderParams: OrderParams; reservedQuote: Decimal; reserveReference: string }
  > {
    return this.txHost.withTransaction(async () => {
      const runtimeProvenance = this.readSignalRuntimeProvenance(signal)
      const existing = await this.executionRepository.findBySignalAndAccount(signal!.id, account.id)

      if (existing) {
        return { type: 'duplicate' }
      }

      const lockedAccount = await this.lockAccount(account.id)
      if (!lockedAccount) {
        return { type: 'skip', reason: 'Account not found' }
      }

      const isCloseSignal =
        signal.direction === 'CLOSE_LONG' ||
        signal.direction === 'CLOSE_SHORT' ||
        signal.signalType === 'EXIT'

      if (!isCloseSignal) {
        const entryAdmission = await this.evaluateEntryAdmission(signal, account)
        if (entryAdmission.ok === false) {
          const execution = await this.executionRepository.create({
            signal: { connect: { id: signal!.id } },
            user: { connect: { id: account.userId } },
            account: { connect: { id: account.id } },
            orderSide,
            positionSide,
            status: 'SKIPPED',
            errorMessage: entryAdmission.reason,
          })
          return { type: 'skip', reason: entryAdmission.reason, executionId: execution.id }
        }
      }

      // 如果是平仓/退出信号，先查找当前持仓规模，用于构建正确的平仓数量
      let closePositionQuantity: Decimal | undefined
      if (isCloseSignal) {
        const positionSideForClose = this.mapPositionSide(signal.direction)
        const closeIdentity = this.resolveClosePositionIdentity(signal, positionSideForClose)

        if (!closeIdentity) {
          const reason = 'Cannot close position: missing symbol or position side'
          const execution = await this.executionRepository.create({
            signal: { connect: { id: signal!.id } },
            user: { connect: { id: account.userId } },
            account: { connect: { id: account.id } },
            orderSide,
            positionSide,
            status: 'SKIPPED',
            errorMessage: reason,
          })
          return { type: 'skip', reason, executionId: execution.id }
        }

        const openPosition = await this.executorRepository.findOpenPositionForClose({
          accountId: account.id,
          exchangeId: closeIdentity.exchangeId,
          marketType: closeIdentity.marketType,
          symbol: closeIdentity.symbol,
          positionSide: closeIdentity.positionSide,
        })

        if (!openPosition || new Decimal(openPosition.quantity).lte(0)) {
          const reason = 'No open position to close for this signal'
          const execution = await this.executionRepository.create({
            signal: { connect: { id: signal!.id } },
            user: { connect: { id: account.userId } },
            account: { connect: { id: account.id } },
            orderSide,
            positionSide,
            status: 'SKIPPED',
            errorMessage: reason,
          })
          return { type: 'skip', reason, executionId: execution.id }
        }

        closePositionQuantity = new Decimal(openPosition.quantity).abs()
      }

      const riskProfile = signal.strategyInstanceId
        ? await this.executorRepository.findRiskProfileByStrategyInstanceId(signal.strategyInstanceId)
        : null

      const orderParamsResult = this.buildOrderParamsWithLockedAccount(
        signal,
        lockedAccount,
        config,
        closePositionQuantity,
        riskProfile,
        this.readExpectedRuntimeMarketType(signal),
      )
      if (!orderParamsResult.ok) {
        const reason = (orderParamsResult as { ok: false; reason: string }).reason
        const execution = await this.executionRepository.create({
          signal: { connect: { id: signal!.id } },
          user: { connect: { id: account.userId } },
          account: { connect: { id: account.id } },
          orderSide,
          positionSide,
          status: 'SKIPPED',
          errorMessage: reason,
        })
        return { type: 'skip', reason, executionId: execution.id }
      }

      const reserveReference = `signal:${signal.id}:acct:${account.id}:reserve`

      // 对开仓与平仓信号采用不同的资金路径：
      // - 开仓：预留 quoteBudget 并在执行成功后根据实际成交释放剩余
      // - 平仓/EXIT：不预留资金，成交后的现金入账由交易所余额同步/对账流程负责，避免把卖出视为再次支出
      let reservedQuoteForExecution = orderParamsResult.quoteBudget

      if (!isCloseSignal) {
        await this.accountsService.applyLedgerDelta({
          accountId: account.id,
          delta: orderParamsResult.quoteBudget.neg(),
          ledgerType: LedgerEntryType.ADJUSTMENT,
          referenceId: reserveReference,
          description: `Reserve for signal ${signal.id}`,
          requireSufficientBalance: true,
        })
      }
      else {
        reservedQuoteForExecution = new Decimal(0)
      }

      const execution = await this.executionRepository.create({
        signal: { connect: { id: signal.id } },
        user: { connect: { id: account.userId } },
        account: { connect: { id: account.id } },
        orderSide,
        positionSide,
        reservedQuote: reservedQuoteForExecution.gt(0) ? reservedQuoteForExecution : undefined,
        metadata: {
          ...this.buildExecutionStageMetadata([
            EXECUTION_STAGES[0],
            EXECUTION_STAGES[1],
          ]),
          ...(runtimeProvenance ? { runtimeProvenance } : {}),
        },
      })

      return {
        type: 'ready',
        execution,
        orderParams: orderParamsResult.params,
        reservedQuote: reservedQuoteForExecution,
        reserveReference,
      }
    })
  }

  private async evaluateEntryAdmission(
    signal: LoadedSignal,
    account: UserStrategyAccount,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const identity = this.resolvePositionAdmissionIdentity(signal)
    if (!identity) {
      return { ok: true }
    }

    const [openPositions, hasPendingReconciliation] = await Promise.all([
      this.executorRepository.findOpenPositionsForAdmission({
        accountId: account.id,
        exchangeId: identity.exchangeId,
        marketType: identity.marketType,
        symbol: identity.symbol,
      }),
      this.executorRepository.hasPendingReconcileRequiredEntryExecution(account.id),
    ])

    return this.positionAdmissionService.evaluateEntry({
      direction: signal.direction,
      constraints: this.readPortfolioAdmissionConstraints(signal),
      openPositions,
      hasPendingReconciliation,
    })
  }

  private async lockAccount(
    accountId: string,
  ): Promise<LockedStrategyAccount | null> {
    const rows = await this.executorRepository.lockAccount(accountId)
    return rows[0] ?? null
  }

  private buildOrderParamsWithLockedAccount(
    signal: LoadedSignal,
    account: LockedStrategyAccount,
    config: StrategySignalsRuntimeConfig,
    closePositionQuantity?: Decimal,
    riskProfile?: StrategyInstanceRiskProfile | null,
    runtimeMarketType?: MarketType | null,
  ): { ok: true; params: OrderParams; quoteBudget: Decimal } | { ok: false; reason: string } {
    const symbolMeta = signal?.symbol
    if (!symbolMeta) return { ok: false, reason: 'Signal missing symbol metadata' }

    const exchangeId = this.normalizeExchangeId(symbolMeta.exchange)
    const symbolMarketType = this.normalizeMarketType(symbolMeta.instrumentType)
    const marketType = runtimeMarketType ?? symbolMarketType
    if (!exchangeId || !marketType) {
      return { ok: false, reason: 'Unsupported exchange or instrument type' }
    }

    // 目前仅支持账户基准币种与标的报价币种严格一致的场景，避免资金记账与实际下单币种不匹配
    const accountCurrency = account.baseCurrency?.toUpperCase()
    const quoteCurrency = symbolMeta.quoteAsset?.toUpperCase()
    if (!accountCurrency || !quoteCurrency || accountCurrency !== quoteCurrency) {
      return {
        ok: false,
        reason: `Account base currency ${accountCurrency ?? 'N/A'} does not match symbol quote asset ${quoteCurrency ?? 'N/A'}`,
      }
    }

    const unifiedSymbol = this.buildUnifiedSymbol(symbolMeta, marketType)
    const side = this.mapOrderSide(signal.direction)
    if (!side) return { ok: false, reason: 'Unsupported signal direction' }
    const reduceOnly = signal.direction === 'CLOSE_LONG' || signal.direction === 'CLOSE_SHORT'

    // 根据是开仓还是平仓决定预算与原始数量来源
    const isCloseSignal =
      signal.direction === 'CLOSE_LONG' ||
      signal.direction === 'CLOSE_SHORT' ||
      signal.signalType === 'EXIT'

    const entryPrice = signal.entryPrice ? Number(signal.entryPrice) : undefined
    if (!entryPrice || entryPrice <= 0) {
      return { ok: false, reason: 'Entry price missing' }
    }

    const funding = resolveStrategyFundingFromStrategyAccount({
      account,
      mode: null,
      reservedQuote: 0,
    })
    const buyingPower = new Decimal(funding.buyingPower)
    const executionCapital = new Decimal(funding.executionCapital)
    // 开仓场景才检查最低余额与风险预算；平仓/EXIT 不应因为 quote 余额不足而无法卖出
    if (!isCloseSignal) {
      const minBalance = new Decimal(config.execution.minBalanceThreshold)
      if (buyingPower.lt(minBalance)) {
        return { ok: false, reason: 'Buying power below minimum threshold' }
      }
    }

    let quoteBudget: Decimal
    let rawAmount: Decimal

    if (isCloseSignal && closePositionQuantity) {
      if (closePositionQuantity.lte(0)) {
        return { ok: false, reason: 'Position quantity not positive for close signal' }
      }
      rawAmount = closePositionQuantity
      // 平仓不预留预算，由实际成交与交易所余额同步/对账模块负责资金入账，这里的预算仅用于内部统计
      quoteBudget = new Decimal(0)
    }
    else {
      const effectiveMaxRiskFraction = riskProfile
        ? Number(riskProfile.effectiveMaxRiskFraction)
        : config.execution.maxRiskFraction
      const effectivePerOrderMaxQuote = riskProfile
        ? new Decimal(riskProfile.effectivePerOrderMaxQuote)
        : new Decimal(config.execution.defaultQuoteAmount)

      // 计算风险上限（基于执行资金和风险比例）
      const maxRiskQuote = executionCapital.mul(effectiveMaxRiskFraction)
      const defaultQuote = effectivePerOrderMaxQuote

      // 优先使用策略指定的仓位大小，受 maxRiskFraction 与 buying power 共同约束
      // defaultQuoteAmount 仅在策略未指定仓位时作为 fallback
      if (signal.positionSizeQuote && new Decimal(signal.positionSizeQuote).gt(0)) {
        // 策略指定了绝对金额
        const strategyQuote = new Decimal(signal.positionSizeQuote)
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote, buyingPower)
        this.logger.debug(
          `Strategy-specified position size (quote): ${strategyQuote.toString()}, ` +
          `max risk limit (${effectiveMaxRiskFraction}): ${maxRiskQuote.toString()}, ` +
          `buying power: ${buyingPower.toString()}, final budget: ${quoteBudget.toString()}`,
        )
      }
      else if (signal.positionSizeRatio && new Decimal(signal.positionSizeRatio).gt(0)) {
        // 策略指定了仓位比例
        const ratio = new Decimal(signal.positionSizeRatio)
        const strategyQuote = executionCapital.mul(ratio)
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote, buyingPower)
        this.logger.debug(
          `Strategy-specified position size (ratio): ${ratio.toString()} of execution capital ${executionCapital.toString()} = ${strategyQuote.toString()}, ` +
          `max risk limit (${effectiveMaxRiskFraction}): ${maxRiskQuote.toString()}, ` +
          `buying power: ${buyingPower.toString()}, final budget: ${quoteBudget.toString()}`,
        )
      }
      else {
        // 回退到全局配置：此时才使用 defaultQuoteAmount
        quoteBudget = Decimal.min(maxRiskQuote, defaultQuote, buyingPower)
        this.logger.debug(
          `No strategy position size, using global config: ` +
          `min(maxRisk=${maxRiskQuote.toString()}, default=${defaultQuote.toString()}, buyingPower=${buyingPower.toString()}) = ${quoteBudget.toString()}`,
        )
      }

      if (quoteBudget.lte(0)) {
        return { ok: false, reason: 'Quote budget zero after risk control' }
      }

      rawAmount = quoteBudget.div(entryPrice)
      if (rawAmount.lte(0)) {
        return { ok: false, reason: 'Computed order amount invalid' }
      }
    }

    // 基于符号配置量化价格与数量，避免硬编码小数位
    const precisionQuantity = symbolMeta.precisionQuantity ?? 6
    const precisionPrice = symbolMeta.precisionPrice ?? 2
    const lotSize = symbolMeta.lotSize ? new Decimal(symbolMeta.lotSize) : null
    const tickSize = symbolMeta.tickSize ? new Decimal(symbolMeta.tickSize) : null

    // 先按精度截断到可表示的小数位
    const amountScale = new Decimal(10).pow(precisionQuantity)
    let quantity = rawAmount.mul(amountScale).floor().div(amountScale)

    // 再按最小手数（lotSize）向下取整到最近的整数倍
    if (lotSize && this.shouldApplyBaseAssetLotSize({ exchangeId, marketType, reduceOnly })) {
      const lots = quantity.div(lotSize).floor()
      quantity = lots.mul(lotSize)
    }

    if (quantity.lte(0)) {
      return { ok: false, reason: 'Computed order amount below lotSize or precision' }
    }

    // 价格按 tickSize 或 precisionPrice 量化
    let priceDecimal = new Decimal(entryPrice)
    if (tickSize) {
      const ticks = priceDecimal.div(tickSize).floor()
      priceDecimal = ticks.mul(tickSize)
    }
    else {
      const priceScale = new Decimal(10).pow(precisionPrice)
      priceDecimal = priceDecimal.mul(priceScale).floor().div(priceScale)
    }

    const finalAmount = Number(quantity.toString())
    const finalPrice = Number(priceDecimal.toString())
    const minimumNotional = this.getMinimumOrderNotional(exchangeId, marketType, quoteCurrency)

    if (!isCloseSignal && minimumNotional) {
      const estimatedNotional = quantity.mul(priceDecimal)
      if (estimatedNotional.lt(minimumNotional)) {
        return {
          ok: false,
          reason:
            `Estimated order notional ${estimatedNotional.toString()} ${quoteCurrency} ` +
            `below minimum ${minimumNotional.toString()} ${quoteCurrency} after precision rounding`,
        }
      }
    }

    return {
      ok: true,
      params: {
        exchangeId,
        marketType,
        symbol: unifiedSymbol,
        side,
        amount: finalAmount,
        price: finalPrice,
        reduceOnly,
      },
      quoteBudget,
    }
  }

  private getMinimumOrderNotional(
    exchangeId: ExchangeId,
    marketType: MarketType,
    quoteCurrency: string,
  ): Decimal | null {
    if (exchangeId === 'hyperliquid' && marketType === 'spot' && quoteCurrency === 'USDC') {
      return new Decimal(10)
    }
    return null
  }

  private async releaseReservation(accountId: string, amount: Decimal, reference: string) {
    if (amount.lte(0)) return
    try {
      await this.accountsService.applyLedgerDelta({
        accountId,
        delta: amount,
        ledgerType: LedgerEntryType.ADJUSTMENT,
        referenceId: `${reference}:release:${Date.now()}`,
        description: 'Release signal reserve',
      })
    }
    catch (error) {
      this.logger.error(`Failed to release reservation for account ${accountId}: ${(error as Error).message}`)
    }
  }

  private async resolveFinalOrderState(
    userId: string,
    exchangeId: ExchangeId,
    marketType: MarketType,
    symbol: string,
    order: UnifiedOrder,
    exchangeAccountId?: string,
  ): Promise<UnifiedOrder> {
    if (order.type !== 'market') return order
    if (order.status !== 'open') return order

    let currentOrder = order
    for (let attempt = 0; attempt < ORDER_RECONCILE_RETRY_COUNT; attempt += 1) {
      await sleep(ORDER_RECONCILE_RETRY_MS)
      currentOrder = await this.tradingService.getOrder(
        userId,
        exchangeId,
        marketType,
        currentOrder.id,
        symbol,
        exchangeAccountId,
      )
      if (currentOrder.status !== 'open') {
        return currentOrder
      }
    }

    return currentOrder
  }

  private async markPostSubmitLocalFailure(executionId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await this.executionRepository.markStage(executionId, 'RECONCILE_REQUIRED', {
        reconcileRequired: true,
        reason: 'POST_SUBMIT_LOCAL_ERROR',
        error: message,
      })
    }
    catch (stageError) {
      this.logger.error(
        `Failed to mark post-submit reconciliation for execution ${executionId}: ${(stageError as Error).message}`,
      )
    }
    await this.executionRepository.markFailed(executionId, message)
  }

  private mapTradeSide(direction: SignalDirection): TradeSide | null {
    switch (direction) {
      case 'BUY':
      case 'CLOSE_SHORT':
        return 'BUY'
      case 'SELL':
      case 'CLOSE_LONG':
        return 'SELL'
      default:
        return null
    }
  }

  private mapOrderSide(direction: SignalDirection): 'buy' | 'sell' | null {
    switch (direction) {
      case 'BUY':
      case 'CLOSE_SHORT':
        return 'buy'
      case 'SELL':
      case 'CLOSE_LONG':
        return 'sell'
      default:
        return null
    }
  }

  private mapPositionSide(direction: SignalDirection): PositionSide | null {
    switch (direction) {
      case 'BUY':
        return 'LONG'
      case 'SELL':
        return 'SHORT'
      case 'CLOSE_LONG':
        return 'LONG'
      case 'CLOSE_SHORT':
        return 'SHORT'
      default:
        return null
    }
  }

  private mapOrderIntentRole(
    marketType: MarketType,
    side: 'buy' | 'sell',
    reduceOnly: boolean,
  ): OrderIntentRole {
    if (marketType === 'spot') {
      return side === 'buy' ? 'spot_buy' : 'spot_sell'
    }
    if (reduceOnly) {
      return side === 'sell' ? 'close_long' : 'close_short'
    }
    return side === 'buy' ? 'open_long' : 'open_short'
  }

  private resolveClosePositionIdentity(
    signal: LoadedSignal,
    positionSide: PositionSide | null,
  ): {
    exchangeId: ExchangeId
    marketType: MarketType
    symbol: string
    positionSide: PositionSide
  } | null {
    const symbolMeta = signal.symbol
    const symbolCode = symbolMeta?.code
    const exchangeId = this.normalizeExchangeId(symbolMeta?.exchange)
    const marketType = this.readExpectedRuntimeMarketType(signal)
      ?? (symbolMeta ? this.normalizeMarketType(symbolMeta.instrumentType) : null)

    if (!symbolCode || !exchangeId || !marketType || !positionSide) {
      return null
    }

    return {
      exchangeId,
      marketType,
      symbol: normalizeLedgerSymbol(symbolCode),
      positionSide,
    }
  }

  private resolvePositionAdmissionIdentity(
    signal: LoadedSignal,
  ): {
    exchangeId: ExchangeId
    marketType: MarketType
    symbol: string
  } | null {
    const symbolMeta = signal.symbol
    const symbolCode = symbolMeta?.code
    const exchangeId = this.normalizeExchangeId(symbolMeta?.exchange)
    const marketType = this.readExpectedRuntimeMarketType(signal)
      ?? (symbolMeta ? this.normalizeMarketType(symbolMeta.instrumentType) : null)

    if (!symbolCode || !exchangeId || !marketType) {
      return null
    }

    return {
      exchangeId,
      marketType,
      symbol: normalizeLedgerSymbol(symbolCode),
    }
  }

  private readPortfolioAdmissionConstraints(signal: LoadedSignal): PortfolioAdmissionConstraints | null {
    const runtimeProvenance = this.readSignalRuntimeProvenance(signal)
    const raw = runtimeProvenance?.portfolio ?? runtimeProvenance?.portfolioConstraints
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
      return null
    }

    const value = raw as Prisma.JsonObject
    return {
      positionMode: this.readPortfolioPositionMode(value.positionMode),
      maxConcurrentPositions: this.readPositiveInteger(value.maxConcurrentPositions),
      allowPyramiding: typeof value.allowPyramiding === 'boolean' ? value.allowPyramiding : null,
    }
  }

  private readPortfolioPositionMode(value: Prisma.JsonValue | undefined) {
    if (value === 'long_only' || value === 'short_only' || value === 'long_short') {
      return value
    }
    return null
  }

  private readPositiveInteger(value: Prisma.JsonValue | undefined): number | null {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
      return null
    }
    return value
  }

  private normalizeExchangeId(exchange?: string) {
    if (!exchange) return null
    const normalized = exchange.trim().toLowerCase()
    if (normalized.includes('binance')) return 'binance' as const
    if (normalized.includes('okx')) return 'okx' as const
    if (normalized.includes('hyperliquid')) return 'hyperliquid' as const
    return null
  }

  private normalizeMarketType(instrumentType: PrismaSymbol['instrumentType']): MarketType | null {
    if (instrumentType === 'SPOT') return 'spot'
    if (instrumentType === 'PERPETUAL' || instrumentType === 'FUTURE') return 'perp'
    return null
  }

  private validateOrderMarketTypeConsistency(input: {
    expectedMarketType: MarketType | null
    symbolInstrumentType: PrismaSymbol['instrumentType']
    orderMarketType: MarketType
  }): { ok: true } | { ok: false; reason: 'MARKET_TYPE_MISMATCH' } {
    if (input.expectedMarketType) {
      return input.expectedMarketType === input.orderMarketType
        ? { ok: true }
        : { ok: false, reason: 'MARKET_TYPE_MISMATCH' }
    }

    const symbolMarketType = this.normalizeMarketType(input.symbolInstrumentType)
    if (!symbolMarketType) return { ok: false, reason: 'MARKET_TYPE_MISMATCH' }
    if (symbolMarketType !== input.orderMarketType) return { ok: false, reason: 'MARKET_TYPE_MISMATCH' }
    return { ok: true }
  }

  private buildUnifiedSymbol(symbol: PrismaSymbol, marketType?: MarketType | null): string {
    const base = symbol.baseAsset?.toUpperCase() ?? ''
    const quote = symbol.quoteAsset?.toUpperCase() ?? ''
    const pair = `${base}/${quote}`
    const resolvedMarketType = marketType ?? this.normalizeMarketType(symbol.instrumentType)
    if (resolvedMarketType === 'perp') {
      return `${pair}:PERP`
    }
    return pair
  }

  /**
   * 当用户选择的交易所与信号原始交易所不同时，重新计算 orderParams
   * 使用目标交易所的精度信息（lotSize、tickSize）重新量化 amount 和 price
   *
   * @param originalParams 原始 orderParams（基于信号原始交易所计算）
   * @param originalSymbolMeta 信号原始交易所的 symbol metadata
   * @param targetSymbolMeta 目标交易所的 symbol metadata
   * @param targetExchangeId 目标交易所 ID
   * @returns 重新计算后的 orderParams 或错误信息
   */
  private recalculateOrderParamsForTargetExchange(
    originalParams: OrderParams,
    originalSymbolMeta: PrismaSymbol,
    targetSymbolMeta: PrismaSymbol,
    targetExchangeId: ExchangeId,
  ): { ok: true; params: OrderParams } | { ok: false; reason: string } {
    // 验证基础资产和报价资产是否匹配
    if (
      originalSymbolMeta.baseAsset !== targetSymbolMeta.baseAsset ||
      originalSymbolMeta.quoteAsset !== targetSymbolMeta.quoteAsset
    ) {
      return {
        ok: false,
        reason: `Symbol mismatch: ${originalSymbolMeta.baseAsset}/${originalSymbolMeta.quoteAsset} vs ${targetSymbolMeta.baseAsset}/${targetSymbolMeta.quoteAsset}`,
      }
    }

    // 使用目标交易所的 symbol 构建统一的 symbol 字符串
    const targetSymbol = this.buildUnifiedSymbol(targetSymbolMeta)
    const targetMarketType = this.normalizeMarketType(targetSymbolMeta.instrumentType)

    if (!targetMarketType) {
      return { ok: false, reason: 'Unsupported target instrument type' }
    }

    // 获取目标交易所的精度信息
    const targetLotSize = targetSymbolMeta.lotSize ? new Decimal(targetSymbolMeta.lotSize) : null
    const targetTickSize = targetSymbolMeta.tickSize ? new Decimal(targetSymbolMeta.tickSize) : null
    const targetPrecisionQuantity = targetSymbolMeta.precisionQuantity
    const targetPrecisionPrice = targetSymbolMeta.precisionPrice

    // 重新量化 amount（数量）
    const rawAmount = new Decimal(originalParams.amount)

    // 按精度截断到可表示的小数位
    const amountScale = new Decimal(10).pow(targetPrecisionQuantity)
    let quantity = rawAmount.mul(amountScale).floor().div(amountScale)

    // 按最小手数（lotSize）向下取整到最近的整数倍
    if (
      targetLotSize &&
      this.shouldApplyBaseAssetLotSize({
        exchangeId: targetExchangeId,
        marketType: targetMarketType,
        reduceOnly: originalParams.reduceOnly ?? false,
      })
    ) {
      const lots = quantity.div(targetLotSize).floor()
      quantity = lots.mul(targetLotSize)
    }

    if (quantity.lte(0)) {
      return {
        ok: false,
        reason: `Computed order amount ${quantity.toString()} below target exchange lotSize ${targetLotSize?.toString() ?? 'N/A'}`,
      }
    }

    // 重新量化 price（价格）
    let priceDecimal = new Decimal(originalParams.price)
    if (targetTickSize) {
      const ticks = priceDecimal.div(targetTickSize).floor()
      priceDecimal = ticks.mul(targetTickSize)
    } else {
      const priceScale = new Decimal(10).pow(targetPrecisionPrice)
      priceDecimal = priceDecimal.mul(priceScale).floor().div(priceScale)
    }

    const finalAmount = Number(quantity.toString())
    const finalPrice = Number(priceDecimal.toString())

    this.logger.log(
      `Recalculated orderParams for target exchange ${targetExchangeId}: ` +
      `symbol=${targetSymbol}, amount=${finalAmount} (original=${originalParams.amount}), ` +
      `price=${finalPrice} (original=${originalParams.price})`,
    )

    return {
      ok: true,
      params: {
        exchangeId: targetExchangeId,
        marketType: targetMarketType,
        symbol: targetSymbol,
        side: originalParams.side,
        amount: finalAmount,
        price: finalPrice,
        reduceOnly: originalParams.reduceOnly,
      },
    }
  }

  private shouldApplyBaseAssetLotSize(input: {
    exchangeId: ExchangeId
    marketType: MarketType
    reduceOnly: boolean
  }): boolean {
    // OKX perp order size is converted from base asset to contract count in the exchange client.
    if (input.exchangeId === 'okx' && input.marketType === 'perp' && input.reduceOnly) {
      return false
    }
    return true
  }

  private extractOrderFee(order: UnifiedOrder): { amount: number; currency: string | null } {
    const raw = order.raw as any

    if (raw?.fee !== undefined && raw?.fee !== null) {
      const rawFee = typeof raw.fee === 'string' && raw.fee.trim() === ''
        ? Number.NaN
        : Number(raw.fee)
      const fee = Math.abs(rawFee)
      const currency = typeof raw?.feeCcy === 'string'
        ? raw.feeCcy
        : typeof raw?.feeCurrency === 'string'
          ? raw.feeCurrency
          : null
      if (Number.isFinite(fee)) {
        return { amount: fee, currency }
      }
    }

    if (typeof raw?.fee === 'number' && Number.isFinite(raw.fee)) {
      const currency = typeof raw?.feeCurrency === 'string' ? raw.feeCurrency : null
      return { amount: Math.abs(raw.fee), currency }
    }

    if (Array.isArray(raw?.fills) && raw.fills.length > 0) {
      const amount = raw.fills.reduce((sum: number, fill: any) => {
        const fee = Number(fill?.commission ?? 0)
        return Number.isFinite(fee) ? sum + fee : sum
      }, 0)
      const currency =
        typeof raw.fills[0]?.commissionAsset === 'string'
          ? raw.fills[0].commissionAsset
          : null
      return { amount, currency }
    }

    return { amount: 0, currency: null }
  }

  private buildOrderResponseSnapshot(order: UnifiedOrder): Prisma.JsonObject {
    return {
      id: order.id,
      status: order.status,
      amount: order.amount,
      filled: order.filled ?? null,
      price: order.price ?? null,
      createdAt: order.createdAt,
      raw: typeof order.raw === 'object' && order.raw !== null ? order.raw as Prisma.JsonObject : null,
    }
  }

  private buildTradingExecutionResultSnapshot(
    result: TradingExecutionPrepareResult | TradingExecutionSubmitPreparedResult | TradingExecutionResult,
  ): Prisma.JsonObject {
    const normalized = 'normalized' in result ? result.normalized : null
    const order = 'order' in result ? result.order : null

    return {
      status: result.status,
      reason: 'reason' in result ? result.reason : null,
      clientOrderId: normalized?.clientOrderId ?? null,
      normalizedAmount: normalized?.normalizedAmount ?? null,
      normalizedPrice: normalized?.normalizedPrice ?? null,
      exchangeSize: normalized?.exchangeSize ?? null,
      normalizedRequest: normalized ? this.toJsonObject(normalized.request as unknown as Record<string, unknown>) : null,
      orderResponse: order ? this.buildOrderResponseSnapshot(order) : null,
    }
  }

  private toJsonObject(value: Record<string, unknown>): Prisma.JsonObject {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as Prisma.JsonObject
  }

  private buildExecutionStageMetadata(stages: ExecutionStage[]): Prisma.JsonObject {
    const now = new Date().toISOString()
    return {
      stage: stages.at(-1) ?? null,
      stageHistory: stages.map(stage => ({
        stage,
        at: now,
      })),
    }
  }

  private readSignalRuntimeProvenance(signal: { metadata?: Prisma.JsonValue | null }): Prisma.JsonObject | null {
    const metadata = signal.metadata
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      return null
    }

    const runtimeProvenance = (metadata as Prisma.JsonObject).runtimeProvenance
    if (!runtimeProvenance || Array.isArray(runtimeProvenance) || typeof runtimeProvenance !== 'object') {
      return null
    }

    return runtimeProvenance as Prisma.JsonObject
  }

  private readExpectedRuntimeMarketType(signal: LoadedSignal): MarketType | null {
    const runtimeProvenance = this.readSignalRuntimeProvenance(signal)
    const raw = runtimeProvenance?.marketType
    if (raw === 'spot' || raw === 'perp') return raw
    return null
  }
}
