import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'ai_script_page_state.dart';

/// AI 策略脚本屏控制器（issue #2186 三件套迁移）。
///
/// 推进 [AiScriptPageState] 舞台机：build 时启动 [_genTimer]（mock 生成耗时），
/// 到点切 ready；timer 由 controller 持有并在 `ref.onDispose` 取消。异步回调前
/// 以 [NotifierLifecycle] mounted 守卫。复制提示的延时复位同走 controller timer。
///
/// 边界：剪贴板写入 / SnackBar / 导航等 context 副作用留在 widget；脚本文本与
/// 文件名由 widget 从 router `extra` 派生。
class AiScriptPageController extends Notifier<AiScriptPageState> {
  /// mock 生成耗时；真实接入后替换为 codegen 完成回调。
  static const Duration genDelay = Duration(milliseconds: 1500);

  /// 复制回显持续时长。
  static const Duration copiedHold = Duration(milliseconds: 1600);

  final NotifierLifecycle _life = NotifierLifecycle();
  Timer? _genTimer;
  Timer? _copiedTimer;

  bool get mounted => _life.mounted;

  @override
  AiScriptPageState build() {
    _life.attach(ref);
    ref.onDispose(() {
      _genTimer?.cancel();
      _copiedTimer?.cancel();
    });
    _genTimer = Timer(genDelay, _markReady);
    return const AiScriptPageState();
  }

  void _markReady() {
    if (!mounted) return;
    state = state.copyWith(stage: ScriptStage.ready);
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
