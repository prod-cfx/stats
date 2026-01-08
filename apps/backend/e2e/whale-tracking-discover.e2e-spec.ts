import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { resolve } from 'node:path'
import request from 'supertest'

describe('Whale tracking discover API (E2E)', () => {
  let app: INestApplication
  let prisma: any

  beforeAll(async () => {
    // 仅允许在 e2e 环境下运行，防止误连真实数据库
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }
    if (process.env.APP_ENV !== 'e2e') {
      throw new Error(
        `Whale tracking discover E2E must run with APP_ENV="e2e", current: ${process.env.APP_ENV}`,
      )
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    process.chdir(resolve(__dirname, '../../..'))

    // 确保在设置 APP_ENV / cwd 之后再加载 Nest 应用及 Prisma
    jest.resetModules()

    const [
      { Test },
      { AppModule },
      { PrismaService },
      { JwtAuthGuard },
      { ACGuard },
    ] = await Promise.all([
      import('@nestjs/testing'),
      import('../src/modules/app.module'),
      import('../src/prisma/prisma.service'),
      import('../src/modules/auth/guards/jwt-auth.guard'),
      import('../src/modules/auth/guards/ac.guard'),
    ])

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // 覆盖认证与权限守卫，避免在 E2E 中依赖真实登录 & RBAC 配置
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ACGuard)
      .useValue({ canActivate: () => true })
      .compile()

    app = moduleFixture.createNestApplication()
    // 与生产环境保持一致的全局前缀，便于前后端路径对齐
    app.setGlobalPrefix('api/v1')
    await app.init()

    prisma = app.get(PrismaService)

    // 清理历史测试数据
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})

    // 准备若干条测试鲸鱼数据（3 个 address，各自多条记录）
    const now = new Date()
    const clientData = [
      // address A: 最大 totalValueUsd
      {
        userAddress: '0xWhaleAddressA',
        symbol: 'BTC',
        positionSize: '10',
        entryPrice: '50000',
        liquidationPrice: '45000',
        positionValueUsd: '500000',
        positionAction: 1,
        createTime: now,
        source: 'TEST',
      },
      {
        userAddress: '0xWhaleAddressA',
        symbol: 'ETH',
        positionSize: '5',
        entryPrice: '3000',
        liquidationPrice: '2500',
        positionValueUsd: '15000',
        positionAction: 1,
        createTime: now,
        source: 'TEST',
      },
      // address B: 次大 totalValueUsd
      {
        userAddress: '0xWhaleAddressB',
        symbol: 'BTC',
        positionSize: '-2',
        entryPrice: '48000',
        liquidationPrice: '52000',
        positionValueUsd: '96000',
        positionAction: 2,
        createTime: now,
        source: 'TEST',
      },
      // address C: 最小 totalValueUsd
      {
        userAddress: '0xWhaleAddressC',
        symbol: 'SOL',
        positionSize: '100',
        entryPrice: '100',
        liquidationPrice: '80',
        positionValueUsd: '10000',
        positionAction: 1,
        createTime: now,
        source: 'TEST',
      },
    ]

    await client.hyperliquidWhaleAlert.createMany({
      data: clientData,
    })
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should aggregate whales and return recommended & details lists', async () => {
    const httpServer = app.getHttpServer()

    const res = await request(httpServer)
      .get('/api/v1/whale-tracking/discover')
      .expect(200)

    const body = res.body
    expect(body).toBeDefined()
    expect(body.data).toBeDefined()

    const data = body.data as {
      recommended: Array<{ address: string; totalValueUsd: number; variant: string }>
      details: Array<{ address: string; totalValueUsd: number; variant: string }>
    }

    expect(Array.isArray(data.recommended)).toBe(true)
    expect(Array.isArray(data.details)).toBe(true)
    expect(data.details.length).toBe(3)

    // details 应按 totalValueUsd 降序排列
    const sorted = [...data.details].sort((a, b) => b.totalValueUsd - a.totalValueUsd)
    expect(data.details.map(d => d.address)).toEqual(sorted.map(d => d.address))

    // address A 的总价值最高，应出现在 details[0] & recommended[0]
    const topDetail = data.details[0]
    expect(topDetail.address).toBe('0xWhaleAddressA')
    expect(topDetail.variant).toBe('detail')
    expect(topDetail.totalValueUsd).toBeGreaterThan(500000)

    const topRecommended = data.recommended[0]
    expect(topRecommended.address).toBe('0xWhaleAddressA')
    expect(topRecommended.variant).toBe('recommended')

    // recommended 最多 3 条，这里插入了 3 个地址，应全部入选
    expect(data.recommended.length).toBeLessThanOrEqual(3)
    expect(new Set(data.recommended.map(r => r.address)).size).toBe(3)
  })

  it('should return empty lists when no whale alerts exist', async () => {
    const client = prisma.getClient()
    await client.hyperliquidWhaleAlert.deleteMany({})

    const httpServer = app.getHttpServer()
    const res = await request(httpServer)
      .get('/api/v1/whale-tracking/discover')
      .expect(200)

    const body = res.body
    expect(body).toBeDefined()
    expect(body.data).toBeDefined()

    const data = body.data as { recommended: unknown[]; details: unknown[] }
    expect(Array.isArray(data.recommended)).toBe(true)
    expect(Array.isArray(data.details)).toBe(true)
    expect(data.recommended.length).toBe(0)
    expect(data.details.length).toBe(0)
  })
})







