import type { PrismaClient } from '@prisma/client'

/**
 * 订单薄配置种子数据
 * 
 * 该 seed 会创建一些常用的交易对配置，用于开发和测试环境
 */
export async function seedOrderbookConfigs(prisma: PrismaClient) {
  console.log('🌱 Seeding orderbook configs...')

  const configs = [
    // Binance 现货
    {
      pairId: 'BTCUSDT.BINANCE.SPOT',
      venue: 'BINANCE',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: 'CEX',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 10,
      depthLevels: 20,
      pullIntervalSeconds: 5,
      description: 'Bitcoin/USDT spot trading pair on Binance',
    },
    {
      pairId: 'ETHUSDT.BINANCE.SPOT',
      venue: 'BINANCE',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: 'CEX',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 20,
      depthLevels: 20,
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
      venueType: 'CEX',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 15,
      depthLevels: 20,
      pullIntervalSeconds: 3,
      description: 'Bitcoin/USDT perpetual contract on Binance',
    },
    // OKX 现货
    {
      pairId: 'BTCUSDT.OKX.SPOT',
      venue: 'OKX',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      venueType: 'CEX',
      instrumentType: 'SPOT',
      enabled: false, // 默认禁用，需要手动启用
      priority: 50,
      depthLevels: 20,
      pullIntervalSeconds: 10,
      description: 'Bitcoin/USDT spot trading pair on OKX',
    },
    {
      pairId: 'ETHUSDT.OKX.SPOT',
      venue: 'OKX',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      venueType: 'CEX',
      instrumentType: 'SPOT',
      enabled: false,
      priority: 60,
      depthLevels: 20,
      pullIntervalSeconds: 10,
      description: 'Ethereum/USDT spot trading pair on OKX',
    },
  ]

  let createdCount = 0
  let skippedCount = 0

  for (const config of configs) {
    try {
      await prisma.orderbookPairConfig.upsert({
        where: { pairId: config.pairId },
        update: {}, // 如果已存在则不更新
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

