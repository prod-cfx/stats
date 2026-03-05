import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleAlertService } from '../src/modules/whale-alert/whale-alert.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/modules/app.module'
import { WhaleAlertService as WhaleAlertServiceToken } from '../src/modules/whale-alert/whale-alert.service'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'

describe('Whale notification orchestrator via whale trade record (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService

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
})
