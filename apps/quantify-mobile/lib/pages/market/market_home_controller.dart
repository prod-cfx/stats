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

  /// 按当前 tab 过滤/排序行情列表（#2192：从 View.build 上移至 ViewModel）。
  ///
  /// Tab 语义：watchlist 仅命中 [favorites]；spot/perp 按 `Ticker.kind`；
  /// gainers 涨幅 > 0 降序；losers 跌幅 < 0 升序。搜索已迁出全屏路由，不在此处。
  List<Ticker> visibleTickers(Set<String> favorites) {
    final List<Ticker> tickers = state.tickers;
    switch (state.tab) {
      case MarketTab.watchlist:
        return tickers
            .where((Ticker t) => favorites.contains(t.symbol))
            .toList();
      case MarketTab.spot:
        return tickers.where((Ticker t) => t.kind == MarketKind.spot).toList();
      case MarketTab.perp:
        return tickers.where((Ticker t) => t.kind == MarketKind.perp).toList();
      case MarketTab.gainers:
        return tickers.where((Ticker t) => t.changePercent > 0).toList()
          ..sort(
            (Ticker a, Ticker b) => b.changePercent.compareTo(a.changePercent),
          );
      case MarketTab.losers:
        return tickers.where((Ticker t) => t.changePercent < 0).toList()
          ..sort(
            (Ticker a, Ticker b) => a.changePercent.compareTo(b.changePercent),
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
