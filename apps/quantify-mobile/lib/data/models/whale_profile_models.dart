/// 巨鲸地址详情与交易统计 model（#1753）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx`
/// （`WhaleProfileDetail` / `WhaleTradeStats`）。
///
/// 与 `whale_extra_models.dart` 同约定：数值字段保持已格式化字符串
/// （如 `pnlDisplay: '+$8.4M'`），由 mock fixture 直接提供给 widget 渲染，
/// 不在 widget 层做单位/精度转换，避免 mock 阶段引入 i18n 复杂度。
///
/// 当前由 `MockWhaleProfileRepository` 驱动；真实地址详情/统计读路径
/// （依赖 #1682）接通前保持 mock 形态。
library;

/// 单条持仓（地址详情「概览」段）。
class WhaleHoldingEntry {
  const WhaleHoldingEntry({
    required this.symbol,
    required this.amountDisplay,
    required this.valueDisplay,
    required this.pctDisplay,
    required this.tone,
  });

  final String symbol;
  final String amountDisplay; // 例如 '1,204 BTC'
  final String valueDisplay; // 例如 '$82.4M'
  final String pctDisplay; // 例如 '+12.8%'
  final String tone; // 'up' | 'dn' | 'flat'
}

/// 近期动作（地址详情「概览」段）。
class WhaleRecentAction {
  const WhaleRecentAction({
    required this.action,
    required this.detail,
    required this.timeDisplay,
    required this.tone,
  });

  final String action; // 例如 '买入' / '卖出' / '转入'
  final String detail; // 例如 '842 BTC · Binance'
  final String timeDisplay; // 例如 '刚刚'
  final String tone; // 'up' | 'dn' | 'flat'
}

/// 单个资产的表现（交易统计「资产表现」段）。
///
/// 既有 [symbol]/[pctDisplay]/[tone] 为 required（`whale_profile_page.dart`
/// 的 `_AssetPerfRow` 在消费，保持向后兼容）；可选字段对齐设计稿
/// `ASSET_PERF`（`:2362`）供统计弹窗 PerfRow 渲染。
class WhaleAssetPerf {
  const WhaleAssetPerf({
    required this.symbol,
    required this.pctDisplay,
    required this.tone,
    this.glyph,
    this.colorHex,
    this.tradeCount,
    this.positive,
    this.pnlDisplay,
    this.feeDisplay,
  });

  final String symbol;
  final String pctDisplay; // 例如 '+24.6%'
  final String tone; // 'up' | 'dn'

  final String? glyph; // 头像字形，例如 'Z'
  final int? colorHex; // 头像背景色
  final int? tradeCount; // 成交笔数
  final bool? positive; // 净盈亏方向：true 绿 / false 红
  final String? pnlDisplay; // 净盈亏展示串，例如 '181,101.72'
  final String? feeDisplay; // 费用展示串，例如 '3,710.62'
}

/// 单个仓位的表现（交易统计「按仓位的表现」段，设计稿 `POS_PERF` `:2371`）。
class WhalePositionPerf {
  const WhalePositionPerf({
    required this.sym,
    required this.glyph,
    required this.colorHex,
    required this.side,
    required this.timeDisplay,
    required this.positive,
    required this.pnlDisplay,
    required this.sizeDisplay,
    required this.feeDisplay,
    this.label,
  });

  final String sym;
  final String? label; // 完整名，例如 'xyz:TSLA'，null 时回退 sym
  final String glyph; // 头像字形
  final int colorHex; // 头像背景色
  final String side; // '做多' | '做空'
  final String timeDisplay; // 开仓时间，例如 '8 小时前'
  final bool positive; // 净盈亏方向
  final String pnlDisplay; // 净盈亏展示串
  final String sizeDisplay; // 规模，例如 '0.41 XMR'
  final String feeDisplay; // 费用展示串
}

/// 交易统计（地址详情「交易统计」tab）。
class WhaleTradeStats {
  const WhaleTradeStats({
    required this.pnlDisplay,
    required this.pnlTone,
    required this.winRatePct,
    required this.realizedDisplay,
    required this.unrealizedDisplay,
    required this.longPct,
    required this.shortPct,
    required this.assetPerf,
    this.closedPnlDisplay,
    this.feeAdjustedPnlDisplay,
    this.tradesTotal,
    this.wins,
    this.losses,
    this.maxDrawdownDisplay,
    this.filledOrders,
    this.closedCount,
    this.positionPerf = const <WhalePositionPerf>[],
  });

  final String pnlDisplay; // 总盈亏，例如 '+$8.4M'
  final String pnlTone; // 'up' | 'dn'
  final int winRatePct; // 胜率 0..100
  final String realizedDisplay; // 已实现盈亏
  final String unrealizedDisplay; // 未实现盈亏

  /// 方向偏好：做多 / 做空占比（0..100，和为 100）。
  final int longPct;
  final int shortPct;

  final List<WhaleAssetPerf> assetPerf;

  /// 统计弹窗胜率卡 / 交易次数卡（设计稿 `WhaleTradeStats` `:2247`/`:2289`）。
  final String? closedPnlDisplay; // 已平仓盈亏，例如 '+$8.4M'
  final String? feeAdjustedPnlDisplay; // 扣除费用后，例如 '+$8.06M'
  final int? tradesTotal; // 交易次数
  final int? wins; // 盈利笔数
  final int? losses; // 亏损笔数

  /// 交易表现卡补充指标（设计稿 `PerfCard` `:1050`）。真值依赖读路径 #1682，
  /// 当前由 fixtures 占位。
  final String? maxDrawdownDisplay; // 最大回撤，例如 '8202846.96%'
  final int? filledOrders; // 已成交订单
  final int? closedCount; // 平仓次数

  /// 按仓位的表现（统计弹窗子 tab）。
  final List<WhalePositionPerf> positionPerf;
}

/// 巨鲸地址画像（地址详情页根模型）。
class WhaleProfile {
  const WhaleProfile({
    required this.address,
    required this.tag,
    required this.tagTone,
    required this.assetSummary,
    required this.holdingsValueDisplay,
    required this.holdings,
    required this.recentActions,
    required this.stats,
    this.spotHoldings = const <WhaleSpotHolding>[],
    this.perpHoldings = const <WhalePerpHolding>[],
    this.openOrders = const <WhaleOpenOrder>[],
    this.recentTrades = const <WhaleRecentTrade>[],
    this.histOrders = const <WhaleHistOrder>[],
    this.pnlCurve = const <WhalePnlPoint>[],
    this.statCards,
    this.perpSummary,
  });

  final String address; // 省略号缩写地址，例如 '0x88e…3a01'
  final String tag; // 机构 / 聪明钱 / 长期持有 / 新地址
  final String tagTone; // 'accent' | 'info' | 'warn'
  final String assetSummary; // 例如 'BTC · ETH · SOL'
  final String holdingsValueDisplay; // 总持仓估值，例如 '$128.4M'
  final List<WhaleHoldingEntry> holdings;
  final List<WhaleRecentAction> recentActions;
  final WhaleTradeStats stats;

  /// 详情页 6 tab 明细（设计稿 `WhaleProfileDetail` `:617`）。
  final List<WhaleSpotHolding> spotHoldings; // 现货持仓
  final List<WhalePerpHolding> perpHoldings; // 永续合约持仓
  final List<WhaleOpenOrder> openOrders; // 挂单
  final List<WhaleRecentTrade> recentTrades; // 最近成交
  final List<WhaleHistOrder> histOrders; // 历史委托
  final List<WhalePnlPoint> pnlCurve; // P&L 曲线点
  final WhaleProfileStatCards? statCards; // 2×2 stat 卡
  final WhalePerpSummary? perpSummary; // 永续合约总价值明细
}

/// 现货持仓单条（设计稿 `SPOT_HOLDINGS` `:1503`）。
class WhaleSpotHolding {
  const WhaleSpotHolding({
    required this.sym,
    required this.colorHex,
    required this.sharePct,
    required this.qtyDisplay,
    required this.priceDisplay,
    required this.valueDisplay,
    required this.valueN,
    required this.chgPct,
    required this.chain,
  });

  final String sym;
  final int colorHex; // 币种主题色
  final double sharePct; // 占比（排序用数值），例如 42.91
  final String qtyDisplay; // 数量展示串
  final String priceDisplay; // 价格展示串
  final String valueDisplay; // 价值展示串
  final double valueN; // 价值数值（排序用）
  final double chgPct; // 24h 涨跌（正负判定）
  final String chain; // 链，例如 'HyperEVM'
}

/// 永续合约持仓单条（设计稿 `PERP_HOLDINGS` `:1510`）。
class WhalePerpHolding {
  const WhalePerpHolding({
    required this.sym,
    required this.colorHex,
    required this.side,
    required this.lev,
    required this.mode,
    required this.valueDisplay,
    required this.valueN,
    required this.pnlDisplay,
    required this.pnlN,
    required this.entryDisplay,
    required this.markDisplay,
    required this.liqDisplay,
    required this.marginDisplay,
    required this.fundingDisplay,
    required this.fundingN,
    required this.tpsl,
  });

  final String sym;
  final int colorHex;
  final String side; // '做多' | '做空'
  final String lev; // 杠杆，例如 '5x'
  final String mode; // '全仓' | '逐仓'
  final String valueDisplay; // 持仓价值
  final double valueN;
  final String pnlDisplay; // 未实现盈亏（含正负号）
  final double pnlN; // 未实现盈亏数值（正负判定）
  final String entryDisplay; // 入场均价
  final String markDisplay; // 标记价格
  final String liqDisplay; // 清算价格
  final String marginDisplay; // 保证金
  final String fundingDisplay; // 资金费（含正负号）
  final double fundingN; // 资金费数值（正负判定）
  final String tpsl; // 止盈/止损，例如 '–/–'
}

/// 挂单单条（设计稿 `OPEN_ORDERS` `:1702`）。
class WhaleOpenOrder {
  const WhaleOpenOrder({
    required this.id,
    required this.sym,
    required this.colorHex,
    required this.side,
    required this.type,
    required this.timeDisplay,
    required this.valueDisplay,
    required this.qtyDisplay,
    required this.trig,
    required this.status,
  });

  final String id; // 订单 ID
  final String sym;
  final int colorHex;
  final String side; // '买入' | '卖出'
  final String type; // '限价' | '止损限价' ...
  final String timeDisplay;
  final String valueDisplay; // 价值
  final String qtyDisplay; // 数量
  final String trig; // 触发条件，例如 '≥ $ 198.00' | '–'
  final String status; // 状态，例如 '开仓'
}

/// 最近成交单条（设计稿 `RECENT_TRADES` `:1784`）。
class WhaleRecentTrade {
  const WhaleRecentTrade({
    required this.id,
    required this.sym,
    required this.colorHex,
    required this.action,
    required this.kind,
    required this.timeDisplay,
    required this.qtyDisplay,
    required this.startDisplay,
    required this.priceDisplay,
    required this.pnlDisplay,
    required this.pnlN,
    required this.feeDisplay,
  });

  final String id;
  final String sym;
  final int colorHex;
  final String action; // '平空' | '开多' ...
  final String kind; // '减仓' | '加仓' ...
  final String timeDisplay;
  final String qtyDisplay; // 数量
  final String startDisplay; // 起始仓位
  final String priceDisplay; // 价格
  final String pnlDisplay; // 已平盈亏（含正负号）
  final double pnlN; // 已平盈亏数值（正负判定）
  final String feeDisplay; // 费用，例如 '0.29 USDC'
}

/// 历史委托单条（设计稿 `HIST_ORDERS` `:1867`）。
class WhaleHistOrder {
  const WhaleHistOrder({
    required this.id,
    required this.sym,
    required this.colorHex,
    required this.side,
    required this.timeDisplay,
    required this.type,
    required this.qtyDisplay,
    required this.priceDisplay,
    required this.trig,
    required this.status,
  });

  final String id;
  final String sym;
  final int colorHex;
  final String side; // '买入' | '卖出'
  final String timeDisplay;
  final String type; // '限价' | '市价' ...
  final String qtyDisplay; // 数量
  final String priceDisplay; // 价格
  final String trig; // 触发条件
  final String status; // 执行状态：'已成交' | '撤单' | '挂单'
}

/// P&L 曲线点（设计稿基本信息 tab P&L 图 `:760`）。
class WhalePnlPoint {
  const WhalePnlPoint({required this.x, required this.valueK});

  final double x; // 横轴位置 0..276
  final double valueK; // 纵轴值，单位 K（千）
}

/// stat 卡明细行（圆点 + 标签 + 值）。
class WhaleStatCardExtra {
  const WhaleStatCardExtra({
    required this.dotHex,
    required this.label,
    required this.valueDisplay,
    this.info = false,
  });

  final int dotHex; // 圆点颜色
  final String label;
  final String valueDisplay;
  final bool info; // 是否带 info 图标
}

/// stat 卡环图（双段占比）。
class WhaleStatCardDonut {
  const WhaleStatCardDonut({
    required this.a,
    required this.b,
    required this.colorAHex,
    required this.colorBHex,
  });

  final double a; // 主段占比 0..1
  final double b; // 次段占比 0..1
  final int colorAHex;
  final int colorBHex;
}

/// 详情页基本信息 tab 的 2×2 stat 卡（设计稿 `:816`）。
class WhaleProfileStatCards {
  const WhaleProfileStatCards({
    required this.accountValueDisplay,
    required this.accountExtras,
    required this.accountDonut,
    required this.availableMarginDisplay,
    required this.marginExtras,
    required this.marginDonut,
    required this.positionValueDisplay,
    required this.positionExtras,
    required this.positionDonut,
  });

  final String accountValueDisplay; // 账户总价值
  final List<WhaleStatCardExtra> accountExtras;
  final WhaleStatCardDonut accountDonut;

  final String availableMarginDisplay; // 可用保证金
  final List<WhaleStatCardExtra> marginExtras;
  final WhaleStatCardDonut marginDonut;

  final String positionValueDisplay; // 总持仓价值
  final List<WhaleStatCardExtra> positionExtras;
  final WhaleStatCardDonut positionDonut;
}

/// 永续合约总价值明细（设计稿 `:856`）。
class WhalePerpSummary {
  const WhalePerpSummary({
    required this.totalValueDisplay,
    required this.marginUsagePct,
    required this.biasLabel,
    required this.longPct,
    required this.shortPct,
    required this.longValueDisplay,
    required this.shortValueDisplay,
    required this.roiPct,
    required this.unrealizedDisplay,
  });

  final String totalValueDisplay; // 永续合约总价值
  final double marginUsagePct; // 平均保证金使用率 0..100
  final String biasLabel; // 方向偏差，例如 '中性'
  final int longPct; // 多头持仓占比 0..100
  final int shortPct; // 空头持仓占比 0..100
  final String longValueDisplay; // 多头价值
  final String shortValueDisplay; // 空头价值
  final double roiPct; // ROI（正负判定）
  final String unrealizedDisplay; // 未实现盈亏
}
