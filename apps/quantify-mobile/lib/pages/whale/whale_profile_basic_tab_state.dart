import 'package:flutter/foundation.dart';

/// 巨鲸详情页「基本信息」tab 的不可变页面态（issue #2183 三件套迁移）。
///
/// 三个图表 pill 的选中文案：[period]（时间范围）/ [scope]（统计范围）/
/// [metric]（指标）。null = 用户未改动——widget 渲染时回退到 l10n 默认文案
/// （只读 fallback，不写回 provider，避免 build 期修改 provider）。纯同步、
/// 无 `BuildContext`，由 `WhaleProfileBasicTabController` 通过 `copyWith` 推进。
@immutable
class WhaleProfileBasicTabState {
  const WhaleProfileBasicTabState({this.period, this.scope, this.metric});

  final String? period;
  final String? scope;
  final String? metric;

  WhaleProfileBasicTabState copyWith({
    String? period,
    String? scope,
    String? metric,
  }) {
    return WhaleProfileBasicTabState(
      period: period ?? this.period,
      scope: scope ?? this.scope,
      metric: metric ?? this.metric,
    );
  }
}
