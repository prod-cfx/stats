/// 策略分类（页面顶部 chip 切换用）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-2.jsx` `TAG_FILTERS`：
/// `全部 / 趋势 / 网格 / 套利 / 反转 / 对冲 / 高频`。
enum StrategyCategory {
  all,
  trend,
  grid,
  arbitrage,
  reversal,
  hedge,
  highFreq,
}

/// 策略卡 status badge 类型（#1565）。
///
/// - [hot]：🔥 热门
/// - [newListing]：NEW
/// - [official]：官方
/// - [pro]：PRO
enum StrategyStatusBadge { hot, newListing, official, pro }

/// 策略卡片元数据。
///
/// 保持 const 构造以便 fixtures 维持 `const List` 字面量。sparkline 数据**不**
/// 挂在此 model 上，由 [MockStrategyRepository] 在返回 [StrategyMarketItem] 时
/// 基于 `Random(id.hashCode)` 派生，避免破坏 const 约束。
class StrategyCard {
  final String id;
  final String name;
  final String description;
  final String author;
  final double pnlPercent;
  final int subscribers;
  final List<String> tags;
  final StrategyCategory category;

  /// status badge（#1565）。null 不渲染。
  final StrategyStatusBadge? status;

  /// 作者认证标（蓝 V）。
  final bool verified;

  /// 交易币对，例如 `BTC/USDT`、`多币种`（#1595）。
  final String pair;

  /// 周期标签，例如 `7D` / `30D` / `1Y`（#1595）。
  final String period;

  const StrategyCard({
    required this.id,
    required this.name,
    required this.description,
    required this.author,
    required this.pnlPercent,
    required this.subscribers,
    required this.tags,
    required this.category,
    this.status,
    this.verified = false,
    this.pair = '',
    this.period = '',
  });
}

/// 4 格指标 + featured hero 卡共享的"广场摘要"数据（#1565）。
///
/// 由 mock 基于 `Random(id.hashCode)` 派生，保证同一 id 多次调用一致——
/// widget test / golden 复现友好。
class StrategyMarketStats {
  final double cagr;
  final double sharpe;
  final double maxDrawdown; // 负值
  final double winRate; // 0..1
  final int users;

  const StrategyMarketStats({
    required this.cagr,
    required this.sharpe,
    required this.maxDrawdown,
    required this.winRate,
    required this.users,
  });
}

/// 策略广场列表项：卡片 + 运行时派生的 sparkline 序列 + 4 格指标。
///
/// 把 sparkline / stats 拆出来是为了让 [StrategyCard] 仍是 const-friendly model
/// （fixture 字面量保持紧凑），同时让 mock 层有自由度按 id 生成确定性数据。
class StrategyMarketItem {
  final StrategyCard card;
  final List<double> sparkline;
  final StrategyMarketStats stats;

  const StrategyMarketItem({
    required this.card,
    required this.sparkline,
    required this.stats,
  });
}

/// 分页结果。
class StrategyMarketPage {
  final List<StrategyMarketItem> items;
  final bool hasMore;
  final int page;
  final int pageSize;

  const StrategyMarketPage({
    required this.items,
    required this.hasMore,
    required this.page,
    required this.pageSize,
  });
}

/// equity curve 时间维度（#1565）。
enum EquityTimeframe { d7, d30, d90, y1 }

/// 策略详情：基础卡片 + 6 项收益指标 + 收益曲线占位序列。
///
/// 6 项指标按 issue #1514 验收对齐：7d / 30d / 全部收益率、最大回撤、夏普、
/// 胜率。所有数值由 mock 基于 `Random(id.hashCode)` 派生，**确定性**——
/// 保证 widget test 多次 pump 同一 id 结果一致。
class StrategyDetail {
  final StrategyCard card;
  final double return7d;
  final double return30d;
  final double returnAll;
  final double maxDrawdown;
  final double sharpe;
  final double winRate;

  /// 收益曲线占位采样点（0..1 归一化），与 sparkline 等价但更长。
  /// 真正的 K 线接入留给后续 issue；当前页仅渲染"占位"提示。
  final List<double> equityCurve;

  const StrategyDetail({
    required this.card,
    required this.return7d,
    required this.return30d,
    required this.returnAll,
    required this.maxDrawdown,
    required this.sharpe,
    required this.winRate,
    required this.equityCurve,
  });
}

/// 信号方向：买 / 卖。
enum StrategySignalSide { buy, sell }

/// 单条历史信号。
///
/// [time] 是相对当前时间向前回退派生的时间戳；mock 用 now - i\*15min 倒推，
/// 保证显示"最近一条在最上"语义且测试时也能合理排序。
class StrategySignal {
  final DateTime time;
  final StrategySignalSide side;
  final double price;
  final double pnlPercent;

  const StrategySignal({
    required this.time,
    required this.side,
    required this.price,
    required this.pnlPercent,
  });
}
