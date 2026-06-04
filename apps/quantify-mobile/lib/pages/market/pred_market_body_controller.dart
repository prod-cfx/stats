import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'pred_market_body_state.dart';

/// 预测市场子屏控制器（issue #2184）。纯同步：设/清搜索词。
class PredMarketController extends Notifier<PredMarketState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  PredMarketState build() {
    _life.attach(ref);
    return const PredMarketState();
  }

  void setFilter(String filter) {
    state = state.copyWith(filter: filter);
  }
}

final predMarketControllerProvider =
    NotifierProvider.autoDispose<PredMarketController, PredMarketState>(
      PredMarketController.new,
    );
