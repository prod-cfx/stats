import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { MarketType } from '@/modules/trading/core/types'
import type { Prisma, SignalDirection, SignalType } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { EnvService } from '@/common/services/env.service'
import { OkxClient } from '@/modules/trading/exchanges/okx-client'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { SignalExecutorService } from './signal-executor.service'

export interface FixedOkxSimulatedSignalContext {
  strategyId: string
  userId: string
  strategyAccountId: string
  spotSymbolId: string
  perpSymbolId: string
  spotInstanceId: string
  perpInstanceId: string
  spotSymbol: string
  perpSymbol: string
}

export interface CreateFixedOkxSimulatedSignalInput {
  marketType: MarketType
  signalType: SignalType
  direction: SignalDirection
  reason: string
  entryPrice?: string
  positionSizeQuote?: string
  confidence?: string
  aiModel?: string
  marketContext?: Prisma.InputJsonValue
  metadata?: Prisma.InputJsonValue
}

const DEFAULT_SPOT_BASE_ASSET = 'BTC'
const DEFAULT_PERP_BASE_ASSET = 'BTC'
const DEFAULT_QUOTE_ASSET = 'USDT'
const DEFAULT_FIXED_USER_EMAIL = 'okx-sim-fixed@local.dev'
const DEFAULT_CONFIDENCE = '95'
const DEFAULT_AI_MODEL = 'gpt-4.1-mini'

@Injectable()
export class FixedOkxSimulatedSignalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly signalExecutor: SignalExecutorService,
  ) {}

  isEnabled(): boolean {
    const raw = this.env.getString('QUANTIFY_FIXED_OKX_ENABLED')
    if (!raw) return false
    const normalized = raw.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }

  async fetchTickerPrice(symbol: string, marketType: MarketType): Promise<string> {
    const client = new OkxClient(marketType, {
      apiKey: 'public-simulated',
      secret: 'public-simulated',
      passphrase: 'public-simulated',
      isTestnet: true,
      useUnifiedAccount: true,
    })
    const ticker = await client.fetchTicker(symbol)
    return ticker.last.toString()
  }

  async resolveContext(): Promise<FixedOkxSimulatedSignalContext> {
    if (!this.isEnabled()) {
      throw new DomainException('signal.testnet_not_enabled', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'QUANTIFY_FIXED_OKX_ENABLED is not enabled' },
      })
    }

    const spotBaseAsset = this.getSpotBaseAsset()
    const perpBaseAsset = this.getPerpBaseAsset()
    const quoteAsset = this.getQuoteAsset()
    const spotSymbolCode = `${spotBaseAsset}${quoteAsset}`
    const perpBaseCode = `${perpBaseAsset}${quoteAsset}`
    const perpSymbolCode = `${perpBaseCode}:PERP`
    const strategyName = `FIXED-OKX-SIMULATED-${spotSymbolCode}`
    const spotStrategySlug = spotSymbolCode.toLowerCase()
    const perpStrategySlug = perpBaseCode.toLowerCase()
    const userEmail
      = this.env.getString('QUANTIFY_FIXED_OKX_USER_EMAIL', DEFAULT_FIXED_USER_EMAIL)
        ?? DEFAULT_FIXED_USER_EMAIL

    const strategy = await this.prisma.llmStrategy.findUnique({
      where: { name: strategyName },
    })
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail },
    })
    const [spotSymbol, perpSymbol] = await Promise.all([
      this.prisma.symbol.findFirst({ where: { code: spotSymbolCode } }),
      this.prisma.symbol.findFirst({ where: { code: perpSymbolCode } }),
    ])

    if (!strategy || !user || !spotSymbol || !perpSymbol) {
      throw new DomainException('signal.seed_context_incomplete', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'Fixed OKX simulated seed context is incomplete' },
      })
    }

    const [strategyAccount, spotInstance, perpInstance] = await Promise.all([
      this.prisma.userStrategyAccount.findFirst({
        where: {
          userId: user.id,
          strategyId: strategy.id,
        },
      }),
      this.prisma.llmStrategyInstance.findFirst({
        where: {
          strategyId: strategy.id,
          name: `fixed-okx-${spotStrategySlug}-spot`,
        },
      }),
      this.prisma.llmStrategyInstance.findFirst({
        where: {
          strategyId: strategy.id,
          name: `fixed-okx-${perpStrategySlug}-perp`,
        },
      }),
    ])

    if (!strategyAccount || !spotInstance || !perpInstance) {
      throw new DomainException('signal.subscriptions_missing', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'Fixed OKX simulated subscriptions or strategy account are missing' },
      })
    }

    return {
      strategyId: strategy.id,
      userId: user.id,
      strategyAccountId: strategyAccount.id,
      spotSymbolId: spotSymbol.id,
      perpSymbolId: perpSymbol.id,
      spotInstanceId: spotInstance.id,
      perpInstanceId: perpInstance.id,
      spotSymbol: `${spotBaseAsset}/${quoteAsset}`,
      perpSymbol: `${perpBaseAsset}/${quoteAsset}:PERP`,
    }
  }

  async createSignal(input: CreateFixedOkxSimulatedSignalInput) {
    const context = await this.resolveContext()
    const executionSymbol = input.marketType === 'spot' ? context.spotSymbol : context.perpSymbol
    const entryPrice = input.entryPrice ?? await this.fetchTickerPrice(executionSymbol, input.marketType)

    return this.prisma.tradingSignal.create({
      data: {
        llmStrategyId: context.strategyId,
        llmStrategyInstanceId: input.marketType === 'spot' ? context.spotInstanceId : context.perpInstanceId,
        symbolId: input.marketType === 'spot' ? context.spotSymbolId : context.perpSymbolId,
        sourceType: 'AI_GENERATED',
        signalType: input.signalType,
        direction: input.direction,
        status: 'PENDING',
        confidence: input.confidence ?? DEFAULT_CONFIDENCE,
        entryPrice,
        positionSizeQuote: input.positionSizeQuote,
        aiModel: input.aiModel ?? DEFAULT_AI_MODEL,
        aiReasoning: input.reason,
        marketContext: input.marketContext,
        metadata: input.metadata,
      },
    })
  }

  async createAndExecuteSignal(
    input: CreateFixedOkxSimulatedSignalInput & {
      executionConfig: StrategySignalsRuntimeConfig
    },
  ) {
    const signal = await this.createSignal(input)
    await this.signalExecutor.executeSignalForSubscribedUsers(signal.id, input.executionConfig)
    return signal
  }

  private getSpotBaseAsset() {
    return (
      this.env.getString('QUANTIFY_FIXED_OKX_SPOT_BASE_ASSET', DEFAULT_SPOT_BASE_ASSET)
      ?? DEFAULT_SPOT_BASE_ASSET
    ).toUpperCase()
  }

  private getPerpBaseAsset() {
    return (
      this.env.getString('QUANTIFY_FIXED_OKX_PERP_BASE_ASSET', DEFAULT_PERP_BASE_ASSET)
      ?? DEFAULT_PERP_BASE_ASSET
    ).toUpperCase()
  }

  private getQuoteAsset() {
    return (
      this.env.getString('QUANTIFY_FIXED_OKX_QUOTE_ASSET', DEFAULT_QUOTE_ASSET)
      ?? DEFAULT_QUOTE_ASSET
    ).toUpperCase()
  }
}
