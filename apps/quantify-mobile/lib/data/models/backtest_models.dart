/// 回测请求与完整结果。
class BacktestRequest {
  final String strategyId;
  final String symbol;
  final DateTime startTime;
  final DateTime endTime;
  final Map<String, dynamic> params;

  const BacktestRequest({
    required this.strategyId,
    required this.symbol,
    required this.startTime,
    required this.endTime,
    required this.params,
  });
}

class BacktestResult {
  final String id;
  final double totalReturnPercent;
  final double maxDrawdownPercent;
  final double sharpe;
  final int trades;
  final List<double> equityCurve;

  const BacktestResult({
    required this.id,
    required this.totalReturnPercent,
    required this.maxDrawdownPercent,
    required this.sharpe,
    required this.trades,
    required this.equityCurve,
  });
}
