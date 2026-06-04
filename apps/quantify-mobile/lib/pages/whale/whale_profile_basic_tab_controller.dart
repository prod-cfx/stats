import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'whale_profile_basic_tab_state.dart';

/// 巨鲸详情页「基本信息」tab 控制器（issue #2183 三件套迁移）。
///
/// 纯同步图表筛选态：[setPeriod]/[setScope]/[setMetric] 仅记录用户显式选择；
/// 初值（l10n 默认文案）由 widget 渲染时只读回退，不在此写入。挂
/// [NotifierLifecycle] 对齐范式（本控制器无异步回调，登记仅为统一约定）。
class WhaleProfileBasicTabController
    extends Notifier<WhaleProfileBasicTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleProfileBasicTabState build() {
    _life.attach(ref);
    return const WhaleProfileBasicTabState();
  }

  void setPeriod(String period) {
    state = state.copyWith(period: period);
  }

  void setScope(String scope) {
    state = state.copyWith(scope: scope);
  }

  void setMetric(String metric) {
    state = state.copyWith(metric: metric);
  }
}

final whaleProfileBasicTabControllerProvider =
    NotifierProvider.autoDispose<
      WhaleProfileBasicTabController,
      WhaleProfileBasicTabState
    >(WhaleProfileBasicTabController.new);
