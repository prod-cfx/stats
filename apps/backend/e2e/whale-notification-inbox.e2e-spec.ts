import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../src/prisma/prisma.service'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/modules/app.module'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

describe('Whale notification inbox HTTP (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let ruleId = ''

  const userId = 'e2e-inbox-user'
  const originalCwd = process.cwd()

  beforeAll(async () => {
    ensureE2eEnv()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: errors => {
          const errorMessages = errors.map(err => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          }))
          return new BadRequestException(errorMessages)
        },
      }),
    )

    app.setGlobalPrefix('api/v1')
    await app.init()

    prisma = app.get(PrismaServiceToken)
    const client = prisma.getClient()

    await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
    await client.whaleNotificationRule.deleteMany({ where: { userId } })
    await client.user.deleteMany({ where: { id: userId } })

    await client.user.create({
      data: {
        id: userId,
        email: 'e2e-inbox-user@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'inbox-user',
        emailVerified: true,
        isGuest: false,
      },
    })

    const rule = await client.whaleNotificationRule.create({
      data: {
        userId,
        type: 'ADDRESS',
        whaleAddress: '0xabc',
        thresholdUsd: 100000,
      },
    })
    ruleId = rule.id

    await client.whaleNotificationDelivery.createMany({
      data: [
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
      ],
    })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
      await client.whaleNotificationRule.deleteMany({ where: { userId } })
      await client.user.deleteMany({ where: { id: userId } })
    }

    process.chdir(originalCwd)
    if (app) await app.close()
  })

  it('should list inbox and mark read', async () => {
    const server = app.getHttpServer()

    const listRes = await request(server)
      .get('/api/v1/whale-notification/notifications')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(Array.isArray(listRes.body?.data)).toBe(true)
    expect(listRes.body.data.length).toBeGreaterThan(0)

    const firstId = listRes.body.data[0].id as string

    await request(server)
      .patch(`/api/v1/whale-notification/notifications/${firstId}/read`)
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    const unreadAfterSingleRead = await request(server)
      .get('/api/v1/whale-notification/notifications/unread-count')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(unreadAfterSingleRead.body?.data?.unread).toBe(0)

    const afterRead = await request(server)
      .get('/api/v1/whale-notification/notifications')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(afterRead.body.data[0].read).toBe(true)

    await request(server)
      .post('/api/v1/whale-notification/notifications/read-all')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    const afterReadAll = await request(server)
      .get('/api/v1/whale-notification/notifications')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(afterReadAll.body.data.every((item: { read: boolean }) => item.read)).toBe(true)
  })
})
