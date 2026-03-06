import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleAlertService } from '../src/modules/whale-alert/whale-alert.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/modules/app.module'
import { WhaleAlertService as WhaleAlertServiceToken } from '../src/modules/whale-alert/whale-alert.service'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'

describe('Whale notification orchestrator via whale trade record (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService
  const originalWhaleNotificationEnabled = process.env.WHALE_NOTIFICATION_ENABLED
  const originalWhaleNotificationAllowedUserIds = process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS
  const originalTelegramBotToken = process.env.TELEGRAM_BOT_TOKEN

  const userId = 'e2e-orchestrator-user'

  beforeAll(async () => {
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }

    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaServiceToken)
    whaleAlertService = app.get(WhaleAlertServiceToken)

    const client = prisma.getClient()

    await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
    await client.whaleNotificationRule.deleteMany({ where: { userId } })
    await client.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xorchestrator' } })
    await client.user.deleteMany({ where: { id: userId } })

    await client.user.create({
      data: {
        id: userId,
        email: 'e2e-orchestrator-user@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'orchestrator-user',
        emailVerified: true,
        isGuest: false,
      },
    })

    await client.whaleNotificationRule.create({
      data: {
        userId,
        type: 'ADDRESS',
        whaleAddress: '0xorchestrator',
        thresholdUsd: 100000,
        channelWeb: true,
        channelEmail: true,
        channelTelegram: false,
      },
    })
  })

  afterAll(async () => {
    process.env.WHALE_NOTIFICATION_ENABLED = originalWhaleNotificationEnabled
    process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = originalWhaleNotificationAllowedUserIds
    process.env.TELEGRAM_BOT_TOKEN = originalTelegramBotToken

    if (prisma) {
      const client = prisma.getClient()
      await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
      await client.whaleNotificationRule.deleteMany({ where: { userId } })
      await client.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xorchestrator' } })
      await client.user.deleteMany({ where: { id: userId } })
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

    const rows = await prisma.getClient().whaleNotificationDelivery.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    })

    expect(rows.length).toBe(4)

    const sentRows = rows.filter(row => row.status === 'SENT')
    const skippedRows = rows.filter(row => row.status === 'SKIPPED_COOLDOWN')

    expect(sentRows.length).toBe(2)
    expect(skippedRows.length).toBe(2)
  })

  it('should skip orchestration when feature flag is disabled', async () => {
    process.env.WHALE_NOTIFICATION_ENABLED = 'false'

    await prisma.getClient().whaleNotificationDelivery.deleteMany({ where: { userId } })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'ETH',
      side: 'Short',
      tradeSize: 100,
      price: 3000,
      tradeValueUsd: 300000,
      tradeTime: new Date(),
    })

    const rows = await prisma.getClient().whaleNotificationDelivery.findMany({
      where: { userId },
    })

    expect(rows.length).toBe(0)
    process.env.WHALE_NOTIFICATION_ENABLED = originalWhaleNotificationEnabled
  })

  it('should not mark failed telegram delivery as cooldown-skipped on next event', async () => {
    process.env.TELEGRAM_BOT_TOKEN = ''
    process.env.WHALE_NOTIFICATION_ENABLED = 'true'
    process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = ''

    const client = prisma.getClient()
    const whaleAddress = '0xorchestrator-telegram'
    await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
    await client.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: whaleAddress } })
    const telegramRule = await client.whaleNotificationRule.create({
      data: {
        userId,
        type: 'ADDRESS',
        whaleAddress,
        thresholdUsd: 100000,
        channelWeb: false,
        channelEmail: false,
        channelTelegram: true,
      },
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

    const rows = await client.whaleNotificationDelivery.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    })
    const failedRows = rows.filter(row => row.status === 'FAILED')
    const skippedRows = rows.filter(row => row.status === 'SKIPPED_COOLDOWN')

    expect(rows.length).toBe(2)
    expect(failedRows.length).toBe(2)
    expect(skippedRows.length).toBe(0)

    await client.whaleNotificationRule.delete({ where: { id: telegramRule.id } })
    await client.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: whaleAddress } })
    process.env.TELEGRAM_BOT_TOKEN = originalTelegramBotToken
  })

  it('should expose basic orchestrator metrics', async () => {
    process.env.WHALE_NOTIFICATION_ENABLED = 'true'

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

    const server = app.getHttpServer()
    const res = await request(server).get('/whale-notification/metrics').expect(200)
    const metrics = (res.body?.data?.data ?? res.body?.data ?? res.body) as Record<string, unknown>

    expect(typeof metrics.eventsReceived).toBe('number')
    expect(typeof metrics.deliveriesSent).toBe('number')
    expect(typeof metrics.featureFlagSkippedEvents).toBe('number')
    expect(typeof metrics.grayReleaseSkippedMatches).toBe('number')
    expect(metrics.eventsReceived as number).toBeGreaterThan(0)
  })

  it('should skip unmatched users in gray release allowlist mode', async () => {
    process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = 'some-other-user'
    await prisma.getClient().whaleNotificationDelivery.deleteMany({ where: { userId } })

    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xorchestrator',
      coin: 'BTC',
      side: 'Long',
      tradeSize: 1,
      price: 70000,
      tradeValueUsd: 120000,
      tradeTime: new Date(),
    })

    const rows = await prisma.getClient().whaleNotificationDelivery.findMany({
      where: { userId },
    })
    expect(rows.length).toBe(0)
    process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = originalWhaleNotificationAllowedUserIds
  })
})
