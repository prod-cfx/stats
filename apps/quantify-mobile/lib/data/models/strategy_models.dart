/// 策略分类（页面顶部 chip 切换用）。
///
/// 对齐 front 策略广场筛选：
/// `全部 / 趋势 / 突破 / 反转 / 网格 / DCA / 盘口 / 衍生品事件 / 风控稳健`。
enum StrategyCategory {
  all,
  trend,
  breakout,
  reversal,
  grid,
  dca,
  orderbook,
  derivativeEvent,
  riskRobust,
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
/// 挂在此 model 上，由 [test StrategyRepository] 在返回 [StrategyMarketItem] 时
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

  /// 策略广场展示顺序。front 的「最新」排序使用该值升序。
  final int displayOrder;

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
    this.displayOrder = 0,
  });

  /// 头像展示用币种符号，对齐设计稿 `s.sym`（`m-screens-2.jsx`）。
  ///
  /// 从 [pair] 派生：取第一个 base 币种（`BTC/USDT` → `BTC`、`ARB-OP` → `ARB`）。
  /// 多币种 / 特殊 pair（如 `多币种`、`USDT`）无法拆出 base 时回退到 `⇄`，
  /// 空 pair 回退到 `?`，避免头像空白。
  String get symbol => deriveStrategySymbol(pair);
}

/// 币种 base 分隔符（`/` 或 `-`），提为顶层常量避免每次派生重复编译。
final RegExp _pairSeparator = RegExp(r'[/\-]');

/// 从交易对 [pair] 派生头像币种符号。
///
/// 规则（对齐设计稿 `s.sym`）：
/// - `BTC/USDT` / `ARB-OP` → 取分隔符前的 base 币种 `BTC` / `ARB`
/// - `多币种` 等无 `/`、`-` 分隔且非 ASCII 的占位 → `⇄`（多币种符号）
/// - `USDT` 这类纯计价/单币种 ASCII pair → 原样大写返回
/// - 空字符串 → `?`
String deriveStrategySymbol(String pair) {
  final String trimmed = pair.trim();
  if (trimmed.isEmpty) {
    return '?';
  }
  final List<String> parts = trimmed.split(_pairSeparator);
  final String base = parts.first.trim();
  if (base.isEmpty) {
    return '⇄';
  }
  // 含 CJK 等非 ASCII（如「多币种」）视为聚合占位。
  if (base.runes.any((int r) => r > 0x7f)) {
    return '⇄';
  }
  return base.toUpperCase();
}

/// 4 格指标 + featured hero 卡共享的"广场摘要"数据（#1565）。
///
/// 由 fixture 基于 `Random(id.hashCode)` 派生，保证同一 id 多次调用一致——
/// widget test / golden 复现友好。
class StrategyMarketStats {
  final double cagr;
  final double sharpe;
  final int? tradeCount;
  final double maxDrawdown; // 负值
  final double winRate; // 0..1
  final int users;
  final String? confidenceLevel;

  const StrategyMarketStats({
    required this.cagr,
    required this.sharpe,
    this.tradeCount,
    required this.maxDrawdown,
    required this.winRate,
    required this.users,
    this.confidenceLevel,
  });
}

/// 策略广场列表项：卡片 + 运行时派生的 sparkline 序列 + 4 格指标。
///
/// 把 sparkline / stats 拆出来是为了让 [StrategyCard] 仍是 const-friendly model
/// （fixture 字面量保持紧凑），同时让 fixture 层有自由度按 id 生成确定性数据。
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

/// 策略详情：基础卡片 + 收益指标 + 官方样本收益曲线。
///
/// 指标对齐设计稿 `StratDetail`（#1825）：累计收益 [cagr]、夏普、最大回撤、
/// 胜率、盈亏比 [profitLossRatio]、交易次数 [tradeCount]、使用人数 [users]。
/// 7d/30d/全部收益率保留供其他消费方使用。后端未返回的指标保持 null，页面
/// 展示缺失态，不用本地默认值伪造成真实数据。
class StrategyDetail {
  final StrategyCard card;
  final double return7d;
  final double return30d;
  final double returnAll;
  final double maxDrawdown;
  final double? sharpe;
  final double winRate;

  /// 累计收益率（百分数，如 32.4 表示 +32.4%），equity 卡左上大号展示（#1825）。
  final double cagr;

  /// 盈亏比（avg win / avg loss）。后端缺失时为 null。
  final double? profitLossRatio;

  /// 历史交易次数。后端暂未提供，fixture 派生（#1825）。
  final int tradeCount;

  /// 使用人数（订阅者数）。来自 [StrategyCard.subscribers]（#1825）。
  final int users;

  /// 收益曲线采样点，优先来自官方回测证据。
  final List<double> equityCurve;

  /// 官方策略逻辑说明，来自 strategy-plaza 模板 `logicDescription`。
  final String logicDescription;

  /// 官方样本回测置信度与原因。
  final String confidenceLevel;
  final List<String> confidenceReasons;

  /// 官方样本回测风险提示。
  final String disclaimer;

  /// 官方样本回测证据。时间为毫秒时间戳，缺失时页面显示 `--`。
  final int? backtestFromMs;
  final int? backtestToMs;
  final String generatedAt;
  final String dataSourceLabel;
  final int? candleCount;

  /// 策略运行参数。来自 strategy-plaza 模板契约，缺字段时页面显示 `--`。
  final String marketType;
  final double? positionPct;
  final double? leverage;
  final Map<String, double> params;

  const StrategyDetail({
    required this.card,
    required this.return7d,
    required this.return30d,
    required this.returnAll,
    required this.maxDrawdown,
    required this.sharpe,
    required this.winRate,
    required this.cagr,
    required this.profitLossRatio,
    required this.tradeCount,
    required this.users,
    required this.equityCurve,
    this.logicDescription = '',
    this.confidenceLevel = '',
    this.confidenceReasons = const <String>[],
    this.disclaimer = '',
    this.backtestFromMs,
    this.backtestToMs,
    this.generatedAt = '',
    this.dataSourceLabel = '',
    this.candleCount,
    this.marketType = '',
    this.positionPct,
    this.leverage,
    this.params = const <String, double>{},
  });
}

class StrategyRunResult {
  final String strategyId;
  final bool existing;
  final String? name;
  final String? symbol;
  final String? timeframe;
  final String? status;

  const StrategyRunResult({
    required this.strategyId,
    this.existing = false,
    this.name,
    this.symbol,
    this.timeframe,
    this.status,
  });
}

class StrategyEditSession {
  final String sessionId;
  final String templateId;
  final String initialMessage;

  const StrategyEditSession({
    required this.sessionId,
    required this.templateId,
    required this.initialMessage,
  });
}

/// 信号方向：买 / 卖。
enum StrategySignalSide { buy, sell }

/// 单条历史信号。
///
/// [time] 是相对当前时间向前回退派生的时间戳；fixture 用 now - i\*15min 倒推，
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
