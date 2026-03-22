import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import { Test } from '@nestjs/testing'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

// 通过环境变量控制是否实际访问 Coinglass，避免在 CI 默认跑外网依赖
const E2E_ENABLED = process.env.OPEN_INTEREST_E2E === 'true'
const describeIf = E2E_ENABLED ? describe : describe.skip

describeIf('Open interest sync via Coinglass (E2E)', () => {
  let app: INestApplication
  let prisma: any
  let openInterestService: any
  let openInterestSyncJob: any

  beforeAll(async () => {
    // 强制保护：仅允许在 APP_ENV === 'e2e' 环境下运行，防止误删非 e2e 数据库中的真实数据
    ensureE2eEnv({ strict: true, label: 'OpenInterestCoinglass' })

    // 确保在设置 APP_ENV / cwd 之后再加载 Nest 应用及 Prisma，防止连接到非 e2e 数据库
    // 通过重置模块缓存并动态导入相关模块，避免 defaultEnvAccessor 在错误环境中初始化
    jest.resetModules()
    const [{ AppModule }, { PrismaService }, { OpenInterestService }, { OpenInterestSyncJob }] =
      await Promise.all([
        import('../src/modules/app.module'),
        import('../src/prisma/prisma.service'),
        import('../src/modules/open-interest/open-interest.service'),
        import('../src/modules/open-interest/jobs/open-interest-sync.job'),
      ])

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

