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

/// 单笔回测交易记录（交易记录 Tab）。
class BacktestTrade {
  final DateTime time;

  /// 方向标识（多 / 空）。展示用短串，由 l10n 提供。
  final String side;
  final double entry;
  final double exit;

  /// 单笔盈亏百分比（正盈负亏）。
  final double pnlPercent;

  /// 持仓时长展示串（如 `4h 12m`）。
  final String duration;
  final bool win;

  const BacktestTrade({
    required this.time,
    required this.side,
    required this.entry,
    required this.exit,
    required this.pnlPercent,
    required this.duration,
    required this.win,
  });
}

/// 风险分析行的语义色调，映射到 `QzColorScheme` 状态色。
enum BacktestRiskTone { danger, warn, neutral }

/// 风险分析 Tab 的单行指标。
class BacktestRiskRow {
  final String label;
  final String value;

  /// 进度条占比（0..1），纯可视化权重。
  final double barFraction;
  final BacktestRiskTone tone;
  final String note;

  const BacktestRiskRow({
    required this.label,
    required this.value,
    required this.barFraction,
    required this.tone,
    required this.note,
  });
}

/// 月度回报热力图的一行（一年 12 个月）。
///
/// [values] 固定 12 项，`null` 表示该月无数据（如当年未走完）。
class BacktestMonthlyRow {
  final int year;
  final List<double?> values;

  const BacktestMonthlyRow({
    required this.year,
    required this.values,
  });
}

/// 完整回测结果。对齐设计稿 `ScreenBacktestResult`：Hero 累计净值/CAGR、
/// 关键指标 8 格、月度热力 / 交易记录 / 风险分析三段，以及 AI 评估。
class BacktestResult {
  final String id;

  /// 累计净值百分比（Hero 大字）。
  final double totalReturnPercent;

  /// 年化复合收益率（%）。
  final double cagrPercent;
  final double maxDrawdownPercent;
  final double sharpe;

  /// Calmar = CAGR / |MaxDrawdown|。
  final double calmar;

  /// 胜率（%）。
  final double winRatePercent;

  /// 盈亏比（平均盈 / 平均亏）。
  final double profitLossRatio;

  /// 平均持仓时长展示串（如 `14h 23m`）。
  final String avgHoldDuration;

  /// 总交易笔数（5 年内开仓次数）。
  final int totalTrades;

  /// 回测区间。
  final DateTime rangeStart;
  final DateTime rangeEnd;

  /// 归一化净值曲线（Hero 图）。
  final List<double> equityCurve;

  /// 净值曲线上回撤红点标记的索引（落在 [equityCurve] 上）。
  final List<int> drawdownMarkers;

  /// 月度回报热力（按年分行）。
  final List<BacktestMonthlyRow> monthlyRows;

  /// 交易记录。
  final List<BacktestTrade> trades;

  /// 风险分析行。
  final List<BacktestRiskRow> riskRows;

  /// AI 评估文案（紫底评估条正文）。
  final String aiAssessment;

  const BacktestResult({
    required this.id,
    required this.totalReturnPercent,
    required this.cagrPercent,
    required this.maxDrawdownPercent,
    required this.sharpe,
    required this.calmar,
    required this.winRatePercent,
    required this.profitLossRatio,
    required this.avgHoldDuration,
    required this.totalTrades,
    required this.rangeStart,
    required this.rangeEnd,
    required this.equityCurve,
    required this.drawdownMarkers,
    required this.monthlyRows,
    required this.trades,
    required this.riskRows,
    required this.aiAssessment,
  });
}
