// Prisma 7: explicitly load environment variables.
import * as path from 'node:path'
import { loadEnvironment } from '@net/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma'
import { createEnvAccessor } from '../src/common/env/env.accessor'
import { applyQuantifyEnvOverrides } from '../src/config/quantify-env'
import { resolveConfiguredBacktestCapabilityConfig } from '../src/modules/backtesting/backtest-capability-config'

// Load environment variables using the shared loader.
const rootDir = path.resolve(__dirname, '../../..')
loadEnvironment({ basePath: rootDir })
applyQuantifyEnvOverrides()

// Access environment variables via the shared accessor.
const env = createEnvAccessor()

const dbUrl = env.str('DATABASE_URL')
if (!dbUrl || dbUrl === '__SET_IN_env.local__') {
  console.error('DATABASE_URL is not configured. Set a valid value in .env.*.local.')
  process.exit(1)
}
const pool = new Pool({ connectionString: dbUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function seedAiProviderKeys() {
  const rawKey = env.raw('UNIAPI_API_KEY')
  const apiKey = rawKey?.trim()

  // Skip provider seeding when the key is missing or still a placeholder.
  if (!apiKey || apiKey === '__SET_IN_env.local__') {
    console.warn(
      '[seed] UNIAPI_API_KEY is not configured. Skipping AiProviderKey seeding for uniapi/default.',
    )
    return
  }

  console.log('[seed] Seeding AI provider config for uniapi/default...')

  interface AiProviderKeyDelegate {
    upsert: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    aiProviderKey?: AiProviderKeyDelegate
  }

  if (!client.aiProviderKey || typeof client.aiProviderKey.upsert !== 'function') {
    console.warn(
      '[seed] Prisma Client does not expose aiProviderKey. Skipping AiProviderKey seeding.',
    )
    return
  }

  await client.aiProviderKey.upsert({
    where: {
      providerCode_name: {
        providerCode: 'uniapi',
        name: 'default',
      },
    },
    update: {
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
    create: {
      providerCode: 'uniapi',
      providerName: 'uniapi',
      baseUrl: 'https://api.uniapi.io/v1/',
      type: 'OPENAI_COMPATIBLE',
      name: 'default',
      apiKey,
      isDefault: true,
      status: 'ACTIVE',
      defaultModel: 'o4-mini',
    },
  })

  console.log('[seed] AI provider config seeded for uniapi/default')
}

async function seedBacktestCapabilityConfig() {
  const capabilityConfig = resolveConfiguredBacktestCapabilityConfig(env)

  console.log('[seed] Ensuring backtest capability config...')

  interface BacktestCapabilityConfigDelegate {
    findFirst: (args: unknown) => Promise<{ id: string } | null>
    update: (args: unknown) => Promise<unknown>
    create: (args: unknown) => Promise<unknown>
  }

  const client = prisma as unknown as {
    backtestCapabilityConfig?: BacktestCapabilityConfigDelegate
  }

  if (!client.backtestCapabilityConfig) {
    console.warn(
      '[seed] Prisma Client does not expose backtestCapabilityConfig. Skipping capability config seeding.',
    )
    return
  }

  const existing = await client.backtestCapabilityConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  if (existing) {
    await client.backtestCapabilityConfig.update({
      where: { id: existing.id },
      data: {
        allowedBaseTimeframes: capabilityConfig.allowedBaseTimeframes,
        isActive: true,
      },
    })
  } else {
    await client.backtestCapabilityConfig.create({
      data: {
        allowedBaseTimeframes: capabilityConfig.allowedBaseTimeframes,
        isActive: true,
      },
    })
  }

  console.log('[seed] Backtest capability config ensured')
}

async function main() {
  console.log('Starting quantify seed...')

  await seedAiProviderKeys()
  await seedBacktestCapabilityConfig()

  console.log('Quantify seed finished')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    // Prisma 7: close the underlying pg pool explicitly.
    await pool.end()
  })
  .catch(async (e) => {
    console.error('Quantify seed failed:', e)
    await prisma.$disconnect()
    // Prisma 7: close the underlying pg pool explicitly.
    await pool.end()
    process.exit(1)
  })
