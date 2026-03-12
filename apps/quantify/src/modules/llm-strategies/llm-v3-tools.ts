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
   * 浜ゆ槗鏍囩殑浠ｇ爜锛堝繀濉級
   */
  symbol: string
  /**
   * 棰濆鐨勪笂涓嬫枃鍏冩暟鎹紝渚嬪锛?
   * - 瑙﹀彂鐨?timeframe
   * - 甯傚満鐘跺喌
   * - 浠讳綍鑷畾涔夋爣绛?
   */
  meta?: {
    /** 鏃堕棿鍛ㄦ湡锛屽 '1h', '4h', '1d' */
    timeframe?: string
    /** 甯傚満鐘跺喌锛屽 'bullish', 'bearish', 'sideways' */
    marketCondition?: string
    /** 娉㈠姩鐜囩瓑绾э紝濡?'low', 'medium', 'high' */
    volatility?: string
    /** 瓒嬪娍寮哄害锛?-100 */
    trendStrength?: number
    /** 鍏朵粬鑷畾涔夊瓧娈?*/
    [key: string]: unknown
  }
}

/**
 * 鏁版嵁鏌ヨ涓庤绠楀伐鍏凤紙浠?AI 妯″潡瀵煎叆锛?
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
 * 鍐崇瓥杈撳嚭宸ュ叿
 */
const tradingSignalTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: GENERATE_TRADING_SIGNAL_TOOL_NAME,
    description:
      '鏍规嵁褰撳墠閲忓寲绛栫暐鍜岄闄╅厤缃紝杈撳嚭涓€鏉＄粨鏋勫寲鐨勪氦鏄撲俊鍙峰喅绛栥€傚繀椤婚€氳繃姝ゅ伐鍏疯緭鍑烘渶缁堝喅绛栵紝鑰屼笉鏄嚜鐒惰瑷€鍥炵瓟銆?,
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: '浜ゆ槗鏍囩殑浠ｇ爜锛屽 BTCUSDT銆丒THUSDT 绛夈€傚繀椤绘槸浣犱箣鍓嶈皟鐢ㄥ伐鍏锋煡璇㈣繃鐨勬爣鐨?,
        },
        direction: {
          type: 'string',
          description: '浜ゆ槗鏂瑰悜锛孊UY/SELL/CLOSE_LONG/CLOSE_SHORT 涔嬩竴',
          enum: ['BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT'],
        },
        signalType: {
          type: 'string',
          description: '淇″彿绫诲瀷锛孍NTRY/EXIT/ADJUSTMENT/ALERT 涔嬩竴锛岄粯璁?ENTRY',
          enum: ['ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT'],
        },
        confidence: {
          type: 'number',
          description: '缃俊搴︼紝0-100 涔嬮棿鐨勬暟鍊?,
          minimum: 0,
          maximum: 100,
        },
        entryPrice: {
          type: 'number',
          description: '寤鸿鍏ュ満浠锋牸锛堝彲閫夛級锛屼笉濉椂鐢辩郴缁熶娇鐢ㄥ綋鍓嶅競浠?,
        },
        stopLoss: {
          type: 'number',
          description: '姝㈡崯浠锋牸锛堝彲閫夛級',
        },
        takeProfit: {
          type: 'number',
          description: '姝㈢泩浠锋牸锛堝彲閫夛級',
        },
        reasoning: {
          type: 'string',
          description: '瀵规湰娆″喅绛栫殑绠€瑕佷腑鏂囪В閲婏紙鍗曡锛屼笉瓒呰繃 300 瀛楃锛屼笉瑕佷娇鐢ㄦ崲琛岀锛夛紝渚夸簬鐢ㄦ埛鐞嗚В绛栫暐琛屼负',
          maxLength: 300,
        },
        positionSizeQuote: {
          type: 'number',
          description: '鏈浠撲綅鐨勫悕涔夐噾棰濓紙浠ユ姤浠疯揣甯佽锛屾瘮濡?USDT锛夛紝鍙€?,
        },
        positionSizeRatio: {
          type: 'number',
          description: '鏈浠撲綅鍗犺处鎴锋潈鐩婄殑姣斾緥锛?-1锛夛紝鍙€?,
          minimum: 0,
          maximum: 1,
        },
        meta: {
          type: 'object',
          description: '棰濆鐨勫厓鏁版嵁瀛楁锛屽墠鍚庣鍙互鑷畾涔夋墿灞?,
          additionalProperties: true,
        },
      },
      required: ['symbol', 'direction'],
      additionalProperties: false,
    },
  },
}

/**
 * LLM v3 宸ュ叿鍒楄〃锛堝畬鏁寸増锛?
 *
 * 鍖呭惈鏁版嵁鏌ヨ宸ュ叿锛?涓級+ 鍐崇瓥杈撳嚭宸ュ叿锛?涓級
 */
export const llmV3Tools: ChatCompletionTool[] = [
  ...dataQueryTools,
  tradingSignalTool,
]
