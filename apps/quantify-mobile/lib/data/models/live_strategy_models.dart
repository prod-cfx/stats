/// 实盘策略（已部署运行中的策略实例）相关 model（#1752）。
///
/// 设计真源：`design/project/mobile/m-screens-livestrats.jsx`
/// （`LIVE_STRATS` / `STRAT_POSITIONS` / `ScreenLiveStratDetail`）。
///
/// 当前全部由 `MockLiveStrategyRepository` 驱动，后端实例接口（依赖 #1679/
/// #1682/#1683）接通前保持 const fixture 形态；暂停/删除/脚本/回测/再部署
/// 等写操作本迭代不接通，UI 侧渲染为禁用/占位语义。
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
}

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
  final int stoppedCount;

  const LiveStrategySummary({
    required this.totalAssets,
    required this.totalCapital,
    required this.todayPnl,
    required this.totalPnl,
    required this.runningCount,
    required this.stoppedCount,
  });

  /// 总收益率（基于本金）。本金为 0 时返回 0 避免除零。
  double get totalPct => totalCapital == 0 ? 0 : (totalPnl / totalCapital) * 100;
}
