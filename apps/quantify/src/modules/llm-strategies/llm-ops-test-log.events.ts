export const LLM_OPS_TEST_LOG_EVENT = 'llm.ops_test.log'

export type LlmOpsTestLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LlmOpsTestLogEvent {
  instanceId: string
  /**
   * 触发测试的运营操作人 ID
   */
  operatorId: string
  /**
   * 关联的运行记录 ID（如果已创建）
   */
  runId?: string
  level: LlmOpsTestLogLevel
  message: string
  timestamp: string
  /**
   * 可选的结构化上下文信息，方便调用方或日志系统做更细粒度展示。
   * - loopIndex: 当前对话轮次
   * - phase: 'loop' | 'assistant_reply' | 'tool_result' | 'final_summary' | 'error' 等
   * - role: 'system' | 'user' | 'assistant' | 'tool'
   * - 其它与 LLM 交互相关的元数据
   */
  meta?: Record<string, unknown>
}
