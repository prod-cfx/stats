import type { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
import type { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { BinanceConfig, HyperliquidConfig, OkxConfig } from '@/modules/trading/factory/account-store'
import type { ExchangeAccount } from '@/prisma/prisma.types'
import { Inject, Injectable } from '@nestjs/common'

import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { TradingService } from '@/modules/trading/trading.service'
import { PrismaService } from '@/prisma/prisma.service'

import { ExchangeAccountNotFoundException, InvalidExchangeAccountConfigException } from './exceptions'

@Injectable()
export class ExchangeAccountsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigCryptoService)
    private readonly crypto: ConfigCryptoService,
    @Inject(TradingService)
    private readonly tradingService: TradingService,
  ) {}

  async create(userId: string, dto: CreateExchangeAccountDto): Promise<ExchangeAccountResponseDto> {
    const config = this.buildConfig(dto)
    let lastValidatedAt: Date | null = null

    // 验证交易所凭据（所有交易所都需要验证）
    if (dto.exchangeId === 'binance' || dto.exchangeId === 'okx') {
      await this.tradingService.validateCexCredentials(
        dto.exchangeId,
        this.resolveMarketType(dto.marketType),
        config as BinanceConfig | OkxConfig,
      )
      lastValidatedAt = new Date()
    }
    else if (dto.exchangeId === 'hyperliquid') {
      // Hyperliquid 也需要验证凭据（通过 ping/fetchBalance 验证签名）
      await this.tradingService.validateCexCredentials(
        dto.exchangeId,
        'perp', // Hyperliquid 只支持 perp
        config as HyperliquidConfig,
      )
      lastValidatedAt = new Date()
    }

    const record = await this.prisma.exchangeAccount.create({
      data: {
        userId,
        exchangeId: dto.exchangeId,
        name: dto.name,
        isTestnet: dto.isTestnet ?? false,
        encryptedConfig: this.crypto.encryptConfig(config),
        lastValidatedAt,
      },
    })

    return this.toResponse(record)
  }

  async list(userId: string): Promise<ExchangeAccountResponseDto[]> {
    const records = await this.prisma.exchangeAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(record => this.toResponse(record))
  }

  async delete(userId: string, accountId: string): Promise<void> {
    const client = this.prisma.getClient()

    // 先验证账户归属，防止越权操作
    const account = await client.exchangeAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    })
    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId })
    }

    // 删除账户前，必须先暂停该用户使用该账户的所有 active LLM 订阅
    // 注意：必须同时过滤 userId，防止越权暂停他人订阅
    // 否则外键 onDelete:SetNull 会让订阅变成 active 且 exchangeAccountId=null 的脏状态
    const pausedCount = await client.userLlmStrategySubscription.updateMany({
      where: {
        userId,
        exchangeAccountId: accountId,
        status: 'active',
      },
      data: {
        status: 'paused',
      },
    })

    if (pausedCount.count > 0) {
      console.log(
        `用户 ${userId} 删除账户 ${accountId} 前自动暂停了 ${pausedCount.count} 个 active LLM 订阅`,
      )
    }

    await client.exchangeAccount.delete({
      where: { id: accountId },
    })
  }

  private resolveMarketType(marketType?: MarketType): MarketType {
    return marketType ?? 'spot'
  }

  private toResponse(record: ExchangeAccount): ExchangeAccountResponseDto {
    return {
      id: record.id,
      exchangeId: record.exchangeId as ExchangeId,
      name: record.name,
      isTestnet: record.isTestnet,
      lastValidatedAt: record.lastValidatedAt,
      createdAt: record.createdAt,
    }
  }

  private buildConfig(
    dto: CreateExchangeAccountDto,
  ): BinanceConfig | OkxConfig | HyperliquidConfig {
    if (dto.exchangeId === 'binance')
      return this.buildBinanceConfig(dto)
    if (dto.exchangeId === 'okx')
      return this.buildOkxConfig(dto)
    if (dto.exchangeId === 'hyperliquid')
      return this.buildHyperliquidConfig(dto)
    throw new InvalidExchangeAccountConfigException({ exchangeId: dto.exchangeId })
  }

  private buildBinanceConfig(dto: CreateExchangeAccountDto): BinanceConfig {
    if (!dto.apiKey || !dto.apiSecret)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'binance' })

    return {
      apiKey: dto.apiKey,
      secret: dto.apiSecret,
      isTestnet: dto.isTestnet,
      spotEnabled: dto.marketType ? dto.marketType === 'spot' : undefined,
      futuresEnabled: dto.marketType ? dto.marketType === 'perp' : undefined,
    }
  }

  private buildOkxConfig(dto: CreateExchangeAccountDto): OkxConfig {
    if (!dto.apiKey || !dto.apiSecret || !dto.passphrase)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'okx' })

    return {
      apiKey: dto.apiKey,
      secret: dto.apiSecret,
      passphrase: dto.passphrase,
      isTestnet: dto.isTestnet,
    }
  }

  private buildHyperliquidConfig(dto: CreateExchangeAccountDto): HyperliquidConfig {
    if (!dto.mainWalletAddress || !dto.agentPrivateKey)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })

    // 严格验证格式（防御性编程，即使 DTO 层已验证）
    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/

    if (!addressRegex.test(dto.mainWalletAddress)) {
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })
    }

    if (!privateKeyRegex.test(dto.agentPrivateKey)) {
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })
    }

    return {
      mainWalletAddress: dto.mainWalletAddress,
      agentPrivateKey: dto.agentPrivateKey,
      // 将 isTestnet 标志透传到 HyperliquidConfig，便于客户端按账户维度选择测试网/主网
      isTestnet: dto.isTestnet ?? false,
    }
  }
}
