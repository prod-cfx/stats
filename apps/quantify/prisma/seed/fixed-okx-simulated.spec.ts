import { createDecipheriv } from 'node:crypto'

import {
  buildFixedOkxSimulatedPlan,
  encryptExchangeAccountConfig,
  readFixedOkxSimulatedSeedConfig,
} from './fixed-okx-simulated'

describe('fixedOkxSimulatedSeed', () => {
  it('returns null when bootstrap flag is disabled', () => {
    const config = readFixedOkxSimulatedSeedConfig({
      QUANTIFY_FIXED_OKX_ENABLED: 'false',
      QUANTIFY_FIXED_OKX_API_KEY: 'ignored',
      QUANTIFY_FIXED_OKX_API_SECRET: 'ignored',
      QUANTIFY_FIXED_OKX_API_PASSPHRASE: 'ignored',
    })

    expect(config).toBeNull()
  })

  it('builds dedicated spot/perp okx simulated accounts and binds each instance to the right account', () => {
    const config = readFixedOkxSimulatedSeedConfig({
      QUANTIFY_FIXED_OKX_ENABLED: 'true',
      QUANTIFY_FIXED_OKX_API_KEY: 'test-okx-api-key',
      QUANTIFY_FIXED_OKX_API_SECRET: 'test-okx-api-secret',
      QUANTIFY_FIXED_OKX_API_PASSPHRASE: 'test-okx-passphrase',
      QUANTIFY_FIXED_OKX_INITIAL_BALANCE: '1000',
      QUANTIFY_FIXED_OKX_SPOT_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_OKX_PERP_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_OKX_QUOTE_ASSET: 'usdt',
      QUANTIFY_FIXED_OKX_IS_TESTNET: 'true',
    })

    expect(config).not.toBeNull()

    const plan = buildFixedOkxSimulatedPlan(config!)

    expect(plan.user.email).toBe('okx-sim-fixed@local.dev')
    expect(plan.exchangeAccounts.map(account => account.name)).toEqual([
      'okx-sim-spot',
      'okx-sim-perp',
    ])
    expect(plan.exchangeAccounts.map(account => account.config.apiKey)).toEqual([
      'test-okx-api-key',
      'test-okx-api-key',
    ])
    expect(plan.exchangeAccounts.map(account => account.config.passphrase)).toEqual([
      'test-okx-passphrase',
      'test-okx-passphrase',
    ])
    expect(plan.exchangeAccounts.map(account => account.config.isTestnet)).toEqual([true, true])
    expect(plan.symbols.map(symbol => symbol.code)).toEqual(['BTCUSDT', 'BTCUSDT:PERP'])
    expect(plan.instances.map(instance => instance.name)).toEqual([
      'fixed-okx-btcusdt-spot',
      'fixed-okx-btcusdt-perp',
    ])
    expect(plan.instances.map(instance => instance.metadata.allowedSymbols)).toEqual([
      ['BTCUSDT'],
      ['BTCUSDT:PERP'],
    ])
    expect(plan.instances.map(instance => instance.exchangeAccountName)).toEqual([
      'okx-sim-spot',
      'okx-sim-perp',
    ])
    expect(plan.strategyAccount.initialBalance).toBe('1000')
  })

  it('encrypts okx account config with the shared exchange account key format', () => {
    const cipherText = encryptExchangeAccountConfig(
      {
        apiKey: 'test-api-key',
        secret: 'test-api-secret',
        passphrase: 'test-passphrase',
        isTestnet: true,
        useUnifiedAccount: true,
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
      passphrase: 'test-passphrase',
      isTestnet: true,
      useUnifiedAccount: true,
    })
  })
})
