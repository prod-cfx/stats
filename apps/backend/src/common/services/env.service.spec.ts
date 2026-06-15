import type { ConfigService } from '@nestjs/config'
import { EnvService } from './env.service'

function createConfigService(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  } as unknown as ConfigService
}

describe('EnvService', () => {
  it('uses namespaced app.appEnv when resolving test environment', () => {
    const envService = new EnvService(createConfigService({ APP_ENV: 'production', 'app.appEnv': 'test' }))

    expect(envService.isTest()).toBe(true)
  })
})
