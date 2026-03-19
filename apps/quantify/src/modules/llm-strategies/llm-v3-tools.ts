import type { AiSignalPayload } from '@ai/shared'
import type { ChatCompletionTool } from '@/modules/ai/providers/llm-provider-adapter.interface'
import {
  COMPUTE_FINANCIAL_METRICS_SCHEMA,
  COMPUTE_TECHNICAL_INDICATORS_SCHEMA,
  GET_MARKET_DATA_RAW_SCHEMA,
  GET_SYMBOL_UNIVERSE_SCHEMA,
} from '@/modules/ai/llm-v3-tools.schemas'

export const GENERATE_TRADING_SIGNAL_TOOL_NAME = 'generate_trading_signal'

export interface AiSignalPayloadWithMeta extends AiSignalPayload {
  /**
   * 交易标的代码（必填）
   */
  symbol: string
  /**
   * 额外的上下文元数据，例如：
   * - 触发的 timeframe
   * - 市场状况
   * - 任何自定义标签
   */
  meta?: {
    /** 时间周期，如 '1h', '4h', '1d' */
    timeframe?: string
    /** 市场状况，如 'bullish', 'bearish', 'sideways' */
    marketCondition?: string
    /** 波动率等级，如 'low', 'medium', 'high' */
    volatility?: string
    /** 趋势强度，0-100 */
    trendStrength?: number
    /** 其他自定义字段 */
    [key: string]: unknown
  }
}

/**
 * 数据查询与计算工具（从 AI 模块导入）
 */
const dataQueryTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: GET_SYMBOL_UNIVERSE_SCHEMA.name,
      description: GET_SYMBOL_UNIVERSE_SCHEMA.description,
      parameters: GET_SYMBOL_UNIVERSE_SCHEMA.parameters as any,
    },
  },
  {
    type: 'function',
    function: {
      name: GET_MARKET_DATA_RAW_SCHEMA.name,
      description: GET_MARKET_DATA_RAW_SCHEMA.description,
      parameters: GET_MARKET_DATA_RAW_SCHEMA.parameters as any,
    },
  },
  {
    type: 'function',
    function: {
      name: COMPUTE_TECHNICAL_INDICATORS_SCHEMA.name,
      description: COMPUTE_TECHNICAL_INDICATORS_SCHEMA.description,
      parameters: COMPUTE_TECHNICAL_INDICATORS_SCHEMA.parameters as any,
    },
  },
  {
    type: 'function',
    function: {
      name: COMPUTE_FINANCIAL_METRICS_SCHEMA.name,
      description: COMPUTE_FINANCIAL_METRICS_SCHEMA.description,
      parameters: COMPUTE_FINANCIAL_METRICS_SCHEMA.parameters as any,
    },
  },
]

/**
 * 决策输出工具
 */
const tradingSignalTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: GENERATE_TRADING_SIGNAL_TOOL_NAME,
    description:
      '根据当前量化策略和风险配置，输出一条结构化的交易信号决策。必须通过此工具输出最终决策，而不是自然语言回答。',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: '交易标的代码，如 BTCUSDT、ETHUSDT 等。必须是你之前调用工具查询过的标的',
        },
        direction: {
          type: 'string',
          description: '交易方向，BUY/SELL/CLOSE_LONG/CLOSE_SHORT 之一',
          enum: ['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT'],
        },
        signalType: {
          type: 'string',
          description: '信号类型，ENTRY/EXIT/ADJUSTMENT/ALERT 之一，默认 ENTRY',
          enum: ['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT'],
        },
        confidence: {
          type: 'number',
          description: '置信度，0-100 之间的数值',
          minimum: 0,
          maximum: 100,
        },
        entryPrice: {
          type: 'number',
          description: '建议入场价格（可选），不填时由系统使用当前市价',
        },
        stopLoss: {
          type: 'number',
          description: '止损价格（可选）',
        },
        takeProfit: {
          type: 'number',
          description: '止盈价格（可选）',
        },
        reasoning: {
          type: 'string',
          description: '对本次决策的简要中文解释（单行，不超过 300 字符，不要使用换行符），便于用户理解策略行为',
          maxLength: 300,
        },
        positionSizeQuote: {
          type: 'number',
          description: '本次仓位的名义金额（以报价货币计，比如 USDT），可选',
        },
        positionSizeRatio: {
          type: 'number',
          description: '本次仓位占账户权益的比例（0-1），可选',
          minimum: 0,
          maximum: 1,
        },
        meta: {
          type: 'object',
          description: '额外的元数据字段，前后端可以自定义扩展',
          additionalProperties: true,
        },
      },
      required: ['symbol', 'direction'],
      additionalProperties: false,
    },
  },
}

/**
 * LLM v3 工具列表（完整版）
 *
 * 包含数据查询工具（4个）+ 决策输出工具（1个）
 */
export const llmV3Tools: ChatCompletionTool[] = [
  ...dataQueryTools,
  tradingSignalTool,
]

