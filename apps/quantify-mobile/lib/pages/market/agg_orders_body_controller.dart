import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'agg_orders_body_state.dart';

/// 聚合挂单子屏控制器（issue #2184）。纯同步：切 segment。
class AggOrdersController extends Notifier<AggOrdersState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  AggOrdersState build() {
    _life.attach(ref);
    return const AggOrdersState();
  }

  void selectTab(AggSubTab tab) {
    state = state.copyWith(tab: tab);
  }
}

final aggOrdersControllerProvider =
    NotifierProvider.autoDispose<AggOrdersController, AggOrdersState>(
      AggOrdersController.new,
    );
