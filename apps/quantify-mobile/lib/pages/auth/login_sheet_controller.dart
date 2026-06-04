import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/network/domain_error.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/auth/session_controller.dart';
import '../../data/models/auth_models.dart';
import 'login_sheet_state.dart';

/// `login_sheet` 控制器（issue #2187 三件套）。
///
/// 承载发码 / 邮箱验证码登录 / Telegram 登录三条异步流程的 loading、验证码
/// 倒计时与错误信号。倒计时 [Timer] 由本控制器持有，`build()` 内经
/// `ref.onDispose` 取消（替换原 widget `dispose` 清理）。异步前用
/// [NotifierLifecycle] 守卫 `mounted`，异常经 [ErrorRouter.normalize] 落 state。
///
/// 导航（Navigator.pop / go）与 SnackBar 等 context 副作用留在 widget：登录类
/// 动作返回 `bool` 让 widget 决定后续跳转。
class LoginSheetController extends Notifier<LoginSheetState> {
  final NotifierLifecycle _life = NotifierLifecycle();
  Timer? _codeTimer;

  bool get mounted => _life.mounted;

  @override
  LoginSheetState build() {
    _life.attach(ref);
    ref.onDispose(() => _codeTimer?.cancel());
    return const LoginSheetState();
  }

  /// 发送邮箱验证码。成功后置 `codeSent=true` 并启动 58s 倒计时。
  Future<void> sendLoginCode({required String email}) async {
    state = state.copyWith(codeLoading: true);
    try {
      await ref
          .read(sessionControllerProvider.notifier)
          .sendLoginCode(email: email);
      if (!mounted) return;
      _startCountdown();
      state = state.copyWith(codeSent: true);
    } catch (e) {
      if (!mounted) return;
      _emitError(e, LoginErrorKind.login);
    } finally {
      if (mounted) state = state.copyWith(codeLoading: false);
    }
  }

  /// 邮箱验证码登录。返回 `true` = 会话已建立，widget 可关闭 sheet 并跳转。
  ///
  /// `loginEmailCode` 自身 `AsyncValue.guard` 不抛——失败落 `session.hasError`，
  /// 故成功路径后再查一次；同时保留 `catch` 兜底防御非预期抛出。
  Future<bool> submitEmailCode({
    required String email,
    required String code,
  }) async {
    state = state.copyWith(emailLoading: true);
    try {
      await ref
          .read(sessionControllerProvider.notifier)
          .loginEmailCode(email: email, code: code);
      if (!mounted) return false;
      final AsyncValue<AuthSession?> session =
          ref.read(sessionControllerProvider);
      if (session.hasError) {
        _emitError(
          session.error ?? StateError('login failed'),
          LoginErrorKind.login,
        );
        return false;
      }
      return true;
    } catch (e) {
      if (!mounted) return false;
      _emitError(e, LoginErrorKind.login);
      return false;
    } finally {
      if (mounted) state = state.copyWith(emailLoading: false);
    }
  }

  /// Telegram 登录。返回 `true` = 会话已建立。
  Future<bool> submitTelegram() async {
    state = state.copyWith(telegramLoading: true);
    try {
      await ref.read(sessionControllerProvider.notifier).loginTelegram();
      if (!mounted) return false;
      return true;
    } catch (e) {
      if (!mounted) return false;
      _emitError(e, LoginErrorKind.telegram);
      return false;
    } finally {
      if (mounted) state = state.copyWith(telegramLoading: false);
    }
  }

  void _startCountdown() {
    _codeTimer?.cancel();
    state = state.copyWith(codeCountdown: 58);
    _codeTimer = Timer.periodic(const Duration(seconds: 1), (Timer timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (state.codeCountdown <= 1) {
        timer.cancel();
        state = state.copyWith(codeCountdown: 0);
        return;
      }
      state = state.copyWith(codeCountdown: state.codeCountdown - 1);
    });
  }

  void _emitError(Object e, LoginErrorKind kind) {
    final DomainError d = ErrorRouter.normalize(e);
    state = state.copyWith(
      errorMessage: d.message,
      errorPrefixKind: kind,
      errorEpoch: state.errorEpoch + 1,
    );
  }
}

final loginSheetControllerProvider =
    NotifierProvider.autoDispose<LoginSheetController, LoginSheetState>(
      LoginSheetController.new,
    );
