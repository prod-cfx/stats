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
  // 当前系统默认仅配置 uniapi 作为 OpenAI 兼容提供商
  private static readonly DEFAULT_PROVIDER_CODE = 'uniapi'
  private static readonly DEFAULT_MODEL = 'gpt-4'

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

    // 目前只支持 uniapi 提供商
    if (providerCode !== AiService.DEFAULT_PROVIDER_CODE) {
      throw new AiProviderNotFoundException({ providerCode })
    }

    const aiConfig = this.configService.get('ai')
    const apiKey = aiConfig?.uniapi?.apiKey
    if (!apiKey) {
      this.logger.error('UNIAPI_API_KEY is not configured. AI config:', aiConfig)
      throw new AiProviderErrorException({ providerCode, reason: 'NO_API_KEY', detail: 'UNIAPI_API_KEY is not configured' })
    }

    const baseUrl = aiConfig?.uniapi?.baseUrl || 'https://api.uniapi.io'
    const model = options.model ?? AiService.DEFAULT_MODEL
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
      const detail = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`AI provider request failed: ${detail}`)
      if (stack) {
        this.logger.error(`Error stack: ${stack}`)
      }
      throw new AiProviderErrorException({ providerCode, reason: 'PROVIDER_REQUEST_FAILED', detail })
    }
  }
}
