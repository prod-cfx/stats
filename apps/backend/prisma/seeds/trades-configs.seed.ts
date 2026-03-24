import { BackendInstrumentType } from '@ai/shared'
import type { PrismaClient } from '../../generated/prisma'

/**
 * 交易记录订阅配置种子数据
 *
 * 该 seed 会创建一些常用的交易对配置，用于开发和测试环境
 */
export async function seedTradesConfigs(prisma: PrismaClient) {
  console.log('🌱 Seeding trades configs...')

  const configs = [
    // Hyperliquid 永续合约 - Top 10 主流币种
    {
      pairId: 'BTC.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'BTC-USD',
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 1,
      metadata: {
        hyperliquidCoin: 'BTC',
      },
      description: 'BTC perpetual contract on Hyperliquid',
    },
    {
      pairId: 'ETH.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'ETH-USD',
      baseAsset: 'ETH',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 2,
      metadata: {
        hyperliquidCoin: 'ETH',
      },
      description: 'ETH perpetual contract on Hyperliquid',
    },
    {
      pairId: 'SOL.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'SOL-USD',
      baseAsset: 'SOL',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 3,
      metadata: {
        hyperliquidCoin: 'SOL',
      },
      description: 'SOL perpetual contract on Hyperliquid',
    },
    {
      pairId: 'ARB.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'ARB-USD',
      baseAsset: 'ARB',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 4,
      metadata: {
        hyperliquidCoin: 'ARB',
      },
      description: 'ARB perpetual contract on Hyperliquid',
    },
    {
      pairId: 'AVAX.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'AVAX-USD',
      baseAsset: 'AVAX',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 5,
      metadata: {
        hyperliquidCoin: 'AVAX',
      },
      description: 'AVAX perpetual contract on Hyperliquid',
    },
    {
      pairId: 'MATIC.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'MATIC-USD',
      baseAsset: 'MATIC',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 6,
      metadata: {
        hyperliquidCoin: 'MATIC',
      },
      description: 'MATIC perpetual contract on Hyperliquid',
    },
    {
      pairId: 'DOGE.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'DOGE-USD',
      baseAsset: 'DOGE',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 7,
      metadata: {
        hyperliquidCoin: 'DOGE',
      },
      description: 'DOGE perpetual contract on Hyperliquid',
    },
    {
      pairId: 'OP.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'OP-USD',
      baseAsset: 'OP',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 8,
      metadata: {
        hyperliquidCoin: 'OP',
      },
      description: 'OP perpetual contract on Hyperliquid',
    },
    {
      pairId: 'SUI.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'SUI-USD',
      baseAsset: 'SUI',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 9,
      metadata: {
        hyperliquidCoin: 'SUI',
      },
      description: 'SUI perpetual contract on Hyperliquid',
    },
    {
      pairId: 'WIF.HYPERLIQUID.PERPETUAL',
      exchange: 'HYPERLIQUID',
      symbol: 'WIF-USD',
      baseAsset: 'WIF',
      quoteAsset: 'USD',
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 10,
      metadata: {
        hyperliquidCoin: 'WIF',
      },
      description: 'WIF perpetual contract on Hyperliquid',
    },
    // OKX 现货
    {
      pairId: 'BTC-USDT.OKX.SPOT',
      exchange: 'OKX',
      symbol: 'BTC-USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      instrumentType: BackendInstrumentType.SPOT,
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
      instrumentType: BackendInstrumentType.SPOT,
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
      instrumentType: BackendInstrumentType.SPOT,
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
      instrumentType: BackendInstrumentType.PERPETUAL,
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
      instrumentType: BackendInstrumentType.PERPETUAL,
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
      instrumentType: BackendInstrumentType.PERPETUAL,
      enabled: true,
      priority: 35,
      metadata: {
        okxInstId: 'SOL-USDT-SWAP',
      },
      description: 'SOL/USDT perpetual contract on OKX',
    },
    // Binance 现货
    {
      pairId: 'BTCUSDT.BINANCE.SPOT',
      exchange: 'BINANCE',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 10,
      metadata: {
        binanceSymbol: 'BTCUSDT',
      },
      description: 'BTC/USDT spot trading pair on Binance',
    },
    {
      pairId: 'ETHUSDT.BINANCE.SPOT',
      exchange: 'BINANCE',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 20,
      metadata: {
        binanceSymbol: 'ETHUSDT',
      },
      description: 'ETH/USDT spot trading pair on Binance',
    },
    {
      pairId: 'SOLUSDT.BINANCE.SPOT',
      exchange: 'BINANCE',
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 30,
      metadata: {
        binanceSymbol: 'SOLUSDT',
      },
      description: 'SOL/USDT spot trading pair on Binance',
    },
    {
      pairId: 'XRPUSDT.BINANCE.SPOT',
      exchange: 'BINANCE',
      symbol: 'XRPUSDT',
      baseAsset: 'XRP',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 40,
      metadata: {
        binanceSymbol: 'XRPUSDT',
      },
      description: 'XRP/USDT spot trading pair on Binance',
    },
    {
      pairId: 'DOGEUSDT.BINANCE.SPOT',
      exchange: 'BINANCE',
      symbol: 'DOGEUSDT',
      baseAsset: 'DOGE',
      quoteAsset: 'USDT',
      instrumentType: 'SPOT',
      enabled: true,
      priority: 50,
      metadata: {
        binanceSymbol: 'DOGEUSDT',
      },
      description: 'DOGE/USDT spot trading pair on Binance',
    },
    // Binance 永续合约
    {
      pairId: 'BTCUSDT.BINANCE.PERPETUAL',
      exchange: 'BINANCE',
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 15,
      metadata: {
        binanceSymbol: 'BTCUSDT',
      },
      description: 'BTC/USDT perpetual contract on Binance',
    },
    {
      pairId: 'ETHUSDT.BINANCE.PERPETUAL',
      exchange: 'BINANCE',
      symbol: 'ETHUSDT',
      baseAsset: 'ETH',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 25,
      metadata: {
        binanceSymbol: 'ETHUSDT',
      },
      description: 'ETH/USDT perpetual contract on Binance',
    },
    {
      pairId: 'SOLUSDT.BINANCE.PERPETUAL',
      exchange: 'BINANCE',
      symbol: 'SOLUSDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 35,
      metadata: {
        binanceSymbol: 'SOLUSDT',
      },
      description: 'SOL/USDT perpetual contract on Binance',
    },
    {
      pairId: 'XRPUSDT.BINANCE.PERPETUAL',
      exchange: 'BINANCE',
      symbol: 'XRPUSDT',
      baseAsset: 'XRP',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 45,
      metadata: {
        binanceSymbol: 'XRPUSDT',
      },
      description: 'XRP/USDT perpetual contract on Binance',
    },
    {
      pairId: 'DOGEUSDT.BINANCE.PERPETUAL',
      exchange: 'BINANCE',
      symbol: 'DOGEUSDT',
      baseAsset: 'DOGE',
      quoteAsset: 'USDT',
      instrumentType: 'PERPETUAL',
      enabled: true,
      priority: 55,
      metadata: {
        binanceSymbol: 'DOGEUSDT',
      },
      description: 'DOGE/USDT perpetual contract on Binance',
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

