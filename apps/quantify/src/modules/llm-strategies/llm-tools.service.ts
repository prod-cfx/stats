import type { LlmStrategy, LlmStrategyInstance } from '@prisma/client'
import type { LlmV3ToolName } from '@/modules/ai/llm-v3-tools.schemas'
import type { ChatCompletionToolCall } from '@/modules/ai/providers/llm-provider-adapter.interface'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 LlmV3ToolsExecutor
import { LlmV3ToolsExecutor } from '@/modules/ai/llm-v3-tools.executor'

export interface LlmToolExecutionContext {
  instance: LlmStrategyInstance & { strategy: LlmStrategy }
  /**
   * 鍚堝苟鍚庣殑椋庨櫓閰嶇疆锛坰trategy.riskConfig + instance.configOverrides锛?
   */
  effectiveRiskConfig: Record<string, unknown> | null
  /**
   * 璐︽埛/缁勫悎鍗犱綅淇℃伅锛屽綋鍓嶅疄鐜颁粎淇濈暀 ID锛屽悗缁彲鎵╁睍涓哄畬鏁村揩鐓?
   */
  accountSnapshot?: { id: string } | null
  portfolioSnapshot?: { id: string } | null
  /**
   * 浼氳瘽 ID锛堢敤浜庤法宸ュ叿璋冪敤鍏变韩缂撳瓨锛屼緥濡備娇鐢?contextId 鏃讹級
   */
  sessionId?: string
}

export interface LlmToolExecutionResult {
  name: string
  id: string
  /**
   * 杩斿洖缁?LLM 鐨勫師濮?JSON 鍙簭鍒楀寲鏁版嵁
   */
  output: unknown
}

@Injectable()
export class LlmToolsService {
  private readonly logger = new Logger(LlmToolsService.name)

  constructor(private readonly toolsExecutor: LlmV3ToolsExecutor) {}

  /**
   * 鎵ц鍗曚釜宸ュ叿璋冪敤銆?
   *
   * 璇存槑锛?
   * - 鏁版嵁鏌ヨ涓庤绠楀伐鍏凤紙get_symbol_universe銆乬et_market_data_raw銆乧ompute_technical_indicators銆乧ompute_financial_metrics锛?
   *   濮旀墭缁?LlmV3ToolsExecutor 鎵ц
   * - generate_trading_signal 浣滀负"缁堟宸ュ叿"鐢?orchestrator 鐩存帴瑙ｆ瀽鍙傛暟
   */
  async executeTool(
    call: ChatCompletionToolCall,
    context: LlmToolExecutionContext,
  ): Promise<LlmToolExecutionResult> {
    const name = call.function.name

    this.logger.debug(
      `Executing LLM tool "${name}" for instance ${context.instance.id} (strategy ${context.instance.strategyId})`,
    )

    // 鏁版嵁鏌ヨ涓庤绠楀伐鍏凤細濮旀墭缁?LlmV3ToolsExecutor
    const dataQueryTools: LlmV3ToolName[] = [
      'get_symbol_universe',
      'get_market_data_raw',
      'compute_technical_indicators',
      'compute_financial_metrics',
    ]

    if (dataQueryTools.includes(name as LlmV3ToolName)) {
      try {
        const params = JSON.parse(call.function.arguments || '{}')

        // 浼犻€?sessionId锛屾敮鎸?contextId 璺ㄥ伐鍏疯皟鐢ㄧ紦瀛?
        const output = await this.toolsExecutor.executeTool(
          name as LlmV3ToolName,
          params,
          context.instance.id,
          context.sessionId, // 浠?context 浼犻€?sessionId锛堥€氬父鏄?runId锛?
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

    // 鍏朵粬宸ュ叿锛氳繑鍥炲崰浣嶇粨鏋?
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
   * 娓呯悊鎸囧畾浼氳瘽鐨勭紦瀛?
   * 鍦?LLM 杩愯缁撴潫锛堟棤璁烘垚鍔熸垨澶辫触锛夊悗璋冪敤锛岄伩鍏嶅唴瀛樹腑绉疮鏃犵敤鐨勪細璇濈紦瀛?
   */
  clearSessionCache(strategyInstanceId: string, sessionId: string): void {
    this.toolsExecutor.clearSessionCache(strategyInstanceId, sessionId)
  }
}
