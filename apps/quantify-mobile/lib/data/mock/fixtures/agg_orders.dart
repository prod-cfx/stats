import 'package:flutter/painting.dart';

import '../../models/agg_orders_models.dart';

/// 聚合挂单 / 持仓量 / 成交量 mock fixtures（issue #1854）。
///
/// 移植设计稿 `m-screens-data.jsx`：`EXCHANGES`(:208) / `AGG_ASKS`(:217) /
/// `AGG_BIDS`(:234) / `OI_DATA`(:1004) / `VOL_DATA`(:1344)。
/// [aggregateLevels] / [withCumulative] 为纯函数，可单测。

/// 订单簿来源交易所（默认全选）。
const List<AggExchange> kAggExchanges = <AggExchange>[
  AggExchange(
    key: 'BIN',
    name: 'Binance',
    letter: 'B',
    color: Color(0xFFF0B90B),
    fg: Color(0xFF000000),
  ),
  AggExchange(
    key: 'BYB',
    name: 'Bybit',
    letter: 'Y',
    color: Color(0xFFF7A600),
    fg: Color(0xFF000000),
  ),
  AggExchange(
    key: 'BMX',
    name: 'Bitmax',
    letter: 'B',
    color: Color(0xFF1F2937),
    fg: Color(0xFFFFFFFF),
  ),
  AggExchange(
    key: 'OKX',
    name: 'OKX',
    letter: 'O',
    color: Color(0xFF000000),
    fg: Color(0xFFFFFFFF),
  ),
];

final Map<String, AggExchange> kAggExchangeMap = <String, AggExchange>{
  for (final AggExchange e in kAggExchanges) e.key: e,
};

/// ASKS（高价 → 近 mid）。
const List<AggBookLevel> kAggAsks = <AggBookLevel>[
  AggBookLevel(price: 75864, qty: 0.612, exchange: 'BIN'),
  AggBookLevel(price: 75859, qty: 3.552, exchange: 'BIN'),
  AggBookLevel(price: 75853, qty: 3.188, exchange: 'BMX'),
  AggBookLevel(price: 75848, qty: 0.862, exchange: 'BIN'),
  AggBookLevel(price: 75843, qty: 1.064, exchange: 'OKX'),
  AggBookLevel(price: 75837, qty: 1.964, exchange: 'BIN'),
  AggBookLevel(price: 75832, qty: 34.3802, exchange: 'BIN', hot: true),
  AggBookLevel(price: 75827, qty: 3.3313, exchange: 'BIN'),
  AggBookLevel(price: 75821, qty: 123.358, exchange: 'BIN', hot: true),
  AggBookLevel(price: 75816, qty: 21.996, exchange: 'BIN'),
  AggBookLevel(price: 75811, qty: 2.088, exchange: 'BYB'),
  AggBookLevel(price: 75805, qty: 0.265, exchange: 'BIN'),
  AggBookLevel(price: 75800, qty: 9.742, exchange: 'BYB'),
];

/// BIDS（高价 → 低价；高价近 mid）。
const List<AggBookLevel> kAggBids = <AggBookLevel>[
  AggBookLevel(price: 75812, qty: 23.3536, exchange: 'BIN'),
  AggBookLevel(price: 75807, qty: 2.5655, exchange: 'BIN'),
  AggBookLevel(
    price: 75801,
    qty: 171.6693,
    exchange: 'BIN',
    hot: true,
    best: true,
  ),
  AggBookLevel(price: 75796, qty: 4.029, exchange: 'BIN'),
  AggBookLevel(price: 75791, qty: 2.446, exchange: 'BIN'),
  AggBookLevel(price: 75785, qty: 1.429, exchange: 'BIN'),
  AggBookLevel(price: 75780, qty: 3.714, exchange: 'BIN'),
  AggBookLevel(price: 75775, qty: 3.836, exchange: 'BIN'),
  AggBookLevel(price: 75769, qty: 4.803, exchange: 'BIN'),
  AggBookLevel(price: 75764, qty: 4.416, exchange: 'BIN'),
  AggBookLevel(price: 75759, qty: 5.012, exchange: 'BIN'),
  AggBookLevel(price: 75753, qty: 1.488, exchange: 'BIN'),
  AggBookLevel(price: 75748, qty: 3.48, exchange: 'BIN'),
];

/// 价格精度聚合档位（设计稿抽屉 1/10/100）。
const List<int> kAggPrecisions = <int>[1, 10, 100];

/// 按价格桶聚合（`bucket > 1` 时生效）。ask 向上取整、bid 向下取整，
/// 桶边界落在 mid 两侧不重叠。结果按价格降序（与展示顺序一致）。纯函数。
List<AggBookLevel> aggregateLevels(
  List<AggBookLevel> rows,
  int bucket,
  bool isAsk,
) {
  if (bucket <= 1 || rows.isEmpty) return rows;
  final Map<double, AggBookLevel> map = <double, AggBookLevel>{};
  for (final AggBookLevel r in rows) {
    final double key = isAsk
        ? (r.price / bucket).ceilToDouble() * bucket
        : (r.price / bucket).floorToDouble() * bucket;
    final AggBookLevel? existing = map[key];
    if (existing == null) {
      map[key] = r.copyWith(price: key);
    } else {
      map[key] = existing.copyWith(
        qty: existing.qty + r.qty,
        hot: existing.hot || r.hot,
      );
    }
  }
  return map.values.toList()
    ..sort((AggBookLevel a, AggBookLevel b) => b.price.compareTo(a.price));
}

/// 填充累计数量。ask 从近 mid（列表末）向外累加；bid 从高价（列表首）向下累加。
/// 返回顺序与输入一致（高价在前）。纯函数。
List<AggBookLevel> withCumulative(List<AggBookLevel> rows, bool isAsk) {
  if (rows.isEmpty) return rows;
  if (isAsk) {
    double acc = 0;
    final List<AggBookLevel> out = <AggBookLevel>[];
    for (final AggBookLevel r in rows.reversed) {
      acc += r.qty;
      out.add(r.copyWith(total: acc));
    }
    return out.reversed.toList();
  }
  double acc = 0;
  return rows.map((AggBookLevel r) {
    acc += r.qty;
    return r.copyWith(total: acc);
  }).toList();
}

// ── 聚合持仓量 ──────────────────────────────────────────────────────────

/// 持仓量币种 chips。
const List<String> kOiCoins = <String>[
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', //
  'ZEC', 'BCH', 'SUI', 'ADA', 'LINK', 'AVAX',
];

/// 持仓量/成交量表交易所元数据（含订单簿之外的更多所）。
const Map<String, AggExchange> kOiExchangeMap = <String, AggExchange>{
  'BIN': AggExchange(
      key: 'BIN',
      name: 'Binance',
      letter: 'B',
      color: Color(0xFFF0B90B),
      fg: Color(0xFF000000)),
  'BYB': AggExchange(
      key: 'BYB',
      name: 'Bybit',
      letter: 'Y',
      color: Color(0xFFF7A600),
      fg: Color(0xFF000000)),
  'LB': AggExchange(
      key: 'LB',
      name: 'LBank',
      letter: 'L',
      color: Color(0xFF1B1B1B),
      fg: Color(0xFFFFFFFF)),
  'BG': AggExchange(
      key: 'BG',
      name: 'Bitget',
      letter: 'G',
      color: Color(0xFF00D8C9),
      fg: Color(0xFF000000)),
  'KC': AggExchange(
      key: 'KC',
      name: 'KuCoin',
      letter: 'K',
      color: Color(0xFF22D896),
      fg: Color(0xFF000000)),
  'OKX': AggExchange(
      key: 'OKX',
      name: 'OKX',
      letter: 'O',
      color: Color(0xFF000000),
      fg: Color(0xFFFFFFFF)),
  'BIX': AggExchange(
      key: 'BIX',
      name: 'BingX',
      letter: 'X',
      color: Color(0xFF2962FF),
      fg: Color(0xFFFFFFFF)),
  'WBT': AggExchange(
      key: 'WBT',
      name: 'WhiteBIT',
      letter: 'W',
      color: Color(0xFF0E1726),
      fg: Color(0xFFFFFFFF)),
  'MEX': AggExchange(
      key: 'MEX',
      name: 'MEXC',
      letter: 'M',
      color: Color(0xFF1D6EFC),
      fg: Color(0xFFFFFFFF)),
  'HL': AggExchange(
      key: 'HL',
      name: 'Hyperliquid',
      letter: 'H',
      color: Color(0xFF34D399),
      fg: Color(0xFF000000)),
  'GT': AggExchange(
      key: 'GT',
      name: 'Gate',
      letter: 'G',
      color: Color(0xFF6C5CE7),
      fg: Color(0xFFFFFFFF)),
  'BTX': AggExchange(
      key: 'BTX',
      name: 'Bitunix',
      letter: 'B',
      color: Color(0xFF0E1726),
      fg: Color(0xFFFFFFFF)),
  'CEX': AggExchange(
      key: 'CEX',
      name: 'CoinEx',
      letter: 'C',
      color: Color(0xFF2EB8AA),
      fg: Color(0xFFFFFFFF)),
  'CME': AggExchange(
      key: 'CME',
      name: 'CME',
      letter: 'M',
      color: Color(0xFF5B9BD5),
      fg: Color(0xFFFFFFFF)),
  'KRK': AggExchange(
      key: 'KRK',
      name: 'Kraken',
      letter: 'K',
      color: Color(0xFF5841D8),
      fg: Color(0xFFFFFFFF)),
  'HTX': AggExchange(
      key: 'HTX',
      name: 'HTX',
      letter: 'H',
      color: Color(0xFF3076FF),
      fg: Color(0xFFFFFFFF)),
  'LGT': AggExchange(
      key: 'LGT',
      name: 'Lighter',
      letter: 'L',
      color: Color(0xFFA78BFA),
      fg: Color(0xFFFFFFFF)),
  'BMX': AggExchange(
      key: 'BMX',
      name: 'Bitmex',
      letter: 'X',
      color: Color(0xFF1B1B1B),
      fg: Color(0xFFFFFFFF)),
  'CB': AggExchange(
      key: 'CB',
      name: 'Coinbase',
      letter: 'C',
      color: Color(0xFF1652F0),
      fg: Color(0xFFFFFFFF)),
  'AST': AggExchange(
      key: 'AST',
      name: 'Aster',
      letter: 'A',
      color: Color(0xFFF59E0B),
      fg: Color(0xFF000000)),
  'CRP': AggExchange(
      key: 'CRP',
      name: 'Crypto.com',
      letter: 'C',
      color: Color(0xFF003CDA),
      fg: Color(0xFFFFFFFF)),
  'DYX': AggExchange(
      key: 'DYX',
      name: 'dYdX',
      letter: 'D',
      color: Color(0xFF6966FF),
      fg: Color(0xFFFFFFFF)),
};

/// 持仓量数据（设计稿仅含 BTC，其余币种走「暂无数据」空态）。
final Map<String, OiSnapshot> kOiData = <String, OiSnapshot>{
  'BTC': const OiSnapshot(
    total: OiTotal(qty: 3.202e9, usd: 7.6e8, h24: -8.95),
    rows: <OiRow>[
      OiRow(exchange: 'BIN', qty: 3.58e8, usd: 8493.45e4, pct: 11.18, h1: -1.05, h4: -1.79, h24: -8.35, oiVol: 0.0812),
      OiRow(exchange: 'BYB', qty: 2.04e8, usd: 4844.29e4, pct: 6.38, h1: 0.06, h4: -4.77, h24: -15.73, oiVol: 0.0342),
      OiRow(exchange: 'LB', qty: 1.80e8, usd: 4284.88e4, pct: 5.64, h1: 0.0, h4: -1.42, h24: -5.54, oiVol: 0.0),
      OiRow(exchange: 'BG', qty: 1.60e8, usd: 3785.66e4, pct: 4.98, h1: -0.67, h4: 0.67, h24: 2.72, oiVol: 0.0371),
      OiRow(exchange: 'KC', qty: 1.56e8, usd: 3703.78e4, pct: 4.87, h1: 0.42, h4: 1.88, h24: -18.07, oiVol: 0.027),
      OiRow(exchange: 'OKX', qty: 1.26e8, usd: 2999.09e4, pct: 3.95, h1: -0.54, h4: 0.07, h24: -7.79, oiVol: 0.0204),
      OiRow(exchange: 'BIX', qty: 9194.84e4, usd: 2182.4e4, pct: 2.87, h1: -5.01, h4: 1.64, h24: -8.19, oiVol: 0.0),
      OiRow(exchange: 'WBT', qty: 7992.58e4, usd: 1890.99e4, pct: 2.49, h1: -0.96, h4: -1.42, h24: -9.12, oiVol: 0.0),
      OiRow(exchange: 'MEX', qty: 6398.44e4, usd: 1518.94e4, pct: 2.0, h1: -1.7, h4: -3.36, h24: -13.27, oiVol: 0.0),
      OiRow(exchange: 'HL', qty: 5200.5e4, usd: 1234.08e4, pct: 1.62, h1: -0.26, h4: -3.43, h24: -3.44, oiVol: 0.0),
      OiRow(exchange: 'GT', qty: 4000.51e4, usd: 948.92e4, pct: 1.25, h1: -0.77, h4: -4.89, h24: -16.88, oiVol: 0.0076),
      OiRow(exchange: 'BTX', qty: 2047.52e4, usd: 485.88e4, pct: 0.64, h1: -2.71, h4: -3.98, h24: -16.66, oiVol: 0.0),
      OiRow(exchange: 'CEX', qty: 1687.86e4, usd: 400.7e4, pct: 0.53, h1: -0.5, h4: 1.15, h24: -10.39, oiVol: 0.0),
      OiRow(exchange: 'CME', qty: 1409e4, usd: 334.5e4, pct: 0.44, h1: -0.03, h4: 3.93, h24: 0.0, oiVol: 0.0),
      OiRow(exchange: 'KRK', qty: 1129.05e4, usd: 267.93e4, pct: 0.35, h1: -0.17, h4: -2.75, h24: -15.05, oiVol: 0.0),
      OiRow(exchange: 'HTX', qty: 929.47e4, usd: 220.43e4, pct: 0.29, h1: 0.0, h4: -2.08, h24: -2.19, oiVol: 0.0),
      OiRow(exchange: 'LGT', qty: 478.2e4, usd: 113.43e4, pct: 0.15, h1: -1.28, h4: -4.67, h24: -8.05, oiVol: 0.0),
      OiRow(exchange: 'BMX', qty: 386.57e4, usd: 91.88e4, pct: 0.12, h1: -8.55, h4: -9.32, h24: -9.48, oiVol: 0.0),
      OiRow(exchange: 'CB', qty: 288.06e4, usd: 68.38e4, pct: 0.09, h1: -1.13, h4: -10.06, h24: -14.27, oiVol: 0.0),
      OiRow(exchange: 'AST', qty: 255.36e4, usd: 60.78e4, pct: 0.08, h1: 0.25, h4: -2.11, h24: -5.17, oiVol: 0.0),
      OiRow(exchange: 'CRP', qty: 148.64e4, usd: 35.3e4, pct: 0.05, h1: 0.26, h4: 1.84, h24: -11.21, oiVol: 0.0),
      OiRow(exchange: 'DYX', qty: 120.66e4, usd: 28.65e4, pct: 0.04, h1: -0.08, h4: -1.38, h24: 1.58, oiVol: 0.0),
    ],
  ),
};

// ── 聚合成交量 ──────────────────────────────────────────────────────────

/// 成交量币种 chips。
const List<String> kVolCoins = <String>[
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', 'SUI', 'ADA', 'LINK',
];

/// 成交量交易所名称（独立映射，含订单簿之外的所）。
const Map<String, String> kVolExchangeName = <String, String>{
  'BIN': 'Binance', 'OKX': 'OKX', 'MEX': 'MEXC', 'BYB': 'Bybit', 'GT': 'Gate',
  'BTX': 'Bitunix', 'BG': 'Bitget', 'CB': 'Coinbase', 'WBT': 'WhiteBIT',
  'HL': 'Hyperliquid', 'BIX': 'BingX', 'APX': 'ApeX Omni', 'CRP': 'Crypto.com',
  'AST': 'Aster', 'EDX': 'EdgeX', 'LGT': 'Lighter', 'DER': 'Deribit',
  'HTX': 'HTX', 'KRK': 'Kraken', 'KC': 'KuCoin', 'LB': 'LBank',
  'EXT': 'Extended', 'BMX': 'Bitmex', 'CEX': 'CoinEx', 'DYX': 'dYdX',
  'BFX': 'Bitfinex', 'PRD': 'Paradex', 'DFT': 'Drift',
};

/// 成交量横条配色（各所配色）。
const Map<String, Color> kVolColor = <String, Color>{
  'BIN': Color(0xFF7C5CFF), 'OKX': Color(0xFFE5484D), 'MEX': Color(0xFFF5A524),
  'BYB': Color(0xFF16A36B), 'GT': Color(0xFF22D3EE), 'BTX': Color(0xFF3B82F6),
  'BG': Color(0xFFA78BFA), 'CB': Color(0xFFE5484D), 'WBT': Color(0xFFF5A524),
  'HL': Color(0xFF16A36B), 'BIX': Color(0xFF3B82F6), 'APX': Color(0xFFEC4899),
  'CRP': Color(0xFF10B981), 'AST': Color(0xFFF97316), 'EDX': Color(0xFFEC4899),
  'LGT': Color(0xFFA78BFA), 'DER': Color(0xFFE5484D), 'HTX': Color(0xFF3B82F6),
  'KRK': Color(0xFF5841D8), 'KC': Color(0xFF22D896), 'LB': Color(0xFF94A3B8),
  'EXT': Color(0xFF94A3B8), 'BMX': Color(0xFF1F2937), 'CEX': Color(0xFF2EB8AA),
  'DYX': Color(0xFF6966FF), 'BFX': Color(0xFF94A3B8), 'PRD': Color(0xFF94A3B8),
  'DFT': Color(0xFF94A3B8), 'TOTAL': Color(0xFF3B82F6),
};

/// 成交量数据（设计稿含 BTC/ETH，其余币种走空态）。
final Map<String, VolSnapshot> kVolData = <String, VolSnapshot>{
  'BTC': const VolSnapshot(
    total: 63.39,
    rows: <VolRow>[
      VolRow(exchange: 'BIN', value: 15.48), VolRow(exchange: 'OKX', value: 7.47),
      VolRow(exchange: 'MEX', value: 6.31), VolRow(exchange: 'BYB', value: 5.50),
      VolRow(exchange: 'GT', value: 4.93), VolRow(exchange: 'BTX', value: 3.91),
      VolRow(exchange: 'BG', value: 3.19), VolRow(exchange: 'CB', value: 2.61),
      VolRow(exchange: 'WBT', value: 2.49), VolRow(exchange: 'HL', value: 2.22),
      VolRow(exchange: 'BIX', value: 1.55), VolRow(exchange: 'APX', value: 1.13),
      VolRow(exchange: 'CRP', value: 0.99), VolRow(exchange: 'AST', value: 0.96),
      VolRow(exchange: 'EDX', value: 0.88), VolRow(exchange: 'LGT', value: 0.81),
      VolRow(exchange: 'DER', value: 0.49), VolRow(exchange: 'HTX', value: 0.44),
      VolRow(exchange: 'KRK', value: 0.36), VolRow(exchange: 'KC', value: 0.33),
      VolRow(exchange: 'EXT', value: 0.32), VolRow(exchange: 'LB', value: 0.31),
      VolRow(exchange: 'BMX', value: 0.22), VolRow(exchange: 'CEX', value: 0.18),
      VolRow(exchange: 'DYX', value: 0.16), VolRow(exchange: 'BFX', value: 0.08),
      VolRow(exchange: 'PRD', value: 0.04), VolRow(exchange: 'DFT', value: 0.02),
    ],
  ),
  'ETH': const VolSnapshot(
    total: 51.70,
    rows: <VolRow>[
      VolRow(exchange: 'BIN', value: 14.45), VolRow(exchange: 'OKX', value: 9.38),
      VolRow(exchange: 'GT', value: 5.45), VolRow(exchange: 'BTX', value: 4.89),
      VolRow(exchange: 'BYB', value: 3.56), VolRow(exchange: 'MEX', value: 2.54),
      VolRow(exchange: 'BG', value: 2.44), VolRow(exchange: 'WBT', value: 1.74),
      VolRow(exchange: 'CB', value: 1.59), VolRow(exchange: 'HL', value: 0.90),
      VolRow(exchange: 'BIX', value: 0.86), VolRow(exchange: 'EDX', value: 0.84),
      VolRow(exchange: 'HTX', value: 0.76), VolRow(exchange: 'AST', value: 0.66),
      VolRow(exchange: 'CRP', value: 0.34), VolRow(exchange: 'KC', value: 0.25),
      VolRow(exchange: 'LB', value: 0.23), VolRow(exchange: 'EXT', value: 0.19),
      VolRow(exchange: 'DER', value: 0.12), VolRow(exchange: 'LGT', value: 0.12),
      VolRow(exchange: 'APX', value: 0.12), VolRow(exchange: 'BMX', value: 0.09),
      VolRow(exchange: 'KRK', value: 0.09), VolRow(exchange: 'CEX', value: 0.07),
      VolRow(exchange: 'BFX', value: 0.01), VolRow(exchange: 'DYX', value: 0.01),
      VolRow(exchange: 'PRD', value: 0.01), VolRow(exchange: 'DFT', value: 0.0),
    ],
  ),
};

/// 币种 chip 配色（搜索结果头像）。
const Map<String, Color> kAggCoinColor = <String, Color>{
  'BTC': Color(0xFFF7931A), 'ETH': Color(0xFF627EEA), 'SOL': Color(0xFF9945FF),
  'XRP': Color(0xFF23292F), 'DOGE': Color(0xFFC2A633), 'BNB': Color(0xFFF0B90B),
  'HYPE': Color(0xFF16C783), 'SUI': Color(0xFF4DA2FF), 'ADA': Color(0xFF0033AD),
  'LINK': Color(0xFF2A5ADA), 'ZEC': Color(0xFFECB244), 'BCH': Color(0xFF8DC351),
  'AVAX': Color(0xFFE84142),
};
