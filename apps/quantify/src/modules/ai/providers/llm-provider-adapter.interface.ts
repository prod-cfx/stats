export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatCompletionToolFunction {
  name: string
  description?: string
  // OpenAI JSON Schema 风格的参数定义，保持为宽松的 any 以兼容不同提供商
  // 由上层模块（如 llm-strategies）维护具体结构
  parameters?: Record<string, unknown>
}

export interface ChatCompletionTool {
  type: 'function'
  function: ChatCompletionToolFunction
}

export interface ChatCompletionToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    // OpenAI 会以字符串形式返回 JSON 参数
    arguments: string
  }
}

export type ToolChoice =
  | 'none'
  | 'auto'
  | {
      type: 'function'
      function: {
        name: string
      }
    }

export interface ChatMessage {
  role: ChatRole
  content: string
  /**
   * 当 role === 'tool' 时，可选的工具名称
   */
  name?: string
  /**
   * 当 role === 'tool' 时，对应的 tool_call_id，便于多轮工具调用关联
   */
  toolCallId?: string
  /**
   * 当 role === 'assistant' 且本次回复触发了工具调用时，包含工具调用列表
   */
  toolCalls?: ChatCompletionToolCall[]
}

export interface ChatCompletionOptions {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: ChatCompletionTool[]
  toolChoice?: ToolChoice
}

export interface ChatCompletionResult {
  content: string
  toolCalls?: ChatCompletionToolCall[]
}

export interface LlmProviderAdapter {
  sendChatCompletion: (options: ChatCompletionOptions) => Promise<ChatCompletionResult>
}
