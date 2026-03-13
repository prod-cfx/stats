/**
 * LLM Orchestrated Engine v3 - Function Calling Tools Schema
 * 
 * 定义所有 v3 引擎可用的工具及其 JSON Schema，用于 LLM function calling。
 * 
 * @module llm-v3-tools.schemas
 */

/**
 * 工具 1: 获取策略允许的交易标的和时间框架
 */
export const GET_SYMBOL_UNIVERSE_SCHEMA = {
  name: 'get_symbol_universe',
  description: '获取当前策略允许交易的标的列表（symbols）和支持的时间周期（timeframes）',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'object',
        description: '可选的过滤条件',
        properties: {
          exchange: {
            type: 'string',
            description: '交易所代码，例如 binance',
          },
          type: {
            type: 'string',
            enum: ['CRYPTO', 'STOCK', 'FOREX'],
            description: '标的类型',
          },
          baseAsset: {
            type: 'string',
            description: '基础资产，例如 BTC',
          },
        },
      },
    },
  },
} as const

/**
 * 工具 2: 获取原始市场数据（K线）
 */
export const GET_MARKET_DATA_RAW_SCHEMA = {
  name: 'get_market_data_raw',
  description: '获取指定标的和时间周期的原始K线数据，返回 OHLCV bars 数组',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: '交易标的代码，例如 BTCUSDT',
      },
      timeframe: {
        type: 'string',
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
        description: '时间周期',
      },
      lookbackBars: {
        type: 'integer',
        description: '回溯的K线数量，默认 100',
        minimum: 1,
        maximum: 1000,
        default: 100,
      },
      contextId: {
        type: 'string',
        description: '可选的上下文ID，用于后续引用此数据集（例如在 compute_technical_indicators 中使用）',
      },
    },
    required: ['symbol', 'timeframe'],
  },
} as const

/**
 * 工具 3: 计算技术指标
 */
export const COMPUTE_TECHNICAL_INDICATORS_SCHEMA = {
  name: 'compute_technical_indicators',
  description: '基于 K 线数据计算技术指标（如 SMA、EMA、RSI、MACD 等），可引用之前获取的数据集或直接传入 bars',
  parameters: {
    type: 'object',
    properties: {
      contextId: {
        type: 'string',
        description: '引用之前 get_market_data_raw 返回的 contextId，与 bars 二选一',
      },
      bars: {
        type: 'array',
        description: '直接传入的 K 线数据数组，与 contextId 二选一',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'number', description: 'Unix 时间戳（毫秒）' },
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
        description: '要计算的指标配置数组',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['SMA', 'EMA', 'RSI', 'MACD', 'ATR', 'STOCH'],
              description: '指标类型。注：BBANDS、ADX、OBV、VWAP 暂未实现，将在后续版本支持',
            },
            field: {
              type: 'string',
              description: '指标字段名（用于多值指标，如 MACD 的 macd/signal/histogram）',
            },
            params: {
              type: 'object',
              description: '指标参数，例如 { period: 14 }',
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
 * 工具 4: 计算金融指标（风险/收益指标）
 */
export const COMPUTE_FINANCIAL_METRICS_SCHEMA = {
  name: 'compute_financial_metrics',
  description: '基于收益率序列或权益曲线计算金融指标，如 Sharpe Ratio、最大回撤、波动率、胜率等',
  parameters: {
    type: 'object',
    properties: {
      returns: {
        type: 'array',
        description: '收益率序列，与 equityCurve 二选一',
        items: { type: 'number' },
      },
      equityCurve: {
        type: 'array',
        description: '权益曲线（账户净值序列），与 returns 二选一',
        items: { type: 'number' },
      },
      returnsFormat: {
        type: 'string',
        enum: ['decimal', 'percentage'],
        description: '收益率格式：decimal（小数形式，如 0.05 表示 +5%）或 percentage（百分比形式，如 5 表示 +5%）。默认为 decimal',
        default: 'decimal',
      },
      riskFreeRate: {
        type: 'number',
        description: '无风险利率（年化），用于计算 Sharpe Ratio，默认 0.02',
        default: 0.02,
      },
      periodsPerYear: {
        type: 'integer',
        description: '每年的周期数（用于年化计算），例如日线=252，小时线=8760，默认 252',
        default: 252,
      },
    },
    required: [],
  },
} as const

/**
 * 统一导出所有工具 Schema（仅包含查询和计算工具）
 */
export const LLM_V3_TOOLS = [
  GET_SYMBOL_UNIVERSE_SCHEMA,
  GET_MARKET_DATA_RAW_SCHEMA,
  COMPUTE_TECHNICAL_INDICATORS_SCHEMA,
  COMPUTE_FINANCIAL_METRICS_SCHEMA,
] as const

/**
 * 工具名称类型（用于类型安全）
 */
export type LlmV3ToolName =
  | 'get_symbol_universe'
  | 'get_market_data_raw'
  | 'compute_technical_indicators'
  | 'compute_financial_metrics'

/**
 * 各工具的输入参数类型定义（用于实现层）
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
 * 各工具的返回值类型定义（用于实现层）
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
