import '../../models/whale_models.dart';

/// 巨鲸事件 pool；`MockWhaleFeedRepository.watchFeed` 每 3s 随机抽一条推流。
/// 时间戳为相对基准（mock 阶段不要求严格的 wall clock）。
final List<WhaleEvent> mockWhaleEvents = <WhaleEvent>[
  WhaleEvent(
    id: 'w-1',
    symbol: 'BTCUSDT',
    amountUsd: 12_500_000,
    direction: 'in',
    fromLabel: 'Binance Hot',
    toLabel: 'Unknown Wallet',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
  ),
  WhaleEvent(
    id: 'w-2',
    symbol: 'ETHUSDT',
    amountUsd: 3_200_000,
    direction: 'out',
    fromLabel: 'Coinbase',
    toLabel: 'Cold Storage',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_060_000),
  ),
  WhaleEvent(
    id: 'w-3',
    symbol: 'SOLUSDT',
    amountUsd: 850_000,
    direction: 'in',
    fromLabel: 'Unknown',
    toLabel: 'OKX',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_120_000),
  ),
  WhaleEvent(
    id: 'w-4',
    symbol: 'BTCUSDT',
    amountUsd: 5_700_000,
    direction: 'out',
    fromLabel: 'Bitfinex',
    toLabel: 'Unknown',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_180_000),
  ),
  WhaleEvent(
    id: 'w-5',
    symbol: 'DOGEUSDT',
    amountUsd: 410_000,
    direction: 'in',
    fromLabel: 'Robinhood',
    toLabel: 'Unknown',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_240_000),
  ),
  WhaleEvent(
    id: 'w-6',
    symbol: 'ETHUSDT',
    amountUsd: 2_100_000,
    direction: 'in',
    fromLabel: 'Kraken',
    toLabel: 'Unknown',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_300_000),
  ),
];
