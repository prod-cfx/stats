import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/ticker_models.dart';
import '../../data/providers.dart';
import 'market_home_state.dart';

/// 行情列表主体控制器（issue #2184）。
///
/// `build()` 触发首次加载（`listTickers` 一次性，无流）；`selectTab` 切二级
/// 筛选；`setSearchHistory` 由全屏搜索路由 pop 回填历史。
class MarketHomeController extends Notifier<MarketHomeState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  MarketHomeState build() {
    _life.attach(ref);
    Future<void>.microtask(_load);
    return const MarketHomeState();
  }

  Future<void> _load() async {
    final repo = ref.read(tickerRepositoryProvider);
    try {
      final List<Ticker> tickers = await repo.listTickers();
      if (!mounted) return;
      state = state.copyWith(tickers: tickers, loading: false);
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        error: ErrorRouter.normalize(error),
        loading: false,
      );
    }
  }

  void selectTab(MarketTab tab) {
    state = state.copyWith(tab: tab);
  }

  void setSearchHistory(List<String> history) {
    state = state.copyWith(searchHistory: history);
  }
}

final marketHomeControllerProvider =
    NotifierProvider.autoDispose<MarketHomeController, MarketHomeState>(
      MarketHomeController.new,
    );
