import 'package:flutter/foundation.dart';

/// 表单环境：仅 `testnet=true` 的交易所允许在主网 / 测试网间切换。
///
/// 由 widget 的 `_ApiMeta`（按 `exchange` 纯派生）决定是否渲染切换控件，故 meta
/// 仍留在 widget；本枚举提升为顶层 public 供 controller / state / 单测引用。
enum ApiEnv { mainnet, testnet }

/// `api_form_sheet` 的不可变流程/异步态（issue #2187 三件套）。
///
/// 承载密钥显隐、保存中、当前环境三项流程态。`_ApiMeta`/`_isTestnet` 由
/// `widget.exchange` 纯派生且无状态流转，按 KISS 留在 widget；6 个
/// `TextEditingController` 与 `GlobalKey<FormState>` 按范式同样留 widget。
@immutable
class ApiFormSheetState {
  const ApiFormSheetState({
    this.showSecret = false,
    this.saving = false,
    this.env = ApiEnv.mainnet,
  });

  /// 是否明文显示 secret 类字段。
  final bool showSecret;

  /// 保存请求进行中。
  final bool saving;

  /// 当前环境。不支持测试网的交易所恒为 mainnet（切换控件也不渲染）。
  final ApiEnv env;

  ApiFormSheetState copyWith({
    bool? showSecret,
    bool? saving,
    ApiEnv? env,
  }) {
    return ApiFormSheetState(
      showSecret: showSecret ?? this.showSecret,
      saving: saving ?? this.saving,
      env: env ?? this.env,
    );
  }
}
