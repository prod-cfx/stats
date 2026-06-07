import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'ai_script_page_state.dart';

/// AI 策略脚本屏控制器（issue #2186 三件套迁移）。
///
/// 推进 [AiScriptPageState] 舞台机：codegen 状态来自 repository/路由透传的
/// 会话产物，不再用本地 Timer 伪造 ready。复制提示的延时复位由 controller
/// timer 持有。
///
/// 边界：剪贴板写入 / SnackBar / 导航等 context 副作用留在 widget；脚本文本与
/// 文件名由 widget 从 router `extra` 派生。
class AiScriptPageController extends Notifier<AiScriptPageState> {
  /// 复制回显持续时长。
  static const Duration copiedHold = Duration(milliseconds: 1600);

  final NotifierLifecycle _life = NotifierLifecycle();
  Timer? _copiedTimer;

  bool get mounted => _life.mounted;

  @override
  AiScriptPageState build() {
    _life.attach(ref);
    ref.onDispose(() {
      _copiedTimer?.cancel();
    });
    return const AiScriptPageState();
  }

  void syncCodegenStatus(String? status, {String? errorMessage}) {
    if (!mounted) return;
    final String normalized = (status ?? '').toUpperCase();
    final bool ready = <String>{
      'PUBLISHED',
      'READY',
      'SUCCEEDED',
      'COMPLETED',
    }.contains(normalized);
    final bool failed = <String>{
      'CONSISTENCY_FAILED',
      'REJECTED',
      'FAILED',
      'ERROR',
    }.contains(normalized);
    if (ready) {
      state = state.copyWith(stage: ScriptStage.ready, errorMessage: '');
      return;
    }
    if (failed) {
      state = state.copyWith(
        stage: ScriptStage.failed,
        errorMessage: errorMessage?.isNotEmpty == true
            ? errorMessage
            : 'codegen $normalized',
      );
      return;
    }
    state = state.copyWith(stage: ScriptStage.generating, errorMessage: '');
  }

  void toggleExpand() {
    state = state.copyWith(expanded: !state.expanded);
  }

  /// 标记已复制并安排自动复位（widget 完成剪贴板写入后调用）。
  void markCopied() {
    state = state.copyWith(copied: true);
    _copiedTimer?.cancel();
    _copiedTimer = Timer(copiedHold, () {
      if (!mounted) return;
      state = state.copyWith(copied: false);
    });
  }
}

final aiScriptPageControllerProvider =
    NotifierProvider.autoDispose<AiScriptPageController, AiScriptPageState>(
      AiScriptPageController.new,
    );
