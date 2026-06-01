import '../../models/whale_extra_models.dart';

/// 发现 tab — 聪明钱榜 Top5。
const List<SmartMoneyEntry> mockSmartMoneyTop5 = <SmartMoneyEntry>[
  SmartMoneyEntry(
      rank: 1,
      address: '0x88e…3a01',
      tag: '机构',
      pnlDisplay: '+\$8.4M',
      winRatePct: 78,
      holdings: 'BTC · ETH'),
  SmartMoneyEntry(
      rank: 2,
      address: '0x4a1…ff2d',
      tag: '聪明钱',
      pnlDisplay: '+\$5.2M',
      winRatePct: 71,
      holdings: 'SOL · AVAX'),
  SmartMoneyEntry(
      rank: 3,
      address: '0xb2e…91d7',
      tag: '长期持有',
      pnlDisplay: '+\$3.8M',
      winRatePct: 66,
      holdings: 'BTC'),
  SmartMoneyEntry(
      rank: 4,
      address: '0x7c1…44a3',
      tag: '聪明钱',
      pnlDisplay: '+\$2.9M',
      winRatePct: 69,
      holdings: 'ETH'),
  SmartMoneyEntry(
      rank: 5,
      address: '0x9e2…cd44',
      tag: '新地址',
      pnlDisplay: '+\$1.4M',
      winRatePct: 62,
      holdings: 'PEPE · WIF'),
];

/// 发现 tab — 趋势资产 2×2。
const List<TrendingAssetEntry> mockTrendingAssets = <TrendingAssetEntry>[
  TrendingAssetEntry(
      symbol: 'BTC',
      netDisplay: '+\$284M',
      pctDisplay: '+18%',
      tone: 'up',
      participantCount: 42,
      colorHex: 0xFFF7931A),
  TrendingAssetEntry(
      symbol: 'ETH',
      netDisplay: '+\$118M',
      pctDisplay: '+9%',
      tone: 'up',
      participantCount: 28,
      colorHex: 0xFF627EEA),
  TrendingAssetEntry(
      symbol: 'HYPE',
      netDisplay: '+\$22M',
      pctDisplay: '+12%',
      tone: 'up',
      participantCount: 8,
      colorHex: 0xFF22D3EE),
  TrendingAssetEntry(
      symbol: 'SOL',
      netDisplay: '-\$42M',
      pctDisplay: '-4%',
      tone: 'dn',
      participantCount: 11,
      colorHex: 0xFF9945FF),
];

/// 持仓 tab — 交易所 BTC 余额 24H 变动。
const List<ExchangeFlowEntry> mockExchangeFlows = <ExchangeFlowEntry>[
  ExchangeFlowEntry(
      exchange: 'Binance',
      netDisplay: '-820 BTC',
      tone: 'dn',
      colorHex: 0xFFF0B90B,
      barWeight: 78),
  ExchangeFlowEntry(
      exchange: 'Coinbase',
      netDisplay: '+412 BTC',
      tone: 'up',
      colorHex: 0xFF2563EB,
      barWeight: 39),
  ExchangeFlowEntry(
      exchange: 'OKX',
      netDisplay: '-186 BTC',
      tone: 'dn',
      colorHex: 0xFF0B0B0B,
      barWeight: 18),
  ExchangeFlowEntry(
      exchange: 'Bybit',
      netDisplay: '-92 BTC',
      tone: 'dn',
      colorHex: 0xFFF59E0B,
      barWeight: 9),
];

/// 持仓 tab — 头部地址持仓榜。
const List<TopHolderEntry> mockTopHolders = <TopHolderEntry>[
  TopHolderEntry(
      rank: 1,
      label: 'MicroStrategy',
      amountDisplay: '628,914 BTC',
      changeDisplay: '+8,200',
      tone: 'up'),
  TopHolderEntry(
      rank: 2,
      label: 'BlackRock IBIT',
      amountDisplay: '582,400 BTC',
      changeDisplay: '+12,400',
      tone: 'up'),
  TopHolderEntry(
      rank: 3,
      label: 'Mt.Gox 托管',
      amountDisplay: '141,686 BTC',
      changeDisplay: '—',
      tone: 'flat'),
  TopHolderEntry(
      rank: 4,
      label: 'Tesla Inc.',
      amountDisplay: '9,720 BTC',
      changeDisplay: '0',
      tone: 'flat'),
  TopHolderEntry(
      rank: 5,
      label: 'Marathon',
      amountDisplay: '48,200 BTC',
      changeDisplay: '+820',
      tone: 'up'),
];

/// 监控 tab — 我的监控地址。
const List<WatchAddressEntry> mockWatchAddresses = <WatchAddressEntry>[
  WatchAddressEntry(
      name: '我的关注 · 1',
      address: '0xa83…b8f2',
      lastEventDisplay: '+842 BTC · 刚刚',
      tone: 'up',
      pnlDisplay: '+12.8%',
      live: true),
  WatchAddressEntry(
      name: 'Cumberland',
      address: '0x4f9…0e1c',
      lastEventDisplay: '-318 BTC · 5 分钟',
      tone: 'dn',
      pnlDisplay: '-3.2%',
      live: false),
  WatchAddressEntry(
      name: '冷钱包 · 早期',
      address: '0xb2e…91d7',
      lastEventDisplay: '+512 BTC · 12 分钟',
      tone: 'up',
      pnlDisplay: '+24.6%',
      live: false),
];

/// 监控 tab — 最近告警。
const List<WatchAlertEntry> mockWatchAlerts = <WatchAlertEntry>[
  WatchAlertEntry(
      type: '大额转入',
      detail: '0xa83…b8f2 → BINANCE · 842 BTC',
      timeDisplay: '刚刚',
      tone: 'up'),
  WatchAlertEntry(
      type: '阈值触发',
      detail: '0x88e…3a01 单笔 ≥ \$100M',
      timeDisplay: '24 分钟',
      tone: 'warn'),
  WatchAlertEntry(
      type: '地址休眠',
      detail: '0xb2e…91d7 9 年首次活跃',
      timeDisplay: '1 小时',
      tone: 'info'),
];

/// 通知中心 — 6 条通知（3 未读 + 3 已读）。
const List<WhaleNotification> mockWhaleNotifications = <WhaleNotification>[
  WhaleNotification(
    id: 'n1',
    kind: WhaleNotificationKind.alert,
    tone: 'up',
    unread: true,
    title: '巨额买入 · BTC',
    body: 'Galaxy Digital 在 Binance 买入 842 BTC (\$57.6M)',
    meta: '刚刚 · 触发规则「机构 ≥ \$50M」',
    address: '0xa83…b8f2',
  ),
  WhaleNotification(
    id: 'n2',
    kind: WhaleNotificationKind.watch,
    tone: 'up',
    unread: true,
    title: '监控地址异动',
    body: 'Smart Money · 7D 累计净买入 1,204 BTC',
    meta: '2 分钟前 · 监控组「聪明钱」',
    address: '0x7c1…44a3',
  ),
  WhaleNotification(
    id: 'n3',
    kind: WhaleNotificationKind.alert,
    tone: 'dn',
    unread: true,
    title: '大额卖出 · ETH',
    body: 'Cumberland 在 Hyperliquid 卖出 318 ETH (\$21.8M)',
    meta: '5 分钟前 · 触发规则「做市商 ≥ \$20M」',
    address: '0x4f9…0e1c',
  ),
  WhaleNotification(
    id: 'n4',
    kind: WhaleNotificationKind.flow,
    tone: 'up',
    unread: false,
    title: '净流入突破阈值',
    body: 'BTC 1H 净流入 +\$284M，超过 24H 平均 2.1×',
    meta: '12 分钟前 · 资金流向',
  ),
  WhaleNotification(
    id: 'n5',
    kind: WhaleNotificationKind.watch,
    tone: 'neutral',
    unread: false,
    title: '冷钱包激活',
    body: '休眠 412 天的地址转出 512 BTC 至交易所',
    meta: '24 分钟前 · 监控组「长期持有者」',
    address: '0xb2e…91d7',
  ),
  WhaleNotification(
    id: 'n6',
    kind: WhaleNotificationKind.system,
    tone: 'neutral',
    unread: false,
    title: '监控规则已生效',
    body: '新规则「机构净流入 ≥ \$50M / 1H」开始监控',
    meta: '1 小时前 · 系统',
  ),
];
