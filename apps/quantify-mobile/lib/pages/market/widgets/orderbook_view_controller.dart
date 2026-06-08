import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/error_router.dart';
import '../../../data/models/orderbook_models.dart';
import '../../../data/providers.dart';
import 'orderbook_view_state.dart';

/// 盘口视图控制器（issue #2228）。
///
/// 取数从 `_OrderbookViewState`（View）下沉至此：`build()` 首屏 `getSnapshot`，随后
/// `watchOrderbook` 实时订阅持续刷新 `snapshot`。按 [symbol] 用 family 区分实例，
/// symbol 变化时 Riverpod 自动切换实例并 dispose 旧订阅，替代原 widget 的
/// `didUpdateWidget` 手动重订阅。
class OrderbookViewController extends Notifier<OrderbookViewState> {
  OrderbookViewController(this.symbol);

  final String symbol;

  StreamSubscription<OrderbookSnapshot>? _sub;
  bool _disposed = false;

  @override
  OrderbookViewState build() {
    ref.onDispose(() {
      _disposed = true;
      _sub?.cancel();
    });
    Future<void>.microtask(_load);
    return const OrderbookViewState();
  }

  Future<void> _load() async {
    final repo = ref.read(orderbookRepositoryProvider);
    try {
      final OrderbookSnapshot initial = await repo.getSnapshot(symbol);
      if (_disposed) return;
      state = state.copyWith(snapshot: initial, loading: false, error: null);
      _sub = repo
          .watchOrderbook(symbol)
          .listen(
            (OrderbookSnapshot next) {
              if (_disposed) return;
              state = state.copyWith(snapshot: next);
            },
            onError: (Object error) {
              if (_disposed || state.snapshot != null) return;
              state = state.copyWith(
                error: ErrorRouter.normalize(error),
                loading: false,
              );
            },
          );
    } catch (error) {
      if (_disposed) return;
      state = state.copyWith(
        error: ErrorRouter.normalize(error),
        loading: false,
      );
    }
  }
}

final orderbookViewControllerProvider = NotifierProvider.autoDispose
    .family<OrderbookViewController, OrderbookViewState, String>(
      OrderbookViewController.new,
    );
