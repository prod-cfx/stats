import { InstrumentType, type PrismaClient, VenueType } from '../../generated/prisma'

/**
 * 订单薄配置种子数据
 * 
 * 该 seed 会创建一些常用的交易对配置，用于开发和测试环境
 */
export async function seedOrderbookConfigs(prisma: PrismaClient) {
  console.log('🌱 Seeding orderbook configs...')

  const configs = [
    // ========== Binance ==========
    // Binance 现货
    {
      pairId: 'BTCUSDT.BINANCE.SPOT',
      venue: 'BINANCE',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 10,
      depthLevels: 500, // BTC 需要更深的档位以覆盖更大价格范围
      pullIntervalSeconds: 5,
      description: 'Bitcoin/USDT spot trading pair on Binance',
    },
    {
      pairId: 'ETHUSDT.BINANCE.SPOT',
      venue: 'BINANCE',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 20,
      depthLevels: 500,
      pullIntervalSeconds: 5,
      description: 'Ethereum/USDT spot trading pair on Binance',
    },
    // Binance 永续合约
    {
      pairId: 'BTCUSDT.BINANCE.PERPETUAL',
      venue: 'BINANCE',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 15,
      depthLevels: 500, // BTC 需要更深的档位以覆盖更大价格范围
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USDT perpetual contract on Binance',
    },
    {
      pairId: 'ETHUSDT.BINANCE.PERPETUAL',
      venue: 'BINANCE',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 25,
      depthLevels: 500,
      pullIntervalSeconds: 3,
      description: 'Ethereum/USDT perpetual contract on Binance',
    },
    // ========== OKX ==========
    // 注：OKX API 在中国可能被墙，需要代理才能访问
    // OKX 现货
    {
      pairId: 'BTCUSDT.OKX.SPOT',
      venue: 'OKX',
      symbol: 'BTC-USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: false, // 暂时禁用，需要代理
      priority: 50,
      depthLevels: 100,
      pullIntervalSeconds: 5,
      description: 'Bitcoin/USDT spot trading pair on OKX',
    },
    {
      pairId: 'ETHUSDT.OKX.SPOT',
      venue: 'OKX',
      symbol: 'ETH-USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: false, // 暂时禁用，需要代理
      priority: 60,
      depthLevels: 100,
      pullIntervalSeconds: 5,
      description: 'Ethereum/USDT spot trading pair on OKX',
    },
    // OKX 永续合约
    {
      pairId: 'BTCUSDT.OKX.PERPETUAL',
      venue: 'OKX',
      symbol: 'BTC-USDT-SWAP',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: false, // 暂时禁用，需要代理
      priority: 55,
      depthLevels: 100,
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USDT perpetual contract on OKX',
    },
    {
      pairId: 'ETHUSDT.OKX.PERPETUAL',
      venue: 'OKX',
      symbol: 'ETH-USDT-SWAP',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: false, // 暂时禁用，需要代理
      priority: 65,
      depthLevels: 100,
      pullIntervalSeconds: 3,
      description: 'Ethereum/USDT perpetual contract on OKX',
    },
    // ========== Bybit ==========
    // Bybit 现货 (Bybit 最大支持 200 档)
    {
      pairId: 'BTCUSDT.BYBIT.SPOT',
      venue: 'BYBIT',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 70,
      depthLevels: 200,
      pullIntervalSeconds: 5,
      description: 'Bitcoin/USDT spot trading pair on Bybit',
    },
    {
      pairId: 'ETHUSDT.BYBIT.SPOT',
      venue: 'BYBIT',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 80,
      depthLevels: 200,
      pullIntervalSeconds: 5,
      description: 'Ethereum/USDT spot trading pair on Bybit',
    },
    // Bybit 永续合约
    {
      pairId: 'BTCUSDT.BYBIT.PERPETUAL',
      venue: 'BYBIT',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 75,
      depthLevels: 200,
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USDT perpetual contract on Bybit',
    },
    {
      pairId: 'ETHUSDT.BYBIT.PERPETUAL',
      venue: 'BYBIT',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 85,
      depthLevels: 200,
      pullIntervalSeconds: 3,
      description: 'Ethereum/USDT perpetual contract on Bybit',
    },
    // Bybit 期货（反向合约）
    {
      pairId: 'BTCUSD.BYBIT.FUTURE',
      venue: 'BYBIT',
      symbol: 'BTCUSD',
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.FUTURE,
      enabled: true,
      priority: 76,
      depthLevels: 200,
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USD inverse futures contract on Bybit',
    },
    {
      pairId: 'ETHUSD.BYBIT.FUTURE',
      venue: 'BYBIT',
      symbol: 'ETHUSD',
      baseAsset: 'ETH',
      quoteAsset: 'USD',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.FUTURE,
      enabled: true,
      priority: 86,
      depthLevels: 200,
      pullIntervalSeconds: 3,
      description: 'Ethereum/USD inverse futures contract on Bybit',
    },
    // ========== Bitmax/AscendEX ==========
    // Bitmax 现货 (symbol 格式: BTC/USDT)
    {
      pairId: 'BTCUSDT.BITMAX.SPOT',
      venue: 'BITMAX',
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 90,
      depthLevels: 100,
      pullIntervalSeconds: 5,
      description: 'Bitcoin/USDT spot trading pair on Bitmax/AscendEX',
    },
    {
      pairId: 'ETHUSDT.BITMAX.SPOT',
      venue: 'BITMAX',
      symbol: 'ETH/USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 100,
      depthLevels: 100,
      pullIntervalSeconds: 5,
      description: 'Ethereum/USDT spot trading pair on Bitmax/AscendEX',
    },
    // Bitmax 永续合约 (symbol 格式: BTC-PERP)
    {
      pairId: 'BTCUSDT.BITMAX.PERPETUAL',
      venue: 'BITMAX',
      symbol: 'BTC-PERP',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 95,
      depthLevels: 100,
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USDT perpetual contract on Bitmax/AscendEX',
    },
    {
      pairId: 'ETHUSDT.BITMAX.PERPETUAL',
      venue: 'BITMAX',
      symbol: 'ETH-PERP',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.CEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 105,
      depthLevels: 100,
      pullIntervalSeconds: 3,
      description: 'Ethereum/USDT perpetual contract on Bitmax/AscendEX',
    },
    // ========== Hyperliquid ==========
    // Hyperliquid 是 DEX，最大支持 100 档深度，每 ~0.5s 推送完整快照
    // 永续合约
    {
      pairId: 'BTCUSDT.HYPERLIQUID.PERPETUAL',
      venue: 'HYPERLIQUID',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: VenueType.DEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 110,
      depthLevels: 100,
      pullIntervalSeconds: 1,
      description: 'Bitcoin/USDT perpetual contract on Hyperliquid DEX',
    },
    {
      pairId: 'ETHUSDT.HYPERLIQUID.PERPETUAL',
      venue: 'HYPERLIQUID',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: VenueType.DEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 115,
      depthLevels: 100,
      pullIntervalSeconds: 1,
      description: 'Ethereum/USDT perpetual contract on Hyperliquid DEX',
    },
    {
      pairId: 'SOLUSDT.HYPERLIQUID.PERPETUAL',
      venue: 'HYPERLIQUID',
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      venueType: VenueType.DEX,
      instrumentType: InstrumentType.PERPETUAL,
      enabled: true,
      priority: 120,
      depthLevels: 100,
      pullIntervalSeconds: 1,
      description: 'Solana/USDT perpetual contract on Hyperliquid DEX',
    },
    // Hyperliquid 现货
    // 注意：PURR/USDC 使用 "PURR/USDC" 格式，其他币种需要使用 @{index} 格式
    // 参考: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot
    {
      pairId: 'HYPE/USDC.HYPERLIQUID.SPOT',
      venue: 'HYPERLIQUID',
      symbol: 'HYPE/USDC',
      baseAsset: 'HYPE',
      quoteAsset: 'USDC',
      venueType: VenueType.DEX,
      instrumentType: InstrumentType.SPOT,
      enabled: true,
      priority: 125,
      depthLevels: 100,
      pullIntervalSeconds: 1,
      description: 'HYPE/USDC spot trading pair on Hyperliquid DEX',
      metadata: { spotIndex: 107 }, // HYPE 在 Hyperliquid spotMeta 中的 index
    },
    {
      pairId: 'PURR/USDC.HYPERLIQUID.SPOT',
      venue: 'HYPERLIQUID',
      symbol: 'PURR/USDC',
      baseAsset: 'PURR',
      quoteAsset: 'USDC',
      venueType: VenueType.DEX,
      instrumentType: InstrumentType.SPOT,
      enabled: false, // 暂时禁用，流动性较低
      priority: 130,
      depthLevels: 100,
      pullIntervalSeconds: 1,
      description: 'PURR/USDC spot trading pair on Hyperliquid DEX',
    },
  ]

  let createdCount = 0
  let skippedCount = 0

  for (const config of configs) {
    try {
      await prisma.orderbookPairConfig.upsert({
        where: { pairId: config.pairId },
        update: {
          depthLevels: config.depthLevels,
          enabled: config.enabled,
          pullIntervalSeconds: config.pullIntervalSeconds,
        },
        create: config,
      })
      createdCount++
      console.log(`  ✓ ${config.pairId}`)
    }
    catch (error) {
      skippedCount++
      console.log(`  ⊘ ${config.pairId} (already exists or error)`)
    }
  }

  console.log(`✅ Orderbook configs seeded: ${createdCount} created, ${skippedCount} skipped`)
}
