import 'package:flutter/foundation.dart';

/// 聚合挂单子屏的 3 段 segment（issue #2184 三件套）。
enum AggSubTab { orders, openInterest, volume }

/// 聚合挂单子屏不可变页面态：仅承载当前 segment [tab]。
@immutable
class AggOrdersState {
  const AggOrdersState({this.tab = AggSubTab.orders});

  final AggSubTab tab;

  AggOrdersState copyWith({AggSubTab? tab}) =>
      AggOrdersState(tab: tab ?? this.tab);
}
