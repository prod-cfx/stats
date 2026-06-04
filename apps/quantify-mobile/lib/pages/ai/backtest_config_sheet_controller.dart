import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'backtest_config_sheet_state.dart';

/// 回测配置表单控制器（issue #2186 三件套迁移）。
///
/// 纯同步推进 [BacktestConfigSheetState] 的流程/校验态。校验取值依赖留在 widget
/// 的 6 个 `TextEditingController`，故 `_submit` 的解析逻辑仍在 widget 完成，本
/// 控制器只承载结果（[setError]/[clearError]）与开关字段。挂 [NotifierLifecycle]
/// 对齐范式（当前无异步回调，登记仅为统一约定）。
class BacktestConfigSheetController
    extends Notifier<BacktestConfigSheetState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  BacktestConfigSheetState build() {
    _life.attach(ref);
    return const BacktestConfigSheetState();
  }

  /// 选区间。切区间同时清错误（原 setState 内联清空 `_error`）。
  void setRange(String key) {
    state = state.copyWith(rangeKey: key, error: null);
  }

  void setFutures(bool futures) {
    state = state.copyWith(futures: futures);
  }

  void setFillSource(String source) {
    state = state.copyWith(fillSource: source);
  }

  void setPartialData(bool partial) {
    state = state.copyWith(partialData: partial);
  }

  void setError(String message) {
    state = state.copyWith(error: message);
  }

  /// 清错误；仅在当前有错误时推进，避免无意义重建。
  void clearError() {
    if (state.error != null) state = state.copyWith(error: null);
  }
}

final backtestConfigSheetControllerProvider =
    NotifierProvider.autoDispose<
      BacktestConfigSheetController,
      BacktestConfigSheetState
    >(BacktestConfigSheetController.new);
