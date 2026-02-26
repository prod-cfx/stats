/**
 * K线数据缺口诊断脚本
 *
 * 验证假设：
 * 1. Gap 检测使用 lastTimestamp 而非当前时间作为终点，导致检测不到最近的缺口
 * 2. API 返回空数据时 cursor 不更新，导致缺口永远不会被检测到
 *
 * 用法：
 *   npx tsx scripts/diagnose-kline-gap.ts
 */

// Prisma 7: 显式加载环境变量
import * as path from 'path'
import { loadEnvironment } from '@net/config'

const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })

// Prisma 7: 使用 Driver Adapter
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('❌ DATABASE_URL 未配置')
  process.exit(1)
}

const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const INTERVAL_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
}

// 映射 API interval 到 Prisma enum 键名 (m1/d1 等，而非数据库值 1m/1d)
// 注意：MarketTimeframe.m1 返回的是 '1m' (数据库值)，不是 'm1' (枚举键名)
// Prisma 7 查询需要枚举键名
const INTERVAL_TO_PRISMA_KEY: Record<string, string> = {
  '1m': 'm1',
  '3m': 'm3',
  '5m': 'm5',
  '15m': 'm15',
  '30m': 'm30',
  '1h': 'h1',
  '4h': 'h4',
  '6h': 'h6',
  '8h': 'h8',
  '12h': 'h12',
  '1d': 'd1',
  '1w': 'w1',
}

interface FuturesPriceCursor {
  symbol: string
  exchangeCode?: string
  contractType?: string | null
  interval: string
  lastTimestamp?: number
  backfillCompleted?: boolean
  backfillCompletedAt?: number
}

async function main() {
  console.log('=== K线数据缺口诊断 ===\n')

  // 1. 获取所有 coinglass-futures-price-history 任务
  const tasks = await prisma.dataPullTask.findMany({
    where: {
      key: {
        startsWith: 'coinglass-futures-price-history',
      },
      enabled: true,
    },
    orderBy: { key: 'asc' },
  })

  console.log(`找到 ${tasks.length} 个启用的 K线同步任务\n`)

  const now = Date.now()

  for (const task of tasks) {
    console.log(`\n--- 任务: ${task.key} ---`)
    console.log(`状态: ${task.lastStatus || 'IDLE'}`)
    console.log(`最后运行: ${task.lastRunAt?.toISOString() || '从未'}`)

    if (!task.cursor) {
      console.log('⚠️ 无 cursor（任务从未成功运行）')
      continue
    }

    let cursor: FuturesPriceCursor
    try {
      cursor = JSON.parse(task.cursor) as FuturesPriceCursor
    } catch {
      console.log(`❌ cursor 解析失败: ${task.cursor}`)
      continue
    }

    console.log(`Symbol: ${cursor.symbol}`)
    console.log(`Exchange: ${cursor.exchangeCode || 'N/A'}`)
    console.log(`Interval: ${cursor.interval}`)
    console.log(`ContractType: ${cursor.contractType ?? 'null'}`)

    if (typeof cursor.lastTimestamp !== 'number') {
      console.log('⚠️ cursor 中无 lastTimestamp')
      continue
    }

    const lastTs = cursor.lastTimestamp
    const gapMs = now - lastTs
    const intervalMs = INTERVAL_MS[cursor.interval] || 0

    console.log(`\nCursor lastTimestamp: ${new Date(lastTs).toISOString()}`)
    console.log(`当前时间: ${new Date(now).toISOString()}`)
    console.log(
      `时间差: ${Math.round(gapMs / 1000 / 60)} 分钟 (${Math.round(gapMs / intervalMs)} 个周期)`,
    )

    // 检测 lastTimestamp 之后的数据库记录
    const prismaIntervalKey = INTERVAL_TO_PRISMA_KEY[cursor.interval]
    if (!prismaIntervalKey) {
      console.log(`⚠️ 不支持的 interval: ${cursor.interval}`)
      continue
    }

    const latestRecord = await prisma.futuresPriceHistory.findFirst({
      where: {
        symbol: cursor.symbol,
        exchangeCode: cursor.exchangeCode || 'BINANCE',
        interval: prismaIntervalKey as any, // Prisma 7 需要枚举键名
        contractType: cursor.contractType ?? null,
        source: 'COINGLASS',
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    })

    if (latestRecord) {
      const dbLatestMs = latestRecord.timestamp.getTime()
      const dbGapMs = now - dbLatestMs

      console.log(`\n数据库最新记录: ${latestRecord.timestamp.toISOString()}`)
      console.log(
        `数据库延迟: ${Math.round(dbGapMs / 1000 / 60)} 分钟 (${Math.round(dbGapMs / intervalMs)} 个周期)`,
      )

      // 如果数据库最新时间比 cursor 更新，说明有数据但 cursor 没更新
      if (dbLatestMs > lastTs) {
        console.log(`\n🚨 发现问题：数据库有更新的数据，但 cursor 没更新！`)
        console.log(`   数据库最新: ${new Date(dbLatestMs).toISOString()}`)
        console.log(`   cursor.lastTimestamp: ${new Date(lastTs).toISOString()}`)
        console.log(`   差距: ${Math.round((dbLatestMs - lastTs) / intervalMs)} 个周期`)
      }

      // 检测 cursor.lastTimestamp 到当前时间的缺口
      if (dbGapMs > intervalMs * 2) {
        console.log(`\n⚠️ 警告：数据库延迟超过 2 个周期`)
        console.log(
          `   这可能是 gap 检测范围不正确导致的（只检测到 lastTimestamp，不检测到当前时间）`,
        )
      }
    } else {
      console.log(`\n❌ 数据库中无此任务的数据！`)
    }

    // 检测数据库中的实际缺口数量
    const gapCheckStart = lastTs - 7 * 24 * 60 * 60 * 1000 // 往前 7 天
    const gaps = await detectGapsInDb(
      cursor.symbol,
      cursor.exchangeCode || 'BINANCE',
      cursor.contractType ?? null,
      cursor.interval,
      gapCheckStart,
      now,
    )

    if (gaps.length > 0) {
      console.log(`\n🔍 检测到 ${gaps.length} 个数据缺口：`)
      for (const gap of gaps.slice(0, 5)) {
        console.log(
          `   ${new Date(gap.start).toISOString()} ~ ${new Date(gap.end).toISOString()} (${Math.round((gap.end - gap.start) / intervalMs)} 个周期)`,
        )
      }
      if (gaps.length > 5) {
        console.log(`   ... 还有 ${gaps.length - 5} 个缺口`)
      }

      // 检查是否有缺口在 lastTimestamp 之后（这些是 gap 检测无法发现的）
      const gapsAfterCursor = gaps.filter(g => g.start > lastTs)
      if (gapsAfterCursor.length > 0) {
        console.log(`\n🚨 关键发现：${gapsAfterCursor.length} 个缺口在 cursor.lastTimestamp 之后！`)
        console.log(`   当前 gap 检测逻辑（使用 lastTimestamp 作为终点）无法发现这些缺口！`)
        console.log(`   这验证了 Bug 1：gapCheckToMs 应该用当前时间而非 lastTimestamp`)
      }
    } else {
      console.log(`\n✅ 未检测到数据缺口`)
    }
  }

  await prisma.$disconnect()
  await pool.end()
}

async function detectGapsInDb(
  symbol: string,
  exchangeCode: string,
  contractType: string | null,
  interval: string,
  fromMs: number,
  toMs: number,
): Promise<Array<{ start: number; end: number }>> {
  const intervalMs = INTERVAL_MS[interval]
  if (!intervalMs) return []

  // 将 interval 转换为 Prisma 枚举键名
  const prismaIntervalKey = INTERVAL_TO_PRISMA_KEY[interval]
  if (!prismaIntervalKey) return []

  const records = await prisma.futuresPriceHistory.findMany({
    where: {
      symbol,
      exchangeCode,
      contractType,
      interval: prismaIntervalKey as any, // Prisma 7 需要枚举键名
      source: 'COINGLASS',
      timestamp: {
        gte: new Date(fromMs),
        lte: new Date(toMs),
      },
    },
    orderBy: { timestamp: 'asc' },
    select: { timestamp: true },
  })

  if (records.length === 0) {
    return [{ start: fromMs, end: toMs }]
  }

  const gaps: Array<{ start: number; end: number }> = []
  let prevTs = fromMs - intervalMs

  for (const record of records) {
    const currTs = record.timestamp.getTime()
    const expectedNext = prevTs + intervalMs

    if (currTs > expectedNext + intervalMs) {
      // 允许 1 个周期的容差
      gaps.push({ start: expectedNext, end: currTs - intervalMs })
    }
    prevTs = currTs
  }

  // 检查结尾缺口
  if (prevTs < toMs - intervalMs * 2) {
    gaps.push({ start: prevTs + intervalMs, end: toMs })
  }

  return gaps
}

main().catch(console.error)
