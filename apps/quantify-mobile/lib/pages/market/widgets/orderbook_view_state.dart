import 'package:flutter/foundation.dart';

import '../../../core/network/domain_error.dart';
import '../../../data/models/orderbook_models.dart';

/// 盘口视图取数态（issue #2228）。
///
/// 由 [OrderbookViewController] 维护：`build()` 首屏 `getSnapshot` + `watchOrderbook`
/// 实时订阅。`snapshot` 在订阅期持续被替换为最新档位；`loading`/`error` 为首屏加载态。
/// 纯 UI 本地态（视图模式 / 聚合精度）仍由 widget 自管，不在此。
@immutable
class OrderbookViewState {
  const OrderbookViewState({
    this.snapshot,
    this.loading = true,
    this.error,
  });

  final OrderbookSnapshot? snapshot;
  final bool loading;
  final DomainError? error;

  /// `error` 用 [_unset] 哨兵区分「不改动」与「显式置 null」；`snapshot` 实时流恒非
  /// null，无需哨兵。
  OrderbookViewState copyWith({
    OrderbookSnapshot? snapshot,
    bool? loading,
    Object? error = _unset,
  }) {
    return OrderbookViewState(
      snapshot: snapshot ?? this.snapshot,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
    );
  }

  static const Object _unset = Object();
}
