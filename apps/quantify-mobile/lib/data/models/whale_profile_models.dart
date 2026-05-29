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
class WhaleAssetPerf {
  const WhaleAssetPerf({
    required this.symbol,
    required this.pctDisplay,
    required this.tone,
  });

  final String symbol;
  final String pctDisplay; // 例如 '+24.6%'
  final String tone; // 'up' | 'dn'
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
  });

  final String address; // 省略号缩写地址，例如 '0x88e…3a01'
  final String tag; // 机构 / 聪明钱 / 长期持有 / 新地址
  final String tagTone; // 'accent' | 'info' | 'warn'
  final String assetSummary; // 例如 'BTC · ETH · SOL'
  final String holdingsValueDisplay; // 总持仓估值，例如 '$128.4M'
  final List<WhaleHoldingEntry> holdings;
  final List<WhaleRecentAction> recentActions;
  final WhaleTradeStats stats;
}
