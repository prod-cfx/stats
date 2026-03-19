import type { INestApplication } from '@nestjs/common'
import { CacheService } from '@/common/services/cache.service'
import { createTestingApp } from '../fixtures/fixtures'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const randomSegment = () => Math.random().toString(36).slice(2)
const buildBaseKey = (scope: string) => `e2e:cache:${scope}:${Date.now()}:${randomSegment()}`

describe('Redis Cache Service (E2E)', () => {
  let app: INestApplication
  let cacheService: CacheService
  const trackedKeys = new Set<string>()

  const registerKey = (key: string): string => {
    trackedKeys.add(key)
    return key
  }

  beforeAll(async () => {
    const { app: testingApp } = await createTestingApp()
    app = testingApp
    cacheService = app.get(CacheService)
  })

  afterEach(async () => {
    if (!cacheService) return
    await Promise.all(Array.from(trackedKeys).map(key => cacheService.del(key)))
    trackedKeys.clear()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('should set, get, exists and delete cache entries', async () => {
    const key = registerKey(`${buildBaseKey('basic')}:value`)
    const payload = { foo: 'bar' }

    await cacheService.set(key, payload, 30)
    const result = await cacheService.get<typeof payload>(key)
    expect(result).toEqual(payload)
    expect(await cacheService.exists(key)).toBe(true)

    await cacheService.del(key)
    expect(await cacheService.get<typeof payload>(key)).toBeUndefined()
  })

  it('should expire keys after ttl', async () => {
    const key = registerKey(`${buildBaseKey('ttl')}:value`)
    await cacheService.set(key, 'temp', 1)
    await sleep(1500)
    expect(await cacheService.get(key)).toBeUndefined()
  })

  it('should list and delete by pattern', async () => {
    const prefix = buildBaseKey('pattern')
    const key1 = registerKey(`${prefix}:a`)
    const key2 = registerKey(`${prefix}:b`)

    await cacheService.set(key1, 'v1', 60)
    await cacheService.set(key2, 'v2', 60)

    const keys = await cacheService.keys(`${prefix}:*`)
    expect(keys).toEqual(expect.arrayContaining([key1, key2]))

    await cacheService.delByPattern(`${prefix}:*`)
    expect(await cacheService.get(key1)).toBeUndefined()
    expect(await cacheService.get(key2)).toBeUndefined()
  })

  it('should support setIfNotExists/deleteIfValue/refreshIfValue flow', async () => {
    const key = registerKey(`${buildBaseKey('lock')}:value`)
    const lockValue = { token: randomSegment() }

    const created = await cacheService.setIfNotExists(key, lockValue, 5)
    expect(created).toBe(true)

    const secondAttempt = await cacheService.setIfNotExists(key, { token: 'other' }, 5)
    expect(secondAttempt).toBe(false)

    const refreshed = await cacheService.refreshIfValue(key, lockValue, 10)
    expect(refreshed).toBe(true)

    const removed = await cacheService.deleteIfValue(key, lockValue)
    expect(removed).toBe(true)
    expect(await cacheService.get(key)).toBeUndefined()
  })
})
