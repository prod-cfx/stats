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

  it('builds a hyperliquid plan for spot and perp strategy', () => {
    const config = readFixedHyperliquidTestnetSeedConfig({
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS: 'wallet',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY: 'agent',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_SPOT_BASE_ASSET: 'purr',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_PERP_BASE_ASSET: 'btc',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'usdc',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_INITIAL_BALANCE: '1000',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_EMAIL: 'hyperliquid-testnet-fixed@local.dev',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_USER_NICKNAME: 'Hyperliquid Fixed',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_OPERATOR_ID: 'system-fixed-hyperliquid-seed',
    })

    expect(config).not.toBeNull()

    const plan = buildFixedHyperliquidTestnetPlan(config!)

    expect(plan.user.email).toBe('hyperliquid-testnet-fixed@local.dev')
    expect(plan.symbols.map(symbol => symbol.code)).toEqual(['PURRUSDC', 'BTCUSDC:PERP'])
    expect(plan.exchangeAccount.name).toBe('hyperliquid-testnet-perp')
    expect(plan.exchangeAccount.config.mainWalletAddress).toBe('wallet')
    expect(plan.strategy.name).toMatch(/HYPERLIQUID/)
    expect(plan.strategy.allowedSymbols).toEqual(['PURRUSDC', 'BTCUSDC:PERP'])
    expect(plan.strategyAccount.initialBalance).toBe('1000')
    expect(plan.symbols[0]).toMatchObject({
      code: 'PURRUSDC',
      precisionQuantity: 0,
      lotSize: '1',
    })
    expect(plan.instances.map(instance => instance.name)).toEqual([
      'fixed-hyperliquid-purrusdc-spot',
      'fixed-hyperliquid-btcusdc-perp',
    ])
    expect(plan.instances.map(instance => instance.metadata.allowedSymbols)).toEqual([
      ['PURRUSDC'],
      ['BTCUSDC:PERP'],
    ])
  })

  it('falls back to the legacy base asset when new market-specific assets are missing', () => {
    const config = readFixedHyperliquidTestnetSeedConfig({
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS: 'wallet',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY: 'agent',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET: 'eth',
      QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'usdc',
    })

    expect(config).not.toBeNull()
    expect(config).toMatchObject({
      spotBaseAsset: 'ETH',
      perpBaseAsset: 'ETH',
      quoteAsset: 'USDC',
    })
  })

  it('fails fast when both market-specific and legacy base assets are missing', () => {
    expect(() =>
      readFixedHyperliquidTestnetSeedConfig({
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_ENABLED: 'true',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_MAIN_WALLET_ADDRESS: 'wallet',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_AGENT_PRIVATE_KEY: 'agent',
        QUANTIFY_FIXED_HYPERLIQUID_TESTNET_QUOTE_ASSET: 'usdc',
      }),
    ).toThrow(
      '[fixed-hyperliquid-testnet] Missing required environment variable: QUANTIFY_FIXED_HYPERLIQUID_TESTNET_SPOT_BASE_ASSET or QUANTIFY_FIXED_HYPERLIQUID_TESTNET_BASE_ASSET',
    )
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
