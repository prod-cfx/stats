import 'package:quantify_mobile/data/models/backtest_models.dart';

/// 设计稿 `ScreenBacktestResult` 同款种子净值曲线（5 年 60 点）。
const List<double> _equitySeed = <double>[
  100, 99, 103, 107, 104, 108, 113, 109, 115, 118, //
  116, 121, 119, 125, 130, 127, 133, 131, 128, 134, //
  138, 135, 141, 139, 135, 140, 144, 142, 138, 148, //
  158, 166, 162, 170, 168, 178, 184, 180, 194, 210, //
  220, 212, 228, 240, 236, 254, 268, 260, 282, 300, //
  294, 312, 326, 320, 346, 360, 354, 376, 392, 388, //
];

/// 设计稿月度回报热力（年×12，`null` = 该月未走完）。
const List<BacktestMonthlyRow> _monthlyRows = <BacktestMonthlyRow>[
  BacktestMonthlyRow(
    year: 2021,
    values: <double?>[
      4.2,
      -3.1,
      6.8,
      2.4,
      -1.8,
      5.6,
      8.1,
      -2.3,
      3.9,
      1.2,
      -4.4,
      7.3,
    ],
  ),
  BacktestMonthlyRow(
    year: 2022,
    values: <double?>[
      -2.6,
      3.4,
      -5.1,
      4.8,
      -1.2,
      -6.7,
      2.9,
      5.3,
      -3.8,
      1.7,
      6.2,
      -2.1,
    ],
  ),
  BacktestMonthlyRow(
    year: 2023,
    values: <double?>[
      5.9,
      2.1,
      -1.4,
      7.2,
      3.6,
      -2.8,
      4.4,
      1.9,
      6.1,
      -3.2,
      2.7,
      8.4,
    ],
  ),
  BacktestMonthlyRow(
    year: 2024,
    values: <double?>[
      3.1,
      6.5,
      -2.2,
      4.9,
      7.8,
      2.3,
      -4.1,
      5.7,
      3.4,
      9.2,
      -1.6,
      4.8,
    ],
  ),
  BacktestMonthlyRow(
    year: 2025,
    values: <double?>[
      7.4,
      -3.3,
      5.2,
      2.8,
      6.9,
      -1.7,
      4.3,
      8.6,
      -2.9,
      3.7,
      5.1,
      2.4,
    ],
  ),
  BacktestMonthlyRow(
    year: 2026,
    values: <double?>[
      6.2,
      3.8,
      -2.4,
      5.9,
      4.1,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  ),
];

final List<BacktestTrade> _trades = <BacktestTrade>[
  BacktestTrade(
    time: DateTime(2026, 5, 12, 14, 30),
    side: 'long',
    entry: 67420.50,
    exit: 69108.00,
    pnlPercent: 2.50,
    duration: '4h 12m',
    win: true,
  ),
  BacktestTrade(
    time: DateTime(2026, 5, 10, 9, 15),
    side: 'long',
    entry: 65800.00,
    exit: 64484.00,
    pnlPercent: -2.00,
    duration: '1h 48m',
    win: false,
  ),
  BacktestTrade(
    time: DateTime(2026, 5, 8, 22, 0),
    side: 'long',
    entry: 64200.00,
    exit: 66854.40,
    pnlPercent: 4.13,
    duration: '18h 30m',
    win: true,
  ),
  BacktestTrade(
    time: DateTime(2026, 5, 6, 11, 45),
    side: 'long',
    entry: 63500.00,
    exit: 62865.00,
    pnlPercent: -1.00,
    duration: '45m',
    win: false,
  ),
  BacktestTrade(
    time: DateTime(2026, 5, 3, 19, 20),
    side: 'long',
    entry: 61200.00,
    exit: 63916.80,
    pnlPercent: 4.44,
    duration: '2d 4h',
    win: true,
  ),
];

const List<BacktestOpenPosition> _openPositions = <BacktestOpenPosition>[
  BacktestOpenPosition(
    symbol: 'BTCUSDT',
    qty: 0.0012,
    avgEntryPrice: 78538.46,
    unrealizedPnl: 91.86,
  ),
];

const List<BacktestRiskRow> _riskRows = <BacktestRiskRow>[
  BacktestRiskRow(
    label: '最大回撤幅度',
    value: '-12.4%',
    barFraction: 0.62,
    tone: BacktestRiskTone.neutral,
    note: '2022-06 ~ 2022-09 · 持续 92 天',
  ),
  BacktestRiskRow(
    label: '回撤恢复天数',
    value: '34 天',
    barFraction: 0.40,
    tone: BacktestRiskTone.warn,
    note: '最深回撤恢复耗时 34 天。',
  ),
  BacktestRiskRow(
    label: '年化波动率',
    value: '17.8%',
    barFraction: 0.45,
    tone: BacktestRiskTone.neutral,
    note: '基于净值曲线收益序列按时间间隔年化。',
  ),
  BacktestRiskRow(
    label: '夏普比率',
    value: '1.78',
    barFraction: 0.59,
    tone: BacktestRiskTone.neutral,
    note: '按 front 口径由净值收益均值和标准差计算。',
  ),
];

final BacktestResult mockBacktestResult = BacktestResult(
  id: 'bt-mock-1',
  totalReturnPercent: 312.4,
  cagrPercent: 31.6,
  maxDrawdownPercent: -12.4,
  sharpe: 1.78,
  calmar: 2.55,
  winRatePercent: 55.4,
  profitLossRatio: 2.04,
  avgHoldDuration: '14h 23m',
  totalTrades: 184,
  closedReturnPercent: 312.4,
  closedWinRatePercent: 55.4,
  closedTrades: 184,
  openTrades: 1,
  openPnl: 91.86,
  rangeStart: DateTime(2021, 1),
  rangeEnd: DateTime(2026, 5),
  equityCurve: _equitySeed,
  drawdownMarkers: const <int>[18, 28, 44],
  monthlyRows: _monthlyRows,
  trades: _trades,
  openPositions: _openPositions,
  riskRows: _riskRows,
  aiAssessment: '该策略最大回撤 12.4% 优于阈值 (20%)，可一键部署。建议在牛市加速期降低杠杆。',
);
