import {
  buildAiQuantErrorMessage,
  buildLocalizedBacktestErrorMessage,
  buildAiQuantStageFallbackMessage,
  parseAiQuantErrorMeta,
} from './ai-quant-error-stage'

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
      args: { reasonMessage: 'provider timeout' },
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

  it('keeps reason messages while appending stage, code, and requestId metadata', () => {
    const text = buildAiQuantErrorMessage('LLM 策略生成请求失败', 503, {
      stage: 'codegen',
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      requestId: 'req-503',
      message: '量化服务暂时不可用，请稍后重试',
    })

    expect(text).toBe(
      '量化服务暂时不可用，请稍后重试 codegen (SERVICE_TEMPORARILY_UNAVAILABLE, HTTP 503, requestId req-503)',
    )
  })

  it('prefers args.reasonCode as the effective business code', () => {
    const meta = parseAiQuantErrorMeta({
      error: {
        code: 'BAD_REQUEST',
        stage: 'backtest',
        args: {
          reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
          symbol: 'ORDIUSDT',
        },
      },
    })

    expect(meta).toEqual({
      code: 'BACKTEST_SYMBOL_UNAVAILABLE',
      stage: 'backtest',
      args: {
        reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
        symbol: 'ORDIUSDT',
      },
    })
  })

  it('renders localized readable backtest messages from structured business codes', () => {
    const t = (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'aiQuant.messages.backtestSymbolUnavailable':
          '当前策略标的 {{symbol}} 暂不支持回测，请先确认该标的的历史行情能力是否已接入。',
      }
      return (map[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_m, name) => String(options?.[name] ?? ''))
    }

    expect(buildLocalizedBacktestErrorMessage(t, 400, {
      code: 'BACKTEST_SYMBOL_UNAVAILABLE',
      stage: 'backtest',
      args: { symbol: 'ORDIUSDT' },
    })).toBe('当前策略标的 ORDIUSDT 暂不支持回测，请先确认该标的的历史行情能力是否已接入。')
  })
})
