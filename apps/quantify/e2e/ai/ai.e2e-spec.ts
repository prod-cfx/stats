import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { AiService } from '@/modules/ai/ai.service'
import { AiProviderErrorException } from '@/modules/ai/exceptions/ai-provider-error.exception'
import { AiProviderNotFoundException } from '@/modules/ai/exceptions/ai-provider-not-found.exception'
import { createTestingApp } from '../fixtures/fixtures'
import { getE2eEnvValue } from '../helpers/setup-e2e-env'

const isConfiguredKey = (value: string | undefined | null): boolean => {
  const trimmed = value?.trim()
  if (!trimmed)
    return false
  if (trimmed === '__SET_IN_env.local__')
    return false
  return true
}

describe('AiService (E2E)', () => {
  let app: INestApplication
  let moduleFixture: TestingModule
  let aiService: AiService
  let hasUniapiKey = false

  beforeAll(async () => {
    const result = await createTestingApp()
    app = result.app
    moduleFixture = result.moduleFixture
    aiService = moduleFixture.get(AiService)

    // 仅在环境中配置了非占位的 UNIAPI_API_KEY 时才执行真实调用
    hasUniapiKey = isConfiguredKey(getE2eEnvValue('UNIAPI_API_KEY'))
  })

  afterAll(async () => {
    await app.close()
  })

  it('should make a real call using AiService with uniapi config', async () => {
    if (!hasUniapiKey) {
      // 默认环境未配置 UNIAPI_API_KEY 时，不强制要求真实外部调用，避免 CI 必然失败
      // 本地或 CI 如需完整 E2E，请在 .env.e2e(.local) 中配置 UNIAPI_API_KEY
      console.warn('[AiService E2E] 检测到未配置 UNIAPI_API_KEY，跳过真实 uniapi 调用用例')
      return
    }

    try {
      const result = await aiService.chat({
        providerCode: 'uniapi',
        model: 'o4-mini',
        messages: [
          { role: 'system', content: '你是一个用于 E2E 测试的简短回答助手。' },
          { role: 'user', content: '用一句话简单介绍一下你自己。' },
        ],
        temperature: 0.2,
        maxTokens: 64,
      })

      expect(typeof result.content).toBe('string')
    }
    catch (error) {
      // 在网络或第三方服务异常时，要求返回规范的 AI_PROVIDER_ERROR 业务异常
      expect(error).toBeInstanceOf(AiProviderErrorException)
    }
  })

  it('should throw business exception when providerCode is invalid', async () => {
    await expect(
      aiService.chat({
        providerCode: 'non-existent-provider',
        model: 'o4-mini',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toBeInstanceOf(AiProviderNotFoundException)
  })
})
