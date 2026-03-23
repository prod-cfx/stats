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
  maxRetries?: number
  retryDelayMs?: number
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      // OpenAI tools: assistant 消息中的工具调用
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
  // tool 角色消息的工具调用 ID
  tool_call_id?: string
}

export class OpenAiCompatibleAdapter implements LlmProviderAdapter {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async sendChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (options.stream)
      throw new AiProviderErrorException({ providerCode: 'openai-compatible', reason: 'Streaming not supported', detail: 'Streaming chat completion is not supported yet' })

    const url = this.buildUrl('v1/chat/completions')

    const maxRetries = Math.max(0, this.config.maxRetries ?? 1)
    const retryDelayMs = Math.max(0, this.config.retryDelayMs ?? 300)
    let lastError: unknown

    const payloadMessages: OpenAiChatCompletionMessageParam[] = options.messages.map(message => {
        const base: OpenAiChatCompletionMessageParam = {
          role: message.role,
          content: message.content,
        }

        // OpenAI tools 协议：role='tool' 消息不接受 name 字段
        // 仅对非 tool 角色保留 name（例如函数名等元信息）
        if (message.name && message.role !== 'tool') {
          base.name = message.name
        }

        // 将内部的 toolCalls 映射到 OpenAI 要求的 tool_calls 字段
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

        // 将内部的 toolCallId 映射到 OpenAI 要求的 tool_call_id 字段
        if (message.toolCallId) {
          base.tool_call_id = message.toolCallId
        }

        return base
      })

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined
      const timeoutId
        = controller && this.config.timeoutMs
          ? setTimeout(() => controller.abort(), this.config.timeoutMs)
          : undefined
      try {
        try {
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
              // OpenAI tools / tool_choice 语义，保持一层透传
              tools: options.tools,
              tool_choice: options.toolChoice,
              response_format: options.responseFormat
                ? {
                    type: options.responseFormat.type,
                    json_schema: {
                      name: options.responseFormat.jsonSchema.name,
                      strict: options.responseFormat.jsonSchema.strict ?? true,
                      schema: options.responseFormat.jsonSchema.schema,
                    },
                  }
                : undefined,
            }),
            signal: controller?.signal,
          })

          const text = await response.text()
          const payload = text ? JSON.parse(text) as OpenAiChatCompletionResponse & OpenAiErrorResponse : {}

          if (!response.ok) {
            const message = payload.error?.message ?? `OpenAI compatible request failed with status ${response.status}`
            if (this.isRetryableStatus(response.status) && attempt < maxRetries) {
              await this.sleep(retryDelayMs * (attempt + 1))
              continue
            }
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
        } catch (error) {
          lastError = error
          if (attempt < maxRetries && this.isRetryableError(error)) {
            await this.sleep(retryDelayMs * (attempt + 1))
            continue
          }
          throw error
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AiProviderErrorException({ providerCode: 'openai-compatible', reason: 'Request failed', detail: 'Unknown provider error' })
  }

  private isRetryableStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof AiProviderErrorException) {
      const detail = String(error.args?.detail ?? '').toLowerCase()
      return detail.includes('timeout') || detail.includes('aborted') || detail.includes('429') || detail.includes('5')
    }
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return message.includes('aborted')
      || message.includes('timeout')
      || message.includes('network')
      || message.includes('fetch')
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  private buildUrl(path: string): string {
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`
    return new URL(path, base).toString()
  }
}
