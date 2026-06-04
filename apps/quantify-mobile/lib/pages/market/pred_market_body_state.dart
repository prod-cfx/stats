import 'package:flutter/foundation.dart';

/// 预测市场子屏不可变页面态：仅承载搜索词 [filter]（issue #2184）。
@immutable
class PredMarketState {
  const PredMarketState({this.filter = ''});

  final String filter;

  PredMarketState copyWith({String? filter}) =>
      PredMarketState(filter: filter ?? this.filter);
}
