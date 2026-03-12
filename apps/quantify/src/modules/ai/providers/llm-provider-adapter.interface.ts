export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ChatCompletionToolFunction {
  name: string
  description?: string
  // OpenAI JSON Schema 椋庢牸鐨勫弬鏁板畾涔夛紝淇濇寔涓哄鏉剧殑 any 浠ュ吋瀹逛笉鍚屾彁渚涘晢
  // 鐢变笂灞傛ā鍧楋紙濡?llm-strategies锛夌淮鎶ゅ叿浣撶粨鏋勩€?
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
    // OpenAI 浼氫互瀛楃涓插舰寮忚繑鍥?JSON 鍙傛暟
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
   * 褰?role === 'tool' 鏃讹紝鍙€夌殑宸ュ叿鍚嶇О
   */
  name?: string
  /**
   * 褰?role === 'tool' 鏃讹紝瀵瑰簲鐨?tool_call_id锛屼究浜庡杞伐鍏疯皟鐢ㄥ叧鑱?
   */
  toolCallId?: string
  /**
   * 褰?role === 'assistant' 涓旀湰娆″洖澶嶈Е鍙戜簡宸ュ叿璋冪敤鏃讹紝鍖呭惈宸ュ叿璋冪敤鍒楄〃
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
