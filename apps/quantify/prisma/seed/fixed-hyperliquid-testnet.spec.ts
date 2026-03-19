import { createDecipheriv } from 'node:crypto'

import {
  buildFixedHyperliquidTestnetPlan,
  encryptExchangeAccountConfig,
  readFixedHyperliquidTestnetSeedConfig,
} from './fixed-hyperliquid-testnet'

describe('fixedHyperliquidTestnetSeed', () => {
  it('returns null when the bootstrap flag is not enabled', () => {
    const config = readFixedHyperliquidTestnetSeedConfig({
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'false',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS: 'ignored',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY: 'ignored',
    })

    expect(config).toBeNull()
  })

  it('builds a hyperliquid plan for perp-only strategy', () => {
    const config = readFixedHyperliquidTestnetSeedConfig({
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS: 'wallet',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY: 'agent',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'usdc',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_INITIAL_BALANCE: '1000',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL: 'hyperliquid-testnet-fixed@local.dev',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_NICKNAME: 'Hyperliquid Fixed',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_OPERATOR_ID: 'system-fixed-hyperliquid-seed',
    })

    expect(config).not.toBeNull()

    const plan = buildFixedHyperliquidTestnetPlan(config!)

    expect(plan.user.email).toBe('hyperliquid-testnet-fixed@local.dev')
    expect(plan.symbol.code).toBe('BTCUSDC:PERP')
    expect(plan.exchangeAccount.name).toBe('hyperliquid-testnet-perp')
    expect(plan.exchangeAccount.config.mainWalletAddress).toBe('wallet')
    expect(plan.strategy.name).toMatch(/HYPERLIQUID/)
    expect(plan.strategy.allowedSymbols).toEqual(['BTCUSDC:PERP'])
    expect(plan.strategyAccount.initialBalance).toBe('1000')
    expect(plan.instance.metadata.allowedSymbols).toEqual(['BTCUSDC:PERP'])
    expect(plan.instance.metadata.allowedTimeframes).toEqual(['1m', '5m', '15m', '1h'])
  })

  it('encrypts exchange account configs with the shared AES format', () => {
    const cipherText = encryptExchangeAccountConfig(
      {
        mainWalletAddress: 'wallet',
        agentPrivateKey: 'agent',
        isTestnet: true,
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
      mainWalletAddress: 'wallet',
      agentPrivateKey: 'agent',
      isTestnet: true,
    })
  })
})
