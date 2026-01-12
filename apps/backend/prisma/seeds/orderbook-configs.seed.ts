import { InstrumentType, type PrismaClient, VenueType } from '@prisma/client'

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

