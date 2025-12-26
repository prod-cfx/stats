import type { PrismaClient } from '@prisma/client'

/**
 * 数据拉取任务种子数据
 *
 * 这里会为已经在 DATA_PULL_JOB_REGISTRY 中注册的 Job 创建基础任务配置，
 * 避免每次在本地开发环境都要手动通过后台创建。
 */
export async function seedDataPullTasks(prisma: PrismaClient) {
  console.log('🌱 Seeding data-pull tasks...')

  const tasks = [
    {
      key: 'open-interest-sync',
      name: 'Coinglass 持仓量同步',
      source: 'coinglass',
      type: 'open-interest',
      // 每 5 分钟同步一次
      intervalSeconds: 300,
      enabled: false,
      cursor: JSON.stringify({
        symbol: 'BTC',
        exchange: 'All',
      } satisfies { symbol: string; exchange: string }),
    },
  ] as const

  let createdCount = 0
  let skippedCount = 0

  for (const task of tasks) {
    try {
      await prisma.dataPullTask.upsert({
        where: { key: task.key },
        update: {},
        create: {
          key: task.key,
          name: task.name,
          source: task.source,
          type: task.type,
          intervalSeconds: task.intervalSeconds,
          enabled: task.enabled,
          cursor: task.cursor,
        },
      })
      createdCount += 1
      console.log(`  ✓ ${task.key}`)
    } catch (error) {
      skippedCount += 1
      console.log(
        `  ⊘ ${task.key} (already exists or error: ${
          error instanceof Error ? error.message : String(error)
        })`,
      )
    }
  }

  console.log(
    `✅ Data-pull tasks seeded: ${createdCount} created, ${skippedCount} skipped`,
  )
}

