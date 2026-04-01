import { buildAiQuantStageFallbackMessage, parseAiQuantErrorMeta } from './ai-quant-error-stage'

describe('aiQuantErrorStage', () => {
  it('parses nested error meta from standard backend payload', () => {
    const meta = parseAiQuantErrorMeta({
      error: {
        code: 'AI_PROVIDER_ERROR',
        stage: 'codegen',
        requestId: 'req-1',
        args: { reasonMessage: 'provider timeout' },
      },
    })

    expect(meta).toEqual({
      code: 'AI_PROVIDER_ERROR',
      message: 'provider timeout',
      requestId: 'req-1',
      stage: 'codegen',
    })
  })

  it('returns unknown stage for malformed payload', () => {
    expect(parseAiQuantErrorMeta({})).toEqual({ stage: 'unknown' })
  })

  it('builds fallback message with stage and code', () => {
    const text = buildAiQuantStageFallbackMessage('LLM 策略生成请求失败', 502, {
      stage: 'codegen',
      code: 'AI_PROVIDER_ERROR',
    })

    expect(text).toBe('LLM 策略生成请求失败 codegen (AI_PROVIDER_ERROR, HTTP 502)')
  })
})
