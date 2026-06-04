/// 实盘策略（已部署运行中的策略实例）领域模型（#2190）。
///
/// 设计真源：`design/project/mobile/m-screens-livestrats.jsx`
/// （`LIVE_STRATS` / `STRAT_POSITIONS` / `ScreenLiveStratDetail`）。
///
/// domain 层：作为 UI 唯一消费来源。mock 与（未来 #2189）真实现负责
/// `data model → domain model` 转换。
library;

/// 实盘策略运行状态。
///
/// - [running]：运行中（可能持仓）
/// - [paused]：已暂停（持仓已平或转手动）
/// - [warning]：需关注（接近风控阈值）
/// - [stopped]：已停止（软删除，保留 30 天）
enum LiveStrategyStatus { running, paused, warning, stopped }

/// 单个实盘策略实例。
///
/// 数值字段照搬设计稿 `LIVE_STRATS`，保持 const 构造以便 fixture 字面量。
/// sparkline 为归一化前的原始权益序列（与设计稿 `spark` 一致），由详情页
/// equity curve 自行归一化绘制。
class LiveStrategy {
  final String id;
  final String name;
  final String pair;

  /// 周期标签，例如 `15m` / `4H`。
  final String timeframe;

  /// 交易所名，例如 `Binance` / `OKX`。
  final String exchange;

  /// 交易所首字母 glyph（图标占位，避免引入 svg 依赖）。
  final String exchangeGlyph;

  /// 市场类型，例如 `合约 5x` / `现货` / `永续`。
  final String market;

  final LiveStrategyStatus status;

  /// 状态附注，例如 `已暂停 · 等待恢复`；null 不渲染。
  final String? statusNote;

  /// 运行时长展示串，例如 `14 天`。
  final String runFor;

  final double todayPct;
  final double todayPnl;
  final double totalPct;
  final double totalPnl;
  final double capital;
  final int trades;

  /// 胜率百分比（0..100）。
  final double winRate;

  /// 权益曲线原始采样点。
  final List<double> spark;

  const LiveStrategy({
    required this.id,
    required this.name,
    required this.pair,
    required this.timeframe,
    required this.exchange,
    required this.exchangeGlyph,
    required this.market,
    required this.status,
    required this.runFor,
    required this.todayPct,
    required this.todayPnl,
    required this.totalPct,
    required this.totalPnl,
    required this.capital,
    required this.trades,
    required this.winRate,
    required this.spark,
    this.statusNote,
  });

  /// 是否处于活跃态（参与聚合统计）。stopped 不计入。
  bool get isActive => status != LiveStrategyStatus.stopped;

  /// 是否可能持仓（仅 running / warning）。
  bool get mayHavePosition =>
      status == LiveStrategyStatus.running ||
      status == LiveStrategyStatus.warning;

  /// 仅用于客户端 mock 状态转换（暂停/恢复/软删）。
  ///
  /// [statusNote] 用 sentinel 区分「不改」与「显式置 null」：默认 `_unset`
  /// 保持原值，传 `null` 显式清空（恢复时清掉暂停附注）。
  LiveStrategy copyWith({
    LiveStrategyStatus? status,
    Object? statusNote = _unset,
  }) {
    return LiveStrategy(
      id: id,
      name: name,
      pair: pair,
      timeframe: timeframe,
      exchange: exchange,
      exchangeGlyph: exchangeGlyph,
      market: market,
      status: status ?? this.status,
      statusNote: identical(statusNote, _unset)
          ? this.statusNote
          : statusNote as String?,
      runFor: runFor,
      todayPct: todayPct,
      todayPnl: todayPnl,
      totalPct: totalPct,
      totalPnl: totalPnl,
      capital: capital,
      trades: trades,
      winRate: winRate,
      spark: spark,
    );
  }
}

/// copyWith sentinel：区分「省略参数」与「显式传 null」。
const Object _unset = Object();

/// 持仓方向。
enum PositionSide { long, short }

/// 实盘策略当前持仓（仅 running / warning 策略有）。
class LiveStrategyPosition {
  final PositionSide side;
  final String pair;
  final double entryPrice;
  final double currentPrice;
  final double qty;
  final double pnl;
  final double pct;
  final double stopPrice;

  /// 距止损展示串，例如 `-2.0%`。
  final String stopDistance;

  /// 距止损百分比（负数，例如 -2.0）。暂停对话框「等待止损/止盈」用。
  final double stopPct;

  /// 距止盈百分比（正数，例如 3.5）。暂停对话框「等待止损/止盈」用。
  final double tpPct;

  /// 持仓时长展示串，例如 `4h 12m`。
  final String holdFor;

  const LiveStrategyPosition({
    required this.side,
    required this.pair,
    required this.entryPrice,
    required this.currentPrice,
    required this.qty,
    required this.pnl,
    required this.pct,
    required this.stopPrice,
    required this.stopDistance,
    required this.stopPct,
    required this.tpPct,
    required this.holdFor,
  });
}

/// 单条历史成交（详情页「交易记录」tab）。
class LiveStrategyTrade {
  /// 时间展示串，例如 `今天 14:30`。
  final String time;
  final PositionSide side;
  final double entryPrice;
  final double exitPrice;
  final double pct;
  final bool win;

  /// 持仓时长展示串。
  final String holdFor;

  const LiveStrategyTrade({
    required this.time,
    required this.side,
    required this.entryPrice,
    required this.exitPrice,
    required this.pct,
    required this.win,
    required this.holdFor,
  });
}

/// 策略参数项（详情页「参数」tab）。
class LiveStrategyParam {
  final String key;
  final String value;
  final String note;

  const LiveStrategyParam({
    required this.key,
    required this.value,
    required this.note,
  });
}

/// 列表页顶部聚合摘要。stopped 策略不计入。
class LiveStrategySummary {
  /// 总资产 = 投入本金 + 累计盈亏。
  final double totalAssets;
  final double totalCapital;
  final double todayPnl;
  final double totalPnl;
  final int runningCount;

  /// 需关注（warning）策略数。计入活跃统计。
  final int warningCount;

  /// 已暂停（paused）策略数。计入活跃统计。
  final int pausedCount;
  final int stoppedCount;

  /// 活跃策略综合胜率（0..100），按成交数加权平均。无成交时为 0。
  /// 可选默认 0：旧调用点（仅关心计数/盈亏）无需感知该字段。
  final double winRate;

  const LiveStrategySummary({
    required this.totalAssets,
    required this.totalCapital,
    required this.todayPnl,
    required this.totalPnl,
    required this.runningCount,
    required this.warningCount,
    required this.pausedCount,
    required this.stoppedCount,
    this.winRate = 0,
  });

  /// 活跃策略总数（非 stopped），口径与设计稿 `active.length` 一致。
  int get activeCount => runningCount + warningCount + pausedCount;

  /// 总收益率（基于本金）。本金为 0 时返回 0 避免除零。
  double get totalPct => totalCapital == 0 ? 0 : (totalPnl / totalCapital) * 100;
}
