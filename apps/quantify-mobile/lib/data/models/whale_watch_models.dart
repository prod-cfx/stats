/// 巨鲸搜索与地址监控管理（issue #1754）用到的纯值模型。
///
/// 监控规则在 mock 阶段为 session 内存态：UI 持有 [WatchRule] 列表作为
/// 单一数据源，CRUD 直接改本地列表；真实持久化随 #1682/#1683 接入后
/// 替换 repository 实现即可，UI/校验不变。
library;

/// 告警推送渠道。展示顺序对齐设计稿 CreateMonitorSheet：Web / Mail / Telegram。
enum WatchRuleChannel { push, email, telegram }

/// 监控规则——监控 tab 行的「显示 + 规则」超集。
///
/// 显示字段（[name]/[lastEventDisplay]/[tone]/[pnlDisplay]/[live]）由种子
/// 派生，CRUD 只修改规则字段（[thresholdUsd]/[channels]/[muted]）。
class WatchRule {
  const WatchRule({
    required this.id,
    required this.name,
    required this.address,
    required this.lastEventDisplay,
    required this.tone,
    required this.pnlDisplay,
    required this.live,
    required this.thresholdUsd,
    required this.channels,
    required this.muted,
    this.alias,
    this.perpValueUsd,
    this.unrealizedPnlUsd,
    this.availMarginUsd,
    this.marginUsagePct,
    this.positions,
  });

  final String id;
  final String name;
  final String address;
  final String lastEventDisplay; // 例如 '+842 BTC · 刚刚'
  final String tone; // 'up' | 'dn'
  final String pnlDisplay;
  final bool live;
  final double thresholdUsd; // 触发阈值（USD）
  final Set<WatchRuleChannel> channels;
  final bool muted;

  /// 地址备注（可选）。对齐设计稿 CreateMonitorSheet `地址备注` 字段。
  final String? alias;

  /// 监控地址卡永续字段（issue #1769）。全部 nullable：null 表示「空仓 /
  /// 数据未就绪」，卡片以灰显 `-` 占位，接真实数据通道（#1682/#1683）后填充。
  final double? perpValueUsd; // 永续合约总价值（USD）
  final double? unrealizedPnlUsd; // 未实现盈亏（USD，可负）
  final double? availMarginUsd; // 可用保证金（USD）
  final int? marginUsagePct; // 保证金使用率（0-100）
  final int? positions; // 持仓数

  WatchRule copyWith({
    String? name,
    String? alias,
    double? thresholdUsd,
    Set<WatchRuleChannel>? channels,
    bool? muted,
  }) {
    return WatchRule(
      id: id,
      name: name ?? this.name,
      address: address,
      lastEventDisplay: lastEventDisplay,
      tone: tone,
      pnlDisplay: pnlDisplay,
      live: live,
      thresholdUsd: thresholdUsd ?? this.thresholdUsd,
      channels: channels ?? this.channels,
      muted: muted ?? this.muted,
      alias: alias ?? this.alias,
      perpValueUsd: perpValueUsd,
      unrealizedPnlUsd: unrealizedPnlUsd,
      availMarginUsd: availMarginUsd,
      marginUsagePct: marginUsagePct,
      positions: positions,
    );
  }
}

/// 搜索结果分类：地址 / 标签 / 资产 / 交易所 / 事件类型。
enum WhaleSearchResultKind { address, label, asset, exchange, eventType }

/// 单条搜索结果。命中地址类时携带 [address] 供跳转地址详情。
class WhaleSearchResult {
  const WhaleSearchResult({
    required this.kind,
    required this.title,
    required this.subtitle,
    this.address,
  });

  final WhaleSearchResultKind kind;
  final String title;
  final String subtitle;
  final String? address;
}
