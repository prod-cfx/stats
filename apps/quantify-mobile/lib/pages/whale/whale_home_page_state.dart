import 'package:flutter/foundation.dart';

/// 巨鲸首页的不可变页面态（issue #2183 三件套迁移）。
///
/// 仅承载页面级导航态 [tabIndex]（当前选中的二级 tab）。纯同步、无异步副作用、
/// 无 `BuildContext`，由 `WhaleHomePageController` 通过 `copyWith` 推进。
@immutable
class WhaleHomePageState {
  const WhaleHomePageState({this.tabIndex = 0});

  /// 默认 0 = 发现 tab（issue #1976，对齐设计稿首项 w-discover）。
  final int tabIndex;

  WhaleHomePageState copyWith({int? tabIndex}) {
    return WhaleHomePageState(tabIndex: tabIndex ?? this.tabIndex);
  }
}
