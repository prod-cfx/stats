import type { ExchangeId as PrismaExchangeId } from '@/prisma/prisma.types'
import type { ExchangeId } from '../core/types'
import type { BinanceConfig, ExchangeAccountConfig, ExchangeAccountStore, HyperliquidConfig, OkxConfig } from './account-store'
import { Inject, Injectable } from '@nestjs/common'

import { ConfigCryptoService } from '@/common/services/config-crypto.service'
import { InvalidExchangeAccountConfigException } from '@/modules/exchange-accounts/exceptions/invalid-exchange-account-config.exception'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class DbExchangeAccountStore implements ExchangeAccountStore {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ConfigCryptoService)
    private readonly crypto: ConfigCryptoService,
  ) {}

  async getAccountConfig(userId: string, exchangeId: ExchangeId): Promise<ExchangeAccountConfig | null> {
    const account = await this.prisma.exchangeAccount.findFirst({
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
    const account = await this.prisma.exchangeAccount.findFirst({
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
    // 鍏煎鍘嗗彶鏁版嵁锛?
    // - 鏃х殑 Hyperliquid 鍔犲瘑閰嶇疆涓笉鍖呭惈 isTestnet 瀛楁
    // - 缃戠粶鐜淇℃伅淇濆瓨鍦?exchange_accounts.is_testnet 鍒?
    // 鍥犳褰撹В瀵嗙粨鏋滀腑缂哄皯 isTestnet 鏃讹紝浣跨敤 account.isTestnet 杩涜鍥炲～锛?
    // 纭繚 HyperliquidClient 濮嬬粓鑳芥寜璐︽埛缁村害閫夋嫨姝ｇ‘鐨勭綉缁滐紙娴嬭瘯缃?/ 涓荤綉锛夈€?
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
