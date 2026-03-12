import type { ExchangeAccount } from '@prisma/client'
import type { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
import type { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { BinanceConfig, HyperliquidConfig, OkxConfig } from '@/modules/trading/factory/account-store'
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

    // 楠岃瘉浜ゆ槗鎵€鍑嵁锛堟墍鏈変氦鏄撴墍閮介渶瑕侀獙璇侊級
    if (dto.exchangeId === 'binance' || dto.exchangeId === 'okx') {
      await this.tradingService.validateCexCredentials(
        dto.exchangeId,
        this.resolveMarketType(dto.marketType),
        config as BinanceConfig | OkxConfig,
      )
      lastValidatedAt = new Date()
    }
    else if (dto.exchangeId === 'hyperliquid') {
      // Hyperliquid 涔熼渶瑕侀獙璇佸嚟鎹紙閫氳繃 ping/fetchBalance 楠岃瘉绛惧悕锛?
      await this.tradingService.validateCexCredentials(
        dto.exchangeId,
        'perp', // Hyperliquid 鍙敮鎸?perp
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

    // 鍏堥獙璇佽处鎴峰綊灞烇紝闃叉瓒婃潈鎿嶄綔
    const account = await client.exchangeAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    })
    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId })
    }

    // 鍒犻櫎璐︽埛鍓嶏紝蹇呴』鍏堟殏鍋滆鐢ㄦ埛浣跨敤璇ヨ处鎴风殑鎵€鏈?active LLM 璁㈤槄
    // 娉ㄦ剰锛氬繀椤诲悓鏃惰繃婊?userId锛岄槻姝㈣秺鏉冩殏鍋滀粬浜鸿闃?
    // 鍚﹀垯澶栭敭 onDelete:SetNull 浼氳璁㈤槄鍙樻垚 active 浣?exchangeAccountId=null 鐨勮剰鐘舵€?
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
        `鐢ㄦ埛 ${userId} 鍒犻櫎璐︽埛 ${accountId} 鍓嶈嚜鍔ㄦ殏鍋滀簡 ${pausedCount.count} 涓?active LLM 璁㈤槄`,
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

    // 涓ユ牸楠岃瘉鏍煎紡锛堥槻寰℃€х紪绋嬶紝鍗充娇 DTO 灞傚凡楠岃瘉锛?
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
      // 灏?isTestnet 鏍囧織閫忎紶鍒?HyperliquidConfig锛屼究浜庡鎴风鎸夎处鎴风淮搴﹂€夋嫨娴嬭瘯缃?涓荤綉
      isTestnet: dto.isTestnet ?? false,
    }
  }
}
