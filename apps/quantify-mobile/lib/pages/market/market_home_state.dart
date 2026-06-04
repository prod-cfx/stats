import 'package:flutter/foundation.dart';

import '../../core/network/domain_error.dart';
import '../../data/models/ticker_models.dart';

/// 行情列表主体二级 tab（issue #2184）。
enum MarketTab { watchlist, spot, perp, gainers, losers }

/// 行情列表主体不可变页面态（issue #2184）。
///
/// `tab` 为二级筛选；`tickers`/`loading`/`error` 为异步加载态；`searchHistory`
/// 由全屏搜索路由 pop 回填（搜索路由内部 query/局部历史不在此，属边界外）。
@immutable
class MarketHomeState {
  const MarketHomeState({
    this.tab = MarketTab.watchlist,
    this.tickers = const <Ticker>[],
    this.loading = true,
    this.error,
    this.searchHistory = const <String>['BTC', 'ETH', 'SOL'],
  });

  final MarketTab tab;
  final List<Ticker> tickers;
  final bool loading;
  final DomainError? error;
  final List<String> searchHistory;

  /// `error` 用 [_unset] 哨兵区分「不改动」与「显式置 null」。
  MarketHomeState copyWith({
    MarketTab? tab,
    List<Ticker>? tickers,
    bool? loading,
    Object? error = _unset,
    List<String>? searchHistory,
  }) {
    return MarketHomeState(
      tab: tab ?? this.tab,
      tickers: tickers ?? this.tickers,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
      searchHistory: searchHistory ?? this.searchHistory,
    );
  }

  static const Object _unset = Object();
}
