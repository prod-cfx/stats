export const LLM_OPS_TEST_LOG_EVENT = 'llm.ops_test.log'

export type LlmOpsTestLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LlmOpsTestLogEvent {
  instanceId: string
  /**
   * 瑙﹀彂娴嬭瘯鐨勮繍钀ユ搷浣滀汉 ID
   */
  operatorId: string
  /**
   * 鍏宠仈鐨勮繍琛岃褰?ID锛堝鏋滃凡鍒涘缓锛?
   */
  runId?: string
  level: LlmOpsTestLogLevel
  message: string
  timestamp: string
  /**
   * 鍙€夌殑缁撴瀯鍖栦笂涓嬫枃淇℃伅锛屾柟渚胯皟鐢ㄦ柟鎴栨棩蹇楃郴缁熷仛鏇寸粏绮掑害灞曠ず锛?
   * - loopIndex: 褰撳墠瀵硅瘽杞
   * - phase: 'loop' | 'assistant_reply' | 'tool_result' | 'final_summary' | 'error' 绛?
   * - role: 'system' | 'user' | 'assistant' | 'tool'
   * - 鍏跺畠涓?LLM 浜や簰鐩稿叧鐨勫厓鏁版嵁
   */
  meta?: Record<string, unknown>
}
