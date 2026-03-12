import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'

import { AiService } from '@/modules/ai/ai.service'
import { AiProviderErrorException } from '@/modules/ai/exceptions/ai-provider-error.exception'
import { AiProviderNotFoundException } from '@/modules/ai/exceptions/ai-provider-not-found.exception'
import { createTestingApp } from '../fixtures/fixtures'

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

    // 浠呭湪鐜涓厤缃簡闈炲崰浣嶇殑 UNIAPI_API_KEY 鏃舵墠鎵ц鐪熷疄璋冪敤
    hasUniapiKey = isConfiguredKey(process.env.UNIAPI_API_KEY)
  })

  afterAll(async () => {
    await app.close()
  })

  it('should make a real call using AiService with uniapi config', async () => {
    if (!hasUniapiKey) {
      // 榛樿鐜鏈厤缃?UNIAPI_API_KEY 鏃讹紝涓嶅己鍒惰姹傜湡瀹炲閮ㄨ皟鐢紝閬垮厤 CI 蹇呯劧澶辫触
      // 鏈湴鎴?CI 濡傞渶瀹屾暣 E2E锛岃鍦?.env.e2e(.local) 涓厤缃?UNIAPI_API_KEY
      console.warn('[AiService E2E] 妫€娴嬪埌鏈厤缃?UNIAPI_API_KEY锛岃烦杩囩湡瀹?uniapi 璋冪敤鐢ㄤ緥')
      return
    }

    try {
      const result = await aiService.chat({
        providerCode: 'uniapi',
        model: 'o4-mini',
        messages: [
          { role: 'system', content: '浣犳槸涓€涓敤浜?E2E 娴嬭瘯鐨勭畝鐭洖绛斿姪鎵嬨€? },
          { role: 'user', content: '鐢ㄤ竴鍙ヨ瘽绠€鍗曚粙缁嶄竴涓嬩綘鑷繁銆? },
        ],
        temperature: 0.2,
        maxTokens: 64,
      })

      expect(typeof result.content).toBe('string')
    }
    catch (error) {
      // 鍦ㄧ綉缁滄垨绗笁鏂规湇鍔″紓甯告椂锛岃姹傝繑鍥炶鑼冪殑 AI_PROVIDER_ERROR 涓氬姟寮傚父
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
