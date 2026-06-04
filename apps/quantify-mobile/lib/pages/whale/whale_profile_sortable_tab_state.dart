import 'package:flutter/foundation.dart';

import 'widgets/whale_detail_sort.dart';

/// 巨鲸详情页明细 tab（现货/永续/挂单/成交/历史）的不可变页面态
/// （issue #2183 三件套迁移）。
///
/// 承载列头排序态 [sort] 与币种筛选 [coin]。[coin] 为 null = 用户未改动——
/// widget 渲染时回退到 l10n「全部」（只读 fallback，不写回 provider）。纯同步、
/// 无 `BuildContext`，泛型排序逻辑留在 widget；此处只存与 T 无关的标量态。
@immutable
class WhaleProfileSortableTabState {
  const WhaleProfileSortableTabState({
    this.sort = const WhaleSortState(),
    this.coin,
  });

  final WhaleSortState sort;

  /// null = 用户未选（widget 回退到「全部」）。
  final String? coin;

  WhaleProfileSortableTabState copyWith({WhaleSortState? sort, String? coin}) {
    return WhaleProfileSortableTabState(
      sort: sort ?? this.sort,
      coin: coin ?? this.coin,
    );
  }
}
