import 'package:flutter/material.dart';

import '../../models/exchange_long_short_models.dart';

/// 6 家交易所的色标（与 `design/project/mobile/m-screens-3.jsx:307-314` 对齐）。
const List<({String name, Color color, String glyph})> _exchangePalette =
    <({String name, Color color, String glyph})>[
  (name: 'Binance', color: Color(0xFFF0B90B), glyph: 'B'),
  (name: 'OKX', color: Color(0xFF1E1E1E), glyph: 'O'),
  (name: 'Bybit', color: Color(0xFFF7A600), glyph: 'B'),
  (name: 'Bitget', color: Color(0xFF00CED1), glyph: 'B'),
  (name: 'HTX', color: Color(0xFF3076FF), glyph: 'H'),
  (name: 'HyperLiquid', color: Color(0xFF97F0E0), glyph: 'H'),
];

ExchangeLongShort _row(
  int idx, {
  required String longA,
  required String shortA,
  required double l,
}) {
  final p = _exchangePalette[idx];
  return ExchangeLongShort(
    exchange: p.name,
    color: p.color,
    glyph: p.glyph,
    longAmount: longA,
    shortAmount: shortA,
    longPct: l,
    shortPct: 100.0 - l,
  );
}

final DateTime _snapshotAt =
    DateTime.fromMillisecondsSinceEpoch(1_716_018_000_000);

final Map<String, MarketLongShortSnapshot> mockMarketLongShortBySymbol =
    <String, MarketLongShortSnapshot>{
  'BTCUSDT': MarketLongShortSnapshot(
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    assetGlyph: '₿',
    assetGradientStart: const Color(0xFFF7931A),
    assetGradientEnd: const Color(0xFFC16100),
    totalNotional: '\$8.6B',
    longNotional: '\$5.52B',
    shortNotional: '\$3.08B',
    longPct: 64.2,
    shortPct: 35.8,
    timestamp: _snapshotAt,
    exchanges: <ExchangeLongShort>[
      _row(0, longA: '\$1.82B', shortA: '\$1.04B', l: 63.6),
      _row(1, longA: '\$884M', shortA: '\$526M', l: 62.7),
      _row(2, longA: '\$642M', shortA: '\$418M', l: 60.6),
      _row(3, longA: '\$386M', shortA: '\$210M', l: 64.8),
      _row(4, longA: '\$248M', shortA: '\$152M', l: 62.0),
      _row(5, longA: '\$184M', shortA: '\$118M', l: 60.9),
    ],
  ),
  'ETHUSDT': MarketLongShortSnapshot(
    symbol: 'ETHUSDT',
    baseAsset: 'ETH',
    assetGlyph: 'Ξ',
    assetGradientStart: const Color(0xFF627EEA),
    assetGradientEnd: const Color(0xFF3C58C5),
    totalNotional: '\$4.2B',
    longNotional: '\$2.18B',
    shortNotional: '\$2.02B',
    longPct: 52.0,
    shortPct: 48.0,
    timestamp: _snapshotAt,
    exchanges: <ExchangeLongShort>[
      _row(0, longA: '\$902M', shortA: '\$812M', l: 52.6),
      _row(1, longA: '\$418M', shortA: '\$402M', l: 51.0),
      _row(2, longA: '\$316M', shortA: '\$298M', l: 51.5),
      _row(3, longA: '\$182M', shortA: '\$172M', l: 51.4),
      _row(4, longA: '\$124M', shortA: '\$118M', l: 51.2),
      _row(5, longA: '\$96M', shortA: '\$92M', l: 51.1),
    ],
  ),
  'SOLUSDT': MarketLongShortSnapshot(
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    assetGlyph: '◎',
    assetGradientStart: const Color(0xFF9945FF),
    assetGradientEnd: const Color(0xFF14F195),
    totalNotional: '\$1.4B',
    longNotional: '\$854M',
    shortNotional: '\$546M',
    longPct: 61.0,
    shortPct: 39.0,
    timestamp: _snapshotAt,
    exchanges: <ExchangeLongShort>[
      _row(0, longA: '\$298M', shortA: '\$182M', l: 62.1),
      _row(1, longA: '\$152M', shortA: '\$102M', l: 59.8),
      _row(2, longA: '\$118M', shortA: '\$78M', l: 60.2),
      _row(3, longA: '\$72M', shortA: '\$46M', l: 61.0),
      _row(4, longA: '\$48M', shortA: '\$32M', l: 60.0),
      _row(5, longA: '\$36M', shortA: '\$24M', l: 60.0),
    ],
  ),
};

/// 兜底快照（未命中 symbol 时使用，避免空数据）。
MarketLongShortSnapshot fallbackSnapshot(String symbol) {
  final base = symbol.replaceAll('USDT', '');
  return MarketLongShortSnapshot(
    symbol: symbol,
    baseAsset: base.isEmpty ? symbol : base,
    assetGlyph: base.isEmpty ? '★' : base.substring(0, 1),
    assetGradientStart: const Color(0xFF6B7280),
    assetGradientEnd: const Color(0xFF374151),
    totalNotional: '\$120M',
    longNotional: '\$66M',
    shortNotional: '\$54M',
    longPct: 55.0,
    shortPct: 45.0,
    timestamp: _snapshotAt,
    exchanges: <ExchangeLongShort>[
      _row(0, longA: '\$32M', shortA: '\$24M', l: 57.1),
      _row(1, longA: '\$18M', shortA: '\$14M', l: 56.3),
      _row(2, longA: '\$12M', shortA: '\$10M', l: 54.5),
      _row(3, longA: '\$8M', shortA: '\$6M', l: 57.1),
      _row(4, longA: '\$5M', shortA: '\$4M', l: 55.6),
      _row(5, longA: '\$3M', shortA: '\$2.5M', l: 54.5),
    ],
  );
}
