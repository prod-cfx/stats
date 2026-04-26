import type { OfficialStrategyPlazaBacktestEvidence } from '../types/official-strategy-plaza-template'

export const OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE: OfficialStrategyPlazaBacktestEvidence = {
  "status": "VERIFIED",
  "generatedAt": "2026-04-26T05:00:33.997Z",
  "generatedBy": "apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts",
  "admission": {
    "maxDrawdownPctCeiling": 20,
    "minWinRate": 0.52,
    "minTradeCount": 20,
    "minTotalReturnPct": 0.5
  },
  "templates": [
    {
      "templateId": "ma-cross",
      "parameterSearchId": "official-template-search:ma-cross:BTC-USDT-SWAP:15m:1777168800000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 384,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "fastPeriod": 6,
        "slowPeriod": 48,
        "stopLossPct": 2,
        "takeProfitPct": 0.6,
        "positionPct": 35
      },
      "metrics": {
        "winRate": 0.5814,
        "maxDrawdownPct": 0.78,
        "totalReturnPct": 1.78,
        "tradeCount": 43
      },
      "best": {
        "params": {
          "fastPeriod": 6,
          "slowPeriod": 48,
          "stopLossPct": 2,
          "takeProfitPct": 0.6,
          "positionPct": 35
        },
        "metrics": {
          "winRate": 0.5814,
          "maxDrawdownPct": 0.78,
          "totalReturnPct": 1.78,
          "tradeCount": 43
        }
      }
    },
    {
      "templateId": "bollinger-reversion",
      "parameterSearchId": "official-template-search:bollinger-reversion:ETH-USDT-SWAP:15m:1777168800000",
      "exchange": "okx",
      "symbol": "ETH-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 384,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "period": 30,
        "deviation": 0.9,
        "stopLossPct": 3,
        "takeProfitPct": 0.5,
        "positionPct": 35
      },
      "metrics": {
        "winRate": 0.7949,
        "maxDrawdownPct": 1.64,
        "totalReturnPct": 2.8,
        "tradeCount": 78
      },
      "best": {
        "params": {
          "period": 30,
          "deviation": 0.9,
          "stopLossPct": 3,
          "takeProfitPct": 0.5,
          "positionPct": 35
        },
        "metrics": {
          "winRate": 0.7949,
          "maxDrawdownPct": 1.64,
          "totalReturnPct": 2.8,
          "tradeCount": 78
        }
      }
    },
    {
      "templateId": "grid-range",
      "parameterSearchId": "official-template-search:grid-range:BTC-USDT:15m:1777168800000",
      "exchange": "okx",
      "symbol": "BTC-USDT",
      "interval": "15m",
      "marketType": "spot",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "spot",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 648,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "lookback": 36,
        "lowerBand": 0.2,
        "upperBand": 0.55,
        "stopLossPct": 3,
        "takeProfitPct": 0.45,
        "positionPct": 25
      },
      "metrics": {
        "winRate": 0.8261,
        "maxDrawdownPct": 0.93,
        "totalReturnPct": 0.67,
        "tradeCount": 46
      },
      "best": {
        "params": {
          "lookback": 36,
          "lowerBand": 0.2,
          "upperBand": 0.55,
          "stopLossPct": 3,
          "takeProfitPct": 0.45,
          "positionPct": 25
        },
        "metrics": {
          "winRate": 0.8261,
          "maxDrawdownPct": 0.93,
          "totalReturnPct": 0.67,
          "tradeCount": 46
        }
      }
    },
    {
      "templateId": "breakout-follow",
      "parameterSearchId": "official-template-search:breakout-follow:BTC-USDT-SWAP:15m:1777168800000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 480,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "lookback": 24,
        "breakoutBufferPct": 0.25,
        "stopLossPct": 2,
        "takeProfitPct": 0.6,
        "positionPct": 25
      },
      "metrics": {
        "winRate": 0.7059,
        "maxDrawdownPct": 1.04,
        "totalReturnPct": 0.78,
        "tradeCount": 34
      },
      "best": {
        "params": {
          "lookback": 24,
          "breakoutBufferPct": 0.25,
          "stopLossPct": 2,
          "takeProfitPct": 0.6,
          "positionPct": 25
        },
        "metrics": {
          "winRate": 0.7059,
          "maxDrawdownPct": 1.04,
          "totalReturnPct": 0.78,
          "tradeCount": 34
        }
      }
    },
    {
      "templateId": "rsi-reversal",
      "parameterSearchId": "official-template-search:rsi-reversal:ETH-USDT:15m:1777168800000",
      "exchange": "okx",
      "symbol": "ETH-USDT",
      "interval": "15m",
      "marketType": "spot",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "spot",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1152,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "period": 14,
        "oversold": 38,
        "exitLevel": 64,
        "stopLossPct": 5,
        "takeProfitPct": 0.5,
        "positionPct": 25
      },
      "metrics": {
        "winRate": 0.7895,
        "maxDrawdownPct": 1.76,
        "totalReturnPct": 0.89,
        "tradeCount": 57
      },
      "best": {
        "params": {
          "period": 14,
          "oversold": 38,
          "exitLevel": 64,
          "stopLossPct": 5,
          "takeProfitPct": 0.5,
          "positionPct": 25
        },
        "metrics": {
          "winRate": 0.7895,
          "maxDrawdownPct": 1.76,
          "totalReturnPct": 0.89,
          "tradeCount": 57
        }
      }
    },
    {
      "templateId": "macd-cross",
      "parameterSearchId": "official-template-search:macd-cross:ETH-USDT-SWAP:15m:1777168800000",
      "exchange": "okx",
      "symbol": "ETH-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1777168800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 648,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "fastPeriod": 16,
        "slowPeriod": 34,
        "signalPeriod": 12,
        "stopLossPct": 2,
        "takeProfitPct": 0.5,
        "positionPct": 35
      },
      "metrics": {
        "winRate": 0.5833,
        "maxDrawdownPct": 1.34,
        "totalReturnPct": 2.09,
        "tradeCount": 60
      },
      "best": {
        "params": {
          "fastPeriod": 16,
          "slowPeriod": 34,
          "signalPeriod": 12,
          "stopLossPct": 2,
          "takeProfitPct": 0.5,
          "positionPct": 35
        },
        "metrics": {
          "winRate": 0.5833,
          "maxDrawdownPct": 1.34,
          "totalReturnPct": 2.09,
          "tradeCount": 60
        }
      }
    }
  ]
}
