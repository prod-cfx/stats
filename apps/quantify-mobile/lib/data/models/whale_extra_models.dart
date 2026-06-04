/// 巨鲸动向页（issue #1560）发现/持仓/监控/通知 tab 用到的纯值模型。
///
/// 所有字段保持已格式化字符串（如 `pnl: '+$8.4M'`），由 mock fixture 直接
/// 提供给 widget 渲染——不再在 widget 层做数字格式化，避免 i18n 与单位
/// 转换在 mock 阶段引入不必要复杂度。
library;

/// 聪明钱榜单行。
class SmartMoneyEntry {
  const SmartMoneyEntry({
    required this.rank,
    required this.address,
    required this.tag,
    required this.pnlDisplay,
    required this.winRatePct,
    required this.holdings,
  });

  final int rank;
  final String address;
  final String tag; // 机构 / 聪明钱 / 长期持有 / 新地址
  final String pnlDisplay;
  final int winRatePct;
  final String holdings; // 例如 'BTC · ETH'
}

/// 趋势资产 2×2 grid 单元。
class TrendingAssetEntry {
  const TrendingAssetEntry({
    required this.symbol,
    required this.netDisplay,
    required this.pctDisplay,
    required this.tone,
    required this.participantCount,
    required this.colorHex,
  });

  final String symbol;
  final String netDisplay;
  final String pctDisplay;
  final String tone; // 'up' | 'dn'
  final int participantCount;
  final int colorHex; // 圆形 logo 背景色
}

/// 交易所余额变动单行（持仓 tab）。
class ExchangeFlowEntry {
  const ExchangeFlowEntry({
    required this.exchange,
    required this.netDisplay,
    required this.tone,
    required this.colorHex,
    required this.barWeight,
  });

  final String exchange;
  final String netDisplay;
  final String tone; // 'up' | 'dn'
  final int colorHex;
  final int barWeight; // 用于相对宽度比例
}

/// 头部地址持仓榜单行。
class TopHolderEntry {
  const TopHolderEntry({
    required this.rank,
    required this.label,
    required this.amountDisplay,
    required this.changeDisplay,
    required this.tone,
  });

  final int rank;
  final String label;
  final String amountDisplay;
  final String changeDisplay;
  final String tone; // 'up' | 'dn' | 'flat'
}

/// 我的监控地址（监控 tab）。
class WatchAddressEntry {
  const WatchAddressEntry({
    required this.name,
    required this.address,
    required this.lastEventDisplay,
    required this.tone,
    required this.pnlDisplay,
    required this.live,
  });

  final String name;
  final String address;
  final String lastEventDisplay; // 例如 '+842 BTC · 刚刚'
  final String tone; // 'up' | 'dn'
  final String pnlDisplay;
  final bool live;
}

/// 最近告警（监控 tab）。
class WatchAlertEntry {
  const WatchAlertEntry({
    required this.type,
    required this.detail,
    required this.timeDisplay,
    required this.tone,
  });

  final String type;
  final String detail;
  final String timeDisplay;
  final String tone; // 'up' | 'warn' | 'info'
}

/// 通知中心通知 kind。
enum WhaleNotificationKind { alert, watch, flow, system }

/// 通知中心单条通知。
class WhaleNotification {
  const WhaleNotification({
    required this.id,
    required this.kind,
    required this.tone,
    required this.unread,
    required this.title,
    required this.body,
    required this.meta,
    this.address,
    this.actions = const <String>[],
  });

  final String id;
  final WhaleNotificationKind kind;
  final String tone; // 'up' | 'dn' | 'neutral'
  final bool unread;
  final String title;
  final String body;
  final String meta;
  final String? address;
  final List<String> actions;

  WhaleNotification copyWith({bool? unread}) => WhaleNotification(
    id: id,
    kind: kind,
    tone: tone,
    unread: unread ?? this.unread,
    title: title,
    body: body,
    meta: meta,
    address: address,
    actions: actions,
  );
}
