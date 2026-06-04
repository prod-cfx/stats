import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/providers.dart';
import 'api_form_sheet_state.dart';

/// `api_form_sheet` 控制器（issue #2187 三件套）。
///
/// 持密钥显隐 / 保存中 / 环境三项流程态；保存经 `ref.read(apiKeyRepositoryProvider)`
/// 异步落库，异步前用 [NotifierLifecycle] 守卫 `mounted`。
///
/// 保存失败**刻意不暴露后端原文**（避免泄露请求体片段 / 内部字段名）：[save]
/// 仅返回 `bool`，widget 据此弹固定通用文案。导航（Navigator.pop）/ SnackBar 等
/// context 副作用留在 widget。
class ApiFormSheetController extends Notifier<ApiFormSheetState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  ApiFormSheetState build() {
    _life.attach(ref);
    return const ApiFormSheetState();
  }

  void toggleSecret() {
    state = state.copyWith(showSecret: !state.showSecret);
  }

  void setEnv(ApiEnv env) {
    state = state.copyWith(env: env);
  }

  /// 新增交易所 API 凭据。返回 `true` = 成功（widget 关闭 sheet 并刷新列表），
  /// `false` = 失败（widget 弹固定文案）。
  Future<bool> save({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
    String? apiPassphrase,
  }) async {
    state = state.copyWith(saving: true);
    try {
      await ref.read(apiKeyRepositoryProvider).addKey(
            exchange: exchange,
            label: label,
            apiKey: apiKey,
            apiSecret: apiSecret,
            apiPassphrase: apiPassphrase,
          );
      if (!mounted) return false;
      return true;
    } catch (_) {
      // 不把后端异常原文外泄；详细错误走日志，widget 显示固定通用文案。
      if (!mounted) return false;
      return false;
    } finally {
      if (mounted) state = state.copyWith(saving: false);
    }
  }
}

final apiFormSheetControllerProvider =
    NotifierProvider.autoDispose<ApiFormSheetController, ApiFormSheetState>(
      ApiFormSheetController.new,
    );
