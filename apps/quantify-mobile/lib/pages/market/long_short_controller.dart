import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/exchange_long_short_models.dart';
import '../../data/providers.dart';
import 'long_short_state.dart';

/// 多空比子屏控制器（issue #2184）。
///
/// `build()` 触发首次加载；`changeSymbol` 切币种并重载，`changePeriod` 仅改
/// 展示态（不重载，对齐原行为）。`_requestId` 竞态序号丢弃过期响应：快速切
/// 币种时先发请求回调到达时已与当前 symbol 不一致，不覆盖新 state。
class LongShortController extends Notifier<LongShortState> {
  final NotifierLifecycle _life = NotifierLifecycle();
  int _requestId = 0;

  bool get mounted => _life.mounted;

  @override
  LongShortState build() {
    _life.attach(ref);
    Future<void>.microtask(_load);
    return const LongShortState();
  }

  Future<void> _load() async {
    final int requestId = ++_requestId;
    state = state.copyWith(loading: true, error: null);
    final String symbol = state.symbol;
    try {
      final MarketLongShortSnapshot snapshot = await ref
          .read(longShortRepositoryProvider)
          .getSnapshot(symbol: symbol);
      if (!mounted || requestId != _requestId) return;
      state = state.copyWith(snapshot: snapshot, loading: false);
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      state = state.copyWith(
        error: ErrorRouter.normalize(error),
        loading: false,
      );
    }
  }

  void changeSymbol(String symbol) {
    if (symbol == state.symbol) return;
    state = state.copyWith(symbol: symbol);
    _load();
  }

  void changePeriod(String period) {
    if (period == state.period) return;
    state = state.copyWith(period: period);
  }
}

final longShortControllerProvider =
    NotifierProvider.autoDispose<LongShortController, LongShortState>(
      LongShortController.new,
    );
