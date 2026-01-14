#!/usr/bin/env tsx
/**
 * 为前端显示的币种创建 Coinglass Pairs Markets 数据拉取任务
 */

import path from 'node:path'
import { loadEnvironment } from '@net/config'
import { PrismaClient } from '@prisma/client'

// 加载环境变量
const rootDir = path.resolve(__dirname, '../../../..')
loadEnvironment({ basePath: rootDir })

const TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB']

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('开始创建 Coinglass Pairs Markets 数据拉取任务...')

    for (const symbol of TOKENS) {
      const key = `coinglass-pairs-markets-${symbol.toLowerCase()}`
      const name = `Coinglass Pairs Markets - ${symbol}`

      const task = await prisma.dataPullTask.upsert({
        where: { key },
        update: {
          name,
          enabled: true,
          meta: { symbol },
          updatedAt: new Date(),
        },
        create: {
          key,
          name,
          source: 'COINGLASS',
          intervalSeconds: 180, // 每3分钟
          enabled: true,
          meta: { symbol },
        },
      })

      console.log(`✅ ${symbol}: ${task.key} (${task.enabled ? '已启用' : '已禁用'})`)
    }

    // 禁用旧的单一任务（如果存在）
    const oldTask = await prisma.dataPullTask.findUnique({
      where: { key: 'coinglass-pairs-markets' },
    })

    if (oldTask) {
      await prisma.dataPullTask.update({
        where: { key: 'coinglass-pairs-markets' },
        data: { enabled: false },
      })
      console.log('⚠️  已禁用旧任务: coinglass-pairs-markets')
    }

    console.log('\n✅ 任务创建完成！')
    console.log(`共创建/更新 ${TOKENS.length} 个币种的数据拉取任务`)
  } catch (error) {
    console.error('❌ 任务创建失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
