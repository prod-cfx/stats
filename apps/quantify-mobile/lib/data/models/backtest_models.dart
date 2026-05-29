/// 回测在 AI 对话流中的阶段。
///
/// - [idle]：未发起回测，对话流不渲染进度/结果卡。
/// - [running]：回测进行中，渲染 `QzBacktestProgressCard`（验收 #3：明确 UI 表达）。
/// - [done]：回测完成，渲染 `QzBacktestResultCard` + 部署按钮。
enum BacktestPhase {
  idle,
  running,
  done,
}

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
