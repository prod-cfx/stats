import { createDecipheriv } from 'node:crypto'

import {
  buildFixedBinanceTestnetPlan,
  encryptExchangeAccountConfig,
  readFixedBinanceTestnetSeedConfig,
} from './fixed-binance-testnet'

describe('fixedBinanceTestnetSeed', () => {
  it('returns null when bootstrap flag is disabled', () => {
    const config = readFixedBinanceTestnetSeedConfig({
      QUANTIFY_FIXED_BINANCE_TESTNET_ENABLED: 'false',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_KEY: 'ignored',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_SECRET: 'ignored',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_KEY: 'ignored',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_SECRET: 'ignored',
    })

    expect(config).toBeNull()
  })

  it('builds dedicated spot/perp binance testnet accounts and binds each instance to the right account', () => {
    const config = readFixedBinanceTestnetSeedConfig({
      QUANTIFY_FIXED_BINANCE_TESTNET_ENABLED: 'true',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_KEY: 'test-spot-api-key',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_SECRET: 'test-spot-api-secret',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_KEY: 'test-perp-api-key',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_SECRET: 'test-perp-api-secret',
      QUANTIFY_FIXED_BINANCE_TESTNET_INITIAL_BALANCE: '10',
      QUANTIFY_FIXED_BINANCE_TESTNET_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_BINANCE_TESTNET_QUOTE_ASSET: 'usdt',
    })

    expect(config).not.toBeNull()

    const plan = buildFixedBinanceTestnetPlan(config!)

    expect(plan.user.email).toBe('binance-testnet-fixed@local.dev')
    expect(plan.exchangeAccounts.map(account => account.name)).toEqual([
      'binance-testnet-spot',
      'binance-testnet-perp',
    ])
    expect(plan.exchangeAccounts.map(account => account.config.apiKey)).toEqual([
      'test-spot-api-key',
      'test-perp-api-key',
    ])
    expect(plan.exchangeAccounts.map(account => account.config.spotEnabled)).toEqual([true, false])
    expect(plan.exchangeAccounts.map(account => account.config.futuresEnabled)).toEqual([false, true])
    expect(plan.symbols.map(symbol => symbol.code)).toEqual(['BTCUSDT', 'XRPUSDT:PERP'])
    expect(plan.symbols.map(symbol => symbol.precisionQuantity)).toEqual([6, 1])
    expect(plan.instances.map(instance => instance.name)).toEqual([
      'fixed-binance-btcusdt-spot',
      'fixed-binance-xrpusdt-perp',
    ])
    expect(plan.instances.map(instance => instance.metadata.allowedSymbols)).toEqual([
      ['BTCUSDT'],
      ['XRPUSDT:PERP'],
    ])
    expect(plan.instances.map(instance => instance.exchangeAccountName)).toEqual([
      'binance-testnet-spot',
      'binance-testnet-perp',
    ])
    expect(plan.strategyAccount.initialBalance).toBe('10')
  })

  it('supports a separate perp base asset so 10U testnet runs do not depend on BTC perp sizing', () => {
    const config = readFixedBinanceTestnetSeedConfig({
      QUANTIFY_FIXED_BINANCE_TESTNET_ENABLED: 'true',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_KEY: 'test-spot-api-key',
      QUANTIFY_FIXED_BINANCE_SPOT_TESTNET_API_SECRET: 'test-spot-api-secret',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_KEY: 'test-perp-api-key',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_API_SECRET: 'test-perp-api-secret',
      QUANTIFY_FIXED_BINANCE_TESTNET_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_BINANCE_PERP_TESTNET_BASE_ASSET: 'xrp',
      QUANTIFY_FIXED_BINANCE_TESTNET_QUOTE_ASSET: 'usdt',
    })

    const plan = buildFixedBinanceTestnetPlan(config!)

    expect(plan.symbols.map(symbol => symbol.code)).toEqual(['BTCUSDT', 'XRPUSDT:PERP'])
    expect(plan.instances.map(instance => instance.name)).toEqual([
      'fixed-binance-btcusdt-spot',
      'fixed-binance-xrpusdt-perp',
    ])
    expect(plan.instances.map(instance => instance.metadata.allowedSymbols)).toEqual([
      ['BTCUSDT'],
      ['XRPUSDT:PERP'],
    ])
    expect(plan.strategy.name).toBe('FIXED-BINANCE-TESTNET-BTCUSDT')
  })

  it('encrypts binance account config with the shared exchange account key format', () => {
    const cipherText = encryptExchangeAccountConfig(
      {
        apiKey: 'test-api-key',
        secret: 'test-api-secret',
        isTestnet: true,
        spotEnabled: true,
        futuresEnabled: true,
      },
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    )

    const buffer = Buffer.from(cipherText, 'base64')
    const iv = buffer.subarray(0, 12)
    const authTag = buffer.subarray(12, 28)
    const encrypted = buffer.subarray(28)

    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'),
      iv,
    )
    decipher.setAuthTag(authTag)

    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')

    expect(JSON.parse(plain)).toEqual({
      apiKey: 'test-api-key',
      secret: 'test-api-secret',
      isTestnet: true,
      spotEnabled: true,
      futuresEnabled: true,
    })
  })
})
