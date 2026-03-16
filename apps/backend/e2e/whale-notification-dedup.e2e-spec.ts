import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/modules/app.module'
import { WhaleNotificationDeduplicatorService } from '../src/modules/whale-notification/services/whale-notification-deduplicator.service'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'

describe('Whale notification deduplicator (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let deduplicator: WhaleNotificationDeduplicatorService

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
    deduplicator = app.get(WhaleNotificationDeduplicatorService)

    const client = prisma.getClient()
    await client.whaleNotificationCooldownGuard.deleteMany({
      where: {
        dedupKey: {
          startsWith: 'e2e-dedup-user:',
        },
      },
    })
    await client.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-dedup-user' } })
    await client.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-dedup-user' } })
    await client.user.deleteMany({ where: { id: 'e2e-dedup-user' } })

    await client.user.create({
      data: {
        id: 'e2e-dedup-user',
        email: 'e2e-dedup-user@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'dedup-user',
        emailVerified: true,
        isGuest: false,
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.whaleNotificationCooldownGuard.deleteMany({
        where: {
          dedupKey: {
            startsWith: 'e2e-dedup-user:',
          },
        },
      })
      await client.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-dedup-user' } })
      await client.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-dedup-user' } })
      await client.user.deleteMany({ where: { id: 'e2e-dedup-user' } })
    }

    if (app) {
      await app.close()
    }
  })

  it('should skip candidate within cooldown window by dedup key', async () => {
    const client = prisma.getClient()

    const rule = await client.whaleNotificationRule.create({
      data: {
        userId: 'e2e-dedup-user',
        type: 'ADDRESS',
        whaleAddress: '0xabc',
        thresholdUsd: 100000,
      },
    })

    const candidates = [
      {
        userId: 'e2e-dedup-user',
        ruleId: rule.id,
        channel: 'WEB' as const,
        whaleAddress: '0xabc',
        symbol: 'BTC',
        side: 'Long',
        tradeValueUsd: 250000,
        tradeTime: new Date(),
      },
    ]

    // 第一次调用会占用 cooldown 槽位
    const first = await deduplicator.filterByCooldown(candidates, 60)
    expect(first.allowed).toHaveLength(1)
    expect(first.skipped).toHaveLength(0)

    // 第二次调用命中同一 dedupKey，应被 cooldown 拦截
    const result = await deduplicator.filterByCooldown(
      [
        ...candidates,
      ],
      60,
    )

    expect(result.allowed).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toBe('cooldown')
  })
})
