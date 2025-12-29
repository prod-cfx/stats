import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { resolve } from 'node:path'
import { Test } from '@nestjs/testing'

import { AppModule } from '../src/modules/app.module'
import { OpenInterestSyncJob } from '../src/modules/open-interest/jobs/open-interest-sync.job'
import { OpenInterestService } from '../src/modules/open-interest/open-interest.service'
import { PrismaService } from '../src/prisma/prisma.service'

// 通过环境变量控制是否实际访问 Coinglass，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.OPEN_INTEREST_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Open interest sync via Coinglass (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let openInterestService: OpenInterestService
  let openInterestSyncJob: OpenInterestSyncJob

  beforeAll(async () => {
    // 强制保护：仅允许在 APP_ENV === 'e2e' 环境下运行，防止误删非 e2e 数据库中的真实数据
    if (process.env.APP_ENV && process.env.APP_ENV !== 'e2e') {
      // 显式抛错而不是静默跳过，避免在错误环境下执行破坏性操作
      throw new Error(
        `Open interest Coinglass E2E must run with APP_ENV=e2e, current APP_ENV=${process.env.APP_ENV}`,
      )
    }
    if (!process.env.APP_ENV) {
      process.env.APP_ENV = 'e2e'
    }

    // 与 main.ts 保持一致，从 monorepo 根目录加载环境
    process.chdir(resolve(__dirname, '../../..'))

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    openInterestService = app.get(OpenInterestService)
    openInterestSyncJob = app.get(OpenInterestSyncJob)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should fetch futures open interest from Coinglass and persist BTC/All record', async () => {
    const client = prisma.getClient()

    // 清理 BTC 相关的历史持仓量数据，确保本次拉取效果可观测
    await client.openInterest.deleteMany({
      where: {
        symbol: 'BTC',
      },
    })

    const beforeCount = await client.openInterest.count({
      where: {
        symbol: 'BTC',
      },
    })

    // 直接通过 OpenInterestSyncJob 执行一次真实的 Coinglass 拉取
    const result = await openInterestSyncJob.run({
      taskId: 0,
      key: openInterestSyncJob.key,
      cursor: null,
      meta: null,
      now: new Date(),
    })

    const afterCount = await client.openInterest.count({
      where: {
        symbol: 'BTC',
      },
    })

    // 至少应有一条新的持仓量记录被写入
    expect(result.fetchedCount).toBeGreaterThan(0)
    expect(afterCount).toBeGreaterThan(beforeCount)

    // 验证聚合的 All 交易所最新数据是否存在且数值合理
    const latestAll = await openInterestService.getLatest('All', 'BTC')

    expect(latestAll).toBeTruthy()
    expect(Number((latestAll as any).openInterestUsd ?? 0)).toBeGreaterThan(0)
  })
})
