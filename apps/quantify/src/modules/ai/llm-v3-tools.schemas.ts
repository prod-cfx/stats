/**
 * LLM Orchestrated Engine v3 - Function Calling Tools Schema
 *
 * 瀹氫箟鎵€鏈?v3 寮曟搸鍙敤鐨勫伐鍏峰強鍏?JSON Schema锛岀敤浜?LLM function calling銆?
 *
 * @module llm-v3-tools.schemas
 */

/**
 * 宸ュ叿 1: 鑾峰彇绛栫暐鍏佽鐨勪氦鏄撴爣鐨勫拰鏃堕棿妗嗘灦
 */
export const GET_SYMBOL_UNIVERSE_SCHEMA = {
  name: 'get_symbol_universe',
  description: '鑾峰彇褰撳墠绛栫暐鍏佽浜ゆ槗鐨勬爣鐨勫垪琛紙symbols锛夊拰鏀寔鐨勬椂闂村懆鏈燂紙timeframes锛?,
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'object',
        description: '鍙€夌殑杩囨护鏉′欢',
        properties: {
          exchange: {
            type: 'string',
            description: '浜ゆ槗鎵€浠ｇ爜锛屼緥濡?binance',
          },
          type: {
            type: 'string',
            enum: ['CRYPTO', 'STOCK', 'FOREX'],
            description: '鏍囩殑绫诲瀷',
          },
          baseAsset: {
            type: 'string',
            description: '鍩虹璧勪骇锛屼緥濡?BTC',
          },
        },
      },
    },
  },
} as const

/**
 * 宸ュ叿 2: 鑾峰彇鍘熷甯傚満鏁版嵁锛圞绾匡級
 */
export const GET_MARKET_DATA_RAW_SCHEMA = {
  name: 'get_market_data_raw',
  description: '鑾峰彇鎸囧畾鏍囩殑鍜屾椂闂村懆鏈熺殑鍘熷K绾挎暟鎹紝杩斿洖 OHLCV bars 鏁扮粍',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: '浜ゆ槗鏍囩殑浠ｇ爜锛屼緥濡?BTCUSDT',
      },
      timeframe: {
        type: 'string',
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
        description: '鏃堕棿鍛ㄦ湡',
      },
      lookbackBars: {
        type: 'integer',
        description: '鍥炴函鐨凨绾挎暟閲忥紝榛樿 100',
        minimum: 1,
        maximum: 1000,
        default: 100,
      },
      contextId: {
        type: 'string',
        description: '鍙€夌殑涓婁笅鏂嘔D锛岀敤浜庡悗缁紩鐢ㄦ鏁版嵁闆嗭紙渚嬪鍦?compute_technical_indicators 涓娇鐢級',
      },
    },
    required: ['symbol', 'timeframe'],
  },
} as const

/**
 * 宸ュ叿 3: 璁＄畻鎶€鏈寚鏍?
 */
export const COMPUTE_TECHNICAL_INDICATORS_SCHEMA = {
  name: 'compute_technical_indicators',
  description: '鍩轰簬 K 绾挎暟鎹绠楁妧鏈寚鏍囷紙濡?SMA銆丒MA銆丷SI銆丮ACD 绛夛級锛屽彲寮曠敤涔嬪墠鑾峰彇鐨勬暟鎹泦鎴栫洿鎺ヤ紶鍏?bars',
  parameters: {
    type: 'object',
    properties: {
      contextId: {
        type: 'string',
        description: '寮曠敤涔嬪墠 get_market_data_raw 杩斿洖鐨?contextId锛屼笌 bars 浜岄€変竴',
      },
      bars: {
        type: 'array',
        description: '鐩存帴浼犲叆鐨?K 绾挎暟鎹暟缁勶紝涓?contextId 浜岄€変竴',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'number', description: 'Unix 鏃堕棿鎴筹紙姣锛? },
            open: { type: 'number' },
            high: { type: 'number' },
            low: { type: 'number' },
            close: { type: 'number' },
            volume: { type: 'number' },
          },
          required: ['timestamp', 'open', 'high', 'low', 'close'],
        },
      },
      indicators: {
        type: 'array',
        description: '瑕佽绠楃殑鎸囨爣閰嶇疆鏁扮粍',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SMA', 'EMA', 'RSI', 'MACD', 'ATR', 'STOCH'],
              description: '鎸囨爣绫诲瀷銆傛敞锛欱BANDS銆丄DX銆丱BV銆乂WAP 鏆傛湭瀹炵幇锛屽皢鍦ㄥ悗缁増鏈敮鎸?,
            },
            field: {
              type: 'string',
              description: '鎸囨爣瀛楁鍚嶏紙鐢ㄤ簬澶氬€兼寚鏍囷紝濡?MACD 鐨?macd/signal/histogram锛?,
            },
            params: {
              type: 'object',
              description: '鎸囨爣鍙傛暟锛屼緥濡?{ period: 14 }',
              additionalProperties: true,
            },
          },
          required: ['type'],
        },
      },
    },
    required: ['indicators'],
  },
} as const

/**
 * 宸ュ叿 4: 璁＄畻閲戣瀺鎸囨爣锛堥闄?鏀剁泭鎸囨爣锛?
 */
export const COMPUTE_FINANCIAL_METRICS_SCHEMA = {
  name: 'compute_financial_metrics',
  description: '鍩轰簬鏀剁泭鐜囧簭鍒楁垨鏉冪泭鏇茬嚎璁＄畻閲戣瀺鎸囨爣锛屽 Sharpe Ratio銆佹渶澶у洖鎾ゃ€佹尝鍔ㄧ巼銆佽儨鐜囩瓑',
  parameters: {
    type: 'object',
    properties: {
      returns: {
        type: 'array',
        description: '鏀剁泭鐜囧簭鍒楋紝涓?equityCurve 浜岄€変竴',
        items: { type: 'number' },
      },
      equityCurve: {
        type: 'array',
        description: '鏉冪泭鏇茬嚎锛堣处鎴峰噣鍊煎簭鍒楋級锛屼笌 returns 浜岄€変竴',
        items: { type: 'number' },
      },
      returnsFormat: {
        type: 'string',
        enum: ['decimal', 'percentage'],
        description: '鏀剁泭鐜囨牸寮忥細decimal锛堝皬鏁板舰寮忥紝濡?0.05 琛ㄧず +5%锛夋垨 percentage锛堢櫨鍒嗘瘮褰㈠紡锛屽 5 琛ㄧず +5%锛夈€傞粯璁や负 decimal',
        default: 'decimal',
      },
      riskFreeRate: {
        type: 'number',
        description: '鏃犻闄╁埄鐜囷紙骞村寲锛夛紝鐢ㄤ簬璁＄畻 Sharpe Ratio锛岄粯璁?0.02',
        default: 0.02,
      },
      periodsPerYear: {
        type: 'integer',
        description: '姣忓勾鐨勫懆鏈熸暟锛堢敤浜庡勾鍖栬绠楋級锛屼緥濡傛棩绾?252锛屽皬鏃剁嚎=8760锛岄粯璁?252',
        default: 252,
      },
    },
    required: [],
  },
} as const

/**
 * 缁熶竴瀵煎嚭鎵€鏈夊伐鍏?Schema锛堜粎鍖呭惈鏌ヨ鍜岃绠楀伐鍏凤級
 */
export const LLM_V3_TOOLS = [
  GET_SYMBOL_UNIVERSE_SCHEMA,
  GET_MARKET_DATA_RAW_SCHEMA,
  COMPUTE_TECHNICAL_INDICATORS_SCHEMA,
  COMPUTE_FINANCIAL_METRICS_SCHEMA,
] as const

/**
 * 宸ュ叿鍚嶇О绫诲瀷锛堢敤浜庣被鍨嬪畨鍏級
 */
export type LlmV3ToolName =
  | 'get_symbol_universe'
  | 'get_market_data_raw'
  | 'compute_technical_indicators'
  | 'compute_financial_metrics'

/**
 * 鍚勫伐鍏风殑杈撳叆鍙傛暟绫诲瀷瀹氫箟锛堢敤浜庡疄鐜板眰锛?
 */
export interface GetSymbolUniverseParams {
  filter?: {
    exchange?: string
    type?: 'CRYPTO' | 'STOCK' | 'FOREX'
    baseAsset?: string
  }
}

export interface GetMarketDataRawParams {
  symbol: string
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
  lookbackBars?: number
  contextId?: string
}

export interface ComputeTechnicalIndicatorsParams {
  contextId?: string
  bars?: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }>
  indicators: Array<{
    type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'ATR' | 'STOCH'
    field?: string
    params?: Record<string, any>
  }>
}

export interface ComputeFinancialMetricsParams {
  returns?: number[]
  equityCurve?: number[]
  returnsFormat?: 'decimal' | 'percentage'
  riskFreeRate?: number
  periodsPerYear?: number
}

/**
 * 鍚勫伐鍏风殑杩斿洖鍊肩被鍨嬪畾涔夛紙鐢ㄤ簬瀹炵幇灞傦級
 */
export interface GetSymbolUniverseResult {
  symbols: Array<{
    code: string
    baseAsset: string
    quoteAsset: string
    exchange: string
    type: string
  }>
  supportedTimeframes: string[]
}

export interface GetMarketDataRawResult {
  symbol: string
  timeframe: string
  bars: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }>
  contextId?: string
}

export interface ComputeTechnicalIndicatorsResult {
  indicators: Array<{
    type: string
    field?: string
    value?: number | number[]
    values?: number[]
  }>
}

export interface ComputeFinancialMetricsResult {
  sharpeRatio?: number
  maxDrawdown?: number
  maxDrawdownPercent?: number
  annualizedReturn?: number
  annualizedVolatility?: number
  winRate?: number
  profitFactor?: number
  calmarRatio?: number
}
