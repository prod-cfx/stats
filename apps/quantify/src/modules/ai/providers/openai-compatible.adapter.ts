import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatCompletionToolCall,
  LlmProviderAdapter,
} from './llm-provider-adapter.interface'
import { AiProviderErrorException } from '../exceptions/ai-provider-error.exception'

interface OpenAiCompatibleConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      // OpenAI tools: assistant 娑堟伅涓殑宸ュ叿璋冪敤
      tool_calls?: Array<{
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

interface OpenAiErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

interface OpenAiChatCompletionMessageParam {
  role: string
  content?: string | null
  name?: string
  tool_calls?: Array<{
    id?: string
    type?: string
    function?: {
      name?: string
      arguments?: string
    }
  }>
  // tool 瑙掕壊娑堟伅鐨勫伐鍏疯皟鐢?ID
  tool_call_id?: string
}

export class OpenAiCompatibleAdapter implements LlmProviderAdapter {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async sendChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (options.stream)
      throw new AiProviderErrorException({ providerCode: 'openai-compatible', reason: 'Streaming not supported', detail: 'Streaming chat completion is not supported yet' })

    const url = this.buildUrl('v1/chat/completions')
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
    const timeoutId
      = controller && this.config.timeoutMs
        ? setTimeout(() => controller.abort(), this.config.timeoutMs)
        : undefined

    try {
      const payloadMessages: OpenAiChatCompletionMessageParam[] = options.messages.map(message => {
        const base: OpenAiChatCompletionMessageParam = {
          role: message.role,
          content: message.content,
        }

        // OpenAI tools 鍗忚锛歳ole='tool' 娑堟伅涓嶆帴鍙?name 瀛楁
        // 浠呭闈?tool 瑙掕壊淇濈暀 name锛堜緥濡傚嚱鏁板悕绛夊厓淇℃伅锛?
        if (message.name && message.role !== 'tool') {
          base.name = message.name
        }

        // 灏嗗唴閮ㄧ殑 toolCalls 鏄犲皠涓?OpenAI 瑕佹眰鐨?tool_calls 瀛楁
        if (message.toolCalls && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
          base.tool_calls = message.toolCalls.map(call => ({
            id: call.id,
            type: call.type,
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          }))
        }

        // 灏嗗唴閮ㄧ殑 toolCallId 鏄犲皠涓?OpenAI 瑕佹眰鐨?tool_call_id 瀛楁
        if (message.toolCallId) {
          base.tool_call_id = message.toolCallId
        }

        return base
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: payloadMessages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          stream: false,
          // OpenAI tools / tool_choice 璇箟锛屼繚鎸佷竴灞傞€忎紶
          tools: options.tools,
          tool_choice: options.toolChoice,
        }),
        signal: controller?.signal,
      })

      const text = await response.text()
      const payload = text ? JSON.parse(text) as OpenAiChatCompletionResponse & OpenAiErrorResponse : {}

      if (!response.ok) {
        const message = payload.error?.message ?? `OpenAI compatible request failed with status ${response.status}`
        throw new AiProviderErrorException({ providerCode: 'openai-compatible', reason: 'Request failed', detail: message })
      }

      const message = payload.choices?.[0]?.message
      const content = message?.content ?? ''

      let toolCalls: ChatCompletionToolCall[] | undefined
      if (message?.tool_calls && Array.isArray(message.tool_calls)) {
        toolCalls = message.tool_calls
          .map(call => {
            const name = call.function?.name
            const args = call.function?.arguments ?? '{}'
            if (!name) return null
            return {
              id: call.id ?? '',
              type: 'function' as const,
              function: {
                name,
                arguments: args,
              },
            } satisfies ChatCompletionToolCall
          })
          .filter((c): c is ChatCompletionToolCall => c !== null)
      }

      return { content, toolCalls }
    }
    finally {
      if (timeoutId)
        clearTimeout(timeoutId)
    }
  }

  private buildUrl(path: string): string {
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`
    return new URL(path, base).toString()
  }
}
