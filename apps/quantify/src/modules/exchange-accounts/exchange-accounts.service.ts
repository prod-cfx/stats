import type { ExchangeId as PrismaExchangeId } from '@ai/shared'
import type { CreateExchangeAccountDto } from './dto/create-exchange-account.dto'
import type { ExchangeAccountResponseDto } from './dto/exchange-account.response.dto'
import type { ExchangeId, MarketType } from '@/modules/trading/core/types'
import type { BinanceConfig, HyperliquidConfig, OkxConfig } from '@/modules/trading/factory/account-store'
import type { ExchangeAccount } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { Inject, Injectable } from '@nestjs/common'

import { DomainException } from '@/common/exceptions/domain.exception'
import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { ExchangeOperationFailedException } from '@/modules/trading/exceptions/exchange-operation-failed.exception'
import { InvalidCredentialsException } from '@/modules/trading/exceptions/invalid-credentials.exception'
import { TradingService } from '@/modules/trading/trading.service'
import { Prisma } from '@/prisma/prisma.types'

import { ExchangeAccountNotFoundException, InvalidExchangeAccountConfigException } from './exceptions'
 
import { ExchangeAccountRepository } from './repositories/exchange-account.repository'

const SUPPORTED_EXCHANGES: ExchangeId[] = ['binance', 'okx', 'hyperliquid']

/* eslint-disable no-redeclare, ts/no-redeclare */
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
const PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError
/* eslint-enable no-redeclare, ts/no-redeclare */

@Injectable()
export class ExchangeAccountsService {
  constructor(
    @Inject(ExchangeAccountRepository)
    private readonly exchangeAccountRepository: ExchangeAccountRepository,
    @Inject(ConfigCryptoService)
    private readonly crypto: ConfigCryptoService,
    @Inject(TradingService)
    private readonly tradingService: TradingService,
  ) {}

  async create(userId: string, dto: CreateExchangeAccountDto): Promise<ExchangeAccountResponseDto> {
    await this.ensureUserExists(userId, dto.userEmail)
    const existing = await this.exchangeAccountRepository.findExchangeAccountFirst({
      where: { userId, exchangeId: dto.exchangeId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
    const existingConfig = this.resolveExistingConfigForCreate(dto, existing)
    const config = this.buildConfig(dto, existingConfig)
    const { config: validatedConfig, lastValidatedAt } = await this.validateCredentials(dto.exchangeId, dto.marketType, config)
    const encryptedConfig = this.crypto.encryptConfig(validatedConfig)
    try {
      const record = await this.exchangeAccountRepository.createExchangeAccount({
        userId,
        exchangeId: dto.exchangeId,
        name: dto.name,
        isTestnet: dto.isTestnet ?? false,
        encryptedConfig,
        lastValidatedAt,
      })
      return this.toResponse(record, validatedConfig)
    }
    catch (error) {
      if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error

      const existing = await this.exchangeAccountRepository.findExchangeAccountFirst({
        where: { userId, exchangeId: dto.exchangeId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      })
      if (!existing)
        throw error

      const record = await this.exchangeAccountRepository.updateExchangeAccount(existing.id, {
        name: dto.name,
        isTestnet: dto.isTestnet ?? false,
        encryptedConfig,
        lastValidatedAt,
      })
      return this.toResponse(record, validatedConfig)
    }
  }

  private async ensureUserExists(userId: string, userEmail?: string): Promise<void> {
    const existingById = await this.exchangeAccountRepository.findUserById(userId)
    if (existingById) {
      if (userEmail && existingById.email !== userEmail) {
        await this.exchangeAccountRepository.updateUserEmail(userId, userEmail)
      }
      return
    }

    if (!userEmail) {
      throw new DomainException('exchange_account.missing_email', {
        code: ErrorCode.EXCHANGE_ACCOUNT_MISSING_EMAIL,
        args: { userId },
      })
    }

    const existingByEmail = await this.exchangeAccountRepository.findUserByEmail(userEmail)
    if (existingByEmail && existingByEmail.id !== userId) {
      throw new DomainException('exchange_account.user_conflict', {
        code: ErrorCode.EXCHANGE_ACCOUNT_USER_CONFLICT,
        args: { userId, existingUserId: existingByEmail.id },
      })
    }

    await this.exchangeAccountRepository.createUser({
      id: userId,
      email: userEmail,
    })
  }

  async list(userId: string): Promise<ExchangeAccountResponseDto[]> {
    const records = await this.exchangeAccountRepository.findExchangeAccountsByUser(userId, [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ])
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
    // 先验证账户归属，防止越权操作
    const account = await this.exchangeAccountRepository.findExchangeAccountFirst({
      where: { exchangeId: exchangeId as PrismaExchangeId, userId },
      select: { id: true },
    })
    if (!account) {
      throw new ExchangeAccountNotFoundException({ accountId: exchangeId })
    }

    // 删除账户前，必须先暂停该用户使用该账户的所有 active LLM 订阅
    // 注意：必须同时过滤 userId，防止越权暂停他人订阅
    // 否则外键 onDelete:SetNull 会让订阅变成 active 且 exchangeAccountId=null 的脏状态
    const pausedCount = await this.exchangeAccountRepository.pauseActiveLlmSubscriptions({
      userId,
      exchangeAccountId: account.id,
    })

    if (pausedCount.count > 0) {
      console.log(
        `用户 ${userId} 删除账户 ${account.id} 前自动暂停了 ${pausedCount.count} 个 active LLM 订阅`,
      )
    }

    await this.exchangeAccountRepository.deleteExchangeAccount(account.id)
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
  ): Promise<{ config: BinanceConfig | OkxConfig | HyperliquidConfig; lastValidatedAt: Date }> {
    if (exchangeId === 'binance') {
      return this.validateBinanceCredentials(config as BinanceConfig)
    }

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
        throw new DomainException('exchange_account.exchange_unavailable', {
          code: ErrorCode.EXCHANGE_ACCOUNT_EXCHANGE_UNAVAILABLE,
          args: {
            exchangeId,
            reasonCode: 'EXCHANGE_UNAVAILABLE',
            reasonMessage: 'Exchange service temporarily unavailable, please retry later',
            retryable: true,
          },
        })
      }

      throw error
    }

    return {
      config,
      lastValidatedAt: new Date(),
    }
  }

  private async validateBinanceCredentials(config: BinanceConfig): Promise<{ config: BinanceConfig; lastValidatedAt: Date }> {
    const [spotResult, perpResult] = await Promise.allSettled([
      this.tradingService.validateCexCredentials('binance', 'spot', config),
      this.tradingService.validateCexCredentials('binance', 'perp', config),
    ])

    const spotEnabled = spotResult.status === 'fulfilled'
    const futuresEnabled = perpResult.status === 'fulfilled'

    if (!spotEnabled && !futuresEnabled) {
      const failure = [spotResult, perpResult]
        .find(result => result.status === 'rejected' && result.reason instanceof InvalidCredentialsException)
        ?? [spotResult, perpResult]
          .find(result => result.status === 'rejected' && result.reason instanceof ExchangeOperationFailedException)

      if (failure?.status === 'rejected') {
        const error = failure.reason
        if (error instanceof InvalidCredentialsException) {
          const normalized = this.normalizeCredentialError('binance', error.message)
          throw new DomainException(normalized.reasonMessage, {
            code: ErrorCode.TRADING_INVALID_CREDENTIALS,
            args: normalized,
          })
        }

        if (error instanceof ExchangeOperationFailedException) {
          throw new DomainException('exchange_account.exchange_unavailable', {
            code: ErrorCode.EXCHANGE_ACCOUNT_EXCHANGE_UNAVAILABLE,
            args: {
              exchangeId: 'binance',
              reasonCode: 'EXCHANGE_UNAVAILABLE',
              reasonMessage: 'Exchange service temporarily unavailable, please retry later',
              retryable: true,
            },
          })
        }
      }
    }

    return {
      config: {
        ...config,
        spotEnabled,
        futuresEnabled,
      },
      lastValidatedAt: new Date(),
    }
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
    existingConfig?: BinanceConfig | OkxConfig | HyperliquidConfig,
  ): BinanceConfig | OkxConfig | HyperliquidConfig {
    if (dto.exchangeId === 'binance')
      return this.buildBinanceConfig(dto, existingConfig as BinanceConfig | undefined)
    if (dto.exchangeId === 'okx')
      return this.buildOkxConfig(dto, existingConfig as OkxConfig | undefined)
    if (dto.exchangeId === 'hyperliquid')
      return this.buildHyperliquidConfig(dto, existingConfig as HyperliquidConfig | undefined)
    throw new InvalidExchangeAccountConfigException({ exchangeId: dto.exchangeId })
  }

  private resolveExistingConfigForCreate(
    dto: CreateExchangeAccountDto,
    existing: ExchangeAccount | null,
  ): BinanceConfig | OkxConfig | HyperliquidConfig | undefined {
    if (!existing || this.hasCompleteCredentialInput(dto))
      return undefined

    try {
      return this.decryptConfig(existing)
    }
    catch {
      return undefined
    }
  }

  private hasCompleteCredentialInput(dto: CreateExchangeAccountDto): boolean {
    if (dto.exchangeId === 'binance') {
      return this.hasNonEmptyInput(dto.apiKey)
        && this.hasNonEmptyInput(dto.apiSecret)
    }

    if (dto.exchangeId === 'okx') {
      return this.hasNonEmptyInput(dto.apiKey)
        && this.hasNonEmptyInput(dto.apiSecret)
        && this.hasNonEmptyInput(dto.passphrase)
    }

    if (dto.exchangeId === 'hyperliquid') {
      return this.hasNonEmptyInput(dto.mainWalletAddress)
        && this.hasNonEmptyInput(dto.agentPrivateKey)
    }

    return false
  }

  private hasNonEmptyInput(value: string | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0
  }

  private pickNonEmptyInput(value: string | undefined, fallback: string | undefined): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0)
      return value.trim()
    return fallback
  }

  private buildBinanceConfig(
    dto: CreateExchangeAccountDto,
    existingConfig?: BinanceConfig,
  ): BinanceConfig {
    const apiKey = this.pickNonEmptyInput(dto.apiKey, existingConfig?.apiKey)
    const apiSecret = this.pickNonEmptyInput(dto.apiSecret, existingConfig?.secret)
    if (!apiKey || !apiSecret)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'binance' })

    return {
      apiKey,
      secret: apiSecret,
      isTestnet: dto.isTestnet,
      spotEnabled: existingConfig?.spotEnabled,
      futuresEnabled: existingConfig?.futuresEnabled,
    }
  }

  private buildOkxConfig(
    dto: CreateExchangeAccountDto,
    existingConfig?: OkxConfig,
  ): OkxConfig {
    const apiKey = this.pickNonEmptyInput(dto.apiKey, existingConfig?.apiKey)
    const apiSecret = this.pickNonEmptyInput(dto.apiSecret, existingConfig?.secret)
    const passphrase = this.pickNonEmptyInput(dto.passphrase, existingConfig?.passphrase)
    if (!apiKey || !apiSecret || !passphrase)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'okx' })

    return {
      apiKey,
      secret: apiSecret,
      passphrase,
      isTestnet: dto.isTestnet,
    }
  }

  private buildHyperliquidConfig(
    dto: CreateExchangeAccountDto,
    existingConfig?: HyperliquidConfig,
  ): HyperliquidConfig {
    const mainWalletAddress = this.pickNonEmptyInput(dto.mainWalletAddress, existingConfig?.mainWalletAddress)
    const agentPrivateKey = this.pickNonEmptyInput(dto.agentPrivateKey, existingConfig?.agentPrivateKey)
    if (!mainWalletAddress || !agentPrivateKey)
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })

    // 严格验证格式（防御性编程，即使 DTO 层已验证）
    const addressRegex = /^0x[0-9a-fA-F]{40}$/
    const privateKeyRegex = /^0x[0-9a-fA-F]{64}$/

    if (!addressRegex.test(mainWalletAddress)) {
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })
    }

    if (!privateKeyRegex.test(agentPrivateKey)) {
      throw new InvalidExchangeAccountConfigException({ exchangeId: 'hyperliquid' })
    }

    return {
      mainWalletAddress,
      agentPrivateKey,
      // 将 isTestnet 标志透传到 HyperliquidConfig，便于客户端按账户维度选择测试网/主网
      isTestnet: dto.isTestnet ?? false,
    }
  }
}
