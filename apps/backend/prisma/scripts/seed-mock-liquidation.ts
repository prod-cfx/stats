import * as path from 'path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { createEnvAccessor } from '../../src/common/env/env.accessor'

// Load env
const rootDir = path.resolve(__dirname, '../../../../')
loadEnvironment({ basePath: rootDir })

const env = createEnvAccessor()
const dbUrl = env.str('DATABASE_URL')

if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('❌ DATABASE_URL invalid')
  process.exit(1)
}

const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('开始填充模拟爆仓数据...')

  // Clear existing mock data first to avoid duplicates
  await prisma.aggregatedLiquidationHistory.deleteMany({
    where: { source: 'MOCK' }
  })
  console.log('已清理旧的模拟数据')

  const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE']
  const intervals = ['1h', '4h', '12h', '24h']
  const exchanges = ['Binance', 'OKX', 'Bybit', 'Bitget', 'HTX', 'Hyperliquid', 'Aster', 'Lighter', 'MEXC']
  
  const now = new Date()
  // Align timestamp to nearest hour
  now.setMinutes(0, 0, 0)

  const mockData = []

  for (const symbol of symbols) {
    for (const interval of intervals) {
      // Create AGGREGATED row
      let totalLong = 0
      let totalShort = 0

      // Create exchange rows
      for (const exchange of exchanges) {
        // Random amounts between 10k and 1M
        const longAmount = Math.random() * 1000000 + 10000
        const shortAmount = Math.random() * 1000000 + 10000
        
        totalLong += longAmount
        totalShort += shortAmount

        mockData.push({
          symbol,
          exchangeCode: exchange,
          interval,
          timestamp: now,
          longLiquidationUsd: longAmount,
          shortLiquidationUsd: shortAmount,
          source: 'MOCK'
        })
      }

      // Add AGGREGATED row
      mockData.push({
        symbol,
        exchangeCode: 'AGGREGATED',
        interval,
        timestamp: now,
        longLiquidationUsd: totalLong,
        shortLiquidationUsd: totalShort,
        source: 'MOCK'
      })
    }
  }

  console.log(`准备插入 ${mockData.length} 条模拟数据...`)

  // Batch insert
  await prisma.aggregatedLiquidationHistory.createMany({
    data: mockData,
    skipDuplicates: true,
  })

  console.log('模拟数据填充完成 ✅')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
