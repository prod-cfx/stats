import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ExchangeId } from '../core/types'
import type { BinanceConfig, ExchangeAccountConfig, ExchangeAccountStore, HyperliquidConfig, OkxConfig } from './account-store'
import type { PrismaClient, ExchangeId as PrismaExchangeId } from '@/prisma/prisma.types'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Inject, Injectable } from '@nestjs/common'

import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { InvalidExchangeAccountConfigException } from '@/modules/exchange-accounts/exceptions/invalid-exchange-account-config.exception'

@Injectable()
export class DbExchangeAccountStore implements ExchangeAccountStore {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
    @Inject(ConfigCryptoService)
    private readonly crypto: ConfigCryptoService,
  ) {}

  async getAccountConfig(userId: string, exchangeId: ExchangeId): Promise<ExchangeAccountConfig | null> {
    const account = await this.txHost.tx.exchangeAccount.findFirst({
      where: {
        userId,
        exchangeId: exchangeId as PrismaExchangeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!account)
      return null

    return this.decryptAndBuildConfig(account)
  }

  async getAccountConfigById(accountId: string, userId: string): Promise<ExchangeAccountConfig | null> {
    const account = await this.txHost.tx.exchangeAccount.findFirst({
      where: {
        id: accountId,
        userId,
      },
    })

    if (!account)
      return null

    return this.decryptAndBuildConfig(account)
  }

  private decryptAndBuildConfig(account: { id: string; exchangeId: PrismaExchangeId; encryptedConfig: string; isTestnet: boolean }): ExchangeAccountConfig {
    const exchangeId = account.exchangeId as ExchangeId
    const decrypted = this.crypto.decryptConfig<unknown>(account.encryptedConfig)
    // 兼容历史数据：
    // - 旧的 Hyperliquid 加密配置中不包含 isTestnet 字段
    // - 网络环境信息保存在 exchange_accounts.is_testnet 列
    // 因此当解密结果中缺少 isTestnet 时，使用 account.isTestnet 进行回填
    // 确保 HyperliquidClient 始终能按账户维度选择正确的网络（测试网 / 主网）
    if (exchangeId === 'hyperliquid' && this.isHyperliquidConfig(decrypted)) {
      const config: HyperliquidConfig = {
        ...decrypted,
        isTestnet: (decrypted as HyperliquidConfig).isTestnet ?? account.isTestnet,
      }
      return { exchangeId: 'hyperliquid', config }
    }

    return this.toExchangeAccountConfig(exchangeId, decrypted)
  }

  private toExchangeAccountConfig(exchangeId: ExchangeId, rawConfig: unknown): ExchangeAccountConfig {
    if (exchangeId === 'binance' && this.isBinanceConfig(rawConfig))
      return { exchangeId: 'binance', config: rawConfig }
    if (exchangeId === 'okx' && this.isOkxConfig(rawConfig))
      return { exchangeId: 'okx', config: rawConfig }
    if (exchangeId === 'hyperliquid' && this.isHyperliquidConfig(rawConfig))
      return { exchangeId: 'hyperliquid', config: rawConfig }

    throw new InvalidExchangeAccountConfigException({ exchangeId })
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private isBinanceConfig(value: unknown): value is BinanceConfig {
    if (!this.isRecord(value))
      return false
    return typeof value.apiKey === 'string' && typeof value.secret === 'string'
  }

  private isOkxConfig(value: unknown): value is OkxConfig {
    if (!this.isRecord(value))
      return false
    return typeof value.apiKey === 'string' && typeof value.secret === 'string' && typeof value.passphrase === 'string'
  }

  private isHyperliquidConfig(value: unknown): value is HyperliquidConfig {
    if (!this.isRecord(value))
      return false
    return typeof value.mainWalletAddress === 'string' && typeof value.agentPrivateKey === 'string'
  }
}
