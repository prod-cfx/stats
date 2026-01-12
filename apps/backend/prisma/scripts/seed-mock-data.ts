import * as path from 'path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

// Load env
const rootDir = path.resolve(__dirname, '../../../../')
loadEnvironment({ basePath: rootDir })

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌ DATABASE_URL invalid')
  process.exit(1)
}

const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🚀 开始填充全量模拟数据...')

  // 1. 清理旧模拟数据
  console.log('🧹 清理旧数据...')
  await prisma.polymarketOutcome.deleteMany({})
  await prisma.polymarketMarket.deleteMany({})
  await prisma.cryptoStockQuote.deleteMany({})
  await prisma.hyperliquidWhaleAlert.deleteMany({
    where: { source: 'MOCK' }
  })

  // 2. 填充预测市场 (Polymarket)
  console.log('📦 填充 Polymarket 数据...')
  const categories = ['Crypto', 'Politics', 'Sports', 'Pop Culture']
  const questions = [
    'Will BTC hit $100k in 2026?',
    'Who will win the next election?',
    'Will ETH reach a new ATH before March?',
    'Will Hyperliquid launch its mainnet token by Q2?',
    'Will the Fed cut rates in February?'
  ]

  for (let i = 0; i < 30; i++) {
    const marketId = `poly-${i}`
    const question = questions[i % questions.length]
    const category = categories[i % categories.length]
    const prob = Math.random()
    
    await prisma.polymarketMarket.create({
      data: {
        marketId,
        question,
        category,
        slug: `market-${i}`,
        isActive: true,
        liquidity: Math.random() * 1000000 + 50000,
        volume24h: Math.random() * 500000 + 10000,
        rawPayload: {},
        outcomes: {
          create: [
            {
              outcomeTokenId: `${marketId}-yes`,
              name: 'Yes',
              price: prob,
              probability: prob,
              rawPayload: {}
            },
            {
              outcomeTokenId: `${marketId}-no`,
              name: 'No',
              price: 1 - prob,
              probability: 1 - prob,
              rawPayload: {}
            }
          ]
        }
      }
    })
  }

  // 3. 填充币股 (CryptoStockQuotes)
  console.log('📦 填充 CryptoStockQuotes 数据...')
  const stocks = [
    { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ' },
    { symbol: 'MSTR', name: 'MicroStrategy Incorporated', exchange: 'NASDAQ' },
    { symbol: 'CRCL', name: 'Circle Internet Group', exchange: 'NYSE' },
    { symbol: 'BMNR', name: 'BitMine Immersion', exchange: 'NYSE' },
    { symbol: 'BTDR', name: 'Bitdeer Technologies Group', exchange: 'NASDAQ' },
    { symbol: 'RIOT', name: 'Riot Platforms, Inc.', exchange: 'NASDAQ' },
    { symbol: 'MARA', name: 'MARA Holdings, Inc.', exchange: 'NASDAQ' }
  ]

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i]
    await prisma.cryptoStockQuote.create({
      data: {
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        source: 'BBX',
        price: Math.random() * 200 + 10,
        openPrice: Math.random() * 200 + 10,
        highPrice: Math.random() * 210 + 10,
        lowPrice: Math.random() * 190 + 10,
        priceChange: Math.random() * 10 - 5,
        priceChangePercent: Math.random() * 5 - 2.5,
        volume: Math.random() * 1000000,
        marketCap: Math.random() * 10000000000,
        quoteTimestamp: new Date(),
        mNav: Math.random() > 0.5 ? Math.random().toFixed(2) : null,
        holdingValue: Math.random() * 500000000,
        holdingQuantity: Math.random() * 10000,
        companyType: i % 2 === 0 ? 'Crypto Strategic Reserve' : 'Crypto Mining'
      }
    })
  }

  // 4. 填充巨鲸预警 (HyperliquidWhaleAlert)
  console.log('📦 填充 Whale Alert 数据...')
  const whaleAddresses = [
    '0x1234567890abcdef1234567890abcdef12345678',
    '0xabcdef1234567890abcdef1234567890abcdef12',
    '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    '0xcafebebecafebebecafebebecafebebecafebebe',
    '0x8888888888888888888888888888888888888888',
    '0x9999999999999999999999999999999999999999'
  ]
  const whaleSymbols = ['BTC', 'ETH', 'SOL', 'HYPE', 'ARB', 'SUI', 'LINK']

  for (let i = 0; i < 200; i++) {
    const address = whaleAddresses[i % whaleAddresses.length]
    const symbol = whaleSymbols[i % whaleSymbols.length]
    // 增加仓位大小，确保价值经常超过 100 万 USD
    const size = (Math.random() * 150 + 50) * (Math.random() > 0.4 ? 1 : -1) 
    const price = Math.random() * 50000 + 2000
    const value = Math.abs(size * price)
    
    // 集中在最近 24 小时内，确保“实时”页面能看到数据
    const createTime = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)

    await prisma.hyperliquidWhaleAlert.create({
      data: {
        userAddress: address,
        symbol,
        positionSize: size,
        entryPrice: price,
        liquidationPrice: price * (size > 0 ? 0.8 : 1.2),
        positionValueUsd: value,
        positionAction: i % 10 === 0 ? 2 : 1, // 10% are closures
        createTime,
        source: 'MOCK'
      }
    }).catch(() => {}) 
  }

  console.log('✅ 全量模拟数据填充完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
