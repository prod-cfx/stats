import { AiService } from './ai.service'
import { OpenAiCompatibleAdapter } from './providers/openai-compatible.adapter'

describe('aiService prompt logging', () => {
  const configServiceMock = {
    get: jest.fn(),
  }

  let service: AiService
  let promptLogEnabledRaw: string | undefined
  let mockEnabledRaw: string | undefined

  beforeEach(() => {
    jest.clearAllMocks()
    promptLogEnabledRaw = 'true'
    mockEnabledRaw = undefined
    configServiceMock.get.mockReset()
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'QUANTIFY_AI_PROMPT_LOG_ENABLED') {
        return promptLogEnabledRaw
      }
      if (key === 'QUANTIFY_AI_MOCK_ENABLED') {
        return mockEnabledRaw
      }
      if (key === 'ai') {
        return {
          uniapi: {
            apiKey: 'uni-key',
            baseUrl: 'https://api.example.com',
            defaultModel: 'gpt-4o-mini',
            timeoutMs: 1000,
            maxRetries: 0,
            retryDelayMs: 0,
          },
          strategyCodegen: {
            apiKey: 'codegen-key',
            baseUrl: 'https://api.codegen.example.com',
            defaultModel: 'gpt-4.1',
            timeoutMs: 1000,
            maxRetries: 0,
            retryDelayMs: 0,
          },
        }
      }
      return undefined
    })
    service = new AiService(configServiceMock as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('logs outbound prompt details before sending request', async () => {
    const sendSpy = jest
      .spyOn(OpenAiCompatibleAdapter.prototype, 'sendChatCompletion')
      .mockResolvedValue({ content: 'OK' })
    const debugSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined)

    await service.chat({
      providerCode: 'strategy-codegen',
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: '你是策略规划器。' },
        { role: 'user', content: '请根据 RSI 和均线生成策略。' },
      ],
      temperature: 0.2,
      maxTokens: 512,
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_trading_signal',
            description: '输出交易信号',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      toolChoice: 'auto',
      responseFormat: {
        type: 'json_schema',
        jsonSchema: {
          name: 'strategy_codegen_response_v1',
          strict: true,
          schema: {
            type: 'object',
            required: ['code'],
            properties: {
              code: { type: 'string' },
            },
          },
        },
      },
    })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('event=ai_outbound_prompt'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('"providerCode":"strategy-codegen"'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('"model":"gpt-5.4"'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('你是策略规划器'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('请根据 RSI 和均线生成策略'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('"toolChoice":"auto"'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('"responseFormat"'))
  })

  it('logs outbound prompt details in mock mode before short-circuit return', async () => {
    mockEnabledRaw = 'true'
    const sendSpy = jest.spyOn(OpenAiCompatibleAdapter.prototype, 'sendChatCompletion')
    const debugSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined)

    await service.chat({
      providerCode: 'strategy-codegen',
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'mock prompt please log me' }],
    })

    expect(sendSpy).not.toHaveBeenCalled()
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('event=ai_outbound_prompt'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('"mockEnabled":true'))
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('mock prompt please log me'))
  })

  it('does not log outbound prompt details when prompt logging is disabled', async () => {
    promptLogEnabledRaw = 'false'
    jest
      .spyOn(OpenAiCompatibleAdapter.prototype, 'sendChatCompletion')
      .mockResolvedValue({ content: 'OK' })
    const debugSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined)

    await service.chat({
      providerCode: 'strategy-codegen',
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'do not log me' }],
    })

    expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('event=ai_outbound_prompt'))
  })
})
