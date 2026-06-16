import { HealthController } from './health.controller'
import { HealthService } from './health.service'

function createController() {
  const health = { service: 'backend', status: 'ok' as const, timestamp: '2026-06-16T00:00:00.000Z' }
  const healthService = {
    getHealth: jest.fn(() => health),
    getLiveHealth: jest.fn(() => health),
    getReadyHealth: jest.fn(async () => health),
  }
  const controller = new HealthController(healthService as unknown as HealthService)

  return { controller, health, healthService }
}

describe('HealthController', () => {
  it('keeps the compatibility health entrypoint', () => {
    const { controller, health, healthService } = createController()

    expect(controller.health()).toBe(health)
    expect(healthService.getHealth).toHaveBeenCalledTimes(1)
  })

  it('exposes liveness through the live health service path', () => {
    const { controller, health, healthService } = createController()

    expect(controller.live()).toBe(health)
    expect(healthService.getLiveHealth).toHaveBeenCalledTimes(1)
  })

  it('exposes readiness through the ready health service path', async () => {
    const { controller, health, healthService } = createController()

    await expect(controller.ready()).resolves.toBe(health)
    expect(healthService.getReadyHealth).toHaveBeenCalledTimes(1)
  })
})
