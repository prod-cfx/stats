import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { MarketType } from '@/modules/trading/core/types'
import type { Prisma, SignalDirection, SignalType } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'
 
import { FixedSignalContextRepository } from '../repositories/fixed-signal-context.repository'
import { SignalExecutorService } from './signal-executor.service'

export interface FixedHyperliquidTestnetSignalContext {
  strategyId: string
  userId: string
  strategyAccountId: string
  spotSymbolId: string
  spotInstanceId: string
  spotSymbol: string
  perpSymbolId: string
  perpInstanceId: string
  perpSymbol: string
}

export interface CreateFixedHyperliquidTestnetSignalInput {
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

const DEFAULT_BASE_ASSET = 'BTC'
const DEFAULT_QUOTE_ASSET = 'USDC'
const DEFAULT_FIXED_USER_EMAIL = 'hyperliquid-testnet-fixed@local.dev'
const DEFAULT_CONFIDENCE = '95'
const DEFAULT_AI_MODEL = 'gpt-4.1-mini'
const DEFAULT_MAIN_WALLET_ADDRESS = 'hyperliquid-testnet-public-wallet'
const DEFAULT_AGENT_PRIVATE_KEY = '0000000000000000000000000000000000000000000000000000000000000001'

@Injectable()
export class FixedHyperliquidTestnetSignalService {
  constructor(
    @Inject(FixedSignalContextRepository)
    private readonly contextRepository: FixedSignalContextRepository,
    @Inject(EnvService)
    private readonly env: EnvService,
    @Inject(SignalExecutorService)
    private readonly signalExecutor: SignalExecutorService,
  ) {}

  isEnabled(): boolean {
    const raw = this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED')
    if (!raw) return false
    const normalized = raw.trim().toLowerCase()
    return ['true', '1', 'yes', 'on'].includes(normalized)
  }

  async fetchTickerPrice(symbol: string): Promise<string> {
    const { HyperliquidClient } = await import('@/modules/trading/exchanges/hyperliquid-client')
    const client = new HyperliquidClient({
      mainWalletAddress: this.getMainWalletAddress(),
      agentPrivateKey: this.getAgentPrivateKey(),
      isTestnet: true,
    })
    const ticker = await client.fetchTicker(symbol)
    return ticker.last.toString()
  }

  async resolveContext(): Promise<FixedHyperliquidTestnetSignalContext> {
    if (!this.isEnabled()) {
      throw new DomainException('signal.testnet_not_enabled', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED is not enabled' },
      })
    }

    const spotBaseAsset = this.getSpotBaseAsset()
    const perpBaseAsset = this.getPerpBaseAsset()
    const quoteAsset = this.getQuoteAsset()
    const spotSymbolCode = `${spotBaseAsset}${quoteAsset}`
    const perpSymbolCode = `${perpBaseAsset}${quoteAsset}:PERP`
    const strategyName = `FIXED-HYPERLIQUID-TESTNET-${spotSymbolCode}`
    const spotStrategySlug = spotSymbolCode.toLowerCase()
    const perpStrategySlug = `${perpBaseAsset}${quoteAsset}`.toLowerCase()
    const userEmail = this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL', DEFAULT_FIXED_USER_EMAIL) ?? DEFAULT_FIXED_USER_EMAIL

    const [strategy, user, spotSymbol, perpSymbol] = await Promise.all([
      this.contextRepository.findLlmStrategyByName(strategyName),
      this.contextRepository.findUserByEmail(userEmail),
      this.contextRepository.findSymbolByCode(spotSymbolCode),
      this.contextRepository.findSymbolByCode(perpSymbolCode),
    ])

    if (!strategy || !user || !spotSymbol || !perpSymbol) {
      throw new DomainException('signal.seed_context_incomplete', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'Fixed Hyperliquid testnet seed context is incomplete' },
      })
    }

    const [strategyAccount, spotInstance, perpInstance] = await Promise.all([
      this.contextRepository.findUserStrategyAccount(user.id, strategy.id),
      this.contextRepository.findLlmStrategyInstance(strategy.id, `fixed-hyperliquid-${spotStrategySlug}-spot`),
      this.contextRepository.findLlmStrategyInstance(strategy.id, `fixed-hyperliquid-${perpStrategySlug}-perp`),
    ])

    if (!strategyAccount || !spotInstance || !perpInstance) {
      throw new DomainException('signal.subscriptions_missing', {
        code: ErrorCode.STRATEGY_SIGNAL_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'Fixed Hyperliquid testnet subscriptions or strategy account are missing' },
      })
    }

    return {
      strategyId: strategy.id,
      userId: user.id,
      strategyAccountId: strategyAccount.id,
      spotSymbolId: spotSymbol.id,
      spotInstanceId: spotInstance.id,
      spotSymbol: `${spotBaseAsset}/${quoteAsset}`,
      perpSymbolId: perpSymbol.id,
      perpInstanceId: perpInstance.id,
      perpSymbol: `${perpBaseAsset}/${quoteAsset}:PERP`,
    }
  }

  async createSignal(input: CreateFixedHyperliquidTestnetSignalInput) {
    const context = await this.resolveContext()
    const target = input.marketType === 'spot'
      ? {
          symbolId: context.spotSymbolId,
          instanceId: context.spotInstanceId,
          symbol: context.spotSymbol,
        }
      : {
          symbolId: context.perpSymbolId,
          instanceId: context.perpInstanceId,
          symbol: context.perpSymbol,
        }
    const entryPrice = input.entryPrice ?? await this.fetchTickerPrice(target.symbol)

    return this.contextRepository.createTradingSignal({
      llmStrategyId: context.strategyId,
      llmStrategyInstanceId: target.instanceId,
      symbolId: target.symbolId,
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
    })
  }

  async createAndExecuteSignal(
    input: CreateFixedHyperliquidTestnetSignalInput & {
      executionConfig: StrategySignalsRuntimeConfig
    },
  ) {
    const signal = await this.createSignal(input)
    await this.signalExecutor.executeSignalForSubscribedUsers(signal.id, input.executionConfig)
    return signal
  }

  private getSpotBaseAsset() {
    return (
      this.env.getString(
        'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_SPOT_BASE_ASSET',
        this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET', DEFAULT_BASE_ASSET) ?? DEFAULT_BASE_ASSET,
      )
      ?? DEFAULT_BASE_ASSET
    ).toUpperCase()
  }

  private getPerpBaseAsset() {
    return (
      this.env.getString(
        'QUANTIFY_FIXED_HYPERLIQUID_TESTNET_PERP_BASE_ASSET',
        this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET', DEFAULT_BASE_ASSET) ?? DEFAULT_BASE_ASSET,
      )
      ?? DEFAULT_BASE_ASSET
    ).toUpperCase()
  }

  private getQuoteAsset() {
    return (this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET', DEFAULT_QUOTE_ASSET) ?? DEFAULT_QUOTE_ASSET).toUpperCase()
  }

  private getMainWalletAddress() {
    return (
      this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS', DEFAULT_MAIN_WALLET_ADDRESS)
      ?? DEFAULT_MAIN_WALLET_ADDRESS
    )
  }

  private getAgentPrivateKey() {
    return (
      this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY', DEFAULT_AGENT_PRIVATE_KEY)
      ?? DEFAULT_AGENT_PRIVATE_KEY
    )
  }
}
