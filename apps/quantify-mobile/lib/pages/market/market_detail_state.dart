import 'package:flutter/foundation.dart';

import '../../core/network/domain_error.dart';
import '../../data/models/kline_models.dart';
import '../../data/models/market_source.dart';
import '../../data/models/ticker_models.dart';
import '../../data/models/trade_models.dart';

/// Panel 选项：盘口 / 成交 / 深度图（#1563）。
enum DetailPanel { book, trades, depth }

/// 行情详情页不可变页面态（issue #2184）。
///
/// `interval` 切换触发 K 线重载；`source`/`panel` 为纯展示态（不重载，对齐原
/// 行为）。`priceSnapshot`/`candles` 由初始加载 + 双流推送维护；`klineError`
/// 为 K 线加载失败标记；`trades` 为 mock 成交列表（首次构建后缓存，ticker
/// 推流改价不重建）；`loading`/`error` 为页面级初始加载态。
@immutable
class MarketDetailState {
  const MarketDetailState({
    this.interval = KlineInterval.h1,
    this.source = MarketSource.aggregated,
    this.priceSnapshot,
    this.candles = const <Candle>[],
    this.klineError = false,
    this.panel = DetailPanel.book,
    this.trades,
    this.loading = true,
    this.error,
  });

  final KlineInterval interval;
  final MarketSource source;
  final Ticker? priceSnapshot;
  final List<Candle> candles;
  final bool klineError;
  final DetailPanel panel;
  final List<Trade>? trades;
  final bool loading;
  final DomainError? error;

  /// `priceSnapshot`/`trades`/`error` 用 [_unset] 哨兵区分「不改动」与
  /// 「显式置 null」。
  MarketDetailState copyWith({
    KlineInterval? interval,
    MarketSource? source,
    Object? priceSnapshot = _unset,
    List<Candle>? candles,
    bool? klineError,
    DetailPanel? panel,
    Object? trades = _unset,
    bool? loading,
    Object? error = _unset,
  }) {
    return MarketDetailState(
      interval: interval ?? this.interval,
      source: source ?? this.source,
      priceSnapshot: identical(priceSnapshot, _unset)
          ? this.priceSnapshot
          : priceSnapshot as Ticker?,
      candles: candles ?? this.candles,
      klineError: klineError ?? this.klineError,
      panel: panel ?? this.panel,
      trades: identical(trades, _unset) ? this.trades : trades as List<Trade>?,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
    );
  }

  static const Object _unset = Object();
}
