import { HealthService } from './health.service'

describe('healthService', () => {
  it('returns quantify as service name', () => {
    const service = new HealthService()

    expect(service.getHealth().service).toBe('quantify')
  })
})
