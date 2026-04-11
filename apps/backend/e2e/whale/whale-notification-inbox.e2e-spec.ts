import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createAuthApiClient, createTestingApp } from '../fixtures/fixtures'
import {
  cleanupWhaleNotificationUser,
  createWhaleNotificationDeliveryRecords,
  createWhaleNotificationRuleRecord,
  createWhaleNotificationTestUser,
} from './whale-notification.helpers'

describe('Whale notification inbox HTTP (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let ruleId = ''

  const userId = 'e2e-inbox-user'

  beforeAll(async () => {
    const ctx = await createTestingApp({
      onBeforeInit: builder =>
        builder
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest()
              req.user = {
                id: userId,
                email: 'e2e-inbox@example.com',
                roles: ['USER'],
                principalType: 'user',
              }
              return true
            },
          }),
    })
    app = ctx.app

    prisma = app.get(PrismaServiceToken)

    await cleanupWhaleNotificationUser(prisma, userId)

    await createWhaleNotificationTestUser(prisma, {
      userId,
      email: 'e2e-inbox-user@example.com',
      nickname: 'inbox-user',
    })

    const rule = await createWhaleNotificationRuleRecord(prisma, {
      userId,
      type: 'ADDRESS',
      whaleAddress: '0xabc',
      thresholdUsd: 100000,
    })
    ruleId = rule.id

    await createWhaleNotificationDeliveryRecords(prisma, [
        {
          userId,
          ruleId,
          dedupKey: `${userId}:0xabc:BTC:Long:WEB`,
          channel: 'WEB',
          status: 'SENT',
          whaleAddress: '0xabc',
          symbol: 'BTC',
          side: 'Long',
          tradeValueUsd: 120000,
          tradeTime: new Date(),
          title: '监控命中',
          content: '0xabc 开多 BTC 120000',
          isRead: false,
        },
      ])
  })

  afterAll(async () => {
    if (prisma) {
      await cleanupWhaleNotificationUser(prisma, userId)
    }

    if (app) await app.close()
  })

  it('should list inbox and mark read', async () => {
    const client = createAuthApiClient(app, 'e2e-token')

    const listRes = await client.get('whale-notification/notifications').expect(200)

    expect(Array.isArray(listRes.body?.data)).toBe(true)
    expect(listRes.body.data.length).toBeGreaterThan(0)

    const firstId = listRes.body.data[0].id as string

    await client.patch(`whale-notification/notifications/${firstId}/read`).expect(200)

    const unreadAfterSingleRead = await client
      .get('whale-notification/notifications/unread-count')
      .expect(200)

    expect(unreadAfterSingleRead.body?.data?.unread).toBe(0)

    const afterRead = await client.get('whale-notification/notifications').expect(200)

    expect(afterRead.body.data[0].read).toBe(true)

    await client.post('whale-notification/notifications/read-all').expect(200)

    const afterReadAll = await client.get('whale-notification/notifications').expect(200)

    expect(afterReadAll.body.data.every((item: { read: boolean }) => item.read)).toBe(true)
  })
})
