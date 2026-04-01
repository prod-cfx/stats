import type { INestApplication } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleNotificationDeduplicatorService } from '@/modules/whale-notification/services/whale-notification-deduplicator.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp, createUserRecord } from '../fixtures/fixtures'

type WhaleNotificationRuleCreateData = Parameters<PrismaService['whaleNotificationRule']['create']>[0]['data']

const createWhaleNotificationRuleRecord = async (prisma: PrismaService, data: WhaleNotificationRuleCreateData) => {
  return prisma.whaleNotificationRule.create({ data })
}

describe('Whale notification deduplicator (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let deduplicator: WhaleNotificationDeduplicatorService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    deduplicator = app.get(WhaleNotificationDeduplicatorService)

    await prisma.whaleNotificationCooldownGuard.deleteMany({
      where: {
        dedupKey: {
          startsWith: 'e2e-dedup-user:',
        },
      },
    })
    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-dedup-user' } })
    await prisma.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-dedup-user' } })
    await prisma.user.deleteMany({ where: { id: 'e2e-dedup-user' } })

    await createUserRecord(prisma, {
      id: 'e2e-dedup-user',
      email: 'e2e-dedup-user@example.com',
      nickname: 'dedup-user',
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.whaleNotificationCooldownGuard.deleteMany({
        where: {
          dedupKey: {
            startsWith: 'e2e-dedup-user:',
          },
        },
      })
      await prisma.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-dedup-user' } })
      await prisma.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-dedup-user' } })
      await prisma.user.deleteMany({ where: { id: 'e2e-dedup-user' } })
    }

    if (app) {
      await app.close()
    }
  })

  it('should skip candidate within cooldown window by dedup key', async () => {

    const rule = await createWhaleNotificationRuleRecord(prisma, {
      userId: 'e2e-dedup-user',
      type: 'ADDRESS',
      whaleAddress: '0xabc',
      thresholdUsd: 100000,
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
