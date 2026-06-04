import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'whale_profile_sortable_tab_state.dart';
import 'widgets/whale_detail_sort.dart';

/// 巨鲸详情页明细 tab 控制器（issue #2183 三件套迁移）。
///
/// 纯同步：[cycleSort]（列头三态循环）/ [setSort]（更多排序直接设）/
/// [selectCoin]（币种筛选）。按 `family` key（tab 标识，如 `'spot'`/`'perp'`）
/// 区分实例，保证 5 个明细 tab 各自独立态、互不串扰。挂 [NotifierLifecycle]
/// 对齐范式（本控制器无异步回调，登记仅为统一约定）。
class WhaleProfileSortableTabController
    extends Notifier<WhaleProfileSortableTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleProfileSortableTabState build() {
    _life.attach(ref);
    return const WhaleProfileSortableTabState();
  }

  /// 列头点击：三态循环（新列→desc→asc→不排序）。
  void cycleSort(String key) {
    state = state.copyWith(sort: state.sort.cycle(key));
  }

  /// 「更多排序」直接设定排序态。
  void setSort(WhaleSortState sort) {
    state = state.copyWith(sort: sort);
  }

  void selectCoin(String coin) {
    state = state.copyWith(coin: coin);
  }
}

/// family key：区分 spot/perp/order/trade/hist，保证各 tab 态互不串扰。
final whaleProfileSortableTabControllerProvider =
    NotifierProvider.autoDispose
        .family<
          WhaleProfileSortableTabController,
          WhaleProfileSortableTabState,
          String
        >((String _) => WhaleProfileSortableTabController());
