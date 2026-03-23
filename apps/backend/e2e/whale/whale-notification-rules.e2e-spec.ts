import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createAuthApiClient, createTestingApp } from '../fixtures/fixtures'

describe('Whale notification rules HTTP (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const ctx = await createTestingApp({
      onBeforeInit: builder =>
        builder
          .overrideGuard(JwtAuthGuard)
          .useValue({
            canActivate: (context: ExecutionContext) => {
              const req = context.switchToHttp().getRequest()
              req.user = {
                id: 'e2e-user-whale-notify',
                email: 'e2e@example.com',
                roles: ['USER'],
                principalType: 'user',
              }
              return true
            },
          }),
    })
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    const client = prisma.getClient()
    await client.whaleNotificationRule.deleteMany({
      where: { userId: 'e2e-user-whale-notify' },
    })
    await client.user.deleteMany({
      where: { id: 'e2e-user-whale-notify' },
    })
    await client.user.create({
      data: {
        id: 'e2e-user-whale-notify',
        email: 'e2e-user-whale-notify@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'e2e-user',
        emailVerified: true,
        isGuest: false,
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.whaleNotificationRule.deleteMany({
        where: { userId: 'e2e-user-whale-notify' },
      })
      await client.user.deleteMany({
        where: { id: 'e2e-user-whale-notify' },
      })
    }
    if (app) {
      await app.close()
    }
  })

  it('should support create/list/update/delete rule', async () => {
    const client = createAuthApiClient(app, 'e2e-token')

    const createRes = await client.post('whale-notification/rules').send({
      type: 'ADDRESS',
      address: '0x123abc',
      thresholdUsd: 100000,
      note: 'focus this whale',
      channels: {
        web: true,
        email: false,
        telegram: false,
      },
    })
    expect(createRes.status).toBe(201)

    expect(createRes.body?.data).toBeTruthy()
    expect(createRes.body.data.type).toBe('ADDRESS')
    expect(createRes.body.data.address).toBe('0x123abc')
    expect(createRes.body.data.thresholdUsd).toBe(100000)

    const ruleId = createRes.body.data.id as string
    expect(typeof ruleId).toBe('string')

    const listRes = await client.get('whale-notification/rules').expect(200)

    expect(Array.isArray(listRes.body?.data)).toBe(true)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0].id).toBe(ruleId)

    const updateRes = await client.put(`whale-notification/rules/${ruleId}`).send({
      thresholdUsd: 200000,
      isActive: false,
      channels: {
        web: true,
        email: true,
        telegram: false,
      },
    }).expect(200)

    expect(updateRes.body?.data?.thresholdUsd).toBe(200000)
    expect(updateRes.body?.data?.isActive).toBe(false)
    expect(updateRes.body?.data?.channels?.email).toBe(true)

    await client.delete(`whale-notification/rules/${ruleId}`).expect(200)

    const finalListRes = await client.get('whale-notification/rules').expect(200)

    expect(finalListRes.body?.data).toHaveLength(0)
  })

  it('should return 400 instead of 500 for missing threshold', async () => {
    const client = createAuthApiClient(app, 'e2e-token')

    await client.post('whale-notification/rules').send({
      type: 'SYMBOL',
      symbol: 'BTC',
      channels: {
        web: true,
        email: false,
        telegram: false,
      },
    }).expect(400)
  })
})
