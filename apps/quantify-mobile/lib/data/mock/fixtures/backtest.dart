import '../../models/backtest_models.dart';

const BacktestResult mockBacktestResult = BacktestResult(
  id: 'bt-mock-1',
  totalReturnPercent: 18.2,
  maxDrawdownPercent: -7.5,
  sharpe: 1.32,
  trades: 42,
  equityCurve: <double>[
    1.0, 1.01, 1.03, 1.02, 1.05, 1.08, 1.06, 1.09, 1.12, 1.10,
    1.14, 1.16, 1.13, 1.17, 1.18, 1.16, 1.18, 1.182,
  ],
);
