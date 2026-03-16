import type { OnModuleInit } from '@nestjs/common'
import type { TradingSignalCreatedEvent } from '../events/strategy-signal.events'
import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { ExchangeId, MarketType, UnifiedOrder } from '@/modules/trading/core/types'
import type { PositionSide, Symbol as PrismaSymbol, SignalDirection, SignalStatus, TradeSide, UserStrategyAccount } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 ConfigService
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { AccountsService } from '@/modules/accounts/accounts.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PositionsService } from '@/modules/positions/positions.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { TradingService } from '@/modules/trading/trading.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PrismaService } from '@/prisma/prisma.service'
import { LedgerEntryType, Prisma } from '@/prisma/prisma.types'
import { StrategySignalEvents } from '../constants/strategy-signal.constants'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { SignalExecutionRepository } from '../repositories/signal-execution.repository'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { TradingSignalRepository } from '../repositories/trading-signal.repository'
import { DEFAULT_STRATEGY_SIGNALS_CONFIG } from '../types/strategy-signals-config.type'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { SignalTelemetryService } from './signal-telemetry.service'

// Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?
/* eslint-disable no-redeclare, ts/no-redeclare */
type Decimal = Prisma.Decimal
const Decimal = Prisma.Decimal
/* eslint-enable no-redeclare, ts/no-redeclare */

type LoadedSignal = NonNullable<Awaited<ReturnType<TradingSignalRepository['findById']>>>

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

@Injectable()
export class SignalExecutorService implements OnModuleInit {
  private readonly logger = new Logger(SignalExecutorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly tradingService: TradingService,
    private readonly accountsService: AccountsService,
    private readonly positionsService: PositionsService,
    private readonly tradingSignalRepository: TradingSignalRepository,
    private readonly executionRepository: SignalExecutionRepository,
    private readonly telemetry: SignalTelemetryService,
  ) {}

  async onModuleInit() {
    const config = this.getConfig()
    if (!config.execution.enabled) return

    try {
      await this.recoverPendingSignals(config)
    }
    catch (error) {
      this.logger.error(
        `Failed to recover pending/failed signals on startup: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  @OnEvent(StrategySignalEvents.CREATED, { async: true })
  async handleSignalCreated(event: TradingSignalCreatedEvent) {
    const config = this.getConfig()
    if (!config.execution.enabled) {
      this.logger.debug(`Signal execution disabled; skipping signal ${event.signalId}`)
      return
    }

    await this.executeSignalForSubscribedUsers(event.signalId, config)
  }

  private getConfig(): StrategySignalsRuntimeConfig {
    return this.configService.get<StrategySignalsRuntimeConfig>('strategySignals') ?? DEFAULT_STRATEGY_SIGNALS_CONFIG
  }

  /**
   * 鍚姩鏃跺浠嶅浜?PENDING/FAILED 涓旀湭杩囨湡鐨勪俊鍙峰仛涓€娆¤ˉ鍋挎墽琛岋紝
   * 閬垮厤渚濊禆杩涚▼鍐呬簨浠跺鑷存湇鍔￠噸鍚椂淇″彿褰诲簳涓㈠け銆?
   */
  private async recoverPendingSignals(config: StrategySignalsRuntimeConfig) {
    const now = new Date()
    const signals = await this.prisma.tradingSignal.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] satisfies SignalStatus[] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: RECOVERY_BATCH_SIZE,
    })

    if (!signals.length) return

    this.logger.log(`Recovering ${signals.length} pending/failed signals on startup`)

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

    // LLM 淇″彿鍙兘涓嶄細鍏宠仈鏃х増 strategy锛坰trategyId 涓虹┖锛夛紝浣嗕粛搴旇繘鍏ユ墽琛岄摼璺?
    // 鍥犳杩欓噷浠呰姹?signal 涓?symbol 瀛樺湪
    if (!signal || !signal.symbol) {
      this.logger.warn(`Signal ${signalId} not found or missing relations, aborting execution`)
      return
    }

    // 鍏煎锛氭棫绛栫暐浣跨敤 strategyId锛孡LM 绛栫暐浣跨敤 llmStrategyId
    const effectiveStrategyId = signal.strategyId ?? signal.llmStrategyId
    if (!effectiveStrategyId) {
      this.logger.warn(`Signal ${signal.id} missing strategyId/llmStrategyId, aborting execution`)
      return
    }

    const where: Prisma.UserStrategyAccountWhereInput = {
      // 娉ㄦ剰锛氳繖閲屾部鐢?userStrategyAccount.strategyId 浣滀负鈥滅瓥鐣ョ淮搴︹€濈殑璐︽埛鏄犲皠閿紱
      // 鏃х瓥鐣ュ～ strategyId锛孡LM 绛栫暐濉?llmStrategyId锛堟墽琛屽櫒鎸?effectiveStrategyId 缁熶竴澶勭悊锛?
      strategyId: effectiveStrategyId,
      // 浠呴€夋嫨灏氭湭涓哄綋鍓?signal 鍒涘缓鎵ц璁板綍鐨勮处鎴凤紝閬垮厤閲嶅鎵ц
      signalExecutions: {
        none: {
          signalId: signal.id,
        },
      },
    }

    // 濡傛灉淇″彿缁戝畾鍒颁簡鍏蜂綋鐨勭瓥鐣ュ疄渚嬶紝鍒欏彧瀵硅闃呬簡璇ュ疄渚嬬殑鐢ㄦ埛鎵ц
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
      // LLM 瀹炰緥绾ц闃呰繃婊わ細浠呭璁㈤槄浜嗚 LLM 瀹炰緥鐨勭敤鎴锋墽琛?
      // 鎵ц鍣ㄩ€氳繃 signal.llmStrategyId 鏌ユ壘 UserStrategyAccount.strategyId 鏉ュ尮閰嶈处鎴?
      // 璁㈤槄鏈嶅姟鍦ㄥ垱寤?婵€娲昏闃呮椂浼氳嚜鍔ㄥ垱寤哄搴旂殑 UserStrategyAccount
      where.user = {
        llmStrategySubscriptions: {
          some: {
            llmStrategyInstanceId: signal.llmStrategyInstanceId,
            status: 'active',
          },
        },
      }
    }

    const accounts = await this.prisma.userStrategyAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: config.execution.maxAccountsPerSignal,
    })

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

      const direction = resolvedSignal.direction
      const tradeSide = this.mapTradeSide(direction)
      const positionSide = this.mapPositionSide(direction)
      if (!tradeSide || !positionSide) return 'skipped'

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

      // 瀵逛簬 LLM 绛栫暐淇″彿锛岃幏鍙栫敤鎴疯闃呮椂缁戝畾鐨勪氦鏄撴墍璐︽埛
      // 绛栫暐鏈韩涓嶉檺鍒朵氦鏄撴墍锛岀敤鎴疯闃呮椂閫夋嫨鐨勮处鎴峰喅瀹氬疄闄呬娇鐢ㄧ殑浜ゆ槗鎵€
      let exchangeAccountId: string | undefined
      let effectiveExchangeId = orderParams.exchangeId
      let effectiveOrderParams = orderParams

      if (resolvedSignal.llmStrategyInstanceId) {
        const subscription = await this.prisma.userLlmStrategySubscription.findFirst({
          where: {
            userId: account.userId,
            llmStrategyInstanceId: resolvedSignal.llmStrategyInstanceId,
            status: 'active',
          },
          select: {
            exchangeAccountId: true,
            exchangeAccount: { select: { exchangeId: true } },
          },
        })
        if (subscription?.exchangeAccountId) {
          exchangeAccountId = subscription.exchangeAccountId
          // 浣跨敤鐢ㄦ埛璁㈤槄鏃堕€夋嫨鐨勮处鎴风殑 exchangeId锛岃€屼笉鏄俊鍙蜂腑鐨?symbol.exchange
          const accountExchangeId = this.normalizeExchangeId(subscription.exchangeAccount?.exchangeId)
          if (accountExchangeId && accountExchangeId !== orderParams.exchangeId) {
            // 妫€娴嬪埌璺ㄤ氦鏄撴墍璺熷崟锛氶渶瑕侀噸鏂拌幏鍙栫洰鏍囦氦鏄撴墍鐨?symbol metadata 骞堕噸鏂拌绠?orderParams
            effectiveExchangeId = accountExchangeId

            this.logger.log(
              `Cross-exchange subscription detected: signal exchange=${orderParams.exchangeId}, ` +
              `user account exchange=${accountExchangeId}. Recalculating orderParams for target exchange.`,
            )

            // 閲嶆柊鑾峰彇鐩爣浜ゆ槗鎵€鐨?symbol metadata
            // 娉ㄦ剰锛歮arket_symbols.exchange 瀛樺偍鐨勬槸澶у啓锛堝 BINANCE/OKX锛夛紝
            // 鑰?exchangeAccount.exchangeId 鍙兘鏄皬鍐欙紝闇€瑕佺粺涓€杞负澶у啓杩涜鏌ヨ
            const targetExchangeForQuery = (subscription.exchangeAccount?.exchangeId ?? '').toUpperCase()
            const targetSymbolMeta = await this.prisma.symbol.findFirst({
              where: {
                exchange: targetExchangeForQuery,
                baseAsset: resolvedSignal.symbol.baseAsset,
                quoteAsset: resolvedSignal.symbol.quoteAsset,
                instrumentType: resolvedSignal.symbol.instrumentType,
                status: 'ACTIVE',
              },
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

            // 浣跨敤鐩爣浜ゆ槗鎵€鐨?symbol metadata 閲嶆柊璁＄畻 orderParams
            const recalcResult = this.recalculateOrderParamsForTargetExchange(
              orderParams,
              resolvedSignal.symbol,
              targetSymbolMeta,
              accountExchangeId,
            )

            // 妫€鏌ラ噸鏂拌绠楁槸鍚︽垚鍔?
            if ('reason' in recalcResult) {
              // 閲嶆柊璁＄畻澶辫触锛岃烦杩囨湰娆℃墽琛?
              this.logger.warn(
                `Failed to recalculate orderParams for target exchange ${accountExchangeId}: ${recalcResult.reason}. ` +
                `Skipping execution for account ${account.id}.`,
              )
              await this.executionRepository.markSkipped(execution.id, recalcResult.reason)
              await this.releaseReservation(account.id, reservedQuote, reserveReference)
              return 'skipped'
            }

            // 鎴愬姛锛氫娇鐢ㄩ噸鏂拌绠楃殑鍙傛暟
            effectiveOrderParams = recalcResult.params
          } else if (accountExchangeId) {
            effectiveExchangeId = accountExchangeId
          }
        }
      }

      try {
        const order = await this.tradingService.placeOrder(
          account.userId,
          effectiveExchangeId,
          effectiveOrderParams.marketType,
          {
            symbol: effectiveOrderParams.symbol,
            marketType: effectiveOrderParams.marketType,
            side: effectiveOrderParams.side,
            type: 'market',
            amount: effectiveOrderParams.amount,
            price: effectiveOrderParams.price,
            reduceOnly: effectiveOrderParams.reduceOnly,
          },
          exchangeAccountId,
        )

        const executedQuantity = order.filled ?? order.amount
        const { amount: executedFee, currency: executedFeeCurrency } = this.extractOrderFee(order)

        let executedQuote: Decimal | null = null
        if (order.price && executedQuantity) {
          executedQuote = new Decimal(order.price).mul(executedQuantity)
        }

        // 璁＄畻鏈璁板綍鍦ㄨ处鐨勭湡瀹炴墸娆句笌鈥滆秴棰勭畻鈥濋儴鍒嗭細
        // - 榛樿鍙厑璁告湰鍦板彴璐︽墸鍑忚嚦澶?reservedQuote锛岃秴鍑洪儴鍒嗕氦鐢卞悗缁祫閲戝璐︽祦绋嬪鐞?
        // - 鑻?executedQuote 灏忎簬绛変簬 reservedQuote锛屾甯稿綊杩樺墿浣欓鐣?
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
            // 鏍囪鏈湴璐﹂潰涓庡疄闄呮垚浜や箣闂寸殑娼滃湪宸紓锛屼緵鍚庣画璧勯噾瀵硅处浠诲姟浣跨敤
            executedQuote: executedQuote?.toString(),
            reservedQuote: reservedQuote.toString(),
            overBudget: overBudget?.toString() ?? null,
          },
        })

        // 璁板綍鎴愪氦鍒版湰鍦颁粨浣嶇郴缁燂紝纭繚鏈湴浠撲綅涓庝氦鏄撴墍鍚屾
        // 娉ㄦ剰锛氬繀椤讳娇鐢?effectiveExchangeId 鍜?effectiveOrderParams锛堝疄闄呬笅鍗曠殑浜ゆ槗鎵€鍜屽弬鏁帮級
        // 鑰屼笉鏄?orderParams.exchangeId锛堜俊鍙蜂腑鐨勪氦鏄撴墍锛夛紝鍚﹀垯浼氬嚭鐜拌处闈笉涓€鑷撮棶棰?
        if (order.price && executedQuantity && executedQuantity > 0) {
          try {
            const symbolParts = effectiveOrderParams.symbol.split('/')
            const baseSymbol = symbolParts[0]?.replace(':PERP', '') ?? effectiveOrderParams.symbol
            const quoteSymbol = symbolParts[1]?.replace(':PERP', '') ?? 'USDT'

            await this.positionsService.recordTrade({
              userStrategyAccountId: account.id,
              symbol: `${baseSymbol}${quoteSymbol}`,
              market: `${effectiveExchangeId}:${orderParams.marketType}`,
              side: tradeSide,
              positionSide,
              price: order.price.toString(),
              quantity: executedQuantity.toString(),
              fee: executedFee > 0 ? executedFee.toString() : '0',
              feeCurrency: executedFeeCurrency ?? quoteSymbol,
              orderId: order.id,
              externalTradeId: order.id,
              provider: effectiveExchangeId,
              executedAt: new Date(order.createdAt).toISOString(),
              metadata: {
                signalId: signal.id,
                executionId: execution.id,
              },
            })

            this.logger.log(
              `Successfully recorded trade to local position for account ${account.id}, ` +
              `symbol ${baseSymbol}${quoteSymbol}, qty ${executedQuantity}`,
            )
          }
          catch (error) {
            // 璁板綍鎴愪氦澶辫触涓嶅簲闃绘柇璁㈠崟鎵ц娴佺▼锛屼粎璁板綍閿欒鏃ュ織锛岀瓑寰呭悗缁璐︿换鍔′慨姝?
            this.logger.error(
              `Failed to record trade to local position for account ${account.id}: ${(error as Error).message}`,
              (error as Error).stack,
            )
          }
        }

        return 'executed'
      }
      catch (error) {
        await this.executionRepository.markFailed(execution.id, (error as Error).message)
        this.logger.error(`Signal execution failed for account ${account.id}: ${(error as Error).message}`)
        // 涓嬪崟澶辫触鏃堕噴鏀惧叏閮ㄩ鐣?
        await this.releaseReservation(account.id, reservedQuote, reserveReference)
        return 'failed'
      }
    }
    catch (error) {
      // 鍏滃簳鎹曡幏 prepareExecution/浜嬪姟涓殑寮傚父锛岄伩鍏嶆墦鏂暣涓俊鍙锋墽琛屽惊鐜?
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
    return this.prisma.$transaction(async prisma => {
      const existing = await prisma.userSignalExecution.findUnique({
        where: {
          signalId_userStrategyAccountId: {
            signalId: signal!.id,
            userStrategyAccountId: account.id,
          },
        },
      })

      if (existing) {
        return { type: 'duplicate' }
      }

      const lockedAccount = await this.lockAccount(prisma, account.id)
      if (!lockedAccount) {
        return { type: 'skip', reason: 'Account not found' }
      }

      // 濡傛灉鏄钩浠?閫€鍑轰俊鍙凤紝鍏堟煡鎵惧綋鍓嶆寔浠撹妯★紝鐢ㄤ簬鏋勯€犳纭殑骞充粨鏁伴噺
      let closePositionQuantity: Decimal | undefined
      const isCloseSignal =
        signal.direction === 'CLOSE_LONG' ||
        signal.direction === 'CLOSE_SHORT' ||
        signal.signalType === 'EXIT'

      if (isCloseSignal) {
        const symbolCode = signal.symbol?.code
        const positionSideForClose = this.mapPositionSide(signal.direction)

        if (!symbolCode || !positionSideForClose) {
          const reason = 'Cannot close position: missing symbol or position side'
          const execution = await prisma.userSignalExecution.create({
            data: {
              signal: { connect: { id: signal!.id } },
              user: { connect: { id: account.userId } },
              account: { connect: { id: account.id } },
              orderSide,
              positionSide,
              status: 'SKIPPED',
              errorMessage: reason,
            },
            select: { id: true },
          })
          return { type: 'skip', reason, executionId: execution.id }
        }

        const openPosition = await prisma.position.findFirst({
          where: {
            userStrategyAccountId: account.id,
            symbol: symbolCode,
            status: 'OPEN',
            positionSide: positionSideForClose,
          },
          orderBy: { openedAt: 'desc' },
        })

        if (!openPosition || new Decimal(openPosition.quantity).lte(0)) {
          const reason = 'No open position to close for this signal'
          const execution = await prisma.userSignalExecution.create({
            data: {
              signal: { connect: { id: signal!.id } },
              user: { connect: { id: account.userId } },
              account: { connect: { id: account.id } },
              orderSide,
              positionSide,
              status: 'SKIPPED',
              errorMessage: reason,
            },
            select: { id: true },
          })
          return { type: 'skip', reason, executionId: execution.id }
        }

        closePositionQuantity = new Decimal(openPosition.quantity).abs()
      }

      const orderParamsResult = this.buildOrderParamsWithLockedAccount(signal, lockedAccount, config, closePositionQuantity)
      if (!orderParamsResult.ok) {
        const reason = (orderParamsResult as { ok: false; reason: string }).reason
        const execution = await prisma.userSignalExecution.create({
          data: {
            signal: { connect: { id: signal!.id } },
            user: { connect: { id: account.userId } },
            account: { connect: { id: account.id } },
            orderSide,
            positionSide,
            status: 'SKIPPED',
            errorMessage: reason,
          },
          select: { id: true },
        })
        return { type: 'skip', reason, executionId: execution.id }
      }

      const reserveReference = `signal:${signal.id}:acct:${account.id}:reserve`

      // 瀵瑰紑浠撲笌骞充粨淇″彿閲囩敤涓嶅悓鐨勮祫閲戣矾寰勶細
      // - 寮€浠擄細棰勭暀 quoteBudget 骞跺湪鎵ц鎴愬姛鍚庢牴鎹疄闄呮垚浜ら噴鏀惧墿浣?
      // - 骞充粨/EXIT锛氫笉棰勭暀璧勯噾锛屾垚浜ゅ悗鐨勭幇閲戝叆璐︾敱浜ゆ槗鎵€浣欓鍚屾/瀵硅处娴佺▼璐熻矗锛岄伩鍏嶆妸鍗栧嚭瑙嗕负鍐嶆鏀嚭
      let reservedQuoteForExecution = orderParamsResult.quoteBudget

      if (!isCloseSignal) {
        await this.accountsService.applyLedgerDeltaWithClient(prisma, {
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

      const execution = await prisma.userSignalExecution.create({
        data: {
          signal: { connect: { id: signal.id } },
          user: { connect: { id: account.userId } },
          account: { connect: { id: account.id } },
          orderSide,
          positionSide,
          reservedQuote: reservedQuoteForExecution.gt(0) ? reservedQuoteForExecution : undefined,
        },
        select: { id: true },
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

  private async lockAccount(
    prisma: Prisma.TransactionClient,
    accountId: string,
  ): Promise<Pick<UserStrategyAccount, 'id' | 'userId' | 'baseCurrency' | 'balance'> | null> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        userId: string
        baseCurrency: string
        balance: Decimal
      }>
    >`
      SELECT
        "id",
        "user_id" AS "userId",
        "base_currency" AS "baseCurrency",
        "balance"
      FROM "user_strategy_accounts"
      WHERE "id" = ${accountId}
      FOR UPDATE
    `
    return rows[0] ?? null
  }

  private buildOrderParamsWithLockedAccount(
    signal: LoadedSignal,
    account: Pick<UserStrategyAccount, 'id' | 'userId' | 'baseCurrency' | 'balance'>,
    config: StrategySignalsRuntimeConfig,
    closePositionQuantity?: Decimal,
  ): { ok: true; params: OrderParams; quoteBudget: Decimal } | { ok: false; reason: string } {
    const symbolMeta = signal?.symbol
    if (!symbolMeta) return { ok: false, reason: 'Signal missing symbol metadata' }

    const exchangeId = this.normalizeExchangeId(symbolMeta.exchange)
    const marketType = this.normalizeMarketType(symbolMeta.instrumentType)
    if (!exchangeId || !marketType) {
      return { ok: false, reason: 'Unsupported exchange or instrument type' }
    }

    // 鐩墠浠呮敮鎸佽处鎴峰熀鍑嗗竵绉嶄笌鏍囩殑鎶ヤ环甯佺涓ユ牸涓€鑷寸殑鍦烘櫙锛岄伩鍏嶈祫閲戣璐︿笌瀹為檯涓嬪崟甯佺涓嶅尮閰?
    const accountCurrency = account.baseCurrency?.toUpperCase()
    const quoteCurrency = symbolMeta.quoteAsset?.toUpperCase()
    if (!accountCurrency || !quoteCurrency || accountCurrency !== quoteCurrency) {
      return {
        ok: false,
        reason: `Account base currency ${accountCurrency ?? 'N/A'} does not match symbol quote asset ${quoteCurrency ?? 'N/A'}`,
      }
    }

    const unifiedSymbol = this.buildUnifiedSymbol(symbolMeta)
    const side = this.mapOrderSide(signal.direction)
    if (!side) return { ok: false, reason: 'Unsupported signal direction' }

    // 鏍规嵁鏄紑浠撹繕鏄钩浠撳喅瀹氶绠椾笌鍘熷鏁伴噺鏉ユ簮
    const isCloseSignal =
      signal.direction === 'CLOSE_LONG' ||
      signal.direction === 'CLOSE_SHORT' ||
      signal.signalType === 'EXIT'

    const entryPrice = signal.entryPrice ? Number(signal.entryPrice) : undefined
    if (!entryPrice || entryPrice <= 0) {
      return { ok: false, reason: 'Entry price missing' }
    }

    const balance = account.balance
    // 寮€浠撳満鏅墠妫€鏌ユ渶浣庝綑棰濅笌椋庨櫓棰勭畻锛涘钩浠?EXIT 涓嶅簲鍥犱负 quote 浣欓涓嶈冻鑰屾棤娉曞崠鍑?
    if (!isCloseSignal) {
      const minBalance = new Decimal(config.execution.minBalanceThreshold)
      if (balance.lt(minBalance)) {
        return { ok: false, reason: 'Account balance below minimum threshold' }
      }
    }

    let quoteBudget: Decimal
    let rawAmount: Decimal

    if (isCloseSignal && closePositionQuantity) {
      if (closePositionQuantity.lte(0)) {
        return { ok: false, reason: 'Position quantity not positive for close signal' }
      }
      rawAmount = closePositionQuantity
      // 骞充粨涓嶉鐣欓绠楋紝鐢卞疄闄呮垚浜や笌浜ゆ槗鎵€浣欓鍚屾/瀵硅处妯″潡璐熻矗璧勯噾鍏ヨ处锛岃繖閲岀殑棰勭畻浠呯敤浜庡唴閮ㄧ粺璁?
      quoteBudget = new Decimal(0)
    }
    else {
      // 璁＄畻椋庨櫓涓婇檺锛堝熀浜庤处鎴蜂綑棰濆拰椋庨櫓姣斾緥锛?
      const maxRiskQuote = balance.mul(config.execution.maxRiskFraction)
      const defaultQuote = new Decimal(config.execution.defaultQuoteAmount)

      // 浼樺厛浣跨敤绛栫暐鎸囧畾鐨勪粨浣嶅ぇ灏忥紝浠呭彈 maxRiskFraction 绾︽潫
      // defaultQuoteAmount 浠呭湪绛栫暐鏈寚瀹氫粨浣嶆椂浣滀负 fallback
      if (signal.positionSizeQuote && new Decimal(signal.positionSizeQuote).gt(0)) {
        // 绛栫暐鎸囧畾浜嗙粷瀵归噾棰?
        const strategyQuote = new Decimal(signal.positionSizeQuote)
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote)
        this.logger.debug(
          `Strategy-specified position size (quote): ${strategyQuote.toString()}, ` +
          `max risk limit (${config.execution.maxRiskFraction}): ${maxRiskQuote.toString()}, ` +
          `final budget: ${quoteBudget.toString()}`
        )
      }
      else if (signal.positionSizeRatio && new Decimal(signal.positionSizeRatio).gt(0)) {
        // 绛栫暐鎸囧畾浜嗕粨浣嶆瘮渚?
        const ratio = new Decimal(signal.positionSizeRatio)
        const strategyQuote = balance.mul(ratio)
        quoteBudget = Decimal.min(strategyQuote, maxRiskQuote)
        this.logger.debug(
          `Strategy-specified position size (ratio): ${ratio.toString()} of balance ${balance.toString()} = ${strategyQuote.toString()}, ` +
          `max risk limit (${config.execution.maxRiskFraction}): ${maxRiskQuote.toString()}, ` +
          `final budget: ${quoteBudget.toString()}`
        )
      }
      else {
        // 鍥為€€鍒板叏灞€閰嶇疆锛氭鏃舵墠浣跨敤 defaultQuoteAmount
        quoteBudget = Decimal.min(maxRiskQuote, defaultQuote)
        this.logger.debug(
          `No strategy position size, using global config: ` +
          `min(maxRisk=${maxRiskQuote.toString()}, default=${defaultQuote.toString()}) = ${quoteBudget.toString()}`
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

    // 鍩轰簬绗﹀彿閰嶇疆閲忓寲浠锋牸涓庢暟閲忥紝閬垮厤纭紪鐮佸皬鏁颁綅
    const precisionQuantity = symbolMeta.precisionQuantity ?? 6
    const precisionPrice = symbolMeta.precisionPrice ?? 2
    const lotSize = symbolMeta.lotSize ? new Decimal(symbolMeta.lotSize) : null
    const tickSize = symbolMeta.tickSize ? new Decimal(symbolMeta.tickSize) : null

    // 鍏堟寜绮惧害鎴柇鍒板彲琛ㄧず鐨勫皬鏁颁綅
    const amountScale = new Decimal(10).pow(precisionQuantity)
    let quantity = rawAmount.mul(amountScale).floor().div(amountScale)

    // 鍐嶆寜鏈€灏忔墜鏁帮紙lotSize锛夊悜涓嬪彇鏁村埌鏈€杩戠殑鏁存暟鍊?
    if (lotSize) {
      const lots = quantity.div(lotSize).floor()
      quantity = lots.mul(lotSize)
    }

    if (quantity.lte(0)) {
      return { ok: false, reason: 'Computed order amount below lotSize or precision' }
    }

    // 浠锋牸鎸?tickSize 鎴?precisionPrice 閲忓寲
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

    return {
      ok: true,
      params: {
      exchangeId,
      marketType,
      symbol: unifiedSymbol,
      side,
        amount: finalAmount,
        price: finalPrice,
        reduceOnly: signal.direction === 'CLOSE_LONG' || signal.direction === 'CLOSE_SHORT',
      },
      quoteBudget,
    }
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

  private buildUnifiedSymbol(symbol: PrismaSymbol): string {
    const base = symbol.baseAsset?.toUpperCase() ?? ''
    const quote = symbol.quoteAsset?.toUpperCase() ?? ''
    const pair = `${base}/${quote}`
    if (symbol.instrumentType === 'PERPETUAL' || symbol.instrumentType === 'FUTURE') {
      return `${pair}:PERP`
    }
    return pair
  }

  /**
   * 褰撶敤鎴烽€夋嫨鐨勪氦鏄撴墍涓庝俊鍙峰師濮嬩氦鏄撴墍涓嶅悓鏃讹紝閲嶆柊璁＄畻 orderParams
   * 浣跨敤鐩爣浜ゆ槗鎵€鐨勭簿搴︿俊鎭紙lotSize銆乼ickSize锛夐噸鏂伴噺鍖?amount 鍜?price
   *
   * @param originalParams 鍘熷鐨?orderParams锛堝熀浜庝俊鍙峰師濮嬩氦鏄撴墍璁＄畻锛?
   * @param originalSymbolMeta 淇″彿鍘熷浜ゆ槗鎵€鐨?symbol metadata
   * @param targetSymbolMeta 鐩爣浜ゆ槗鎵€鐨?symbol metadata
   * @param targetExchangeId 鐩爣浜ゆ槗鎵€ ID
   * @returns 閲嶆柊璁＄畻鍚庣殑 orderParams 鎴栭敊璇俊鎭?
   */
  private recalculateOrderParamsForTargetExchange(
    originalParams: OrderParams,
    originalSymbolMeta: PrismaSymbol,
    targetSymbolMeta: PrismaSymbol,
    targetExchangeId: ExchangeId,
  ): { ok: true; params: OrderParams } | { ok: false; reason: string } {
    // 楠岃瘉鍩虹璧勪骇鍜屾姤浠疯祫浜ф槸鍚﹀尮閰?
    if (
      originalSymbolMeta.baseAsset !== targetSymbolMeta.baseAsset ||
      originalSymbolMeta.quoteAsset !== targetSymbolMeta.quoteAsset
    ) {
      return {
        ok: false,
        reason: `Symbol mismatch: ${originalSymbolMeta.baseAsset}/${originalSymbolMeta.quoteAsset} vs ${targetSymbolMeta.baseAsset}/${targetSymbolMeta.quoteAsset}`,
      }
    }

    // 浣跨敤鐩爣浜ゆ槗鎵€鐨?symbol 鏋勫缓缁熶竴鐨?symbol 瀛楃涓?
    const targetSymbol = this.buildUnifiedSymbol(targetSymbolMeta)
    const targetMarketType = this.normalizeMarketType(targetSymbolMeta.instrumentType)

    if (!targetMarketType) {
      return { ok: false, reason: 'Unsupported target instrument type' }
    }

    // 鑾峰彇鐩爣浜ゆ槗鎵€鐨勭簿搴︿俊鎭?
    const targetLotSize = targetSymbolMeta.lotSize ? new Decimal(targetSymbolMeta.lotSize) : null
    const targetTickSize = targetSymbolMeta.tickSize ? new Decimal(targetSymbolMeta.tickSize) : null
    const targetPrecisionQuantity = targetSymbolMeta.precisionQuantity
    const targetPrecisionPrice = targetSymbolMeta.precisionPrice

    // 閲嶆柊閲忓寲 amount锛堟暟閲忥級
    const rawAmount = new Decimal(originalParams.amount)

    // 鎸夌簿搴︽埅鏂埌鍙〃绀虹殑灏忔暟浣?
    const amountScale = new Decimal(10).pow(targetPrecisionQuantity)
    let quantity = rawAmount.mul(amountScale).floor().div(amountScale)

    // 鎸夋渶灏忔墜鏁帮紙lotSize锛夊悜涓嬪彇鏁村埌鏈€杩戠殑鏁存暟鍊?
    if (targetLotSize) {
      const lots = quantity.div(targetLotSize).floor()
      quantity = lots.mul(targetLotSize)
    }

    if (quantity.lte(0)) {
      return {
        ok: false,
        reason: `Computed order amount ${quantity.toString()} below target exchange lotSize ${targetLotSize?.toString() ?? 'N/A'}`,
      }
    }

    // 閲嶆柊閲忓寲 price锛堜环鏍硷級
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

  private extractOrderFee(order: UnifiedOrder): { amount: number; currency: string | null } {
    const raw = order.raw as any

    if (typeof raw?.fee === 'number' && Number.isFinite(raw.fee)) {
      const currency = typeof raw?.feeCurrency === 'string' ? raw.feeCurrency : null
      return { amount: raw.fee, currency }
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
}
