import 'package:flutter/foundation.dart';

import '../network/domain_error.dart';

/// 错误展示动作枚举。
///
/// `ErrorRouter` 计算出动作后再交由各 sink（toast / signOut）落地，让单元测试
/// 可只断言「动作正确」，无需驱动真实 Overlay / Dialog 渲染。
enum ErrorRouterActionKind {
  /// 不展示任何 UI（如 [DomainErrorCode.cancelled]）。
  silent,

  /// Snackbar / Toast。
  toast,

  /// 未授权：清会话 + 静默（跳登录由会话监听方负责）。
  signOut,
}

/// 单次错误路由的决策结果。
@immutable
class ErrorRouterAction {
  final ErrorRouterActionKind kind;

  /// `kind == toast` 时的展示文案；其余 kind 通常为空。
  final String message;

  const ErrorRouterAction._({required this.kind, this.message = ''});

  const ErrorRouterAction.silent()
      : this._(kind: ErrorRouterActionKind.silent);
  const ErrorRouterAction.signOut()
      : this._(kind: ErrorRouterActionKind.signOut);
  const ErrorRouterAction.toast(String message)
      : this._(kind: ErrorRouterActionKind.toast, message: message);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ErrorRouterAction &&
          other.kind == kind &&
          other.message == message);

  @override
  int get hashCode => Object.hash(kind, message);
}

/// UI 消费统一入口。页面 `ref.listen` 拿到异常后调用 [normalize] 归一为
/// [DomainError]，再用 [decide] 得到展示动作。
///
/// 精简版（quantify-mobile 阶段 0）：仅承载归一 + 纯函数决策，不耦合 session /
/// i18n / 业务弹窗等基建。后续真实网络层与会话基建接通后在此扩展 `handle`。
class ErrorRouter {
  ErrorRouter._();

  /// 把任意异常归一为 [DomainError]：
  /// - 已是 [DomainError] → 透传；
  /// - 其余 → 包装成 `DomainErrorCode.unknown` 的 [DomainError]。
  static DomainError normalize(Object error) {
    if (error is DomainError) return error;
    return DomainError(
      code: DomainErrorCode.unknown,
      message: error.toString(),
      cause: error,
    );
  }

  /// 决策当前异常的展示动作（纯函数，便于单测）：
  /// - cancelled → silent；
  /// - unauthorized → signOut；
  /// - 其余 → toast（文案取 [DomainError.message]，空文案降级 silent）。
  static ErrorRouterAction decide(DomainError error) {
    switch (error.code) {
      case DomainErrorCode.cancelled:
        return const ErrorRouterAction.silent();
      case DomainErrorCode.unauthorized:
        return const ErrorRouterAction.signOut();
      case DomainErrorCode.network:
      case DomainErrorCode.timeout:
      case DomainErrorCode.forbidden:
      case DomainErrorCode.notFound:
      case DomainErrorCode.validation:
      case DomainErrorCode.serverError:
      case DomainErrorCode.unknown:
        if (error.message.isEmpty) {
          return const ErrorRouterAction.silent();
        }
        return ErrorRouterAction.toast(error.message);
    }
  }
}
