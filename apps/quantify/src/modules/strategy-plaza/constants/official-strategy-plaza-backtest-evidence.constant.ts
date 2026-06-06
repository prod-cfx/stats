import type { OfficialStrategyPlazaBacktestEvidence } from '../types/official-strategy-plaza-template'

export const OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE: OfficialStrategyPlazaBacktestEvidence = {
  "status": "VERIFIED",
  "generatedAt": "2026-06-06T13:06:23.170Z",
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
    },
    {
      "templateId": "ema-trend-continuation",
      "parameterSearchId": "official-template-search:ema-trend-continuation:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "ema-slope-trend",
      "parameterSearchId": "official-template-search:ema-slope-trend:ETH-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 6,
        "holdBars": 4,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7903,
        "maxDrawdownPct": 4.12,
        "totalReturnPct": 5.26,
        "tradeCount": 391
      },
      "best": {
        "params": {
          "cadence": 6,
          "holdBars": 4,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7903,
          "maxDrawdownPct": 4.12,
          "totalReturnPct": 5.26,
          "tradeCount": 391
        }
      }
    },
    {
      "templateId": "multi-timeframe-trend",
      "parameterSearchId": "official-template-search:multi-timeframe-trend:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "breakout-volume-confirm",
      "parameterSearchId": "official-template-search:breakout-volume-confirm:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "breakout-pullback-hold",
      "parameterSearchId": "official-template-search:breakout-pullback-hold:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "breakdown-short-follow",
      "parameterSearchId": "official-template-search:breakdown-short-follow:ETH-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 2,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 20
      },
      "metrics": {
        "winRate": 0.7019,
        "maxDrawdownPct": 0.83,
        "totalReturnPct": 0.57,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 2,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 20
        },
        "metrics": {
          "winRate": 0.7019,
          "maxDrawdownPct": 0.83,
          "totalReturnPct": 0.57,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "bollinger-breakout-stop",
      "parameterSearchId": "official-template-search:bollinger-breakout-stop:ETH-USDT-SWAP:1H:1777168800000",
      "exchange": "okx",
      "symbol": "ETH-USDT-SWAP",
      "interval": "1H",
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
      "backtestFrom": 1768528800000,
      "backtestTo": 1777165200000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1768528800000,
      "toTs": 1777165200000,
      "params": {
        "cadence": 10,
        "holdBars": 2,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 15
      },
      "metrics": {
        "winRate": 0.9017,
        "maxDrawdownPct": 1.05,
        "totalReturnPct": 0.87,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 2,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 15
        },
        "metrics": {
          "winRate": 0.9017,
          "maxDrawdownPct": 1.05,
          "totalReturnPct": 0.87,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "rsi-cycle-reversion",
      "parameterSearchId": "official-template-search:rsi-cycle-reversion:BTC-USDT-SWAP:15m:1779667200000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1779667200000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1777507200000,
      "backtestTo": 1779666300000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1777507200000,
      "toTs": 1779666300000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6831,
        "maxDrawdownPct": 4.05,
        "totalReturnPct": 0.54,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6831,
          "maxDrawdownPct": 4.05,
          "totalReturnPct": 0.54,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "indicator-boundary-reversion",
      "parameterSearchId": "official-template-search:indicator-boundary-reversion:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "fixed-grid-gated",
      "parameterSearchId": "official-template-search:fixed-grid-gated:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "trend-filtered-grid",
      "parameterSearchId": "official-template-search:trend-filtered-grid:ETH-USDT:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 6,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7877,
        "maxDrawdownPct": 4.14,
        "totalReturnPct": 5.02,
        "tradeCount": 391
      },
      "best": {
        "params": {
          "cadence": 6,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7877,
          "maxDrawdownPct": 4.14,
          "totalReturnPct": 5.02,
          "tradeCount": 391
        }
      }
    },
    {
      "templateId": "grid-breakout-stop",
      "parameterSearchId": "official-template-search:grid-breakout-stop:BTC-USDT:1m:1773100800000",
      "exchange": "okx",
      "symbol": "BTC-USDT",
      "interval": "1m",
      "marketType": "spot",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "spot",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1773100800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "backtestFrom": 1772956800000,
      "backtestTo": 1773100740000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1772956800000,
      "toTs": 1773100740000,
      "params": {
        "cadence": 10,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6068,
        "maxDrawdownPct": 1.41,
        "totalReturnPct": 2.69,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6068,
          "maxDrawdownPct": 1.41,
          "totalReturnPct": 2.69,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "drawdown-dca-budget",
      "parameterSearchId": "official-template-search:drawdown-dca-budget:BTC-USDT-SWAP:1H:1777168800000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "1H",
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
      "backtestFrom": 1768528800000,
      "backtestTo": 1777165200000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1768528800000,
      "toTs": 1777165200000,
      "params": {
        "cadence": 10,
        "holdBars": 2,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.8718,
        "maxDrawdownPct": 2.25,
        "totalReturnPct": 5.82,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 2,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.8718,
          "maxDrawdownPct": 2.25,
          "totalReturnPct": 5.82,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "timed-dca-budget",
      "parameterSearchId": "official-template-search:timed-dca-budget:BTC-USDT:1H:1777168800000",
      "exchange": "okx",
      "symbol": "BTC-USDT",
      "interval": "1H",
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
      "backtestFrom": 1768528800000,
      "backtestTo": 1777165200000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1768528800000,
      "toTs": 1777165200000,
      "params": {
        "cadence": 10,
        "holdBars": 2,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.859,
        "maxDrawdownPct": 2.35,
        "totalReturnPct": 4.61,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 2,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.859,
          "maxDrawdownPct": 2.35,
          "totalReturnPct": 4.61,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "dca-program-start",
      "parameterSearchId": "official-template-search:dca-program-start:ETH-USDT-SWAP:1H:1777168800000",
      "exchange": "okx",
      "symbol": "ETH-USDT-SWAP",
      "interval": "1H",
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
      "backtestFrom": 1768528800000,
      "backtestTo": 1777165200000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1768528800000,
      "toTs": 1777165200000,
      "params": {
        "cadence": 10,
        "holdBars": 2,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 10
      },
      "metrics": {
        "winRate": 0.9017,
        "maxDrawdownPct": 0.7,
        "totalReturnPct": 0.58,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 2,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 10
        },
        "metrics": {
          "winRate": 0.9017,
          "maxDrawdownPct": 0.7,
          "totalReturnPct": 0.58,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "orderbook-imbalance-long",
      "parameterSearchId": "official-template-search:orderbook-imbalance-long:BTC-USDT-SWAP:1m:1773100800000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "1m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1773100800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "eventDataSources": [
        {
          "schemaRef": "orderbook",
          "endpoint": "https://www.okx.com/api/v5/market/books",
          "sampleCount": 1
        }
      ],
      "backtestFrom": 1772956800000,
      "backtestTo": 1773100740000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1772956800000,
      "toTs": 1773100740000,
      "params": {
        "cadence": 10,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6197,
        "maxDrawdownPct": 1.31,
        "totalReturnPct": 3.09,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6197,
          "maxDrawdownPct": 1.31,
          "totalReturnPct": 3.09,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "orderbook-spread-post-only",
      "parameterSearchId": "official-template-search:orderbook-spread-post-only:BTC-USDT-SWAP:1m:1773100800000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "1m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1773100800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "eventDataSources": [
        {
          "schemaRef": "orderbook",
          "endpoint": "https://www.okx.com/api/v5/market/books",
          "sampleCount": 1
        }
      ],
      "backtestFrom": 1772956800000,
      "backtestTo": 1773100740000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1772956800000,
      "toTs": 1773100740000,
      "params": {
        "cadence": 10,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6197,
        "maxDrawdownPct": 1.31,
        "totalReturnPct": 3.09,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6197,
          "maxDrawdownPct": 1.31,
          "totalReturnPct": 3.09,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "orderbook-depth-ratio-confirm",
      "parameterSearchId": "official-template-search:orderbook-depth-ratio-confirm:ETH-USDT-SWAP:1m:1773100800000",
      "exchange": "okx",
      "symbol": "ETH-USDT-SWAP",
      "interval": "1m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1773100800000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "eventDataSources": [
        {
          "schemaRef": "orderbook",
          "endpoint": "https://www.okx.com/api/v5/market/books",
          "sampleCount": 1
        }
      ],
      "backtestFrom": 1772956800000,
      "backtestTo": 1773100740000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1772956800000,
      "toTs": 1773100740000,
      "params": {
        "cadence": 10,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.5897,
        "maxDrawdownPct": 1.6,
        "totalReturnPct": 1.88,
        "tradeCount": 234
      },
      "best": {
        "params": {
          "cadence": 10,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.5897,
          "maxDrawdownPct": 1.6,
          "totalReturnPct": 1.88,
          "tradeCount": 234
        }
      }
    },
    {
      "templateId": "funding-rate-mean-reversion",
      "parameterSearchId": "official-template-search:funding-rate-mean-reversion:BTC-USDT-SWAP:15m:1779667200000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1779667200000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "eventDataSources": [
        {
          "schemaRef": "funding",
          "endpoint": "https://www.okx.com/api/v5/public/funding-rate-history",
          "sampleCount": 100,
          "fixedEndTs": 1779666300000
        }
      ],
      "backtestFrom": 1777507200000,
      "backtestTo": 1779666300000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1777507200000,
      "toTs": 1779666300000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6831,
        "maxDrawdownPct": 4.05,
        "totalReturnPct": 0.54,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6831,
          "maxDrawdownPct": 4.05,
          "totalReturnPct": 0.54,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "open-interest-breakout",
      "parameterSearchId": "official-template-search:open-interest-breakout:BTC-USDT-SWAP:15m:1777168800000",
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
      "eventDataSources": [
        {
          "schemaRef": "open_interest",
          "endpoint": "https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history",
          "sampleCount": 100,
          "fixedEndTs": 1777167900000
        }
      ],
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "liquidation-cascade-short",
      "parameterSearchId": "official-template-search:liquidation-cascade-short:BTC-USDT-SWAP:15m:1779667200000",
      "exchange": "okx",
      "symbol": "BTC-USDT-SWAP",
      "interval": "15m",
      "marketType": "swap",
      "source": "https://www.okx.com/api/v5/market/history-candles",
      "dataSource": {
        "exchange": "okx",
        "marketType": "swap",
        "endpoint": "https://www.okx.com/api/v5/market/history-candles",
        "fixedEndTs": 1779667200000,
        "pagination": {
          "parameter": "after",
          "pageLimit": 300,
          "pageCount": 8
        }
      },
      "eventDataSources": [
        {
          "schemaRef": "liquidation",
          "endpoint": "https://www.okx.com/api/v5/public/liquidation-orders",
          "sampleCount": 1600,
          "fixedEndTs": 1779666300000
        }
      ],
      "backtestFrom": 1777507200000,
      "backtestTo": 1779666300000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1777507200000,
      "toTs": 1779666300000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 0.6,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.6831,
        "maxDrawdownPct": 4.05,
        "totalReturnPct": 0.54,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 0.6,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.6831,
          "maxDrawdownPct": 4.05,
          "totalReturnPct": 0.54,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "funding-oi-confirmation",
      "parameterSearchId": "official-template-search:funding-oi-confirmation:ETH-USDT-SWAP:15m:1777168800000",
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
      "eventDataSources": [
        {
          "schemaRef": "funding",
          "endpoint": "https://www.okx.com/api/v5/public/funding-rate-history",
          "sampleCount": 100,
          "fixedEndTs": 1777167900000
        },
        {
          "schemaRef": "open_interest",
          "endpoint": "https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history",
          "sampleCount": 100,
          "fixedEndTs": 1777167900000
        }
      ],
      "backtestFrom": 1775008800000,
      "backtestTo": 1777167900000,
      "admission": {
        "maxDrawdownPctCeiling": 20,
        "minWinRate": 0.52,
        "minTradeCount": 20,
        "minTotalReturnPct": 0.5
      },
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 6,
        "holdBars": 4,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7903,
        "maxDrawdownPct": 4.12,
        "totalReturnPct": 5.26,
        "tradeCount": 391
      },
      "best": {
        "params": {
          "cadence": 6,
          "holdBars": 4,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7903,
          "maxDrawdownPct": 4.12,
          "totalReturnPct": 5.26,
          "tradeCount": 391
        }
      }
    },
    {
      "templateId": "drawdown-guard-trend",
      "parameterSearchId": "official-template-search:drawdown-guard-trend:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "exposure-cap-trend",
      "parameterSearchId": "official-template-search:exposure-cap-trend:ETH-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 6,
        "holdBars": 4,
        "stopLossPct": 3,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7903,
        "maxDrawdownPct": 4.12,
        "totalReturnPct": 5.26,
        "tradeCount": 391
      },
      "best": {
        "params": {
          "cadence": 6,
          "holdBars": 4,
          "stopLossPct": 3,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7903,
          "maxDrawdownPct": 4.12,
          "totalReturnPct": 5.26,
          "tradeCount": 391
        }
      }
    },
    {
      "templateId": "cooldown-after-stop",
      "parameterSearchId": "official-template-search:cooldown-after-stop:BTC-USDT-SWAP:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7462,
        "maxDrawdownPct": 1.65,
        "totalReturnPct": 8.41,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7462,
          "maxDrawdownPct": 1.65,
          "totalReturnPct": 8.41,
          "tradeCount": 587
        }
      }
    },
    {
      "templateId": "low-drawdown-regime-gate",
      "parameterSearchId": "official-template-search:low-drawdown-regime-gate:BTC-USDT:15m:1777168800000",
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
      "candidateCount": 1200,
      "candleCount": 2400,
      "fromTs": 1775008800000,
      "toTs": 1777167900000,
      "params": {
        "cadence": 4,
        "holdBars": 4,
        "stopLossPct": 1.5,
        "takeProfitPct": 0.12,
        "positionPct": 70
      },
      "metrics": {
        "winRate": 0.7376,
        "maxDrawdownPct": 2.15,
        "totalReturnPct": 6.68,
        "tradeCount": 587
      },
      "best": {
        "params": {
          "cadence": 4,
          "holdBars": 4,
          "stopLossPct": 1.5,
          "takeProfitPct": 0.12,
          "positionPct": 70
        },
        "metrics": {
          "winRate": 0.7376,
          "maxDrawdownPct": 2.15,
          "totalReturnPct": 6.68,
          "tradeCount": 587
        }
      }
    }
  ]
}
