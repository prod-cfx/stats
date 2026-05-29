import '../../models/whale_watch_models.dart';

/// 监控规则种子（issue #1754）。由原 `mockWatchAddresses` 派生显示字段，
/// 补齐规则字段（阈值 / 方向 / 渠道 / 静音），作为 mock CRUD 初始状态。
const List<WatchRule> mockWatchRules = <WatchRule>[
  WatchRule(
    id: 'w1',
    name: '我的关注 · 1',
    address: '0xa83…b8f2',
    lastEventDisplay: '+842 BTC · 刚刚',
    tone: 'up',
    pnlDisplay: '+12.8%',
    live: true,
    thresholdUsd: 1000000,
    direction: WatchRuleDirection.both,
    channels: <WatchRuleChannel>{WatchRuleChannel.push},
    muted: false,
  ),
  WatchRule(
    id: 'w2',
    name: 'Cumberland',
    address: '0x4f9…0e1c',
    lastEventDisplay: '-318 BTC · 5 分钟',
    tone: 'dn',
    pnlDisplay: '-3.2%',
    live: false,
    thresholdUsd: 5000000,
    direction: WatchRuleDirection.outflow,
    channels: <WatchRuleChannel>{
      WatchRuleChannel.push,
      WatchRuleChannel.telegram,
    },
    muted: false,
  ),
  WatchRule(
    id: 'w3',
    name: '冷钱包 · 早期',
    address: '0xb2e…91d7',
    lastEventDisplay: '+512 BTC · 12 分钟',
    tone: 'up',
    pnlDisplay: '+24.6%',
    live: false,
    thresholdUsd: 10000000,
    direction: WatchRuleDirection.inflow,
    channels: <WatchRuleChannel>{WatchRuleChannel.email},
    muted: true,
  ),
];

/// 搜索语料（issue #1754）。覆盖 5 类：地址 / 标签 / 资产 / 交易所 /
/// 事件类型。mock repository 对 title+subtitle 做大小写不敏感子串匹配。
const List<WhaleSearchResult> mockSearchCorpus = <WhaleSearchResult>[
  // 地址
  WhaleSearchResult(
    kind: WhaleSearchResultKind.address,
    title: '0xa83…b8f2',
    subtitle: '我的关注 · 1 · 7D +12.8%',
    address: '0xa83…b8f2',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.address,
    title: '0x4f9…0e1c',
    subtitle: 'Cumberland · 做市商',
    address: '0x4f9…0e1c',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.address,
    title: '0xb2e…91d7',
    subtitle: '冷钱包 · 早期 · 休眠 9 年',
    address: '0xb2e…91d7',
  ),
  // 标签
  WhaleSearchResult(
    kind: WhaleSearchResultKind.label,
    title: '聪明钱',
    subtitle: '近 30D 胜率 ≥ 70% 的地址群',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.label,
    title: '机构',
    subtitle: '公开标注的机构 / 基金地址',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.label,
    title: '做市商',
    subtitle: 'Cumberland / Wintermute 等',
  ),
  // 资产
  WhaleSearchResult(
    kind: WhaleSearchResultKind.asset,
    title: 'BTC',
    subtitle: '比特币 · 巨鲸净流入 +284M',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.asset,
    title: 'ETH',
    subtitle: '以太坊 · 巨鲸净流入 +92M',
  ),
  // 交易所
  WhaleSearchResult(
    kind: WhaleSearchResultKind.exchange,
    title: 'Binance',
    subtitle: '现货 + 合约 · 24H 净流出',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.exchange,
    title: 'Coinbase',
    subtitle: '现货 · 机构入金主通道',
  ),
  // 事件类型
  WhaleSearchResult(
    kind: WhaleSearchResultKind.eventType,
    title: '大额转入',
    subtitle: '单笔 ≥ \$1M 转入交易所',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.eventType,
    title: '阈值触发',
    subtitle: '命中自定义监控阈值',
  ),
  WhaleSearchResult(
    kind: WhaleSearchResultKind.eventType,
    title: '地址休眠',
    subtitle: '长期休眠地址首次活跃',
  ),
];
