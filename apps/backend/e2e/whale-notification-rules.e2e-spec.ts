import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../src/prisma/prisma.service'
import { resolve } from 'node:path'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/modules/app.module'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'

describe('Whale notification rules HTTP (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService

  const originalCwd = process.cwd()

  beforeAll(async () => {
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }

    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
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
    process.chdir(originalCwd)
    if (app) {
      await app.close()
    }
  })

  it('should support create/list/update/delete rule', async () => {
    const server = app.getHttpServer()

    const createRes = await request(server)
      .post('/api/v1/whale-notification/rules')
      .set('Authorization', 'Bearer e2e-token')
      .send({
        type: 'ADDRESS',
        address: '0x123abc',
        thresholdUsd: 100000,
        note: 'focus this whale',
        channels: {
          web: true,
          email: false,
          telegram: true,
        },
      })
    expect(createRes.status).toBe(201)

    expect(createRes.body?.data).toBeTruthy()
    expect(createRes.body.data.type).toBe('ADDRESS')
    expect(createRes.body.data.address).toBe('0x123abc')
    expect(createRes.body.data.thresholdUsd).toBe(100000)

    const ruleId = createRes.body.data.id as string
    expect(typeof ruleId).toBe('string')

    const listRes = await request(server)
      .get('/api/v1/whale-notification/rules')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(Array.isArray(listRes.body?.data)).toBe(true)
    expect(listRes.body.data).toHaveLength(1)
    expect(listRes.body.data[0].id).toBe(ruleId)

    const updateRes = await request(server)
      .patch(`/api/v1/whale-notification/rules/${ruleId}`)
      .set('Authorization', 'Bearer e2e-token')
      .send({
        thresholdUsd: 200000,
        isActive: false,
        channels: {
          web: true,
          email: true,
          telegram: false,
        },
      })
      .expect(200)

    expect(updateRes.body?.data?.thresholdUsd).toBe(200000)
    expect(updateRes.body?.data?.isActive).toBe(false)
    expect(updateRes.body?.data?.channels?.email).toBe(true)

    await request(server)
      .delete(`/api/v1/whale-notification/rules/${ruleId}`)
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    const finalListRes = await request(server)
      .get('/api/v1/whale-notification/rules')
      .set('Authorization', 'Bearer e2e-token')
      .expect(200)

    expect(finalListRes.body?.data).toHaveLength(0)
  })

  it('should return 400 instead of 500 for missing threshold', async () => {
    const server = app.getHttpServer()

    await request(server)
      .post('/api/v1/whale-notification/rules')
      .set('Authorization', 'Bearer e2e-token')
      .send({
        type: 'SYMBOL',
        symbol: 'BTC',
        channels: {
          web: true,
          email: false,
          telegram: false,
        },
      })
      .expect(400)
  })
})
