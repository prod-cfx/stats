import type { StrategySignalsRuntimeConfig } from '../types/strategy-signals-config.type'
import type { MarketType } from '@/modules/trading/core/types'
import type { Prisma, SignalDirection, SignalType } from '@/prisma/prisma.types'
import { Injectable } from '@nestjs/common'
import { EnvService } from '@/common/services/env.service'
import { PrismaService } from '@/prisma/prisma.service'
import { SignalExecutorService } from './signal-executor.service'

export interface FixedHyperliquidTestnetSignalContext {
  strategyId: string
  userId: string
  strategyAccountId: string
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
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
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
      throw new Error('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED is not enabled')
    }

    const baseAsset = this.getBaseAsset()
    const quoteAsset = this.getQuoteAsset()
    const perpSymbolCode = `${baseAsset}${quoteAsset}:PERP`
    const strategyName = `FIXED-HYPERLIQUID-${perpSymbolCode}`
    const strategySlug = `${baseAsset}${quoteAsset}`.toLowerCase()
    const userEmail = this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL', DEFAULT_FIXED_USER_EMAIL) ?? DEFAULT_FIXED_USER_EMAIL

    const strategy = await this.prisma.llmStrategy.findUnique({
      where: { name: strategyName },
    })
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail },
    })
    const perpSymbol = await this.prisma.symbol.findFirst({ where: { code: perpSymbolCode } })

    if (!strategy || !user || !perpSymbol) {
      throw new Error('Fixed Hyperliquid testnet seed context is incomplete')
    }

    const [strategyAccount, perpInstance] = await Promise.all([
      this.prisma.userStrategyAccount.findFirst({
        where: {
          userId: user.id,
          strategyId: strategy.id,
        },
      }),
      this.prisma.llmStrategyInstance.findFirst({
        where: {
          strategyId: strategy.id,
          name: `fixed-hyperliquid-${strategySlug}-perp`,
        },
      }),
    ])

    if (!strategyAccount || !perpInstance) {
      throw new Error('Fixed Hyperliquid testnet subscriptions or strategy account are missing')
    }

    return {
      strategyId: strategy.id,
      userId: user.id,
      strategyAccountId: strategyAccount.id,
      perpSymbolId: perpSymbol.id,
      perpInstanceId: perpInstance.id,
      perpSymbol: `${baseAsset}/${quoteAsset}:PERP`,
    }
  }

  async createSignal(input: CreateFixedHyperliquidTestnetSignalInput) {
    if (input.marketType !== 'perp') {
      throw new Error('Fixed Hyperliquid signal only supports perp markets')
    }

    const context = await this.resolveContext()
    const entryPrice = input.entryPrice ?? await this.fetchTickerPrice(context.perpSymbol)

    return this.prisma.tradingSignal.create({
      data: {
        llmStrategyId: context.strategyId,
        llmStrategyInstanceId: context.perpInstanceId,
        symbolId: context.perpSymbolId,
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
    input: CreateFixedHyperliquidTestnetSignalInput & {
      executionConfig: StrategySignalsRuntimeConfig
    },
  ) {
    const signal = await this.createSignal(input)
    await this.signalExecutor.executeSignalForSubscribedUsers(signal.id, input.executionConfig)
    return signal
  }

  private getBaseAsset() {
    return (this.env.getString('QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET', DEFAULT_BASE_ASSET) ?? DEFAULT_BASE_ASSET).toUpperCase()
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
