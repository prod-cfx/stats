import type { INestApplication } from '@nestjs/common'
import type { ApiClient, TestingAppContext } from '../fixtures/fixtures'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HealthController } from '@/modules/health/health.controller'
import { HealthModule } from '@/modules/health/health.module'
import { HealthService } from '@/modules/health/health.service'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

const shardedConfigService = {
  get: (key: string) => {
    if (key === 'sharding') {
      return {
        enabled: true,
        count: 4,
        index: 2,
      }
    }
    return undefined
  },
}

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: ConfigService,
      useValue: shardedConfigService,
    },
  ],
})
class ShardedHealthTestModule {}

describe('HealthController (E2E)', () => {
  let app: INestApplication
  let client: ApiClient

  beforeEach(async () => {
    try {
      const context: TestingAppContext = await createTestingApp({
        imports: [HealthModule],
      })
      app = context.app
      client = createApiClient(app)
    }
    catch (error) {
      console.error('Failed to create testing app:', error)
      throw error
    }
  })

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('/health (GET)', () => {
    return client
      .get('health')
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('service', 'quantify')
        expect(res.body).toHaveProperty('status', 'ok')
        expect(res.body).toHaveProperty('timestamp')
        expect(res.body).toHaveProperty('shard')
        expect(res.body.shard).toEqual({
          enabled: false,
          count: 1,
          index: 0,
          activeStrategies: 0,
        })
      })
  })

  it('/health (GET) exposes configured shard metadata', async () => {
    await app.close()
    const context: TestingAppContext = await createTestingApp({
      imports: [ShardedHealthTestModule],
    })
    app = context.app
    client = createApiClient(app)

    return client
      .get('health')
      .expect(200)
      .expect(res => {
        expect(res.body.shard).toEqual({
          enabled: true,
          count: 4,
          index: 2,
          activeStrategies: 0,
        })
      })
  })
})
