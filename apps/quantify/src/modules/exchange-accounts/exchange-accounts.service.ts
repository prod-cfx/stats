import type { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
import type { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { BinanceConfig, HyperliquidConfig, OkxConfig } from '@/modules/trading/factory/account-store'
import type { ExchangeAccount, ExchangeId as PrismaExchangeId } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Inject, Injectable } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { ExchangeOperationFailedException } from '@/modules/trading/exceptions/exchange-operation-failed.exception'
import { InvalidCredentialsException } from '@/modules/trading/exceptions/invalid-credentials.exception'
import { TradingService } from '@/modules/trading/trading.service'
import { PrismaService } from '@/prisma/prisma.service'
import { Prisma } from '@/prisma/prisma.types'

import { ExchangeAccountNotFoundException, InvalidExchangeAccountConfigException } from './exceptions'

const SUPPORTED_EXCHANGES: ExchangeId[] = ['binance', 'okx', 'hyperliquid']

/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

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
    const lastValidatedAt = await this.validateCredentials(dto.exchangeId, dto.marketType, config)
    const encryptedConfig = this.crypto.encryptConfig(config)
    try {
      const record = await this.prisma.exchangeAccount.create({
        data: {
          userId,
          exchangeId: dto.exchangeId,
          name: dto.name,
          isTestnet: dto.isTestnet ?? false,
          encryptedConfig,
          lastValidatedAt,
        },
      })
      return this.toResponse(record, config)
    }
    catch (error) {
      if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error

      const existing = await this.prisma.exchangeAccount.findFirst({
        where: { userId, exchangeId: dto.exchangeId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      })
      if (!existing)
        throw error

      const record = await this.prisma.exchangeAccount.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          isTestnet: dto.isTestnet ?? false,
          encryptedConfig,
          lastValidatedAt,
        },
      })
      return this.toResponse(record, config)
    }
  }

  async list(userId: string): Promise<ExchangeAccountResponseDto[]> {
    const records = await this.prisma.exchangeAccount.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
    const recordMap = new Map<ExchangeId, ExchangeAccount>()
    for (const record of records) {
      const exchangeId = record.exchangeId as ExchangeId
      if (!recordMap.has(exchangeId))
        recordMap.set(exchangeId, record)
    }

    return SUPPORTED_EXCHANGES.map((exchangeId) => {
      const record = recordMap.get(exchangeId)
      if (!record) {
        return {
          id: null,
          exchangeId,
          isBound: false,
          name: null,
          maskedCredential: null,
          isTestnet: null,
          lastValidatedAt: null,
          createdAt: null,
        }
      }

      return this.toResponse(record)
    })
  }

  async delete(userId: string, exchangeId: string): Promise<void> {
    const client = this.prisma.getClient()

    // 先验证账户归属，防止越权操作
    const account = await client.exchangeAccount.findFirst({
      where: { exchangeId: exchangeId as PrismaExchangeId, userId },
      select: { id: true },
    })
    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId: exchangeId })
    }

    // 删除账户前，必须先暂停该用户使用该账户的所有 active LLM 订阅
    // 注意：必须同时过滤 userId，防止越权暂停他人订阅
    // 否则外键 onDelete:SetNull 会让订阅变成 active 且 exchangeAccountId=null 的脏状态
    const pausedCount = await client.userLlmStrategySubscription.updateMany({
      where: {
        userId,
        exchangeAccountId: account.id,
        status: 'active',
      },
      data: {
        status: 'paused',
      },
    })

    if (pausedCount.count > 0) {
      console.log(
        `用户 ${userId} 删除账户 ${account.id} 前自动暂停了 ${pausedCount.count} 个 active LLM 订阅`,
      )
    }

    await client.exchangeAccount.delete({
      where: { id: account.id },
    })
  }

  private resolveMarketType(marketType?: MarketType): MarketType {
    return marketType ?? 'spot'
  }

  private toResponse(
    record: ExchangeAccount,
    configOverride?: BinanceConfig | OkxConfig | HyperliquidConfig,
  ): ExchangeAccountResponseDto {
    const config = configOverride ?? this.decryptConfig(record)

    return {
      id: record.id,
      exchangeId: record.exchangeId as ExchangeId,
      isBound: true,
      name: record.name,
      maskedCredential: this.maskCredential(record.exchangeId as ExchangeId, config),
      isTestnet: record.isTestnet,
      lastValidatedAt: record.lastValidatedAt,
      createdAt: record.createdAt,
    }
  }

  private decryptConfig(record: ExchangeAccount): BinanceConfig | OkxConfig | HyperliquidConfig {
    return this.crypto.decryptConfig(record.encryptedConfig)
  }

  private maskCredential(
    exchangeId: ExchangeId,
    config: BinanceConfig | OkxConfig | HyperliquidConfig,
  ): string | null {
    if (exchangeId === 'binance' || exchangeId === 'okx') {
      return this.maskValue((config as BinanceConfig | OkxConfig).apiKey, 4, 4)
    }

    return this.maskValue((config as HyperliquidConfig).mainWalletAddress, 6, 4)
  }

  private maskValue(value: string | undefined, start: number, end: number): string | null {
    if (!value)
      return null
    if (value.length <= start + end)
      return `${value.slice(0, start)}****`
    return `${value.slice(0, start)}****${value.slice(-end)}`
  }

  private async validateCredentials(
    exchangeId: ExchangeId,
    marketType: MarketType | undefined,
    config: BinanceConfig | OkxConfig | HyperliquidConfig,
  ): Promise<Date> {
    try {
      await this.tradingService.validateCexCredentials(
        exchangeId,
        this.resolveMarketType(marketType),
        config as BinanceConfig | OkxConfig | HyperliquidConfig,
      )
    }
    catch (error) {
      if (error instanceof InvalidCredentialsException) {
        const normalized = this.normalizeCredentialError(exchangeId, error.message)
        throw new DomainException(normalized.reasonMessage, {
          code: ErrorCode.TRADING_INVALID_CREDENTIALS,
          args: normalized,
        })
      }

      if (error instanceof ExchangeOperationFailedException) {
        throw new DomainException('交易所服务暂时不可用，请稍后重试', {
          code: ErrorCode.TRADING_EXCHANGE_OPERATION_FAILED,
          args: {
            exchangeId,
            reasonCode: 'EXCHANGE_UNAVAILABLE',
            reasonMessage: '交易所服务暂时不可用，请稍后重试',
            retryable: true,
          },
        })
      }

      throw error
    }

    return new Date()
  }

  private normalizeCredentialError(exchangeId: ExchangeId, message: string) {
    const messageLower = message.toLowerCase()

    if (exchangeId === 'okx' && message.includes('Passphrase错误')) {
      return {
        exchangeId,
        reasonCode: 'INVALID_PASSPHRASE',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (message.includes('白名单') || messageLower.includes('whitelist')) {
      return {
        exchangeId,
        reasonCode: 'IP_NOT_WHITELISTED',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (message.includes('权限不足') || messageLower.includes('permission')) {
      return {
        exchangeId,
        reasonCode: 'PERMISSION_DENIED',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (message.includes('已过期')) {
      return {
        exchangeId,
        reasonCode: 'API_KEY_EXPIRED',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (message.includes('已被禁用') || message.includes('已被禁用或删除')) {
      return {
        exchangeId,
        reasonCode: 'API_KEY_DISABLED',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (exchangeId === 'hyperliquid' && (messageLower.includes('authorized') || messageLower.includes('authorization'))) {
      return {
        exchangeId,
        reasonCode: 'HYPERLIQUID_AGENT_NOT_AUTHORIZED',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (exchangeId === 'hyperliquid') {
      return {
        exchangeId,
        reasonCode: 'INVALID_AGENT_SIGNATURE',
        reasonMessage: message,
        retryable: false,
      }
    }

    if (message.includes('签名验证失败')) {
      return {
        exchangeId,
        reasonCode: 'INVALID_API_SECRET',
        reasonMessage: message,
        retryable: false,
      }
    }

    return {
      exchangeId,
      reasonCode: 'INVALID_API_KEY',
      reasonMessage: message,
      retryable: false,
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
