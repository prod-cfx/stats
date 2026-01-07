import type { PrismaClient } from '@prisma/client'

/**
 * 交易记录订阅配置种子数据
 * 
 * 该 seed 会创建一些常用的交易对配置，用于开发和测试环境
 */
export async function seedTradesConfigs(prisma: PrismaClient) {
  console.log('🌱 Seeding trades configs...')

  const configs = [
    // OKX 现货
    {
      pairId: 'BTC-USDT.OKX.SPOT',
      exchange: 'OKX',
      symbol: 'BTC-USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 10,
      metadata: {
        okxInstId: 'BTC-USDT',
      },
      description: 'BTC/USDT spot trading pair on OKX',
    },
    {
      pairId: 'ETH-USDT.OKX.SPOT',
      exchange: 'OKX',
      symbol: 'ETH-USDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 20,
      metadata: {
        okxInstId: 'ETH-USDT',
      },
      description: 'ETH/USDT spot trading pair on OKX',
    },
    {
      pairId: 'SOL-USDT.OKX.SPOT',
      exchange: 'OKX',
      symbol: 'SOL-USDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 30,
      metadata: {
        okxInstId: 'SOL-USDT',
      },
      description: 'SOL/USDT spot trading pair on OKX',
    },
    // OKX 永续合约
    {
      pairId: 'BTC-USDT-SWAP.OKX.PERPETUAL',
      exchange: 'OKX',
      symbol: 'BTC-USDT-SWAP',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 15,
      metadata: {
        okxInstId: 'BTC-USDT-SWAP',
      },
      description: 'BTC/USDT perpetual contract on OKX',
    },
    {
      pairId: 'ETH-USDT-SWAP.OKX.PERPETUAL',
      exchange: 'OKX',
      symbol: 'ETH-USDT-SWAP',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 25,
      metadata: {
        okxInstId: 'ETH-USDT-SWAP',
      },
      description: 'ETH/USDT perpetual contract on OKX',
    },
    {
      pairId: 'SOL-USDT-SWAP.OKX.PERPETUAL',
      exchange: 'OKX',
      symbol: 'SOL-USDT-SWAP',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 35,
      metadata: {
        okxInstId: 'SOL-USDT-SWAP',
      },
      description: 'SOL/USDT perpetual contract on OKX',
    },
  ]

  let createdCount = 0
  let skippedCount = 0

  for (const config of configs) {
    try {
      await prisma.tradesPairConfig.upsert({
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

  console.log(`✅ Trades configs seeded: ${createdCount} created, ${skippedCount} skipped`)
}


