import type {
  ChatCompletionResult,
  ChatCompletionTool,
  ChatMessage,
  LlmProviderAdapter,
  ToolChoice,
} from './providers/llm-provider-adapter.interface'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 ConfigService
import { ConfigService } from '@nestjs/config'

import { AiProviderErrorException } from './exceptions/ai-provider-error.exception'
import { AiProviderNotFoundException } from './exceptions/ai-provider-not-found.exception'
import { OpenAiCompatibleAdapter } from './providers/openai-compatible.adapter'

export interface AiChatOptions {
  providerCode?: string
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  tools?: ChatCompletionTool[]
  toolChoice?: ToolChoice
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  // 默认 provider 仍保留 uniapi，避免影响其他调用路径
  private static readonly DEFAULT_PROVIDER_CODE = 'uniapi'
  private static readonly STRATEGY_CODEGEN_PROVIDER_CODE = 'strategy-codegen'
  private static readonly DEFAULT_MODEL = 'gpt-4'
  private static readonly MOCK_SIGNAL_TOOL_NAME = 'generate_trading_signal'

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async chat(options: AiChatOptions): Promise<ChatCompletionResult> {
    if (!options.messages?.length) {
      throw new AiProviderErrorException({
        providerCode: options.providerCode ?? AiService.DEFAULT_PROVIDER_CODE,
        reason: 'EMPTY_MESSAGES',
        detail: 'Chat messages must not be empty',
      })
    }

    const providerCode = options.providerCode ?? AiService.DEFAULT_PROVIDER_CODE

    if (
      providerCode !== AiService.DEFAULT_PROVIDER_CODE
      && providerCode !== AiService.STRATEGY_CODEGEN_PROVIDER_CODE
    ) {
      throw new AiProviderNotFoundException({ providerCode })
    }

    // 本地联调用：允许在未配置真实 provider 时仍能产出 tool call 信号。
    if (this.isMockAiEnabled()) {
      return this.buildMockCompletion(options)
    }

    const aiConfig = this.configService.get('ai')
    const providerConfig = providerCode === AiService.STRATEGY_CODEGEN_PROVIDER_CODE
      ? aiConfig?.strategyCodegen
      : aiConfig?.uniapi
    const apiKey = providerConfig?.apiKey
    if (!apiKey) {
      const missingKeyName = providerCode === AiService.STRATEGY_CODEGEN_PROVIDER_CODE
        ? 'LLM_STRATEGY_CODEGEN_API_KEY'
        : 'UNIAPI_API_KEY'
      this.logger.error(`${missingKeyName} is not configured. AI config:`, aiConfig)
      throw new AiProviderErrorException({ providerCode, reason: 'NO_API_KEY', detail: `${missingKeyName} is not configured` })
    }

    const baseUrl = providerConfig?.baseUrl || 'https://api.uniapi.io'
    const model = options.model ?? providerConfig?.defaultModel ?? AiService.DEFAULT_MODEL
    this.logger.debug(`AI request: model=${model}, baseUrl=${baseUrl}, messages=${options.messages.length}`)

    const adapter: LlmProviderAdapter = new OpenAiCompatibleAdapter({
      baseUrl,
      apiKey,
      // 默认超时时间 30s，避免多轮工具调用场景过早中断
      timeoutMs: 30_000,
    })
    try {
      return await adapter.sendChatCompletion({
        model,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools,
        toolChoice: options.toolChoice,
      })
    }
    catch (error) {
      const nestedArgs = error instanceof AiProviderErrorException ? error.args : undefined
      const nestedDetail = nestedArgs && typeof nestedArgs.detail === 'string' ? nestedArgs.detail : undefined
      const nestedReason = nestedArgs && typeof nestedArgs.reason === 'string' ? nestedArgs.reason : undefined
      const detail = nestedDetail ?? (error instanceof Error ? error.message : String(error))
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`AI provider request failed: ${detail}`)
      if (stack) {
        this.logger.error(`Error stack: ${stack}`)
      }
      throw new AiProviderErrorException({ providerCode, reason: nestedReason ?? 'PROVIDER_REQUEST_FAILED', detail })
    }
  }

  private isMockAiEnabled(): boolean {
    const raw = process.env.QUANTIFY_AI_MOCK_ENABLED
    if (!raw) return false
    return raw === '1' || raw.toLowerCase() === 'true'
  }

  private extractSymbolFromMessages(messages: ChatMessage[]): string {
    for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
      const message = messages[idx]
      if (!message || typeof message.content !== 'string') continue
      const matched = message.content.toUpperCase().match(/\b[A-Z]{2,12}USDT\b/)
      if (matched?.[0]) return matched[0]
    }
    return 'BTCUSDT'
  }

  private buildMockCompletion(options: AiChatOptions): ChatCompletionResult {
    const signalTool = options.tools?.find(tool => tool.function?.name === AiService.MOCK_SIGNAL_TOOL_NAME)
    if (!signalTool) {
      return {
        content: 'MOCK_AI_RESPONSE',
      }
    }

    const symbol = this.extractSymbolFromMessages(options.messages)
    const toolArguments = {
      symbol,
      direction: 'BUY',
      signalType: 'ALERT',
      confidence: 68,
      entryPrice: 70120,
      stopLoss: 69480,
      takeProfit: 70980,
      reasoning: 'Mock AI signal for local integration testing.',
      positionSizeQuote: 120,
      positionSizeRatio: 0.05,
      meta: {
        source: 'mock-ai-provider',
      },
    }

    return {
      content: '',
      toolCalls: [
        {
          id: `mock-call-${Date.now()}`,
          type: 'function',
          function: {
            name: AiService.MOCK_SIGNAL_TOOL_NAME,
            arguments: JSON.stringify(toolArguments),
          },
        },
      ],
    }
  }
}
