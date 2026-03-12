import type { INestApplication } from '@nestjs/common'
import type { ApiClient, TestingAppContext } from '../fixtures/fixtures'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('HealthController (E2E)', () => {
  let app: INestApplication
  let client: ApiClient

  beforeEach(async () => {
    try {
      const context: TestingAppContext = await createTestingApp()
      app = context.app
      client = createApiClient(app)
    }
    catch (error) {
      console.error('Failed to create testing app:', error)
      throw error
    }
  })

  afterEach(async () => {
    await app.close()
  })

  it('/health (GET)', () => {
    return client
      .get('health')
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveProperty('data')
        expect(res.body.data).toHaveProperty('status', 'ok')
        expect(res.body.data).toHaveProperty('timestamp')
        expect(res.headers['x-request-id']).toBeDefined()
      })
  })
})
