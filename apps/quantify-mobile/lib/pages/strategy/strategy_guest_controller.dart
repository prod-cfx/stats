import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/strategy_repository.dart';
import 'strategy_guest_state.dart';

/// 访客策略页控制器（issue #2185 三件套）。
///
/// `load` 拉取首屏 3 条热门策略；`mounted` 守卫避免 dispose 后触达 `state =`。
class StrategyGuestController extends Notifier<StrategyGuestState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  StrategyGuestState build() {
    _life.attach(ref);
    return const StrategyGuestState();
  }

  Future<void> load() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page = await repo.listMarket(page: 1, pageSize: 3);
    if (!mounted) return;
    state = state.copyWith(items: page.items, loading: false);
  }
}

final strategyGuestControllerProvider =
    NotifierProvider.autoDispose<
      StrategyGuestController,
      StrategyGuestState
    >(StrategyGuestController.new);
