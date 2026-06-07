import 'package:flutter/foundation.dart';

/// 脚本生成舞台：生成中 → 就绪 / 失败。
enum ScriptStage { generating, ready, failed }

/// AI 策略脚本屏的不可变页面态（issue #2186 三件套迁移）。
///
/// 承载舞台机 [stage] 与两个纯 UI 反馈态（[expanded] 展开折叠 / [copied] 复制
/// 回显）。`_genTimer` 由 controller 持有，不属状态；脚本文本 / 文件名由 widget
/// 从 router `extra` 派生，亦不进此处。
@immutable
class AiScriptPageState {
  const AiScriptPageState({
    this.stage = ScriptStage.generating,
    this.expanded = false,
    this.copied = false,
    this.errorMessage,
  });

  final ScriptStage stage;
  final bool expanded;
  final bool copied;
  final String? errorMessage;

  bool get ready => stage == ScriptStage.ready;
  bool get failed => stage == ScriptStage.failed;

  AiScriptPageState copyWith({
    ScriptStage? stage,
    bool? expanded,
    bool? copied,
    String? errorMessage,
  }) {
    return AiScriptPageState(
      stage: stage ?? this.stage,
      expanded: expanded ?? this.expanded,
      copied: copied ?? this.copied,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
