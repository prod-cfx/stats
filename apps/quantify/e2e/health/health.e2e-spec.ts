import type { INestApplication } from '@nestjs/common'
import type { ApiClient, TestingAppContext } from '../fixtures/fixtures'
import { HealthModule } from '@/modules/health/health.module'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

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
      })
  })
})
