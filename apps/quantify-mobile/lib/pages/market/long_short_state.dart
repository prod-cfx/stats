import 'package:flutter/foundation.dart';

import '../../core/network/domain_error.dart';
import '../../data/models/exchange_long_short_models.dart';

/// 多空比子屏不可变页面态（issue #2184）。
///
/// `symbol` 切换触发重载；`period` 为纯展示态（不重载，对齐原行为）。
/// `snapshot` 为当前快照；`loading`/`error` 为异步加载态。
@immutable
class LongShortState {
  const LongShortState({
    this.symbol = 'BTCUSDT',
    this.period = '4小时',
    this.snapshot,
    this.loading = true,
    this.error,
  });

  final String symbol;
  final String period;
  final MarketLongShortSnapshot? snapshot;
  final bool loading;
  final DomainError? error;

  /// `snapshot`/`error` 用 [_unset] 哨兵区分「不改动」与「显式置 null」。
  LongShortState copyWith({
    String? symbol,
    String? period,
    Object? snapshot = _unset,
    bool? loading,
    Object? error = _unset,
  }) {
    return LongShortState(
      symbol: symbol ?? this.symbol,
      period: period ?? this.period,
      snapshot: identical(snapshot, _unset)
          ? this.snapshot
          : snapshot as MarketLongShortSnapshot?,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
    );
  }

  static const Object _unset = Object();
}
