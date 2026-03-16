import type { LlmV3ToolName } from '@/modules/ai/llm-v3-tools.schemas'
import type { ChatCompletionToolCall } from '@/modules/ai/providers/llm-provider-adapter.interface'
import type { LlmStrategy, LlmStrategyInstance } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 LlmV3ToolsExecutor
import { LlmV3ToolsExecutor } from '@/modules/ai/llm-v3-tools.executor'

export interface LlmToolExecutionContext {
  instance: LlmStrategyInstance & { strategy: LlmStrategy }
  /**
   * 合并后的风险配置（strategy.riskConfig + instance.configOverrides）
   */
  effectiveRiskConfig: Record<string, unknown> | null
  /**
   * 账户/组合占位信息，当前实现仅保留 ID，后续可扩展为完整快照
   */
  accountSnapshot?: { id: string } | null
  portfolioSnapshot?: { id: string } | null
  /**
   * 会话 ID（用于跨工具调用共享缓存，例如使用 contextId 时）
   */
  sessionId?: string
}

export interface LlmToolExecutionResult {
  name: string
  id: string
  /**
   * 返回给 LLM 的原始 JSON 可序列化数据
   */
  output: unknown
}

@Injectable()
export class LlmToolsService {
  private readonly logger = new Logger(LlmToolsService.name)

  constructor(private readonly toolsExecutor: LlmV3ToolsExecutor) {}

  /**
   * 执行单个工具调用。
   *
   * 说明：
   * - 数据查询与计算工具（get_symbol_universe、get_market_data_raw、compute_technical_indicators、compute_financial_metrics）
   *   委托给 LlmV3ToolsExecutor 执行
   * - generate_trading_signal 作为“终止工具”，由 orchestrator 直接解析参数
   */
  async executeTool(
    call: ChatCompletionToolCall,
    context: LlmToolExecutionContext,
  ): Promise<LlmToolExecutionResult> {
    const name = call.function.name

    this.logger.debug(
      `Executing LLM tool "${name}" for instance ${context.instance.id} (strategy ${context.instance.strategyId})`,
    )

    // 数据查询与计算工具：委托给 LlmV3ToolsExecutor
    const dataQueryTools: LlmV3ToolName[] = [
      'get_symbol_universe',
      'get_market_data_raw',
      'compute_technical_indicators',
      'compute_financial_metrics',
    ]

    if (dataQueryTools.includes(name as LlmV3ToolName)) {
      try {
        const params = JSON.parse(call.function.arguments || '{}')

        // 传递 sessionId，支持 contextId 跨工具调用缓存
        const output = await this.toolsExecutor.executeTool(
          name as LlmV3ToolName,
          params,
          context.instance.id,
          context.sessionId, // 从 context 传递 sessionId（通常为 runId）
        )

        return {
          name,
          id: call.id,
          output,
        }
      } catch (error) {
        this.logger.error(
          `Failed to execute tool "${name}": ${error instanceof Error ? error.message : String(error)}`,
        )
        return {
          name,
          id: call.id,
          output: {
            error: true,
            message: error instanceof Error ? error.message : String(error),
          },
        }
      }
    }

    // 其他工具：返回占位结果
    return {
      name,
      id: call.id,
      output: {
        ok: true,
        tool: name,
        message: 'Tool execution placeholder. No-op implementation.',
      },
    }
  }

  /**
   * 清理指定会话的缓存。
   * 在 LLM 运行结束（无论成功或失败）后调用，避免内存中积累无用的会话缓存。
   */
  clearSessionCache(strategyInstanceId: string, sessionId: string): void {
    this.toolsExecutor.clearSessionCache(strategyInstanceId, sessionId)
  }
}
