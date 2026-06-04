import 'package:flutter/foundation.dart';

/// 回测配置表单的不可变流程/校验态（issue #2186 三件套迁移）。
///
/// 仅承载**非输入框**的流程态：区间键 [rangeKey]、成交价来源 [fillSource]、
/// 是否允许部分数据 [partialData]、是否合约 [futures]，以及校验错误 [error]。
///
/// 6 个 `TextEditingController`（capital/leverage/slippage/fee/start/end）的瞬时
/// 文本属表单输入局部态，保留在 widget，**不进此处**。
@immutable
class BacktestConfigSheetState {
  const BacktestConfigSheetState({
    this.rangeKey = '30D',
    this.fillSource = 'close',
    this.partialData = true,
    this.futures = true,
    this.error,
  });

  final String rangeKey;
  final String fillSource;
  final bool partialData;

  /// 交易市场：现货无杠杆；合约启用杠杆选择。默认合约对齐设计稿。
  final bool futures;

  /// 校验失败文案；null = 无错误。
  final String? error;

  bool get isCustomRange => rangeKey == 'custom';

  /// [error] 用 [_unset] 哨兵区分「不改动」与「显式清空」；其余字段直接替换。
  BacktestConfigSheetState copyWith({
    String? rangeKey,
    String? fillSource,
    bool? partialData,
    bool? futures,
    Object? error = _unset,
  }) {
    return BacktestConfigSheetState(
      rangeKey: rangeKey ?? this.rangeKey,
      fillSource: fillSource ?? this.fillSource,
      partialData: partialData ?? this.partialData,
      futures: futures ?? this.futures,
      error: identical(error, _unset) ? this.error : error as String?,
    );
  }

  static const Object _unset = Object();
}
