import '../../models/whale_profile_models.dart';

/// 已知地址画像 mock（#1753）。按缩写地址索引；未命中走
/// [buildFallbackWhaleProfile] 派生占位，保证任意可点击地址都有详情。
const Map<String, WhaleProfile> mockWhaleProfiles = <String, WhaleProfile>{
  '0x88e…3a01': WhaleProfile(
    address: '0x88e…3a01',
    tag: '机构',
    tagTone: 'info',
    assetSummary: 'BTC · ETH',
    holdingsValueDisplay: '\$128.4M',
    holdings: <WhaleHoldingEntry>[
      WhaleHoldingEntry(
          symbol: 'BTC',
          amountDisplay: '1,204 BTC',
          valueDisplay: '\$82.4M',
          pctDisplay: '+12.8%',
          tone: 'up'),
      WhaleHoldingEntry(
          symbol: 'ETH',
          amountDisplay: '12,800 ETH',
          valueDisplay: '\$46.0M',
          pctDisplay: '+6.2%',
          tone: 'up'),
    ],
    recentActions: <WhaleRecentAction>[
      WhaleRecentAction(
          action: '买入',
          detail: '842 BTC · Binance',
          timeDisplay: '刚刚',
          tone: 'up'),
      WhaleRecentAction(
          action: '转入',
          detail: '4,200 ETH · 冷钱包',
          timeDisplay: '24 分钟',
          tone: 'flat'),
      WhaleRecentAction(
          action: '卖出',
          detail: '120 BTC · OKX',
          timeDisplay: '2 小时',
          tone: 'dn'),
    ],
    stats: WhaleTradeStats(
      pnlDisplay: '+\$8.4M',
      pnlTone: 'up',
      winRatePct: 78,
      realizedDisplay: '+\$6.1M',
      unrealizedDisplay: '+\$2.3M',
      longPct: 72,
      shortPct: 28,
      assetPerf: <WhaleAssetPerf>[
        WhaleAssetPerf(symbol: 'BTC', pctDisplay: '+24.6%', tone: 'up'),
        WhaleAssetPerf(symbol: 'ETH', pctDisplay: '+11.2%', tone: 'up'),
        WhaleAssetPerf(symbol: 'SOL', pctDisplay: '-4.1%', tone: 'dn'),
      ],
    ),
  ),
  '0x4a1…ff2d': WhaleProfile(
    address: '0x4a1…ff2d',
    tag: '聪明钱',
    tagTone: 'accent',
    assetSummary: 'SOL · AVAX',
    holdingsValueDisplay: '\$42.8M',
    holdings: <WhaleHoldingEntry>[
      WhaleHoldingEntry(
          symbol: 'SOL',
          amountDisplay: '184,000 SOL',
          valueDisplay: '\$31.2M',
          pctDisplay: '+18.4%',
          tone: 'up'),
      WhaleHoldingEntry(
          symbol: 'AVAX',
          amountDisplay: '420,000 AVAX',
          valueDisplay: '\$11.6M',
          pctDisplay: '-2.1%',
          tone: 'dn'),
    ],
    recentActions: <WhaleRecentAction>[
      WhaleRecentAction(
          action: '买入',
          detail: '32,000 SOL · Hyperliquid',
          timeDisplay: '8 分钟',
          tone: 'up'),
      WhaleRecentAction(
          action: '卖出',
          detail: '80,000 AVAX · Bybit',
          timeDisplay: '1 小时',
          tone: 'dn'),
    ],
    stats: WhaleTradeStats(
      pnlDisplay: '+\$5.2M',
      pnlTone: 'up',
      winRatePct: 71,
      realizedDisplay: '+\$4.0M',
      unrealizedDisplay: '+\$1.2M',
      longPct: 64,
      shortPct: 36,
      assetPerf: <WhaleAssetPerf>[
        WhaleAssetPerf(symbol: 'SOL', pctDisplay: '+32.0%', tone: 'up'),
        WhaleAssetPerf(symbol: 'AVAX', pctDisplay: '-6.8%', tone: 'dn'),
      ],
    ),
  ),
};

/// 未命中已知地址时的占位画像。基于 address 渲染，保证空态不空。
/// 真实读路径（#1682）接通后整体替换为后端返回。
WhaleProfile buildFallbackWhaleProfile(String address) {
  return WhaleProfile(
    address: address,
    tag: '聪明钱',
    tagTone: 'accent',
    assetSummary: 'BTC · ETH',
    holdingsValueDisplay: '\$18.6M',
    holdings: const <WhaleHoldingEntry>[
      WhaleHoldingEntry(
          symbol: 'BTC',
          amountDisplay: '212 BTC',
          valueDisplay: '\$14.5M',
          pctDisplay: '+4.2%',
          tone: 'up'),
      WhaleHoldingEntry(
          symbol: 'ETH',
          amountDisplay: '1,140 ETH',
          valueDisplay: '\$4.1M',
          pctDisplay: '-1.6%',
          tone: 'dn'),
    ],
    recentActions: const <WhaleRecentAction>[
      WhaleRecentAction(
          action: '买入',
          detail: '64 BTC · Coinbase',
          timeDisplay: '12 分钟',
          tone: 'up'),
    ],
    stats: const WhaleTradeStats(
      pnlDisplay: '+\$1.4M',
      pnlTone: 'up',
      winRatePct: 62,
      realizedDisplay: '+\$0.9M',
      unrealizedDisplay: '+\$0.5M',
      longPct: 58,
      shortPct: 42,
      assetPerf: <WhaleAssetPerf>[
        WhaleAssetPerf(symbol: 'BTC', pctDisplay: '+8.4%', tone: 'up'),
        WhaleAssetPerf(symbol: 'ETH', pctDisplay: '-2.0%', tone: 'dn'),
      ],
    ),
  );
}
