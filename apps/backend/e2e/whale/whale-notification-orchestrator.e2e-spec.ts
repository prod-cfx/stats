import type { INestApplication } from '@nestjs/common'
import type { WhaleAlertService } from '@/modules/whale-alert/whale-alert.service'
import type { WhaleNotificationDelivery } from '@/prisma/prisma.types'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleAlertService as WhaleAlertServiceToken } from '@/modules/whale-alert/whale-alert.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'
import { restoreE2eEnv, setE2eEnvValue, snapshotE2eEnv } from '../helpers/setup-e2e-env'
import {
  cleanupWhaleNotificationUser,
  createWhaleNotificationRuleRecord,
  createWhaleNotificationTestUser,
} from './whale-notification.helpers'

describe('Whale notification orchestrator via whale trade record (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService
  const envSnapshot = snapshotE2eEnv([
    'WHALE_NOTIFICATION_ENABLED',
    'WHALE_NOTIFICATION_ALLOWED_USER_IDS',
    'TELEGRAM_BOT_TOKEN',
  ])

  const userId = 'e2e-orchestrator-user'

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    whaleAlertService = app.get(WhaleAlertServiceToken)


    await prisma.whaleNotificationCooldownGuard.deleteMany({
      where: {
        dedupKey: {
          startsWith: `${userId}:`,
        },
      },
    })
    await prisma.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xorchestrator' } })
    await cleanupWhaleNotificationUser(prisma, userId)

    await createWhaleNotificationTestUser(prisma, {
      userId,
      email: 'e2e-orchestrator-user@example.com',
      nickname: 'orchestrator-user',
    })

    await createWhaleNotificationRuleRecord(prisma, {
      userId,
      type: 'ADDRESS',
      whaleAddress: '0xorchestrator',
      thresholdUsd: 100000,
      channelWeb: true,
      channelEmail: true,
      channelTelegram: false,
    })
  })

  beforeEach(async () => {
    await prisma.whaleNotificationCooldownGuard.deleteMany({
      where: {
        dedupKey: {
          startsWith: `${userId}:`,
        },
      },
    })
    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId } })
  })

  afterAll(async () => {
    restoreE2eEnv(envSnapshot)

    if (prisma) {
      await prisma.whaleNotificationCooldownGuard.deleteMany({
        where: {
          dedupKey: {
            startsWith: `${userId}:`,
          },
        },
      })
      await prisma.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xorchestrator' } })
      await cleanupWhaleNotificationUser(prisma, userId)
    }

    if (app) {
      await app.close()
    }
  })

  it('should create sent deliveries and then cooldown-skipped deliveries for repeated trade event', async () => {
    const now = new Date()

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'BTC',
      side: 'Long',
      tradeSize: 2,
      price: 60000,
      tradeValueUsd: 120000,
      tradeTime: now,
    })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'BTC',
      side: 'Long',
      tradeSize: 1,
      price: 65000,
      tradeValueUsd: 130000,
      tradeTime: new Date(now.getTime() + 1_000),
    })

    const rows = await prisma.whaleNotificationDelivery.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    })

    expect(rows.length).toBe(4)

    const sentRows = rows.filter((row: WhaleNotificationDelivery) => row.status === 'SENT')
    const skippedRows = rows.filter((row: WhaleNotificationDelivery) => row.status === 'SKIPPED_COOLDOWN')

    expect(sentRows.length).toBe(2)
    expect(skippedRows.length).toBe(2)
  })

  it('should skip orchestration when feature flag is disabled', async () => {
    setE2eEnvValue('WHALE_NOTIFICATION_ENABLED', 'false')

    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId } })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'ETH',
      side: 'Short',
      tradeSize: 100,
      price: 3000,
      tradeValueUsd: 300000,
      tradeTime: new Date(),
    })

    const rows = await prisma.whaleNotificationDelivery.findMany({
      where: { userId },
    })

    expect(rows.length).toBe(0)
    restoreE2eEnv(envSnapshot)
  })

  it('should not mark failed telegram delivery as cooldown-skipped on next event', async () => {
    setE2eEnvValue('TELEGRAM_BOT_TOKEN', '')
    setE2eEnvValue('WHALE_NOTIFICATION_ENABLED', 'true')
    setE2eEnvValue('WHALE_NOTIFICATION_ALLOWED_USER_IDS', '')

    const whaleAddress = '0xorchestrator-telegram'
    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId } })
    await prisma.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: whaleAddress } })
    const telegramRule = await createWhaleNotificationRuleRecord(prisma, {
      userId,
      type: 'ADDRESS',
      whaleAddress,
      thresholdUsd: 100000,
      channelWeb: false,
      channelEmail: false,
      channelTelegram: true,
    })

    const now = new Date()
    await whaleAlertService.recordWhaleTrade({
      whaleAddress,
      coin: 'BTC',
      side: 'Long',
      tradeSize: 1,
      price: 70000,
      tradeValueUsd: 120000,
      tradeTime: now,
    })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress,
      coin: 'BTC',
      side: 'Long',
      tradeSize: 2,
      price: 70000,
      tradeValueUsd: 140000,
      tradeTime: new Date(now.getTime() + 1_000),
    })

    const rows = await prisma.whaleNotificationDelivery.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    })
    const failedRows = rows.filter((row: WhaleNotificationDelivery) => row.status === 'FAILED')
    const skippedRows = rows.filter((row: WhaleNotificationDelivery) => row.status === 'SKIPPED_COOLDOWN')

    expect(rows.length).toBe(2)
    expect(failedRows.length).toBe(2)
    expect(skippedRows.length).toBe(0)

    await prisma.whaleNotificationRule.delete({ where: { id: telegramRule.id } })
    await prisma.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: whaleAddress } })
    restoreE2eEnv(envSnapshot)
  })

  it('should expose basic orchestrator metrics', async () => {
    setE2eEnvValue('WHALE_NOTIFICATION_ENABLED', 'true')

    const now = new Date()
    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'SOL',
      side: 'Long',
      tradeSize: 1000,
      price: 200,
      tradeValueUsd: 200000,
      tradeTime: now,
    })

    const apiClient = createApiClient(app)
    const res = await apiClient.get('/whale-notification/metrics').expect(200)
    const metrics = (res.body?.data?.data ?? res.body?.data ?? res.body) as Record<string, unknown>

    expect(typeof metrics.eventsReceived).toBe('number')
    expect(typeof metrics.deliveriesSent).toBe('number')
    expect(typeof metrics.featureFlagSkippedEvents).toBe('number')
    expect(typeof metrics.grayReleaseSkippedMatches).toBe('number')
    expect(metrics.eventsReceived as number).toBeGreaterThan(0)
  })

  it('should ignore allowlist setting and continue dispatching', async () => {
    setE2eEnvValue('WHALE_NOTIFICATION_ALLOWED_USER_IDS', 'some-other-user')
    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId } })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'BTC',
      side: 'Long',
      tradeSize: 1,
      price: 70000,
      tradeValueUsd: 120000,
      tradeTime: new Date(),
    })

    const rows = await prisma.whaleNotificationDelivery.findMany({
      where: { userId },
    })
    expect(rows.length).toBeGreaterThan(0)
    restoreE2eEnv(envSnapshot)
  })
})
