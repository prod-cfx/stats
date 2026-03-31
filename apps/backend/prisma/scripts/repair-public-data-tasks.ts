#!/usr/bin/env tsx

import path from 'node:path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../../generated/prisma'
import { createEnvAccessor } from '../../src/common/env/env.accessor'

const rootDir = path.resolve(__dirname, '../../../..')
loadEnvironment({ basePath: rootDir })

const env = createEnvAccessor()
const dbUrl = env.str('DATABASE_URL')

if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  throw new Error('DATABASE_URL 未配置或仍为占位符，无法执行 repair-public-data-tasks')
}

const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const REQUIRED_ENABLED_TASK_KEYS = [
  'coinglass-hyperliquid-whale-alert',
  'coinglass-hyperliquid-whale-position',
  'bbx-crypto-stock-quotes',
  'bbx-crypto-stock-scraper',
] as const

const POLYMARKET_TASK_KEY = 'polymarket-markets-crypto'
const STALE_RUNNING_MINUTES = Number(process.env.PUBLIC_DATA_TASK_REPAIR_STALE_RUNNING_MINUTES ?? '30')
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

type JsonObject = Record<string, unknown>

function getAppEnv(): string {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development'
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function main() {
  const appEnv = getAppEnv()

  if (appEnv !== 'staging' && appEnv !== 'production') {
    throw new Error(
      `repair-public-data-tasks 仅支持 staging/production，当前 APP_ENV=${appEnv}`,
    )
  }

  const requiredKeys = [...REQUIRED_ENABLED_TASK_KEYS, POLYMARKET_TASK_KEY]
  const tasks = await prisma.dataPullTask.findMany({
    where: {
      key: {
        in: requiredKeys,
      },
    },
    orderBy: {
      id: 'asc',
    },
  })

  const tasksByKey = new Map(tasks.map(task => [task.key, task]))
  const missingKeys = requiredKeys.filter(key => !tasksByKey.has(key))

  const enableUpdates = REQUIRED_ENABLED_TASK_KEYS
    .map(key => tasksByKey.get(key))
    .filter(task => task && task.enabled === false)
    .map(task => ({
      id: task.id,
      key: task.key,
    }))

  const polymarketTask = tasksByKey.get(POLYMARKET_TASK_KEY)
  const polymarketMeta = isPlainObject(polymarketTask?.meta) ? { ...polymarketTask.meta } : {}

  const categoryValue = polymarketMeta.category
  const needsCategoryRepair =
    typeof categoryValue !== 'string' || categoryValue.trim().length === 0

  const onlyActiveValue = polymarketMeta.onlyActive
  const needsOnlyActiveRepair = onlyActiveValue == null

  const staleBefore = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000)
  const staleRunningTasks = await prisma.dataPullTask.findMany({
    where: {
      lastStatus: 'RUNNING',
      lastRunAt: {
        lt: staleBefore,
      },
    },
    orderBy: {
      id: 'asc',
    },
  })

  const summary = {
    env: appEnv,
    dryRun: DRY_RUN,
    staleRunningMinutes: STALE_RUNNING_MINUTES,
    missingKeys,
    enableUpdates,
    polymarketMetaRepair:
      polymarketTask && (needsCategoryRepair || needsOnlyActiveRepair)
        ? {
            id: polymarketTask.id,
            key: polymarketTask.key,
            from: polymarketTask.meta,
            to: {
              ...polymarketMeta,
              ...(needsCategoryRepair ? { category: 'crypto' } : {}),
              ...(needsOnlyActiveRepair ? { onlyActive: true } : {}),
            },
          }
        : null,
    staleRunningResets: staleRunningTasks.map(task => ({
      id: task.id,
      key: task.key,
      lastRunAt: task.lastRunAt?.toISOString() ?? null,
    })),
  }

  if (DRY_RUN) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  await prisma.$transaction(async tx => {
    for (const task of enableUpdates) {
      await tx.dataPullTask.update({
        where: { id: task.id },
        data: {
          enabled: true,
        },
      })
    }

    if (polymarketTask && (needsCategoryRepair || needsOnlyActiveRepair)) {
      await tx.dataPullTask.update({
        where: { id: polymarketTask.id },
        data: {
          meta: {
            ...polymarketMeta,
            ...(needsCategoryRepair ? { category: 'crypto' } : {}),
            ...(needsOnlyActiveRepair ? { onlyActive: true } : {}),
          },
        },
      })
    }

    for (const task of staleRunningTasks) {
      await tx.dataPullTask.update({
        where: { id: task.id },
        data: {
          lastStatus: 'IDLE',
          lastError: 'Recovered stale RUNNING task during public data task repair',
        },
      })
    }
  })

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
